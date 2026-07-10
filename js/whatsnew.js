/* Тост «Что нового»: показывается один раз после обновления версии игры,
   пока пользователь не закроет его крестиком (тогда версия запоминается
   в localStorage и тост больше не появляется до следующего релиза). */
const WHATSNEW_KEY = 'nonogram_seen_version_v1';
const CURRENT_VERSION = '1.5';

const NOTES = [
  'Тёмная тема: выбор оформления в настройках — системная, светлая или тёмная',
  'Рисование теперь через удержание, крестик по отпусканию — протяжка точнее ведёт по клеткам',
  'Нативный свайп-скролл одним пальцем по полю',
  'Вибро-отклик на iPhone при ошибке, победе и автокрестиках',
  'Исправлен офлайн-режим PWA и ошибка 404 на GitHub Pages',
];

function hasSeenCurrent() {
  try { return localStorage.getItem(WHATSNEW_KEY) === CURRENT_VERSION; } catch { return true; }
}

function markSeen() {
  try { localStorage.setItem(WHATSNEW_KEY, CURRENT_VERSION); } catch { /* localStorage недоступен */ }
}

function buildToast() {
  const toast = document.createElement('div');
  toast.className = 'whatsnew-toast';
  toast.innerHTML = `
    <div class="whatsnew-toast__header">
      <span class="whatsnew-toast__title">Что нового · ${CURRENT_VERSION}</span>
      <button class="whatsnew-toast__close" aria-label="Закрыть">✕</button>
    </div>
    <ul class="whatsnew-toast__list">
      ${NOTES.map(n => `<li>${n}</li>`).join('')}
    </ul>
  `;
  toast.querySelector('.whatsnew-toast__close').addEventListener('click', () => dismissToast(toast));
  return toast;
}

function dismissToast(toast) {
  toast.classList.add('whatsnew-toast--out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  markSeen();
}

export function checkWhatsNew() {
  if (hasSeenCurrent()) return;
  document.body.appendChild(buildToast());
}
