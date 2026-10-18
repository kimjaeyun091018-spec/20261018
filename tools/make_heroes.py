"""원소 아레나 영웅 도트 그리기 → assets/heroes.png

한 줄 = 캐릭터 하나, 32x32 프레임 15개:
  0-3 서 있기 · 4-9 걷기 · 10 공격 준비 · 11 공격 · 12 공격 마무리 · 13 맞음 · 14 쓰러짐
오른쪽을 보는 그림만 그리고, 왼쪽은 게임에서 뒤집어 그립니다.
실행: python3 tools/make_heroes.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

W = H = 32
FRAMES = 15
OUT = Path(__file__).resolve().parent.parent / 'assets' / 'heroes.png'
ORDER = ['knight', 'archer', 'mage', 'ninja', 'guardian', 'priest', 'sniper', 'alchemist',
         'berserker', 'miko', 'reaper', 'pirate']


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, k):
    r, g, b, a = c
    if k > 0:
        return (int(r + (255 - r) * k), int(g + (255 - g) * k), int(b + (255 - b) * k), a)
    return (int(r * (1 + k)), int(g * (1 + k)), int(b * (1 + k)), a)


SKIN = hx('#f2c49b')
SKIN_D = hx('#d39a74')
OUTLINE = (24, 16, 30, 255)
EYE = hx('#1b1530')


class P:
    """프레임 하나를 그리는 붓"""

    def __init__(self):
        self.im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def px(self, x, y, c):
        if 0 <= x < W and 0 <= y < H:
            self.im.putpixel((int(x), int(y)), c)

    def rect(self, x0, y0, x1, y1, c):
        self.d.rectangle([x0, y0, x1, y1], fill=c)

    def shaded(self, x0, y0, x1, y1, c):
        """위·왼쪽 밝게, 아래·오른쪽 어둡게"""
        self.rect(x0, y0, x1, y1, c)
        self.rect(x0, y0, x1, y0, shade(c, 0.28))
        self.rect(x0, y0, x0, y1, shade(c, 0.15))
        self.rect(x0, y1, x1, y1, shade(c, -0.35))
        self.rect(x1, y0 + 1, x1, y1, shade(c, -0.25))

    def line(self, x0, y0, x1, y1, c, w=1):
        self.d.line([x0, y0, x1, y1], fill=c, width=w)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)

    def ell(self, x0, y0, x1, y1, c):
        self.d.ellipse([x0, y0, x1, y1], fill=c)

    def outline(self):
        src = self.im.copy()
        sp = src.load()
        dp = self.im.load()
        for y in range(H):
            for x in range(W):
                if sp[x, y][3]:
                    continue
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + ox, y + oy
                    if 0 <= nx < W and 0 <= ny < H and sp[nx, ny][3] > 200:
                        dp[x, y] = OUTLINE
                        break


def pose(i):
    """프레임 번호 → 몸 흔들림, 다리, 무기 각도(도, 0=앞, 90=아래, -90=위)"""
    p = dict(bob=0, la=0, lb=0, wa=55, lean=0, atk=None, hurt=False)
    if i < 4:
        p['bob'] = [0, 0, 1, 1][i]
        p['wa'] = 55 + [0, 2, 4, 2][i]
    elif i < 10:
        k = (i - 4) / 6 * math.pi * 2
        p['la'] = round(math.sin(k) * 2)
        p['lb'] = -p['la']
        p['bob'] = 1 if (i - 4) % 3 == 0 else 0
        p['wa'] = 50 + round(math.sin(k) * 8)
        p['lean'] = 1
    elif i == 10:
        p.update(wa=-125, atk=0, lean=-1)
    elif i == 11:
        p.update(wa=15, atk=1, lean=2)
    elif i == 12:
        p.update(wa=70, atk=2, lean=1)
    elif i == 13:
        p.update(wa=-40, hurt=True, lean=-2, bob=1)
    return p


def hand_of(p, sx=18, sy=19, L=5):
    a = math.radians(p['wa'])
    return sx + p['lean'] + math.cos(a) * L, sy + p['bob'] + math.sin(a) * L


# ---------------- 무기 ----------------
def weapon(g, kind, hxp, hyp, ang, C, p):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    if kind in ('sword', 'katana'):
        L = 12 if kind == 'sword' else 13
        tx, ty = hxp + ca * L, hyp + sa * L
        g.line(hxp - ca * 2, hyp - sa * 2, hxp, hyp, C['grip'], 2)
        g.line(hxp + ca, hyp + sa, tx, ty, C['blade'], 3 if kind == 'sword' else 2)
        g.line(hxp + ca * 2, hyp + sa * 2, tx - ca, ty - sa, C['edge'], 1)
        g.line(hxp - sa * 3, hyp + ca * 3, hxp + sa * 3, hyp - ca * 3, C['guard'], 2)
    elif kind == 'daggers':
        for off in (0, 1):
            aa = a + (0.5 if off else 0)
            tx, ty = hxp + math.cos(aa) * 7, hyp + math.sin(aa) * 7
            g.line(hxp, hyp, tx, ty, C['blade'], 2)
            g.px(tx, ty, C['edge'])
        g.px(hxp, hyp, C['grip'])
    elif kind == 'hammer':
        tx, ty = hxp + ca * 11, hyp + sa * 11
        g.line(hxp - ca * 3, hyp - sa * 3, tx, ty, C['grip'], 2)
        hw = 4
        pts = [(tx - sa * hw - ca * 3, ty + ca * hw - sa * 3), (tx + sa * hw - ca * 3, ty - ca * hw - sa * 3),
               (tx + sa * hw + ca * 3, ty - ca * hw + sa * 3), (tx - sa * hw + ca * 3, ty + ca * hw + sa * 3)]
        g.poly(pts, C['head'])
        g.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], C['edge'], 1)
        g.px(tx, ty, C['gem'])
    elif kind == 'axe':
        tx, ty = hxp + ca * 12, hyp + sa * 12
        g.line(hxp - ca * 3, hyp - sa * 3, tx, ty, C['grip'], 2)
        nx, ny = -sa, ca  # 날은 몸 바깥쪽
        pts = [(tx - ca * 4, ty - sa * 4), (tx - ca * 5 + nx * 6, ty - sa * 5 + ny * 6), (tx + ca * 2 + nx * 7, ty + sa * 2 + ny * 7), (tx + ca, ty + sa)]
        pts = [(tx - ca * 4 - nx * 1, ty - sa * 4 - ny * 1), (tx - ca * 6 - nx * 6, ty - sa * 6 - ny * 6), (tx + ca * 2 - nx * 7, ty + sa * 2 - ny * 7), (tx + ca, ty + sa)]
        g.poly(pts, C['head'])
        g.line(pts[1][0], pts[1][1], pts[2][0], pts[2][1], C['edge'], 1)
    elif kind == 'scythe':
        tx, ty = hxp + ca * 13, hyp + sa * 13
        g.line(hxp - ca * 5, hyp - sa * 5, tx, ty, C['grip'], 1)
        nx, ny = -sa, ca
        bx, by = tx, ty
        pts = []
        for k in range(8):
            t = k / 7
            # 초승달 모양 날
            px_ = bx + ca * (-t * 10) + nx * (-math.sin(t * math.pi) * 4 - t * 2)
            py_ = by + sa * (-t * 10) + ny * (-math.sin(t * math.pi) * 4 - t * 2)
            pts.append((px_, py_))
        for k in range(len(pts) - 1):
            g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], C['blade'], 2)
        for k in range(len(pts) - 1):
            g.px(pts[k][0], pts[k][1], C['edge'])
    elif kind == 'staff':
        # 지팡이는 거의 세워 들고, 공격 땐 앞으로 내밂
        sa_ = -70 if p['atk'] is None else (-100 if p['atk'] == 0 else -10)
        a2 = math.radians(sa_)
        tx, ty = hxp + math.cos(a2) * 11, hyp + math.sin(a2) * 11
        g.line(hxp - math.cos(a2) * 5, hyp - math.sin(a2) * 5, tx, ty, C['grip'], 1)
        g.ell(tx - 2, ty - 2, tx + 2, ty + 2, C['gem'])
        g.px(tx - 1, ty - 1, shade(C['gem'], 0.6))
        if C.get('crown'):
            g.px(tx - 3, ty, C['crown']); g.px(tx + 3, ty, C['crown']); g.px(tx, ty - 3, C['crown'])
    elif kind == 'bow':
        fx = hxp + (2 if p['atk'] != 0 else 0)
        g.line(fx, hyp - 8, fx + 3, hyp - 4, C['wood'], 1)
        g.line(fx + 3, hyp - 4, fx + 3, hyp + 4, C['wood'], 1)
        g.line(fx + 3, hyp + 4, fx, hyp + 8, C['wood'], 1)
        g.px(fx + 3, hyp, C['gem'])
        pull = 4 if p['atk'] == 0 else 0
        g.line(fx, hyp - 8, fx - pull, hyp, C['string'], 1)
        g.line(fx - pull, hyp, fx, hyp + 8, C['string'], 1)
        if p['atk'] == 0:
            g.line(fx - pull, hyp, fx + 6, hyp, C['arrow'], 1)
    elif kind == 'rifle':
        kick = -2 if p['atk'] == 1 else 0
        y = hyp - 1
        x0 = hxp - 5 + kick
        g.rect(x0, y, x0 + 4, y + 2, C['wood'])
        g.rect(x0 + 4, y, x0 + 15, y + 1, C['metal'])
        g.px(x0 + 9, y - 1, C['gem'])
        g.px(x0 + 10, y - 1, C['gem'])
        g.px(x0 + 15, y, C['edge'])
    elif kind == 'pistol':
        kick = -1 if p['atk'] == 1 else 0
        y = hyp - 1
        g.rect(hxp - 1 + kick, y, hxp + 5 + kick, y + 1, C['metal'])
        g.rect(hxp - 1 + kick, y + 2, hxp + kick, y + 3, C['wood'])
        g.px(hxp + 5 + kick, y, C['edge'])
    elif kind == 'flask':
        x, y = hxp, hyp - 3
        g.rect(x, y + 1, x + 3, y + 4, C['glass'])
        g.rect(x + 1, y - 1, x + 2, y, C['cork'])
        g.rect(x, y + 3, x + 3, y + 4, C['liquid'])
        g.px(x + 1, y + 2, shade(C['glass'], 0.6))
    elif kind == 'gohei':
        a2 = math.radians(-60 if p['atk'] is None else (-120 if p['atk'] == 0 else 0))
        tx, ty = hxp + math.cos(a2) * 10, hyp + math.sin(a2) * 10
        g.line(hxp, hyp, tx, ty, C['wood'], 1)
        for k in range(3):
            g.rect(tx - 1 + k, ty + k * 2, tx + k, ty + 1 + k * 2, C['paper'] if k % 2 == 0 else C['gem'])


# ---------------- 몸 ----------------
def body(g, p, C):
    b, l = p['bob'], p['lean']
    # 다리
    for lx, ph, col in ((12, p['lb'], shade(C['pants'], -0.2)), (17, p['la'], C['pants'])):
        lift = 1 if ph > 0 else 0
        g.rect(lx + l // 2 + ph // 2, 24 - lift, lx + 2 + l // 2 + ph // 2, 27 - lift, col)
        g.rect(lx - 0 + l // 2 + ph // 2, 27 - lift, lx + 3 + l // 2 + ph // 2, 28 - lift, C['boots'])
    # 몸통
    g.shaded(11 + l, 17 + b, 20 + l, 24 + b, C['cloth'])
    if C.get('trim'):
        g.rect(11 + l, 23 + b, 20 + l, 23 + b, C['trim'])
    if C.get('belt'):
        g.rect(11 + l, 21 + b, 20 + l, 21 + b, C['belt'])
        g.px(16 + l, 21 + b, C.get('buckle', hx('#ffd54f')))
    if C.get('chest'):
        g.rect(14 + l, 18 + b, 17 + l, 20 + b, C['chest'])


def head(g, p, C):
    b, l = p['bob'], p['lean']
    x0, y0 = 10 + l, 6 + b
    skin = C.get('skin', SKIN)
    g.rect(x0 + 1, y0, x0 + 10, y0 + 10, skin)
    g.rect(x0, y0 + 1, x0 + 11, y0 + 9, skin)
    g.rect(x0 + 1, y0 + 9, x0 + 10, y0 + 10, shade(skin, -0.15))
    if C.get('mask'):
        g.rect(x0, y0 + 6, x0 + 11, y0 + 10, C['mask'])
    ey = y0 + 5
    if p['hurt']:
        for ex in (x0 + 6, x0 + 9):
            g.px(ex - 1, ey - 1, EYE); g.px(ex + 1, ey + 1, EYE); g.px(ex + 1, ey - 1, EYE); g.px(ex - 1, ey + 1, EYE)
    else:
        eye = C.get('eye', EYE)
        for ex in (x0 + 6, x0 + 9):
            g.rect(ex, ey, ex, ey + 1, eye)
            if C.get('eyeglow'):
                g.px(ex, ey, C['eyeglow'])
        if not C.get('mask'):
            g.px(x0 + 4, ey + 2, hx('#f48fb1'))  # 볼
    return x0, y0


# ---------------- 캐릭터별 ----------------
def draw_char(key, i):
    g = P()
    p = pose(i)
    b, l = p['bob'], p['lean']
    C = SPEC[key]
    hand = hand_of(p)
    back = C.get('back')
    if back:
        back(g, p, C)
    body(g, p, C)
    x0, y0 = head(g, p, C)
    C['hat'](g, p, C, x0, y0)
    # 앞팔 + 무기
    hxp, hyp = hand
    sx, sy = 18 + l, 19 + b
    g.line(sx, sy, hxp, hyp, shade(C['cloth'], 0.1), 2)
    weapon(g, C['weapon'], hxp, hyp, p['wa'], C, p)
    g.rect(hxp - 1, hyp - 1, hxp, hyp, C.get('glove', SKIN))
    if C.get('front'):
        C['front'](g, p, C, x0, y0)
    g.outline()
    return g.im


def cape(color, long=7):
    def f(g, p, C):
        b, l = p['bob'], p['lean']
        sway = [0, 1, 1, 0, -1, 0][(i_global[0]) % 6] if 4 <= i_global[0] < 10 else 0
        g.poly([(13 + l, 16 + b), (19 + l, 16 + b), (11 + l - 3 - sway, 18 + b + long + 1), (8 + l - 3 - sway, 18 + b + long - 2)], color)
        g.poly([(13 + l, 16 + b), (16 + l, 16 + b), (9 + l - 3 - sway, 18 + b + long)], shade(color, -0.25))
    return f


def scarf(color):
    def f(g, p, C, x0, y0):
        t = i_global[0]
        wave = [0, 1, 0, -1][t % 4]
        g.rect(x0 + 1, y0 + 10, x0 + 10, y0 + 11, color)
        g.line(x0 + 1, y0 + 11, x0 - 4, y0 + 9 + wave, color, 2)
        g.line(x0 - 4, y0 + 9 + wave, x0 - 8, y0 + 11 - wave, shade(color, -0.2), 2)
    return f


i_global = [0]


def hat_knight(g, p, C, x0, y0):
    m = C['helm']
    g.rect(x0, y0 - 1, x0 + 11, y0 + 4, m)
    g.rect(x0, y0 + 4, x0 + 3, y0 + 9, m)
    g.rect(x0 + 1, y0 - 2, x0 + 10, y0 - 1, shade(m, 0.25))
    g.rect(x0 + 5, y0 + 3, x0 + 11, y0 + 3, shade(m, -0.4))  # 투구 틈
    sway = 1 if p['lean'] > 0 else 0
    g.poly([(x0 + 4, y0 - 2), (x0 + 7, y0 - 2), (x0 + 2 - sway, y0 - 7), (x0 - 2 - sway, y0 - 4)], C['plume'])
    g.px(x0 + 1 - sway, y0 - 5, shade(C['plume'], 0.4))


def hat_hood(g, p, C, x0, y0):
    h = C['hood']
    g.rect(x0 - 1, y0 - 2, x0 + 11, y0 + 3, h)
    g.rect(x0 - 1, y0 + 3, x0 + 3, y0 + 10, h)
    g.rect(x0, y0 - 3, x0 + 9, y0 - 2, shade(h, 0.2))
    g.poly([(x0 - 1, y0), (x0 - 5, y0 + 4), (x0 - 1, y0 + 6)], shade(h, -0.2))
    if C.get('hoodtrim'):
        g.rect(x0 + 4, y0 + 2, x0 + 11, y0 + 2, C['hoodtrim'])


def hat_wizard(g, p, C, x0, y0):
    h = C['hood']
    g.rect(x0 - 2, y0 + 1, x0 + 13, y0 + 2, shade(h, -0.15))  # 챙
    g.poly([(x0 + 1, y0 + 1), (x0 + 10, y0 + 1), (x0 + 3, y0 - 9), (x0 - 1, y0 - 7)], h)
    g.rect(x0 + 1, y0 - 1, x0 + 10, y0, C['hoodtrim'])
    g.px(x0 + 1, y0 - 8, C['gem'])
    g.rect(x0, y0 + 3, x0 + 2, y0 + 8, C['hair'])


def hat_ninja(g, p, C, x0, y0):
    g.rect(x0, y0 - 1, x0 + 11, y0 + 4, C['hood'])
    g.rect(x0, y0 + 4, x0 + 3, y0 + 7, C['hood'])
    g.rect(x0 + 2, y0 + 1, x0 + 11, y0 + 1, C['hoodtrim'])
    t = i_global[0]
    w = [0, 1, 0, -1][t % 4]
    g.line(x0, y0 + 1, x0 - 5, y0 + w, C['hoodtrim'], 1)
    g.line(x0, y0 + 2, x0 - 5, y0 + 3 - w, C['hoodtrim'], 1)


def hat_horn(g, p, C, x0, y0):
    m = C['helm']
    g.rect(x0, y0 - 1, x0 + 11, y0 + 3, m)
    g.rect(x0 + 1, y0 - 2, x0 + 10, y0 - 1, shade(m, 0.25))
    g.rect(x0, y0 + 3, x0 + 2, y0 + 9, m)
    for sx in (x0 - 1, x0 + 10):
        d = -1 if sx < x0 + 5 else 1
        g.line(sx, y0, sx + d * 2, y0 - 4, C['horn'], 2)
        g.px(sx + d * 3, y0 - 6, C['horn'])
    g.rect(x0 + 5, y0 + 8, x0 + 11, y0 + 11, C['hair'])  # 수염
    g.rect(x0 + 6, y0 + 11, x0 + 10, y0 + 12, C['hair'])
    g.rect(x0 + 7, y0 + 12, x0 + 9, y0 + 13, shade(C['hair'], -0.2))


def hat_priest(g, p, C, x0, y0):
    h = C['hood']
    g.rect(x0 - 1, y0 - 2, x0 + 11, y0 + 2, h)
    g.rect(x0 - 1, y0 + 2, x0 + 3, y0 + 11, h)
    g.rect(x0 + 3, y0 - 1, x0 + 11, y0, C['hoodtrim'])
    g.px(x0 + 6, y0 - 4, C['gem']); g.px(x0 + 6, y0 - 3, C['gem']); g.px(x0 + 5, y0 - 3, C['gem']); g.px(x0 + 7, y0 - 3, C['gem'])


def hat_goggle(g, p, C, x0, y0):
    g.rect(x0, y0 - 1, x0 + 11, y0 + 3, C['hair'])
    g.rect(x0 - 1, y0 + 1, x0 + 1, y0 + 8, C['hair'])
    g.rect(x0 + 2, y0 - 2, x0 + 8, y0, C['hair'])
    g.rect(x0 + 4, y0 + 1, x0 + 11, y0 + 3, C['strap'])
    g.rect(x0 + 5, y0 + 1, x0 + 7, y0 + 3, C['lens'])
    g.rect(x0 + 9, y0 + 1, x0 + 11, y0 + 3, C['lens'])
    g.px(x0 + 5, y0 + 1, hx('#ffffff')); g.px(x0 + 9, y0 + 1, hx('#ffffff'))


def hat_spiky(g, p, C, x0, y0):
    h = C['hair']
    g.rect(x0, y0 - 1, x0 + 11, y0 + 3, h)
    g.rect(x0 - 1, y0 + 2, x0 + 2, y0 + 8, h)
    for k in range(5):
        g.poly([(x0 + k * 2.4, y0), (x0 + k * 2.4 + 3, y0), (x0 + k * 2.4 - 1, y0 - 4 - (k % 2) * 2)], h)
    g.rect(x0 + 2, y0 + 2, x0 + 11, y0 + 3, C['band'])
    g.line(x0, y0 + 3, x0 - 5, y0 + 6, C['band'], 1)


def hat_miko(g, p, C, x0, y0):
    h = C['hair']
    g.rect(x0, y0 - 1, x0 + 11, y0 + 3, h)
    g.rect(x0 - 2, y0 + 1, x0 + 2, y0 + 14, h)  # 긴 머리
    g.rect(x0 + 6, y0 + 3, x0 + 11, y0 + 4, h)  # 앞머리
    g.rect(x0 - 3, y0 - 2, x0 - 1, y0 + 1, C['bow'])
    g.rect(x0 - 2, y0 + 9, x0, y0 + 10, C['bow'])


def hat_reaper(g, p, C, x0, y0):
    h = C['hood']
    g.rect(x0 - 2, y0 - 2, x0 + 11, y0 + 11, h)
    g.rect(x0 - 1, y0 - 3, x0 + 9, y0 - 2, shade(h, 0.15))
    g.poly([(x0 - 2, y0 - 1), (x0 - 7, y0 + 2), (x0 - 2, y0 + 5)], shade(h, -0.2))
    g.rect(x0 + 4, y0 + 2, x0 + 11, y0 + 9, hx('#0d0a14'))  # 어두운 얼굴
    if not p['hurt']:
        g.rect(x0 + 6, y0 + 5, x0 + 6, y0 + 6, C['eyeglow'])
        g.rect(x0 + 9, y0 + 5, x0 + 9, y0 + 6, C['eyeglow'])


def hat_pirate(g, p, C, x0, y0):
    h = C['hood']
    g.rect(x0 - 2, y0 + 1, x0 + 13, y0 + 2, h)
    g.poly([(x0, y0 + 1), (x0 + 11, y0 + 1), (x0 + 9, y0 - 4), (x0 + 2, y0 - 4)], h)
    g.rect(x0 + 2, y0 - 1, x0 + 9, y0 - 1, C['hoodtrim'])
    g.px(x0 + 5, y0 - 3, hx('#eeeeee')); g.px(x0 + 6, y0 - 3, hx('#eeeeee'))
    g.rect(x0, y0 + 3, x0 + 2, y0 + 9, C['hair'])
    g.rect(x0 + 8, y0 + 4, x0 + 10, y0 + 6, hx('#1b1530'))  # 안대
    g.line(x0 + 3, y0 + 3, x0 + 8, y0 + 5, hx('#1b1530'), 1)


def quiver(g, p, C):
    b, l = p['bob'], p['lean']
    g.rect(9 + l, 15 + b, 11 + l, 22 + b, C['wood'])
    for k in range(3):
        g.px(9 + l + k, 14 + b - (k % 2), C['arrow'])


def backpack(g, p, C):
    b, l = p['bob'], p['lean']
    g.shaded(7 + l, 16 + b, 11 + l, 23 + b, C['pack'])
    g.rect(8 + l, 17 + b, 10 + l, 18 + b, C['liquid'])


def robe_skirt(color):
    def f(g, p, C, x0, y0):
        b, l = p['bob'], p['lean']
        g.poly([(11 + l, 23 + b), (20 + l, 23 + b), (22 + l, 28), (9 + l, 28)], color)
        g.rect(9 + l, 27, 22 + l, 28, shade(color, -0.3))
        if C.get('trim'):
            g.rect(10 + l, 26, 21 + l, 26, C['trim'])
    return f


def combine(*fs):
    def f(*a):
        for x in fs:
            x(*a)
    return f


SPEC = {
    'knight': dict(cloth=hx('#9aa5b8'), chest=hx('#d32f2f'), pants=hx('#5c6577'), boots=hx('#3e4452'), belt=hx('#6d4c41'),
                   helm=hx('#b8c2d2'), plume=hx('#ff5722'), hat=hat_knight, weapon='sword', glove=hx('#8a94a6'),
                   grip=hx('#5d4037'), blade=hx('#e0e6ef'), edge=hx('#ffab40'), guard=hx('#ffca28'), back=cape(hx('#c62828'), 8)),
    'archer': dict(cloth=hx('#5d7a3a'), pants=hx('#6d4c2f'), boots=hx('#4e342e'), belt=hx('#8d6e63'), hood=hx('#f9a825'), hoodtrim=hx('#fff176'),
                   hat=hat_hood, weapon='bow', wood=hx('#8d5a2b'), string=hx('#fff9c4'), arrow=hx('#e0e0e0'), gem=hx('#ffeb3b'), back=quiver),
    'mage': dict(cloth=hx('#1e5fb8'), pants=hx('#173f7a'), boots=hx('#102a52'), hood=hx('#1976d2'), hoodtrim=hx('#b3e5fc'), hair=hx('#e3f2fd'),
                 hat=hat_wizard, weapon='staff', grip=hx('#cfd8dc'), gem=hx('#81d4fa'), crown=hx('#e1f5fe'), trim=hx('#b3e5fc'),
                 front=robe_skirt(hx('#1e5fb8'))),
    'ninja': dict(cloth=hx('#2b3a2c'), pants=hx('#1f2a20'), boots=hx('#141b15'), belt=hx('#66bb6a'), hood=hx('#263228'), hoodtrim=hx('#a5d6a7'),
                  mask=hx('#263228'), hat=hat_ninja, weapon='daggers', blade=hx('#e8f5e9'), edge=hx('#ffffff'), grip=hx('#3e2723'),
                  front=scarf(hx('#81c784'))),
    'guardian': dict(cloth=hx('#8d6e63'), chest=hx('#c49a6c'), pants=hx('#5d4037'), boots=hx('#3e2723'), belt=hx('#3e2723'), helm=hx('#a1887f'),
                     horn=hx('#efebe9'), hair=hx('#ff8a65'), hat=hat_horn, weapon='hammer', grip=hx('#5d4037'), head=hx('#8d8d8d'),
                     edge=hx('#cfcfcf'), gem=hx('#ffb74d'), glove=hx('#6d4c41'), back=cape(hx('#6d4c41'), 5)),
    'priest': dict(cloth=hx('#eceff1'), pants=hx('#b0bec5'), boots=hx('#78909c'), hood=hx('#e3f2fd'), hoodtrim=hx('#4fc3f7'), trim=hx('#29b6f6'),
                   hat=hat_priest, weapon='staff', grip=hx('#ffe082'), gem=hx('#4fc3f7'), crown=hx('#ffe082'), chest=hx('#4fc3f7'),
                   front=robe_skirt(hx('#eceff1'))),
    'sniper': dict(cloth=hx('#3b2a5c'), pants=hx('#2a1f40'), boots=hx('#1a1328'), belt=hx('#9c64ff'), hood=hx('#4a3472'), hoodtrim=hx('#9c64ff'),
                   mask=hx('#2a1f40'), hat=hat_hood, weapon='rifle', wood=hx('#4e342e'), metal=hx('#78909c'), gem=hx('#d1b3ff'), edge=hx('#b388ff'),
                   back=cape(hx('#311b52'), 9)),
    'alchemist': dict(cloth=hx('#7b5a3a'), chest=hx('#9ccc65'), pants=hx('#4e3b28'), boots=hx('#33261a'), belt=hx('#3e2c1c'), hair=hx('#8d6e63'),
                      strap=hx('#3e2723'), lens=hx('#c5e1a5'), hat=hat_goggle, weapon='flask', glass=hx('#dcedc8'), cork=hx('#a1887f'),
                      liquid=hx('#7cb342'), pack=hx('#6d4c41'), back=backpack),
    'berserker': dict(cloth=hx('#8b2d1e'), chest=hx('#ffab40'), pants=hx('#3e2723'), boots=hx('#211512'), belt=hx('#1b1b1b'), hair=hx('#ff7043'),
                      band=hx('#212121'), hat=hat_spiky, weapon='axe', grip=hx('#4e342e'), head=hx('#9e9e9e'), edge=hx('#ff6d00'),
                      skin=hx('#e0a37a'), glove=hx('#5d4037')),
    'miko': dict(cloth=hx('#fafafa'), chest=hx('#e53935'), pants=hx('#d32f2f'), boots=hx('#5d4037'), hair=hx('#2b2140'), bow=hx('#e53935'),
                 hat=hat_miko, weapon='gohei', wood=hx('#8d6e63'), paper=hx('#ffffff'), gem=hx('#ffe14d'), trim=hx('#e53935'),
                 front=robe_skirt(hx('#d32f2f'))),
    'reaper': dict(cloth=hx('#231b30'), pants=hx('#18121f'), boots=hx('#0f0b14'), hood=hx('#2c2240'), eyeglow=hx('#e040fb'), hat=hat_reaper,
                   weapon='scythe', grip=hx('#5d4037'), blade=hx('#b0a8c8'), edge=hx('#e1bee7'), glove=hx('#cfc6e0'),
                   back=cape(hx('#1a1426'), 10), front=robe_skirt(hx('#231b30'))),
    'pirate': dict(cloth=hx('#1565c0'), chest=hx('#fafafa'), pants=hx('#3e2723'), boots=hx('#211512'), belt=hx('#5d4037'), hood=hx('#212121'),
                   hoodtrim=hx('#ffd54f'), hair=hx('#6d4c41'), hat=hat_pirate, weapon='pistol', metal=hx('#90a4ae'), wood=hx('#6d4c41'),
                   edge=hx('#4fc3f7'), back=cape(hx('#0d47a1'), 6)),
}


def dead_frame(img):
    lying = img.rotate(90, expand=False, resample=Image.NEAREST)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(lying, (0, 8))
    return out


def main():
    sheet = Image.new('RGBA', (W * FRAMES, H * len(ORDER)), (0, 0, 0, 0))
    for r, key in enumerate(ORDER):
        idle = None
        for i in range(FRAMES - 1):
            i_global[0] = i
            im = draw_char(key, i)
            if i == 0:
                idle = im
            sheet.alpha_composite(im, (i * W, r * H))
        sheet.alpha_composite(dead_frame(idle), ((FRAMES - 1) * W, r * H))
    sheet.save(OUT)
    print('saved', OUT, sheet.size)


if __name__ == '__main__':
    main()
