// ============================================================
//  원소 아레나 — 시작점: 메뉴 ↔ 게임, 입력, 방장/참가자 네트워크
// ============================================================
import { CHARS, VIEW_W, VIEW_H, MAX_PLAYERS } from './data.js';
import * as SIM from './sim.js';
import { createRenderer } from './render.js';
import { initAudio, fxSound, setMuted as audioMute, sfx } from './audio.js';
import * as NET from './net.js';
import * as SV from './save.js';
import * as UI from './ui.js';

const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const $controls = document.getElementById('controls');
const $skills = document.getElementById('skills');
const $hudTop = document.getElementById('hudTop');
const $code = document.getElementById('roomCode');
const STEP = 1 / 60;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

audioMute(SV.S().muted);
R.hooks.onFx = (f) => { if (game) fxSound(f); };

// ---------- 화면 상태 ----------
let game = null; // { role: 'solo'|'host'|'client', state, myId, room, conn, cfg, snap, prev, recvT, paused, ended }
const history = [];
const handlers = {
  go(name) { history.push(name); UI[name](handlers); },
  back() { history.pop(); const p = history[history.length - 1] || 'title'; UI[p](handlers); },
  start: (cfg) => startGame(cfg),
  join: (code, status) => joinGame(code, status),
  resume() { if (game) { game.paused = false; UI.hide(); } },
  mute() { const m = !SV.S().muted; SV.setMuted(m); audioMute(m); UI.pause(handlers, { code: game?.room?.code || game?.code, muted: m }); },
  quit: () => quitGame(),
  next() { const cfg = { ...game_last, ch: game.cfg.ch + 1 }; quitGame(true); startGame(cfg); },
  retry() { quitGame(true); startGame(game_last); },
};
let game_last = null;
function toMenu() { history.length = 0; history.push('title'); UI.title(handlers); }

// ---------- 입력 ----------
const keys = new Set();
const tapped = new Set();
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, inside: false };
const touch = { mx: 0, my: 0, btn: new Set(), stickId: null };
const KEYMAP = { KeyJ: 'atk', KeyQ: 's1', KeyK: 's1', KeyE: 's2', KeyL: 's2', KeyR: 's3', Semicolon: 's3', Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash' };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape' && game) { togglePause(); return; }
  if (!game) return;
  keys.add(e.code);
  const a = KEYMAP[e.code];
  if (a) { tapped.add(a); e.preventDefault(); }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * VIEW_W, y: ((e.clientY - r.top) / r.height) * VIEW_H };
}
canvas.addEventListener('mousemove', (e) => { Object.assign(mouse, toCanvas(e)); mouse.inside = true; });
canvas.addEventListener('mousedown', (e) => { initAudio(); if (e.button === 0) { mouse.down = true; tapped.add('atk'); } if (e.button === 2) tapped.add('s1'); });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', () => initAudio(), { once: false });

// 모바일: 조이스틱 + 버튼
const $stick = document.getElementById('stick'), $knob = $stick.querySelector('.knob');
function stickMove(t) {
  const r = $stick.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  const max = r.width / 2, l = Math.hypot(dx, dy);
  if (l > max) { dx *= max / l; dy *= max / l; }
  touch.mx = dx / max; touch.my = dy / max;
  $knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
$stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; touch.stickId = t.identifier; stickMove(t); }, { passive: false });
$stick.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === touch.stickId) stickMove(t); }, { passive: false });
const stickEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === touch.stickId) { touch.stickId = null; touch.mx = touch.my = 0; $knob.style.transform = ''; } };
$stick.addEventListener('touchend', stickEnd); $stick.addEventListener('touchcancel', stickEnd);

function buildSkillButtons(char) {
  const C = CHARS[char];
  const names = [['atk', C.skills[0].name, '클릭'], ['s1', C.skills[1].name, 'Q'], ['s2', C.skills[2].name, 'E'], ['s3', C.skills[3].name, 'R'], ['dash', '대시', 'Space']];
  $skills.className = `skills ${isTouch ? 'touch' : 'pc'}`;
  $skills.innerHTML = names.map(([a, n, k], i) => `<div class="sk ${a}" data-a="${a}" style="--c:${C.color}"><span class="key">${isTouch ? '' : k}</span><b>${n}</b><span class="cd"></span><span class="cdt"></span></div>`).join('');
  $skills.querySelectorAll('.sk').forEach((b) => {
    const a = b.dataset.a;
    const on = (e) => { e.preventDefault(); initAudio(); touch.btn.add(a); tapped.add(a); b.classList.add('down'); };
    const off = (e) => { e.preventDefault(); touch.btn.delete(a); b.classList.remove('down'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off);
    b.addEventListener('mousedown', (e) => { if (!isTouch) { tapped.add(a); e.preventDefault(); } });
  });
  $stick.hidden = !isTouch;
}
function updateSkillButtons(h) {
  if (!h) return;
  $skills.querySelectorAll('.sk').forEach((b) => {
    const a = b.dataset.a, i = ['atk', 's1', 's2', 's3'].indexOf(a);
    const cd = b.querySelector('.cd'), cdt = b.querySelector('.cdt');
    let k = 0, txt = '';
    if (i >= 0) { k = h.cm[i] ? h.cd[i] / h.cm[i] : 0; if (h.cd[i] > 0.3 && i > 0) txt = h.cd[i].toFixed(h.cd[i] < 1 ? 1 : 0); }
    else k = h.dc > 0 ? 0 : 1;
    cd.style.transform = `scaleY(${k})`;
    cdt.textContent = txt;
    b.classList.toggle('ready', k === 0);
  });
}

// 내 입력 → { mx, my, aim, ad, atk, s1, s2, s3, dash }
function readInput(snapMe, snap) {
  const inp = { mx: 0, my: 0 };
  if (keys.has('KeyA') || keys.has('ArrowLeft')) inp.mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) inp.mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) inp.my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) inp.my += 1;
  if (touch.mx || touch.my) { inp.mx = touch.mx; inp.my = touch.my; }
  const held = (a) => tapped.has(a) || touch.btn.has(a) || Object.entries(KEYMAP).some(([k, v]) => v === a && keys.has(k));
  inp.atk = held('atk') || mouse.down;
  inp.s1 = held('s1'); inp.s2 = held('s2'); inp.s3 = held('s3'); inp.dash = held('dash');
  if (snapMe) {
    if (!isTouch && mouse.inside) {
      inp.aim = Math.atan2(mouse.y - snapMe.y + 8, mouse.x - snapMe.x);
      inp.ad = Math.hypot(mouse.x - snapMe.x, mouse.y - snapMe.y);
    } else {
      // 자동 조준: 가장 가까운 적
      const foes = [];
      for (const e of snap.e) if (!e[10]) foes.push({ x: e[2], y: e[3] });
      for (const h of snap.h) if (h.tm !== snapMe.tm && h.al && !h.dn) foes.push(h);
      let best = null, bd = 1e9;
      for (const f of foes) { const d = Math.hypot(f.x - snapMe.x, f.y - snapMe.y); if (d < bd) { bd = d; best = f; } }
      if (best && bd < 560) { inp.aim = Math.atan2(best.y - snapMe.y, best.x - snapMe.x); inp.ad = bd; }
      else if (inp.mx || inp.my) { inp.aim = Math.atan2(inp.my, inp.mx); inp.ad = 220; }
      else inp.aim = snapMe.a;
    }
  }
  return inp;
}

// ---------- 게임 시작 ----------
function heroOpts(cfg, slot) {
  const o = { tree: SV.S().tree, slot };
  if (cfg.mode === 'colosseum') o.team = cfg.fmt === '2v2' ? (slot < 2 ? 1 : 2) : slot + 1;
  return o;
}
async function startGame(cfg) {
  initAudio();
  game_last = cfg;
  const me = SV.S();
  const myId = 'me';
  const state = SIM.createState(cfg.mode, myId, cfg);
  SIM.addHero(state, myId, me.name || '나', me.char, heroOpts(cfg, 0));
  if (cfg.mode === 'colosseum' && !cfg.online) {
    const pool = Object.keys(CHARS).filter((k) => k !== me.char).sort(() => Math.random() - 0.5);
    const n = cfg.fmt === '1v1' ? 1 : 3;
    for (let i = 0; i < n; i++) SIM.addHero(state, 'bot' + i, `봇 ${CHARS[pool[i]].name.split(' ')[1]}`, pool[i], { ...heroOpts(cfg, i + 1), bot: true });
  }
  game = { role: cfg.online ? 'host' : 'solo', state, myId, cfg, paused: false, ended: false, acc: 0, sendT: 0, inputs: {}, peers: new Map(), goldSeen: 0 };
  enterPlay(me.char);
  if (cfg.online) {
    const code = NET.makeRoomCode();
    try {
      game.room = await NET.hostRoom(code, {
        onJoin(id, hello) {
          if (!game || Object.keys(game.state.heroes).length >= MAX_PLAYERS) return false;
          const slot = [0, 1, 2, 3].find((s) => !Object.values(game.state.heroes).some((h) => h.slot === s));
          const h = SIM.addHero(game.state, id, hello.name || '친구', hello.char, { ...heroOpts(game.cfg, slot), tree: Array.isArray(hello.tree) ? hello.tree : [] });
          if (!h) return false;
          UI.toast(`${h.name} 님이 들어왔어요!`);
          return true;
        },
        onMsg(id, m) {
          if (m.t === 'in') game.inputs[id] = m.i;
          if (m.t === 'char' && CHARS[m.c]) SIM.setHeroChar(game.state, id, m.c, m.tree);
        },
        onLeave(id) { const h = game?.state.heroes[id]; if (h) UI.toast(`${h.name} 님이 나갔어요`); SIM.removeHero(game.state, id); delete game.inputs[id]; },
      });
      $code.textContent = `방 코드 ${code}`; $code.hidden = false;
      game.code = code;
      UI.toast(`방 코드: ${code} — 친구에게 알려 주세요`);
    } catch (err) {
      UI.toast(`방을 만들지 못했어요: ${NET.describeError(err)} (혼자 계속합니다)`);
      game.role = 'solo';
    }
  }
}
async function joinGame(code, status) {
  if (code.length !== 5) { status('코드 5글자를 입력하세요.'); return; }
  initAudio();
  status('연결하는 중…');
  const me = SV.S();
  const g = { role: 'client', myId: null, cfg: {}, snap: null, prev: null, recvT: 0, interval: 50, paused: false, ended: false, sendT: 0, goldSeen: 0, runId: null };
  try {
    g.conn = await NET.joinRoom(code, { name: me.name || '친구', char: me.char, tree: me.tree }, {
      onWelcome(id) { g.myId = id; },
      onMsg(m) {
        if (m.t !== 's') return;
        const now = performance.now();
        if (g.snap) { g.interval = clamp(now - g.recvT, 30, 120); }
        g.prev = g.snap; g.snap = m.s; g.recvT = now;
        clientGold(g, m.s);
      },
      onClose(reason) { if (game === g) { UI.toast(reason); quitGame(); } },
    });
    game = g; g.code = code;
    $code.textContent = `방 ${code}`; $code.hidden = false;
    enterPlay(me.char);
  } catch (err) { status(NET.describeError(err)); }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function clientGold(g, s) {
  // 참가자도 스토리 골드를 자기 저장에 받음 (판마다 한 번씩 정산)
  if (s.m !== 'story') return;
  if (g.runId !== s.rid) { g.runId = s.rid; g.goldSeen = 0; }
  if (s.g > g.goldSeen) { SV.addGold(s.g - g.goldSeen); g.goldSeen = s.g; }
}
function enterPlay(char) {
  UI.hide();
  R.reset();
  buildSkillButtons(char);
  $controls.hidden = false; $hudTop.hidden = false;
}
function quitGame(keepCfg = false) {
  if (!game) return toMenu();
  settle(game);
  game.room?.close(); game.conn?.close();
  game = null;
  $controls.hidden = true; $hudTop.hidden = true; $code.hidden = true;
  if (!keepCfg) toMenu();
}
// 판 정산: 스토리 골드를 저장
function settle(g) {
  if (g.settled) return;
  g.settled = true;
  if (g.role === 'client') return; // 참가자는 받을 때마다 저장함
  const s = g.state;
  if (s.mode === 'story' && s.gold > 0) SV.addGold(s.gold);
  const me = s.heroes[g.myId];
  if (me) { SV.stat('bestCombo', me.maxCombo, true); SV.stat('runs', 1); }
}
function togglePause() {
  if (!game) return;
  if (game.paused) { handlers.resume(); return; }
  game.paused = true;
  UI.pause(handlers, { code: game.code, muted: SV.S().muted });
}
document.getElementById('btnPause').addEventListener('click', togglePause);

// 스토리 끝 / 콜로세움 판 끝 감지
function checkEnd() {
  const g = game;
  if (!g || g.ended || g.role === 'client') return;
  const s = g.state;
  if (s.mode === 'story' && (s.story.phase === 'done' || s.story.phase === 'fail') && s.story.t < 97.5) {
    g.ended = true;
    const win = s.story.phase === 'done';
    if (win) SV.clearChapter(s.story.ch);
    const gold = s.gold;
    settle(g);
    const me = s.heroes[g.myId];
    const hasNext = win && s.story.ch + 1 < 3;
    g.cfg.ch = s.story.ch;
    UI.result(handlers, { win, title: win ? `${s.story.ch + 1}장 클리어!` : '전멸…', gold, combo: me?.maxCombo || 0, next: hasNext && g.role === 'solo', retry: true, note: win ? '골드로 스킬 트리를 강화하세요.' : '모은 골드는 그대로 받습니다. 스킬 트리를 강화하고 다시!' });
  }
}

// ---------- 메인 루프 ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game) { drawMenuBackdrop(now); return; }
  const g = game;
  if (g.role === 'client') {
    if (!g.snap) { drawMenuBackdrop(now); return; }
    const view = interpolate(g, now);
    const meH = view.h.find((h) => h.id === g.myId);
    g.sendT -= dt;
    if (g.sendT <= 0 && !g.paused) {
      g.sendT = 1 / 30;
      g.conn.send({ t: 'in', i: readInput(meH, view) });
      tapped.clear();
    }
    R.render(view, g.myId, { aim: !isTouch });
    updateSkillButtons(meH);
    return;
  }
  // 방장 / 혼자
  if (!g.paused || g.role === 'host') {
    const snapForAim = g.lastSnap || SIM.snapshot(g.state);
    const meS = snapForAim.h.find((h) => h.id === g.myId);
    g.acc += dt;
    let steps = 0;
    while (g.acc >= STEP && steps < 6) {
      const myInp = g.paused ? {} : readInput(meS, snapForAim);
      SIM.step(g.state, { ...g.inputs, [g.myId]: myInp }, STEP);
      tapped.clear();
      g.acc -= STEP; steps++;
    }
    if (steps >= 6) g.acc = 0;
  }
  const snap = SIM.snapshot(g.state);
  g.lastSnap = snap;
  if (g.role === 'host' && g.room) {
    g.sendT -= dt;
    if (g.sendT <= 0) { g.sendT = 0.05; g.room.broadcast({ t: 's', s: snap }); }
  }
  R.render(snap, g.myId, { aim: !isTouch });
  updateSkillButtons(snap.h.find((h) => h.id === g.myId));
  checkEnd();
}
// 참가자: 받은 두 상태 사이를 부드럽게 이어 그림
function interpolate(g, now) {
  const a = g.prev, b = g.snap;
  if (!a || a.mk !== b.mk) return b;
  const k = clamp((now - g.recvT) / g.interval, 0, 1);
  const lerp = (x, y) => x + (y - x) * k;
  const lerpA = (x, y) => { let d = y - x; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return x + d * k; };
  const ha = new Map(a.h.map((h) => [h.id, h]));
  const ea = new Map(a.e.map((e) => [e[0], e]));
  const sa = new Map(a.s.map((s) => [s[0], s]));
  // b가 최신이므로 a→b 보간은 한 박자 뒤를 그림 (끊김 없이)
  return {
    ...b,
    h: b.h.map((h) => { const o = ha.get(h.id); return o && Math.hypot(o.x - h.x, o.y - h.y) < 150 ? { ...h, x: lerp(o.x, h.x), y: lerp(o.y, h.y), a: h.id === g.myId ? h.a : lerpA(o.a, h.a) } : h; }),
    e: b.e.map((e) => { const o = ea.get(e[0]); if (!o) return e; const c = e.slice(); c[2] = lerp(o[2], e[2]); c[3] = lerp(o[3], e[3]); return c; }),
    s: b.s.map((s) => { const o = sa.get(s[0]); if (!o) return s; const c = s.slice(); c[2] = lerp(o[2], s[2]); c[3] = lerp(o[3], s[3]); return c; }),
  };
}

// 메뉴 뒤 배경: 캐릭터들이 투기장에서 싸우는 장면 (봇끼리)
let backdrop = null;
function drawMenuBackdrop(now) {
  if (!backdrop) {
    backdrop = SIM.createState('colosseum', 'x', { arena: 0 });
    const ks = Object.keys(CHARS).sort(() => Math.random() - 0.5).slice(0, 4);
    ks.forEach((k, i) => SIM.addHero(backdrop, 'b' + i, CHARS[k].name.split(' ')[1], k, { bot: true, slot: i, team: i + 1 }));
  }
  SIM.step(backdrop, {}, 1 / 60);
  if (backdrop.colo.over && backdrop.colo.t < 1) backdrop = null;
  else R.render(SIM.snapshot(backdrop), null, { shakeMul: 0.3 });
}

toMenu();
requestAnimationFrame(frame);
// 디버그·테스트용
window.__ea = { get game() { return game; }, SIM, SV, startGame, quitGame };
