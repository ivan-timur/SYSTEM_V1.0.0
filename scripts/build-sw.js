#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim().split(/\s+/)[0];
const shell = ['./', 'index.html', 'VERSION', 'manifest.webmanifest', 'sw.js'];
for (const folder of ['assets', 'css', 'js', 'dist/ts']) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) shell.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  walk(path.join(ROOT, folder));
}
const files = [...new Set(shell)];
const missing = files.filter((rel) => rel !== './' && !fs.existsSync(path.join(ROOT, rel)));
if (missing.length) throw new Error(`Precache contains missing files:\n${missing.join('\n')}`);
const contents = `/* SYSTEM ${version} service worker — generated complete same-origin app shell. */
const APP_VERSION = ${JSON.stringify(version)};
const CACHE_NAME = \`system-v\${APP_VERSION}\`;
const SHELL = ${JSON.stringify(files, null, 2)};

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("system-v") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) return;

    const imageRequest = /\\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(requestUrl.pathname);
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (imageRequest) {
            const cached = await cache.match(request);
            if (cached) return cached;
            const network = await fetch(request);
            if (network.ok) await cache.put(request, network.clone());
            return network;
        }
        try {
            const network = await fetch(request);
            if (network.ok) await cache.put(request, network.clone());
            return network;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            const fallback = await cache.match("index.html");
            if (fallback && request.mode === "navigate") return fallback;
            throw error;
        }
    })());
});
`;
fs.writeFileSync(path.join(ROOT, 'sw.js'), contents);
console.log(`Built sw.js for ${version}; precaching ${files.length} same-origin resources.`);
