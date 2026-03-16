#!/usr/bin/env node
/**
 * build.js — Packages src/ into dist/confetti-burst.cssm
 *
 * A .cssm file is just a ZIP. This script:
 * 1. Reads all files from src/
 * 2. Validates manifest.json is present
 * 3. Zips them into dist/confetti-burst.cssm
 *
 * Usage: node build.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { zipSync, strToU8 } from 'fflate';
import { resolve, basename } from 'path';

const SRC = './src';
const OUT = './dist/confetti-burst.cssm';

const files = [
  'manifest.json',
  'animation.svg',
  'animation.css',
];

console.log('\n📦 Building confetti-burst.cssm...\n');

const zipContents = {};

for (const file of files) {
  const path = resolve(SRC, file);
  const content = readFileSync(path);
  zipContents[file] = [content, { level: 9 }];
  const kb = (content.length / 1024).toFixed(1);
  console.log(`  ✓ ${file.padEnd(24)} ${kb} KB`);
}

// Validate manifest is parseable
try {
  JSON.parse(readFileSync(resolve(SRC, 'manifest.json'), 'utf-8'));
  console.log('\n  ✓ manifest.json is valid JSON');
} catch (e) {
  console.error('\n  ✗ manifest.json is invalid JSON:', e.message);
  process.exit(1);
}

// Zip
const zipped = zipSync(zipContents);

// Write
mkdirSync('./dist', { recursive: true });
writeFileSync(OUT, zipped);

const totalKb = (zipped.length / 1024).toFixed(1);
console.log(`\n✅ Built: ${OUT} (${totalKb} KB)\n`);
