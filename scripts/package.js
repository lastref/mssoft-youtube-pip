#!/usr/bin/env node
'use strict';
// Builds dist/mssoft-youtube-pip-<version>.zip containing only the files the
// extension needs at runtime (what you upload to the Chrome Web Store).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const include = ['manifest.json', '_locales', 'icons', 'src', 'LICENSE', 'NOTICE'];
const out = path.join(root, 'dist', `mssoft-youtube-pip-${manifest.version}.zip`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', '-q', out, ...include, '-x', '*.DS_Store'], { cwd: root, stdio: 'inherit' });
console.log(`wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
