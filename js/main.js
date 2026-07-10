import { loadPuzzle, computeSize, render, selectTool, hint, resetGame, nextPuzzle, state, setOnPuzzleListUpdate, setZoom, ZOOM_MIN, ZOOM_MAX, applyAutoCrossAll, updateHeaderMeta, purgeWrongFills, cancelTouchPaint } from './game.js';
import { openMenu, closeMenu, renderMenuPuzzles, renderHistory } from './ui.js';
import { PUZZLES } from './puzzles.js';
import { loadDataset } from './dataset.js';
import { getLastPuzzle, loadSettings, saveSettings } from './storage.js';
import { sfxAutoCross, vibrate, canVibrate } from './sound.js';
import { checkWhatsNew } from './whatsnew.js';

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

/* ---- THEME ----
   Настройка theme: 'auto' | 'light' | 'dark'. Инлайновый скрипт в <head> уже
   проставил data-theme до первой отрисовки; здесь держим его в актуальном
   состоянии при переключении и — в режиме «Системная» — при смене темы ОС. */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const darkMedia = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return darkMedia && darkMedia.matches ? 'dark' : 'light';
}
function applyTheme() {
  const resolved = resolveTheme(loadSettings().theme);
  document.documentElement.setAttribute('data-theme', resolved);
  if (themeMeta) themeMeta.setAttribute('content', resolved === 'dark' ? '#14181f' : '#0064e0');
  // Открытый каталог перерисовываем: canvas-превью берут цвет темы при отрисовке.
  if (document.getElementById('menuPanel').classList.contains('open')) renderMenuPuzzles();
}
if (darkMedia) {
  const onSystemChange = () => {
    const pref = loadSettings().theme;
    if (pref !== 'light' && pref !== 'dark') applyTheme();
  };
  if (darkMedia.addEventListener) darkMedia.addEventListener('change', onSystemChange);
  else if (darkMedia.addListener) darkMedia.addListener(onSystemChange);
}
applyTheme();

/* ---- SETTINGS ---- */
const settingsBackdrop = document.getElementById('settingsBackdrop');
const swPreviews = document.getElementById('swPreviews');
const swErrorCheck = document.getElementById('swErrorCheck');
const swAutoCross = document.getElementById('swAutoCross');
const swSound = document.getElementById('swSound');
const swVibration = document.getElementById('swVibration');
const themeSeg = document.getElementById('themeSeg');

// Вибрация не поддерживается (iOS Safari, десктопы) — прячем строку целиком.
if (!canVibrate()) document.getElementById('rowVibration').style.display = 'none';

function syncSettingsUI() {
  const s = loadSettings();
  swPreviews.classList.toggle('on', s.showPreviews);
  swPreviews.setAttribute('aria-checked', String(s.showPreviews));
  swErrorCheck.classList.toggle('on', s.errorCheck);
  swErrorCheck.setAttribute('aria-checked', String(s.errorCheck));
  swAutoCross.classList.toggle('on', s.autoCross);
  swAutoCross.setAttribute('aria-checked', String(s.autoCross));
  swSound.classList.toggle('on', s.sound);
  swSound.setAttribute('aria-checked', String(s.sound));
  swVibration.classList.toggle('on', s.vibration);
  swVibration.setAttribute('aria-checked', String(s.vibration));
  const theme = s.theme || 'auto';
  themeSeg.querySelectorAll('.seg-btn').forEach(btn => {
    const on = btn.dataset.themeVal === theme;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

themeSeg.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    saveSettings({ theme: btn.dataset.themeVal });
    applyTheme();
    syncSettingsUI();
  });
});

document.getElementById('btnSettings').addEventListener('click', () => {
  syncSettingsUI();
  settingsBackdrop.classList.add('open');
});
swPreviews.addEventListener('click', () => {
  saveSettings({ showPreviews: !loadSettings().showPreviews });
  syncSettingsUI();
  // Каталог перерисовывается при каждом открытии меню, но если меню уже
  // открыто под модалкой — обновляем список сразу
  if (document.getElementById('menuPanel').classList.contains('open')) renderMenuPuzzles();
});
swErrorCheck.addEventListener('click', () => {
  const on = !loadSettings().errorCheck;
  saveSettings({ errorCheck: on });
  syncSettingsUI();
  // Включили проверку — стираем заливки, оказавшиеся ошибочными в свободном
  // режиме, иначе защита правильных клеток заперла бы их навсегда.
  if (on) purgeWrongFills();
  updateHeaderMeta();
});
swAutoCross.addEventListener('click', () => {
  const on = !loadSettings().autoCross;
  saveSettings({ autoCross: on });
  syncSettingsUI();
  // При включении посреди партии сразу закрываем уже сошедшиеся линии.
  if (on) applyAutoCrossAll();
});
swSound.addEventListener('click', () => {
  const on = !loadSettings().sound;
  saveSettings({ sound: on });
  syncSettingsUI();
  if (on) sfxAutoCross(); // короткая проба звука при включении
});
swVibration.addEventListener('click', () => {
  const on = !loadSettings().vibration;
  saveSettings({ vibration: on });
  syncSettingsUI();
  if (on) vibrate(60); // проба вибрации при включении
});
document.getElementById('settingsClose').addEventListener('click', () => settingsBackdrop.classList.remove('open'));
settingsBackdrop.addEventListener('click', e => { if (e.target === settingsBackdrop) settingsBackdrop.classList.remove('open'); });
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

/* ---- ЖЕСТЫ ----
   Один палец: прокрутка нативная (touch-action: pan-x pan-y у сетки), а
   рисование — тап/удержание (game.js). Пока рисование активно, touchmove
   гасим — иначе браузер начнёт прокрутку под рисующим пальцем.
   Два пальца: панорама и щипок свои (нативные не подходят: щипок должен
   масштабировать сетку, а не страницу). Жест классифицируем по первым
   миллиметрам («панорама» или «щипок») и фиксируем доминирующую ось
   панорамы — без этого горизонтальный свайп дрейфовал по вертикали, а
   гуляющее расстояние между пальцами дёргало зум и уводило экран. */
let g2 = null; // текущий жест двумя пальцами
function midDist(t) {
  const mx = (t[0].clientX + t[1].clientX) / 2, my = (t[0].clientY + t[1].clientY) / 2;
  return { mx, my, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) };
}
puzzleArea.addEventListener('touchstart', e => {
  if (e.touches.length !== 2) return;
  cancelTouchPaint();                 // отложенный ход первого пальца отменяем
  state.dragging = false;
  state.gesture = true;
  const m = midDist(e.touches);
  g2 = { mode: null, axis: 'free', sx: m.mx, sy: m.my, sd: m.d, lx: m.mx, ly: m.my, ld: m.d };
}, { passive: true });

puzzleArea.addEventListener('touchmove', e => {
  // Рисование одним пальцем — прокрутку браузеру не отдаём.
  if (state.dragging || state.touchArmed) e.preventDefault();
  if (!g2 || e.touches.length < 2) return;
  e.preventDefault();
  const m = midDist(e.touches);
  if (!g2.mode) {
    const dm = Math.hypot(m.mx - g2.sx, m.my - g2.sy); // сдвиг средней точки
    const dd = Math.abs(m.d - g2.sd);                  // изменение раствора пальцев
    if (dd > 16 && dd > dm * 1.4) g2.mode = 'pinch';
    else if (dm > 20) { // порог крупный: ось надёжно видна только на заметном сдвиге
      g2.mode = 'pan';
      const ax = Math.abs(m.mx - g2.sx), ay = Math.abs(m.my - g2.sy);
      g2.axis = ax > ay * 2 ? 'x' : ay > ax * 2 ? 'y' : 'free'; // явная диагональ — свободно
    }
  }
  if (g2.mode === 'pan') {
    if (g2.axis !== 'y') puzzleArea.scrollLeft -= m.mx - g2.lx;
    if (g2.axis !== 'x') puzzleArea.scrollTop  -= m.my - g2.ly;
  } else if (g2.mode === 'pinch') {
    puzzleArea.scrollLeft -= m.mx - g2.lx;
    puzzleArea.scrollTop  -= m.my - g2.ly;
    if (g2.ld > 0) zoomAt(state.zoom * (m.d / g2.ld), m.mx, m.my);
  }
  g2.lx = m.mx; g2.ly = m.my; g2.ld = m.d;
}, { passive: false });

function endTouchGesture(e) {
  if (!g2 || e.touches.length >= 2) return;
  g2 = null;
  // gesture снимаем тактом позже: pointerup оставшегося пальца не должен успеть сделать тап
  setTimeout(() => { if (!g2) state.gesture = false; }, 0);
  scheduleSnap();
}
puzzleArea.addEventListener('touchend', endTouchGesture);
puzzleArea.addEventListener('touchcancel', endTouchGesture);

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

/* ---- ЧТО НОВОГО ---- */
checkWhatsNew();
