const HISTORY_KEY  = 'nonogram_history_v1';
const PROGRESS_KEY = 'nonogram_progress_v1';
const BESTS_KEY    = 'nonogram_bests_v1';
const LAST_KEY     = 'nonogram_last_v1';
const SETTINGS_KEY = 'nonogram_settings_v1';

/* Настройки игры: { showPreviews } — показывать ли в каталоге картинку
   решения нерешённых пазлов (для решённых превью показывается всегда). */
const DEFAULT_SETTINGS = { showPreviews: true };

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch }));
}

/* Последний открытый пазл — чтобы после перезапуска продолжить с него,
   а не всегда стартовать с «Сердечка» (БАГ-17). */
export function saveLastPuzzle(id) {
  localStorage.setItem(LAST_KEY, id);
}

export function getLastPuzzle() {
  return localStorage.getItem(LAST_KEY);
}

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
