#!/usr/bin/env node
// nextjs-web/public/icon.svg を 256x256 の PNG に変換して launcher/assets/icon.png に保存
const fs = require('fs');
const path = require('path');

const launcherDir = path.resolve(__dirname, '..');
const svgPath = path.join(launcherDir, '..', 'nextjs-web', 'public', 'icon.svg');
const outPath = path.join(launcherDir, 'assets', 'icon.png');

if (!fs.existsSync(svgPath)) {
  console.error('icon.svg not found:', svgPath);
  process.exit(1);
}

let svg = fs.readFileSync(svgPath, 'utf8');
// 256x256 にスケール（viewBox は維持）
svg = svg.replace(/width="128" height="128"/, 'width="256" height="256"');

const { Resvg } = require('@resvg/resvg-js');
const resvg = new Resvg(svg);
const pngData = resvg.render();
const pngBuffer = pngData.asPng();

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, pngBuffer);
console.log('Created', outPath);
