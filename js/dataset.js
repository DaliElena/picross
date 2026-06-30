import { PUZZLES } from './puzzles.js';

function parseSolution(solutionStr) {
  const lines = solutionStr.trim().split('\n');
  const [rows, cols] = lines[0].split(' ').map(Number);
  if (rows !== cols) return null;
  const sol = [];
  for (let i = 1; i <= rows; i++) {
    if (!lines[i]) return null;
    sol.push(lines[i].split(' ').map(c => c === 'x' ? 1 : 0));
  }
  return { size: rows, sol };
}

function getDifficulty(size) {
  if (size <= 10) return 'easy';
  if (size <= 15) return 'medium';
  return 'hard';
}

export async function loadDataset(baseUrl = '') {
  try {
    const res = await fetch(baseUrl + 'Nonogram_dataset.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let count = 0;
    for (const [key, entry] of Object.entries(data.data)) {
      if (!entry.solution) continue;
      const parsed = parseSolution(entry.solution);
      if (!parsed) continue;
      const numId = key.split('_')[0];
      const id = 'ds_' + key;
      if (PUZZLES.find(p => p.id === id)) continue;
      PUZZLES.push({
        id,
        name: '#' + numId,
        size: parsed.size,
        difficulty: getDifficulty(parsed.size),
        sol: parsed.sol,
      });
      count++;
    }
    return count;
  } catch (e) {
    console.error('Не удалось загрузить датасет:', e);
    return 0;
  }
}
