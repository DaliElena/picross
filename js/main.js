import { loadPuzzle, computeSize, render, selectTool, hint, resetGame, nextPuzzle, state, setOnPuzzleListUpdate, setZoom, ZOOM_MIN, ZOOM_MAX } from './game.js';
import { openMenu, closeMenu, renderMenuPuzzles, renderHistory } from './ui.js';
import { PUZZLES } from './puzzles.js';
import { loadDataset } from './dataset.js';
import { getLastPuzzle } from './storage.js';

/* ---- PUZZLE LIST UPDATE CALLBACK ---- */
setOnPuzzleListUpdate(() => {
  if (document.getElementById('menuPanel').classList.contains('open')) {
    renderMenuPuzzles();
  }
});

/* ---- MENU ---- */
document.getElementById('btnMenu').addEventListener('click', () => {
  loadDataset().then(count => {
    if (count > 0) {
      renderMenuPuzzles();
      renderHistory();
    }
  });
  openMenu();
});
document.getElementById('btnMenuClose').addEventListener('click', closeMenu);
document.getElementById('menuBackdrop').addEventListener('click', closeMenu);

/* ---- TABS ---- */
document.querySelectorAll('.menu-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'history') renderHistory();
  });
});

/* ---- TOOL TOGGLE ---- */
document.getElementById('toolToggle').addEventListener('click', () => {
  selectTool(state.activeTool === 'fill' ? 'cross' : 'fill');
});

/* ---- BUTTONS ---- */
document.getElementById('btnHint').addEventListener('click', () => { if (!state.solved) hint(); });
document.getElementById('btnSettings').addEventListener('click', () => {});
document.getElementById('btnReplay').addEventListener('click', resetGame);
document.getElementById('btnNext').addEventListener('click', nextPuzzle);

/* ---- POINTER UP / CANCEL ---- */
window.addEventListener('pointerup',     () => { state.dragging = false; });
window.addEventListener('pointercancel', () => { state.dragging = false; });

/* ---- ZOOM: buttons ---- */
document.getElementById('btnZoomIn').addEventListener('click',  () => setZoom(state.zoom * 1.3));
document.getElementById('btnZoomOut').addEventListener('click', () => setZoom(state.zoom / 1.3));
document.getElementById('btnZoomFit').addEventListener('click', () => setZoom(1));
document.getElementById('btnZoomToggle').addEventListener('click', () => {
  const ctl = document.getElementById('zoomCtl');
  const collapsed = ctl.classList.toggle('collapsed');
  document.getElementById('btnZoomToggle').setAttribute('aria-expanded', String(!collapsed));
});

/* ---- ZOOM: масштаб вокруг точки (для щипка и ctrl+колеса) ---- */
const puzzleArea = document.getElementById('puzzleArea');
function zoomAt(nz, cx, cy) {
  nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nz));
  const targetCS = Math.max(8, Math.round(state.baseCS * nz));
  if (targetCS === state.CS) { state.zoom = nz; return; }   // размер клетки не изменится — не перерисовываем
  const r = puzzleArea.getBoundingClientRect();
  const bx = puzzleArea.scrollLeft + (cx - r.left);          // точка доски под фокусом
  const by = puzzleArea.scrollTop  + (cy - r.top);
  const ow = puzzleArea.scrollWidth, oh = puzzleArea.scrollHeight;
  state.zoom = nz;
  computeSize(); render();
  const rx = puzzleArea.scrollWidth / ow, ry = puzzleArea.scrollHeight / oh;
  puzzleArea.scrollLeft = bx * rx - (cx - r.left);           // держим ту же точку под фокусом
  puzzleArea.scrollTop  = by * ry - (cy - r.top);
}

/* ctrl/⌘ + колесо — зум на десктопе */
puzzleArea.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoomAt(state.zoom * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
}, { passive: false });

/* ---- ЖЕСТЫ: два пальца — перемещение + щипок ---- */
const pts = new Map();
let lastMid = null, lastDist = 0;
function midDist() {
  const a = [...pts.values()];
  const mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
  return { mx, my, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
}
puzzleArea.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) {
    state.gesture = true; state.dragging = false;       // второй палец — переходим в режим навигации
    const m = midDist(); lastMid = { x: m.mx, y: m.my }; lastDist = m.d;
  }
});
puzzleArea.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!state.gesture || pts.size < 2) return;
  e.preventDefault();
  const m = midDist();
  puzzleArea.scrollLeft -= (m.mx - lastMid.x);            // перемещение по midpoint
  puzzleArea.scrollTop  -= (m.my - lastMid.y);
  if (lastDist > 0 && Math.abs(m.d / lastDist - 1) > 0.01)
    zoomAt(state.zoom * (m.d / lastDist), m.mx, m.my);    // щипок
  lastMid = { x: m.mx, y: m.my }; lastDist = m.d;
}, { passive: false });
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size < 2) {
    lastMid = null; lastDist = 0;
    setTimeout(() => { if (pts.size < 2) state.gesture = false; }, 0);
    scheduleSnap();
  }
}
puzzleArea.addEventListener('pointerup', endPointer);
puzzleArea.addEventListener('pointercancel', endPointer);

/* ---- ПРИВЯЗКА СКРОЛЛА: после остановки прокрутки выравниваем позицию по
   границе клетки, чтобы под примороженными подсказками не висели обрезанные
   пол-строки/пол-столбцы ---- */
let snapTimer = 0, scrollbarHeld = false;
puzzleArea.addEventListener('mousedown', () => { scrollbarHeld = true; });
window.addEventListener('mouseup', () => { scrollbarHeld = false; scheduleSnap(); });

// Ближайшая «чистая» позиция оси: 0, целиком видимый отступ (base) или
// base + k·CS (граница строки/столбца ровно под полосой подсказок).
function snapAxis(cur, max, base, cs) {
  if (max <= 1 || cur <= 1 || max - cur <= 1) return cur;   // на краях не дёргаем
  const t = cur < base
    ? (cur < base / 2 ? 0 : base)
    : base + Math.round((cur - base) / cs) * cs;
  return Math.min(max, Math.max(0, t));
}

function snapScroll() {
  if (state.gesture || scrollbarHeld || state.dragging) return; // перепланируется на mouseup/endPointer
  const st = puzzleArea.scrollTop, sl = puzzleArea.scrollLeft;
  const maxT = puzzleArea.scrollHeight - puzzleArea.clientHeight;
  const maxL = puzzleArea.scrollWidth  - puzzleArea.clientWidth;
  const pa = puzzleArea.getBoundingClientRect();
  const g  = document.getElementById('grid').getBoundingClientRect();
  // Отступ над/слева от сетки в координатах прокрутки (= padding #puzzleWrap).
  const baseY = g.top  - pa.top  + st - document.getElementById('colCluesWrap').getBoundingClientRect().height;
  const baseX = g.left - pa.left + sl - document.getElementById('rowClues').getBoundingClientRect().width;
  const nt = snapAxis(st, maxT, baseY, state.CS);
  const nl = snapAxis(sl, maxL, baseX, state.CS);
  if (Math.abs(nt - st) < 1 && Math.abs(nl - sl) < 1) return;
  puzzleArea.scrollTo({ top: nt, left: nl, behavior: 'smooth' });
}
function scheduleSnap() { clearTimeout(snapTimer); snapTimer = setTimeout(snapScroll, 150); }
puzzleArea.addEventListener('scroll', scheduleSnap, { passive: true });

/* ---- RESIZE: пересчитываем вписанный размер (baseCS), не трогая зум —
   на мобильных resize происходит сам (адресная строка, клавиатура), и сброс
   масштаба терял позицию игрока. Точку в центре вьюпорта держим, как в setZoom.
   Зум сбрасывается только при смене пазла (loadPuzzle). ---- */
window.addEventListener('resize', () => {
  let fx = 0.5, fy = 0.5;
  if (puzzleArea.scrollWidth > 0) {
    fx = (puzzleArea.scrollLeft + puzzleArea.clientWidth / 2)  / puzzleArea.scrollWidth;
    fy = (puzzleArea.scrollTop  + puzzleArea.clientHeight / 2) / puzzleArea.scrollHeight;
  }
  computeSize(); render();
  puzzleArea.scrollLeft = fx * puzzleArea.scrollWidth  - puzzleArea.clientWidth / 2;
  puzzleArea.scrollTop  = fy * puzzleArea.scrollHeight - puzzleArea.clientHeight / 2;
});

/* ---- INIT ---- */
/* Восстанавливаем последний открытый пазл (БАГ-17). Если он из датасета,
   встроенных 7 пазлов не хватит — сначала подгружаем каталог. Если пазл
   так и не нашёлся (датасет недоступен), стартуем с «Сердечка». */
(async () => {
  const last = getLastPuzzle();
  if (last && !PUZZLES.some(p => p.id === last)) await loadDataset();
  loadPuzzle(last && PUZZLES.some(p => p.id === last) ? last : 'heart');
})();

/* ---- SERVICE WORKER ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
