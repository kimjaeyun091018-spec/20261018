// 효과음: 파일 없이 WebAudio로 즉석 합성
let ac = null, master = null, noiseBuf = null, muted = false;
const lastPlay = new Map();

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.35;
  const comp = ac.createDynamicsCompressor();
  master.connect(comp); comp.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; }
export const isMuted = () => muted;

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, filt = 'lowpass', f0 = 2000, f1 = 300, q = 1, delay = 0) {
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = filt; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ac.createGain(); env(g, t, 0.004, vol, dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SFX = {
  slash: () => { noise(0.12, 0.35, 'bandpass', 3500, 900, 1.5); },
  slashBig: () => { noise(0.2, 0.5, 'bandpass', 2500, 500, 1.2); tone('sawtooth', 220, 80, 0.15, 0.12); },
  hit: () => { noise(0.07, 0.5, 'lowpass', 3000, 400); tone('square', 180, 60, 0.07, 0.15); },
  hitBig: () => { noise(0.16, 0.7, 'lowpass', 2500, 120); tone('sine', 120, 40, 0.2, 0.5); },
  crit: () => { tone('square', 900, 1400, 0.06, 0.12); noise(0.14, 0.6, 'lowpass', 4000, 200); },
  fire: () => { noise(0.35, 0.3, 'lowpass', 1200, 200); tone('sawtooth', 120, 60, 0.3, 0.08); },
  boom: () => { noise(0.6, 0.8, 'lowpass', 1500, 40); tone('sine', 90, 30, 0.5, 0.6); },
  zap: () => { tone('sawtooth', 1600, 300, 0.12, 0.12); noise(0.1, 0.3, 'highpass', 3000, 6000); },
  thunder: () => { noise(0.5, 0.7, 'lowpass', 5000, 80); tone('square', 80, 40, 0.3, 0.3); },
  ice: () => { tone('triangle', 2400, 1200, 0.15, 0.15); tone('sine', 3200, 2600, 0.1, 0.08, 0.03); },
  shatter: () => { for (let i = 0; i < 4; i++) tone('triangle', 2000 + Math.random() * 2000, 800, 0.12, 0.08, i * 0.02); noise(0.2, 0.4, 'highpass', 3000, 8000); },
  wind: () => { noise(0.3, 0.35, 'bandpass', 600, 2400, 3); },
  earth: () => { noise(0.3, 0.6, 'lowpass', 500, 60); tone('sine', 70, 35, 0.3, 0.5); },
  water: () => { tone('sine', 500, 900, 0.1, 0.15); noise(0.2, 0.25, 'bandpass', 1500, 600, 2); },
  shadow: () => { tone('sawtooth', 300, 90, 0.18, 0.12); tone('sine', 150, 60, 0.25, 0.2); },
  poison: () => { tone('sine', 300, 600, 0.08, 0.1); tone('sine', 400, 800, 0.08, 0.08, 0.06); },
  shoot: () => { noise(0.06, 0.25, 'highpass', 2000, 5000); tone('square', 700, 300, 0.05, 0.06); },
  gun: () => { noise(0.08, 0.5, 'lowpass', 6000, 800); tone('square', 300, 80, 0.06, 0.15); },
  snipe: () => { noise(0.3, 0.8, 'lowpass', 8000, 200); tone('sawtooth', 600, 50, 0.3, 0.25); },
  dash: () => { noise(0.12, 0.25, 'bandpass', 1000, 3000, 2); },
  react: () => { tone('square', 400, 1200, 0.12, 0.12); tone('sine', 800, 1600, 0.2, 0.15, 0.05); noise(0.3, 0.5, 'lowpass', 3000, 200); },
  ko: () => { tone('sawtooth', 200, 2000, 0.4, 0.25); noise(0.8, 0.8, 'lowpass', 6000, 50); },
  gold: () => { tone('square', 1300, 1300, 0.05, 0.07); tone('square', 1950, 1950, 0.08, 0.07, 0.05); },
  chest: () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.18, 0.15, i * 0.07)); },
  die: () => { noise(0.2, 0.35, 'lowpass', 2000, 200); tone('square', 400, 100, 0.15, 0.08); },
  warn: () => { tone('square', 880, 880, 0.08, 0.06); tone('square', 880, 880, 0.08, 0.06, 0.12); },
  heal: () => { tone('sine', 700, 1100, 0.15, 0.06); },
  wall: () => { noise(0.15, 0.5, 'lowpass', 800, 100); },
  clash: () => { tone('triangle', 1800, 900, 0.1, 0.15); noise(0.08, 0.3, 'highpass', 4000, 8000); },
  bossDie: () => { noise(1.5, 0.9, 'lowpass', 3000, 30); tone('sawtooth', 300, 30, 1.2, 0.3); },
  ui: () => { tone('triangle', 660, 990, 0.06, 0.1); },
  buy: () => { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.1, 0.12, i * 0.05)); },
};
export function sfx(name, gap = 0.03) {
  if (!ac || muted || !SFX[name]) return;
  const t = ac.currentTime;
  if ((lastPlay.get(name) || 0) > t - gap) return;
  lastPlay.set(name, t);
  try { SFX[name](); } catch { /* 무시 */ }
}
const EL_SFX = { fire: 'fire', lightning: 'zap', ice: 'ice', wind: 'wind', earth: 'earth', water: 'water', shadow: 'shadow', poison: 'poison' };
// fx 하나 → 소리
export function fxSound(f) {
  switch (f.k) {
    case 'hit': if (f.dot) return; sfx(f.crit ? 'crit' : f.big ? 'hitBig' : 'hit', 0.04); break;
    case 'slash': sfx(f.big ? 'slashBig' : 'slash', 0.05); break;
    case 'cast':
      if (f.type === 'shot' || f.type === 'stream') sfx(f.char === 'pirate' && f.i === 0 ? 'gun' : EL_SFX[f.el] || 'shoot', 0.06);
      else if (f.type === 'snipe') sfx('warn');
      else if (f.el && f.i > 0) sfx(EL_SFX[f.el], 0.06);
      break;
    case 'explosion': case 'slam': sfx('boom', 0.08); break;
    case 'thunder': sfx('thunder', 0.07); break;
    case 'react': sfx('react', 0.08); if (f.rid === 'shatter' || f.rid === 'freeze') sfx('shatter'); break;
    case 'beam': sfx('snipe'); break;
    case 'ko': sfx('ko'); break;
    case 'gold': sfx('gold', 0.06); break;
    case 'chestopen': sfx('chest'); break;
    case 'die': sfx(f.boss ? 'bossDie' : 'die', 0.05); break;
    case 'roll': case 'dashstart': case 'blink': sfx('dash', 0.05); break;
    case 'warn': case 'warnline': sfx('warn', 0.3); break;
    case 'wallhit': sfx('wall'); break;
    case 'clash': case 'clashboom': sfx('clash'); break;
    case 'nova': sfx(f.look === 'frost' ? 'shatter' : f.look === 'quake' ? 'earth' : 'shadow'); break;
    case 'pillar': sfx(f.look === 'lava' ? 'fire' : 'earth', 0.06); break;
    case 'heal': sfx('heal', 0.25); break;
    case 'execute': sfx('shadow'); break;
    case 'collapse': sfx('boom', 0.2); break;
    case 'rise': case 'portalrise': sfx('earth', 0.2); break;
    case 'portalopen': sfx('chest'); sfx('heal'); break;
    case 'warp': sfx('react'); break;
    case 'crumble': sfx('warn', 0.3); break;
    default:
  }
}
