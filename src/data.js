// ============================================================
//  원소 아레나 — 수치 모음 (밸런스는 이 파일만 고치면 됩니다)
// ============================================================
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640
export const MAX_PLAYERS = 4;

// ---------- 넉백 (대난투식 %) ----------
// 날아가는 속도 = (base + growth × % / 100) / 무게.
// 스토리: % = 잃은 체력 비율 (체력이 적을수록 멀리 날아감) / 콜로세움: % = 받은 피해 누적, 체력 없음
export const KNOCK = {
  friction: 3.4, wallBounce: 0.55, wallHitSpeed: 360, wallHitDmg: 4,
  pitSpeed: 240, spikeDmg: 8, spikeKb: [260, 140],
  stunPer: 1 / 1700, stunMax: 0.75,
  colosseumPct: 0.45, // 콜로세움에서 피해 1당 % 증가량
};
// 타격감: 맞은 쪽·때린 쪽이 잠깐 멈춤 (히트스톱), 화면 흔들림
export const FEEL = { hitstopBase: 0.035, hitstopPerDmg: 0.0025, hitstopMax: 0.12, shakePerDmg: 0.35, shakeMax: 14 };
export const DASH = { dist: 130, time: 0.14, cd: 1.3, inv: 0.2 };

// ---------- 원소 ----------
export const ELEMENTS = {
  fire: { name: '불', color: '#ff7043', glow: '#ffab40' },
  lightning: { name: '번개', color: '#ffe14d', glow: '#fff59d' },
  ice: { name: '얼음', color: '#81d4fa', glow: '#e1f5fe' },
  wind: { name: '바람', color: '#a5d6a7', glow: '#e8f5e9' },
  earth: { name: '대지', color: '#c49a6c', glow: '#ffe0b2' },
  water: { name: '물', color: '#4fc3f7', glow: '#b3e5fc' },
  shadow: { name: '그림자', color: '#9c64ff', glow: '#d1b3ff' },
  poison: { name: '독', color: '#9ccc65', glow: '#dcedc8' },
};
// 원소를 맞으면 남는 상태
export const STATUS = {
  burn: { from: 'fire', time: 3, tick: 0.5, dmg: 2, name: '화상' },
  shock: { from: 'lightning', time: 2.5, name: '감전' },
  chill: { from: 'ice', time: 3, slow: 0.45, freezeAt: 3, name: '둔화' },
  wet: { from: 'water', time: 4, name: '젖음' },
  poison: { from: 'poison', time: 5, tick: 0.6, dmgPerStack: 1, maxStack: 6, name: '중독' },
  mark: { from: 'shadow', time: 4, name: '표식' },
};
// 원소 반응: [이미 있는 상태, 새로 맞은 원소] → 반응. 같은 편끼리 원소를 엮으면 콤보!
export const REACTIONS = [
  { has: 'wet', el: 'fire', id: 'steam', name: '증기 폭발', color: '#eceff1', r: 70, dmg: 14, kb: [180, 260] },
  { has: 'burn', el: 'water', id: 'steam', name: '증기 폭발', color: '#eceff1', r: 70, dmg: 14, kb: [180, 260] },
  { has: 'wet', el: 'lightning', id: 'electro', name: '감전 연쇄', color: '#fff176', chain: 4, dmg: 12, kb: [90, 140] },
  { has: 'shock', el: 'water', id: 'electro', name: '감전 연쇄', color: '#fff176', chain: 4, dmg: 12, kb: [90, 140] },
  { has: 'wet', el: 'ice', id: 'freeze', name: '빙결', color: '#b3e5fc', freeze: 1.6, dmg: 6 },
  { has: 'chill', el: 'water', id: 'freeze', name: '빙결', color: '#b3e5fc', freeze: 1.6, dmg: 6 },
  { has: 'chill', el: 'fire', id: 'melt', name: '융해', color: '#ffccbc', dmg: 22, kb: [120, 220] },
  { has: 'frozen', el: 'fire', id: 'melt', name: '융해', color: '#ffccbc', dmg: 26, kb: [120, 220] },
  { has: 'burn', el: 'ice', id: 'melt', name: '융해', color: '#ffccbc', dmg: 22, kb: [120, 220] },
  { has: 'burn', el: 'lightning', id: 'plasma', name: '플라즈마 폭발', color: '#e1bee7', r: 90, dmg: 18, kb: [260, 480] },
  { has: 'shock', el: 'fire', id: 'plasma', name: '플라즈마 폭발', color: '#e1bee7', r: 90, dmg: 18, kb: [260, 480] },
  { has: 'frozen', el: 'earth', id: 'shatter', name: '분쇄', color: '#e1f5fe', dmg: 30, kb: [300, 520] },
  { has: 'poison', el: 'fire', id: 'toxic', name: '독 폭발', color: '#c5e1a5', r: 80, dmg: 16, kb: [160, 260] },
  { has: 'mark', el: 'shadow', id: 'umbra', name: '그림자 폭발', color: '#d1b3ff', r: 50, dmg: 20, kb: [200, 360], self: true },
  // 바람은 상태를 퍼뜨림
  { has: 'burn', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'burn', dmg: 8, kb: [140, 200] },
  { has: 'shock', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'shock', dmg: 8, kb: [140, 200] },
  { has: 'chill', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'chill', dmg: 8, kb: [140, 200] },
  { has: 'wet', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'wet', dmg: 8, kb: [140, 200] },
  { has: 'poison', el: 'wind', id: 'swirl', name: '확산', color: '#c8e6c9', r: 110, spread: 'poison', dmg: 8, kb: [140, 200] },
];
// 투사체끼리 맞부딪힘: 힘 차이가 이보다 작으면 둘 다 사라짐. 서로 다른 원소면 그 자리에서 충돌 폭발
export const CLASH = { even: 0.35, burst: { r: 56, dmg: 5, kb: [150, 220] } };

// ---------- 캐릭터 12명 ----------
// rarity: 등급 (상자에서 나오는 확률) · price: 골드로 바로 영입하는 값 (매우 비쌈 → 보통은 상자에서 뽑기)
// row: assets/heroes.png 디자인 줄 · role: 역할 · 스킬 0 = 기본 공격, 1~3 = 스킬
// 스킬 종류(type): slash 베기 · shot 투사체 · dashstrike 돌진 베기 · stream 줄기 · blink 순간이동 · nova 주변 폭발
//                  zone 지대 · line 줄지어 솟음 · snipe 저격 · markall 표식 · detonate 기폭
export const CHARS = {
  knight: {
    name: '카이엔', title: '홍련의 기사', rarity: 'start', price: 0,
    lore: '멸망한 불꽃 왕국의 마지막 기사. 왕의 검에 깃든 꺼지지 않는 불꽃을 지키며, 다시는 아무것도 잃지 않겠다고 맹세했다.',
    quote: '이 불꽃이 꺼지는 일은 없다.', row: 0, el: 'fire', role: '근접 돌격', cloth: '#d32f2f', color: '#ff7043', hp: 130, speed: 175, weight: 1.15,
    desc: '삼연참으로 몰아붙이고, 불새 돌격으로 끝까지 날려 버리는 정면 돌격형. 화룡의 숨결로 날아오는 투사체를 되받아친다.',
    skills: [
      { name: '홍련 삼연참', type: 'slash', cd: 0.32, range: 64, arc: 1.5, dmg: 9, kb: [110, 200], el: 'fire', chain: [{ dmg: 9 }, { dmg: 10, arcMul: 1.1 }, { dmg: 16, kb: [220, 380], arcMul: 1.4, rangeMul: 1.2, big: true }] },
      { name: '업화구', type: 'shot', cd: 2.2, el: 'fire', speed: 420, r: 12, power: 2.2, dmg: 18, kb: [170, 300], life: 1.4, look: 'fireball', explode: { r: 48, dmg: 8, kb: [140, 200] } },
      { name: '불새 돌격', type: 'dashstrike', cd: 4.5, dist: 240, time: 0.18, width: 36, dmg: 22, kb: [240, 450], el: 'fire', look: 'flame' },
      { name: '화룡의 숨결', type: 'parry', cd: 6.5, el: 'fire', r: 118, dmg: 14, kb: [330, 470], window: 0.45, reflect: 1.6, desc: '검을 크게 한 바퀴 휘둘러 날아오는 투사체를 되받아치고(피해 1.6배), 주변 적을 바깥으로 밀쳐 냄' },
    ],
  },
  archer: {
    name: '세라', title: '뇌명의 사수', rarity: 'rare', price: 3000,
    lore: '번개가 떨어진 자리에서 태어났다는 숲의 사냥꾼. 활시위를 당길 때마다 머리카락이 곤두선다.',
    quote: '번개는 같은 곳에 두 번 안 떨어져. 내 화살은 떨어지지.', row: 1, el: 'lightning', role: '원거리 견제', cloth: '#f9a825', color: '#ffe14d', hp: 100, speed: 185, weight: 0.95,
    desc: '꿰뚫는 번개 화살과 뇌전 폭주. 물에 젖은 적에게는 감전 연쇄가 터짐.',
    skills: [
      { name: '속사', type: 'shot', cd: 0.56, el: null, speed: 680, r: 5, power: 1, dmg: 9, kb: [80, 150], life: 0.8, look: 'arrow' },
      { name: '뇌전 관통시', type: 'shot', cd: 2.2, el: 'lightning', speed: 980, r: 7, power: 1.6, dmg: 16, kb: [130, 260], life: 0.75, pierce: 3, look: 'bolt' },
      { name: '섬광 도약', type: 'blink', cd: 4.5, dist: 180, zone: { r: 66, delay: 0.3, dmg: 14, kb: [110, 260], el: 'lightning' } },
      { name: '뇌전 폭주', type: 'stream', cd: 7, el: 'lightning', time: 1.1, every: 0.04, speed: 760, r: 8, spread: 0.1, power: 0.6, dmg: 3, kb: [40, 80], life: 0.42, look: 'spark', slow: 0.6 },
    ],
  },
  mage: {
    name: '노엘', title: '서리꽃 마법사', rarity: 'super', price: 6000,
    lore: '만년설 탑에서 자란 소년 마법사. 감정이 북받치면 주변에 눈꽃이 피어난다. 따뜻한 코코아를 제일 좋아한다.',
    quote: '추우면… 말해. 조금만 줄일게.', row: 2, el: 'ice', role: '제어', cloth: '#1e88e5', color: '#81d4fa', hp: 95, speed: 170, weight: 0.9,
    desc: '얼음으로 느리게 하고 3번 쌓이면 꽁꽁. 대지로 깨면 분쇄!',
    skills: [
      { name: '빙정탄', type: 'shot', cd: 0.62, el: 'ice', speed: 560, r: 7, power: 1, dmg: 8, kb: [70, 130], life: 0.9, look: 'shard' },
      { name: '삼지 빙창', type: 'shot', cd: 2.4, el: 'ice', speed: 640, r: 8, power: 1.4, dmg: 12, kb: [120, 220], life: 0.8, count: 3, spread: 0.32, pierce: 1, look: 'spear' },
      { name: '서리꽃 개화', type: 'nova', cd: 5, r: 120, dmg: 14, kb: [220, 360], el: 'ice', look: 'frost' },
      { name: '백야의 눈보라', type: 'zone', cd: 8, at: 'aim', range: 380, r: 110, time: 3, tick: 0.3, dmg: 3, kb: [0, 0], el: 'ice', look: 'blizzard', slow: 0.5 },
    ],
  },
  ninja: {
    name: '하야테', title: '질풍', rarity: 'rare', price: 3000,
    lore: '바람 마을 최연소 상급 닌자. 너무 빨라서 그림자가 한 박자 늦게 따라온다는 소문이 있다.',
    quote: '보였어? 아니, 못 봤겠지.', row: 3, el: 'wind', role: '암살', cloth: '#2e7d32', color: '#a5d6a7', hp: 95, speed: 205, weight: 0.85,
    desc: '가장 빠른 캐릭터. 회오리로 적을 모으고 상태 이상을 퍼뜨림.',
    skills: [
      { name: '쌍풍 연격', type: 'slash', cd: 0.22, range: 52, arc: 1.7, dmg: 6, kb: [80, 140], el: 'wind', chain: [{ dmg: 6 }, { dmg: 6 }, { dmg: 7 }, { dmg: 12, kb: [200, 320], big: true }] },
      { name: '진공 초승달', type: 'shot', cd: 2, el: 'wind', speed: 600, r: 14, power: 1.6, dmg: 13, kb: [150, 260], life: 0.7, pierce: 99, look: 'crescent' },
      { name: '질풍 연참', type: 'dashstrike', cd: 3.5, dist: 230, time: 0.12, width: 40, dmg: 16, kb: [160, 300], el: 'wind', look: 'wind', resetOnHit: 0.5 },
      { name: '용권풍', type: 'shot', cd: 8, el: 'wind', speed: 150, r: 46, power: 4, dmg: 4, kb: [-90, 0], life: 2.6, pierce: 999, hitEvery: 0.22, look: 'tornado', pull: 260 },
    ],
  },
  guardian: {
    name: '바르곤', title: '산맥의 수호자', rarity: 'super', price: 6000,
    lore: '천 년 동안 산의 관문을 지켜 온 드워프 전사. 망치를 내려칠 때마다 대지가 대답한다.',
    quote: '지나가려면, 산을 옮겨 보거라.', row: 4, el: 'earth', role: '탱커', cloth: '#8d6e63', color: '#c49a6c', hp: 170, speed: 160, weight: 1.45,
    desc: '무겁고 단단함. 지진으로 띄우고, 얼어 있는 적을 산산조각.',
    skills: [
      { name: '대지 분쇄', type: 'slash', cd: 0.6, range: 74, arc: 1.6, dmg: 16, kb: [200, 340], el: 'earth', big: true },
      { name: '거암 투척', type: 'shot', cd: 3, el: 'earth', speed: 360, r: 16, power: 3.2, dmg: 22, kb: [260, 420], life: 1.2, look: 'boulder' },
      { name: '대지의 포효', type: 'nova', cd: 6, r: 130, dmg: 18, kb: [180, 300], el: 'earth', stun: 0.7, look: 'quake' },
      { name: '가시 산맥', type: 'line', cd: 7, el: 'earth', count: 7, gap: 40, delay: 0.06, r: 30, dmg: 14, kb: [170, 300], look: 'spike' },
    ],
  },
  priest: {
    name: '마리나', title: '물결의 성녀', rarity: 'rare', price: 3000,
    lore: '해변 신전의 성녀. 누구에게나 다정하지만, 동료를 해치는 자에게는 파도처럼 무자비하다.',
    quote: '괜찮아요. 제가 곁에 있을게요.', row: 5, el: 'water', role: '지원', cloth: '#0288d1', color: '#4fc3f7', hp: 110, speed: 175, weight: 1,
    desc: '적을 적시고 아군을 치유. 번개·얼음·불과 엮으면 반응이 터짐.',
    skills: [
      { name: '성수 방울', type: 'shot', cd: 0.6, el: 'water', speed: 520, r: 8, power: 1, dmg: 8, kb: [80, 140], life: 0.9, look: 'bubble' },
      { name: '해일의 손길', type: 'shot', cd: 3, el: 'water', speed: 420, r: 26, power: 2.5, dmg: 10, kb: [240, 300], life: 0.9, pierce: 99, look: 'wave' },
      { name: '치유의 샘', type: 'zone', cd: 9, at: 'self', r: 100, time: 3, tick: 0.25, heal: 4, dmg: 0, look: 'heal', follow: true },
      { name: '심해 소용돌이', type: 'zone', cd: 8, at: 'aim', range: 360, r: 100, time: 2.6, tick: 0.25, dmg: 3, kb: [0, 0], el: 'water', pull: 220, look: 'vortex' },
    ],
  },
  sniper: {
    name: '레이븐', title: '달 없는 밤', rarity: 'epic', price: 12000,
    lore: '의뢰를 실패한 적 없는 그림자 길드의 저격수. 표식이 새겨진 순간, 결과는 이미 정해져 있다.',
    quote: '숨 쉬지 마. 조준이 흔들려.', row: 6, el: 'shadow', role: '저격', cloth: '#5e35b1', color: '#9c64ff', hp: 90, speed: 180, weight: 0.9,
    desc: '표식을 남기고 저격으로 터뜨리는 한 방 콤보. (쿠키런 저격수처럼)',
    skills: [
      { name: '흑요탄', type: 'shot', cd: 0.66, el: 'shadow', speed: 760, r: 6, power: 1, dmg: 10, kb: [70, 120], life: 0.9, look: 'umbral' },
      { name: '일격 저격', type: 'snipe', cd: 3, windup: 0.35, len: 900, width: 10, dmg: 32, kb: [260, 460], el: 'shadow' },
      { name: '연막 이탈', type: 'blink', cd: 5, dist: 200, smoke: true, empower: 1.6 },
      { name: '처형 선고', type: 'markall', cd: 9, range: 520, arc: 1.4, delay: 1.0, dmg: 26, kb: [240, 420], el: 'shadow' },
    ],
  },
  alchemist: {
    name: '피코', title: '괴짜 연금술사', rarity: 'super', price: 6000,
    lore: '폭발 사고로 학원에서 세 번 쫓겨난 천재 소녀. 플라스크 속 초록 액체는 본인도 정체를 모른다.',
    quote: '실험은 실패해도 폭발은 성공이야!', row: 7, el: 'poison', role: '광역', cloth: '#558b2f', color: '#9ccc65', hp: 105, speed: 175, weight: 1,
    desc: '독을 쌓고 한 번에 기폭. 불과 엮으면 독 폭발.',
    skills: [
      { name: '독침', type: 'shot', cd: 0.54, el: 'poison', speed: 600, r: 5, power: 1, dmg: 7, kb: [60, 110], life: 0.8, look: 'needle' },
      { name: '초록 플라스크', type: 'shot', cd: 3, el: 'poison', speed: 420, r: 9, power: 1, dmg: 6, kb: [80, 120], life: 0.7, lob: true, look: 'flask', cloud: { r: 85, time: 3, tick: 0.4, dmg: 3 } },
      { name: '연쇄 기폭', type: 'detonate', cd: 6, range: 380, perStack: 7, kb: [160, 300] },
      { name: '대폭발 시약', type: 'shot', cd: 9, el: 'fire', speed: 380, r: 13, power: 3, dmg: 24, kb: [280, 460], life: 0.85, lob: true, look: 'bomb', explode: { r: 110, dmg: 16, kb: [260, 420] } },
    ],
  },
  berserker: {
    name: '브란', title: '용암 심장', rarity: 'epic', price: 12000,
    lore: '화산섬의 투사. 심장에 용암이 흐른다는 전설처럼, 싸울수록 몸이 뜨거워진다.',
    quote: '더 와라! 아직 안 뜨겁다!', row: 8, el: 'fire', role: '근접 광역', cloth: '#8b2d1e', color: '#ff5722', hp: 150, speed: 170, weight: 1.3,
    desc: '대도끼를 휘두르며 회전 베기로 적 무리를 쓸어 버림. 도약해 내려찍기.',
    skills: [
      { name: '화산 도끼', type: 'slash', cd: 0.55, range: 70, arc: 1.9, dmg: 14, kb: [170, 300], el: 'fire', chain: [{ dmg: 13 }, { dmg: 20, kb: [240, 420], arcMul: 1.3, big: true }] },
      { name: '회전 업화', type: 'zone', cd: 6, at: 'self', follow: true, r: 72, time: 1.5, tick: 0.14, dmg: 4, kb: [0, 0], el: 'fire', look: 'whirl', spin: [90, 60] },
      { name: '운석 낙하', type: 'dashstrike', cd: 5, dist: 260, time: 0.3, width: 30, dmg: 10, kb: [120, 200], el: 'fire', look: 'leap', land: { r: 95, dmg: 20, kb: [260, 440] } },
      { name: '화산 분출', type: 'line', cd: 8, el: 'fire', count: 6, gap: 46, delay: 0.07, r: 34, dmg: 15, kb: [200, 340], look: 'lava' },
    ],
  },
  miko: {
    name: '아마네', title: '천둥 신사의 무녀', rarity: 'legend', price: 25000,
    lore: '번개신을 모시는 신사의 무녀. 부적에 적힌 글씨는 사실 할머니의 잔소리라는 소문이 있다.',
    quote: '하늘이 노했어요. …아, 제가 노한 거예요.', row: 9, el: 'lightning', role: '원거리 광역', cloth: '#d32f2f', color: '#ffe14d', hp: 95, speed: 180, weight: 0.9,
    desc: '따라가는 부적과 하늘에서 떨어지는 낙뢰. 젖은 적이 많을수록 강함.',
    skills: [
      { name: '뇌신 부적', type: 'shot', cd: 0.64, el: 'lightning', speed: 480, r: 7, power: 1, dmg: 8, kb: [70, 120], life: 1.1, home: 4, look: 'talisman' },
      { name: '뇌운 결계', type: 'zone', cd: 7, at: 'aim', range: 380, r: 90, time: 2.6, tick: 0.35, dmg: 4, kb: [60, 60], el: 'lightning', look: 'thunderfield' },
      { name: '번개 걸음', type: 'blink', cd: 4, dist: 170, fwd: true, zone: { r: 60, delay: 0.25, dmg: 12, kb: [110, 220], el: 'lightning' } },
      { name: '천벌', type: 'strikes', cd: 10, range: 460, count: 7, every: 0.13, r: 52, dmg: 16, kb: [150, 300], el: 'lightning' },
    ],
  },
  reaper: {
    name: '녹스', title: '영혼 수확자', rarity: 'legend', price: 25000,
    lore: '길 잃은 영혼을 거두는 심연의 사신. 무섭게 생겼지만 길고양이를 보면 꼭 걸음을 멈춘다.',
    quote: '네 차례는 아직이야. 오늘은.', row: 10, el: 'shadow', role: '근접 제어', cloth: '#231b30', color: '#e040fb', hp: 120, speed: 180, weight: 1.05,
    desc: '거대한 낫으로 넓게 베고, 영혼 사슬로 적을 끌어와 수확.',
    skills: [
      { name: '망자의 낫', type: 'slash', cd: 0.45, range: 80, arc: 2.5, dmg: 11, kb: [130, 230], el: 'shadow', chain: [{ dmg: 10 }, { dmg: 11 }, { dmg: 18, kb: [200, 380], arcMul: 1.25, big: true }] },
      { name: '영혼 사슬', type: 'shot', cd: 3.5, el: 'shadow', speed: 720, r: 9, power: 1.5, dmg: 10, kb: [0, 0], life: 0.55, hook: 520, look: 'chain' },
      { name: '망령 행렬', type: 'shot', cd: 5, el: 'shadow', speed: 230, r: 16, power: 2.5, dmg: 8, kb: [90, 160], life: 2.4, pierce: 99, hitEvery: 0.35, home: 2.2, count: 3, spread: 0.9, look: 'ghost' },
      { name: '영혼 수확', type: 'nova', cd: 8, r: 140, dmg: 24, kb: [-260, -120], el: 'shadow', look: 'reap', leech: 4 },
    ],
  },
  pirate: {
    name: '코랄', title: '폭풍 해적단 선장', rarity: 'epic', price: 12000,
    lore: '바다 괴물을 대포 한 발로 쫓아냈다는 소문의 선장. 잃어버린 한쪽 눈 대신 바다의 별을 보며 항해한다.',
    quote: '닻 올려! 전부 쓸어버리자!', row: 11, el: 'water', role: '원거리 화력', cloth: '#1565c0', color: '#4fc3f7', hp: 110, speed: 180, weight: 1.05,
    desc: '권총 연사, 반동으로 밀려나는 대포, 닻을 던져 끌어오기.',
    skills: [
      { name: '해적 권총', type: 'shot', cd: 0.52, el: null, speed: 820, r: 5, power: 1, dmg: 8, kb: [90, 150], life: 0.7, look: 'bullet' },
      { name: '대포 일격', type: 'shot', cd: 3.5, el: 'water', speed: 520, r: 14, power: 3, dmg: 20, kb: [280, 460], life: 1, recoil: 340, look: 'cannonball', explode: { r: 70, dmg: 10, kb: [200, 320] } },
      { name: '닻 낚시', type: 'shot', cd: 5, el: 'water', speed: 560, r: 13, power: 2.5, dmg: 14, kb: [0, 0], life: 0.6, hook: 460, look: 'anchor' },
      { name: '대해일', type: 'shot', cd: 9, el: 'water', speed: 380, r: 30, power: 4, dmg: 14, kb: [300, 380], life: 1.1, pierce: 99, count: 3, spread: 0.5, look: 'wave' },
    ],
  },
};
export const CHAR_KEYS = Object.keys(CHARS);

// ---------- 계정 레벨 (플레이할수록 오름, 레벨마다 보상) ----------
export const ACCOUNT = {
  max: 60,
  need: (lv) => 60 + lv * 30,                         // lv → lv+1 경험치
  xp: { stage: 10, boss: 30, coloGame: 10, coloWin: 20 },
  reward: (lv) => ({ keys: lv % 5 === 0 ? 5 : 2, gold: 40 + lv * 8 }),   // lv에 도달했을 때
  bossKeys: 1,                                           // 판마다 보스 처치당 열쇠
};
// 처음 도달한 스테이지 보상 (k = 1-1이 1 … 4-5가 20, 끝까지 깨면 21)
export function reachReward(k) {
  const boss = k > 1 && (k - 1) % 5 === 0;   // 보스를 처음 쓰러뜨림
  if (k === 21) return { keys: 10, gold: 500, title: '모든 장 돌파' };
  return { keys: boss ? 3 : k % 2 === 0 ? 1 : 0, gold: 15 + k * 4 + (boss ? 100 : 0), title: boss ? `${(k - 1) / 5}장 보스 첫 처치` : '' };
}
// 업적: stat = 저장의 어떤 값을 볼지, goal = 목표
export const ACHIEVEMENTS = [
  { id: 'reach6', icon: '🌲', name: '숲을 지나서', desc: '1장 보스를 쓰러뜨리기', stat: 'best', goal: 6, keys: 3, gold: 100 },
  { id: 'reach11', icon: '⚰️', name: '무덤 정복자', desc: '2장 보스를 쓰러뜨리기', stat: 'best', goal: 11, keys: 4, gold: 200 },
  { id: 'reach16', icon: '🔥', name: '요새 함락', desc: '3장 보스를 쓰러뜨리기', stat: 'best', goal: 16, keys: 5, gold: 300 },
  { id: 'reach21', icon: '❄️', name: '봉우리의 주인', desc: '4장까지 모두 돌파', stat: 'best', goal: 21, keys: 10, gold: 500 },
  { id: 'kill100', icon: '⚔️', name: '사냥꾼', desc: '적 100마리 처치', stat: 'kills', goal: 100, keys: 1, gold: 50 },
  { id: 'kill500', icon: '🗡️', name: '베테랑', desc: '적 500마리 처치', stat: 'kills', goal: 500, keys: 3, gold: 150 },
  { id: 'kill2000', icon: '💀', name: '전장의 악몽', desc: '적 2000마리 처치', stat: 'kills', goal: 2000, keys: 6, gold: 400 },
  { id: 'combo30', icon: '🔗', name: '연결 고리', desc: '한 판에 30 콤보', stat: 'bestCombo', goal: 30, keys: 1, gold: 60 },
  { id: 'combo80', icon: '⛓️', name: '끊이지 않는 사슬', desc: '한 판에 80 콤보', stat: 'bestCombo', goal: 80, keys: 3, gold: 150 },
  { id: 'colo1', icon: '🏟️', name: '첫 승리', desc: '콜로세움에서 1번 이기기', stat: 'coloWins', goal: 1, keys: 1, gold: 50 },
  { id: 'colo10', icon: '🏆', name: '투기장의 별', desc: '콜로세움에서 10번 이기기', stat: 'coloWins', goal: 10, keys: 4, gold: 200 },
  { id: 'ko30', icon: '💫', name: '링아웃 장인', desc: '콜로세움에서 30번 날려 버리기', stat: 'kos', goal: 30, keys: 3, gold: 150 },
  { id: 'own5', icon: '🧑‍🤝‍🧑', name: '동료 모으기', desc: '영웅 5명 보유', stat: 'owned', goal: 5, keys: 2, gold: 100 },
  { id: 'own12', icon: '👑', name: '모든 영웅', desc: '영웅 12명 모두 보유', stat: 'owned', goal: 12, keys: 8, gold: 500 },
  { id: 'hlv5', icon: '⬆️', name: '성장', desc: '영웅 하나를 5레벨로', stat: 'heroLv', goal: 5, keys: 2, gold: 100 },
  { id: 'hlv10', icon: '🌟', name: '최고의 경지', desc: '영웅 하나를 10레벨로', stat: 'heroLv', goal: 10, keys: 6, gold: 400 },
  { id: 'box10', icon: '🎁', name: '상자 수집가', desc: '상자 10개 열기', stat: 'boxes', goal: 10, keys: 2, gold: 50 },
  { id: 'box50', icon: '🗝️', name: '열쇠의 달인', desc: '상자 50개 열기', stat: 'boxes', goal: 50, keys: 5, gold: 200 },
  { id: 'alv10', icon: '🎖️', name: '숙련자', desc: '계정 10레벨', stat: 'alv', goal: 10, keys: 3, gold: 150 },
  { id: 'alv30', icon: '🏅', name: '전설의 모험가', desc: '계정 30레벨', stat: 'alv', goal: 30, keys: 8, gold: 500 },
  { id: 'runs10', icon: '🎮', name: '꾸준함', desc: '10판 플레이', stat: 'runs', goal: 10, keys: 2, gold: 80 },
];

// ---------- 영웅 레벨 (상자의 P.P + 골드로 올림, 스토리에서만 적용) ----------
// 기본 능력치: 체력(받는 % 줄임) · 공격력 · 방어막(스테이지 시작·부활 때 %를 먼저 막아 줌) · 이동 속도 · 치명타율 · 치명타 피해
export const HERO_STATS = {
  knight: { hp: 130, atk: 100, shield: 20, crit: 5, critDmg: 50 },
  archer: { hp: 100, atk: 100, shield: 12, crit: 8, critDmg: 50 },
  mage: { hp: 95, atk: 104, shield: 15, crit: 5, critDmg: 55 },
  ninja: { hp: 100, atk: 96, shield: 10, crit: 12, critDmg: 60 },
  guardian: { hp: 160, atk: 94, shield: 35, crit: 3, critDmg: 50 },
  priest: { hp: 110, atk: 95, shield: 28, crit: 5, critDmg: 50 },
  sniper: { hp: 90, atk: 108, shield: 10, crit: 10, critDmg: 80 },
  alchemist: { hp: 100, atk: 100, shield: 16, crit: 6, critDmg: 50 },
  berserker: { hp: 140, atk: 108, shield: 15, crit: 7, critDmg: 60 },
  miko: { hp: 100, atk: 104, shield: 20, crit: 6, critDmg: 55 },
  reaper: { hp: 115, atk: 104, shield: 15, crit: 9, critDmg: 70 },
  pirate: { hp: 115, atk: 100, shield: 16, crit: 8, critDmg: 60 },
};
// 레벨마다 소폭 증가: hp·atk·spd는 %(기본값에 곱함), shield는 점수, crit·critDmg는 %p
export const HERO_GROW = { hp: 0.03, atk: 0.03, shield: 3, spd: 0.01, crit: 0.6, critDmg: 4 };
export const HERO_LV = {
  max: 10,
  pp: [0, 20, 30, 50, 80, 130, 210, 340, 550, 890],       // pp[lv] = lv → lv+1 에 필요한 P.P
  gold: [0, 20, 35, 75, 140, 290, 480, 800, 1250, 1875],  // 골드
};
export function heroStats(char, lv = 1) {
  const B = HERO_STATS[char] || HERO_STATS.knight, C = CHARS[char] || CHARS.knight, k = Math.max(0, lv - 1), G = HERO_GROW;
  return {
    hp: Math.round(B.hp * (1 + G.hp * k)), atk: Math.round(B.atk * (1 + G.atk * k)), shield: B.shield + G.shield * k,
    spd: Math.round(C.speed * (1 + G.spd * k)), crit: +(B.crit + G.crit * k).toFixed(1), critDmg: B.critDmg + G.critDmg * k,
  };
}
export const STAT_NAMES = [['hp', '체력', '❤️'], ['atk', '공격력', '⚔️'], ['shield', '방어막', '🛡️'], ['spd', '이동 속도', '👟'], ['crit', '치명타율', '🎯', '%'], ['critDmg', '치명타 피해', '💥', '%']];

// ---------- 뽑기 상자 (옛 브롤스타즈 상자처럼) ----------
// 상자 하나 = 칸(drop) 여러 개. 칸마다: 아직 없는 영웅이 나올 수 있고, 아니면 골드
// 영웅이 안 나올수록 '행운'이 쌓여 확률이 오름 (luckPer), pity칸 동안 안 나오면 다음 칸은 영웅 확정
export const RARITY = {
  start: { name: '기본', color: '#b0bec5', chance: 0 },
  rare: { name: '희귀', color: '#66bb6a', chance: 0.045 },
  super: { name: '초희귀', color: '#42a5f5', chance: 0.022 },
  epic: { name: '영웅', color: '#ce93d8', chance: 0.011 },
  legend: { name: '전설', color: '#ffca28', chance: 0.0045 },
};
export const RARITY_ORDER = ['rare', 'super', 'epic', 'legend'];
export const BOXES = {
  small: { name: '원소 상자', price: 1, drops: 1, luck: 1, color: '#42a5f5', gold: [12, 35] },
  big: { name: '큰 원소 상자', price: 3, drops: 3, luck: 1.15, color: '#ab47bc', gold: [12, 35] },
  mega: { name: '메가 원소 상자', price: 8, drops: 10, luck: 1.35, color: '#ff7043', gold: [12, 35] },
};
// 상자는 골드가 아니라 🔑 원소 열쇠로 엶 (price = 열쇠 개수)
// 열쇠 얻는 곳: 계정 레벨 업 · 처음 도달한 스테이지 · 보스 처치(판마다) · 업적
export const GACHA = { luckPer: 0.06, pity: 45, jackpot: 0.04, jackpotGold: [110, 200], ppChance: 0.55, pp: [8, 26] };
// 영웅 그림: assets/heroes.png 한 칸 48x48 (발끝 46행), 한 줄 = 한 캐릭터
//  0-3 서기 · 4-9 걷기 · 10 준비 · 11 공격 · 12 마무리 · 13 맞음 · 14 쓰러짐 · 15 승리
// assets/portraits.png 한 칸 64x64 (캐릭터 순서대로 가로)
export const HERO_SPRITE = { size: 48, draw: 72, frames: 16, portrait: 64 };
// 직접 그려 온 촘촘한 도트는 영웅마다 따로 (한 줄 16칸, 칸 크기 cell, 화면 배율 scale). 발끝은 칸 아래에서 2칸 위
export const HERO_SHEETS = {
  archer: { file: 'hero_archer.png', cell: 72, scale: 1.0 },
  mage: { file: 'hero_mage.png', cell: 104, scale: 0.78 },
  miko: { file: 'hero_miko.png', cell: 104, scale: 0.78 },
  ninja: { file: 'hero_ninja.png', cell: 128, scale: 0.66 },
  priest: { file: 'hero_priest.png', cell: 104, scale: 0.78 },
  reaper: { file: 'hero_reaper.png', cell: 128, scale: 0.72 },
};

// ---------- 적 (assets/enemies.png 24x24: 종류마다 [걷기1, 걷기2, 쓰러짐]) ----------
export const ENEMY_SHEET = ['slime', 'archer', 'brute', 'bat', 'spider', 'bomber', 'caster', 'shield', 'totem', 'yeti', 'frostwisp', 'minisnow'];
export const ENEMIES = {
  slime: { name: '슬라임', hp: 34, r: 13, speed: 85, weight: 0.9, touch: 9, kb: [130, 200], ai: 'chase', gold: 2, xp: 7 },
  bat: { name: '박쥐', hp: 20, r: 10, speed: 150, weight: 0.7, touch: 7, kb: [110, 160], ai: 'zigzag', gold: 1, xp: 5 },
  bomber: { name: '폭탄 고블린', hp: 26, r: 12, speed: 130, weight: 0.9, ai: 'bomber', boom: { r: 70, dmg: 18, kb: [220, 320] }, gold: 2, xp: 7 },
  archer: { name: '해골 궁수', hp: 30, r: 12, speed: 95, weight: 0.9, ai: 'ranged', fire: { every: 1.8, speed: 300, dmg: 10, look: 'ebolt' }, gold: 3, xp: 9 },
  caster: { name: '해골 마법사', hp: 38, r: 12, speed: 75, weight: 0.9, ai: 'caster', fire: { every: 2.6, speed: 200, dmg: 9, look: 'eorb', count: 3, home: 1.6 }, gold: 4, xp: 11 },
  spider: { name: '거미', hp: 32, r: 11, speed: 80, weight: 0.85, touch: 10, kb: [150, 220], ai: 'leap', gold: 2, xp: 7 },
  brute: { name: '오크 브루트', hp: 110, r: 18, speed: 70, weight: 1.6, touch: 14, kb: [200, 300], ai: 'slam', slam: { r: 90, dmg: 20, kb: [200, 280], warn: 0.8, every: 3.2 }, gold: 8, xp: 19 },
  // 방패를 든 동안: 정면 투사체 무효, 정면 근접 피해·넉백 경감. 돌진 후엔 방패가 내려가 빈틈이 생김
  shield: { name: '방패병', hp: 90, r: 16, speed: 60, weight: 1.5, touch: 12, kb: [160, 240], ai: 'shield', gold: 6, xp: 15,
    guard: 0.45, arc: 1.15,
    charge: { every: [3.2, 4.6], range: [70, 360], warn: 0.65, time: 0.6, speed: 420, dmg: 16, kb: [250, 330], stagger: 1.3, wallStagger: 2.2 } },
  // 4장: 설인 (내려찍으면 주변이 얼어붙음) · 서리 정령 (맞은 자리에 빙판)
  yeti: { name: '설인', hp: 130, r: 18, speed: 78, weight: 1.7, touch: 14, kb: [200, 300], ai: 'slam', slam: { r: 95, dmg: 18, kb: [220, 300], warn: 0.75, every: 3, ice: 2.4 }, gold: 8, xp: 19 },
  frostwisp: { name: '서리 정령', hp: 40, r: 11, speed: 95, weight: 0.8, ai: 'ranged', fire: { every: 1.7, speed: 290, dmg: 9, look: 'shard', el: 'ice', ice: 1.2 }, gold: 4, xp: 11 },
  totem: { name: '저주 토템', hp: 70, r: 14, speed: 0, weight: 99, ai: 'totem', fire: { every: 0.5, speed: 190, dmg: 8, look: 'eorb' }, gold: 5, xp: 13 },
};
// 보스 (assets/bosses.png 40x40: [1, 2, 쓰러짐] × 3)
export const BOSSES = {
  // 슬라임 왕: 쓰러지면 작은 왕 2마리로 분열 (2번까지). hpShare = 이 세대가 전체 체력에서 차지하는 몫
  kingslime: { name: '거대 슬라임 왕', sheet: 0, hp: 900, r: 34, speed: 70, weight: 4, touch: 16, color: '#66bb6a', pats: ['ring', 'jump', 'summon'], split: { gens: 2, share: [0.4, 0.15, 0.075], size: [1, 0.68, 0.46] } },
  bonelord: { name: '해골 궁수 대장', sheet: 1, hp: 1100, r: 30, speed: 90, weight: 3.5, touch: 14, color: '#e0e0e0', pats: ['volley', 'drill', 'rain', 'dash', 'drill'] },
  // 눈사람 대왕: 체력 절반 이하 → 몸통(뛰어다니며 밟기)과 머리(굴러다니며 냉기 → 빙판)로 분리
  snowman: { name: '눈보라 대왕', sheet: 3, hp: 2100, r: 38, speed: 55, weight: 5, touch: 18, color: '#b3e5fc', pats: ['snowball', 'jump', 'icering', 'snowball', 'summonsnow'], splitAt: 0.5 },
  snowbody: { name: '눈보라 대왕 · 몸통', sheet: 4, hp: 1, r: 34, speed: 60, weight: 6, touch: 18, color: '#e1f5fe', pats: ['stomp'], every: [1.5, 1.1], part: true },
  snowhead: { name: '눈보라 대왕 · 머리', sheet: 5, hp: 1, r: 24, speed: 175, weight: 3, touch: 14, color: '#81d4fa', pats: [], part: true, roll: true },
  golem: { name: '심연의 골렘', sheet: 2, hp: 1500, r: 36, speed: 60, weight: 5, touch: 20, color: '#ff7043', pats: ['laser', 'fissure', 'slam', 'ring', 'fissure'] },
};

// ---------- 스토리 모드 ----------
// 장마다 스테이지 5개, 5번째는 보스. 한 스테이지 = 한 화면 경기장에서 웨이브 2~3번 → 상자(골드) → 다음
export const CHAPTERS = [
  { name: '속삭이는 숲', floor: ['#1d2a1f', '#213024'], wall: '#33402f', wallTop: '#4a5a40', boss: 'kingslime',
    waves: [['slime', 'slime', 'bat'], ['slime', 'bat', 'bat', 'bomber'], ['bomber', 'slime', 'spider', 'bat']] },
  { name: '잊힌 무덤', floor: ['#211d2a', '#252033'], wall: '#3b3352', wallTop: '#4a4166', boss: 'bonelord',
    waves: [['archer', 'slime', 'spider'], ['caster', 'archer', 'bat', 'spider'], ['archer', 'caster', 'spider', 'spider', 'bat']] },
  { name: '불타는 요새', floor: ['#2a1d1b', '#30211f'], wall: '#4e342e', wallTop: '#6d4c41', boss: 'golem',
    waves: [['brute', 'bomber', 'archer'], ['shield', 'caster', 'bomber', 'totem'], ['brute', 'shield', 'archer', 'caster', 'bomber']] },
  // 4장: 꼬마 눈사람이 영웅마다 하나씩 따라다니며 도와줌. 곳곳이 빙판 (미끄러움)
  { name: '얼어붙은 봉우리', floor: ['#2a3a48', '#2f4150'], wall: '#46617a', wallTop: '#7b9cb8', boss: 'snowman', snow: true, ally: 'minisnow',
    waves: [['frostwisp', 'yeti', 'bat', 'spider'], ['yeti', 'frostwisp', 'shield', 'caster'], ['yeti', 'yeti', 'frostwisp', 'frostwisp', 'bomber']] },
];
// 아군 꼬마 눈사람: 주인을 따라다니며 가까운 적에게 눈덩이 (맞으면 둔화). 무적
export const ALLY = { minisnow: { name: '꼬마 눈사람', r: 10, speed: 210, every: 1.0, range: 330, shot: { speed: 420, r: 7, dmg: 7, kb: [110, 170], life: 0.9, look: 'snowball', el: 'ice', power: 1 } } };
// 빙판: 그 위에서는 미끄러짐 (걷기 가속이 느리고 넉백이 잘 안 멈춤)
export const ICE = { time: 9, accel: 1.8, kbFriction: 0.35 };
export const STAGES_PER_CHAPTER = 5;
export const STORY = {
  hpScale: (ch, st) => 1 + ch * 0.9 + st * 0.15,   // 적 체력 배율
  dmgScale: (ch, st) => 1 + ch * 0.25 + st * 0.05,  // 적 피해(=영웅에게 쌓이는 %) 배율
  countAdd: (ch, st) => Math.floor(st / 2) + ch,   // 웨이브마다 추가되는 적 수
  chestGold: (ch, st) => 20 + ch * 25 + st * 6,   // (goldMul이 곱해짐)
  bossGold: (ch) => 110 + ch * 70,
  goldMul: 0.5,       // 적 처치 골드 배율
  lives: 3,           // 장 하나를 도는 동안 목숨 (공허에 떨어지면 -1)
  maxLives: 5,
  pctPerDmg: 0.8,     // 받은 피해 1당 쌓이는 %
  enemyKb: 1.0,       // 적의 넉백 배율
  respawn: 1.2,
  collapseAt: 18, bossCollapseAt: 24, collapseEvery: 10, collapseMax: 5,
};
// 땅 무너짐: 시간이 지나면 바깥 줄부터 공허로 (경고 → 붕괴)
export const COLLAPSE = { warn: 2.2 };
// 레벨: 처치 경험치는 파티가 함께 모음. 레벨업마다 증강 3개 중 1개 선택
// 증강을 고르는 스테이지 (장-스테이지, 0부터): 1-1 · 1-3 · 1-5(전설) · 2-3 · 2-5(전설) · 3-3 · 3-5(전설) · 4-3
export const AUG_STAGES = { '0-0': 1, '0-2': 1, '0-4': 2, '1-2': 1, '1-4': 2, '2-2': 1, '2-4': 2, '3-2': 1 };
export const LEVEL = { need: (lv) => 16 + lv * 12, autoPick: 15 };
// 아이템 (상자, 콜로세움 보급)
export const ITEMS = {
  potion: { name: '회복 포션', desc: '% -30', color: '#ef5350', pct: -30 },
  bigpotion: { name: '대형 회복 포션', desc: '% -70', color: '#ec407a', pct: -70 },
  heart: { name: '생명의 하트', desc: '목숨 +1', color: '#ff5252', life: 1 },
  crystal: { name: '원소 결정', desc: '12초 동안 공격력 +35%', color: '#ffd740', buff: 'power', time: 12 },
  boots: { name: '바람 장화', desc: '12초 동안 이동 속도 +35%', color: '#69f0ae', buff: 'swift', time: 12 },
  aegis: { name: '수호 방패', desc: '8초 동안 거의 밀려나지 않음', color: '#40c4ff', buff: 'aegis', time: 8 },
  goldbag: { name: '금화 주머니', desc: '골드 +', color: '#ffca28', gold: 25, xp: 53 },
};
export const CHEST_LOOT = [['potion', 5], ['bigpotion', 2], ['heart', 1.2], ['crystal', 2], ['boots', 2], ['aegis', 1.5], ['goldbag', 3]];
export const COLO_LOOT = [['potion', 4], ['bigpotion', 1], ['crystal', 2], ['boots', 2], ['aegis', 1.5]];

// ---------- 증강 (스토리 한 판 동안 유지, 같은 것도 겹쳐서 고를 수 있음) ----------
// tier 1 = 레벨업, tier 2 = 보스 처치 (전설)
export const AUGMENTS = [
  { id: 'sharp', tier: 1, icon: '⚔️', name: '예리한 칼날', desc: '주는 피해 +15%', b: { atk: 0.15 } },
  { id: 'haste', tier: 1, icon: '⏳', name: '가속 마법진', desc: '스킬 쿨타임 -12%', b: { cd: 0.12 } },
  { id: 'feather', tier: 1, icon: '🪶', name: '신속의 깃털', desc: '이동 속도 +12%', b: { spd: 0.12 } },
  { id: 'shadowstep', tier: 1, icon: '👣', name: '그림자 걸음', desc: '대시 1회 더 충전', b: { dashCharge: 1 } },
  { id: 'iron', tier: 1, icon: '🛡️', name: '강철 뼈대', desc: '받는 % -15%, 덜 밀려남', b: { endure: 0.15, weight: 0.15 } },
  { id: 'force', tier: 1, icon: '💥', name: '파쇄의 손', desc: '주는 넉백 +18%', b: { kb: 0.18 } },
  { id: 'hawk', tier: 1, icon: '🦅', name: '매의 눈', desc: '치명타 확률 +12%', b: { crit: 0.12 } },
  { id: 'executioner', tier: 1, icon: '🪓', name: '처형인', desc: '치명타 피해 +50%', b: { critDmg: 0.5 } },
  { id: 'resonance', tier: 1, icon: '🔮', name: '원소 공명', desc: '원소 반응 피해 +35%, 범위 +15%', b: { react: 0.35, reactR: 0.15 } },
  { id: 'fang', tier: 1, icon: '🦇', name: '흡혈 송곳니', desc: '적을 처치할 때마다 % -4', b: { leech: 4 } },
  { id: 'split', tier: 1, icon: '🔱', name: '분열 탄', desc: '투사체 스킬이 1발 더 나감', b: { multishot: 1 } },
  { id: 'piercer', tier: 1, icon: '🏹', name: '관통 화살촉', desc: '투사체가 적 1명을 더 꿰뚫음', b: { pierce: 1 } },
  { id: 'orbit', tier: 1, icon: '🌀', name: '수호 구체', desc: '몸 주위를 도는 구체 2개가 적을 침', b: { orbs: 2 } },
  { id: 'thorns', tier: 1, icon: '🌵', name: '가시 갑옷', desc: '나를 때린 가까운 적에게 피해 12 반사', b: { thorns: 12 } },
  { id: 'chainbolt', tier: 1, icon: '⚡', name: '연쇄 번개', desc: '5번째 타격마다 주변 적 3명에게 번개', b: { chainEvery: 5 } },
  { id: 'ember', tier: 1, icon: '🔥', name: '불씨', desc: '모든 공격 25% 확률로 화상', b: { ignite: 0.25 } },
  { id: 'frostbite', tier: 1, icon: '❄️', name: '서리 기운', desc: '모든 공격 25% 확률로 둔화', b: { chill: 0.25 } },
  { id: 'greed', tier: 1, icon: '🪙', name: '탐욕의 동전', desc: '골드 +30%', b: { gold: 0.3 } },
  { id: 'scholar', tier: 1, icon: '🧲', name: '자석 손', desc: '아이템을 멀리서 줍기, 골드 +15%', b: { gold: 0.15, magnet: 1 } },
  { id: 'rhythm', tier: 1, icon: '🎵', name: '수확의 리듬', desc: '적을 처치할 때마다 모든 스킬 쿨타임 0.6초 감소', b: { killCd: 0.6 } },
  { id: 'giant', tier: 1, icon: '🗿', name: '거인의 혈통', desc: '몸집·피해 +15%, 훨씬 덜 밀려남, 조금 느려짐', b: { size: 0.2, atk: 0.15, weight: 0.3, spd: -0.06 } },
  { id: 'phoenix', tier: 2, icon: '🐦‍🔥', name: '불사조의 깃털', desc: '목숨 +2, 다시 나타날 때 화염 폭발', b: { rebirth: 1 }, lives: 2 },
  { id: 'twin', tier: 2, icon: '✨', name: '쌍둥이 정령', desc: '강력한 수호 구체 4개', b: { orbs: 4, orbDmg: 6 } },
  { id: 'stormcrown', tier: 2, icon: '👑', name: '폭풍의 왕관', desc: '3번째 타격마다 연쇄 번개, 반응 피해 +30%', b: { chainEvery: 3, react: 0.3 } },
  { id: 'bloodrage', tier: 2, icon: '🩸', name: '광전사의 피', desc: '내 %가 높을수록 피해 증가 (최대 +60%)', b: { rageDmg: 0.6 } },
  { id: 'echo', tier: 2, icon: '🔁', name: '메아리', desc: '스킬 쿨타임 -25%', b: { cd: 0.25 } },
  { id: 'meteor', tier: 2, icon: '☄️', name: '운석 소환', desc: '7초마다 가까운 적에게 운석이 떨어짐', b: { meteor: 1 } },
  { id: 'afterimage', tier: 2, icon: '👻', name: '폭발 잔상', desc: '대시한 자리에 폭발이 일어남', b: { dashBoom: 1 } },
];

// ---------- 스킬 트리 (골드, 스토리 모드에만 적용 — 콜로세움은 공정하게 끔) ----------
export const TREE = [
  { id: 'atk1', name: '날 선 무기', desc: '피해 +8%', cost: 40, x: 0, y: -1, bonus: { atk: 0.08 } },
  { id: 'hp1', name: '단련', desc: '받는 피해% -9%', cost: 40, x: -1, y: 0, bonus: { hp: 0.1 } },
  { id: 'cd1', name: '집중', desc: '스킬 쿨타임 -6%', cost: 40, x: 1, y: 0, bonus: { cd: 0.06 } },
  { id: 'dash1', name: '날렵함', desc: '대시 쿨타임 -15%', cost: 60, x: 0, y: 1, bonus: { dash: 0.15 }, req: ['hp1', 'cd1'] },
  { id: 'crit1', name: '급소', desc: '치명타 확률 +8%', cost: 80, x: 0, y: -2, bonus: { crit: 0.08 }, req: ['atk1'] },
  { id: 'atk2', name: '전사의 혼', desc: '피해 +10%', cost: 120, x: -1, y: -2, bonus: { atk: 0.1 }, req: ['crit1'] },
  { id: 'critd', name: '치명적 일격', desc: '치명타 피해 +40%', cost: 140, x: 1, y: -2, bonus: { critDmg: 0.4 }, req: ['crit1'] },
  { id: 'react1', name: '원소 공명', desc: '원소 반응 피해 +25%', cost: 100, x: 2, y: -1, bonus: { react: 0.25 }, req: ['cd1'] },
  { id: 'react2', name: '원소 폭주', desc: '원소 반응 피해 +35%, 반응 범위 +15%', cost: 220, x: 3, y: -1, bonus: { react: 0.35, reactR: 0.15 }, req: ['react1'] },
  { id: 'cd2', name: '명상', desc: '스킬 쿨타임 -8%', cost: 160, x: 2, y: 0, bonus: { cd: 0.08 }, req: ['cd1'] },
  { id: 'hp2', name: '강철 심장', desc: '받는 피해% -13%', cost: 120, x: -2, y: 0, bonus: { hp: 0.15 }, req: ['hp1'] },
  { id: 'regen', name: '흡혈', desc: '적을 처치할 때 % -3', cost: 140, x: -2, y: 1, bonus: { leech: 3 }, req: ['hp2'] },
  { id: 'armor', name: '굳건함', desc: '받는 피해 -10%, 넉백 -10%', cost: 180, x: -3, y: 0, bonus: { armor: 0.1 }, req: ['hp2'] },
  { id: 'gold1', name: '탐욕', desc: '골드 +20%', cost: 80, x: 1, y: 1, bonus: { gold: 0.2 }, req: ['cd1'] },
  { id: 'gold2', name: '황금 손', desc: '골드 +30%', cost: 200, x: 2, y: 1, bonus: { gold: 0.3 }, req: ['gold1'] },
  { id: 'combo', name: '연계의 달인', desc: '콤보 유지 시간 +0.6초, 10콤보마다 피해 +2% (최대 +20%)', cost: 160, x: 0, y: 2, bonus: { combo: 1 }, req: ['dash1'] },
  { id: 'dash2', name: '잔상', desc: '대시 2번 충전', cost: 240, x: -1, y: 2, bonus: { dashCharge: 1 }, req: ['combo'] },
  { id: 'kb', name: '강타', desc: '주는 넉백 +15%', cost: 180, x: 1, y: 2, bonus: { kb: 0.15 }, req: ['combo'] },
  { id: 'atk3', name: '파괴자', desc: '피해 +15%', cost: 320, x: 0, y: -3, bonus: { atk: 0.15 }, req: ['atk2', 'critd'] },
];

// ---------- 콜로세움 (PvP) ----------
export const COLOSSEUM = { stocks: 3, respawn: 1.8, restart: 4, collapseAt: 28, collapseEvery: 11, collapseMax: 6, itemEvery: 12, winGold: 25 };
export const TEAM_COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'];
