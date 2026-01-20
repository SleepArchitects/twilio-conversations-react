#!/usr/bin/env node
/**
 * Fix OpenNext 3.6.6 + pnpm symlink issue for Next.js 14
 * 
 * Problem: OpenNext 3.6.6 with pnpm creates dependencies in .pnpm/ directory
 * but doesn't create root-level symlinks that Next.js 14 requires for:
 * - styled-jsx (required by Next.js 14)
 * - @swc/helpers (required by Next.js compilation)
 * 
 * This script creates those symlinks after OpenNext build completes.
 * 
 * Note: Next.js 15+ doesn't have this issue as styled-jsx is built-in.
 */

import { existsSync, symlinkSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const nodeModulesPath = join(projectRoot, '.open-next/server-functions/default/node_modules');
const pnpmPath = join(nodeModulesPath, '.pnpm');

console.log('🔧 Fixing OpenNext + pnpm symlinks for Next.js 14...\n');

if (!existsSync(pnpmPath)) {
  console.error('❌ .pnpm directory not found. Did OpenNext build complete?');
  console.error(`   Expected: ${pnpmPath}`);
  process.exit(1);
}

let fixed = 0;

// Fix 1: styled-jsx
const styledJsxPattern = /^styled-jsx@[\d.]+/;
const styledJsxDir = readdirSync(pnpmPath).find(dir => styledJsxPattern.test(dir));

if (styledJsxDir) {
  const styledJsxSource = join('.pnpm', styledJsxDir, 'node_modules', 'styled-jsx');
  const styledJsxTarget = join(nodeModulesPath, 'styled-jsx');
  
  if (!existsSync(styledJsxTarget)) {
    symlinkSync(styledJsxSource, styledJsxTarget, 'dir');
    console.log(`✅ Created symlink: styled-jsx -> ${styledJsxSource}`);
    fixed++;
  } else {
    console.log(`✓  styled-jsx symlink already exists`);
  }
} else {
  console.warn('⚠️  styled-jsx not found in .pnpm - may cause runtime errors!');
}

// Fix 2: @swc/helpers
const swcHelpersPattern = /^@swc\+helpers@[\d.]+/;
const swcHelpersDir = readdirSync(pnpmPath).find(dir => swcHelpersPattern.test(dir));

if (swcHelpersDir) {
  const swcDir = join(nodeModulesPath, '@swc');
  const swcHelpersSource = join('..', '.pnpm', swcHelpersDir, 'node_modules', '@swc', 'helpers');
  const swcHelpersTarget = join(swcDir, 'helpers');
  
  if (!existsSync(swcDir)) {
    mkdirSync(swcDir, { recursive: true });
  }
  
  if (!existsSync(swcHelpersTarget)) {
    symlinkSync(swcHelpersSource, swcHelpersTarget, 'dir');
    console.log(`✅ Created symlink: @swc/helpers -> ${swcHelpersSource}`);
    fixed++;
  } else {
    console.log(`✓  @swc/helpers symlink already exists`);
  }
} else {
  console.warn('⚠️  @swc/helpers not found in .pnpm - may cause runtime errors!');
}

console.log('');
if (fixed > 0) {
  console.log(`🎉 Fixed ${fixed} symlink(s)`);
  console.log('');
  console.log('ℹ️  These symlinks will be preserved when zipping with: zip -ry');
} else {
  console.log('✅ All symlinks already exist');
}
console.log('');
