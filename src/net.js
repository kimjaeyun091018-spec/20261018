// 함께하기: PeerJS(WebRTC P2P). 방장 브라우저가 게임을 계산하고, 참가자는 입력만 보냄.
// 서로를 찾는 과정(시그널링)만 PeerJS 무료 공개 서버를 사용합니다.
const PREFIX = 'ea20261018-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode() {
  let c = '';
  for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
function ensurePeer() {
  if (typeof window.Peer !== 'function') throw new Error('PeerJS를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
}
export function describeError(err) {
  switch (err?.type) {
    case 'peer-unavailable': return '그 코드의 방을 찾을 수 없어요.';
    case 'unavailable-id': return '방 코드가 이미 사용 중이에요.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return '연결 서버에 접속하지 못했어요.';
    case 'browser-incompatible': return '이 브라우저는 P2P 연결을 지원하지 않아요.';
    default: return err?.message || String(err);
  }
}

// handlers: onJoin(id, hello) → true/false, onMsg(id, msg), onLeave(id), onError(err)
export function hostRoom(code, handlers) {
  ensurePeer();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer(PREFIX + code);
    const conns = new Map();
    let opened = false;
    peer.on('open', () => {
      opened = true;
      resolve({
        code,
        broadcast(m) { for (const c of conns.values()) if (c.open) c.send(m); },
        send(id, m) { const c = conns.get(id); if (c?.open) c.send(m); },
        count: () => conns.size,
        close() { peer.destroy(); },
      });
    });
    peer.on('error', (e) => { if (!opened) { peer.destroy(); reject(e); } else handlers.onError?.(e); });
    peer.on('connection', (conn) => {
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'join') {
          if (conns.has(conn.peer)) return;
          if (!handlers.onJoin(conn.peer, m)) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
          conns.set(conn.peer, conn);
          conn.send({ t: 'welcome', id: conn.peer });
        } else if (conns.has(conn.peer)) handlers.onMsg(conn.peer, m);
      });
      conn.on('close', () => { if (conns.delete(conn.peer)) handlers.onLeave(conn.peer); });
    });
  });
}

// handlers: onWelcome(id), onMsg(msg), onClose(reason)
export function joinRoom(code, hello, handlers) {
  ensurePeer();
  return new Promise((resolve, reject) => {
    const peer = new window.Peer();
    let joined = false, timer = null;
    const fail = (e) => { clearTimeout(timer); if (!joined) { peer.destroy(); reject(e); } else handlers.onClose?.(describeError(e)); };
    peer.on('error', fail);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      timer = setTimeout(() => fail({ type: 'peer-unavailable' }), 10000);
      conn.on('open', () => conn.send({ t: 'join', ...hello }));
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'welcome') {
          clearTimeout(timer); joined = true;
          handlers.onWelcome(m.id);
          resolve({ send(x) { if (conn.open) conn.send(x); }, close() { peer.destroy(); } });
        } else if (m.t === 'full') fail(new Error('방이 가득 찼어요 (최대 4명).'));
        else handlers.onMsg(m);
      });
      conn.on('close', () => { if (joined) handlers.onClose?.('방장과의 연결이 끊겼어요.'); });
    });
  });
}
