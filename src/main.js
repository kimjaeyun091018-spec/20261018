// ============================================================
//  원소 아레나 — 시작점: 메뉴 ↔ 게임, 입력, 방장/참가자 네트워크
// ============================================================
import { CHARS, VIEW_W, VIEW_H, MAX_PLAYERS, COLOSSEUM, CHAPTERS, ACCOUNT } from './data.js';
import * as SIM from './sim.js';
import { createRenderer } from './render.js';
import { initAudio, fxSound, setMuted as audioMute, sfx } from './audio.js';
import * as NET from './net.js';
import * as SV from './save.js';
import * as UI from './ui.js';
import * as SO from './social.js';
import { preloadGoogle, googleSignIn, googleError, signOut, savedAccount, pullSave, queuePush, flushPush, cloudStatus, onCloudStatus, myNick, nickOwner, claimNick, NICK_RULE } from './cloud.js';

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
  back() { history.pop(); const p = history[history.length - 1] || 'lobby'; UI[p](handlers); },
  start: (cfg) => startGame(cfg),
  join: (code, status) => joinGame(code, status),
  resume() { if (game) { game.paused = false; UI.hide(); } },
  mute() { const m = !SV.S().muted; SV.setMuted(m); audioMute(m); UI.pause(handlers, { code: game?.room?.code || game?.code, muted: m }); },
  quit: () => quitGame(),
  setMute(m) { SV.setMuted(m); audioMute(m); },
  joinCode(code) { joinGame(code, (t) => UI.toast(t)); },
  onLayout() { applyLayout(); },
  next() { const cfg = { ...game_last, ch: game.cfg.ch + 1 }; quitGame(true); startGame(cfg); },
  retry() { quitGame(true); startGame(game_last); },
};
let game_last = null;
function toMenu() {
  history.length = 0;
  // 구글 계정인데 닉네임을 아직 안 정했으면 먼저 정하기
  if (gAcc && !gAcc.nick) { UI.nickname(handlers, { first: true }); return; }
  history.push('lobby'); UI.lobby(handlers);
  presence();
}
// 접속 표시: 구글 계정 + 닉네임이 있으면 1분마다 신호
function presence(room = null) {
  if (!gAcc?.nick) { SO.stopPresence(); return; }
  const s = SV.S();
  SO.startPresence({ nick: gAcc.nick, alv: s.alv || 1, char: s.char, room });
}

// ---------- 구글 계정 · 클라우드 저장 ----------
const SEEN_KEY = 'elementArena.started';
let gAcc = savedAccount(); // { uid, name, email, nick } 또는 null
if (gAcc) SV.useAccount(`g-${gAcc.uid}`);
SV.onSaveWrite((d) => { if (gAcc) queuePush(gAcc.uid, d); });
onCloudStatus(() => { if (!game && history[history.length - 1] === 'lobby') UI.account(handlers); });
Object.assign(handlers, {
  accountInfo: () => (gAcc ? { name: gAcc.nick || gAcc.name, nick: gAcc.nick, status: cloudStatus() } : null),
  nickRule: NICK_RULE,
  async nickFree(name) { const o = await nickOwner(name); return !o || o === gAcc?.uid; },
  async setNick(name) {
    const n = await claimNick(gAcc.uid, name, gAcc.nick);
    gAcc.nick = n;
    SV.setName(n);
    return `닉네임 「${n}」 으로 정했어요`;
  },
  preload: () => { preloadGoogle().catch(() => {}); },
  refresh: () => { if (game) return; if (!gAcc && !localStorage.getItem(SEEN_KEY)) UI.login(handlers); else toMenu(); },
  async google() {
    let r;
    try { r = await googleSignIn(); } catch (e) { throw new Error(googleError(e)); }
    const carry = JSON.parse(JSON.stringify(SV.S())); // 지금(게스트) 진행
    gAcc = { uid: r.uid, name: r.name, email: r.email, nick: r.nick || null };
    const acc = `g-${r.uid}`;
    const hadLocal = SV.hasLocal(acc);
    SV.useAccount(acc);
    let cloud = null;
    try { cloud = await pullSave(r.uid); } catch (e) { console.warn(e); }
    let note;
    if (cloud && cloud.t >= (hadLocal ? SV.S()._t || 0 : 0)) { SV.replaceWith(cloud.save, cloud.t); note = '클라우드 저장을 불러왔어요'; }
    else if (hadLocal) { SV.save(); note = '이 기기의 저장을 클라우드에 올렸어요'; }
    else { SV.replaceWith(carry, Date.now()); SV.save(); note = '지금까지의 진행을 구글 계정으로 옮겼어요'; }
    if (gAcc.nick) SV.setName(gAcc.nick);
    localStorage.setItem(SEEN_KEY, '1');
    return `${r.name || '구글'} 계정으로 로그인했어요. ${note}`;
  },
  guest() { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 무시 */ } },
  done() { toMenu(); },
  async sync() {
    if (!gAcc) return '';
    const cloud = await pullSave(gAcc.uid);
    if (cloud && cloud.t > (SV.S()._t || 0)) { SV.replaceWith(cloud.save, cloud.t); return '클라우드의 더 최근 저장을 불러왔어요'; }
    SV.save();
    await flushPush();
    return cloudStatus() || '클라우드에 저장했어요';
  },
  logout() { SO.stopPresence(); flushPush(); signOut(); gAcc = null; SV.useAccount(null); try { localStorage.removeItem(SEEN_KEY); } catch { /* 무시 */ } },
  // 시작 화면을 누르면: 로그인한 적이 있으면 로비, 아니면 로그인 메뉴
  started() { if (gAcc || localStorage.getItem(SEEN_KEY)) toMenu(); else { history.length = 0; UI.login(handlers); } },
  toStart() { history.length = 0; UI.start(handlers); },
});
// 다시 들어왔을 때: 다른 기기에서 한 진행이 더 최근이면 받아 옴
if (gAcc && !gAcc.nick) myNick(gAcc.uid).then((n) => { if (n) { gAcc.nick = n; SV.setName(n); } });
if (gAcc) handlers.sync().then(() => { if (!game && history[history.length - 1] === 'lobby') toMenu(); }).catch((e) => console.warn('클라우드 불러오기 실패', e));

// ---------- 입력 ----------
const keys = new Set();
const tapped = new Set();
const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, inside: false };
const touch = { mx: 0, my: 0, btn: new Set(), stickId: null };
const KEYMAP = { KeyJ: 'atk', KeyQ: 's1', KeyK: 's1', KeyE: 's2', KeyL: 's2', KeyR: 's3', Semicolon: 's3', Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash' };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape' && game) { togglePause(); return; }
  if (game && UI.augOpen() && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { pickAug(Number(e.code.slice(5)) - 1); return; }
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
// 마우스는 화면 좌표로 받고, 쓸 때 카메라(확대)를 거쳐 세계 좌표로
const mouseW = () => R.toWorld(mouse.x, mouse.y);
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
  $skills.innerHTML = names.map(([a, n, k], i) => `<div class="sk ${a}" data-a="${a}" data-c="${C.color}" style="--c:${C.color}"><span class="key">${isTouch ? '' : k}</span><b>${n}</b><span class="cd"></span><span class="cdt"></span></div>`).join('');
  $skills.querySelectorAll('.sk').forEach((b) => {
    const a = b.dataset.a;
    const on = (e) => { e.preventDefault(); initAudio(); touch.btn.add(a); tapped.add(a); b.classList.add('down'); };
    const off = (e) => { e.preventDefault(); touch.btn.delete(a); b.classList.remove('down'); };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off);
    b.addEventListener('mousedown', (e) => { if (!isTouch) { tapped.add(a); e.preventDefault(); } });
  });
  $stick.hidden = !isTouch;
  applyLayout();
}
// 설정에서 정한 조이스틱·버튼 위치 (없으면 기본 CSS 배치)
function applyLayout() {
  const L = SV.loadLayout();
  const wrap = document.getElementById('wrap').getBoundingClientRect();
  const btns = [...$skills.querySelectorAll('.sk')];
  $skills.classList.toggle('custom', !!L && isTouch);
  document.getElementById('controls').style.opacity = L?.alpha ?? 1;
  if (!L || !isTouch) {
    $stick.removeAttribute('style'); $knob.removeAttribute('style');
    btns.forEach((b) => b.removeAttribute('style'));
    btns.forEach((b) => b.style.setProperty('--c', b.dataset.c || ''));
    return;
  }
  const place = (el, P, size) => { const d = size * (P.s || 1); Object.assign(el.style, { left: `${P.x * wrap.width - d / 2}px`, top: `${P.y * wrap.height - d / 2}px`, width: `${d}px`, height: `${d}px`, right: 'auto', bottom: 'auto' }); return d; };
  const d = place($stick, L.stick, SV.CONTROL_BASE.stick);
  Object.assign($knob.style, { width: `${d * 0.36}px`, height: `${d * 0.36}px`, left: `${d * 0.32}px`, top: `${d * 0.32}px` });
  btns.forEach((b) => place(b, L[b.dataset.a] || SV.DEFAULT_LAYOUT[b.dataset.a], SV.CONTROL_BASE[b.dataset.a]));
}
addEventListener('resize', () => applyLayout());
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
    const t = findTarget(snapMe, snap);
    if (!isTouch && mouse.inside) {
      const m = mouseW();
      inp.aim = Math.atan2(m.y - snapMe.y + 8, m.x - snapMe.x);
      inp.ad = Math.hypot(m.x - snapMe.x, m.y - snapMe.y);
      // 살짝 도와주는 조준: 조준경이 잡은 적 쪽으로 거의 겨누고 있으면 정확히 맞춤
      if (t && t.diff < 0.2) { inp.aim = Math.atan2(t.y - snapMe.y, t.x - snapMe.x); inp.ad = t.d; }
    } else if (t) { inp.aim = Math.atan2(t.y - snapMe.y, t.x - snapMe.x); inp.ad = t.d; }
    else if (inp.mx || inp.my) { inp.aim = Math.atan2(inp.my, inp.mx); inp.ad = 220; }
    else inp.aim = snapMe.a;
  }
  return inp;
}
// 지금 스킬이 겨누는 적 (조준경 표시용)
//  모바일: 가장 가까운 적 / PC: 마우스 방향에 가장 가까운 적
function findTarget(me, snap) {
  if (!me || !me.al) return null;
  const foes = [];
  for (const e of snap.e) if (!e[10] && !(e[6] > 0)) foes.push({ k: 'e', id: e[0], x: e[2], y: e[3] });
  for (const h of snap.h) if (h.tm !== me.tm && h.al && !(h.fa > 0)) foes.push({ k: 'h', id: h.id, x: h.x, y: h.y });
  const mw = mouseW();
  const mouseAim = !isTouch && mouse.inside ? Math.atan2(mw.y - me.y + 8, mw.x - me.x) : null;
  let best = null, bs = 1e9;
  for (const f of foes) {
    const d = Math.hypot(f.x - me.x, f.y - me.y);
    if (d > 600) continue;
    let diff = 0;
    if (mouseAim !== null) {
      diff = Math.abs(((Math.atan2(f.y - me.y, f.x - me.x) - mouseAim + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 0.45) continue;
    }
    const score = mouseAim !== null ? diff * 600 + d * 0.25 : d;
    if (score < bs) { bs = score; best = { ...f, d, diff }; }
  }
  return best;
}

// ---------- 게임 시작 ----------
function heroOpts(cfg, slot) {
  const o = { tree: SV.S().tree, slot, lv: SV.heroLv(SV.S().char) };
  if (cfg.mode === 'colosseum') o.team = cfg.fmt === '2v2' ? (slot < 2 ? 1 : 2) : slot + 1;
  return o;
}
async function startGame(cfg) {
  initAudio();
  game_last = cfg;
  const me = SV.S();
  const myId = 'me';
  // 이어하기: 저장해 둔 스테이지부터 (그 스테이지는 처음부터)
  const run = cfg.mode === 'story' && cfg.resume ? SV.getRun() : null;
  if (run && SV.owns(run.char)) SV.setChar(run.char);
  if (cfg.mode === 'story' && !run) SV.setRun(null);
  const state = SIM.createState(cfg.mode, myId, run ? { ...cfg, ch: run.ch, st: run.st, map: run.map } : cfg);
  SIM.addHero(state, myId, me.name || '나', me.char, heroOpts(cfg, 0));
  if (run) SIM.restoreHero(state, myId, run);
  if (cfg.mode === 'colosseum' && !cfg.online) {
    const pool = Object.keys(CHARS).filter((k) => k !== me.char).sort(() => Math.random() - 0.5);
    const n = cfg.fmt === '1v1' ? 1 : 3;
    for (let i = 0; i < n; i++) SIM.addHero(state, 'bot' + i, `봇 ${CHARS[pool[i]].name}`, pool[i], { ...heroOpts(cfg, i + 1), bot: true });
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
          const h = SIM.addHero(game.state, id, hello.name || '친구', hello.char, { ...heroOpts(game.cfg, slot), tree: Array.isArray(hello.tree) ? hello.tree : [], lv: hello.lv | 0 });
          if (!h) return false;
          UI.toast(`${h.name} 님이 들어왔어요!`);
          return true;
        },
        onMsg(id, m) {
          if (m.t === 'in') game.inputs[id] = m.i;
          if (m.t === 'char' && CHARS[m.c]) SIM.setHeroChar(game.state, id, m.c, m.tree, m.lv);
        },
        onLeave(id) { const h = game?.state.heroes[id]; if (h) UI.toast(`${h.name} 님이 나갔어요`); SIM.removeHero(game.state, id); delete game.inputs[id]; },
      });
      $code.textContent = `방 코드 ${code}`; $code.hidden = false;
      game.code = code;
      presence(code);
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
    g.conn = await NET.joinRoom(code, { name: me.name || '친구', char: me.char, tree: me.tree, lv: SV.heroLv(me.char) }, {
      onWelcome(id) { g.myId = id; },
      onMsg(m) {
        if (m.t !== 's') return;
        const now = performance.now();
        if (g.snap) { g.interval = clamp(now - g.recvT, 30, 120); }
        // 지도는 바뀔 때·가끔만 옴 → 받아 둔 것을 채워 넣음
        if (m.s.sto?.cl) { const k = `${m.s.sto.ch}-${m.s.sto.st}`; if (k !== g.lastClear) { g.lastClear = k; g.cxp = (g.cxp || 0) + (m.s.sto.boss ? ACCOUNT.xp.stage + ACCOUNT.xp.boss : ACCOUNT.xp.stage); } }
        if (m.s.mp) g.mapRows = { v: m.s.mv, rows: m.s.mp };
        else if (g.mapRows) { m.s.mp = g.mapRows.rows; m.s.mv = g.mapRows.v; }
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
  saveRun(game);
  const already = game.settled;
  const r = settle(game);
  if (!already) rewardToast(r);
  game.room?.close(); game.conn?.close();
  game = null;
  $controls.hidden = true; $hudTop.hidden = true; $code.hidden = true;
  if (!keepCfg) toMenu();
}
// 스토리 진행 저장 (방장·혼자일 때만): 다음에 그 스테이지부터 이어서
function saveRun(g) {
  if (!g || g.role === 'client' || g.state.mode !== 'story') return;
  if (g.ended) { SV.setRun(null); return; }
  const r = SIM.runSummary(g.state, g.myId);
  if (r) SV.setRun(r);
}
// 판 정산: 스토리 골드를 저장
// 보상: 계정 경험치 · 보스 열쇠 · 처음 도달한 스테이지 보상
function settle(g) {
  if (g.settled) return g.rewards;
  g.settled = true;
  const out = { xp: 0, ups: [], reach: [], keys: 0 };
  if (g.role === 'client') { // 참가자: 골드는 받을 때마다 저장, 경험치는 깬 스테이지만큼
    out.xp = g.cxp || 0; out.ups = SV.addXp(out.xp);
    g.rewards = out; return out;
  }
  const s = g.state;
  const me = s.heroes[g.myId];
  if (s.mode === 'story') {
    if (s.gold > 0) SV.addGold(s.gold);
    out.xp = (s.clears || 0) * ACCOUNT.xp.stage + (s.bossClears || 0) * ACCOUNT.xp.boss;
    out.keys = (s.bossClears || 0) * ACCOUNT.bossKeys;
    if (out.keys) SV.addKeys(out.keys);
    const S = s.story;
    const reached = S.ch * 5 + S.st + 1 + (S.phase === 'done' || S.cleared ? 1 : 0);
    out.reach = SV.reachRewards(reached);
    SV.stat('kills', s.kills || 0);
  } else out.xp = g.coloXp || 0;
  out.ups = SV.addXp(out.xp);
  if (me) { SV.stat('bestCombo', me.maxCombo, true); SV.stat('runs', 1); }
  g.rewards = out;
  return out;
}
// 나가거나 끝났을 때 받은 보상을 짧게 알림
function rewardToast(r) {
  if (!r) return;
  const parts = [];
  if (r.xp) parts.push(`경험치 +${r.xp}`);
  if (r.keys) parts.push(`🔑 +${r.keys}`);
  for (const x of r.reach) parts.push(`첫 도달 보상 🔑${x.keys} 💰${x.gold}`);
  for (const u of r.ups) parts.push(`계정 Lv ${u.lv}! 🔑${u.keys} 💰${u.gold}`);
  if (parts.length) UI.toast(parts.join(' · '));
}
function togglePause() {
  if (!game) return;
  if (game.paused) { handlers.resume(); return; }
  game.paused = true;
  UI.pause(handlers, { code: game.code, muted: SV.S().muted, story: game.state?.mode === 'story' && game.role !== 'client' });
}
document.getElementById('btnPause').addEventListener('click', togglePause);

// 스토리 끝 / 콜로세움 판 끝 감지
function checkEnd() {
  const g = game;
  if (!g || g.ended || g.role === 'client') return;
  const s = g.state;
  if (s.mode === 'story' && (s.story.phase === 'done' || s.story.phase === 'fail') && s.story.t < 97.5) {
    g.ended = true;
    SV.setRun(null);
    const win = s.story.phase === 'done';
    // 도달한 곳 (1-1 = 1 … 4-5 = 20, 끝까지 깨면 21)
    const reached = s.story.ch * 5 + s.story.st + 1 + (win ? 1 : 0);
    const prevBest = SV.S().stats.best || 0;
    if (win) { SV.stat('wins', 1); SV.clearChapter(CHAPTERS.length - 1); }
    else SV.clearChapter(Math.max(-1, s.story.ch - 1));
    const gold = s.gold;
    const rw = settle(g);
    const me = s.heroes[g.myId];
    SV.stat('bestLevel', s.level, true);
    UI.hideAug();
    const where = `${s.story.ch + 1}-${s.story.st + 1}`;
    UI.result(handlers, { win, title: win ? '모험 완료!' : `${where}에서 전멸…`, gold, combo: me?.maxCombo || 0, augs: me?.augs || [], retry: true, rewards: rw,
      note: (reached > prevBest && !win ? '🏆 최고 기록 갱신! ' : '') + (win ? '모든 장을 돌파했어요! 골드로 새 영웅을 영입해 다시 도전해 보세요.' : '모은 골드는 그대로 받습니다. 다음 모험은 다시 1-1부터!') });
  }
  // 콜로세움: 봇 상대로 이기면 골드 (판마다 한 번)
  if (s.mode === 'colosseum' && s.colo.over && !g.coloPaid) {
    g.coloPaid = true;
    const me = s.heroes[g.myId];
    const won = me && me.team === s.colo.winTeam;
    g.coloXp = (g.coloXp || 0) + ACCOUNT.xp.coloGame + (won ? ACCOUNT.xp.coloWin : 0);
    if (me) SV.stat('kos', me.kos || 0);
    if (won) { SV.addGold(COLOSSEUM.winGold); SV.stat('coloWins', 1); UI.toast(`승리 보상 +${COLOSSEUM.winGold} G · 경험치 +${ACCOUNT.xp.coloGame + ACCOUNT.xp.coloWin}`); }
  }
  if (s.mode === 'colosseum' && !s.colo.over) g.coloPaid = false;
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
      const inp = readInput(meH, view);
      if (g.pick !== undefined) { inp.pick = g.pick; g.pick = undefined; }
      g.conn.send({ t: 'in', i: inp });
      tapped.clear();
    }
    R.render(view, g.myId, { aim: !isTouch, target: findTarget(meH, view) });
    updateSkillButtons(meH);
    syncAug(meH);
    return;
  }
  // 방장 / 혼자 (혼자일 때 증강을 고르는 동안은 멈춤)
  const meNow = g.state.heroes[g.myId];
  const frozen = g.role === 'solo' && meNow?.choice;
  if (!frozen && (!g.paused || g.role === 'host')) {
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
  if (g.state.mode === 'story' && !g.ended) {
    const key = `${g.state.story.ch}-${g.state.story.st}`;
    if (key !== g.stageKey && g.state.story.phase === 'intro') { g.stageKey = key; saveRun(g); }
  }
  if (g.role === 'host' && g.room) {
    g.sendT -= dt;
    if (g.sendT <= 0) {
      g.sendT = 0.05;
      // 지도 글자는 바뀐 직후 1.5초 동안 + 3초마다만 보냄 (나머지는 생략)
      const nowMs = performance.now();
      const key = snap.mk + '|' + snap.mv;
      if (key !== g.mapKeySent) { g.mapKeySent = key; g.mapSentAt = nowMs; }
      const withMap = nowMs - g.mapSentAt < 1500 || nowMs - (g.mapFullAt || 0) > 3000;
      if (withMap) g.mapFullAt = nowMs;
      g.room.broadcast({ t: 's', s: withMap ? snap : { ...snap, mp: null } });
    }
  }
  R.render(snap, g.myId, { aim: !isTouch, frozen, target: findTarget(snap.h.find((h) => h.id === g.myId), snap) });
  const meSnap = snap.h.find((h) => h.id === g.myId);
  updateSkillButtons(meSnap);
  syncAug(meSnap);
  checkEnd();
}
// 증강 카드: 내 영웅에게 고를 것이 있으면 보여 줌
function syncAug(meH) {
  if (meH?.cho && !game.ended && !(game.pickHold > performance.now())) UI.showAug(meH.cho, pickAug);
  else UI.hideAug();
}
function pickAug(i) {
  const g = game;
  if (!g) return;
  if (g.role === 'client') { g.pick = i; g.pickHold = performance.now() + 600; }
  else SIM.pickAug(g.state, g.myId, i);
  UI.hideAug();
}
// 참가자: 받은 두 상태 사이를 부드럽게 이어 그림
function interpolate(g, now) {
  const a = g.prev, b = g.snap;
  if (!a || a.mk !== b.mk || a.rid !== b.rid) return b;
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
    ks.forEach((k, i) => SIM.addHero(backdrop, 'b' + i, CHARS[k].name, k, { bot: true, slot: i, team: i + 1 }));
  }
  SIM.step(backdrop, {}, 1 / 60);
  if (backdrop.colo.over && backdrop.colo.t < 1) backdrop = null;
  else R.render(SIM.snapshot(backdrop), null, { shakeMul: 0.3, noHud: true });
}

// 예전에 게스트로 하던 사람은 로그인 메뉴를 건너뜀
try { if (!gAcc && SV.hasLocal(null) && !localStorage.getItem(SEEN_KEY)) localStorage.setItem(SEEN_KEY, '1'); } catch { /* 무시 */ }
UI.start(handlers);
requestAnimationFrame(frame);
// 디버그·테스트용
window.__ea = { get game() { return game; }, SIM, SV, startGame, quitGame, joinGame };
