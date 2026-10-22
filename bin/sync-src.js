#!/usr/bin/env node
// Kopiert die Logik-Module src/*.js nach public/js/core/ (Browser-Route).
// Wird vor jedem Deploy und vor Commit ausgefuehrt.
import { mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'public', 'js', 'core');
mkdirSync(out, { recursive: true });

const header = '// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)\n';
for (const f of readdirSync(src).filter(f => f.endsWith('.js'))) {
  writeFileSync(join(out, f), header + readFileSync(join(src, f), 'utf8'));
  console.log('core/' + f);
}
