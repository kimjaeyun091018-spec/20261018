// 친구 · 길드 · 접속 표시 (Firebase Realtime Database, 구글 로그인 필요)
//  eaProf/{uid}            = { nick, alv, char, t(마지막 신호), room(방 코드), guild }  ← 누구나 읽기, 본인만 쓰기
//  eaFriends/{uid}/{친구}   = { nick, t }   ← 본인만
//  eaFreq/{uid}/{보낸이}    = { nick, t }   ← 친구 요청 (보낸이가 쓰고, 받은이가 지움)
//  eaFacc/{uid}/{수락한이}  = { nick, t }   ← "요청을 수락했어요" 알림 (수락한 사람이 씀)
//  eaGuilds/{gid}          = { name, desc, owner, t }
//  eaGuildNames/{이름키}    = gid           ← 길드 이름은 하나뿐
//  eaGuildMembers/{gid}/{uid} = { nick, role, t }
import { cloudDb as db, myUid, nickOwner, nickKeyOf, beaconPatch } from './cloud.js';

export const ONLINE_MS = 150000; // 마지막 신호가 2분 30초 안이면 접속 중
export const GUILD_RULE = /^[가-힣A-Za-z0-9_ ]{2,12}$/;
export const GUILD_MAX = 30;
const now = () => Date.now();
const permErr = (e) => {
  if (e?.status === 401 || e?.status === 403) return new Error('서버 권한이 없어요 — README의 데이터베이스 규칙(친구·길드)을 추가해 주세요');
  return e;
};
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw permErr(e); } };
export const isOnline = (p) => !!p && now() - (p.t || 0) < ONLINE_MS;

// ---------- 접속 신호 ----------
let beat = 0, me = null, extra = {};
export function startPresence(info) {
  me = { ...me, ...info };
  const send = async () => {
    try {
      const uid = await myUid();
      await db('PATCH', `eaProf/${uid}`, { ...me, ...extra, t: now() });
    } catch { /* 규칙이 없거나 오프라인이면 조용히 */ }
  };
  clearInterval(beat);
  send();
  beat = setInterval(send, 60000);
}
export function setPresence(info) { extra = { ...extra, ...info }; if (me) startPresence({}); }
export function stopPresence() {
  clearInterval(beat); beat = 0;
  myUid().then((uid) => beaconPatch(`eaProf/${uid}`, { t: 0, room: null })).catch(() => {});
  me = null; extra = {};
}
addEventListener('pagehide', () => { if (me) myUid().then((uid) => beaconPatch(`eaProf/${uid}`, { t: 0, room: null })).catch(() => {}); });

export const getProfile = wrap(async (uid) => db('GET', `eaProf/${uid}`));

// ---------- 친구 ----------
export const sendRequest = wrap(async (nick, myNick) => {
  const uid = await myUid();
  const to = await nickOwner(nick);
  if (!to) throw new Error('그 닉네임을 가진 사람이 없어요');
  if (to === uid) throw new Error('나 자신에게는 보낼 수 없어요');
  const already = await db('GET', `eaFriends/${uid}/${to}`);
  if (already) throw new Error('이미 친구예요');
  await db('PUT', `eaFreq/${to}/${uid}`, { nick: myNick, t: now() });
  return `${nick} 님에게 친구 요청을 보냈어요`;
});
// 친구 화면을 열 때: 수락 알림 처리 → 목록·요청·접속 상태
export const loadFriends = wrap(async () => {
  const uid = await myUid();
  const acc = (await db('GET', `eaFacc/${uid}`)) || {};
  for (const [f, v] of Object.entries(acc)) {
    await db('PUT', `eaFriends/${uid}/${f}`, { nick: v.nick, t: now() });
    await db('DELETE', `eaFacc/${uid}/${f}`).catch(() => {});
  }
  const friends = (await db('GET', `eaFriends/${uid}`)) || {};
  const reqs = (await db('GET', `eaFreq/${uid}`)) || {};
  const list = await Promise.all(Object.entries(friends).map(async ([f, v]) => {
    const p = await db('GET', `eaProf/${f}`).catch(() => null);
    return { uid: f, nick: p?.nick || v.nick, prof: p, online: isOnline(p) };
  }));
  list.sort((a, b) => b.online - a.online || (b.prof?.t || 0) - (a.prof?.t || 0));
  return { list, reqs: Object.entries(reqs).map(([from, v]) => ({ uid: from, nick: v.nick, t: v.t })), newly: Object.values(acc).map((v) => v.nick) };
});
export const acceptRequest = wrap(async (from, nick, myNick) => {
  const uid = await myUid();
  await db('PUT', `eaFriends/${uid}/${from}`, { nick, t: now() });
  await db('PUT', `eaFacc/${from}/${uid}`, { nick: myNick, t: now() });
  await db('DELETE', `eaFreq/${uid}/${from}`);
});
export const declineRequest = wrap(async (from) => { const uid = await myUid(); await db('DELETE', `eaFreq/${uid}/${from}`); });
export const removeFriend = wrap(async (f) => { const uid = await myUid(); await db('DELETE', `eaFriends/${uid}/${f}`); });

// ---------- 길드 ----------
const gKey = (n) => nickKeyOf(String(n).trim());
export const myGuild = wrap(async () => {
  const uid = await myUid();
  const p = await db('GET', `eaProf/${uid}`);
  if (!p?.guild) return null;
  const g = await db('GET', `eaGuilds/${p.guild}`);
  if (!g) return null;
  const mem = (await db('GET', `eaGuildMembers/${p.guild}`)) || {};
  if (!mem[uid]) return null; // 쫓겨났거나 해체됨
  const members = await Promise.all(Object.entries(mem).map(async ([m, v]) => {
    const pr = m === uid ? { ...p, t: now() } : await db('GET', `eaProf/${m}`).catch(() => null);
    return { uid: m, nick: pr?.nick || v.nick, role: v.role, prof: pr, online: isOnline(pr), me: m === uid };
  }));
  members.sort((a, b) => (b.role === 'owner') - (a.role === 'owner') || b.online - a.online || (b.prof?.alv || 0) - (a.prof?.alv || 0));
  return { id: p.guild, ...g, members, mine: g.owner === uid };
});
export const listGuilds = wrap(async () => {
  const all = (await db('GET', 'eaGuilds', undefined, '&orderBy="$key"&limitToLast=40')) || {};
  const out = await Promise.all(Object.entries(all).map(async ([id, g]) => {
    const m = (await db('GET', `eaGuildMembers/${id}`, undefined, '&shallow=true').catch(() => null)) || {};
    return { id, ...g, count: Object.keys(m).length };
  }));
  return out.filter((g) => g.name).sort((a, b) => b.count - a.count || (b.t || 0) - (a.t || 0));
});
export const createGuild = wrap(async (name, desc, myNick) => {
  name = String(name || '').trim();
  if (!GUILD_RULE.test(name)) throw new Error('길드 이름은 한글·영어·숫자로 2~12자');
  const uid = await myUid();
  const taken = await db('GET', `eaGuildNames/${gKey(name)}`);
  if (taken) throw new Error('이미 있는 길드 이름이에요');
  const gid = `g${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await db('PUT', `eaGuilds/${gid}`, { name, desc: String(desc || '').slice(0, 60), owner: uid, t: now() });
  try { await db('PUT', `eaGuildNames/${gKey(name)}`, gid); } catch (e) { await db('DELETE', `eaGuilds/${gid}`).catch(() => {}); throw new Error('이미 있는 길드 이름이에요'); }
  await db('PUT', `eaGuildMembers/${gid}/${uid}`, { nick: myNick, role: 'owner', t: now() });
  await db('PATCH', `eaProf/${uid}`, { guild: gid });
  extra.guild = gid;
  return gid;
});
export const joinGuild = wrap(async (gid, myNick) => {
  const uid = await myUid();
  const m = (await db('GET', `eaGuildMembers/${gid}`, undefined, '&shallow=true')) || {};
  if (Object.keys(m).length >= GUILD_MAX) throw new Error(`길드가 가득 찼어요 (${GUILD_MAX}명)`);
  await db('PUT', `eaGuildMembers/${gid}/${uid}`, { nick: myNick, role: 'member', t: now() });
  await db('PATCH', `eaProf/${uid}`, { guild: gid });
  extra.guild = gid;
});
export const leaveGuild = wrap(async (g) => {
  const uid = await myUid();
  const others = g.members.filter((m) => !m.me);
  if (g.mine && others.length) {
    // 길드장이 나가면 가장 레벨 높은 사람에게 넘김
    const next = others.sort((a, b) => (b.prof?.alv || 0) - (a.prof?.alv || 0))[0];
    await db('PATCH', `eaGuilds/${g.id}`, { owner: next.uid });
    await db('PATCH', `eaGuildMembers/${g.id}/${next.uid}`, { role: 'owner' });
  }
  await db('DELETE', `eaGuildMembers/${g.id}/${uid}`);
  if (g.mine && !others.length) { // 마지막 사람: 길드 해체
    await db('DELETE', `eaGuildNames/${gKey(g.name)}`).catch(() => {});
    await db('DELETE', `eaGuilds/${g.id}`).catch(() => {});
  }
  await db('PATCH', `eaProf/${uid}`, { guild: null });
  extra.guild = null;
});
export const kickMember = wrap(async (g, m) => { await db('DELETE', `eaGuildMembers/${g.id}/${m}`); });
export const setGuildDesc = wrap(async (g, desc) => { await db('PATCH', `eaGuilds/${g.id}`, { desc: String(desc || '').slice(0, 60) }); });
