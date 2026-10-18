// Firebase 설정 (예전 '던전 슈터'와 같은 프로젝트)
// 구글 로그인: Firebase 콘솔 → Authentication → 로그인 방법 → Google 사용,
//   설정 → 승인된 도메인에 kimjaeyun091018-spec.github.io (이미 추가되어 있음)
// apiKey는 공개돼도 괜찮은 값이에요. 안전은 데이터베이스 규칙(saves/{uid}는 본인만)이 지켜 줍니다.
export const FIREBASE = {
  apiKey: 'AIzaSyD_bGIXNy_n0QEhYqaTUS6y97CPBc5tbdQ',
  databaseURL: 'https://dongeon-shooter-default-rtdb.firebaseio.com',
  authDomain: 'dongeon-shooter.firebaseapp.com',
};
