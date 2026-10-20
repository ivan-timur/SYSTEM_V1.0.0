#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const outputDir = path.resolve(__dirname, '..', 'dist', 'ts');
if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
  throw new Error('TypeScript output directory is missing; compile TypeScript before writing the module marker.');
}
fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
console.log('Marked dist/ts output as native ES modules.');
