import { PUZZLES } from './puzzles.js';

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

export async function loadDataset() {
  if (loaded) return 0;
  loaded = true;

  let DATASET_PUZZLES = window.DATASET_PUZZLES;
  if (!DATASET_PUZZLES) {
    try {
      ({ DATASET_PUZZLES } = await import('./puzzles-dataset.js'));
      DATASET_PUZZLES = DATASET_PUZZLES || window.DATASET_PUZZLES;
    } catch (e) {
      console.warn('Dataset not available:', e);
      return 0;
    }
  }

  const existingIds = new Set(PUZZLES.map(p => p.id));
  let count = 0;

  for (const [id, name, size, difficulty, masks] of DATASET_PUZZLES) {
    if (existingIds.has(id)) continue;
    PUZZLES.push({ id, name, size, difficulty, sol: expandSol(masks, size) });
    count++;
  }

  return count;
}
