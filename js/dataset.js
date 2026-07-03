import { PUZZLES } from './puzzles.js';
import { DATASET_PUZZLES } from './puzzles-dataset.js';

let loaded = false;

function expandSol(masks, size) {
  const sol = [];
  for (const mask of masks) {
    const row = [];
    for (let i = size - 1; i >= 0; i--) {
      row[i] = (mask >> (size - 1 - i)) & 1;
    }
    sol.push(row);
  }
  return sol;
}

export function loadDataset() {
  if (loaded) return Promise.resolve(0);
  loaded = true;

  const existingIds = new Set(PUZZLES.map(p => p.id));
  let count = 0;

  for (const [id, name, size, difficulty, masks] of DATASET_PUZZLES) {
    if (existingIds.has(id)) continue;
    PUZZLES.push({ id, name, size, difficulty, sol: expandSol(masks, size) });
    count++;
  }

  return Promise.resolve(count);
}
