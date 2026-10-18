// ============================================================
//  원소 아레나 — 화면 그리기 (지도 · 캐릭터 · 적 · HUD)
// ============================================================
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, CHARS, ENEMIES, ENEMY_SHEET, BOSSES, CHAPTERS, ELEMENTS, COLOSSEUM } from './data.js';
import { mapRowsFor } from './sim.js';
import { Particles, drawShot, drawZone, drawFx, spawnFx, elColor } from './fx.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const V = window.__ASSET_V || 1;
const img = (src) => { const i = new Image(); i.src = `assets/${src}?v=${V}`; return i; };
const SHEETS = { heroes: img('heroes.png'), enemies: img('enemies.png'), bosses: img('bosses.png') };
const ready = (i) => i.complete && i.naturalWidth > 0;
const FONT = '"Black Han Sans", "Noto Sans KR", sans-serif';

// 하얀 실루엣 (맞았을 때 번쩍)
const whiteCache = new Map();
function whiteOf(image) {
  if (whiteCache.has(image)) return whiteCache.get(image);
  if (!ready(image)) return image;
  const c = document.createElement('canvas');
  c.width = image.naturalWidth; c.height = image.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  whiteCache.set(image, c);
  return c;
}

// ---------- 지도 그림 (한 번 그려 둠) ----------
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function themeOf(key) {
  if (!key) return null;
  if (key[0] === 'C') return { floor: ['#3a2f25', '#3f3328'], wall: '#5a4535', wallTop: '#7a5e48', sand: true, deco: 'sand' };
  const ch = Number(key.split('-')[1]) || 0;
  const C = CHAPTERS[ch];
  return { floor: C.floor, wall: C.wall, wallTop: C.wallTop, deco: ['grass', 'bone', 'ember'][ch] };
}
function buildMap(key) {
  const rows = mapRowsFor(key), th = themeOf(key);
  const c = document.createElement('canvas');
  c.width = VIEW_W; c.height = VIEW_H;
  const g = c.getContext('2d');
  const at = (x, y) => (rows[y] && rows[y][x]) || '#';
  const isWall = (x, y) => at(x, y) === '#';
  // 바닥
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const px = x * TILE, py = y * TILE;
    g.fillStyle = th.floor[(x + y) % 2];
    g.fillRect(px, py, TILE, TILE);
    // 돌바닥 무늬
    const h = hash(x, y);
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(px, py + TILE - 1, TILE, 1); g.fillRect(px + TILE - 1, py, 1, TILE);
    g.fillStyle = 'rgba(255,255,255,.035)';
    g.fillRect(px + 1, py + 1, TILE - 3, 1);
    if (h < 0.25) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(px + 6 + h * 40, py + 10 + h * 30, 6, 2); }
    // 장식
    const h2 = hash(x + 9, y + 3);
    if (h2 < 0.12 && at(x, y) === '.') {
      if (th.deco === 'grass') { g.fillStyle = '#3d5a35'; for (let i = 0; i < 3; i++) g.fillRect(px + 8 + i * 4, py + 18 - (i % 2) * 3, 2, 5 + (i % 2) * 3); g.fillStyle = '#e57373'; if (h2 < 0.04) g.fillRect(px + 20, py + 14, 3, 3); }
      else if (th.deco === 'bone') { g.fillStyle = '#9e98b0'; g.fillRect(px + 9, py + 16, 12, 2); g.fillRect(px + 8, py + 15, 2, 4); g.fillRect(px + 20, py + 15, 2, 4); }
      else if (th.deco === 'ember') { g.fillStyle = '#3e1f17'; g.fillRect(px + 6, py + 12, 14, 2); g.fillRect(px + 12, py + 12, 2, 10); g.fillStyle = '#ff7043'; if (h2 < 0.05) g.fillRect(px + 18, py + 20, 2, 2); }
      else if (th.deco === 'sand') { g.fillStyle = 'rgba(255,224,178,.08)'; g.fillRect(px + 4, py + 8, 20, 2); }
    }
  }
  if (th.sand) {
    // 투기장 원형 문양
    g.strokeStyle = 'rgba(255,213,79,.08)'; g.lineWidth = 6;
    g.beginPath(); g.arc(VIEW_W / 2, VIEW_H / 2, 150, 0, TAU); g.stroke();
    g.beginPath(); g.arc(VIEW_W / 2, VIEW_H / 2, 60, 0, TAU); g.stroke();
  }
  // 구덩이 (깊이감)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (at(x, y) !== 'o') continue;
    const px = x * TILE, py = y * TILE;
    g.fillStyle = '#07060c'; g.fillRect(px, py, TILE, TILE);
    const up = at(x, y - 1);
    if (up !== 'o' && up !== '#') {
      // 위쪽 절벽면
      const gr = g.createLinearGradient(0, py, 0, py + 18);
      gr.addColorStop(0, '#4a3b2c'); gr.addColorStop(1, '#07060c');
      g.fillStyle = gr; g.fillRect(px, py, TILE, 18);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(px, py, TILE, 2);
    }
    if (at(x - 1, y) !== 'o' && at(x - 1, y) !== '#') { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(px, py, 2, TILE); }
    if (at(x + 1, y) !== 'o' && at(x + 1, y) !== '#') { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(px + TILE - 2, py, 2, TILE); }
    if (hash(x, y) < 0.2) { g.fillStyle = 'rgba(120,90,255,.08)'; g.fillRect(px + 10, py + 12, 2, 2); }
  }
  // 가시
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (at(x, y) !== '^') continue;
    const px = x * TILE, py = y * TILE;
    g.fillStyle = '#2b2226'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    g.fillStyle = '#1a1416'; g.fillRect(px + 2, py + TILE - 4, TILE - 4, 2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const sx = px + 4 + i * 9 + (j ? 4 : 0), sy = py + 7 + j * 12;
      g.fillStyle = '#90a4ae'; g.beginPath(); g.moveTo(sx, sy + 9); g.lineTo(sx + 4, sy); g.lineTo(sx + 8, sy + 9); g.fill();
      g.fillStyle = '#eceff1'; g.beginPath(); g.moveTo(sx + 2, sy + 9); g.lineTo(sx + 4, sy); g.lineTo(sx + 4, sy + 9); g.fill();
      g.fillStyle = '#8e2a2a'; g.fillRect(sx + 3, sy + 1, 2, 2);
    }
  }
  // 벽 (윗면 + 앞면으로 입체감)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!isWall(x, y)) continue;
    const px = x * TILE, py = y * TILE;
    const front = !isWall(x, y + 1) && y + 1 < ROWS;
    g.fillStyle = th.wallTop; g.fillRect(px, py, TILE, TILE);
    // 윗면 돌 무늬
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(px, py + 15, TILE, 1);
    g.fillRect(px + ((y % 2) ? 8 : 22), py, 1, 15); g.fillRect(px + ((y % 2) ? 22 : 8), py + 16, 1, 16);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px, py, TILE, 1);
    if (!isWall(x, y - 1)) { g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(px, py, TILE, 2); }
    if (front) {
      g.fillStyle = th.wall; g.fillRect(px, py + 18, TILE, 14);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px, py + 24, TILE, 1);
      g.fillRect(px + ((x % 2) ? 10 : 24), py + 18, 1, 6); g.fillRect(px + ((x % 2) ? 4 : 18), py + 25, 1, 7);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px, py + 30, TILE, 2);
      // 벽 아래 그림자
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px, py + TILE, TILE, 6);
    }
  }
  // 어둡게 테두리
  const vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg; g.fillRect(0, 0, VIEW_W, VIEW_H);
  return c;
}

// ============================================================
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const P = new Particles();
  const fxList = [];
  const seen = new Set();
  const texts = [];
  const ghosts = [];
  const anim = new Map(); // 영웅별 공격 동작 시작 시각
  const mapCache = new Map();
  let shake = 0, flash = 0, flashCol = '#fff', punch = 0, dpr = 1;
  let lastNow = performance.now();
  let comboPop = 0, lastCombo = 0;
  const hooks = { onFx: null };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== VIEW_W * dpr) { canvas.width = VIEW_W * dpr; canvas.height = VIEW_H * dpr; }
  }

  const ui = {
    number(f) {
      const sz = clamp(15 + f.v * 0.55, 15, 40) * (f.crit ? 1.35 : 1);
      texts.push({ x: f.x + rnd(-8, 8), y: f.y - 14, vx: rnd(-40, 40), vy: -170, text: f.crit ? `${f.v}!` : String(f.v), size: sz, color: f.crit ? '#ffd54f' : f.react ? '#fff59d' : f.el ? elColor(f.el) : '#ffffff', life: 0.8, max: 0.8, pop: 1, grav: 380 });
    },
    react(f) { texts.push({ x: f.x, y: f.y - 34, vx: 0, vy: -50, text: f.name, size: 26, color: f.color, life: 1.1, max: 1.1, pop: 1.6, grav: 0, react: true }); },
    goldPop(f) { texts.push({ x: f.x, y: f.y - 20, vx: 0, vy: -60, text: `+${f.v} G`, size: 18, color: '#ffd54f', life: 1, max: 1, pop: 1, grav: 0 }); },
    heal(f) { if (Math.random() < 0.5) texts.push({ x: f.x + rnd(-8, 8), y: f.y - 10, vx: 0, vy: -50, text: `+${f.v}`, size: 14, color: '#69f0ae', life: 0.6, max: 0.6, pop: 1, grav: 0 }); },
  };

  // 새 fx를 처음 볼 때
  function ingest(list, myId) {
    for (const f of list) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if (seen.size > 3000) { const arr = [...seen]; arr.slice(0, 1500).forEach((x) => seen.delete(x)); }
      const copy = { ...f, t: f.life, life: f.life };
      fxList.push(copy);
      spawnFx(copy, P, ui);
      if (f.shake) shake = Math.min(18, shake + f.shake);
      if (f.k === 'ko') { flash = 0.25; flashCol = '#ffffff'; punch = 0.04; }
      if (f.k === 'die' && f.boss) { flash = 0.4; punch = 0.05; }
      if (f.k === 'hit' && f.crit) punch = Math.max(punch, 0.015);
      if (f.k === 'react') punch = Math.max(punch, 0.02);
      if (f.k === 'cast') anim.set(f.who, { t: performance.now(), i: f.i, type: f.type });
      hooks.onFx?.(f, myId);
    }
  }

  function label(text, x, y, color, size, opt = {}) {
    ctx.font = `${size}px ${opt.font || FONT}`;
    ctx.textAlign = opt.align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = opt.stroke ?? Math.max(3, size / 5);
    ctx.strokeStyle = opt.strokeColor || 'rgba(10,6,20,.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  const pctColor = (p) => (p < 40 ? '#ffffff' : p < 80 ? '#fff176' : p < 120 ? '#ffb74d' : p < 160 ? '#ff7043' : '#ff1744');

  // ---------- 영웅 ----------
  function heroFrame(h, now) {
    if (!h.al || h.dn) return 14;
    if (h.fl) return 13;
    if (h.sp) return 10;
    if (h.ch) return 11;
    const A = anim.get(h.id);
    if (A) {
      const dt = (now - A.t) / 1000;
      if (dt < 0.06) return 10;
      if (dt < 0.14) return 11;
      if (dt < 0.24) return 12;
    }
    if (h.mv || h.ds || h.ro) return 4 + (Math.floor(now / 75) % 6);
    return Math.floor(now / 230) % 4;
  }
  function drawHeroSprite(h, frame, x, y, alpha = 1, white = false, lift = 0) {
    const C = CHARS[h.c];
    const sheet = SHEETS.heroes;
    const flip = Math.cos(h.a) < 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - lift);
    if (flip) ctx.scale(-1, 1);
    if (ready(sheet)) {
      ctx.drawImage(white ? whiteOf(sheet) : sheet, frame * 32, C.row * 32, 32, 32, -24, -42, 48, 48);
    } else { ctx.fillStyle = C.color; ctx.fillRect(-10, -26, 20, 30); }
    ctx.restore();
  }
  function statusFx(u, x, y, st, now, dt, big = 1) {
    if (!st) return;
    const T = now / 1000;
    if (st.includes('b') && Math.random() < dt * 14) P.add({ kind: 'ember', x: x + rnd(-10, 10) * big, y: y + rnd(-14, 4), vx: rnd(-10, 10), vy: -rnd(40, 90), life: 0.5, size: rnd(2, 3.5), color: Math.random() < 0.5 ? '#ff7043' : '#ffab40', drag: 0 });
    if (st.includes('s') && Math.random() < dt * 10) P.add({ kind: 'spark', x: x + rnd(-12, 12) * big, y: y + rnd(-20, 4), vx: rnd(-150, 150), vy: rnd(-150, 150), life: 0.12, size: 2, color: '#fff59d', drag: 0 });
    if (st.includes('w') && Math.random() < dt * 5) P.add({ kind: 'glow', x: x + rnd(-10, 10) * big, y: y - 10, vx: 0, vy: 60, life: 0.4, size: 2, color: '#4fc3f7', drag: 0 });
    const pm = st.match(/p(\d)/);
    if (pm && Math.random() < dt * 6) P.add({ kind: 'glow', x: x + rnd(-10, 10) * big, y: y - 4, vx: 0, vy: -40, life: 0.6, size: 2 + Number(pm[1]) * 0.3, color: '#9ccc65', drag: 0 });
    if (st.includes('c')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.ellipse(x, y - 10, 14 * big, 18 * big, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (st.includes('f')) {
      ctx.save();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#b3e5fc';
      ctx.fillRect(x - 16 * big, y - 34 * big, 32 * big, 40 * big);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 2; ctx.strokeRect(x - 16 * big, y - 34 * big, 32 * big, 40 * big);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 12 * big, y - 30 * big, 4, 20 * big); ctx.fillRect(x - 6 * big, y - 30 * big, 10 * big, 3);
      ctx.restore();
    }
    if (st.includes('m')) {
      ctx.save(); ctx.translate(x, y - 46 * big); ctx.rotate(T * 2);
      ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
      ctx.restore();
    }
    if (pm) label(`☠${pm[1]}`, x + 18 * big, y - 26 * big, '#c5e1a5', 11, { font: 'sans-serif', stroke: 3 });
  }
  function drawHero(h, me, mode, now, dt) {
    if (!h.al) return;
    const C = CHARS[h.c];
    const fall = h.fa > 0 ? clamp(h.fa / 0.6, 0.05, 1) : 1;
    const x = h.x, y = h.y;
    // 도약 강타: 공중으로 뜸
    let lift = 0;
    const A = anim.get(h.id);
    if (h.ds === 'leap' && A) { const k = clamp((now - A.t) / 300, 0, 1); lift = Math.sin(k * Math.PI) * 60; }
    // 대시 잔상
    if ((h.ds || h.ro) && Math.random() < 0.7) ghosts.push({ h: { ...h }, frame: heroFrame(h, now), x, y, lift, life: 0.22, max: 0.22, col: h.ds ? elColor(C.el) : '#ffffff' });
    ctx.save();
    if (fall < 1) { ctx.translate(x, y); ctx.scale(fall, fall); ctx.rotate((1 - fall) * 6); ctx.translate(-x, -y); }
    // 그림자 + 팀 고리
    ctx.globalAlpha = 0.35 * (1 - lift / 120); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 14 * (1 - lift / 150), 5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = h.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 15, 6, 0, 0, TAU); ctx.stroke();
    if (h.id === me) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 150); ctx.beginPath(); ctx.ellipse(x, y + 12, 19, 8, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const blink = h.iv && Math.floor(now / 70) % 2;
    // 강화 (연막 후퇴 뒤 다음 기본 공격)
    if (h.em) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 80); ctx.fillStyle = '#9c64ff'; ctx.beginPath(); ctx.ellipse(x, y - 10, 18, 24, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    drawHeroSprite(h, heroFrame(h, now), x, y, blink ? 0.45 : 1, false, lift);
    if (h.fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawHeroSprite(h, heroFrame(h, now), x, y, 0.85, true, lift); ctx.restore(); }
    statusFx(h, x, y - lift, h.st, now, dt);
    // 기절 별
    if (h.sn && !h.dn) for (let i = 0; i < 3; i++) { const a = now / 150 + (i * TAU) / 3; label('★', x + Math.cos(a) * 12, y - 40 + Math.sin(a) * 4, '#fff59d', 11, { font: 'sans-serif', stroke: 2 }); }
    ctx.restore();
    // 쓰러짐 + 부활 게이지
    if (h.dn) {
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y - 4, 22, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#69f0ae'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 4, 22, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.rv / 2.5, 0, 1)); ctx.stroke();
      label('부활', x, y - 30, '#69f0ae', 13);
    }
    // 이름 · 체력 / %
    if (h.fa > 0) return;
    label(h.n, x, y - 46 - lift, h.col, 12, { font: 'sans-serif', stroke: 3 });
    if (mode === 'colosseum') {
      const p = Math.floor(h.p);
      const shakeP = p > 100 ? rnd(-1, 1) : 0;
      label(`${p}%`, x + shakeP, y + 34, pctColor(p), 17 + Math.min(8, p / 25));
    } else if (!h.dn) {
      const w = 34, k = clamp(h.hp / h.mh, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - w / 2 - 1, y + 20, w + 2, 6);
      ctx.fillStyle = k > 0.5 ? '#66bb6a' : k > 0.25 ? '#ffca28' : '#ef5350'; ctx.fillRect(x - w / 2, y + 21, w * k, 4);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - w / 2, y + 21, w * k, 1);
    }
    if (h.cb >= 3 && h.id !== me) label(`${h.cb}`, x + 20, y - 30, '#ffd54f', 13);
  }

  // ---------- 적 ----------
  function drawEnemy(e, now, dt) {
    const [id, type, x, y, hp, mh, fall, fl, face, st, spawning, z, boss, act, actA] = e;
    const sc = fall > 0 ? clamp(fall / 0.6, 0.05, 1) : 1;
    ctx.save();
    if (sc < 1) { ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate((1 - sc) * 5); ctx.translate(-x, -y); }
    if (spawning) ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 40);
    if (boss) {
      const B = BOSSES[type];
      const R = B.r;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + R * 0.7, R * 1.1 * (1 - z / 200), R * 0.4, 0, 0, TAU); ctx.fill();
      // 위압감 있는 오라
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.1 * Math.sin(now / 200);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R * 2); gr.addColorStop(0, B.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R * 2, 0, TAU); ctx.fill(); ctx.restore();
      const sheet = SHEETS.bosses;
      const frame = B.sheet * 3 + (Math.floor(now / 260) % 2);
      const flip = Math.cos(face) < 0;
      const S = R * 2.6;
      ctx.save(); ctx.translate(x, y - z); if (flip) ctx.scale(-1, 1);
      if (ready(sheet)) { ctx.drawImage(sheet, frame * 40, 0, 40, 40, -S / 2, -S * 0.72, S, S); if (fl) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; ctx.drawImage(whiteOf(sheet), frame * 40, 0, 40, 40, -S / 2, -S * 0.72, S, S); } }
      ctx.restore();
      // 레이저
      if (act === 'laser') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const ca = Math.cos(actA), sa = Math.sin(actA);
        for (const [w, c, a] of [[34, '#ff1744', 0.35], [16, '#ff8a80', 0.8], [6, '#ffffff', 1]]) { ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + ca * 20, y - 14 + sa * 20); ctx.lineTo(x + ca * 640, y - 14 + sa * 640); ctx.stroke(); }
        if (Math.random() < 0.6) P.add({ kind: 'spark', x: x + ca * rnd(40, 600), y: y - 14 + sa * rnd(40, 600), vx: rnd(-200, 200), vy: rnd(-200, 200), life: 0.2, size: 3, color: '#ff8a80' });
        ctx.restore();
      }
      statusFx(null, x, y, st, now, dt, 2);
    } else {
      const E = ENEMIES[type];
      const idx = ENEMY_SHEET.indexOf(type);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + E.r * 0.8, E.r * 1.05, E.r * 0.38, 0, 0, TAU); ctx.fill();
      const sheet = SHEETS.enemies;
      const frame = idx * 3 + (Math.floor(now / 180 + id) % 2);
      const flip = Math.cos(face) < 0;
      const S = Math.max(36, E.r * 2.9);
      const bounce = type === 'slime' ? Math.abs(Math.sin(now / 140 + id)) * 3 : 0;
      ctx.save(); ctx.translate(x, y - bounce); if (flip) ctx.scale(-1, 1);
      if (type === 'slime') ctx.scale(1 + bounce * 0.03, 1 - bounce * 0.03);
      if (ready(sheet)) { ctx.drawImage(sheet, frame * 24, 0, 24, 24, -S / 2, -S * 0.68, S, S); if (fl) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85; ctx.drawImage(whiteOf(sheet), frame * 24, 0, 24, 24, -S / 2, -S * 0.68, S, S); } }
      ctx.restore();
      statusFx(null, x, y, st, now, dt);
      if (hp < mh && !spawning) {
        const w = Math.max(24, E.r * 2.2), k = clamp(hp / mh, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2 - 1, y - S * 0.68 - 6, w + 2, 5);
        ctx.fillStyle = '#ef5350'; ctx.fillRect(x - w / 2, y - S * 0.68 - 5, w * k, 3);
      }
    }
    ctx.restore();
  }

  // ---------- 상자 ----------
  function drawChest(c, now) {
    const x = c.x, y = c.y, s = c.big ? 1.4 : 1;
    const bob = c.open ? 0 : Math.abs(Math.sin(now / 300)) * 3;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, `rgba(255,213,79,${c.open ? 0.15 : 0.35 + 0.15 * Math.sin(now / 200)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 10, 18, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -bob);
    ctx.fillStyle = '#5d3a1a'; ctx.fillRect(-16, -6, 32, 16);
    ctx.fillStyle = '#8d5a2b'; ctx.fillRect(-15, -5, 30, 13);
    ctx.fillStyle = '#ffca28'; ctx.fillRect(-16, -6, 3, 16); ctx.fillRect(13, -6, 3, 16);
    if (c.open) {
      ctx.fillStyle = '#3e2510'; ctx.fillRect(-15, -8, 30, 4);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(-12, -9, 24, 3);
      ctx.fillStyle = '#5d3a1a'; ctx.fillRect(-16, -22, 32, 10);
      ctx.fillStyle = '#ffca28'; ctx.fillRect(-16, -22, 32, 2);
    } else {
      ctx.fillStyle = '#6d4520'; ctx.fillRect(-16, -16, 32, 11);
      ctx.fillStyle = '#a0692f'; ctx.fillRect(-15, -15, 30, 3);
      ctx.fillStyle = '#ffca28'; ctx.fillRect(-16, -16, 3, 11); ctx.fillRect(13, -16, 3, 11); ctx.fillRect(-16, -7, 32, 2);
      ctx.fillStyle = '#fff59d'; ctx.fillRect(-3, -9, 6, 7); ctx.fillStyle = '#5d3a1a'; ctx.fillRect(-1, -6, 2, 3);
    }
    ctx.restore();
    if (!c.open) label('열기', x, y - 30 * s - bob, '#ffd54f', 13);
  }

  // ---------- HUD ----------
  function drawHud(snap, me, now) {
    const meH = snap.h.find((h) => h.id === me);
    // 위 왼쪽: 진행 상황
    ctx.fillStyle = 'rgba(8,6,18,.6)';
    roundRect(10, 10, 300, 34, 8); ctx.fill();
    if (snap.sto) {
      const S = snap.sto;
      const CH = CHAPTERS[S.ch];
      label(`${S.ch + 1}-${S.st + 1} ${CH.name}`, 20, 33, '#ffffff', 16, { align: 'left' });
      // 웨이브 점
      for (let i = 0; i < S.tw; i++) {
        const done = i < S.w || S.ph === 'clear' || S.ph === 'done', cur = i === S.w && S.ph === 'fight';
        ctx.fillStyle = done ? '#ffd54f' : cur ? '#ff7043' : 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.arc(200 + i * 16, 27, cur ? 5 + Math.sin(now / 120) : 5, 0, TAU); ctx.fill();
      }
      label(`${snap.g} G`, 300, 33, '#ffd54f', 15, { align: 'right' });
    } else if (snap.col) {
      label(`콜로세움 · ${snap.col.name}`, 20, 33, '#ffd54f', 16, { align: 'left' });
    }
    // 아래쪽: 파티 패널
    const list = snap.h;
    const pw = 150, gap = 6;
    let px = 10;
    const py = 50;
    list.forEach((h) => {
      const C = CHARS[h.c];
      ctx.fillStyle = h.id === me ? 'rgba(30,24,54,.82)' : 'rgba(8,6,18,.7)';
      roundRect(px, py, pw, 44, 8); ctx.fill();
      ctx.strokeStyle = h.col; ctx.lineWidth = h.id === me ? 3 : 1.5; roundRect(px, py, pw, 44, 8); ctx.stroke();
      // 얼굴
      if (ready(SHEETS.heroes)) {
        ctx.save(); ctx.beginPath(); ctx.rect(px + 4, py + 4, 36, 36); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(px + 4, py + 4, 36, 36);
        ctx.drawImage(SHEETS.heroes, (h.al && !h.dn ? 0 : 14) * 32, C.row * 32, 32, 22, px + 2, py + 2, 40, 27.5);
        ctx.restore();
      }
      label(h.n, px + 46, py + 17, h.col, 12, { align: 'left', font: 'sans-serif', stroke: 3 });
      if (snap.m === 'colosseum') {
        const p = Math.floor(h.p);
        label(h.al ? `${p}%` : `${Math.ceil(h.rs)}초`, px + pw - 8, py + 38, h.al ? pctColor(p) : '#90a4ae', 22, { align: 'right' });
        for (let i = 0; i < COLOSSEUM.stocks; i++) { ctx.fillStyle = i < h.sk ? h.col : 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(px + 52 + i * 13, py + 32, 5, 0, TAU); ctx.fill(); }
      } else {
        const k = clamp(h.hp / h.mh, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(px + 46, py + 24, pw - 54, 10);
        ctx.fillStyle = k > 0.5 ? '#66bb6a' : k > 0.25 ? '#ffca28' : '#ef5350'; ctx.fillRect(px + 47, py + 25, (pw - 56) * k, 8);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(px + 47, py + 25, (pw - 56) * k, 2);
        label(h.dn ? '쓰러짐' : `${h.hp}/${h.mh}`, px + pw - 10, py + 17, h.dn ? '#ef5350' : '#cfd8dc', 11, { align: 'right', font: 'sans-serif', stroke: 3 });
        // 대시 충전
        for (let i = 0; i < h.dc; i++) { ctx.fillStyle = '#80deea'; ctx.fillRect(px + 47 + i * 10, py + 37, 8, 3); }
      }
      px += pw + gap;
    });
    // 보스 체력
    const boss = snap.e.find((e) => e[12]);
    if (boss) {
      const B = BOSSES[boss[1]];
      const w = 360, x0 = 330, k = clamp(boss[4] / boss[5], 0, 1);
      ctx.fillStyle = 'rgba(8,6,18,.75)'; roundRect(x0 - 8, 10, w + 16, 34, 8); ctx.fill();
      ctx.fillStyle = '#3e0d16'; ctx.fillRect(x0, 30, w, 9);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(x0, 30, w * k, 9);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0, 30, w * k, 2);
      if (k < 0.5) { ctx.fillStyle = `rgba(255,23,68,${0.3 + 0.2 * Math.sin(now / 100)})`; ctx.fillRect(x0, 30, w * k, 9); }
      label(B.name, x0 + w / 2, 26, '#ffcdd2', 14);
    }
    // 콤보 (내 것)
    if (meH && meH.cb >= 3) {
      if (meH.cb !== lastCombo) comboPop = 1;
      const s = 1 + comboPop * 0.35;
      ctx.save(); ctx.translate(VIEW_W - 90, 170); ctx.scale(s, s); ctx.rotate(-0.08);
      const col = meH.cb >= 50 ? '#ff1744' : meH.cb >= 25 ? '#ff9100' : meH.cb >= 10 ? '#ffd54f' : '#ffffff';
      label(String(meH.cb), 0, 0, col, 46);
      label('COMBO', 0, 22, '#ffe0b2', 16);
      ctx.restore();
    }
    lastCombo = meH ? meH.cb : 0;
    // 가운데 알림
    if (snap.msg) {
      ctx.font = `24px ${FONT}`;
      const w = ctx.measureText(snap.msg).width + 60;
      const y = 140;
      const gr = ctx.createLinearGradient((VIEW_W - w) / 2, 0, (VIEW_W + w) / 2, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, 'rgba(8,6,18,.8)'); gr.addColorStop(0.85, 'rgba(8,6,18,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect((VIEW_W - w) / 2, y - 28, w, 40);
      label(snap.msg, VIEW_W / 2, y, '#ffffff', 24);
    }
    if (meH && !meH.al && snap.m === 'colosseum' && meH.sk > 0) label(`부활까지 ${Math.ceil(meH.rs)}초`, VIEW_W / 2, VIEW_H / 2, '#ffffff', 28);
    if (snap.col?.over) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, VIEW_H / 2 - 60, VIEW_W, 100);
      label('승리!', VIEW_W / 2, VIEW_H / 2 - 8, '#ffd54f', 52);
      label(snap.col.win || '', VIEW_W / 2, VIEW_H / 2 + 28, '#ffffff', 20);
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ============================================================
  function render(snap, me, opt = {}) {
    resize();
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    ingest(snap.fx, me);
    P.update(dt);
    for (const f of fxList) f.t -= dt;
    for (let i = fxList.length - 1; i >= 0; i--) if (fxList[i].t <= 0) fxList.splice(i, 1);
    for (const g of ghosts) g.life -= dt;
    for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].life <= 0) ghosts.splice(i, 1);
    for (const t of texts) { t.life -= dt; t.vy += t.grav * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.pop = Math.max(0, t.pop - dt * 6); }
    for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt);
    punch = Math.max(0, punch - dt * 0.25);
    comboPop = Math.max(0, comboPop - dt * 5);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 카메라 흔들림 + 살짝 확대
    const sx = (Math.random() * 2 - 1) * shake * (opt.shakeMul ?? 1), sy = (Math.random() * 2 - 1) * shake * (opt.shakeMul ?? 1);
    const z = 1 + punch;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (sx - (VIEW_W * (z - 1)) / 2), dpr * (sy - (VIEW_H * (z - 1)) / 2));
    if (snap.mk) {
      if (!mapCache.has(snap.mk)) mapCache.set(snap.mk, buildMap(snap.mk));
      ctx.drawImage(mapCache.get(snap.mk), 0, 0);
    }
    // 바닥: 지대 · 경고 · 위험
    for (const zn of snap.z) drawZone(ctx, zn, now, P, dt);
    for (const [x, y, r, t] of snap.hz) {
      ctx.save();
      ctx.fillStyle = `rgba(255,40,60,${0.12 + 0.1 * Math.sin(now / 50)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,40,60,.3)'; ctx.beginPath(); ctx.arc(x, y, r * clamp(1 - t, 0, 1), 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,90,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const groundFx = new Set(['warn', 'warnline', 'spawnwarn', 'markcone', 'slam', 'detocast', 'aimline']);
    for (const f of fxList) if (groundFx.has(f.k)) drawFx(ctx, f, now);
    // 몸: 아래쪽에 있는 것을 나중에
    const bodies = [];
    for (const e of snap.e) bodies.push({ y: e[3], d: () => drawEnemy(e, now, dt) });
    for (const h of snap.h) bodies.push({ y: h.y, d: () => drawHero(h, me, snap.m, now, dt) });
    if (snap.sto?.chest) bodies.push({ y: snap.sto.chest.y, d: () => drawChest(snap.sto.chest, now) });
    for (const f of fxList) if (f.k === 'pillar') bodies.push({ y: f.y + 2, d: () => drawFx(ctx, f, now) });
    bodies.sort((a, b) => a.y - b.y);
    // 잔상
    for (const g of ghosts) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawHeroSprite(g.h, g.frame, g.x, g.y, (g.life / g.max) * 0.5, true, g.lift);
      ctx.restore();
    }
    for (const b of bodies) b.d();
    // 연기 등 (일반 합성), 투사체, 빛 (덧셈 합성)
    P.draw(ctx, 'normal');
    for (const sh of snap.s) drawShot(ctx, sh, now, P, dt);
    for (const f of fxList) if (!groundFx.has(f.k) && f.k !== 'pillar') drawFx(ctx, f, now);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; P.draw(ctx, 'add'); ctx.restore();
    // 글자 (피해 숫자, 반응 이름)
    for (const t of texts) {
      const k = t.life / t.max;
      ctx.save();
      ctx.globalAlpha = clamp(k * 2.5, 0, 1);
      ctx.translate(t.x, t.y);
      const s = 1 + t.pop * (t.react ? 0.5 : 0.6);
      ctx.scale(s, s);
      if (t.react) {
        label(t.text, 0, 0, t.color, t.size, { strokeColor: '#1a0b2e', stroke: 7 });
      } else label(t.text, 0, 0, t.color, t.size);
      ctx.restore();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (flash > 0) { ctx.globalAlpha = clamp(flash * 3, 0, 0.7); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = 1; }
    // 내 캐릭터 조준점
    const meH = snap.h.find((h) => h.id === me);
    if (meH && meH.al && !meH.dn && opt.aim) {
      const ax = meH.x + Math.cos(meH.a) * 34, ay = meH.y - 8 + Math.sin(meH.a) * 34;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(meH.a);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5); ctx.fill();
      ctx.restore();
    }
    drawHud(snap, me, now);
  }
  function reset() { P.list.length = 0; fxList.length = 0; texts.length = 0; ghosts.length = 0; shake = 0; flash = 0; }
  return { render, hooks, particles: P, resize, reset };
}
