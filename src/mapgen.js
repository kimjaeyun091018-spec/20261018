// ============================================================
//  지도 만들기 · 지도 변형
//  · 스토리 스테이지마다 벽·구덩이·가시를 무작위로 배치 (모든 바닥이 이어지게 검사)
//  · 땅 모양(fp: 바닥이 있는 사각형)이 시간에 따라 줄고·늘고·가로↔세로로 뒤집힘
// ============================================================
import { COLS, ROWS } from './data.js';

const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 가운데 4x4는 늘 남겨 둠 (클리어 후 문이 솟아나는 자리)
export const CORE = { x0: 13, x1: 16, y0: 8, y1: 11 };
const IN = { x0: 1, x1: COLS - 2, y0: 1, y1: ROWS - 2 }; // 바깥 한 줄은 늘 공허

const fpW = (f) => f.x1 - f.x0 + 1;
const fpH = (f) => f.y1 - f.y0 + 1;
export const inFp = (f, x, y) => x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1;
const holdsCore = (f) => f.x0 <= CORE.x0 && f.x1 >= CORE.x1 && f.y0 <= CORE.y0 && f.y1 >= CORE.y1;
const insideIn = (f) => f.x0 >= IN.x0 && f.x1 <= IN.x1 && f.y0 >= IN.y0 && f.y1 <= IN.y1;
// 크기(w,h)를 가운데 둘레로 놓기 (약간 흔들어서)
function centered(w, h, jitter = 1) {
  w = Math.min(w, IN.x1 - IN.x0 + 1); h = Math.min(h, IN.y1 - IN.y0 + 1);
  for (let i = 0; i < 20; i++) {
    const x0 = Math.round(15 - w / 2) + rint(-jitter, jitter), y0 = Math.round(10 - h / 2) + rint(-jitter, jitter);
    const f = { x0: Math.max(IN.x0, Math.min(x0, IN.x1 - w + 1)), y0: Math.max(IN.y0, Math.min(y0, IN.y1 - h + 1)) };
    f.x1 = f.x0 + w - 1; f.y1 = f.y0 + h - 1;
    if (holdsCore(f)) return f;
  }
  const f = { x0: Math.round(15 - w / 2), y0: Math.round(10 - h / 2) };
  f.x1 = f.x0 + w - 1; f.y1 = f.y0 + h - 1;
  return f;
}

// ---------- 스토리 지도 ----------
const SHAPES = {
  wall: [[2, 2], [1, 3], [3, 1], [2, 1], [1, 2], [4, 1], [1, 4], [3, 2]],
  pit: [[2, 2], [2, 1], [1, 2], [3, 2], [2, 3], [3, 1], [1, 3]],
  spike: [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3]],
};
export function genStoryMap(ch, boss) {
  for (let tryN = 0; tryN < 60; tryN++) {
    const ease = tryN > 30 ? 0.5 : 1; // 잘 안 되면 장애물을 줄여서
    let fp;
    if (boss) fp = centered(rint(25, 28), rint(16, 18), 0);
    else {
      const kind = pick(['wide', 'wide', 'tall', 'square']);
      fp = kind === 'wide' ? centered(rint(23, 27), rint(12, 14)) : kind === 'tall' ? centered(rint(14, 17), rint(16, 18)) : centered(rint(19, 22), rint(14, 16));
    }
    const g = [];
    for (let y = 0; y < ROWS; y++) { g.push([]); for (let x = 0; x < COLS; x++) g[y].push(inFp(fp, x, y) ? '.' : 'o'); }
    // 비워 둘 곳: 가운데(문·상자), 시작 자리
    const cy = Math.round((fp.y0 + fp.y1) / 2);
    const reserve = (x, y) => (x >= CORE.x0 - 1 && x <= CORE.x1 + 1 && y >= CORE.y0 - 1 && y <= CORE.y1 + 2) || (x <= fp.x0 + 3 && Math.abs(y - cy) <= 2);
    const area = fpW(fp) * fpH(fp);
    const k = (area / 320) * ease;
    const counts = boss
      ? { wall: rint(1, 3), pit: rint(2, 3), spike: rint(2, 3) }
      : { wall: Math.round(rint(3, 5) * k + ch), pit: Math.round(rint(2, 3) * k + ch * 0.7), spike: Math.round(rint(2, 3) * k + ch * 0.7) };
    const mark = { wall: '#', pit: 'o', spike: '^' };
    for (const type of ['pit', 'wall', 'spike']) {
      let placed = 0;
      for (let a = 0; a < 200 && placed < counts[type]; a++) {
        let [w, h] = pick(SHAPES[type]);
        if (boss && type === 'pit') [w, h] = pick([[2, 1], [1, 2], [2, 2]]);
        const x = rint(fp.x0 + 1, fp.x1 - w), y = rint(fp.y0 + 1, fp.y1 - h);
        let ok = true;
        // 한 칸 여유를 두고 다른 것과 겹치지 않게 (가장자리에도 한 칸 여유)
        for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) {
          if (!inFp(fp, xx, yy) || g[yy][xx] !== '.') ok = false;
          else if (yy >= y && yy < y + h && xx >= x && xx < x + w && reserve(xx, yy)) ok = false;
        }
        if (!ok) continue;
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy][xx] = mark[type];
        placed++;
      }
    }
    // 시작 자리
    for (let i = -1; i <= 1; i++) g[cy + i][fp.x0 + 1] = 'P';
    if (!connected(g)) continue;
    return { rows: g.map((r) => r.join('')), fp };
  }
  // 실패하면 빈 판
  const fp = centered(24, 14, 0);
  const rows = [];
  for (let y = 0; y < ROWS; y++) { let r = ''; for (let x = 0; x < COLS; x++) r += inFp(fp, x, y) ? (x === fp.x0 + 1 && Math.abs(y - 10) <= 1 ? 'P' : '.') : 'o'; rows.push(r); }
  return { rows, fp };
}
// 걸을 수 있는 칸(바닥·가시·시작)이 모두 이어져 있는가
function connected(g) {
  const walk = (c) => c === '.' || c === '^' || c === 'P';
  let total = 0, start = null;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (walk(g[y][x])) { total++; start ||= [x, y]; }
  if (!start) return false;
  const seen = new Set([start[1] * COLS + start[0]]), q = [start];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy, key = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen.has(key) || !walk(g[ny][nx])) continue;
      seen.add(key); q.push([nx, ny]);
    }
  }
  return seen.size === total;
}
// 손으로 만든 지도 → 바닥이 있는 사각형
export function fpOf(tiles) {
  const f = { x0: COLS, y0: ROWS, x1: 0, y1: 0 };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (tiles[y][x] !== 'o') { f.x0 = Math.min(f.x0, x); f.x1 = Math.max(f.x1, x); f.y0 = Math.min(f.y0, y); f.y1 = Math.max(f.y1, y); }
  if (f.x1 < f.x0) return { ...CORE };
  return f;
}

// ---------- 지도 변형 ----------
// 지금 땅 모양(fp)에서 다음 모양을 고름. { kind, fp, msg }
export function planShift(fp, n) {
  const w = fpW(fp), h = fpH(fp), area = w * h;
  const opts = [];
  const add = (kind, f, weight, msg) => { if (f && insideIn(f) && holdsCore(f) && fpW(f) >= 8 && fpH(f) >= 8 && !sameFp(f, fp)) opts.push([{ kind, fp: f, msg }, weight]); };
  // 1) 바깥 한 줄씩
  add('shrink', { x0: fp.x0 + 1, x1: fp.x1 - 1, y0: fp.y0 + 1, y1: fp.y1 - 1 }, area > 260 ? 2 : area > 150 ? 1.2 : 0.4, '⚠ 바깥 땅이 흔들린다!');
  // 2) 한쪽이 크게 떨어져 나감 (긴 쪽)
  const cutK = rint(3, 5);
  if (w >= h) {
    add('cut', { ...fp, x0: fp.x0 + cutK }, area > 200 ? 1.6 : 0.6, '⚠ 왼쪽 땅이 크게 무너진다!');
    add('cut', { ...fp, x1: fp.x1 - cutK }, area > 200 ? 1.6 : 0.6, '⚠ 오른쪽 땅이 크게 무너진다!');
  } else {
    add('cut', { ...fp, y0: fp.y0 + cutK }, area > 200 ? 1.6 : 0.6, '⚠ 위쪽 땅이 크게 무너진다!');
    add('cut', { ...fp, y1: fp.y1 - cutK }, area > 200 ? 1.6 : 0.6, '⚠ 아래쪽 땅이 크게 무너진다!');
  }
  // 3) 가로 ↔ 세로 뒤집기: 양옆이 무너지고 위아래로 땅이 솟음 (또는 반대)
  if (w >= h + 3) add('pivot', centeredAround(fp, Math.max(10, Math.min(h, 15)), Math.min(18, Math.max(w - 6, h + 4))), 2.2, '⚠ 땅이 뒤틀린다! 양옆이 무너지고 위아래로 솟아오른다!');
  if (h >= w + 3) add('pivot', centeredAround(fp, Math.min(28, Math.max(h + 6, w + 6)), Math.max(10, Math.min(w, 13))), 2.2, '⚠ 땅이 뒤틀린다! 위아래가 무너지고 양옆으로 솟아오른다!');
  // 4) 넓어짐: 한두 방향으로 땅이 솟음
  const growK = rint(2, 4);
  const grow = [
    ['x0', -growK, '왼쪽'], ['x1', growK, '오른쪽'], ['y0', -growK, '위쪽'], ['y1', growK, '아래쪽'],
  ];
  const growW = area < 160 ? 2.6 : area < 280 ? 1.3 : 0.4;
  for (const [key, d, name] of grow) {
    const f = { ...fp };
    f[key] = d < 0 ? Math.max(IN[key], fp[key] + d) : Math.min(IN[key], fp[key] + d);
    add('grow', f, growW, `✦ ${name}으로 새 땅이 솟아오른다!`);
  }
  add('grow', { x0: Math.max(IN.x0, fp.x0 - 2), x1: Math.min(IN.x1, fp.x1 + 2), y0: Math.max(IN.y0, fp.y0 - 2), y1: Math.min(IN.y1, fp.y1 + 2) }, growW * 0.7, '✦ 사방으로 땅이 넓어진다!');
  if (!opts.length) return null;
  // 오래 버틸수록 줄어드는 쪽으로
  if (n >= 6) for (const o of opts) if (o[0].kind === 'shrink' || o[0].kind === 'cut') o[1] *= 1.8;
  const tot = opts.reduce((a, o) => a + o[1], 0);
  let r = Math.random() * tot;
  for (const [o, wgt] of opts) { r -= wgt; if (r <= 0) return o; }
  return opts[0][0];
}
const sameFp = (a, b) => a.x0 === b.x0 && a.x1 === b.x1 && a.y0 === b.y0 && a.y1 === b.y1;
function centeredAround(fp, w, h) {
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  let x0 = Math.round(cx - (w - 1) / 2), y0 = Math.round(cy - (h - 1) / 2);
  x0 = Math.max(IN.x0, Math.min(x0, IN.x1 - w + 1)); y0 = Math.max(IN.y0, Math.min(y0, IN.y1 - h + 1));
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
}
// 옛 모양 → 새 모양: 무너질 칸과 솟아날 칸
export function shiftTiles(tiles, from, to) {
  const fall = [], rise = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const a = inFp(from, x, y), b = inFp(to, x, y);
    if (a && !b && tiles[y][x] !== 'o') fall.push(y * COLS + x);
    else if (!a && b && tiles[y][x] === 'o') rise.push(y * COLS + x);
  }
  return { fall, rise };
}
