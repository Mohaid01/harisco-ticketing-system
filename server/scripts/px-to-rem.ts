import fs from 'fs';
import path from 'path';

const MULTIPLIER = 0.85;
const BASE = 16;
const FACTOR = MULTIPLIER / BASE;

function pxToRem(match: RegExpMatchArray): string {
  const px = parseFloat(match[1]);
  const rem = px * FACTOR;
  const formatted = rem % 1 === 0 ? rem.toFixed(1) : rem.toString();
  return `${formatted}rem`;
}

// CSS files: convert all px units to rem
const cssFiles = fs
  .readdirSync('src', { recursive: true })
  .filter((f: string) => f.endsWith('.css'))
  .map((f: string) => path.join('src', f));

for (const file of cssFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(/\b(\d+(?:\.\d+)?)px\b/g, (match, pxStr) => {
    const px = parseFloat(pxStr);
    const rem = Math.round(px * FACTOR * 10000) / 10000;
    const formatted = rem % 1 === 0 ? rem.toFixed(1) : rem.toString();
    return `${formatted}rem`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Converted: ${file}`);
  }
}

// TSX files: convert px in inline style attributes
const tsxFiles = fs
  .readdirSync('src', { recursive: true })
  .filter((f: string) => f.endsWith('.tsx'))
  .map((f: string) => path.join('src', f));

for (const file of tsxFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(/style=\{\{[^}]*?\b(\d+(?:\.\d+)?)px\b[^}]*?\}/g, (match) => {
    return match.replace(/\b(\d+(?:\.\d+)?)px\b/g, (m, pxStr) => {
      const px = parseFloat(pxStr);
      const rem = Math.round(px * FACTOR * 10000) / 10000;
      const formatted = rem % 1 === 0 ? rem.toFixed(1) : rem.toString();
      return `${formatted}rem`;
    });
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Converted: ${file}`);
  }
}

// Add :root font-size to index.css if not already present
const indexPath = path.join('src', 'index.css');
let indexContent = fs.readFileSync(indexPath, 'utf8');

if (!indexContent.includes(':root {') && !indexContent.includes('font-size: 0.85rem')) {
  // Find :root block and add font-size
  indexContent = indexContent.replace(/:root\s*\{/, `:root {\n  font-size: 0.85rem;`);
  fs.writeFileSync(indexPath, indexContent);
  console.log('Added :root font-size to index.css');
} else if (indexContent.includes(':root {')) {
  // Check if font-size already exists in :root
  const rootMatch = indexContent.match(/:root\s*\{([^}]*)\}/s);
  if (rootMatch && !rootMatch[1].includes('font-size')) {
    indexContent = indexContent.replace(/:root\s*\{/, `:root {\n  font-size: 0.85rem;`);
    fs.writeFileSync(indexPath, indexContent);
    console.log('Added font-size to existing :root in index.css');
  }
}

console.log('Conversion complete.');
