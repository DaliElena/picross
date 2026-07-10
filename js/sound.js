import { loadSettings } from './storage.js';

/* Звуковые эффекты синтезируются Web Audio API — без аудиофайлов.
   AudioContext создаётся лениво при первом звуке: браузеры разрешают
   звук только после жеста пользователя, а все наши триггеры (ход по
   клетке, победа) и так случаются внутри жеста. */
let ctx = null;

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // После сворачивания вкладки/паузы контекст может быть приостановлен.
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Один тон: осциллятор с экспоненциальным затуханием громкости.
function tone(ac, { freq, at = 0, dur = 0.12, type = 'sine', gain = 0.15 }) {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g   = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playTones(tones) {
  if (!loadSettings().sound) return;
  const ac = audioCtx();
  if (!ac) return;
  for (const t of tones) tone(ac, t);
}

/* navigator.vibrate есть не везде: iOS (Safari и все браузеры на нём) и
   десктопы — нет. Для iOS 17.4+ есть обходной путь: программный клик по
   label со скрытым <input type="checkbox" switch> вызывает системный
   хаптик-тик. Паттерн эмулируем серией тиков. */
const iosHaptics = !navigator.vibrate &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
   // iPad с iOS 13+ представляется как Mac, отличаем по мультитачу.
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

let hapticEl = null;
function iosTick() {
  if (!hapticEl) {
    hapticEl = document.createElement('label');
    hapticEl.setAttribute('aria-hidden', 'true');
    hapticEl.style.display = 'none';
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.setAttribute('switch', '');
    hapticEl.appendChild(sw);
    document.body.appendChild(hapticEl);
  }
  hapticEl.click();
}

// Есть ли на устройстве хоть какой-то вибро-отклик (для показа настройки).
export function canVibrate() {
  return 'vibrate' in navigator || iosHaptics;
}

export function vibrate(pattern) {
  if (!loadSettings().vibration) return;
  if (navigator.vibrate) { navigator.vibrate(pattern); return; }
  if (!iosHaptics) return;
  // Тик в начале каждого «вибро»-отрезка паттерна [вибро, пауза, вибро, …].
  const segs = Array.isArray(pattern) ? pattern : [pattern];
  let t = 0;
  for (let k = 0; k < segs.length; k += 2) {
    if (t === 0) iosTick(); else setTimeout(iosTick, t);
    t += segs[k] + (segs[k + 1] || 0);
  }
}

/* Ошибка: короткий низкий «бзз» из двух нисходящих тонов. */
export function sfxError() {
  playTones([
    { freq: 220, dur: 0.12, type: 'square', gain: 0.07 },
    { freq: 160, at: 0.10, dur: 0.14, type: 'square', gain: 0.07 },
  ]);
  vibrate([70, 40, 70]);
}

/* Автокрестики: тихий короткий щелчок. */
export function sfxAutoCross() {
  playTones([{ freq: 950, dur: 0.06, type: 'triangle', gain: 0.10 }]);
  vibrate(20);
}

/* Победа: восходящее мажорное арпеджио C5–E5–G5–C6. */
export function sfxWin() {
  playTones([
    { freq: 523.25, at: 0,    dur: 0.18 },
    { freq: 659.25, at: 0.12, dur: 0.18 },
    { freq: 783.99, at: 0.24, dur: 0.22 },
    { freq: 1046.5, at: 0.36, dur: 0.45, gain: 0.18 },
  ]);
  vibrate([30, 40, 30, 40, 100]);
}
