#!/usr/bin/env node
// Run: node scripts/build-dataset.js
// Reads Nonogram_dataset.json, writes js/puzzles-dataset.js
//
// Each puzzle's solution is stored as an array of integers (one per row),
// where each integer is a bitmask of the row (MSB = leftmost cell).
// Decoded at runtime in dataset.js with expandSol().
//
// Фильтр качества: в датасет попадают только пазлы, полностью решаемые
// построчной логикой (итеративное пересечение всех допустимых раскладок
// строк/столбцов). Пазлы, требующие угадывания или продвинутых техник,
// отбрасываются — иначе игрок получает штраф «ошибка» за вынужденную
// пробу на неоднозначном месте.
// Число полных проходов солвера сохраняется в записи пазла и служит
// метрикой сложности вместо размера.

const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '..', 'Nonogram_dataset.json');
const DEST = path.join(__dirname, '..', 'js', 'puzzles-dataset.js');

function parseSolution(solutionStr) {
  const lines = solutionStr.trim().split('\n');
  const [rows, cols] = lines[0].split(' ').map(Number);
  if (rows !== cols) return null;
  const masks = [];
  const sol = [];
  for (let i = 1; i <= rows; i++) {
    if (!lines[i]) return null;
    const cells = lines[i].trim().split(' ');
    let mask = 0;
    const row = [];
    for (const c of cells) {
      const v = c === 'x' ? 1 : 0;
      mask = (mask << 1) | v;
      row.push(v);
    }
    masks.push(mask);
    sol.push(row);
  }
  return { size: rows, masks, sol };
}

/* ---- LINE SOLVER ---- */

// Блоки закрашенных клеток линии: [1,1,0,1] -> [2,1]; пустая линия -> []
function lineBlocks(arr) {
  const r = []; let c = 0;
  for (const v of arr) { if (v === 1) c++; else if (c) { r.push(c); c = 0; } }
  if (c) r.push(c);
  return r;
}

// Уточняет линию (значения: -1 неизвестно, 0 пусто, 1 закрашено) пересечением
// всех допустимых раскладок блоков cl. Возвращает { out, changed, resolved }
// или null при противоречии.
function solveLine(line, cl) {
  const n = line.length, B = cl.length, W = B + 1;
  const memo = new Int8Array((n + 1) * W).fill(-1);

  // feasible(p, b): можно ли клетки [p..n) заполнить блоками [b..B)
  function feasible(p, b) {
    if (p >= n) return b === B;
    const k = p * W + b;
    if (memo[k] !== -1) return memo[k] === 1;
    let ok = false;
    // клетка p — пустая
    if (line[p] !== 1 && feasible(p + 1, b)) ok = true;
    // блок b начинается в p
    if (!ok && b < B) {
      const end = p + cl[b];
      if (end <= n) {
        let fits = true;
        for (let i = p; i < end; i++) if (line[i] === 0) { fits = false; break; }
        if (fits) {
          if (end === n) ok = feasible(end, b + 1);
          else if (line[end] !== 1) ok = feasible(end + 1, b + 1);
        }
      }
    }
    memo[k] = ok ? 1 : 0;
    return ok;
  }

  if (!feasible(0, 0)) return null;

  // Обход достижимых допустимых состояний с пометкой, какие значения
  // возможны в каждой клетке.
  const canFill  = new Uint8Array(n);
  const canEmpty = new Uint8Array(n);
  const visited  = new Uint8Array((n + 1) * W);
  const stack = [[0, 0]];
  while (stack.length) {
    const [p, b] = stack.pop();
    if (p >= n) continue;
    const k = p * W + b;
    if (visited[k]) continue;
    visited[k] = 1;
    if (line[p] !== 1 && feasible(p + 1, b)) {
      canEmpty[p] = 1;
      stack.push([p + 1, b]);
    }
    if (b < B) {
      const end = p + cl[b];
      if (end <= n) {
        let fits = true;
        for (let i = p; i < end; i++) if (line[i] === 0) { fits = false; break; }
        if (fits && (end === n ? feasible(end, b + 1) : (line[end] !== 1 && feasible(end + 1, b + 1)))) {
          for (let i = p; i < end; i++) canFill[i] = 1;
          if (end < n) canEmpty[end] = 1;
          stack.push([end + 1, b + 1]);
        }
      }
    }
  }

  const out = line.slice();
  let changed = false, resolved = 0;
  for (let i = 0; i < n; i++) {
    if (out[i] !== -1) continue;
    if (canFill[i] && !canEmpty[i])      { out[i] = 1; changed = true; resolved++; }
    else if (!canFill[i] && canEmpty[i]) { out[i] = 0; changed = true; resolved++; }
    else if (!canFill[i] && !canEmpty[i]) return null;
  }
  return { out, changed, resolved };
}

// Решает пазл построчной логикой. Возвращает число полных проходов
// (строки + столбцы) до полного вывода решения, или null, если логика
// застревает — пазл требует угадывания.
function lineSolvePasses(sol) {
  const size = sol.length;
  const rowCl = sol.map(lineBlocks);
  const colCl = [];
  for (let j = 0; j < size; j++) colCl.push(lineBlocks(sol.map(r => r[j])));

  const g = Array.from({ length: size }, () => new Array(size).fill(-1));
  let unknown = size * size;
  let passes = 0;

  while (unknown > 0) {
    passes++;
    let progress = false;
    for (let i = 0; i < size; i++) {
      const res = solveLine(g[i], rowCl[i]);
      if (!res) return null;
      if (res.changed) { g[i] = res.out; unknown -= res.resolved; progress = true; }
    }
    for (let j = 0; j < size; j++) {
      const res = solveLine(g.map(r => r[j]), colCl[j]);
      if (!res) return null;
      if (res.changed) {
        for (let i = 0; i < size; i++) g[i][j] = res.out[i];
        unknown -= res.resolved; progress = true;
      }
    }
    if (!progress) return null;
  }

  // Санити-чек: выведенное решение обязано совпасть с эталоном
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    if (g[i][j] !== sol[i][j]) return null;
  }
  return passes;
}

// Сложность по работе солвера, а не по размеру поля: чем больше проходов
// потребовала дедукция, тем сложнее пазл для человека.
function getDifficulty(passes) {
  if (passes <= 3) return 'easy';
  if (passes <= 6) return 'medium';
  return 'hard';
}

console.log('Reading', SRC, '...');
const raw  = fs.readFileSync(SRC, 'utf8');
const data = JSON.parse(raw);
const entries = Object.entries(data.data);

console.log(`Parsing ${entries.length} entries...`);

const puzzles = [];
let dropped = 0;
const statBySize = {};   // size -> { kept, dropped }
const passHist = {};     // passes -> count

for (const [key, entry] of entries) {
  if (!entry.solution) continue;
  const parsed = parseSolution(entry.solution);
  if (!parsed) continue;
  const st = statBySize[parsed.size] || (statBySize[parsed.size] = { kept: 0, dropped: 0 });
  const passes = lineSolvePasses(parsed.sol);
  if (passes === null) { dropped++; st.dropped++; continue; }
  st.kept++;
  passHist[passes] = (passHist[passes] || 0) + 1;
  puzzles.push([
    'ds_' + key,             // id
    '#' + key.split('_')[0], // name
    parsed.size,             // size
    getDifficulty(passes),   // difficulty
    parsed.masks,            // row bitmasks
    passes,                  // сложность: число проходов line-solver'а
  ]);
}

console.log(`Kept ${puzzles.length}, dropped ${dropped} (not line-solvable).`);
for (const size of Object.keys(statBySize).sort((a, b) => a - b)) {
  const s = statBySize[size];
  console.log(`  ${size}×${size}: kept ${s.kept}, dropped ${s.dropped}`);
}
console.log('Passes histogram:', JSON.stringify(passHist));
const diffCount = { easy: 0, medium: 0, hard: 0 };
for (const p of puzzles) diffCount[p[3]]++;
console.log('Difficulty split:', JSON.stringify(diffCount));

console.log(`Writing ${puzzles.length} puzzles to`, DEST, '...');

const json   = JSON.stringify(puzzles);
const output = `// Auto-generated by scripts/build-dataset.js — do not edit manually\nwindow.DATASET_PUZZLES = ${json};\n`;

fs.writeFileSync(DEST, output, 'utf8');

const kb = (fs.statSync(DEST).size / 1024).toFixed(1);
console.log(`Done. Output size: ${kb} KB`);
