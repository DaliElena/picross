// Run: node scripts/bundle.js
// Generates bundle.js for direct file:// opening (no ES modules needed)
const fs   = require('fs');
const path = require('path');

const ROOT   = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

const FILES = [
  'puzzles.js',
  'puzzles-dataset.js',
  'storage.js',
  'game.js',
  'ui.js',
  'dataset.js',
  'main.js',
];

function transform(code, filename) {
  // Remove all import lines
  code = code.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?\n/gm, '');
  // Remove export keyword from declarations
  code = code.replace(/^export\s+((?:async\s+)?(?:function|class|const|let|var)\s)/gm, '$1');
  // Remove standalone export { ... } blocks
  code = code.replace(/^export\s+\{[^}]*\}\s*;?\r?\n/gm, '');

  // dataset.js: replace dynamic import with direct variable reference
  if (filename === 'dataset.js') {
    code = code.replace(
      /let DATASET_PUZZLES;\s*try\s*\{[\s\S]*?await import\(['"][^'"]+['"]\)\s*\)[\s\S]*?\}\s*catch[\s\S]*?\{[\s\S]*?return 0;\s*\}/,
      '// DATASET_PUZZLES is available from puzzles-dataset.js (bundled)'
    );
    // Also remove the async keyword since no await is needed anymore
    code = code.replace(/^export async function loadDataset/, 'async function loadDataset');
    code = code.replace(/^async function loadDataset/, 'function loadDataset');
  }

  return code;
}

const parts = FILES.map(file => {
  const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  return `// ===== ${file} =====\n${transform(src, file)}`;
});

const out = `(function () {\n'use strict';\n\n${parts.join('\n')}\n})();\n`;
fs.writeFileSync(path.join(ROOT, 'bundle.js'), out, 'utf8');
console.log(`bundle.js written (${(out.length / 1024).toFixed(0)} KB)`);
