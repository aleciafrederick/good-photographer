#!/usr/bin/env node
/**
 * Build build/icon.icns from resources/good-photographer-icon.png for the Mac app.
 * Uses make-icns (mk-icns) which requires the PNG to be at least 1024x1024 for best quality.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'resources', 'good-photographer-icon.png');
const outDir = path.join(root, 'build');

if (!fs.existsSync(src)) {
  console.error('Source icon not found: resources/good-photographer-icon.png');
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const makeIcns = path.join(root, 'node_modules', 'make-icns', 'index.js');
execSync(`node "${makeIcns}" "${src}" "${outDir}" -n icon`, {
  cwd: root,
  stdio: 'inherit',
});

console.log('Built build/icon.icns');
