import { PUZZLES, DIFF_LABEL, ACCENT } from './puzzles.js';
import { loadHistory, loadAllProgress, getProgress } from './storage.js';
import { state, loadPuzzle, fmt } from './game.js';

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
  const sizes = ['all', ...new Set(PUZZLES.map(p => p.size))].sort((a, b) => a === 'all' ? -1 : a - b);
  sizes.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'filter-chip' + (activeFilter === s ? ' active' : '');
    chip.textContent = s === 'all' ? 'Все' : `${s}×${s}`;
    chip.addEventListener('click', () => {
      activeFilter = s;
      buildFilters();
      renderMenuPuzzles();
    });
    bar.appendChild(chip);
  });
}

function getBestResult(id) {
  const h = loadHistory().filter(e => e.puzzleId === id);
  if (!h.length) return null;
  return h.reduce((best, e) => (!best || e.stars > best.stars || (e.stars === best.stars && e.time < best.time)) ? e : best, null);
}

/* ---- PUZZLES TAB ---- */
export function renderMenuPuzzles() {
  buildFilters();
  const list = document.getElementById('puzzlesList');
  list.innerHTML = '';

  const filtered = activeFilter === 'all'
    ? PUZZLES
    : PUZZLES.filter(p => p.size === activeFilter);

  const groups = {};
  filtered.forEach(p => {
    const key = `${p.size}×${p.size}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  Object.entries(groups).forEach(([label, puzzles]) => {
    if (activeFilter === 'all') {
      const title = document.createElement('div');
      title.className = 'puzzle-section-title';
      title.textContent = label;
      list.appendChild(title);
    }
    puzzles.forEach(p => {
      const best = getBestResult(p.id);
      const card = document.createElement('button');
      card.className = 'puzzle-card' + (p.id === state.currentPuzzleId ? ' active-puzzle' : '');

      const px = Math.floor(48 / p.size);
      const preview = document.createElement('div');
      preview.className = 'puzzle-preview';
      buildPreview(p.sol, p.size, preview, px);

      const info = document.createElement('div');
      info.className = 'puzzle-info';
      info.innerHTML = `
        <div class="puzzle-card-name">${p.name}</div>
        <div class="puzzle-card-meta">${p.size}×${p.size} · ${DIFF_LABEL[p.difficulty]}</div>
      `;

      const status = document.createElement('div');
      status.className = 'puzzle-card-status';
      const inProgress = !!getProgress(p.id);
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
        loadPuzzle(p.id);
        closeMenu();
      });
      list.appendChild(card);
    });
  });
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
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'puzzle-section-title';
    sectionTitle.textContent = 'Завершённые';
    list.appendChild(sectionTitle);
  }

  h.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';

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
    `;

    const previewEl = item.querySelector('.history-preview');
    buildPreview(entry.sol, entry.size, previewEl, px);
    list.appendChild(item);
  });
}
