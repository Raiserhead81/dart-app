#!/usr/bin/env node
// Stempelt VERSION-Datei + ersetzt __VERSION__ im Service Worker.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v = process.argv[2] || `1.0.${Math.floor(Date.now() / 1000)}`;
writeFileSync(join(root, 'public', 'VERSION'), v + '\n');
const swPath = join(root, 'public', 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace(/__VERSION__/g, v.replace(/\./g, '-'));
writeFileSync(swPath, sw);
console.log('VERSION =', v);
