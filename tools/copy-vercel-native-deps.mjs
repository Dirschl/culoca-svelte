import { cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

const repoRoot = process.cwd();
const functionsRoot = join(repoRoot, '.vercel', 'output', 'functions');

function walk(dir, visit) {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      visit(fullPath);
      walk(fullPath, visit);
    }
  }
}

function copyIfPresent(source, target) {
  if (!existsSync(source)) return false;
  cpSync(source, target, { recursive: true });
  return true;
}

const sharpNodeModules = [];

walk(functionsRoot, (dir) => {
  if (existsSync(join(dir, 'sharp', 'package.json'))) {
    sharpNodeModules.push(dir);
  }
});

if (sharpNodeModules.length === 0) {
  console.log('[copy-vercel-native-deps] No traced sharp package found in Vercel output, skipping.');
  process.exit(0);
}

const copied = [];

for (const targetNodeModules of sharpNodeModules) {
  const targetImgDir = join(targetNodeModules, '@img');
  const sourceImgDir = join(repoRoot, 'node_modules', '@img');

  if (existsSync(sourceImgDir)) {
    for (const entry of readdirSync(sourceImgDir)) {
      if (!entry.startsWith('sharp-') && !entry.startsWith('sharp-libvips-')) continue;
      const source = join(sourceImgDir, entry);
      const target = join(targetImgDir, entry);
      if (copyIfPresent(source, target)) copied.push(target);
    }
  }

  const sourceExiftoolPl = join(repoRoot, 'node_modules', 'exiftool-vendored.pl');
  const targetExiftoolPl = join(targetNodeModules, 'exiftool-vendored.pl');
  if (copyIfPresent(sourceExiftoolPl, targetExiftoolPl)) copied.push(targetExiftoolPl);
}

console.log(
  copied.length > 0
    ? `[copy-vercel-native-deps] Copied ${copied.length} native dependency paths into Vercel functions.`
    : '[copy-vercel-native-deps] No additional native dependency paths were available to copy.'
);
