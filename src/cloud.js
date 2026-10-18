// 구글 로그인 + 클라우드 저장
// 로그인 창(팝업)만 Firebase 공식 라이브러리로 띄우고, 로그인 유지·저장은 REST로 직접 합니다.
// 저장 위치: saves/{uid}/ea = { data: "저장 JSON 문자열", t: 저장 시각 }
//   (예전 던전 슈터 저장과 같은 칸 saves/{uid} 안에 'ea'로 따로 둠)
import { FIREBASE } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const AUTH_KEY = 'elementArena.auth';
let sdk = null, sdkPromise = null;
let session = null; // { uid, idToken, refreshToken, exp, name, email }

const safeGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const safeSet = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } };

// 저장된 로그인 정보 (새로 고침해도 유지)
export function savedAccount() {
  const a = safeGet(AUTH_KEY);
  return a?.uid && a?.refreshToken ? a : null;
}

// 팝업은 버튼을 누른 순간에 열어야 막히지 않아서, 라이브러리를 미리 받아 둠
export function preloadGoogle() {
  if (sdk) return Promise.resolve(sdk);
  if (!sdkPromise) {
    sdkPromise = Promise.all([import(`${SDK}firebase-app.js`), import(`${SDK}firebase-auth.js`)])
      .then(([app, au]) => {
        const a = app.getApps().find((x) => x.name === 'ea') || app.initializeApp({ apiKey: FIREBASE.apiKey, authDomain: FIREBASE.authDomain, databaseURL: FIREBASE.databaseURL }, 'ea');
        const auth = au.getAuth(a);
        au.setPersistence(auth, au.inMemoryPersistence).catch(() => {});
        sdk = { au, auth };
        return sdk;
      })
      .catch((e) => { sdkPromise = null; throw e; });
  }
  return sdkPromise;
}

const ERR = {
  'auth/popup-blocked': '팝업이 막혔어요. 팝업을 허용하고 다시 눌러 주세요',
  'auth/popup-closed-by-user': '로그인 창을 닫았어요',
  'auth/cancelled-popup-request': '로그인 창을 닫았어요',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인된 도메인에 없어요',
  'auth/operation-not-allowed': 'Firebase에서 Google 로그인이 꺼져 있어요',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요',
};
export const googleError = (e) => ERR[e?.code] || e?.message || String(e);

export async function googleSignIn() {
  if (!sdk) {
    await preloadGoogle();
    throw new Error('로그인 준비가 끝났어요. 버튼을 한 번 더 눌러 주세요');
  }
  const { au, auth } = sdk;
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await au.signInWithPopup(auth, provider); // 반드시 맨 먼저 (팝업 차단 방지)
  const user = result.user;
  session = {
    uid: user.uid, idToken: await user.getIdToken(), refreshToken: user.refreshToken, exp: Date.now() + 3300e3,
    name: user.displayName || '', email: user.email || '',
  };
  safeSet(AUTH_KEY, { uid: session.uid, refreshToken: session.refreshToken, name: session.name, email: session.email });
  au.signOut(auth).catch(() => {});
  return session;
}
export function signOut() {
  session = null;
  safeSet(AUTH_KEY, null);
}

async function postForm(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}
// 로그인 유지: 갱신 토큰으로 새 출입증 받기
async function auth() {
  if (session && session.exp > Date.now() + 60000) return session;
  const saved = session || savedAccount();
  if (!saved) throw new Error('로그인이 필요해요');
  try {
    const r = await postForm(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, { grant_type: 'refresh_token', refresh_token: saved.refreshToken });
    session = { ...saved, uid: r.user_id, idToken: r.id_token, refreshToken: r.refresh_token, exp: Date.now() + Number(r.expires_in) * 1000 };
    safeSet(AUTH_KEY, { uid: session.uid, refreshToken: session.refreshToken, name: session.name, email: session.email });
    return session;
  } catch {
    throw new Error('구글 로그인이 만료됐어요. 다시 로그인해 주세요');
  }
}
async function db(method, path, body) {
  const s = await auth();
  const res = await fetch(`${FIREBASE.databaseURL}/${path}.json?auth=${encodeURIComponent(s.idToken)}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? '저장 권한이 없어요' : data?.error || `HTTP ${res.status}`);
  return data;
}

export async function pullSave(uid) {
  const r = await db('GET', `saves/${uid}/ea`);
  if (!r?.data) return null;
  try { return { save: JSON.parse(r.data), t: Number(r.t) || 0 }; } catch { return null; }
}

let pending = null, timer = 0, status = '', listener = null;
export const cloudStatus = () => status;
export function onCloudStatus(fn) { listener = fn; }
const setStatus = (s) => { status = s; listener?.(s); };
// 저장할 때마다 부르면 잠깐 모았다가 한 번에 올림
export function queuePush(uid, save) {
  pending = { uid, data: JSON.stringify(save), t: save._t || Date.now() };
  clearTimeout(timer);
  timer = setTimeout(flushPush, 2500);
  setStatus('저장 중…');
}
export async function flushPush() {
  clearTimeout(timer);
  if (!pending) return;
  const p = pending;
  pending = null;
  try {
    await db('PUT', `saves/${p.uid}/ea`, { data: p.data, t: p.t });
    setStatus('클라우드에 저장됨');
  } catch (e) {
    setStatus(`클라우드 저장 실패: ${e.message}`);
    if (!pending) pending = p;
  }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPush(); });
addEventListener('pagehide', () => flushPush());
