#!/usr/bin/env node
'use strict';

/** Packages the local WebView application for SYSTEM's web-only OTA channel. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www');
const OUTPUT = path.join(ROOT, 'dist', 'ota-publish');
const BUNDLE_NAME = 'SYSTEM-Web.zip';
const MAX_FILES = 6000;
const MAX_UNCOMPRESSED = 90 * 1024 * 1024;

function readVersion(file, label) {
  const value = fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`${label} must use semantic version x.y.z; got: ${value}`);
  const nums = value.split('.').map(Number);
  if (nums.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error(`${label} is outside the supported version range.`);
  return value;
}

function walkFiles(directory, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const absolute = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not permitted in OTA bundles: ${relative}`);
    if (entry.isDirectory()) out.push(...walkFiles(absolute, relative));
    else if (entry.isFile()) out.push({ absolute, relative: `www/${relative}` });
  }
  return out;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) crc = crcTable[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime() {
  // Stable ZIP timestamps make identical source trees produce identical checksums.
  return { time: 0, date: (1 << 5) | 1 }; // 1980-01-01 00:00:00
}
function zipFiles(files, destination) {
  if (files.length === 0 || files.length > MAX_FILES) throw new Error(`OTA bundle file count is invalid: ${files.length}`);
  let uncompressedTotal = 0;
  const chunks = [];
  const central = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const data = fs.readFileSync(file.absolute);
    uncompressedTotal += data.length;
    if (uncompressedTotal > MAX_UNCOMPRESSED) throw new Error('Web app bundle exceeds the 90 MiB uncompressed safety limit.');
    const name = Buffer.from(file.relative, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filenames
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    chunks.push(local, compressed);

    const item = Buffer.alloc(46 + name.length);
    item.writeUInt32LE(0x02014B50, 0);
    item.writeUInt16LE(20, 4);
    item.writeUInt16LE(20, 6);
    item.writeUInt16LE(0x0800, 8);
    item.writeUInt16LE(8, 10);
    item.writeUInt16LE(stamp.time, 12);
    item.writeUInt16LE(stamp.date, 14);
    item.writeUInt32LE(checksum, 16);
    item.writeUInt32LE(compressed.length, 20);
    item.writeUInt32LE(data.length, 24);
    item.writeUInt16LE(name.length, 28);
    item.writeUInt16LE(0, 30);
    item.writeUInt16LE(0, 32);
    item.writeUInt16LE(0, 34);
    item.writeUInt16LE(0, 36);
    item.writeUInt32LE(0, 38);
    item.writeUInt32LE(offset, 42);
    name.copy(item, 46);
    central.push(item);
    offset += local.length + compressed.length;
  }

  const centralData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  fs.writeFileSync(destination, Buffer.concat([...chunks, centralData, end]));
}

function main() {
  const webVersion = readVersion('WEB_VERSION', 'WEB_VERSION');
  const minNativeVersion = readVersion('WEB_MIN_NATIVE_VERSION', 'WEB_MIN_NATIVE_VERSION');
  if (!fs.existsSync(path.join(WEB_ROOT, 'index.html')) || !fs.existsSync(path.join(WEB_ROOT, 'js', 'modules', 'android-native.js'))) {
    throw new Error('Android web assets are missing. Run npm run prepare:android before packaging OTA.');
  }
  const bundledVersion = fs.readFileSync(path.join(WEB_ROOT, 'WEB_VERSION'), 'utf8').trim();
  if (bundledVersion !== webVersion) throw new Error(`Android asset WEB_VERSION (${bundledVersion}) does not match root WEB_VERSION (${webVersion}). Run npm run prepare:android.`);
  const files = walkFiles(WEB_ROOT);
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT, { recursive: true });
  const zipPath = path.join(OUTPUT, BUNDLE_NAME);
  zipFiles(files, zipPath);
  const zipBytes = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
  fs.writeFileSync(path.join(OUTPUT, `${BUNDLE_NAME}.sha256`), `${sha256}  ${BUNDLE_NAME}\n`);

  const manifest = {
    schemaVersion: 1,
    channel: 'system-ota',
    version: webVersion,
    minNativeVersion,
    zip: BUNDLE_NAME,
    sha256,
    size: zipBytes.length,
    fileCount: files.length,
    builtAt: new Date().toISOString(),
    sourceCommit: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 12) : 'local'
  };
  fs.writeFileSync(path.join(OUTPUT, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Created web-only OTA bundle: ${path.relative(ROOT, zipPath)} (${zipBytes.length} bytes, ${files.length} files).`);
  console.log(`Web version ${webVersion}; minimum native version ${minNativeVersion}; SHA-256 ${sha256}.`);
}

try { main(); }
catch (error) { console.error(`WEB OTA PACKAGE FAILED: ${error.message}`); process.exit(1); }
