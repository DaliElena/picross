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

// navigator.vibrate есть не везде (iOS Safari и десктопы — нет).
export function vibrate(pattern) {
  if (!loadSettings().vibration) return;
  navigator.vibrate?.(pattern);
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
