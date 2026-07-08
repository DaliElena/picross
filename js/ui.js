import { PUZZLES, DIFF_LABEL, ACCENT } from './puzzles.js';
import { loadHistory, loadBests, loadAllProgress, deleteHistoryEntry, clearHistory, clearProgress } from './storage.js';
import { state, loadPuzzle, fmt } from './game.js';

/* ---- CONFIRM MODAL ---- */
export function showConfirm({ title, text, okLabel = 'Да', danger = false }) {
  const backdrop = document.getElementById('confirmBackdrop');
  const okBtn    = document.getElementById('confirmOk');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent  = text;
  okBtn.textContent = okLabel;
  okBtn.classList.toggle('danger', danger);
  backdrop.classList.add('open');
  return new Promise(resolve => {
    const done = ok => { backdrop.classList.remove('open'); resolve(ok); };
    okBtn.onclick = () => done(true);
    document.getElementById('confirmCancel').onclick = () => done(false);
    backdrop.onclick = e => { if (e.target === backdrop) done(false); };
  });
}

/* Подтверждение и перезапуск решённого пазла с чистого листа */
async function confirmReplay(id, name) {
  const ok = await showConfirm({
    title: 'Начать заново?',
    text: `«${name}» уже решена. Начать её заново?`,
    okLabel: 'Заново',
  });
  if (!ok) return;
  clearProgress(id);
  loadPuzzle(id);
  closeMenu();
}

/* ---- MINI PREVIEW ---- */
export function buildPreview(sol, size, el, px) {
  el.style.gridTemplateColumns = `repeat(${size}, ${px}px)`;
  el.innerHTML = '';
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const d = document.createElement('div');
    d.style.cssText = `width:${px}px;height:${px}px;background:${sol[i][j] ? ACCENT : '#eef2f6'}`;
    el.appendChild(d);
  }
}

/* ---- CANVAS PREVIEW (для больших списков — 1 узел вместо size² div-ов) ---- */
const PREVIEW_BOX = 48;

function drawCanvasPreview(canvas) {
  const pv = canvas._pv;
  if (!pv || canvas._drawn) return;
  canvas._drawn = true;
  const { sol, size } = pv;
  const dpr = canvas._dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(0, 0, PREVIEW_BOX, PREVIEW_BOX);
  ctx.fillStyle = ACCENT;
  const cell = PREVIEW_BOX / size;
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    if (sol[i][j]) ctx.fillRect(Math.floor(j * cell), Math.floor(i * cell), Math.ceil(cell), Math.ceil(cell));
  }
}

let previewObserver = null;
function makeCanvasPreview(sol, size) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.className = 'puzzle-preview';
  canvas.style.display = 'block';
  canvas.style.width = PREVIEW_BOX + 'px';
  canvas.style.height = PREVIEW_BOX + 'px';
  // Задаём маленький битмап сразу: у canvas по умолчанию 300×150 —
  // на тысячах узлов это сотни МБ памяти, даже без отрисовки.
  canvas.width  = PREVIEW_BOX * dpr;
  canvas.height = PREVIEW_BOX * dpr;
  canvas._pv = { sol, size };
  canvas._dpr = dpr;
  previewObserver.observe(canvas);
  return canvas;
}

/* ---- MENU ---- */
export function openMenu() {
  const backdrop = document.getElementById('menuBackdrop');
  const panel    = document.getElementById('menuPanel');
  backdrop.classList.add('open');
  requestAnimationFrame(() => {
    backdrop.classList.add('visible');
    panel.classList.add('open');
  });
  renderMenuPuzzles();
  renderHistory();
}

export function closeMenu() {
  const backdrop = document.getElementById('menuBackdrop');
  const panel    = document.getElementById('menuPanel');
  backdrop.classList.remove('visible');
  panel.classList.remove('open');
  setTimeout(() => backdrop.classList.remove('open'), 280);
}

/* ---- FILTERS ---- */
let activeFilter = 'all';

function buildFilters() {
  const bar = document.getElementById('filterBar');
  bar.innerHTML = '';

  // Считаем количество нонограмм для каждого размера за один проход
  const counts = {};
  for (const p of PUZZLES) counts[p.size] = (counts[p.size] || 0) + 1;
  // Все размеры, отсортированные по возрастанию — показываем каждый вариант из датасета
  const sizes = Object.keys(counts).map(Number).sort((a, b) => a - b);

  const addChip = (value, label, count) => {
    const chip = document.createElement('button');
    chip.className = 'filter-chip' + (activeFilter === value ? ' active' : '');
    chip.innerHTML =
      `<span class="filter-chip-label">${label}</span>` +
      `<span class="filter-chip-count">${count}</span>`;
    chip.addEventListener('click', () => {
      activeFilter = value;
      buildFilters();
      renderMenuPuzzles();
    });
    bar.appendChild(chip);
  };

  addChip('all', 'Все', PUZZLES.length);
  sizes.forEach(s => addChip(s, `${s}×${s}`, counts[s]));
}

/* ---- PUZZLES TAB ---- */
function makeSectionTitle(label) {
  const title = document.createElement('div');
  title.className = 'puzzle-section-title';
  title.textContent = label;
  return title;
}

function makePuzzleCard(p, bestMap, allProgress) {
  const best = bestMap[p.id] || null;
  const card = document.createElement('button');
  card.className = 'puzzle-card' + (p.id === state.currentPuzzleId ? ' active-puzzle' : '');

  const preview = makeCanvasPreview(p.sol, p.size);

  const info = document.createElement('div');
  info.className = 'puzzle-info';
  info.innerHTML = `
    <div class="puzzle-card-name">${p.name}</div>
    <div class="puzzle-card-meta">${p.size}×${p.size} · ${DIFF_LABEL[p.difficulty]}</div>
  `;

  const status = document.createElement('div');
  status.className = 'puzzle-card-status';
  const inProgress = !!allProgress[p.id];
  if (best) {
    const starsHtml = [0, 1, 2].map(k =>
      `<svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z"
          fill="${k < best.stars ? '#ffc531' : 'none'}" stroke="${k < best.stars ? '#e8a400' : '#ced0d4'}" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`
    ).join('');
    status.innerHTML = `<div style="display:flex;gap:1px">${starsHtml}</div>`;
  } else if (inProgress) {
    const dot = document.createElement('div');
    dot.className = 'status-dot inprogress';
    dot.title = 'В процессе';
    status.appendChild(dot);
  } else {
    const dot = document.createElement('div');
    dot.className = 'status-dot';
    status.appendChild(dot);
  }

  card.append(preview, info, status);
  card.addEventListener('click', () => {
    // Решённый пазл без начатого перепрохождения — спрашиваем про рестарт
    if (best && !inProgress) { confirmReplay(p.id, p.name); return; }
    loadPuzzle(p.id);
    closeMenu();
  });
  return card;
}

/* Порционный рендер: карточки добавляются по CHUNK штук по мере прокрутки,
   иначе на полном каталоге (~1900 узлов) меню открывается с фризом в 1–2 с. */
const CHUNK = 60;
let chunkObserver = null;

export function renderMenuPuzzles() {
  buildFilters();
  const list = document.getElementById('puzzlesList');
  list.innerHTML = '';

  // Читаем localStorage один раз на весь список, а не по разу на карточку
  const bestMap = loadBests();
  const allProgress = loadAllProgress();

  // Пересоздаём наблюдатели: старые узлы уже удалены из DOM
  if (previewObserver) previewObserver.disconnect();
  previewObserver = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        drawCanvasPreview(entry.target);
        obs.unobserve(entry.target);
      }
    }
  }, { rootMargin: '300px' });
  if (chunkObserver) chunkObserver.disconnect();

  const filtered = activeFilter === 'all'
    ? PUZZLES
    : PUZZLES.filter(p => p.size === activeFilter);

  const groups = {};
  filtered.forEach(p => {
    const key = `${p.size}×${p.size}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  // Плоская очередь узлов: заголовки секций вперемешку с карточками
  const queue = [];
  Object.entries(groups).forEach(([label, puzzles]) => {
    if (activeFilter === 'all') queue.push({ title: label });
    puzzles.forEach(p => queue.push({ p }));
  });

  let pos = 0;
  const renderChunk = () => {
    const frag = document.createDocumentFragment();
    for (const end = Math.min(pos + CHUNK, queue.length); pos < end; pos++) {
      const item = queue[pos];
      frag.appendChild(item.title ? makeSectionTitle(item.title) : makePuzzleCard(item.p, bestMap, allProgress));
    }
    list.appendChild(frag);
  };

  renderChunk();
  if (pos >= queue.length) return;

  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  list.appendChild(sentinel);
  chunkObserver = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    renderChunk();
    if (pos >= queue.length) {
      chunkObserver.disconnect();
      sentinel.remove();
      return;
    }
    list.appendChild(sentinel);
    // Пере-подписка форсирует новую доставку состояния: после сдвига sentinel
    // вниз он может остаться в зоне видимости без изменения пересечения.
    chunkObserver.unobserve(sentinel);
    chunkObserver.observe(sentinel);
  }, { root: list, rootMargin: '600px' });
  chunkObserver.observe(sentinel);
}

/* ---- HISTORY TAB ---- */
export function renderHistory() {
  const h = loadHistory();
  const allProgress = loadAllProgress();
  const strip = document.getElementById('historyStatsStrip');
  const list  = document.getElementById('historyList');

  const total   = h.length;
  const perfect = h.filter(e => e.stars === 3).length;
  const avgTime = total ? Math.round(h.reduce((s, e) => s + e.time, 0) / total) : 0;

  strip.innerHTML = `
    <div class="hs-stat"><div class="hs-val">${total}</div><div class="hs-lbl">Игр</div></div>
    <div class="hs-stat"><div class="hs-val">${perfect}</div><div class="hs-lbl">⭐⭐⭐</div></div>
    <div class="hs-stat"><div class="hs-val">${total ? fmt(avgTime) : '—'}</div><div class="hs-lbl">Среднее</div></div>
  `;

  list.innerHTML = '';

  const progressEntries = Object.entries(allProgress)
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => PUZZLES.find(puz => puz.id === p.id))
    .sort((a, b) => b.savedAt - a.savedAt);

  if (progressEntries.length) {
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'puzzle-section-title';
    sectionTitle.textContent = 'В процессе';
    list.appendChild(sectionTitle);

    progressEntries.forEach(prog => {
      const puz = PUZZLES.find(p => p.id === prog.id);
      const item = document.createElement('button');
      item.className = 'history-item';
      item.style.cssText = 'width:100%;text-align:left;border:none;cursor:pointer;background:rgba(255,210,74,0.10);border-radius:14px;margin-bottom:2px;border-bottom:none';

      const px = Math.floor(44 / puz.size);
      const savedDate = new Date(prog.savedAt);
      const dateStr = savedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      const timeStr = savedDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      const filledCount = prog.grid.flat().filter(v => v === 1).length;
      const totalCount  = puz.sol.flat().filter(v => v === 1).length;
      const pct = totalCount ? Math.round(filledCount / totalCount * 100) : 0;

      item.innerHTML = `
        <div class="history-preview" style="grid-template-columns:repeat(${puz.size},${px}px)"></div>
        <div class="history-info">
          <div class="history-name">${puz.name}</div>
          <div class="history-meta">${puz.size}×${puz.size} · ${dateStr}, ${timeStr}</div>
          <div style="margin-top:4px;font-size:11px;font-weight:600;color:#b45309">${pct}% заполнено</div>
        </div>
        <div class="history-right">
          <div class="history-time">${fmt(prog.seconds)}</div>
          <div class="history-mistakes">${prog.mistakes} ош.</div>
        </div>
      `;

      const previewEl = item.querySelector('.history-preview');
      previewEl.style.gridTemplateColumns = `repeat(${puz.size}, ${px}px)`;
      previewEl.innerHTML = '';
      for (let i = 0; i < puz.size; i++) for (let j = 0; j < puz.size; j++) {
        const d = document.createElement('div');
        const val = prog.grid[i][j];
        d.style.cssText = `width:${px}px;height:${px}px;background:${val === 1 ? ACCENT : '#eef2f6'}`;
        previewEl.appendChild(d);
      }

      item.addEventListener('click', () => {
        loadPuzzle(prog.id);
        closeMenu();
      });
      list.appendChild(item);
    });
  }

  if (!h.length && !progressEntries.length) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#aeb8c2" stroke-width="1.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div class="history-empty-text">История пуста.<br>Решите первую нонограмму!</div>
      </div>`;
    return;
  }

  if (h.length) {
    const row = document.createElement('div');
    row.className = 'history-section-row';
    row.innerHTML = '<div class="puzzle-section-title">Завершённые</div>';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'history-clear-btn';
    clearBtn.textContent = 'Очистить';
    clearBtn.addEventListener('click', async () => {
      const ok = await showConfirm({
        title: 'Очистить историю?',
        text: 'Вся история и лучшие результаты будут удалены. Звёзды в каталоге сбросятся.',
        okLabel: 'Очистить',
        danger: true,
      });
      if (!ok) return;
      clearHistory();
      renderHistory();
      renderMenuPuzzles();
    });
    row.appendChild(clearBtn);
    list.appendChild(row);
  }

  h.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item completed';

    const px = Math.floor(44 / entry.size);
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const starsHtml = [0, 1, 2].map(k =>
      `<svg width="11" height="11" viewBox="0 0 24 24">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8z"
          fill="${k < entry.stars ? '#ffc531' : 'none'}" stroke="${k < entry.stars ? '#e8a400' : '#ced0d4'}" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`
    ).join('');

    item.innerHTML = `
      <div class="history-preview" style="grid-template-columns:repeat(${entry.size},${px}px)"></div>
      <div class="history-info">
        <div class="history-name">${entry.name}</div>
        <div class="history-meta">${entry.size}×${entry.size} · ${dateStr}, ${timeStr}</div>
        <div class="history-stars">${starsHtml}</div>
      </div>
      <div class="history-right">
        <div class="history-time">${fmt(entry.time)}</div>
        <div class="history-mistakes">${entry.mistakes} ош.</div>
      </div>
      <button class="history-del" aria-label="Удалить запись" title="Удалить">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    `;

    const previewEl = item.querySelector('.history-preview');
    buildPreview(entry.sol, entry.size, previewEl, px);

    item.addEventListener('click', () => {
      // Пазла может не быть в каталоге, пока датасет грузится
      if (!PUZZLES.find(p => p.id === entry.puzzleId)) return;
      confirmReplay(entry.puzzleId, entry.name);
    });

    item.querySelector('.history-del').addEventListener('click', async e => {
      e.stopPropagation();
      const ok = await showConfirm({
        title: 'Удалить запись?',
        text: `Результат «${entry.name}» будет удалён из истории, лучший результат пересчитается по оставшимся записям.`,
        okLabel: 'Удалить',
        danger: true,
      });
      if (!ok) return;
      deleteHistoryEntry(entry);
      renderHistory();
      renderMenuPuzzles();
    });

    list.appendChild(item);
  });
}
