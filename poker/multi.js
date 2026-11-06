'use strict';
/* 친구와 하기 — PeerJS(WebRTC P2P)
   · 방장 브라우저가 카드를 섞고 게임을 진행해요. 친구는 자기 차례에 고른 행동만 보내요.
   · 친구에게는 자기 카드와 공개된 카드만 보내서, 남의 패를 엿볼 수 없어요.
   · 서로를 찾는 과정(시그널링)에만 PeerJS 무료 공개 서버를 써요. */

const NET_PREFIX = 'pk20261018-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AVATARS = ['🙂', '😎', '🤠', '🥳', '🤓', '😺'];
const MAX_SEATS = 6;
const ASK_TIMEOUT = 60000;
const RAISE_LABELS = ['삥', '따당', '하프'];

const M = {
  role: null, peer: null, code: '',
  conns: new Map(),      // 방장: 피어 id → 연결
  lobby: [],             // 방장: [{ peer, name, avatar }]
  mode: 'holdem', bots: 1, started: false,
  pending: new Map(),    // 방장: 피어 id → { seq, finish }
  seq: 0, host: null,    // 참가자: 방장 연결
};

const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const cleanName = s => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 10) || '손님';
function netError(e) {
  switch (e && e.type) {
    case 'peer-unavailable': return '그 코드의 방을 찾을 수 없어요.';
    case 'unavailable-id': return '방 코드가 이미 사용 중이에요. 다시 눌러 주세요.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return '연결 서버에 접속하지 못했어요. 인터넷을 확인해 주세요.';
    case 'browser-incompatible': return '이 브라우저는 P2P 연결을 지원하지 않아요.';
    default: return (e && e.message) || String(e);
  }
}
function needPeer() {
  if (typeof window.Peer !== 'function') throw new Error('연결 모듈을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.');
}

// ───────────── 방장 ─────────────
function hostCreate(name) {
  needPeer();
  return new Promise((resolve, reject) => {
    const code = makeCode();
    const peer = new window.Peer(NET_PREFIX + code);
    let opened = false;
    peer.on('open', () => {
      opened = true;
      Object.assign(M, { role: 'host', peer, code, lobby: [{ peer: null, name, avatar: AVATARS[0] }] });
      resolve();
    });
    peer.on('error', e => { if (!opened) { peer.destroy(); reject(e); } });
    peer.on('connection', conn => {
      conn.on('data', m => onHostData(conn, m));
      conn.on('close', () => onHostLeave(conn.peer));
    });
  });
}

const sendTo = (id, m) => { const c = M.conns.get(id); if (c && c.open) c.send(m); };
const broadcast = m => { for (const c of M.conns.values()) if (c.open) c.send(m); };

function onHostData(conn, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'join') {
    if (M.conns.has(conn.peer)) return;
    if (M.started || M.lobby.length >= MAX_SEATS) {
      conn.send({ t: 'full', reason: M.started ? '이미 게임이 시작된 방이에요.' : '방이 가득 찼어요 (최대 6명).' });
      setTimeout(() => conn.close(), 300);
      return;
    }
    M.conns.set(conn.peer, conn);
    const used = new Set(M.lobby.map(x => x.avatar));
    M.lobby.push({ peer: conn.peer, name: cleanName(m.name), avatar: AVATARS.find(a => !used.has(a)) || '🙂' });
    M.bots = Math.min(M.bots, MAX_SEATS - M.lobby.length);
    conn.send({ t: 'welcome' });
    sendLobby();
    return;
  }
  if (!M.conns.has(conn.peer)) return;
  if (m.t === 'act' || m.t === 'choose') {
    const pend = M.pending.get(conn.peer);
    if (pend && pend.seq === m.seq) pend.finish(m);
  }
}

function onHostLeave(id) {
  if (!M.conns.delete(id)) return;
  if (!M.started) {
    M.lobby = M.lobby.filter(x => x.peer !== id);
    sendLobby();
    return;
  }
  const p = P().find(q => q.remote === id);
  if (!p) return;
  p.remote = null;
  p.style = BOT_PROFILES[1];
  log(`${p.name} 연결 끊김 → 봇이 대신해요`, 'sys');
  p.name += ' (봇)';
  const pend = M.pending.get(id);
  if (pend) pend.finish(null);
  render();
}

function sendLobby() {
  const msg = { t: 'lobby', code: M.code, players: M.lobby.map(x => ({ name: x.name, avatar: x.avatar })), mode: M.mode, bots: M.bots };
  broadcast(msg);
  renderLobby(msg, true);
}

// 친구 자리에서 보이는 것만 담은 상태
function snapshotFor(v) {
  return {
    mode: S.mode, handNo: S.handNo, level: S.level, dealer: S.dealer, board: S.board,
    stage: S.stage, stageLabel: S.stageLabel, currentBet: S.currentBet, minRaise: S.minRaise,
    toAct: S.toAct, highlight: [...S.highlight], msg: S.msg, me: v, multi: true, roomCode: M.code,
    players: P().map((p, i) => ({
      name: p.name, avatar: p.avatar, chips: p.chips, bet: p.bet, total: p.total,
      folded: p.folded, allIn: p.allIn, out: p.out, raises: p.raises, last: p.last,
      show: p.show, winner: p.winner,
      hand: p.hand.map(c => (i === v || p.show || c.up) ? { r: c.r, s: c.s, up: !!c.up } : { up: false }),
    })),
  };
}

function syncAll() {
  if (M.role !== 'host' || !M.started) return;
  for (const id of M.conns.keys()) {
    const v = P().findIndex(p => p.remote === id);
    if (v >= 0) sendTo(id, { t: 'state', s: snapshotFor(v) });
  }
}

// 친구에게 행동을 물어보고 기다림 (시간 초과 → 다이/폴드, 연결 끊김 → 봇)
function askRemote(p, kind) {
  return new Promise(resolve => {
    const id = p.remote, seq = ++M.seq;
    let timer = null, done = false;
    const finish = m => {
      if (done) return; done = true;
      clearTimeout(timer);
      M.pending.delete(id);
      resolve(decodeReply(p, kind, m));
    };
    M.pending.set(id, { seq, finish });
    syncAll();
    sendTo(id, { t: 'ask', kind, seq });
    timer = setTimeout(() => {
      sendTo(id, { t: 'cancel' });
      log(`${p.name} 시간 초과`, 'sys');
      finish({ timeout: true });
    }, ASK_TIMEOUT);
  });
}

function decodeReply(p, kind, m) {
  if (kind === 'choose') {
    if (m && !m.timeout) {
      const d = p.hand.find(c => cid(c) === m.discard), o = p.hand.find(c => cid(c) === m.open);
      if (d && o && d !== o) return { discard: d, open: o };
    }
    return botChoice(p);
  }
  if (!m) return isSeven() ? botActionSeven(p) : botAction(p); // 연결 끊김
  if (m.timeout) return { type: 'fold' };
  const a = m.a || {};
  const type = ['fold', 'check', 'call', 'raise'].includes(a.type) ? a.type : 'fold';
  const out = { type };
  if (type === 'raise') {
    out.to = Math.floor(Number(a.to)) || 0;
    if (RAISE_LABELS.includes(a.label)) out.label = a.label;
  }
  return out;
}

function hostStart() {
  M.started = true;
  const players = M.lobby.map((h, i) => mkPlayer({
    name: h.name, avatar: h.avatar, human: i === 0, remote: h.peer, style: BOT_PROFILES[1],
  }));
  let bots = Math.min(M.bots, MAX_SEATS - players.length);
  if (players.length + bots < 2) bots = 1;
  for (let i = 0; i < bots; i++) players.push(mkPlayer({ ...BOT_PROFILES[i], style: BOT_PROFILES[i] }));
  startState(players, M.mode);
  S.multi = true; S.roomCode = M.code;
  hooks.render = syncAll;
  hooks.log = (text, kind) => broadcast({ t: 'log', text, kind });
  hooks.ask = askRemote;
  hooks.wait = ms => broadcast({ t: 'wait', ms });
  hooks.end = w => broadcast({ t: 'end', winner: w >= 0 ? P()[w].name : '', winSeat: w, hands: S.handNo, chips: w >= 0 ? P()[w].chips : 0 });
  broadcast({ t: 'start', mode: M.mode });
  prepareTable(M.mode);
  render();
  gameLoop();
}

// ───────────── 참가자 ─────────────
function clientJoin(code, name) {
  needPeer();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer();
    let joined = false, timer = null;
    const fail = e => {
      clearTimeout(timer);
      if (!joined) { peer.destroy(); reject(e); } else lostHost(netError(e));
    };
    peer.on('error', fail);
    peer.on('open', () => {
      const conn = peer.connect(NET_PREFIX + code, { reliable: true });
      timer = setTimeout(() => fail({ type: 'peer-unavailable' }), 10000);
      conn.on('open', () => conn.send({ t: 'join', name }));
      conn.on('data', m => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'welcome') {
          clearTimeout(timer); joined = true;
          Object.assign(M, { role: 'client', peer, host: conn, code });
          resolve();
        } else if (m.t === 'full') fail(new Error(m.reason || '방에 들어갈 수 없어요.'));
        else onClientData(m);
      });
      conn.on('close', () => { if (joined) lostHost('방장과의 연결이 끊겼어요.'); });
    });
  });
}

const toHost = m => { if (M.host && M.host.open) M.host.send(m); };

function onClientData(m) {
  switch (m.t) {
    case 'lobby': renderLobby(m, false); break;
    case 'start': prepareTable(m.mode); break;
    case 'state': {
      const st = m.s;
      st.highlight = new Set(st.highlight || []);
      S = st;
      render();
      break;
    }
    case 'log': log(m.text, m.kind); break;
    case 'ask': answerAsk(m); break;
    case 'cancel': clearControls('시간이 지나서 자동으로 처리됐어요.'); break;
    case 'wait': {
      const el = $('#controls');
      el.innerHTML = '<div class="turn">잠시 후 다음 판이 시작돼요…</div>';
      setTimeout(() => { if (el.querySelector('.turn') && !el.querySelector('button')) el.innerHTML = ''; }, m.ms || 6000);
      break;
    }
    case 'end': {
      const meWon = m.winSeat === S.me;
      showEnd(meWon ? '🏆 우승!' : m.winner ? `🏆 ${m.winner} 우승` : '게임 끝',
        m.winner ? `${m.hands}판 만에 끝났어요. 최종 칩 ${fmt(m.chips)}` : '사람은 모두 탈락했어요.');
      $('#btnAgain').textContent = '처음 화면으로';
      break;
    }
  }
}

function clearControls(note) {
  const el = $('#controls');
  el.innerHTML = note ? `<div class="turn">${note}</div>` : '';
  el.classList.remove('on');
}

async function answerAsk(m) {
  const p = S.players[S.me];
  if (m.kind === 'choose') {
    const ch = await humanChoose(p);
    toHost({ t: 'choose', seq: m.seq, discard: cid(ch.discard), open: cid(ch.open) });
  } else {
    const a = await (isSeven() ? humanActionSeven(p) : humanAction(p));
    toHost({ t: 'act', seq: m.seq, a });
  }
}

function lostHost(why) {
  if (!$('#end').hidden) return;
  showEnd('연결이 끊겼어요', why);
  $('#btnAgain').textContent = '처음 화면으로';
}

// ───────────── 대기실 화면 ─────────────
function renderLobby(m, isHost) {
  $('#start').hidden = true;
  $('#lobby').hidden = false;
  $('#roomCode').textContent = m.code;
  $('#lobbyCount').textContent = `${m.players.length}/${MAX_SEATS}`;
  $('#lobbyList').innerHTML = m.players.map((x, i) =>
    `<li><span class="av">${esc(x.avatar)}</span>${esc(x.name)}${i === 0 ? ' <em>방장</em>' : ''}</li>`).join('') +
    (m.bots ? `<li class="bots">🤖 봇 ${m.bots}명</li>` : '');
  $('#hostOpts').hidden = !isHost;
  $('#lobbyWait').hidden = isHost;
  if (isHost) {
    for (const b of $('#lmode').children) b.classList.toggle('on', b.dataset.m === m.mode);
    for (const b of $('#lbots').children) {
      const n = +b.dataset.n;
      b.classList.toggle('on', n === m.bots);
      b.disabled = m.players.length + n > MAX_SEATS;
    }
    const total = m.players.length + m.bots;
    $('#btnLobbyStart').disabled = total < 2;
    $('#btnLobbyStart').textContent = total < 2 ? '친구를 기다리거나 봇을 추가하세요' : `게임 시작 (${total}명)`;
  } else {
    $('#lobbyWait').textContent = `${m.mode === 'seven' ? '7포커' : '텍사스 홀덤'} · 방장이 게임을 시작하길 기다리는 중…`;
  }
}

if (HAS_DOM) {
  const nickEl = $('#nick'), codeEl = $('#joinCode'), errEl = $('#netErr');
  try { nickEl.value = localStorage.getItem('pk_name') || ''; } catch (e) { /* 저장 불가 */ }
  const nick = () => {
    const n = cleanName(nickEl.value);
    try { localStorage.setItem('pk_name', n); } catch (e) { /* 저장 불가 */ }
    return n;
  };
  const busy = (on, text = '') => {
    for (const b of [$('#btnHost'), $('#btnJoin')]) b.disabled = on;
    errEl.textContent = text;
    errEl.classList.toggle('info', on);
  };

  $('#playTabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $('#playTabs').children) x.classList.toggle('on', x === b);
    $('#soloPane').hidden = b.dataset.p !== 'solo';
    $('#multiPane').hidden = b.dataset.p !== 'multi';
  };

  $('#btnHost').onclick = async () => {
    busy(true, '방을 만드는 중…');
    try { await hostCreate(nick()); busy(false); sendLobby(); }
    catch (e) { busy(false, netError(e)); }
  };
  const join = async () => {
    const code = codeEl.value.trim().toUpperCase();
    if (code.length < 5) { errEl.textContent = '방 코드 5자리를 입력하세요.'; return; }
    busy(true, '방에 들어가는 중…');
    try { await clientJoin(code, nick()); busy(false); }
    catch (e) { busy(false, netError(e)); }
  };
  $('#btnJoin').onclick = join;
  codeEl.onkeydown = e => { if (e.key === 'Enter') join(); };
  codeEl.oninput = () => { codeEl.value = codeEl.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };

  $('#lmode').onclick = e => {
    const b = e.target.closest('button'); if (!b || M.role !== 'host') return;
    M.mode = b.dataset.m; sendLobby();
  };
  $('#lbots').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled || M.role !== 'host') return;
    M.bots = +b.dataset.n; sendLobby();
  };
  $('#btnLobbyStart').onclick = () => { if (M.role === 'host' && M.lobby.length + M.bots >= 2) hostStart(); };
  $('#btnCopy').onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${M.code}`;
    try { await navigator.clipboard.writeText(url); $('#btnCopy').textContent = '복사했어요! 친구에게 보내 주세요'; }
    catch (e) { prompt('이 링크를 친구에게 보내 주세요', url); }
  };
  $('#btnLeave').onclick = () => { location.href = location.pathname; };

  // 초대 링크로 들어온 경우
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    $('#playTabs').querySelector('[data-p="multi"]').click();
    codeEl.value = room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    nickEl.focus();
  }
}
