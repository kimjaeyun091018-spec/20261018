// ============================================================
//  원소 아레나 — 화면 그리기 (공허 · 지도 · 캐릭터 · 적 · 아이템 · HUD)
// ============================================================
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, CHARS, CHAR_KEYS, ENEMIES, ENEMY_SHEET, BOSSES, CHAPTERS, COLOSSEUM, ITEMS, AUGMENTS, HERO_SPRITE } from './data.js';
import { mapRowsFor, ringOf } from './sim.js';
import { Particles, drawShot, drawZone, drawFx, spawnFx, elColor } from './fx.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const V = window.__ASSET_V || 1;
const img = (src) => { const i = new Image(); i.src = `assets/${src}?v=${V}`; return i; };
const SHEETS = { heroes: img('heroes.png'), enemies: img('enemies.png'), bosses: img('bosses.png'), busts: img('portraits.png') };
const ready = (i) => i.complete && i.naturalWidth > 0;
const FONT = '"Black Han Sans", "Noto Sans KR", sans-serif';
const HS = HERO_SPRITE.size, HD = HERO_SPRITE.draw, PS = HERO_SPRITE.portrait;

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

// ============================================================
//  공허 (맵 밖): 깊은 보라빛 우주, 천천히 흐르는 별과 성운
// ============================================================
const STARS = Array.from({ length: 140 }, (_, i) => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, z: 0.2 + Math.random() * 0.8, p: Math.random() * TAU, c: i % 7 === 0 ? '#b388ff' : i % 5 === 0 ? '#80d8ff' : '#ffffff' }));
let nebula = null;
function buildNebula() {
  const c = document.createElement('canvas');
  c.width = VIEW_W; c.height = VIEW_H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, '#07051a'); bg.addColorStop(0.5, '#0d0824'); bg.addColorStop(1, '#05030f');
  g.fillStyle = bg; g.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const [x, y, r, col] of [[160, 120, 260, 'rgba(124,77,255,.16)'], [820, 520, 300, 'rgba(41,182,246,.10)'], [700, 90, 200, 'rgba(236,64,122,.08)'], [240, 560, 220, 'rgba(0,229,255,.07)'], [480, 320, 380, 'rgba(98,0,234,.08)']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  return c;
}
function drawVoid(ctx, now) {
  if (!nebula) nebula = buildNebula();
  ctx.drawImage(nebula, 0, 0);
  const t = now / 1000;
  for (const s of STARS) {
    const x = (s.x + t * 6 * s.z) % VIEW_W, y = (s.y + t * 2 * s.z) % VIEW_H;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p));
    ctx.globalAlpha = tw * s.z;
    ctx.fillStyle = s.c;
    const sz = s.z > 0.85 ? 2 : 1;
    ctx.fillRect(x, y, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
//  지도 그림 (무너진 단계마다 한 번씩 그려 둠). 공허 칸은 투명
// ============================================================
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function themeOf(key) {
  if (key[0] === 'C') return { floor: ['#4a3a2c', '#503f30'], wall: '#5a4535', wallTop: '#7a5e48', cliff: '#3b2c20', deco: 'sand', sand: true };
  const ch = Number(key.split('-')[1]) || 0;
  const C = CHAPTERS[ch];
  return { floor: C.floor, wall: C.wall, wallTop: C.wallTop, cliff: ['#2a2016', '#221a2c', '#2b1610'][ch], deco: ['grass', 'bone', 'ember'][ch] };
}
function buildMap(key, level) {
  const rows = mapRowsFor(key, level), th = themeOf(key);
  const c = document.createElement('canvas');
  c.width = VIEW_W; c.height = VIEW_H;
  const g = c.getContext('2d');
  const at = (x, y) => (rows[y] && rows[y][x]) || 'o';
  const solid = (x, y) => at(x, y) !== 'o';
  const isWall = (x, y) => at(x, y) === '#';
  // 절벽면: 바닥 아래가 공허면 흙벽이 아래로 보임
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (solid(x, y) || !solid(x, y - 1)) continue;
    const px = x * TILE, py = y * TILE;
    const gr = g.createLinearGradient(0, py, 0, py + 26);
    gr.addColorStop(0, th.cliff); gr.addColorStop(0.55, 'rgba(20,12,30,.85)'); gr.addColorStop(1, 'rgba(10,6,20,0)');
    g.fillStyle = gr; g.fillRect(px, py, TILE, 26);
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i < 4; i++) g.fillRect(px + 3 + i * 8 + hash(x, i) * 3, py + 2, 2, 8 + hash(i, y) * 8);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(px, py, TILE, 2);
  }
  // 바닥
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!solid(x, y)) continue;
    const px = x * TILE, py = y * TILE;
    g.fillStyle = th.floor[(x + y) % 2];
    g.fillRect(px, py, TILE, TILE);
    const h = hash(x, y);
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.fillRect(px, py + TILE - 1, TILE, 1); g.fillRect(px + TILE - 1, py, 1, TILE);
    g.fillStyle = 'rgba(255,255,255,.035)';
    g.fillRect(px + 1, py + 1, TILE - 3, 1);
    if (h < 0.25) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(px + 6 + h * 40, py + 10 + h * 30, 6, 2); }
    const h2 = hash(x + 9, y + 3);
    if (h2 < 0.12 && at(x, y) === '.') {
      if (th.deco === 'grass') { g.fillStyle = '#3d5a35'; for (let i = 0; i < 3; i++) g.fillRect(px + 8 + i * 4, py + 18 - (i % 2) * 3, 2, 5 + (i % 2) * 3); g.fillStyle = '#e57373'; if (h2 < 0.04) g.fillRect(px + 20, py + 14, 3, 3); }
      else if (th.deco === 'bone') { g.fillStyle = '#9e98b0'; g.fillRect(px + 9, py + 16, 12, 2); g.fillRect(px + 8, py + 15, 2, 4); g.fillRect(px + 20, py + 15, 2, 4); }
      else if (th.deco === 'ember') { g.fillStyle = '#3e1f17'; g.fillRect(px + 6, py + 12, 14, 2); g.fillRect(px + 12, py + 12, 2, 10); g.fillStyle = '#ff7043'; if (h2 < 0.05) g.fillRect(px + 18, py + 20, 2, 2); }
      else if (th.deco === 'sand') { g.fillStyle = 'rgba(255,224,178,.08)'; g.fillRect(px + 4, py + 8, 20, 2); }
    }
    // 가장자리 테두리 (섬처럼 보이게)
    if (!solid(x, y - 1)) { g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(px, py, TILE, 2); }
    if (!solid(x - 1, y)) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px, py, 2, TILE); }
    if (!solid(x + 1, y)) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + TILE - 2, py, 2, TILE); }
    if (!solid(x, y + 1)) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(px, py + TILE - 3, TILE, 3); }
  }
  if (th.sand) {
    g.save(); g.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (at(x, y) === '.' || at(x, y) === 'P') g.rect(x * TILE, y * TILE, TILE, TILE);
    g.clip();
    g.strokeStyle = 'rgba(255,213,79,.09)'; g.lineWidth = 6;
    g.beginPath(); g.arc(VIEW_W / 2, VIEW_H / 2, 150, 0, TAU); g.stroke();
    g.beginPath(); g.arc(VIEW_W / 2, VIEW_H / 2, 60, 0, TAU); g.stroke();
    g.restore();
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
  // 벽 (윗면 + 앞면)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!isWall(x, y)) continue;
    const px = x * TILE, py = y * TILE;
    const front = !isWall(x, y + 1) && y + 1 < ROWS;
    g.fillStyle = th.wallTop; g.fillRect(px, py, TILE, TILE);
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
      if (solid(x, y + 1)) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px, py + TILE, TILE, 6); }
    }
  }
  // 무너질 수 있는 줄의 칸 목록 (경고 연출용)
  const ringTiles = {};
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (solid(x, y)) (ringTiles[ringOf(x, y)] ||= []).push([x, y]);
  return { c, ringTiles, th };
}

// ============================================================
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const P = new Particles();
  const fxList = [];
  const seen = new Set();
  const texts = [];
  const ghosts = [];
  const banners = [];
  const anim = new Map();
  const mapCache = new Map();
  let shake = 0, flash = 0, flashCol = '#fff', punch = 0, dpr = 1, slowmo = 0;
  let lastNow = performance.now();
  let comboPop = 0, lastCombo = 0;
  let curMap = null;
  const hooks = { onFx: null };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== VIEW_W * dpr) { canvas.width = VIEW_W * dpr; canvas.height = VIEW_H * dpr; }
  }
  const ui = {
    number(f) {
      const sz = clamp(15 + f.v * 0.55, 15, 40) * (f.crit ? 1.35 : 1);
      texts.push({ x: f.x + rnd(-8, 8), y: f.y - 14, vx: rnd(-40, 40), vy: -170, text: f.onHero ? `${f.v}%` : f.crit ? `${f.v}!` : String(f.v), size: f.onHero ? sz * 0.85 : sz, color: f.onHero ? '#ff8a80' : f.crit ? '#ffd54f' : f.react ? '#fff59d' : f.el ? elColor(f.el) : '#ffffff', life: 0.8, max: 0.8, pop: 1, grav: 380 });
    },
    react(f) { texts.push({ x: f.x, y: f.y - 34, vx: 0, vy: -50, text: f.name, size: 26, color: f.color, life: 1.1, max: 1.1, pop: 1.6, grav: 0, react: true }); },
    goldPop(f) { texts.push({ x: f.x, y: f.y - 20, vx: 0, vy: -60, text: `+${f.v} G`, size: 18, color: '#ffd54f', life: 1, max: 1, pop: 1, grav: 0 }); },
    heal(f) { if (Math.random() < 0.5) texts.push({ x: f.x + rnd(-8, 8), y: f.y - 10, vx: 0, vy: -50, text: `-${f.v}%`, size: 14, color: '#69f0ae', life: 0.6, max: 0.6, pop: 1, grav: 0 }); },
    say(x, y, text, color, size = 18) { texts.push({ x, y, vx: 0, vy: -45, text, size, color, life: 1.3, max: 1.3, pop: 1.3, grav: 0, react: true }); },
  };

  function ingest(snap, myId) {
    for (const f of snap.fx) {
      const key = snap.rid + ':' + f.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 4000) { const arr = [...seen]; arr.slice(0, 2000).forEach((x) => seen.delete(x)); }
      const copy = { ...f, t: f.life, life: f.life };
      fxList.push(copy);
      spawnFx(copy, P, ui);
      if (f.shake) shake = Math.min(18, shake + f.shake);
      switch (f.k) {
        case 'ko': flash = 0.25; flashCol = '#ffffff'; punch = 0.04; break;
        case 'die': if (f.boss) { flash = 0.4; punch = 0.05; } break;
        case 'hit': if (f.crit) punch = Math.max(punch, 0.015); break;
        case 'react': punch = Math.max(punch, 0.02); break;
        case 'lethal': punch = Math.max(punch, f.hero ? 0.09 : 0.045); slowmo = f.hero ? 0.35 : 0.18; flash = f.hero ? 0.22 : 0.1; flashCol = f.hero ? '#e3f2fd' : '#ffffff'; break;
        case 'cast': anim.set(f.who, { t: performance.now(), i: f.i, type: f.type }); break;
        case 'chapter': banners.push({ text: `${f.ch + 1}장`, sub: f.name, color: '#80d8ff', t: 2.4, max: 2.4 }); break;
        case 'levelup': banners.push({ text: `LEVEL ${f.lv}`, sub: '레벨 업! 증강을 고르세요', color: '#ffd54f', t: 1.8, max: 1.8 }); break;
        case 'pickup': ui.say(f.x, f.y - 20, f.name, f.color, 16); break;
        case 'augpick': { const A = AUGMENTS.find((a) => a.id === f.aug); if (A) ui.say(f.x, f.y - 50, `${A.icon} ${A.name}`, f.legend ? '#ff9100' : '#ffe082', f.legend ? 22 : 18); break; }
        case 'collapse': collapseFx(f.ring); break;
        default:
      }
      hooks.onFx?.(f, myId);
    }
  }
  function collapseFx(ring) {
    const tiles = curMap?.ringTiles[ring] || [];
    const th = curMap?.th;
    for (const [x, y] of tiles) {
      for (let i = 0; i < 2; i++) P.add({ kind: 'rock', x: (x + 0.25 + i * 0.5) * TILE, y: (y + 0.5) * TILE, vx: rnd(-30, 30), vy: rnd(-60, 10), grav: 520, life: rnd(0.7, 1.1), size: rnd(9, 14), color: th ? th.floor[(x + y + i) % 2] : '#555', drag: 0.5, grow: -10 });
      if (Math.random() < 0.4) P.add({ kind: 'smoke', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, vx: rnd(-20, 20), vy: -30, life: 0.8, size: 8, grow: 16, color: '#9e9e9e' });
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
  // 대난투식 % 색: 흰색 → 노랑 → 주황 → 빨강 → 검붉은색
  const pctColor = (p) => {
    const stops = [[0, [255, 255, 255]], [50, [255, 241, 118]], [100, [255, 167, 38]], [150, [255, 61, 0]], [220, [183, 28, 28]], [300, [120, 10, 20]]];
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) {
        const [a0, c0] = stops[i - 1], [a1, c1] = stops[i], k = (p - a0) / (a1 - a0);
        return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',')})`;
      }
    }
    return 'rgb(120,10,20)';
  };
  // 대난투식 숫자: 큰 정수 + 작은 %, 맞으면 흔들리고 커짐
  function pctText(p, x, y, size, pop = 0, align = 'center') {
    const shakeAmt = pop * 4 + (p > 150 ? 0.8 : 0);
    const dx = rnd(-1, 1) * shakeAmt, dy = rnd(-1, 1) * shakeAmt;
    const s = size * (1 + pop * 0.35);
    const col = pctColor(p);
    ctx.font = `${s}px ${FONT}`;
    const w = ctx.measureText(String(p)).width;
    ctx.font = `${s * 0.55}px ${FONT}`;
    const w2 = ctx.measureText('%').width;
    let x0 = align === 'center' ? x - (w + w2) / 2 : align === 'right' ? x - w - w2 : x;
    label(String(p), x0 + dx, y + dy, col, s, { align: 'left', stroke: Math.max(3, s / 4.5) });
    label('%', x0 + w + 1 + dx, y + dy, col, s * 0.55, { align: 'left', stroke: 3 });
  }

  // ---------- 영웅 ----------
  function heroFrame(h, now) {
    if (!h.al) return 14;
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
  function drawHeroSprite(h, frame, x, y, alpha = 1, white = false, lift = 0, scale = 1) {
    const C = CHARS[h.c];
    const sheet = SHEETS.heroes;
    const flip = Math.cos(h.a) < 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - lift);
    if (flip) ctx.scale(-1, 1);
    if (scale !== 1) ctx.scale(scale, scale);
    if (ready(sheet)) ctx.drawImage(white ? whiteOf(sheet) : sheet, frame * HS, C.row * HS, HS, HS, -HD / 2, -HD * 0.792, HD, HD);
    else { ctx.fillStyle = C.color; ctx.fillRect(-10, -26, 20, 30); }
    ctx.restore();
  }
  function statusFx(x, y, st, now, dt, big = 1) {
    if (!st) return;
    const T = now / 1000;
    if (st.includes('b') && Math.random() < dt * 14) P.add({ kind: 'ember', x: x + rnd(-10, 10) * big, y: y + rnd(-14, 4), vx: rnd(-10, 10), vy: -rnd(40, 90), life: 0.5, size: rnd(2, 3.5), color: Math.random() < 0.5 ? '#ff7043' : '#ffab40', drag: 0 });
    if (st.includes('s') && Math.random() < dt * 10) P.add({ kind: 'spark', x: x + rnd(-12, 12) * big, y: y + rnd(-20, 4), vx: rnd(-150, 150), vy: rnd(-150, 150), life: 0.12, size: 2, color: '#fff59d', drag: 0 });
    if (st.includes('w') && Math.random() < dt * 5) P.add({ kind: 'glow', x: x + rnd(-10, 10) * big, y: y - 10, vx: 0, vy: 60, life: 0.4, size: 2, color: '#4fc3f7', drag: 0 });
    const pm = st.match(/p(\d)/);
    if (pm && Math.random() < dt * 6) P.add({ kind: 'glow', x: x + rnd(-10, 10) * big, y: y - 4, vx: 0, vy: -40, life: 0.6, size: 2 + Number(pm[1]) * 0.3, color: '#9ccc65', drag: 0 });
    if (st.includes('c')) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.ellipse(x, y - 12, 15 * big, 20 * big, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (st.includes('f')) {
      ctx.save();
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#b3e5fc';
      ctx.fillRect(x - 18 * big, y - 40 * big, 36 * big, 46 * big);
      ctx.globalAlpha = 0.85; ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 2; ctx.strokeRect(x - 18 * big, y - 40 * big, 36 * big, 46 * big);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 14 * big, y - 36 * big, 4, 22 * big); ctx.fillRect(x - 8 * big, y - 36 * big, 10 * big, 3);
      ctx.restore();
    }
    if (st.includes('m')) {
      ctx.save(); ctx.translate(x, y - 54 * big); ctx.rotate(T * 2);
      ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
      ctx.restore();
    }
    if (pm) label(`☠${pm[1]}`, x + 20 * big, y - 30 * big, '#c5e1a5', 11, { font: 'sans-serif', stroke: 3 });
  }
  function drawHero(h, me, snap, now, dt) {
    if (!h.al) return;
    const C = CHARS[h.c];
    const fall = h.fa > 0 ? clamp(h.fa / 0.6, 0.05, 1) : 1;
    const x = h.x, y = h.y;
    const sc = 1 + (h.sz || 0);
    let lift = 0;
    const A = anim.get(h.id);
    if (h.ds === 'leap' && A) { const k = clamp((now - A.t) / 300, 0, 1); lift = Math.sin(k * Math.PI) * 60; }
    if ((h.ds || h.ro) && Math.random() < 0.7) ghosts.push({ h: { ...h }, frame: heroFrame(h, now), x, y, lift, life: 0.22, max: 0.22, sc });
    // 날아가는 중: 연기 꼬리
    if (h.ln && Math.random() < 0.9) { P.add({ kind: 'smoke', x: x + rnd(-4, 4), y: y - 10 + rnd(-4, 4), vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.6, size: 5, grow: 14, color: '#eceff1', alpha: 0.9 }); }
    ctx.save();
    if (fall < 1) { ctx.translate(x, y); ctx.scale(fall, fall); ctx.rotate((1 - fall) * 6); ctx.translate(-x, -y); }
    // 그림자 + 팀 고리
    ctx.globalAlpha = 0.35 * (1 - lift / 120); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 15 * sc * (1 - lift / 150), 5 * sc, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = h.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 16 * sc, 6 * sc, 0, 0, TAU); ctx.stroke();
    if (h.id === me) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 150); ctx.beginPath(); ctx.ellipse(x, y + 12, 20 * sc, 8 * sc, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // 위험 %: 붉은 기운
    if (h.p >= 120) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const k = 0.25 + 0.2 * Math.sin(now / (h.p >= 180 ? 70 : 140));
      const gr = ctx.createRadialGradient(x, y - 14, 4, x, y - 14, 34 * sc);
      gr.addColorStop(0, `rgba(255,40,30,${k})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 14, 34 * sc, 0, TAU); ctx.fill(); ctx.restore();
      if (Math.random() < dt * 6) P.add({ kind: 'smoke', x: x + rnd(-8, 8), y: y - 20, vx: 0, vy: -40, life: 0.7, size: 3, grow: 8, color: '#5d4037', alpha: 0.6 });
    }
    // 버프 기운
    const bf = h.bf || '';
    if (bf.includes('power') && Math.random() < dt * 14) P.add({ kind: 'ember', x: x + rnd(-14, 14), y: y + rnd(-30, 6), vx: 0, vy: -60, life: 0.5, size: 2.5, color: '#ffd740', drag: 0 });
    if (bf.includes('swift') && (h.mv || h.ro) && Math.random() < dt * 20) P.add({ kind: 'streak', x: x + rnd(-8, 8), y: y + rnd(-24, 8), vx: -Math.cos(h.a) * 140, vy: -Math.sin(h.a) * 40, life: 0.25, size: 2, color: '#69f0ae', drag: 2 });
    if (h.em) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.2 * Math.sin(now / 80); ctx.fillStyle = '#9c64ff'; ctx.beginPath(); ctx.ellipse(x, y - 12, 20, 26, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const blink = h.iv && Math.floor(now / 70) % 2;
    drawHeroSprite(h, heroFrame(h, now), x, y, blink ? 0.45 : 1, false, lift, sc);
    if (h.fl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawHeroSprite(h, heroFrame(h, now), x, y, 0.85, true, lift, sc); ctx.restore(); }
    if (bf.includes('aegis')) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(now / 120); ctx.strokeStyle = '#40c4ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 14, 26 * sc, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#80d8ff'; ctx.fill(); ctx.restore();
    }
    statusFx(x, y - lift, h.st, now, dt, sc);
    if (h.sn) for (let i = 0; i < 3; i++) { const a = now / 150 + (i * TAU) / 3; label('★', x + Math.cos(a) * 12, y - 48 + Math.sin(a) * 4, '#fff59d', 11, { font: 'sans-serif', stroke: 2 }); }
    ctx.restore();
    // 수호 구체 (증강)
    if (h.ob) {
      const t = snap.t + (now - lastSnapT) / 1000;
      for (let i = 0; i < h.ob; i++) {
        const a = t * 3.2 + (i * TAU) / h.ob, ox = x + Math.cos(a) * 48, oy = y - 6 + Math.sin(a) * 48;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, 14);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, h.ob >= 4 ? '#ffd740' : '#80d8ff'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ox, oy, 14, 0, TAU); ctx.fill(); ctx.restore();
        if (Math.random() < dt * 20) P.add({ kind: 'glow', x: ox, y: oy, vx: 0, vy: 0, life: 0.25, size: 2, color: h.ob >= 4 ? '#ffd740' : '#80d8ff', drag: 0 });
      }
    }
    if (h.fa > 0) return;
    // 이름 · %
    label(h.n, x, y - 56 * sc - lift, h.col, 12, { font: 'sans-serif', stroke: 3 });
    pctText(h.p, x, y + 36, 17, h.hp_ || 0);
    if (h.cho && h.id !== me) label('증강 고르는 중…', x, y - 70, '#ffe082', 11, { font: 'sans-serif', stroke: 3 });
  }

  // ---------- 적 ----------
  function drawEnemy(e, now, dt) {
    const [id, type, x, y, hp, mh, fall, fl, face, st, spawning, z, boss, act, actA, ln] = e;
    const sc = fall > 0 ? clamp(fall / 0.6, 0.05, 1) : 1;
    if (ln && Math.random() < 0.8) P.add({ kind: 'smoke', x: x + rnd(-4, 4), y: y - 6, vx: 0, vy: 0, life: 0.5, size: 4, grow: 12, color: '#e0e0e0', alpha: 0.8 });
    ctx.save();
    if (sc < 1) { ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate((1 - sc) * 5); ctx.translate(-x, -y); }
    if (spawning) ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 40);
    if (boss) {
      const B = BOSSES[type];
      const R = B.r;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, y + R * 0.7, R * 1.1 * (1 - z / 200), R * 0.4, 0, 0, TAU); ctx.fill();
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
      if (act === 'laser') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const ca = Math.cos(actA), sa = Math.sin(actA);
        for (const [w, c, a] of [[34, '#ff1744', 0.35], [16, '#ff8a80', 0.8], [6, '#ffffff', 1]]) { ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + ca * 20, y - 14 + sa * 20); ctx.lineTo(x + ca * 640, y - 14 + sa * 640); ctx.stroke(); }
        if (Math.random() < 0.6) P.add({ kind: 'spark', x: x + ca * rnd(40, 600), y: y - 14 + sa * rnd(40, 600), vx: rnd(-200, 200), vy: rnd(-200, 200), life: 0.2, size: 3, color: '#ff8a80' });
        ctx.restore();
      }
      statusFx(x, y, st, now, dt, 2);
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
      statusFx(x, y, st, now, dt);
      if (hp < mh && !spawning) {
        const w = Math.max(24, E.r * 2.2), k = clamp(hp / mh, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2 - 1, y - S * 0.68 - 6, w + 2, 5);
        ctx.fillStyle = '#ef5350'; ctx.fillRect(x - w / 2, y - S * 0.68 - 5, w * k, 3);
      }
    }
    ctx.restore();
  }

  // ---------- 상자 · 아이템 ----------
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
  // 아이템 그림 (작은 도트 아이콘을 직접 그림)
  function itemIcon(kind, x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const px = (c, x0, y0, w, h) => { ctx.fillStyle = c; ctx.fillRect(x0, y0, w, h); };
    switch (kind) {
      case 'potion': case 'bigpotion': {
        const big = kind === 'bigpotion', liq = big ? '#ec407a' : '#ef5350', w = big ? 14 : 10, h = big ? 14 : 11;
        px('#1a0d14', -w / 2 - 1, -h / 2, w + 2, h + 2);
        px('#e1f5fe', -w / 2, -h / 2 + 1, w, h);
        px(liq, -w / 2, -h / 2 + 4, w, h - 3);
        px('#ffffff', -w / 2 + 2, -h / 2 + 3, 2, 3);
        px('#1a0d14', -3, -h / 2 - 5, 6, 6); px('#e1f5fe', -2, -h / 2 - 4, 4, 4); px('#a1887f', -3, -h / 2 - 7, 6, 3);
        break;
      }
      case 'heart':
        ctx.fillStyle = '#1a0d14';
        ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(-10, -1); ctx.arc(-5, -3, 5.5, Math.PI, 0); ctx.arc(5, -3, 5.5, Math.PI, 0); ctx.lineTo(10, -1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff5252';
        ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(-8, -1); ctx.arc(-4.5, -3, 4.2, Math.PI, 0); ctx.arc(4.5, -3, 4.2, Math.PI, 0); ctx.lineTo(8, -1); ctx.closePath(); ctx.fill();
        px('#ffcdd2', -6, -5, 3, 2);
        break;
      case 'crystal':
        ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, -2); ctx.lineTo(0, 11); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd740'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6, -2); ctx.lineTo(0, 9); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-6, -2); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
        break;
      case 'boots':
        px('#1b2e1f', -7, -9, 9, 16); px('#1b2e1f', -7, 3, 15, 6);
        px('#43a047', -6, -8, 7, 13); px('#43a047', -6, 4, 13, 4); px('#69f0ae', -5, -7, 2, 10);
        px('#e8f5e9', 2, -9, 6, 2); px('#e8f5e9', 4, -6, 5, 2);
        break;
      case 'aegis':
        ctx.fillStyle = '#0d1b2a'; ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(9, 1); ctx.lineTo(0, 11); ctx.lineTo(-9, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#29b6f6'; ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(7, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
        px('#e1f5fe', -1, -6, 2, 12); px('#e1f5fe', -5, -2, 10, 2);
        break;
      case 'goldbag':
        ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.ellipse(0, 3, 10, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#a1887f'; ctx.beginPath(); ctx.ellipse(0, 3, 8.5, 6.5, 0, 0, TAU); ctx.fill();
        px('#3e2723', -4, -8, 8, 5); px('#a1887f', -3, -7, 6, 3); px('#6d4c41', -5, -4, 10, 2);
        px('#ffca28', -3, 1, 6, 6); px('#fff59d', -2, 2, 2, 2);
        break;
      default:
    }
    ctx.restore();
  }
  function drawItem(it, now) {
    const [id, kind, x, y, z, t] = it;
    if (t < 3 && Math.floor(now / 110) % 2) return;
    const I = ITEMS[kind];
    const bob = Math.sin(now / 250 + id) * 3;
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + 8, 10 - z / 20, 3.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y - 6 - z + bob, 0, x, y - 6 - z + bob, 22);
    gr.addColorStop(0, I.color + '99'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 6 - z + bob, 22, 0, TAU); ctx.fill();
    ctx.restore();
    itemIcon(kind, x, y - 8 - z + bob, 1.1);
    if (Math.random() < 0.05) P.add({ kind: 'glow', x: x + rnd(-8, 8), y: y - 10 - z, vx: 0, vy: -20, life: 0.6, size: 2, color: I.color, drag: 0 });
  }

  // ---------- HUD ----------
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function bust(char, x, y, size, gray = false) {
    if (ready(SHEETS.busts)) {
      ctx.save(); if (gray) ctx.filter = 'grayscale(1) brightness(.6)';
      ctx.drawImage(SHEETS.busts, CHAR_KEYS.indexOf(char) * PS, 0, PS, PS, x, y, size, size);
      ctx.restore();
    } else if (ready(SHEETS.heroes)) ctx.drawImage(SHEETS.heroes, 0, CHARS[char].row * HS, HS, HS * 0.6, x, y, size, size * 0.6);
  }
  function drawHud(snap, me, now) {
    const meH = snap.h.find((h) => h.id === me);
    // 위 왼쪽: 진행 상황
    ctx.fillStyle = 'rgba(8,6,18,.62)';
    roundRect(10, 10, 300, 34, 8); ctx.fill();
    if (snap.sto) {
      const S = snap.sto;
      label(`${S.ch + 1}-${S.st + 1} ${CHAPTERS[S.ch].name}`, 20, 33, '#ffffff', 16, { align: 'left' });
      for (let i = 0; i < S.tw; i++) {
        const done = i < S.w || S.ph === 'clear' || S.ph === 'done', cur = i === S.w && S.ph === 'fight';
        ctx.fillStyle = done ? '#ffd54f' : cur ? '#ff7043' : 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.arc(200 + i * 16, 27, cur ? 5 + Math.sin(now / 120) : 5, 0, TAU); ctx.fill();
      }
      label(`${snap.g} G`, 300, 33, '#ffd54f', 15, { align: 'right' });
      // 레벨 · 경험치
      ctx.fillStyle = 'rgba(8,6,18,.62)'; roundRect(10, 48, 300, 18, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(60, 54, 242, 6);
      const k = clamp(snap.xp / snap.xn, 0, 1);
      const gr = ctx.createLinearGradient(60, 0, 302, 0); gr.addColorStop(0, '#7c4dff'); gr.addColorStop(1, '#00e5ff');
      ctx.fillStyle = gr; ctx.fillRect(60, 54, 242 * k, 6);
      label(`Lv ${snap.lv}`, 18, 63, '#b388ff', 13, { align: 'left' });
    } else if (snap.col) {
      label(`콜로세움 · ${snap.col.name}`, 20, 33, '#ffd54f', 16, { align: 'left' });
    }
    // 아래쪽 가운데: 대난투식 플레이어 패널 (얼굴 · 큰 % · 목숨)
    const list = snap.h;
    const pw = list.length >= 4 ? 128 : 150, gap = 6;
    let px = 10;
    const py = VIEW_H - 62;
    list.forEach((h) => {
      const danger = h.p >= 120 && h.al;
      ctx.save();
      const gr = ctx.createLinearGradient(0, py, 0, py + 54);
      gr.addColorStop(0, h.id === me ? 'rgba(40,30,72,.88)' : 'rgba(14,10,28,.8)'); gr.addColorStop(1, 'rgba(6,4,14,.88)');
      ctx.fillStyle = gr; roundRect(px, py, pw, 54, 10); ctx.fill();
      ctx.strokeStyle = danger ? `rgba(255,60,40,${0.6 + 0.4 * Math.sin(now / 90)})` : h.col; ctx.lineWidth = h.id === me ? 3 : 2; roundRect(px, py, pw, 54, 10); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.beginPath(); roundRect(px + 4, py + 4, 46, 46, 8); ctx.clip();
      ctx.fillStyle = h.col + '33'; ctx.fillRect(px + 4, py + 4, 46, 46);
      bust(h.c, px + 1, py + 2, 52, !h.al);
      ctx.restore();
      label(h.n, px + 56, py + 16, h.col, 12, { align: 'left', font: 'sans-serif', stroke: 3 });
      if (h.al) pctText(h.p, px + pw - 8, py + 46, 26, h.hp_ || 0, 'right');
      else label(h.out ? '탈락' : `${Math.ceil(h.rs)}초`, px + pw - 10, py + 44, '#90a4ae', 18, { align: 'right' });
      // 목숨: 작은 하트
      for (let i = 0; i < Math.min(6, h.sk); i++) itemIcon('heart', px + 61 + i * 12, py + 30, 0.5);
      if (h.sk > 6) label(`+${h.sk - 6}`, px + 61 + 6 * 12, py + 34, '#ff8a80', 10, { align: 'left', font: 'sans-serif', stroke: 2 });
      // 대시 충전
      for (let i = 0; i < (h.dm || 1); i++) { ctx.fillStyle = i < h.dc ? '#80deea' : 'rgba(255,255,255,.15)'; ctx.fillRect(px + 56 + i * 9, py + 42, 7, 3); }
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
    // 내 증강 아이콘 (오른쪽 위)
    if (meH?.au?.length) {
      const counts = {};
      meH.au.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      let ax = VIEW_W - 60, ay = 58;
      for (const [id, n] of Object.entries(counts)) {
        const A = AUGMENTS.find((a) => a.id === id);
        if (!A) continue;
        ctx.fillStyle = A.tier === 2 ? 'rgba(255,145,0,.35)' : 'rgba(8,6,18,.6)'; roundRect(ax - 13, ay - 15, 26, 26, 6); ctx.fill();
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(A.icon, ax, ay + 4);
        if (n > 1) label(`${n}`, ax + 10, ay + 10, '#ffe082', 10, { font: 'sans-serif', stroke: 2 });
        ax -= 30; if (ax < VIEW_W - 300) { ax = VIEW_W - 60; ay += 30; }
      }
    }
    // 콤보
    if (meH && meH.cb >= 3) {
      if (meH.cb !== lastCombo) comboPop = 1;
      const s = 1 + comboPop * 0.35;
      ctx.save(); ctx.translate(VIEW_W - 90, 190); ctx.scale(s, s); ctx.rotate(-0.08);
      const col = meH.cb >= 50 ? '#ff1744' : meH.cb >= 25 ? '#ff9100' : meH.cb >= 10 ? '#ffd54f' : '#ffffff';
      label(String(meH.cb), 0, 0, col, 46);
      label('COMBO', 0, 22, '#ffe0b2', 16);
      ctx.restore();
    }
    lastCombo = meH ? meH.cb : 0;
    // 큰 알림 (레벨 업 등)
    for (const b of banners) {
      const k = b.t / b.max, e = 1 - k;
      const s = e < 0.15 ? 0.6 + (e / 0.15) * 0.5 : 1.1 - Math.min(0.1, (e - 0.15));
      ctx.save(); ctx.globalAlpha = clamp(k * 3, 0, 1); ctx.translate(VIEW_W / 2, 250); ctx.scale(s, s);
      const gr = ctx.createLinearGradient(-260, 0, 260, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, 'rgba(30,16,60,.85)'); gr.addColorStop(0.8, 'rgba(30,16,60,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(-260, -46, 520, 74);
      label(b.text, 0, 0, b.color, 46, { strokeColor: '#2a1050', stroke: 8 });
      label(b.sub, 0, 22, '#ffffff', 15);
      ctx.restore();
    }
    if (snap.msg) {
      ctx.font = `24px ${FONT}`;
      const w = ctx.measureText(snap.msg).width + 60;
      const y = 140;
      const gr = ctx.createLinearGradient((VIEW_W - w) / 2, 0, (VIEW_W + w) / 2, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.15, 'rgba(8,6,18,.8)'); gr.addColorStop(0.85, 'rgba(8,6,18,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect((VIEW_W - w) / 2, y - 28, w, 40);
      label(snap.msg, VIEW_W / 2, y, '#ffffff', 24);
    }
    if (meH && !meH.al && !meH.out && meH.sk > 0) label(`다시 등장까지 ${Math.ceil(meH.rs)}초`, VIEW_W / 2, VIEW_H / 2, '#ffffff', 28);
    if (meH?.out) label('탈락 — 다음 스테이지에서 돌아와요', VIEW_W / 2, VIEW_H / 2, '#cfd8dc', 22);
    if (snap.col?.over) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, VIEW_H / 2 - 60, VIEW_W, 100);
      label('승리!', VIEW_W / 2, VIEW_H / 2 - 8, '#ffd54f', 52);
      label(snap.col.win || '', VIEW_W / 2, VIEW_H / 2 + 28, '#ffffff', 20);
    }
  }

  // ============================================================
  let lastSnapT = performance.now(), lastSnapTime = -1;
  function render(snap, me, opt = {}) {
    resize();
    const now = performance.now();
    if (snap.t !== lastSnapTime) { lastSnapTime = snap.t; lastSnapT = now; }
    let dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    ingest(snap, me);
    if (slowmo > 0) { slowmo -= dt; dt *= 0.35; } // KO 확정: 입자도 느리게
    if (opt.frozen) dt *= 0.15;
    P.update(dt);
    for (const f of fxList) f.t -= dt;
    for (let i = fxList.length - 1; i >= 0; i--) if (fxList[i].t <= 0) fxList.splice(i, 1);
    for (const g of ghosts) g.life -= dt;
    for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].life <= 0) ghosts.splice(i, 1);
    for (const t of texts) { t.life -= dt; t.vy += t.grav * dt; t.x += t.vx * dt; t.y += t.vy * dt; t.pop = Math.max(0, t.pop - dt * 6); }
    for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
    for (const b of banners) b.t -= dt;
    for (let i = banners.length - 1; i >= 0; i--) if (banners[i].t <= 0) banners.splice(i, 1);
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt);
    punch = Math.max(0, punch - dt * 0.25);
    comboPop = Math.max(0, comboPop - dt * 5);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawVoid(ctx, now);
    const sx = (Math.random() * 2 - 1) * shake * (opt.shakeMul ?? 1), sy = (Math.random() * 2 - 1) * shake * (opt.shakeMul ?? 1);
    const z = 1 + punch;
    // 확대는 KO 확정 대상 쪽으로
    const lethal = fxList.find((f) => f.k === 'lethal' && f.t > f.life - 0.3);
    const cx = lethal ? lethal.x : VIEW_W / 2, cy = lethal ? lethal.y : VIEW_H / 2;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (sx - cx * (z - 1)), dpr * (sy - cy * (z - 1)));
    // 지도 (무너진 단계별로 캐시)
    const [level, warnRing, warnT] = snap.cl || [1, 0, 0];
    if (snap.mk) {
      const key = snap.mk + '|' + level;
      if (!mapCache.has(key)) { if (mapCache.size > 24) mapCache.clear(); mapCache.set(key, buildMap(snap.mk, level)); }
      curMap = mapCache.get(key);
      ctx.drawImage(curMap.c, 0, 0);
      // 무너지기 직전 줄: 흔들리고 금이 감
      if (warnT > 0 && curMap.ringTiles[warnRing]) {
        const amp = 1 + (1 - warnT / 2.2) * 2.5;
        for (const [x, y] of curMap.ringTiles[warnRing]) {
          const ox = rnd(-amp, amp), oy = rnd(-amp, amp);
          ctx.clearRect(x * TILE, y * TILE, TILE, TILE);
          drawVoidTile(x, y, now);
          ctx.drawImage(curMap.c, x * TILE, y * TILE, TILE, TILE, x * TILE + ox, y * TILE + oy, TILE, TILE);
          ctx.fillStyle = `rgba(255,40,30,${0.12 + 0.12 * Math.sin(now / 60)})`; ctx.fillRect(x * TILE + ox, y * TILE + oy, TILE, TILE);
          ctx.strokeStyle = 'rgba(20,8,8,.7)'; ctx.lineWidth = 1.5;
          const hsh = Math.sin(x * 12.9 + y * 78.2) * 43758.5; const r1 = hsh - Math.floor(hsh);
          ctx.beginPath(); ctx.moveTo(x * TILE + 4 + r1 * 10 + ox, y * TILE + 3 + oy); ctx.lineTo(x * TILE + 16 + ox, y * TILE + 14 + oy); ctx.lineTo(x * TILE + 10 + r1 * 14 + ox, y * TILE + 29 + oy); ctx.moveTo(x * TILE + 16 + ox, y * TILE + 14 + oy); ctx.lineTo(x * TILE + 28 + ox, y * TILE + 10 + r1 * 8 + oy); ctx.stroke();
          if (Math.random() < 0.03) P.add({ kind: 'rock', x: (x + Math.random()) * TILE, y: (y + 1) * TILE, vx: 0, vy: 20, grav: 400, life: 0.6, size: 3, color: '#6d4c41' });
        }
      }
    }
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
    const bodies = [];
    for (const e of snap.e) bodies.push({ y: e[3], d: () => drawEnemy(e, now, dt) });
    for (const h of snap.h) bodies.push({ y: h.y, d: () => drawHero(h, me, snap, now, dt) });
    for (const it of snap.it || []) bodies.push({ y: it[3], d: () => drawItem(it, now) });
    if (snap.sto?.chest) bodies.push({ y: snap.sto.chest.y, d: () => drawChest(snap.sto.chest, now) });
    for (const f of fxList) if (f.k === 'pillar') bodies.push({ y: f.y + 2, d: () => drawFx(ctx, f, now) });
    bodies.sort((a, b) => a.y - b.y);
    for (const g of ghosts) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawHeroSprite(g.h, g.frame, g.x, g.y, (g.life / g.max) * 0.5, true, g.lift, g.sc);
      ctx.restore();
    }
    for (const b of bodies) b.d();
    drawReticle(snap, opt.target, now, dt);
    P.draw(ctx, 'normal');
    for (const sh of snap.s) drawShot(ctx, sh, now, P, dt);
    for (const f of fxList) if (!groundFx.has(f.k) && f.k !== 'pillar') drawFx(ctx, f, now);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; P.draw(ctx, 'add'); ctx.restore();
    for (const t of texts) {
      const k = t.life / t.max;
      ctx.save();
      ctx.globalAlpha = clamp(k * 2.5, 0, 1);
      ctx.translate(t.x, t.y);
      const s = 1 + t.pop * (t.react ? 0.5 : 0.6);
      ctx.scale(s, s);
      if (t.react) label(t.text, 0, 0, t.color, t.size, { strokeColor: '#1a0b2e', stroke: 7 });
      else label(t.text, 0, 0, t.color, t.size);
      ctx.restore();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 땅 흔들림 경고: 화면 가장자리 붉게
    if (warnT > 0) {
      const a = 0.18 + 0.12 * Math.sin(now / 80);
      const g1 = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      g1.addColorStop(0, 'rgba(255,0,0,0)'); g1.addColorStop(1, `rgba(255,30,20,${a})`);
      ctx.fillStyle = g1; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (flash > 0) { ctx.globalAlpha = clamp(flash * 3, 0, 0.7); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = 1; }
    const meH = snap.h.find((h) => h.id === me);
    if (meH && meH.al && opt.aim) {
      const ax = meH.x + Math.cos(meH.a) * 38, ay = meH.y - 10 + Math.sin(meH.a) * 38;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(meH.a);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5); ctx.fill();
      ctx.restore();
    }
    if (!opt.noHud) drawHud(snap, me, now);
  }
  // 조준경: 지금 스킬이 겨누는 적. 대상이 바뀌면 크게 돌며 좁혀 들어와 '잠금'
  let retKey = '', retT = 0;
  function drawReticle(snap, t, now, dt) {
    if (!t) { retKey = ''; return; }
    const key = t.k + t.id;
    if (key !== retKey) { retKey = key; retT = 0; }
    retT += dt;
    // 대상의 지금 위치 (보간된 화면 위치)
    let x = t.x, y = t.y, r = 14, boss = false;
    if (t.k === 'e') { const e = snap.e.find((u) => u[0] === t.id); if (!e) return; x = e[2]; y = e[3]; boss = !!e[12]; r = boss ? BOSSES[e[1]].r : ENEMIES[e[1]].r; }
    else { const h = snap.h.find((u) => u.id === t.id); if (!h) return; x = h.x; y = h.y; }
    y -= boss ? r * 0.6 : 8;
    const lock = Math.min(1, retT / 0.18);
    const R = (r + 10) * (1 + (1 - lock) * 1.2) + Math.sin(now / 160) * 1.5;
    const rot = (1 - lock) * 2.2 + now / 900;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.35 + 0.6 * lock;
    // 바깥 꺾쇠 4개
    ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2.5; ctx.lineCap = 'square';
    ctx.rotate(rot);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(R, -R * 0.45); ctx.lineTo(R, -R); ctx.lineTo(R * 0.45, -R); ctx.stroke();
    }
    ctx.rotate(-rot);
    // 안쪽 원 + 십자선
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(dx * R * 0.35, dy * R * 0.35); ctx.lineTo(dx * R * 0.75, dy * R * 0.75); }
    ctx.stroke();
    ctx.fillStyle = '#ff5252'; ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
  }
  function drawVoidTile(x, y, now) {
    if (!nebula) nebula = buildNebula();
    ctx.drawImage(nebula, x * TILE, y * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }
  function reset() { P.list.length = 0; fxList.length = 0; texts.length = 0; ghosts.length = 0; banners.length = 0; shake = 0; flash = 0; slowmo = 0; }
  return { render, hooks, particles: P, resize, reset };
}
