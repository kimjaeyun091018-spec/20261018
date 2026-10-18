// ============================================================
//  원소 아레나 — 기술 이펙트 · 투사체 · 지대 · 입자
//  (빛나는 부분은 'lighter' 덧셈 합성 + 미리 만든 빛 무늬로 가볍게 그림)
// ============================================================
import { ELEMENTS } from './data.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeOut3 = (k) => 1 - (1 - k) ** 3;
export const elColor = (el) => (ELEMENTS[el] ? ELEMENTS[el].color : '#ffffff');
export const elGlow = (el) => (ELEMENTS[el] ? ELEMENTS[el].glow : '#ffffff');

// ---------- 빛 무늬 (가운데 밝은 원) ----------
const glowCache = new Map();
function glowTex(color, hard = 0) {
  const key = color + hard;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(hard ? 0.45 : 0.15, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}
function glow(ctx, x, y, r, color, a = 1, hard = 0) {
  if (r <= 0 || a <= 0) return;
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.drawImage(glowTex(color, hard), x - r, y - r, r * 2, r * 2);
}
function disc(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill(); }
function ring(ctx, x, y, r, w, color) { ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.5, w); ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.stroke(); }
// 지그재그 번개 줄기
function bolt(ctx, x1, y1, x2, y2, jag, segs, w, color, core = '#ffffff') {
  const pts = [[x1, y1]];
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i < segs; i++) { const k = i / segs, o = rnd(-jag, jag); pts.push([x1 + dx * k + nx * o, y1 + dy * k + ny * o]); }
  pts.push([x2, y2]);
  for (const [lw, col] of [[w * 3, color], [w, core]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  return pts;
}
// 초승달 (베기 궤적): 바깥 호와 안쪽 호 사이를 채움, 끝으로 갈수록 얇음
function crescent(ctx, x, y, r, a0, a1, thick, color) {
  const n = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  for (let i = n; i >= 0; i--) {
    const k = i / n, a = a0 + (a1 - a0) * k, t = thick * Math.sin(Math.PI * Math.min(1, k * 1.15));
    ctx.lineTo(x + Math.cos(a) * (r - t), y + Math.sin(a) * (r - t));
  }
  ctx.closePath(); ctx.fill();
}
function star(ctx, x, y, r1, r2, n, rot, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}

// ============================================================
//  입자
// ============================================================
export class Particles {
  constructor() { this.list = []; }
  add(o) {
    if (this.list.length > 1400) this.list.splice(0, 200);
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 0.5, size: 3, color: '#fff', kind: 'glow', drag: 2, grav: 0, rot: rnd(0, TAU), vr: rnd(-8, 8), grow: 0, z: 0, ...o };
    p.max = p.life;
    this.list.push(p);
    return p;
  }
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.a !== undefined ? o.a + rnd(-o.spread ?? 0.6, o.spread ?? 0.6) : rnd(0, TAU);
      const sp = rnd(o.sp?.[0] ?? 60, o.sp?.[1] ?? 220);
      this.add({ ...o, x: x + rnd(-(o.jit || 0), o.jit || 0), y: y + rnd(-(o.jit || 0), o.jit || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rnd(o.life?.[0] ?? 0.3, o.life?.[1] ?? 0.6), size: rnd(o.size?.[0] ?? 2, o.size?.[1] ?? 4),
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy = p.vy * f + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx, layer) {
    for (const p of this.list) {
      const add = p.kind === 'glow' || p.kind === 'spark' || p.kind === 'ember' || p.kind === 'streak';
      if ((layer === 'add') !== add) continue;
      const k = p.life / p.max;
      switch (p.kind) {
        case 'glow': glow(ctx, p.x, p.y, p.size * (0.6 + 0.4 * k) * 3, p.color, k); break;
        case 'ember': glow(ctx, p.x, p.y, p.size * 2.2 * k + 1, p.color, Math.min(1, k * 1.6), 1); break;
        case 'spark': case 'streak': {
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (p.kind === 'streak' ? 1 : 0.6) * (0.4 + 0.6 * k); ctx.lineCap = 'round';
          const L = p.kind === 'streak' ? 0.06 : 0.035;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * L, p.y - p.vy * L); ctx.stroke();
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = 0.45 * Math.min(1, k * 2) * (p.alpha ?? 1);
          disc(ctx, p.x, p.y, p.size * (1.6 - 0.6 * k), p.color);
          break;
        }
        case 'shard': case 'rock': case 'leaf': case 'paper': case 'coin': {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.save(); ctx.translate(p.x, p.y - p.z); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const s = p.size;
          if (p.kind === 'shard') { ctx.beginPath(); ctx.moveTo(s * 1.6, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s, 0); ctx.lineTo(0, -s * 0.5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-s * 0.3, -s * 0.2, s, s * 0.25); }
          else if (p.kind === 'rock') { ctx.fillRect(-s / 2, -s / 2, s, s); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-s / 2, -s / 2, s, s * 0.3); }
          else if (p.kind === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.4, 0, 0, TAU); ctx.fill(); }
          else if (p.kind === 'paper') { ctx.fillRect(-s * 0.4, -s, s * 0.8, s * 2); ctx.fillStyle = '#e53935'; ctx.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 1.2); }
          else { const w = Math.abs(Math.cos(p.rot * 2)) * s; ctx.fillStyle = '#ffca28'; ctx.fillRect(-w, -s, w * 2, s * 2); ctx.fillStyle = '#fff59d'; ctx.fillRect(-w * 0.5, -s * 0.7, w * 0.6, s * 0.8); }
          ctx.restore();
          break;
        }
        case 'ring': ctx.globalAlpha = k; ring(ctx, p.x, p.y, p.size * (1 - k) * 1 + p.r0, 3 * k, p.color); break;
        default:
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
//  투사체 그리기
//  s = [id, look, x, y, angle, r, el, z, enemy]
// ============================================================
export function drawShot(ctx, sh, now, P, dt) {
  const [id, look, x, y, a, r, el, z = 0] = sh;
  const t = now / 1000;
  const yy = y - z;
  const ca = Math.cos(a), sa = Math.sin(a);
  const c = elColor(el), gl = elGlow(el);
  const trail = (n, o) => { if (P && Math.random() < n * dt * 60) P.add({ x: x - ca * (r * 0.6) + rnd(-r, r) * 0.4, y: yy - sa * (r * 0.6) + rnd(-r, r) * 0.4, ...o }); };
  ctx.save();
  switch (look) {
    case 'fireball': {
      trail(1.4, { kind: 'ember', color: ['#ffab40', '#ff7043', '#ffd54f'][(Math.random() * 3) | 0], vx: -ca * 60 + rnd(-30, 30), vy: -sa * 60 + rnd(-30, 30) - 20, life: rnd(0.25, 0.5), size: rnd(2, 4) });
      trail(0.4, { kind: 'smoke', color: '#3e2723', vx: rnd(-10, 10), vy: -20, life: 0.6, size: 5, grow: 10 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 4.2, '#ff5722', 0.5);
      // 꼬리 불꽃
      for (let i = 4; i >= 1; i--) glow(ctx, x - ca * i * r * 0.55, yy - sa * i * r * 0.55, r * (1.6 - i * 0.2), i % 2 ? '#ff7043' : '#ffab40', 0.7, 1);
      glow(ctx, x, yy, r * 1.7, '#ffab40', 1, 1);
      glow(ctx, x + ca * 2, yy + sa * 2, r * 1.0, '#fff3e0', 1, 1);
      break;
    }
    case 'flame': {
      const age = (id * 7.31 + t * 9) % 1;
      ctx.globalCompositeOperation = 'lighter';
      const s = r * (1.1 + age * 0.9);
      glow(ctx, x, yy, s * 2.4, '#ff5722', 0.35);
      glow(ctx, x, yy, s * 1.3, id % 3 ? '#ff9800' : '#ffca28', 0.85, 1);
      glow(ctx, x, yy, s * 0.6, '#fff8e1', 0.8, 1);
      if (Math.random() < 0.15) P?.add({ kind: 'smoke', x, y: yy, vx: rnd(-20, 20), vy: -40, color: '#4e342e', life: 0.5, size: 4, grow: 14, alpha: 0.6 });
      break;
    }
    case 'arrow': case 'ebolt': {
      const en = look === 'ebolt';
      ctx.translate(x, yy); ctx.rotate(a);
      if (en) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 16, '#ff1744', 0.5); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-10, 0); ctx.stroke();
      ctx.strokeStyle = en ? '#bcaaa4' : '#8d5a2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = en ? '#ff5252' : '#eceff1'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3.5); ctx.lineTo(5, 3.5); ctx.fill();
      ctx.fillStyle = en ? '#d32f2f' : '#fff176'; ctx.fillRect(-13, -3, 4, 2); ctx.fillRect(-13, 1, 4, 2);
      break;
    }
    case 'bolt': {
      trail(1.2, { kind: 'spark', color: '#fff59d', vx: rnd(-140, 140), vy: rnd(-140, 140), life: 0.18, size: 2.5 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, 30, '#ffe14d', 0.55);
      ctx.translate(x, yy); ctx.rotate(a);
      bolt(ctx, -46, 0, 10, 0, 4, 7, 1.6, 'rgba(255,225,77,.85)');
      ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(4, -5); ctx.lineTo(7, 0); ctx.lineTo(4, 5); ctx.fill();
      break;
    }
    case 'spark': {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, 22, '#ffe14d', 0.45);
      ctx.translate(x, yy); ctx.rotate(a);
      bolt(ctx, -22, 0, 12, 0, 6, 4, 1.3, 'rgba(255,215,64,.8)');
      if (Math.random() < 0.3) { ctx.rotate(rnd(-1, 1)); bolt(ctx, 0, 0, rnd(10, 20), 0, 4, 3, 0.8, 'rgba(255,241,118,.6)'); }
      break;
    }
    case 'shard': case 'spear': {
      const L = look === 'spear' ? 2.4 : 1.4;
      trail(0.8, { kind: 'glow', color: '#b3e5fc', vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.3, size: 2 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 3.5, '#4fc3f7', 0.45);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.translate(x, yy); ctx.rotate(a);
      const s = r * L;
      ctx.fillStyle = 'rgba(179,229,252,.35)'; ctx.beginPath(); ctx.moveTo(-s * 2.6, 0); ctx.lineTo(-s * 0.6, -r * 0.5); ctx.lineTo(-s * 0.6, r * 0.5); ctx.fill();
      ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(0, -r * 0.75); ctx.lineTo(-s, 0); ctx.lineTo(0, r * 0.75); ctx.fill();
      ctx.fillStyle = '#e1f5fe'; ctx.beginPath(); ctx.moveTo(s * 1.4, 0); ctx.lineTo(0, -r * 0.75); ctx.lineTo(-s * 0.2, 0); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-s * 0.2, -1, s * 1.2, 2);
      break;
    }
    case 'crescent': {
      trail(1, { kind: 'leaf', color: '#a5d6a7', vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.5, size: 3, drag: 3 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 2.2, '#66bb6a', 0.35);
      ctx.translate(x, yy); ctx.rotate(a);
      for (let i = 2; i >= 0; i--) {
        ctx.globalAlpha = i ? 0.25 : 0.95;
        crescent(ctx, -i * 9, 0, r * 1.25, -1.35, 1.35, r * 0.6, i ? '#81c784' : '#e8f5e9');
      }
      ctx.globalAlpha = 0.9; crescent(ctx, 0, 0, r * 1.1, -1.2, 1.2, r * 0.3, '#ffffff');
      break;
    }
    case 'tornado': {
      if (P && Math.random() < 0.6) { const aa = rnd(0, TAU); P.add({ kind: 'leaf', x: x + Math.cos(aa) * r, y: y + Math.sin(aa) * r * 0.4 - rnd(0, 50), vx: -Math.sin(aa) * 160, vy: Math.cos(aa) * 50 - 40, life: 0.6, size: 3, color: ['#a5d6a7', '#c5e1a5', '#e8f5e9'][(Math.random() * 3) | 0], drag: 1 }); }
      ctx.globalAlpha = 0.25; disc(ctx, x, y + 4, r * 0.9, '#000');
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y - 20, r * 2, '#81c784', 0.3);
      for (let i = 0; i < 9; i++) {
        const k = i / 8, ry = y - k * 70, rw = r * (0.35 + k * 0.85);
        const ph = t * 14 + i * 0.7;
        ctx.globalAlpha = 0.55 - k * 0.25;
        ctx.strokeStyle = i % 2 ? '#c8e6c9' : '#e8f5e9'; ctx.lineWidth = 3 - k * 1.5;
        ctx.beginPath(); ctx.ellipse(x + Math.sin(ph * 0.3) * 4 * k, ry, rw, rw * 0.28, 0, ph % TAU, (ph % TAU) + 4.4); ctx.stroke();
      }
      break;
    }
    case 'boulder': {
      trail(0.6, { kind: 'rock', color: '#8d6e63', vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.4, size: 3, drag: 4 });
      ctx.globalAlpha = 0.3; disc(ctx, x, yy + r * 0.8, r * 0.9, '#000'); ctx.globalAlpha = 1;
      ctx.translate(x, yy); ctx.rotate(t * 10 + id);
      ctx.fillStyle = '#6d4c41'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const aa = (i / 8) * TAU, rr = r * (0.85 + ((i * 37) % 5) * 0.06); ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      ctx.fill();
      ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.15, r * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a1887f'; ctx.fillRect(-r * 0.5, -r * 0.5, r * 0.4, r * 0.3);
      ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.1); ctx.lineTo(r * 0.3, r * 0.4); ctx.stroke();
      break;
    }
    case 'bubble': {
      trail(0.5, { kind: 'glow', color: '#4fc3f7', vx: rnd(-15, 15), vy: rnd(-15, 15), life: 0.35, size: 2 });
      const wob = Math.sin(t * 20 + id) * 0.12;
      ctx.translate(x, yy);
      ctx.fillStyle = 'rgba(79,195,247,.45)'; ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + wob), r * (1 - wob), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b3e5fc'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, TAU); ctx.fill();
      break;
    }
    case 'wave': {
      if (P && Math.random() < 0.8) P.add({ kind: 'glow', x: x + rnd(-r, r) * 0.3 - ca * r * 0.4, y: yy + rnd(-r, r), vx: -ca * 80 + rnd(-30, 30), vy: -sa * 80 + rnd(-30, 30), life: 0.4, size: 2.5, color: Math.random() < 0.5 ? '#e1f5fe' : '#4fc3f7' });
      ctx.translate(x, yy); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, r * 1.8, '#0288d1', 0.4);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.85;
      crescent(ctx, -r * 0.6, 0, r * 1.25, -1.3, 1.3, r * 0.75, '#0288d1');
      ctx.globalAlpha = 0.95; crescent(ctx, -r * 0.5, 0, r * 1.2, -1.2, 1.2, r * 0.38, '#4fc3f7');
      ctx.globalAlpha = 1; crescent(ctx, -r * 0.4, 0, r * 1.2, -1.15, 1.15, r * 0.12, '#ffffff');
      for (let i = -2; i <= 2; i++) { const yy2 = i * r * 0.42; disc(ctx, r * 0.75 - Math.abs(i) * 4 + Math.sin(t * 25 + i) * 2, yy2, 2.5, '#e1f5fe'); }
      break;
    }
    case 'umbral': case 'eorb': {
      const en = look === 'eorb';
      const col = en ? '#d500f9' : '#9c64ff';
      trail(1, { kind: 'glow', color: en ? '#aa00ff' : '#7c4dff', vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.35, size: 2.5 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 4, col, 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      disc(ctx, x, yy, r * 1.15, '#1a0f2e');
      ring(ctx, x, yy, r * 1.15, 2, col);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 0.9, en ? '#ea80fc' : '#d1b3ff', 1, 1);
      break;
    }
    case 'needle': {
      ctx.translate(x, yy); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 12, '#9ccc65', 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(156,204,101,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.strokeStyle = '#dcedc8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(8, 0); ctx.stroke();
      disc(ctx, -6, 0, 2, '#7cb342');
      break;
    }
    case 'flask': case 'bomb': {
      const bomb = look === 'bomb';
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + 4, r * (1 - z / 140), r * 0.45 * (1 - z / 140), 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.translate(x, yy); ctx.rotate(t * 12);
      if (bomb) {
        disc(ctx, 0, 0, r, '#37474f'); disc(ctx, -r * 0.3, -r * 0.3, r * 0.35, '#78909c');
        ctx.fillStyle = '#6d4c41'; ctx.fillRect(-2, -r - 4, 4, 5);
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -r - 6, 10, '#ffab40', 0.9 + Math.sin(t * 40) * 0.1, 1);
        if (P && Math.random() < 0.7) P.add({ kind: 'spark', x, y: yy - r, vx: rnd(-90, 90), vy: rnd(-120, 0), life: 0.2, size: 2, color: '#ffd54f' });
      } else {
        ctx.fillStyle = 'rgba(220,237,200,.85)'; ctx.beginPath(); ctx.arc(0, 2, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.arc(0, 2, r * 0.75, 0.2, Math.PI - 0.2); ctx.fill();
        ctx.fillStyle = '#a1887f'; ctx.fillRect(-3, -r - 2, 6, 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.5, -r * 0.3, 2, 3);
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 2, r * 2, '#9ccc65', 0.35);
      }
      break;
    }
    case 'talisman': {
      trail(0.7, { kind: 'spark', color: '#ffe14d', vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.2, size: 2 });
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, yy, 20, '#ffe14d', 0.45);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.translate(x, yy); ctx.rotate(a + Math.sin(t * 18 + id) * 0.25);
      ctx.fillStyle = '#fffde7'; ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = '#e53935'; ctx.fillRect(-6, -1.5, 12, 3); ctx.fillRect(-1.5, -4, 3, 8);
      ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 1; ctx.strokeRect(-9, -5, 18, 10);
      break;
    }
    case 'chain': case 'anchor': {
      ctx.translate(x, yy); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 22, look === 'chain' ? '#e040fb' : '#4fc3f7', 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (let i = 1; i < 7; i++) { ctx.strokeStyle = look === 'chain' ? '#b39ddb' : '#90a4ae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-i * 7, 0, 4, 2.5, 0, 0, TAU); ctx.stroke(); }
      if (look === 'chain') {
        ctx.fillStyle = '#e1bee7'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-2, -6); ctx.lineTo(1, 0); ctx.lineTo(-2, 6); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, 4, 0, 8, '#ea80fc', 0.9, 1);
      } else {
        ctx.rotate(t * 16);
        ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 2, 9, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.stroke();
        disc(ctx, 0, -11, 3, '#eceff1');
      }
      break;
    }
    case 'ghost': {
      trail(1, { kind: 'glow', color: '#ce93d8', vx: rnd(-20, 20), vy: rnd(-20, 20) - 10, life: 0.5, size: 3 });
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 2.6, '#aa00ff', 0.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(x, yy + Math.sin(t * 8 + id) * 3); ctx.rotate(a);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#e1bee7';
      ctx.beginPath(); ctx.arc(4, 0, r * 0.75, -Math.PI / 2, Math.PI / 2, true);
      for (let i = 0; i <= 4; i++) ctx.lineTo(-r * 0.9 - (i % 2) * 6 - Math.sin(t * 20 + i) * 3, r * 0.75 - (i / 4) * r * 1.5);
      ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#4a148c';
      ctx.fillRect(4, -5, 4, 4); ctx.fillRect(4, 2, 4, 4); ctx.fillRect(9, -1, 2, 3);
      break;
    }
    case 'bullet': {
      ctx.translate(x, yy); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,224,130,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(0, 0); ctx.stroke();
      glow(ctx, 0, 0, 9, '#ffe082', 1, 1);
      break;
    }
    case 'cannonball': {
      trail(1, { kind: 'smoke', color: '#90a4ae', vx: rnd(-15, 15), vy: rnd(-15, 15), life: 0.6, size: 4, grow: 12, alpha: 0.7 });
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, yy, r * 2.5, '#4fc3f7', 0.3);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      disc(ctx, x, yy, r, '#263238'); disc(ctx, x - r * 0.3, yy - r * 0.3, r * 0.35, '#78909c');
      ring(ctx, x, yy, r, 1.5, '#4fc3f7');
      break;
    }
    default: {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, yy, r * 3, c, 0.6); glow(ctx, x, yy, r, gl, 1, 1);
    }
  }
  ctx.restore();
}

// ============================================================
//  지대 (바닥에 깔림)  z = [id, look, x, y, r, t, life]
// ============================================================
export function drawZone(ctx, zn, now, P, dt) {
  const [id, look, x, y, r, t, life] = zn;
  const k = clamp(t / life, 0, 1);
  const T = now / 1000;
  const fadeIn = clamp((life - t) / 0.2, 0, 1), fadeOut = clamp(t / 0.3, 0, 1), A = Math.min(fadeIn, fadeOut);
  const emit = (n, f) => { if (P) for (let i = 0; i < n * dt * 60; i++) if (Math.random() < n * dt * 60 - i) P.add(f()); };
  const inDisc = () => { const a = rnd(0, TAU), d = Math.sqrt(Math.random()) * r; return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9]; };
  ctx.save();
  switch (look) {
    case 'blizzard': {
      ctx.globalAlpha = 0.28 * A; disc(ctx, x, y, r, '#4fc3f7');
      ctx.globalAlpha = 0.8 * A; ring(ctx, x, y, r, 2, '#e1f5fe');
      ctx.setLineDash([8, 10]); ctx.lineDashOffset = -T * 40; ring(ctx, x, y, r * 0.75, 1.5, 'rgba(225,245,254,.6)'); ctx.setLineDash([]);
      emit(3, () => { const [px, py] = inDisc(); return { kind: 'glow', x: px - 30, y: py - 30, vx: 140, vy: 120, life: 0.35, size: rnd(1.5, 3), color: '#ffffff', drag: 0 }; });
      emit(0.6, () => { const [px, py] = inDisc(); return { kind: 'shard', x: px, y: py, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.5, size: 3, color: '#b3e5fc', drag: 2 }; });
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, r * 1.2, '#81d4fa', 0.25 * A);
      break;
    }
    case 'heal': {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y, r * 1.1, '#26c6da', 0.35 * A);
      ctx.globalAlpha = 0.7 * A; ring(ctx, x, y, r, 2, '#b2ebf2');
      for (let i = 0; i < 3; i++) { const rr = ((T * 50 + i * r / 3) % r); ctx.globalAlpha = (1 - rr / r) * 0.6 * A; ring(ctx, x, y, rr, 2, '#80deea'); }
      emit(0.8, () => { const [px, py] = inDisc(); return { kind: 'glow', x: px, y: py, vx: 0, vy: -60, life: 0.7, size: 2.5, color: '#a7ffeb', drag: 0 }; });
      break;
    }
    case 'vortex': {
      ctx.globalAlpha = 0.3 * A; disc(ctx, x, y, r, '#01579b');
      ctx.globalAlpha = 0.85 * A;
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i % 2 ? '#4fc3f7' : '#e1f5fe'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let j = 0; j <= 20; j++) { const kk = j / 20, aa = -T * 6 + i * (TAU / 4) + kk * 3.4, rr = r * (1 - kk * 0.9); ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr * 0.9); }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, r * 0.5, '#4fc3f7', 0.5 * A);
      emit(1.2, () => { const aa = rnd(0, TAU); return { kind: 'glow', x: x + Math.cos(aa) * r, y: y + Math.sin(aa) * r * 0.9, vx: -Math.cos(aa) * 90 - Math.sin(aa) * 120, vy: -Math.sin(aa) * 90 + Math.cos(aa) * 120, life: 0.6, size: 2.5, color: '#b3e5fc', drag: 0.5 }; });
      break;
    }
    case 'poisoncloud': {
      for (let i = 0; i < 7; i++) {
        const aa = i * 0.9 + T * 0.4, d = r * 0.45 * ((i * 37) % 7) / 7;
        ctx.globalAlpha = 0.28 * A; disc(ctx, x + Math.cos(aa) * d, y + Math.sin(aa) * d * 0.8, r * (0.55 + 0.1 * Math.sin(T * 2 + i)), i % 2 ? '#7cb342' : '#558b2f');
      }
      ctx.globalAlpha = 0.5 * A; ring(ctx, x, y, r, 1.5, '#c5e1a5');
      emit(0.7, () => { const [px, py] = inDisc(); return { kind: 'smoke', x: px, y: py, vx: 0, vy: -20, life: 0.8, size: 3, grow: 4, color: '#9ccc65' }; });
      emit(0.4, () => { const [px, py] = inDisc(); return { kind: 'glow', x: px, y: py, vx: 0, vy: -30, life: 0.5, size: 2, color: '#dcedc8' }; });
      break;
    }
    case 'shockzone': {
      const kk = 1 - k;
      ctx.globalAlpha = 0.25 + kk * 0.4; disc(ctx, x, y, r * kk, 'rgba(255,225,77,.35)');
      ring(ctx, x, y, r, 2, '#ffe14d');
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { const aa = rnd(0, TAU); ctx.globalAlpha = 0.8; bolt(ctx, x, y, x + Math.cos(aa) * r * kk, y + Math.sin(aa) * r * kk, 5, 4, 1, 'rgba(255,225,77,.6)'); }
      break;
    }
    case 'whirl': {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y, r * 1.3, '#ff5722', 0.35 * A);
      for (let i = 0; i < 3; i++) {
        const a0 = T * 18 + (i * TAU) / 3;
        ctx.globalAlpha = 0.85 * A; crescent(ctx, x, y, r, a0, a0 + 1.7, r * 0.35, i % 2 ? '#ff7043' : '#ffab40');
        ctx.globalAlpha = 0.9 * A; crescent(ctx, x, y, r * 0.98, a0 + 1.1, a0 + 1.7, r * 0.12, '#fff3e0');
      }
      emit(2, () => { const aa = rnd(0, TAU); return { kind: 'ember', x: x + Math.cos(aa) * r, y: y + Math.sin(aa) * r, vx: -Math.sin(aa) * 260, vy: Math.cos(aa) * 260, life: 0.3, size: 2.5, color: '#ffab40', drag: 3 }; });
      break;
    }
    case 'thunderfield': {
      ctx.globalAlpha = 0.35 * A; disc(ctx, x, y, r, '#1a1a40');
      ctx.globalAlpha = 0.9 * A; ctx.setLineDash([4, 6]); ctx.lineDashOffset = T * 30; ring(ctx, x, y, r, 2, '#ffe14d'); ctx.setLineDash([]);
      // 위쪽 먹구름 그림자
      for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.25 * A; disc(ctx, x + Math.cos(i * 1.3 + T) * r * 0.5, y - 70 + Math.sin(i * 2 + T) * 10, r * 0.45, '#37474f'); }
      ctx.globalCompositeOperation = 'lighter';
      if (Math.random() < 0.35) { const [px, py] = inDisc(); ctx.globalAlpha = 1; bolt(ctx, px + rnd(-10, 10), py - 80, px, py, 8, 6, 1.2, 'rgba(255,225,77,.8)'); glow(ctx, px, py, 22, '#ffe14d', 0.8); }
      glow(ctx, x, y, r, '#ffe14d', 0.12 * A);
      break;
    }
    default:
      ctx.globalAlpha = 0.3 * A; disc(ctx, x, y, r, '#ffffff');
  }
  ctx.restore();
}

// ============================================================
//  일회성 이펙트 (방장이 보낸 fx를 처음 볼 때 입자를 뿌리고, 시간 동안 그림)
// ============================================================
export function spawnFx(f, P, ui) {
  const c = elColor(f.el), g = elGlow(f.el);
  switch (f.k) {
    case 'hit': {
      if (f.dot) { P.burst(f.x, f.y, 2, { kind: 'glow', color: f.el ? c : '#ff8a65', sp: [10, 40], life: [0.2, 0.4], size: [1.5, 2.5] }); break; }
      const base = Math.atan2(f.uy, f.ux);
      const n = f.big ? 16 : 8;
      P.burst(f.x, f.y, n, { kind: 'spark', a: (f.ux || f.uy) ? base : undefined, spread: 0.9, color: f.el ? [g, c, '#ffffff'] : ['#ffffff', '#fff59d'], sp: [180, f.big ? 520 : 380], life: [0.12, 0.3], size: [2, f.big ? 4 : 3], drag: 6 });
      if (f.big) P.burst(f.x, f.y, 6, { kind: 'glow', color: f.el ? c : '#ffffff', sp: [30, 120], life: [0.2, 0.4], size: [3, 5] });
      if (f.el === 'ice') P.burst(f.x, f.y, 4, { kind: 'shard', color: '#b3e5fc', sp: [80, 200], life: [0.3, 0.5], size: [2, 4], grav: 300 });
      if (f.el === 'earth') P.burst(f.x, f.y, 4, { kind: 'rock', color: '#8d6e63', sp: [80, 200], life: [0.3, 0.5], size: [2, 4], grav: 400 });
      if (f.el === 'fire') P.burst(f.x, f.y, 5, { kind: 'ember', color: ['#ffab40', '#ff7043'], sp: [40, 160], life: [0.3, 0.6], size: [1.5, 3], grav: -120 });
      ui?.number(f);
      break;
    }
    case 'react': {
      const col = f.color;
      P.add({ kind: 'ring', x: f.x, y: f.y, r0: 6, size: f.r * 1.1, life: 0.45, color: col });
      P.burst(f.x, f.y, 26, { kind: 'spark', color: [col, '#ffffff'], sp: [200, 520], life: [0.2, 0.45], size: [2, 4], drag: 5 });
      if (f.rid === 'steam') P.burst(f.x, f.y, 18, { kind: 'smoke', color: '#eceff1', sp: [40, 200], life: [0.6, 1.1], size: [6, 12], grow: 30, drag: 3 });
      if (f.rid === 'freeze' || f.rid === 'shatter') P.burst(f.x, f.y, f.rid === 'shatter' ? 26 : 10, { kind: 'shard', color: ['#e1f5fe', '#81d4fa', '#ffffff'], sp: [100, 380], life: [0.4, 0.8], size: [3, 6], grav: 500, drag: 2 });
      if (f.rid === 'melt' || f.rid === 'plasma') P.burst(f.x, f.y, 22, { kind: 'ember', color: f.rid === 'melt' ? ['#ffab40', '#81d4fa'] : ['#e1bee7', '#ffffff', '#ffe14d'], sp: [100, 420], life: [0.3, 0.7], size: [2, 4] });
      if (f.rid === 'toxic' || f.rid === 'acid') P.burst(f.x, f.y, 18, { kind: 'smoke', color: '#7cb342', sp: [40, 200], life: [0.5, 0.9], size: [5, 9], grow: 20 });
      if (f.rid === 'umbra') P.burst(f.x, f.y, 20, { kind: 'glow', color: ['#7c4dff', '#d1b3ff'], sp: [120, 300], life: [0.3, 0.6], size: [2, 4], drag: 6 });
      if (f.rid === 'swirl') for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; P.add({ kind: 'leaf', x: f.x + Math.cos(a) * 20, y: f.y + Math.sin(a) * 20, vx: Math.cos(a + 1.2) * 320, vy: Math.sin(a + 1.2) * 320, life: 0.6, size: 3, color: '#c8e6c9', drag: 3 }); }
      ui?.react(f);
      break;
    }
    case 'explosion': {
      const fire = !f.el || f.el === 'fire';
      const cols = fire ? ['#ffab40', '#ff7043', '#ffd54f', '#ffffff'] : [c, g, '#ffffff'];
      P.burst(f.x, f.y, 30, { kind: 'ember', color: cols, sp: [80, f.r * 6], life: [0.3, 0.7], size: [2, 4.5], drag: 4 });
      P.burst(f.x, f.y, 14, { kind: 'smoke', color: fire ? '#3e2723' : '#263238', sp: [30, f.r * 2.5], life: [0.6, 1.2], size: [6, 12], grow: 18, drag: 3, alpha: 0.9 });
      P.burst(f.x, f.y, 8, { kind: 'rock', color: '#5d4037', sp: [150, 380], life: [0.4, 0.7], size: [2, 4], grav: 600 });
      if (f.el === 'water') P.burst(f.x, f.y, 26, { kind: 'glow', color: ['#4fc3f7', '#e1f5fe'], sp: [100, 360], life: [0.3, 0.6], size: [2, 4], grav: 400 });
      break;
    }
    case 'slash': {
      const n = f.big ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const a = f.a + rnd(-f.arc / 2, f.arc / 2);
        P.add({ kind: 'spark', x: f.x + Math.cos(a) * f.r * 0.8, y: f.y + Math.sin(a) * f.r * 0.8, vx: Math.cos(a) * rnd(120, 300), vy: Math.sin(a) * rnd(120, 300), life: 0.2, size: 2.5, color: f.el ? elGlow(f.el) : '#ffffff', drag: 5 });
      }
      if (f.el === 'fire') P.burst(f.x + Math.cos(f.a) * f.r * 0.7, f.y + Math.sin(f.a) * f.r * 0.7, 6, { kind: 'ember', color: ['#ffab40', '#ff7043'], sp: [40, 140], life: [0.3, 0.5], size: [2, 3], grav: -100 });
      if (f.el === 'wind') P.burst(f.x + Math.cos(f.a) * f.r * 0.7, f.y + Math.sin(f.a) * f.r * 0.7, 4, { kind: 'leaf', color: '#a5d6a7', sp: [60, 180], life: [0.3, 0.6], size: [2, 3] });
      if (f.el === 'shadow') P.burst(f.x + Math.cos(f.a) * f.r * 0.7, f.y + Math.sin(f.a) * f.r * 0.7, 6, { kind: 'glow', color: '#b388ff', sp: [30, 120], life: [0.3, 0.5], size: [2, 3] });
      break;
    }
    case 'nova': {
      if (f.look === 'frost') { for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; P.add({ kind: 'shard', x: f.x, y: f.y, vx: Math.cos(a) * rnd(300, 480), vy: Math.sin(a) * rnd(300, 480), rot: a, vr: 0, life: 0.4, size: rnd(3, 6), color: i % 2 ? '#e1f5fe' : '#81d4fa', drag: 5 }); } P.burst(f.x, f.y, 20, { kind: 'glow', color: '#e1f5fe', sp: [100, 360], life: [0.3, 0.6], size: [2, 3] }); }
      if (f.look === 'quake') { P.burst(f.x, f.y, 26, { kind: 'rock', color: ['#8d6e63', '#6d4c41', '#a1887f'], sp: [120, 380], life: [0.4, 0.8], size: [3, 6], grav: 700 }); P.burst(f.x, f.y, 16, { kind: 'smoke', color: '#a1887f', sp: [80, 260], life: [0.6, 1], size: [6, 10], grow: 20, drag: 3 }); }
      if (f.look === 'reap') { for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; P.add({ kind: 'glow', x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r, vx: -Math.cos(a) * 300, vy: -Math.sin(a) * 300, life: 0.4, size: 3, color: i % 2 ? '#e040fb' : '#7c4dff', drag: 2 }); } }
      break;
    }
    case 'thunder': {
      P.burst(f.x, f.y, 16, { kind: 'spark', color: ['#fff59d', '#ffe14d', '#ffffff'], sp: [150, 420], life: [0.15, 0.35], size: [2, 3.5], drag: 5 });
      P.burst(f.x, f.y, 6, { kind: 'smoke', color: '#455a64', sp: [30, 120], life: [0.4, 0.7], size: [5, 8], grow: 14 });
      break;
    }
    case 'pillar':
      if (f.look === 'lava') { P.burst(f.x, f.y, 18, { kind: 'ember', color: ['#ffab40', '#ff5722', '#ffd54f'], a: -Math.PI / 2, spread: 0.5, sp: [150, 420], life: [0.4, 0.8], size: [2, 4], grav: 500 }); P.burst(f.x, f.y, 6, { kind: 'smoke', color: '#3e2723', a: -Math.PI / 2, spread: 0.4, sp: [60, 160], life: [0.6, 1], size: [5, 9], grow: 16 }); break; }
      P.burst(f.x, f.y, 10, { kind: 'rock', color: ['#8d6e63', '#6d4c41'], sp: [100, 300], life: [0.4, 0.7], size: [2, 5], grav: 700 }); P.burst(f.x, f.y, 4, { kind: 'smoke', color: '#a1887f', sp: [20, 80], life: [0.5, 0.8], size: [5, 8], grow: 12 }); break;
    case 'slam': {
      const fire = f.el === 'fire';
      P.burst(f.x, f.y, 22, { kind: 'rock', color: ['#795548', '#5d4037', '#8d6e63'], sp: [150, f.r * 4], life: [0.4, 0.8], size: [3, 6], grav: 700 });
      P.burst(f.x, f.y, 14, { kind: 'smoke', color: fire ? '#4e342e' : '#8d6e63', sp: [60, f.r * 2.4], life: [0.6, 1.1], size: [7, 12], grow: 22, drag: 3 });
      if (fire) P.burst(f.x, f.y, 26, { kind: 'ember', color: ['#ffab40', '#ff5722', '#ffd54f'], sp: [100, f.r * 5], life: [0.3, 0.7], size: [2, 4] });
      break;
    }
    case 'beam': {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      for (let d = 0; d < f.len; d += 18) P.add({ kind: 'glow', x: f.x + ca * d, y: f.y + sa * d, vx: rnd(-40, 40) - sa * rnd(-60, 60), vy: rnd(-40, 40) + ca * rnd(-60, 60), life: rnd(0.3, 0.6), size: rnd(2, 3.5), color: Math.random() < 0.5 ? '#9c64ff' : '#d1b3ff', drag: 3 });
      P.burst(f.x + ca * 20, f.y + sa * 20, 10, { kind: 'smoke', color: '#5e35b1', sp: [30, 120], life: [0.4, 0.7], size: [4, 7], grow: 10 });
      break;
    }
    case 'execute': P.burst(f.x, f.y, 22, { kind: 'spark', color: ['#d1b3ff', '#ffffff', '#9c64ff'], sp: [200, 500], life: [0.2, 0.4], size: [2, 4], drag: 5 }); break;
    case 'die': {
      P.burst(f.x, f.y, f.boss ? 60 : 14, { kind: 'smoke', color: ['#cfd8dc', '#90a4ae'], sp: [40, f.boss ? 300 : 140], life: [0.4, 0.9], size: [4, f.boss ? 14 : 8], grow: 14, drag: 4 });
      P.burst(f.x, f.y, f.boss ? 50 : 10, { kind: 'spark', color: ['#ffffff', '#fff59d'], sp: [120, f.boss ? 600 : 320], life: [0.2, 0.5], size: [2, 3.5], drag: 4 });
      P.add({ kind: 'glow', x: f.x, y: f.y - 6, vx: 0, vy: -50, life: 0.9, size: 5, color: '#b2ebf2', drag: 0 });
      break;
    }
    case 'gold': P.burst(f.x, f.y, Math.min(14, 3 + Math.floor(f.v / 4)), { kind: 'coin', color: '#ffca28', sp: [80, 220], life: [0.6, 0.9], size: [3, 4], grav: 500, drag: 1, a: -Math.PI / 2, spread: 1.1 }); ui?.goldPop(f); break;
    case 'chestopen': P.burst(f.x, f.y - 10, 40, { kind: 'coin', color: '#ffca28', sp: [150, 380], life: [0.8, 1.3], size: [3, 5], grav: 600, a: -Math.PI / 2, spread: 0.9, drag: 1 }); P.burst(f.x, f.y - 10, 30, { kind: 'glow', color: ['#fff59d', '#ffd54f'], sp: [60, 260], life: [0.5, 1], size: [2, 4] }); break;
    case 'wallhit': P.burst(f.x, f.y, 10, { kind: 'rock', color: ['#9e9e9e', '#757575'], sp: [80, 240], life: [0.3, 0.6], size: [2, 4], grav: 500 }); P.burst(f.x, f.y, 5, { kind: 'smoke', color: '#bdbdbd', sp: [20, 90], life: [0.4, 0.6], size: [4, 7], grow: 10 }); break;
    case 'spikehit': P.burst(f.x, f.y, 10, { kind: 'spark', color: ['#ffffff', '#ff8a80'], sp: [150, 320], life: [0.15, 0.3], size: [2, 3] }); break;
    case 'fall': P.burst(f.x, f.y, 10, { kind: 'smoke', color: '#5d4037', sp: [20, 90], life: [0.4, 0.7], size: [4, 7], grow: 8 }); break;
    case 'ko': {
      const a = Math.atan2(f.y - 320, f.x - 480);
      P.burst(f.x, f.y, 60, { kind: 'streak', color: [f.color, '#ffffff', '#fff59d'], sp: [300, 900], life: [0.3, 0.7], size: [3, 6], drag: 2 });
      P.burst(f.x, f.y, 30, { kind: 'glow', color: [f.color, '#ffffff'], a, spread: 0.4, sp: [200, 700], life: [0.4, 0.9], size: [3, 6], drag: 1 });
      break;
    }
    case 'roll': P.burst(f.x, f.y + 10, 6, { kind: 'smoke', color: '#bcaaa4', a: f.a + Math.PI, spread: 0.7, sp: [40, 120], life: [0.3, 0.5], size: [3, 6], grow: 10, drag: 4 }); break;
    case 'blink': {
      const col = f.smoke ? '#4a3472' : '#ffe14d';
      P.burst(f.x, f.y, f.smoke ? 26 : 14, { kind: f.smoke ? 'smoke' : 'spark', color: f.smoke ? ['#4a3472', '#311b52', '#5e35b1'] : ['#fff59d', '#ffe14d', '#ffffff'], sp: [40, f.smoke ? 160 : 300], life: [0.4, f.smoke ? 1.2 : 0.4], size: [3, f.smoke ? 12 : 3], grow: f.smoke ? 18 : 0, drag: 3 });
      P.burst(f.x2, f.y2, 10, { kind: 'glow', color: col, sp: [40, 160], life: [0.2, 0.4], size: [2, 4] });
      break;
    }
    case 'dashstart': P.burst(f.x, f.y, 10, { kind: 'smoke', color: '#bcaaa4', a: f.a + Math.PI, spread: 0.8, sp: [60, 200], life: [0.3, 0.6], size: [4, 7], grow: 10 }); break;
    case 'heal': P.burst(f.x, f.y, 2, { kind: 'glow', color: '#a7ffeb', sp: [10, 40], life: [0.4, 0.7], size: [2, 3], grav: -80 }); ui?.heal(f); break;
    case 'revive': P.burst(f.x, f.y, 30, { kind: 'glow', color: ['#fff59d', '#a7ffeb', '#ffffff'], sp: [40, 200], life: [0.5, 1], size: [2, 4], grav: -100 }); break;
    case 'down': P.burst(f.x, f.y, 16, { kind: 'smoke', color: '#90a4ae', sp: [30, 140], life: [0.5, 0.8], size: [4, 8], grow: 10 }); break;
    case 'clash': P.burst(f.x, f.y, 10, { kind: 'spark', color: ['#ffffff', elGlow(f.e1), elGlow(f.e2)], sp: [150, 380], life: [0.12, 0.25], size: [2, 3] }); break;
    case 'clashboom':
      P.burst(f.x, f.y, 24, { kind: 'ember', color: [elColor(f.e1), elGlow(f.e1)], sp: [120, 420], life: [0.3, 0.6], size: [2, 4] });
      P.burst(f.x, f.y, 24, { kind: 'ember', color: [elColor(f.e2), elGlow(f.e2)], sp: [120, 420], life: [0.3, 0.6], size: [2, 4] });
      ui?.react({ x: f.x, y: f.y, name: '원소 충돌!', color: '#ffffff' });
      break;
    case 'shotend': P.burst(f.x, f.y, 6, { kind: 'spark', color: f.el ? [elGlow(f.el), elColor(f.el)] : ['#ffffff', '#d7ccc8'], sp: [60, 200], life: [0.1, 0.25], size: [1.5, 2.5] }); break;
    case 'splash': P.burst(f.x, f.y, 18, { kind: 'glow', color: ['#9ccc65', '#dcedc8', '#7cb342'], sp: [80, 260], life: [0.3, 0.6], size: [2, 4], grav: 300 }); P.burst(f.x, f.y, 8, { kind: 'shard', color: '#dcedc8', sp: [100, 260], life: [0.3, 0.5], size: [2, 3], grav: 400 }); break;
    case 'block': P.burst(f.x, f.y, 10, { kind: 'spark', color: ['#ffffff', '#90caf9'], sp: [150, 320], life: [0.12, 0.25], size: [2, 3] }); break;
    case 'acid': P.burst(f.x, f.y, 10 + f.n * 3, { kind: 'glow', color: ['#9ccc65', '#c6ff00', '#dcedc8'], sp: [80, 300], life: [0.3, 0.6], size: [2, 4], grav: 200 }); P.burst(f.x, f.y, 6, { kind: 'smoke', color: '#558b2f', sp: [30, 120], life: [0.5, 0.8], size: [4, 8], grow: 12 }); break;
    case 'soul': for (let i = 0; i < 5; i++) P.add({ kind: 'glow', x: f.x + rnd(-6, 6), y: f.y + rnd(-6, 6), vx: (f.x2 - f.x) * 2 + rnd(-60, 60), vy: (f.y2 - f.y) * 2 + rnd(-60, 60), life: 0.45, size: 3, color: '#ea80fc', drag: 1 }); break;
    case 'hooked': P.burst(f.x, f.y, 10, { kind: 'spark', color: f.look === 'chain' ? ['#e1bee7', '#e040fb'] : ['#e1f5fe', '#4fc3f7'], sp: [120, 300], life: [0.15, 0.3], size: [2, 3] }); break;
    case 'cast': if (f.i > 0) P.burst(f.x + Math.cos(f.a) * 16, f.y + Math.sin(f.a) * 16 - 6, 5, { kind: 'glow', color: elGlow(f.el) || '#ffffff', sp: [20, 80], life: [0.15, 0.3], size: [2, 3] }); break;
    case 'markon': break;
    case 'chestdrop': P.burst(f.x, f.y, 14, { kind: 'smoke', color: '#bcaaa4', sp: [40, 140], life: [0.4, 0.7], size: [4, 8], grow: 10 }); break;
    case 'bosscast': P.burst(f.x, f.y, 14, { kind: 'glow', color: ['#ff1744', '#d500f9'], sp: [60, 200], life: [0.3, 0.5], size: [2, 4] }); break;
    default:
  }
}

// 시간에 따라 변하는 그림 (k: 1→0)
export function drawFx(ctx, f, now) {
  const k = clamp(f.t / f.life, 0, 1), e = 1 - k;
  const T = now / 1000;
  ctx.save();
  switch (f.k) {
    case 'hit': {
      if (f.dot) break;
      ctx.globalCompositeOperation = 'lighter';
      const s = (f.big ? 30 : 18) * (0.5 + easeOut(e) * 0.8);
      if (e < 0.35) {
        const kk = 1 - e / 0.35;
        glow(ctx, f.x, f.y, s * 1.6, f.el ? elColor(f.el) : '#ffffff', kk * 0.8);
        star(ctx, f.x, f.y, s, s * 0.25, f.big ? 8 : 6, f.id, `rgba(255,255,255,${kk})`);
        if (f.crit) { ctx.globalAlpha = kk; ring(ctx, f.x, f.y, s * 1.3, 3, '#ffd54f'); }
      }
      break;
    }
    case 'slash': {
      // 휘두르는 궤적: 앞쪽 끝이 빠르게 지나가고 뒤에 잔상이 남음
      const sweep = easeOut3(clamp(e / 0.55, 0, 1));
      const dir = f.flip ? -1 : 1;
      const a0 = f.a - (f.arc / 2) * dir, span = f.arc * dir;
      const head = a0 + span * sweep, tail = a0 + span * Math.max(0, sweep - 0.75 - e * 0.4);
      const fade = clamp(k / 0.4, 0, 1);
      const col = f.el ? elColor(f.el) : '#ffffff', glw = f.el ? elGlow(f.el) : '#ffffff';
      const R = f.r * (f.big ? 1.08 : 1);
      const th = (f.big ? 22 : 14);
      const [lo, hi] = dir > 0 ? [tail, head] : [head, tail];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * fade; crescent(ctx, f.x, f.y, R + 6, lo, hi, th * 1.6, col);
      ctx.globalAlpha = 0.9 * fade; crescent(ctx, f.x, f.y, R, lo, hi, th, glw);
      ctx.globalAlpha = fade; crescent(ctx, f.x, f.y, R - 1, lo, hi, th * 0.35, '#ffffff');
      // 끝부분 반짝
      if (sweep < 1) glow(ctx, f.x + Math.cos(head) * R * 0.9, f.y + Math.sin(head) * R * 0.9, f.big ? 26 : 16, glw, 0.9);
      if (f.char === 'reaper') { ctx.globalAlpha = 0.35 * fade; crescent(ctx, f.x, f.y, R * 0.7, lo, hi, th * 0.6, '#7c4dff'); }
      break;
    }
    case 'react': {
      ctx.globalCompositeOperation = 'lighter';
      const R = f.r || 40;
      const kk = easeOut3(e);
      glow(ctx, f.x, f.y, R * (0.6 + kk * 0.9), f.color, k * 0.8);
      if (e < 0.25) glow(ctx, f.x, f.y, R * 0.8, '#ffffff', (1 - e / 0.25));
      ctx.globalAlpha = k; ring(ctx, f.x, f.y, R * (0.3 + kk * 0.9), 6 * k + 1, f.color);
      ctx.globalAlpha = k * 0.6; ring(ctx, f.x, f.y, R * (0.2 + kk * 1.2), 2, '#ffffff');
      if (f.rid === 'electro' || f.rid === 'plasma') for (let i = 0; i < 4; i++) { const a = rnd(0, TAU); ctx.globalAlpha = k; bolt(ctx, f.x, f.y, f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, 7, 5, 1.2, 'rgba(255,241,118,.7)'); }
      if (f.rid === 'freeze') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.6 * k; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.fillStyle = '#e1f5fe'; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * 30 * kk, f.y + Math.sin(a) * 30 * kk); ctx.lineTo(f.x + Math.cos(a + 0.3) * 8, f.y + Math.sin(a + 0.3) * 8); ctx.lineTo(f.x + Math.cos(a - 0.3) * 8, f.y + Math.sin(a - 0.3) * 8); ctx.fill(); } }
      if (f.rid === 'umbra') { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.7 * k; disc(ctx, f.x, f.y, R * 0.5 * (1 - kk * 0.5), '#12081f'); }
      break;
    }
    case 'chain': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; bolt(ctx, f.x, f.y, f.x2, f.y2, 10, 8, 1.6, 'rgba(255,225,77,.85)'); glow(ctx, f.x2, f.y2, 24, '#ffe14d', k); break;
    case 'explosion': {
      const R = f.r;
      const kk = easeOut3(e);
      ctx.globalCompositeOperation = 'lighter';
      const fire = !f.el || f.el === 'fire';
      const c1 = fire ? '#ff5722' : elColor(f.el), c2 = fire ? '#ffab40' : elGlow(f.el);
      if (e < 0.15) { glow(ctx, f.x, f.y, R * 1.8, '#ffffff', 1 - e / 0.15); }
      glow(ctx, f.x, f.y, R * (0.5 + kk * 0.9), c1, k * 0.9);
      glow(ctx, f.x, f.y, R * (0.3 + kk * 0.5), c2, k, 1);
      glow(ctx, f.x, f.y, R * 0.35 * k, '#fff8e1', k, 1);
      ctx.globalAlpha = k; ring(ctx, f.x, f.y, R * (0.4 + kk * 0.85), 5 * k + 1, c2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, R * 0.8 * kk, R * 0.35 * kk, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'nova': {
      const R = f.r, kk = easeOut3(e);
      ctx.globalCompositeOperation = 'lighter';
      if (f.look === 'frost') {
        glow(ctx, f.x, f.y, R * kk * 1.2, '#4fc3f7', k * 0.7);
        ctx.globalAlpha = k; ring(ctx, f.x, f.y, R * kk, 8 * k + 1, '#e1f5fe');
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, rr = R * kk, h = 18 * k + 4;
          ctx.globalAlpha = 0.85 * k; ctx.fillStyle = i % 2 ? '#b3e5fc' : '#e1f5fe';
          ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * (rr + h), f.y + Math.sin(a) * (rr + h));
          ctx.lineTo(f.x + Math.cos(a + 0.12) * rr, f.y + Math.sin(a + 0.12) * rr); ctx.lineTo(f.x + Math.cos(a - 0.12) * rr, f.y + Math.sin(a - 0.12) * rr); ctx.fill();
        }
      } else if (f.look === 'quake') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.7 * k; ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + f.id;
          ctx.beginPath(); ctx.moveTo(f.x, f.y);
          let px = f.x, py = f.y;
          for (let j = 1; j <= 4; j++) { const rr = (R * kk * j) / 4; px = f.x + Math.cos(a + Math.sin(j * 3 + i) * 0.25) * rr; py = f.y + Math.sin(a + Math.sin(j * 3 + i) * 0.25) * rr; ctx.lineTo(px, py); }
          ctx.stroke();
        }
        ctx.globalAlpha = k; ring(ctx, f.x, f.y, R * kk, 6 * k + 1, '#d7ccc8');
        ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, R * kk, '#ffb74d', 0.3 * k);
      } else if (f.look === 'reap') {
        const kk2 = 1 - kk;
        glow(ctx, f.x, f.y, R * 1.1, '#7c4dff', 0.5 * k);
        ctx.globalAlpha = k; ring(ctx, f.x, f.y, R * (0.2 + kk2 * 0.8), 5, '#e040fb');
        for (let i = 0; i < 2; i++) { const a0 = T * -10 + i * Math.PI; ctx.globalAlpha = 0.9 * k; crescent(ctx, f.x, f.y, R * 0.95, a0, a0 + 2.2, 26, '#ea80fc'); crescent(ctx, f.x, f.y, R * 0.93, a0 + 1.4, a0 + 2.2, 10, '#ffffff'); }
      }
      break;
    }
    case 'thunder': {
      ctx.globalCompositeOperation = 'lighter';
      if (e < 0.5) {
        const kk = 1 - e / 0.5;
        ctx.globalAlpha = kk;
        bolt(ctx, f.x + rnd(-14, 14), f.y - 420, f.x, f.y, 22, 12, 3, 'rgba(255,225,77,.9)');
        bolt(ctx, f.x + rnd(-30, 30), f.y - 300, f.x + rnd(-8, 8), f.y, 14, 9, 1.2, 'rgba(255,241,118,.6)');
        glow(ctx, f.x, f.y, f.r * 2, '#ffe14d', kk);
        glow(ctx, f.x, f.y, f.r * 0.8, '#ffffff', kk);
      }
      ctx.globalAlpha = k; ring(ctx, f.x, f.y, f.r * (0.4 + easeOut(e) * 0.8), 4 * k, '#fff59d');
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.6, f.r * 0.3, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'pillar': {
      if (f.look === 'lava') {
        const up = e < 0.15 ? easeOut3(e / 0.15) : 1 - (e - 0.15) / 0.85;
        const h = 110 * up, w = f.r * 0.55;
        ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#1b0f0a'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, f.r * 0.8, f.r * 0.35, 0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, f.x, f.y, f.r * 1.4, '#ff3d00', 0.6 * k);
        for (let i = 0; i < 7; i++) { const kk = i / 6, yy = f.y - h * kk; glow(ctx, f.x + Math.sin(T * 30 + i) * 3, yy, w * (1.3 - kk * 0.6), i % 2 ? '#ff7043' : '#ffab40', up * 0.9, 1); }
        glow(ctx, f.x, f.y - h * 0.3, w * 0.8, '#fff3e0', up, 1);
        break;
      }
      // 바닥에서 솟는 바위 가시
      const up = e < 0.2 ? easeOut3(e / 0.2) : e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
      const h = 46 * up, w = f.r * 0.7;
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, w, w * 0.4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      for (const [ox, sc, col] of [[-w * 0.55, 0.6, '#6d4c41'], [w * 0.5, 0.7, '#5d4037'], [0, 1, '#8d6e63']]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(f.x + ox - w * 0.45 * sc, f.y + 4); ctx.lineTo(f.x + ox, f.y + 4 - h * sc); ctx.lineTo(f.x + ox + w * 0.45 * sc, f.y + 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(f.x + ox - w * 0.2 * sc, f.y + 4); ctx.lineTo(f.x + ox, f.y + 4 - h * sc); ctx.lineTo(f.x + ox + w * 0.05, f.y + 4); ctx.fill();
      }
      break;
    }
    case 'lava': break;
    case 'beam': {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      const w = 22 * k * k + 2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const [lw, col, al] of [[w * 2.4, '#5e35b1', 0.5], [w * 1.3, '#9c64ff', 0.9], [w * 0.5, '#ffffff', 1]]) {
        ctx.globalAlpha = al * Math.min(1, k * 2); ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(f.x + ca * 14, f.y + sa * 14 - 6); ctx.lineTo(f.x + ca * f.len, f.y + sa * f.len - 6); ctx.stroke();
      }
      glow(ctx, f.x + ca * 18, f.y + sa * 18 - 6, 40 * k, '#d1b3ff', k);
      glow(ctx, f.x + ca * f.len, f.y + sa * f.len - 6, 30 * k, '#9c64ff', k);
      break;
    }
    case 'aimline': {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + e * 0.7; ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 1 + e * 2;
      ctx.setLineDash([10, 6]); ctx.lineDashOffset = -T * 80;
      ctx.beginPath(); ctx.moveTo(f.x, f.y - 6); ctx.lineTo(f.x + ca * f.len, f.y + sa * f.len - 6); ctx.stroke(); ctx.setLineDash([]);
      glow(ctx, f.x + ca * 18, f.y + sa * 18 - 6, 10 + e * 16, '#d1b3ff', 0.4 + e * 0.6);
      break;
    }
    case 'markon': {
      const r = 22 - e * 6;
      ctx.translate(f.x, f.y - 4); ctx.rotate(T * 3);
      ctx.strokeStyle = '#ea80fc'; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r - 6, 0); ctx.lineTo(r + 6, 0); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, 10, '#e040fb', 0.5 + Math.sin(T * 20) * 0.3);
      break;
    }
    case 'markcone': {
      ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#9c64ff';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.r * easeOut(e), f.a - f.arc / 2, f.a + f.arc / 2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'execute': {
      ctx.globalCompositeOperation = 'lighter';
      const L = 36 * easeOut3(Math.min(1, e * 3));
      ctx.lineCap = 'round';
      for (const [lw, col] of [[10 * k, '#7c4dff'], [4 * k, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = k;
        ctx.beginPath(); ctx.moveTo(f.x - L, f.y - L); ctx.lineTo(f.x + L, f.y + L); ctx.moveTo(f.x + L, f.y - L); ctx.lineTo(f.x - L, f.y + L); ctx.stroke();
      }
      glow(ctx, f.x, f.y, 50 * k, '#9c64ff', k);
      break;
    }
    case 'detocast': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * 0.6; ring(ctx, f.x, f.y, f.r * easeOut(e), 4 * k, '#c6ff00'); break;
    case 'acid': ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, (24 + f.n * 6) * (0.5 + e), '#9ccc65', k); break;
    case 'slam': {
      const kk = easeOut3(e);
      ctx.globalAlpha = 0.45 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, f.r * kk, f.r * 0.45 * kk, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = k; ctx.strokeStyle = f.el === 'fire' ? '#ffab40' : '#d7ccc8'; ctx.lineWidth = 6 * k + 1;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * kk, f.r * 0.8 * kk, 0, 0, TAU); ctx.stroke();
      if (f.el === 'fire') { ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, f.r * kk * 1.2, '#ff5722', k * 0.7); }
      break;
    }
    case 'warn': {
      // 바닥 경고: 가장자리 원 + 안쪽이 차오름
      const fill = 1 - k;
      const col = f.el === 'lightning' ? '255,225,77' : '255,40,60';
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(${col},${0.12 + 0.1 * Math.sin(T * 20)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${col},.32)`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * fill, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${col},.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      break;
    }
    case 'warnline': {
      ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = `rgba(255,40,60,${0.15 + 0.1 * Math.sin(T * 20)})`; ctx.fillRect(0, -f.w / 2, f.len, f.w);
      ctx.fillStyle = 'rgba(255,40,60,.35)'; ctx.fillRect(0, -f.w / 2, f.len * (1 - k), f.w);
      ctx.strokeStyle = 'rgba(255,60,80,.9)'; ctx.lineWidth = 2; ctx.strokeRect(0, -f.w / 2, f.len, f.w);
      break;
    }
    case 'spawnwarn': {
      // 조준경 모양: 돌면서 좁혀 들어옴
      const r = (f.big ? 46 : 22) * (0.6 + k * 0.9);
      ctx.translate(f.x, f.y); ctx.rotate(e * 2.5);
      ctx.strokeStyle = '#ff5252'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + e * 0.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 1.35, 0); ctx.stroke(); }
      ctx.fillStyle = '#ff5252'; ctx.fillRect(-2, -2, 4, 4);
      break;
    }
    case 'blink': {
      ctx.globalCompositeOperation = 'lighter';
      const col = f.smoke ? '#9c64ff' : '#ffe14d';
      ctx.globalAlpha = k * (f.smoke ? 0.4 : 1);
      if (!f.smoke) bolt(ctx, f.x, f.y - 8, f.x2, f.y2 - 8, 10, 7, 2, 'rgba(255,225,77,.8)');
      glow(ctx, f.x2, f.y2 - 8, 30 * k, col, k);
      break;
    }
    case 'heal': break;
    case 'soul': break;
    case 'hooked': {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
      ctx.strokeStyle = f.look === 'chain' ? '#ce93d8' : '#90a4ae'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    case 'clash': ctx.globalCompositeOperation = 'lighter'; star(ctx, f.x, f.y, 18 * k + 4, 4, 4, f.id, `rgba(255,255,255,${k})`); break;
    case 'clashboom': {
      const kk = easeOut3(e);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, f.x - 6, f.y, f.r * (0.5 + kk), elColor(f.e1), k);
      glow(ctx, f.x + 6, f.y, f.r * (0.5 + kk), elColor(f.e2), k);
      if (e < 0.2) glow(ctx, f.x, f.y, f.r, '#ffffff', 1 - e / 0.2);
      ctx.globalAlpha = k; ring(ctx, f.x, f.y, f.r * kk, 4 * k, '#ffffff');
      break;
    }
    case 'ko': {
      ctx.globalCompositeOperation = 'lighter';
      const a = Math.atan2(f.y - 320, f.x - 480);
      ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = 40 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - Math.cos(a) * 900, f.y - Math.sin(a) * 900); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14 * k; ctx.stroke();
      glow(ctx, f.x, f.y, 120 * k, '#ffffff', k);
      break;
    }
    case 'revive': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; ctx.fillStyle = 'rgba(255,245,157,.35)'; ctx.fillRect(f.x - 16 * k, f.y - 200, 32 * k, 200); glow(ctx, f.x, f.y, 50 * k, '#fff59d', k); break;
    case 'chestopen': {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i - 4.5) * 0.25 + Math.sin(T * 2 + i) * 0.05, L = 140 * k + 40;
        ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#fff59d';
        ctx.beginPath(); ctx.moveTo(f.x, f.y - 10); ctx.lineTo(f.x + Math.cos(a - 0.06) * L, f.y - 10 + Math.sin(a - 0.06) * L); ctx.lineTo(f.x + Math.cos(a + 0.06) * L, f.y - 10 + Math.sin(a + 0.06) * L); ctx.fill();
      }
      glow(ctx, f.x, f.y - 10, 60 * k, '#ffd54f', k);
      break;
    }
    case 'cast': {
      if (f.i === 0) break;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, f.x, f.y - 4, 34 * k, elColor(f.el) || '#ffffff', 0.6 * k);
      ctx.globalAlpha = k; ring(ctx, f.x, f.y + 8, 24 * (1 - k) + 8, 2, elGlow(f.el) || '#ffffff');
      break;
    }
    case 'bosscast': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k; ring(ctx, f.x, f.y, 70 * (1 - k) + 20, 4 * k, '#ff1744'); break;
    case 'ecast': ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y - 6, 22 * k, '#ff5252', k); break;
    case 'fall': {
      ctx.globalAlpha = k; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x, f.y, 6 + i * 6 * k, T * 8 + i, T * 8 + i + 2); ctx.stroke(); }
      break;
    }
    case 'dashstart': {
      if (f.look === 'leap') break;
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      const age = f.life - f.t;
      const head = f.len * clamp(age / (f.dur || 0.15), 0, 1);
      const tail = f.len * clamp((age - 0.12) / 0.3, 0, 1);
      if (head - tail < 2) break;
      const col = elColor(f.el), glw = elGlow(f.el);
      const x1 = f.x + ca * tail, y1 = f.y - 8 + sa * tail, x2 = f.x + ca * head, y2 = f.y - 8 + sa * head;
      const nx = -sa, ny = ca, w = 16 * k + 4;
      ctx.globalCompositeOperation = 'lighter';
      for (const [ww, c, al] of [[w * 1.8, col, 0.45], [w, glw, 0.85], [w * 0.35, '#ffffff', 1]]) {
        ctx.globalAlpha = al * Math.min(1, k * 2); ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 + nx * ww / 2, y2 + ny * ww / 2); ctx.lineTo(x2 + ca * ww * 0.8, y2 + sa * ww * 0.8); ctx.lineTo(x2 - nx * ww / 2, y2 - ny * ww / 2); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'roll': break;
    case 'wallhit': ctx.globalAlpha = k; star(ctx, f.x, f.y, 14 * k + 4, 3, 5, f.id, 'rgba(255,255,255,.8)'); break;
    case 'die': if (f.boss) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, f.x, f.y, 260 * (1 - k * k), '#ffffff', k); } break;
    default:
  }
  ctx.restore();
}
