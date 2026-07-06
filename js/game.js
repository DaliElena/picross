import { PUZZLES, DIFF_LABEL, DIFF_CLASS, ACCENT, LINE, SEP, TINT_HL } from './puzzles.js';
import { saveHistoryEntry, saveProgress as _saveProgress, clearProgress, getProgress } from './storage.js';

/* Ширина карточки на десктопе (должна совпадать с #app в styles.css) */
const APP_W = 460;

/* ---- STATE ---- */
export const state = {
  currentPuzzleId: 'heart',
  SOL: [],
  N: 10,
  grid: [],
  cellEls: [],
  mistakes: 0,
  coins: 12,
  seconds: 0,
  solved: false,
  hintCell: null,
  hlRow: -1,
  hlCol: -1,
  activeTool: 'fill',
  dragging: false,
  dragValue: 0,
  flashing: new Set(),
  CS: 29,
  baseCS: 29,     // размер клетки при zoom=1 (вписанный в экран)
  zoom: 1,        // текущий масштаб (1 = вписано, >1 = увеличено)
  gesture: false, // активен жест двумя пальцами (перемещение/масштаб)
  RW: 58,
  CH: 66,
  FSIZE: 12.5,
};

let _onPuzzleListUpdate = null;
export function setOnPuzzleListUpdate(fn) { _onPuzzleListUpdate = fn; }

/* ---- TIMER ---- */
setInterval(() => { if (!state.solved) state.seconds++; }, 1000);

/* ---- HELPERS ---- */
export function mk() {
  return Array.from({ length: state.N }, () => Array(state.N).fill(0));
}

export function lineClues(arr) {
  const r = []; let c = 0;
  for (const v of arr) { if (v === 1) c++; else { if (c) { r.push(c); c = 0; } } }
  if (c) r.push(c);
  return r.length ? r : [0];
}

export function rowSolved(i) {
  return state.SOL[i].every((v, j) => (state.grid[i][j] === 1) === (v === 1));
}

export function colSolved(j) {
  return state.SOL.every((r, i) => (state.grid[i][j] === 1) === (r[j] === 1));
}

export function allSolved() {
  for (let i = 0; i < state.N; i++) if (!rowSolved(i)) return false;
  return true;
}

export function fmt(s) {
  const m = Math.floor(s / 60), ss = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
}

/* ---- TOOL ---- */
export function selectTool(tool) {
  state.activeTool = tool;
  const tog = document.getElementById('toolToggle');
  tog.classList.toggle('fill',  tool === 'fill');
  tog.classList.toggle('cross', tool === 'cross');
}

/* ---- BORDERS ---- */
export function isSep(idx) { return idx % 5 === 0; }

export function borderCSS(topSep, leftSep) {
  return [
    topSep  ? `1.5px solid ${SEP}` : `0.5px solid ${LINE}`,
    leftSep ? `1.5px solid ${SEP}` : `0.5px solid ${LINE}`,
  ];
}

/* ---- RENDER CELL ---- */
export function renderCell(i, j) {
  const el = state.cellEls[i]?.[j];
  if (!el || state.flashing.has(`${i},${j}`)) return;
  const st      = state.grid[i][j];
  const inHl    = state.hlRow === i || state.hlCol === j;
  const isHint  = state.hintCell && state.hintCell.i === i && state.hintCell.j === j;
  let bg = 'transparent';
  if (st === 1)    bg = ACCENT;
  else if (inHl)   bg = TINT_HL;

  const [bt, bl] = borderCSS(isSep(i), isSep(j));
  el.style.borderTop  = bt;
  el.style.borderLeft = bl;
  el.style.background = bg;
  el.classList.toggle('hint-hl', isHint && st !== 1);

  if (st === 2) {
    const sz = Math.round(state.CS * 0.42);
    el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 18 18" fill="none">
      <line x1="3" y1="3" x2="15" y2="15" stroke="#1c1e21" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="15" y1="3" x2="3" y2="15" stroke="#1c1e21" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  } else {
    el.innerHTML = '';
  }
}

export function renderAllCells() {
  for (let i = 0; i < state.N; i++) for (let j = 0; j < state.N; j++) renderCell(i, j);
}

/* ---- CLUES ---- */
export function renderClues() {
  const ccEl = document.getElementById('colClues');
  ccEl.innerHTML = '';
  for (let j = 0; j < state.N; j++) {
    const nums = lineClues(state.SOL.map(r => r[j]));
    const dim  = colSolved(j);
    const hl   = state.hlCol === j;
    const [, bl] = borderCSS(false, isSep(j));
    const d = document.createElement('div');
    d.className = 'col-clue';
    d.style.cssText = `width:${state.CS}px;min-height:${state.CH}px;font-size:${state.FSIZE}px;border-left:${bl};background:${hl ? TINT_HL : 'transparent'};opacity:${dim ? 0.3 : 1};color:#1c1e21`;
    d.innerHTML = nums.map(n => `<span style="line-height:1.1">${n}</span>`).join('');
    d.addEventListener('click', () => toggleHlCol(j));
    ccEl.appendChild(d);
  }

  const rcEl = document.getElementById('rowClues');
  rcEl.innerHTML = '';
  for (let i = 0; i < state.N; i++) {
    const nums = lineClues(state.SOL[i]);
    const dim  = rowSolved(i);
    const hl   = state.hlRow === i;
    const [bt] = borderCSS(isSep(i), false);
    const d = document.createElement('div');
    d.className = 'row-clue';
    d.style.cssText = `width:${state.RW}px;height:${state.CS}px;font-size:${state.FSIZE}px;border-top:${bt};background:${hl ? TINT_HL : 'transparent'};opacity:${dim ? 0.3 : 1}`;
    d.innerHTML = nums.map(n => `<span>${n}</span>`).join('');
    d.addEventListener('click', () => toggleHlRow(i));
    rcEl.appendChild(d);
  }
}

export function refreshClueOpacity(i, j) {
  const ccEl = document.getElementById('colClues');
  const rcEl = document.getElementById('rowClues');
  if (ccEl.children[j]) ccEl.children[j].style.opacity = colSolved(j) ? '0.3' : '1';
  if (rcEl.children[i]) rcEl.children[i].style.opacity = rowSolved(i) ? '0.3' : '1';
}

/* ---- HIGHLIGHT ---- */
export function toggleHlRow(i) { state.hlRow = state.hlRow === i ? -1 : i; state.hlCol = -1; renderAllCells(); renderClues(); }
export function toggleHlCol(j) { state.hlCol = state.hlCol === j ? -1 : j; state.hlRow = -1; renderAllCells(); renderClues(); }

/* ---- INTERACTIONS ---- */
export function applyTool(i, j, toggle) {
  if (state.flashing.has(`${i},${j}`)) return;
  const want = state.activeTool === 'fill' ? 1 : 2;
  const cur  = state.grid[i][j];
  const next = (toggle && cur === want) ? 0 : want;
  commitCell(i, j, next);
}

export function commitCell(i, j, val) {
  if (state.grid[i][j] === val) return;
  if (val === 1 && state.SOL[i][j] === 0) {
    state.mistakes++;
    document.getElementById('mistakesVal').textContent = state.mistakes;
    flashError(i, j);
    _clearHint();
    _saveProgress(state);
    return;
  }
  _clearHint();
  state.grid[i][j] = val;
  renderCell(i, j);
  refreshClueOpacity(i, j);
  if (!state.solved && allSolved()) complete();
  else _saveProgress(state);
}

function _clearHint() {
  if (!state.hintCell) return;
  const { i, j } = state.hintCell;
  state.hintCell = null;
  renderCell(i, j);
}

export function flashError(i, j) {
  const key = `${i},${j}`;
  state.flashing.add(key);
  const el = state.cellEls[i][j];
  const sz = Math.round(state.CS * 0.46);
  el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 18 18" fill="none">
    <line x1="3" y1="3" x2="15" y2="15" stroke="#e41e3f" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="15" y1="3" x2="3" y2="15" stroke="#e41e3f" stroke-width="2.8" stroke-linecap="round"/>
  </svg>`;
  el.classList.add('flash-err');
  setTimeout(() => {
    el.classList.remove('flash-err');
    state.flashing.delete(key);
    state.grid[i][j] = 0;
    renderCell(i, j);
    refreshClueOpacity(i, j);
  }, 550);
}

export function hint() {
  if (state.solved) return;
  const prev = state.hintCell;
  const startI = prev ? prev.i : 0;
  const startJ = prev ? prev.j : 0;
  for (let i = startI; i < state.N; i++) {
    for (let j = (i === startI ? startJ : 0); j < state.N; j++) {
      if (state.SOL[i][j] === 1 && state.grid[i][j] !== 1) {
        _clearHint();
        state.hintCell = { i, j };
        renderCell(i, j);
        return;
      }
    }
  }
}

/* ---- LAYOUT ---- */
// Резерв под подсказки по фактическим данным пазла (а не по худшему случаю):
// ширина колонки подсказок строк = самая длинная строка чисел,
// высота полосы подсказок столбцов = самый высокий столбик чисел.
function clueReserves(fs) {
  const digitW = fs * 0.62;   // моноширинный шрифт ≈ 0.62em на символ
  let rw = 0, ch = 0;
  for (let i = 0; i < state.N; i++) {
    const nums = lineClues(state.SOL[i]);
    let w = 6;                // padding-right у .row-clue
    nums.forEach((n, k) => { w += String(n).length * digitW; if (k) w += 5; }); // gap:5px
    if (w > rw) rw = w;
  }
  for (let j = 0; j < state.N; j++) {
    const nums = lineClues(state.SOL.map(r => r[j]));
    const h = 4 + nums.length * fs * 1.1 + Math.max(0, nums.length - 1); // padding-bottom + строки + gap:1px
    if (h > ch) ch = h;
  }
  return { rw: Math.ceil(rw) + 4, ch: Math.ceil(ch) + 2 }; // небольшой запас
}

export function computeSize() {
  const isDesktop = window.innerWidth >= 600;
  const hH = document.getElementById('header')?.getBoundingClientRect().height  || 62;
  const bH = document.getElementById('bottomBar')?.getBoundingClientRect().height || 82;
  const pad = 24;
  const availW = isDesktop ? APP_W - pad : window.innerWidth - pad;
  const availH = (isDesktop ? window.innerHeight * 0.96 : window.innerHeight) - hH - bH - pad;

  // Минимальный комфортный размер клетки:
  //  · десктоп — держим клетки крупными, крупная доска уходит в прокрутку (мышь);
  //  · тач — доска влезает целиком (мелкая клетка на больших сетках), а крупные
  //    клетки добираются масштабом (кнопки зума / щипок двумя пальцами).
  const MIN_CS = isDesktop ? 22 : 10;

  // Размер клетки и резерв под подсказки взаимозависимы (резерв зависит от шрифта,
  // шрифт — от клетки). Сходимся за несколько итераций.
  let base = Math.max(MIN_CS, Math.floor(availW / (state.N + 2.1)));
  for (let pass = 0; pass < 4; pass++) {
    const fs = Math.max(8, Math.min(base * 0.43, 13));
    const { rw, ch } = clueReserves(fs);
    base = Math.max(MIN_CS, Math.floor(Math.min((availW - rw) / state.N, (availH - ch) / state.N)));
  }
  state.baseCS = base;

  // Применяем масштаб: итоговая клетка = вписанная × zoom (zoom ≥ 1).
  const CS = Math.max(8, Math.round(base * state.zoom));
  state.CS    = CS;
  state.FSIZE = Math.max(8, Math.min(CS * 0.43, 13));
  ({ rw: state.RW, ch: state.CH } = clueReserves(state.FSIZE));

  const root = document.documentElement;
  root.style.setProperty('--cs', state.CS + 'px');
  root.style.setProperty('--rw', state.RW + 'px');

  const pa = document.getElementById('puzzleArea');
  if (pa) {
    if (isDesktop) {
      // Высота карточки подгоняется под доску, но не выходит за пределы окна —
      // крупные сетки прокручиваются внутри вьюпорта, а не растягивают карточку.
      // +30 = вертикальные отступы #puzzleArea (14+14) и рамка сетки.
      const contentH = state.CH + state.N * state.CS + 30;
      pa.style.flex = 'none';
      pa.style.height = Math.min(contentH, availH) + 'px';
    } else {
      pa.style.flex = '1'; pa.style.height = '';
    }
  }

  const gEl = document.getElementById('grid');
  if (gEl) gEl.style.gridTemplateColumns = `repeat(${state.N}, ${state.CS}px)`;

  updateZoomUI();
}

export const ZOOM_MIN = 1, ZOOM_MAX = 4;

// Изменить масштаб, сохранив точку в центре вьюпорта (как в картах/редакторах).
export function setZoom(z) {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  if (Math.abs(next - state.zoom) < 0.001 && state.CS === Math.round(state.baseCS * next)) return;

  const pa = document.getElementById('puzzleArea');
  let fx = 0.5, fy = 0.5;
  if (pa && pa.scrollWidth > 0) {
    fx = (pa.scrollLeft + pa.clientWidth / 2)  / pa.scrollWidth;
    fy = (pa.scrollTop  + pa.clientHeight / 2) / pa.scrollHeight;
  }

  state.zoom = next;
  computeSize();
  render();

  if (pa) {
    pa.scrollLeft = fx * pa.scrollWidth  - pa.clientWidth / 2;
    pa.scrollTop  = fy * pa.scrollHeight - pa.clientHeight / 2;
  }
}

function updateZoomUI() {
  const out = document.getElementById('btnZoomOut');
  const inn = document.getElementById('btnZoomIn');
  if (out) out.disabled = state.zoom <= ZOOM_MIN + 0.001;
  if (inn) inn.disabled = state.zoom >= ZOOM_MAX - 0.001;
}

/* ---- FULL RENDER ---- */
export function render() {
  document.getElementById('mistakesVal').textContent = state.mistakes;
  renderClues();

  const gEl = document.getElementById('grid');
  gEl.innerHTML = '';
  gEl.style.gridTemplateColumns = `repeat(${state.N}, ${state.CS}px)`;
  state.cellEls = [];

  for (let i = 0; i < state.N; i++) {
    state.cellEls[i] = [];
    for (let j = 0; j < state.N; j++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = i; el.dataset.c = j;
      state.cellEls[i][j] = el;
      el.addEventListener('pointerdown', e => onDown(e, i, j));
      el.addEventListener('pointerenter', () => onEnter(i, j));
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        selectTool('cross'); applyTool(i, j, true);
      });
      gEl.appendChild(el);
      renderCell(i, j);
    }
  }

  gEl.onpointermove = e => {
    if (!state.dragging) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target.dataset.r === undefined) return;
    const ti = +target.dataset.r, tj = +target.dataset.c;
    if (!state.flashing.has(`${ti},${tj}`) && state.grid[ti][tj] !== state.dragValue)
      commitCell(ti, tj, state.dragValue);
  };
}

/* ---- POINTER ---- */
export function onDown(e, i, j) {
  e.preventDefault();
  if (state.solved || state.gesture) return;
  state.dragging = true;
  applyTool(i, j, true);
  state.dragValue = state.grid[i][j];
}

export function onEnter(i, j) {
  if (!state.dragging) return;
  if (!state.flashing.has(`${i},${j}`) && state.grid[i][j] !== state.dragValue)
    commitCell(i, j, state.dragValue);
}

/* ---- COMPLETION ---- */
function calcStars() {
  if (state.mistakes === 0 && state.seconds < 180) return 3;
  if (state.mistakes <= 2  && state.seconds < 600) return 2;
  return 1;
}

function complete() {
  state.solved = true;
  clearProgress(state.currentPuzzleId);
  const puz = PUZZLES.find(p => p.id === state.currentPuzzleId);
  const stars = calcStars();
  const coinsEarned = Math.max(0, 60 - state.mistakes * 5);

  saveHistoryEntry({
    puzzleId: state.currentPuzzleId,
    name: puz.name,
    size: state.N,
    difficulty: puz.difficulty,
    sol: puz.sol,
    time: state.seconds,
    mistakes: state.mistakes,
    stars,
    coinsEarned,
    date: Date.now(),
  });

  if (_onPuzzleListUpdate) _onPuzzleListUpdate();

  const gh = document.getElementById('ghostGrid');
  gh.innerHTML = '';
  gh.style.gridTemplateColumns = `repeat(${state.N}, 32px)`;
  for (let i = 0; i < state.N; i++) for (let j = 0; j < state.N; j++) {
    const d = document.createElement('div');
    d.style.cssText = `width:32px;height:32px;background:${state.SOL[i][j] ? '#fff' : 'transparent'}`;
    gh.appendChild(d);
  }

  const pxSize = Math.min(22, Math.floor(220 / state.N));
  const px = document.getElementById('pixelGrid');
  px.innerHTML = '';
  px.style.gridTemplateColumns = `repeat(${state.N}, ${pxSize}px)`;
  for (let i = 0; i < state.N; i++) for (let j = 0; j < state.N; j++) {
    const d = document.createElement('div');
    d.style.cssText = `width:${pxSize}px;height:${pxSize}px;box-sizing:border-box;background:${state.SOL[i][j] ? ACCENT : '#eef2f6'};border-right:0.5px solid #fff;border-bottom:0.5px solid #fff`;
    px.appendChild(d);
  }

  document.getElementById('resultTitle').textContent = puz.name;
  const sr = document.getElementById('starsRow');
  sr.innerHTML = '';
  for (let k = 0; k < 3; k++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '38'); s.setAttribute('height', '38'); s.setAttribute('viewBox', '0 0 24 24');
    s.style.cssText = `animation:starPop 0.4s ease both;animation-delay:${0.1 + k * 0.12}s`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z');
    p.setAttribute('fill', k < stars ? '#ffc531' : 'none');
    p.setAttribute('stroke', k < stars ? '#e8a400' : '#ced0d4');
    p.setAttribute('stroke-width', '1.4'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p); sr.appendChild(s);
  }
  document.getElementById('finalTime').textContent     = fmt(state.seconds);
  document.getElementById('finalMistakes').textContent = state.mistakes;
  document.getElementById('finalCoins').textContent    = '+' + coinsEarned;
  document.getElementById('completionOverlay').classList.add('active');
}

/* ---- LOAD PUZZLE ---- */
export function loadPuzzle(id) {
  const puz = PUZZLES.find(p => p.id === id);
  if (!puz) return;
  state.currentPuzzleId = id;
  state.SOL = puz.sol;
  state.N   = puz.size;

  const saved = getProgress(id);
  if (saved) {
    state.grid     = saved.grid;
    state.mistakes = saved.mistakes;
    state.coins    = saved.coins;
    state.seconds  = saved.seconds;
  } else {
    state.grid = mk();
    state.mistakes = 0; state.coins = 12; state.seconds = 0;
  }
  state.solved = false; state.hlRow = -1; state.hlCol = -1; state.hintCell = null; state.flashing.clear();
  state.zoom = 1;

  document.getElementById('headerTitle').textContent = puz.name;
  const badge = document.getElementById('headerBadge');
  badge.textContent = DIFF_LABEL[puz.difficulty];
  badge.className   = 'badge ' + (DIFF_CLASS[puz.difficulty] || '');
  document.getElementById('headerMeta').innerHTML =
    `${state.N} × ${state.N} · ошибок: <span id="mistakesVal">0</span>`;
  document.getElementById('completionOverlay').classList.remove('active');
  computeSize(); render();
}

export function resetGame() {
  document.getElementById('completionOverlay').classList.remove('active');
  clearProgress(state.currentPuzzleId);
  const puz = PUZZLES.find(p => p.id === state.currentPuzzleId);
  if (!puz) return;
  state.SOL = puz.sol; state.N = puz.size;
  state.grid = mk(); state.mistakes = 0; state.coins = 12; state.seconds = 0;
  state.solved = false; state.hlRow = -1; state.hlCol = -1; state.hintCell = null; state.flashing.clear();
  document.getElementById('headerTitle').textContent = puz.name;
  const badge = document.getElementById('headerBadge');
  badge.textContent = DIFF_LABEL[puz.difficulty];
  badge.className   = 'badge ' + (DIFF_CLASS[puz.difficulty] || '');
  document.getElementById('headerMeta').innerHTML =
    `${state.N} × ${state.N} · ошибок: <span id="mistakesVal">0</span>`;
  computeSize(); render();
}

export function nextPuzzle() {
  const idx  = PUZZLES.findIndex(p => p.id === state.currentPuzzleId);
  const next = PUZZLES[(idx + 1) % PUZZLES.length];
  loadPuzzle(next.id);
}
