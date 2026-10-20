#!/usr/bin/env node
'use strict';

/*
 * Real-browser IndexedDB integration runner.
 *
 * Prefer Playwright's installed Chromium in CI. If Playwright is not installed,
 * fall back to a dependency-free Chrome DevTools Protocol (CDP) runner. The
 * fallback respects managed URL policy and never attempts to override it.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TEST_PATH = '/tests/browser/indexeddb-transaction-test.html';
const TIMEOUT_MS = Number(process.env.SYSTEM_BROWSER_TEST_TIMEOUT_MS || 45_000);
const VERBOSE = process.env.SYSTEM_BROWSER_TEST_VERBOSE === '1';
function logStage(message) { if (VERBOSE) console.error(`[browser-idb] ${message}`); }
function managedPolicyDiagnostics() {
  const dirs = [
    process.env.CHROMIUM_POLICY_DIR,
    '/etc/chromium/policies/managed',
    '/etc/opt/chrome/policies/managed',
    '/usr/local/chromium/policies/managed',
  ].filter(Boolean);
  const matches = [];
  for (const dir of [...new Set(dirs)]) {
    let files = [];
    try { files = fs.readdirSync(dir).filter(name => name.endsWith('.json')); } catch { continue; }
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const policy = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (Array.isArray(policy.URLBlocklist) && policy.URLBlocklist.includes('*')) {
          matches.push(`${fullPath} contains URLBlocklist ["*"]`);
        }
      } catch { /* ignore non-JSON and unreadable policy files */ }
    }
  }
  return matches;
}
function blockedNavigationError() {
  const details = managedPolicyDiagnostics();
  const suffix = details.length
    ? ` Detected: ${details.join('; ')}. This project runner does not alter managed policy; run the test in an authorized CI/browser environment that permits localhost.`
    : ' Run the test in an authorized browser environment that permits localhost pages.';
  return new Error(`The managed browser policy blocked the local IndexedDB test page (net::ERR_BLOCKED_BY_ADMINISTRATOR). No IndexedDB result was produced.${suffix}`);
}
const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/usr/lib/chromium/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);
let playwrightChromium = null;
try {
  // Prefer Playwright's explicitly installed test browser in CI. It avoids
  // accidentally selecting a host-managed system Chromium with unrelated
  // enterprise URL policies. It does not weaken or override those policies.
  playwrightChromium = require('@playwright/test').chromium || null;
} catch (error) {
  const isPlaywrightPackageMissing = error?.code === 'MODULE_NOT_FOUND'
    && String(error?.message || '').includes("'@playwright/test'");
  if (!isPlaywrightPackageMissing) throw error;
}
const chromium = CHROMIUM_CANDIDATES.find(candidate => fs.existsSync(candidate));
if (!playwrightChromium && !chromium) {
  console.error('No browser executable was found. Install @playwright/test and its Chromium browser, or set CHROMIUM_PATH for the dependency-free CDP runner.');
  process.exit(2);
}
if (!playwrightChromium && typeof WebSocket === 'undefined') {
  console.error('Node.js global WebSocket is unavailable. Use Node.js 20+ for the dependency-free CDP runner.');
  process.exit(2);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function reserveLocalPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : null;
      probe.close(error => error ? reject(error) : (port ? resolve(port) : reject(new Error('Could not reserve a local debugging port'))));
    });
  });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForJson(url, child, deadline) {
  let lastError = 'Browser DevTools endpoint is not ready';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Chromium exited during startup (code ${child.exitCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return await response.json();
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error.message || String(error); }
    await delay(150);
  }
  throw new Error(`Timed out waiting for Chromium DevTools: ${lastError}`);
}

function makeCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 0;
  const pending = new Map();
  const events = [];
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to Chromium DevTools WebSocket')), { once: true });
  });
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (message.id && pending.has(message.id)) {
      if (VERBOSE) console.error(`[browser-idb] CDP response id=${message.id}`);
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message || 'Chromium DevTools command failed'));
      else entry.resolve(message.result || {});
    } else if (message.method) {
      if (VERBOSE && /exception|console|log|error/i.test(message.method)) console.error(`[browser-idb] CDP event ${message.method}`);
      events.push(message);
      if (events.length > 80) events.shift();
    }
  });
  return {
    socket,
    events,
    async connect() { await ready; },
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chromium DevTools command timed out: ${method}`));
        }, 5000);
        pending.set(id, {
          resolve: value => { clearTimeout(timer); resolve(value); },
          reject: error => { clearTimeout(timer); reject(error); },
        });
        if (VERBOSE) console.error(`[browser-idb] CDP send id=${id} method=${method}`);
      socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { try { socket.close(); } catch { /* already closed */ } },
  };
}

async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'system-idb-cdp-'));
  const stderrPath = path.join(workDir, 'chromium.stderr');
  const stderrFd = fs.openSync(stderrPath, 'w');
  let child;
  let server;
  let cdp;
  let browser;
  let outcome = 1;
  const deadline = Date.now() + TIMEOUT_MS;

  try {
    server = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch { res.writeHead(400).end('Bad request'); return; }
      const fullPath = path.resolve(ROOT, `.${pathname}`);
      if (fullPath !== ROOT && !fullPath.startsWith(`${ROOT}${path.sep}`)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      fs.readFile(fullPath === ROOT ? path.join(ROOT, 'index.html') : fullPath, (error, bytes) => {
        if (error) { res.writeHead(404).end('Not found'); return; }
        res.writeHead(200, {
          'content-type': contentTypes[path.extname(fullPath)] || 'application/octet-stream',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        res.end(bytes);
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    logStage('local HTTP server is ready');
    const httpAddress = server.address();
    const httpPort = httpAddress && typeof httpAddress === 'object' ? httpAddress.port : null;
    if (!httpPort) throw new Error('Could not start the local test server');
    const testUrl = `http://127.0.0.1:${httpPort}${TEST_PATH}`;

    if (playwrightChromium) {
      logStage(`launching Playwright Chromium at ${testUrl}`);
      browser = await playwrightChromium.launch({ headless: true });
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error?.message || String(error)));
      try {
        await page.goto(testUrl, { waitUntil: 'load', timeout: Math.max(1000, Math.min(TIMEOUT_MS, deadline - Date.now())) });
        await page.waitForFunction(
          () => ['passed', 'failed'].includes(document.body?.dataset?.testStatus),
          null,
          { timeout: Math.max(1000, deadline - Date.now()) },
        );
      } catch (error) {
        const message = String(error?.message || error);
        if (/ERR_BLOCKED_BY_ADMINISTRATOR/i.test(message)) throw blockedNavigationError();
        if (pageErrors.length) {
          throw new Error(`The IndexedDB test page did not finish. Browser errors: ${pageErrors.join(' | ')}. Navigation/wait error: ${message}`);
        }
        throw error;
      }
      const state = await page.evaluate(() => ({
        status: document.body?.dataset?.testStatus || 'unknown',
        result: document.querySelector('#test-result')?.textContent || '',
        href: location.href,
      }));
      if (state.status === 'failed') throw new Error(state.result || 'IndexedDB test page reported an unspecified failure');
      if (state.status !== 'passed') throw new Error(`IndexedDB test returned unexpected status: ${state.status}`);
      if (pageErrors.length) throw new Error(`Browser reported page errors after test completion: ${pageErrors.join(' | ')}`);
      console.log(state.result);
      outcome = 0;
    } else {
    const debugPort = await reserveLocalPort();
    logStage(`launching Chromium at ${testUrl}`);
    child = spawn(chromium, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-extensions', '--disable-background-networking', '--disable-component-update',
      '--disable-breakpad', '--disable-crash-reporter', '--disable-features=MediaRouter',
      '--noerrdialogs', '--no-first-run', '--no-default-browser-check',
      '--remote-allow-origins=*', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(workDir, 'profile')}`, testUrl,
    ], { stdio: ['ignore', 'ignore', stderrFd], detached: process.platform !== 'win32' });
    child.once('error', error => { console.error(`Could not execute Chromium: ${error.message}`); });

    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`, child, deadline);
    logStage('DevTools endpoint is ready');
    let targets = [];
    let target;
    while (Date.now() < deadline) {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) targets = await response.json();
      target = targets.find(item => item.type === 'page' && item.url.startsWith(testUrl));
      if (target?.webSocketDebuggerUrl) break;
      await delay(100);
    }
    if (!target?.webSocketDebuggerUrl) throw new Error(`Chromium did not open the IndexedDB test page. Targets: ${targets.map(item => `${item.type}:${item.url}`).join(', ')}`);
    logStage(`connected to page target ${target.id}`);

    cdp = makeCdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    // In some managed/container Chromium builds the CLI startup URL is left as
    // about:blank even though the target is created. Request the same local test
    // navigation through the standard Page domain; do not bypass an error page or
    // policy decision if Chromium rejects it.
    const navigation = await cdp.send('Page.navigate', { url: testUrl });
    if (navigation.errorText && /ERR_BLOCKED_BY_ADMINISTRATOR/i.test(navigation.errorText)) throw blockedNavigationError();
    if (navigation.errorText) throw new Error(`Chromium refused the IndexedDB test navigation: ${navigation.errorText}`);
    logStage('CDP navigation requested; waiting for test completion');

    let lastResult = { status: 'running', result: 'Waiting for test page to finish…' };
    while (Date.now() < deadline) {
      const evaluated = await cdp.send('Runtime.evaluate', {
        expression: `(() => ({status: document.body?.dataset?.testStatus || 'loading', result: document.querySelector('#test-result')?.textContent || '', href: location.href, bodyText: document.body?.innerText?.slice(0, 700) || ''}))()`,
        returnByValue: true,
        awaitPromise: true,
      });
      if (evaluated.exceptionDetails) {
        throw new Error(`Could not inspect test page: ${evaluated.exceptionDetails.text || 'Runtime evaluation failed'}`);
      }
      lastResult = evaluated.result?.value || lastResult;
      if (VERBOSE) logStage(`page state: ${JSON.stringify(lastResult)}`);
      if (String(lastResult.href || '').startsWith('chrome-error://')) {
        if (/blocked|organization|doesn.t allow|not allowed/i.test(String(lastResult.bodyText || ''))) throw blockedNavigationError();
        throw new Error(`Chromium failed to navigate to the test page: ${String(lastResult.bodyText || lastResult.href).slice(0, 300)}`);
      }
      if (!String(lastResult.href || '').startsWith(testUrl)) {
        throw new Error(`The browser is not on the requested test page (current URL: ${lastResult.href || 'unknown'}).`);
      }
      if (lastResult.status === 'passed') {
        console.log(lastResult.result);
        outcome = 0;
        break;
      }
      if (lastResult.status === 'failed') {
        throw new Error(lastResult.result || 'IndexedDB test page reported an unspecified failure');
      }
      await delay(200);
    }
    if (outcome !== 0 && Date.now() >= deadline) {
      throw new Error(`Real-browser IndexedDB integration test timed out after ${TIMEOUT_MS} ms. Last page state: ${lastResult.result}`);
    }
    }
  } catch (error) {
    console.error(error?.stack || String(error));
    const stderr = fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8') : '';
    if (stderr.trim()) console.error(`Chromium diagnostics (last 2 KB):\n${stderr.slice(-2048)}`);
  } finally {
    try { cdp?.close(); } catch { /* no-op */ }
    try { await browser?.close(); } catch { /* no-op */ }
    if (child && child.exitCode === null) {
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch { try { child.kill('SIGTERM'); } catch { /* already exited */ } }
      await Promise.race([new Promise(resolve => child.once('close', resolve)), delay(1500)]);
      if (child.exitCode === null) {
        try {
          if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch { try { child.kill('SIGKILL'); } catch { /* already exited */ } }
      }
    }
    if (server) {
      try { server.closeAllConnections?.(); } catch { /* API unavailable on older Node */ }
      await Promise.race([new Promise(resolve => server.close(() => resolve())), delay(750)]);
    }
    try { fs.closeSync(stderrFd); } catch { /* already closed */ }
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort temp cleanup */ }
  }
  process.exitCode = outcome;
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
