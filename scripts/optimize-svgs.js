import fs from 'fs';
import path from 'path';
import { optimize } from 'svgo';

const assetsDir = 'docs/assets';
if (!fs.existsSync(assetsDir)) {
  console.error(`Assets directory ${assetsDir} not found.`);
  process.exit(1);
}

const files = fs
  .readdirSync(assetsDir)
  .filter((f) => f.endsWith('.svg'))
  .map((f) => ({ name: f, size: fs.statSync(path.join(assetsDir, f)).size }))
  .sort((a, b) => b.size - a.size);

// Optimize top map SVGs (or all if specified)
const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 50;
const targetFiles = files.slice(0, limit);

console.log(`Optimizing top ${targetFiles.length} largest SVG map assets in ${assetsDir}...`);

let origTotal = 0;
let optTotal = 0;

for (const item of targetFiles) {
  const p = path.join(assetsDir, item.name);
  const content = fs.readFileSync(p, 'utf8');
  origTotal += content.length;

  try {
    const result = optimize(content, {
      path: p,
      multipass: true,
      floatPrecision: 1,
    });
    fs.writeFileSync(p, result.data, 'utf8');
    optTotal += result.data.length;
  } catch (err) {
    console.warn(`Failed to optimize ${item.name}:`, err);
    optTotal += content.length;
  }
}

console.log('SVG Optimization complete.');
console.log(`Original size of top assets: ${(origTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`Optimized size: ${(optTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(
  `Saved: ${((origTotal - optTotal) / 1024 / 1024).toFixed(2)} MB (${((1 - optTotal / origTotal) * 100).toFixed(1)}%)`
);
