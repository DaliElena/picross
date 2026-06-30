import { loadPuzzle, computeSize, render, selectTool, hint, resetGame, nextPuzzle, state, setOnPuzzleListUpdate } from './game.js';
import { openMenu, closeMenu, renderMenuPuzzles, renderHistory } from './ui.js';
import { PUZZLES } from './puzzles.js';
import { loadDataset } from './dataset.js';

/* ---- PUZZLE LIST UPDATE CALLBACK ---- */
setOnPuzzleListUpdate(() => {
  if (document.getElementById('menuPanel').classList.contains('open')) {
    renderMenuPuzzles();
  }
});

/* ---- MENU ---- */
document.getElementById('btnMenu').addEventListener('click', openMenu);
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
document.getElementById('btnShare').addEventListener('click', () => {
  const puz = PUZZLES.find(p => p.id === state.currentPuzzleId);
  const txt = `Нонограмма «${puz.name}» ${state.N}×${state.N} — ${state.seconds ? Math.floor(state.seconds / 60) + 'м ' + (state.seconds % 60) + 'с' : '—'}, ошибки: ${state.mistakes}`;
  if (navigator.share) navigator.share({ title: 'Нонограмма', text: txt });
  else if (navigator.clipboard) navigator.clipboard.writeText(txt);
});

/* ---- POINTER UP / CANCEL ---- */
window.addEventListener('pointerup',     () => { state.dragging = false; });
window.addEventListener('pointercancel', () => { state.dragging = false; });

/* ---- RESIZE ---- */
window.addEventListener('resize', () => { computeSize(); render(); });

/* ---- INIT ---- */
loadPuzzle('heart');
loadDataset().then(count => {
  if (count > 0 && document.getElementById('menuPanel').classList.contains('open')) {
    renderMenuPuzzles();
  }
});

/* ---- SERVICE WORKER ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
