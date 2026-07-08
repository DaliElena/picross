const HISTORY_KEY  = 'nonogram_history_v1';
const PROGRESS_KEY = 'nonogram_progress_v1';
const BESTS_KEY    = 'nonogram_bests_v1';

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export function saveHistoryEntry(entry) {
  const h = loadHistory();
  h.unshift(entry);
  if (h.length > 100) h.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function isBetter(entry, cur) {
  return !cur || entry.stars > cur.stars || (entry.stars === cur.stars && entry.time < cur.time);
}

/* Лучшие результаты по каждому пазлу: { [puzzleId]: { stars, time, date } }.
   История — лента последних 100 игр, а bests не обрезаются, поэтому
   звёзды в каталоге не пропадают после сотни партий. */
export function loadBests() {
  try {
    const raw = localStorage.getItem(BESTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* повреждённый ключ — пересоберём из истории */ }
  // Миграция: у старых сохранений bests ещё нет — собираем из истории
  const bests = {};
  for (const e of loadHistory()) {
    if (isBetter(e, bests[e.puzzleId])) bests[e.puzzleId] = { stars: e.stars, time: e.time, date: e.date };
  }
  localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
  return bests;
}

export function saveBest(entry) {
  const bests = loadBests();
  if (!isBetter(entry, bests[entry.puzzleId])) return;
  bests[entry.puzzleId] = { stars: entry.stars, time: entry.time, date: entry.date };
  localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
}

/* Удаляет запись истории (по puzzleId + date) и пересчитывает лучший
   результат пазла по оставшимся записям; без записей best удаляется. */
export function deleteHistoryEntry(entry) {
  const h = loadHistory().filter(e => !(e.puzzleId === entry.puzzleId && e.date === entry.date));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));

  const bests = loadBests();
  let best = null;
  for (const e of h) if (e.puzzleId === entry.puzzleId && isBetter(e, best)) best = e;
  if (best) bests[entry.puzzleId] = { stars: best.stars, time: best.time, date: best.date };
  else delete bests[entry.puzzleId];
  localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
}

export function clearHistory() {
  localStorage.setItem(HISTORY_KEY, '[]');
  localStorage.setItem(BESTS_KEY, '{}');
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
