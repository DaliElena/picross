const HISTORY_KEY  = 'nonogram_history_v1';
const PROGRESS_KEY = 'nonogram_progress_v1';

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveHistoryEntry(entry) {
  const h = loadHistory();
  h.unshift(entry);
  if (h.length > 100) h.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export function loadAllProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}

export function saveProgress({ solved, currentPuzzleId, grid, mistakes, seconds }) {
  if (solved) return;
  const all = loadAllProgress();
  all[currentPuzzleId] = { grid, mistakes, seconds, savedAt: Date.now() };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function clearProgress(id) {
  const all = loadAllProgress();
  delete all[id];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export function getProgress(id) {
  return loadAllProgress()[id] || null;
}
