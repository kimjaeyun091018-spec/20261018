"""원소 아레나 영웅 도트 → assets/heroes.png, assets/portraits.png

영웅마다 손으로 찍은 픽셀 격자(머리·모자·몸·망토·무기, tools/hero_art.py)를 겹쳐 그리고,
걷기·공격 같은 동작은 이 파일이 만듭니다.
  한 칸 40x40, 한 줄 = 한 영웅, 16칸:
  0-3 서기 · 4-9 걷기 · 10 준비 · 11 공격 · 12 마무리 · 13 맞음 · 14 쓰러짐 · 15 승리
  portraits.png: 64x64 얼굴 (영웅 순서대로 가로)
오른쪽을 보는 그림만 그리고, 왼쪽은 게임에서 뒤집습니다.
실행: python3 tools/make_heroes.py
"""
import math
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hero_art import HEROES, COMMON, FACE, ORDER  # noqa: E402

W = H = 40
FRAMES = 16
OY = 2            # 모자가 들어갈 위쪽 여유
ROOT = Path(__file__).resolve().parent.parent
EYES = [(9, 8), (13, 8)]  # 얼굴 격자에서 눈 2x3 블록 왼쪽 위


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, k):
    r, g, b, a = c
    if k > 0:
        return (int(r + (255 - r) * k), int(g + (255 - g) * k), int(b + (255 - b) * k), a)
    return (max(0, int(r * (1 + k))), max(0, int(g * (1 + k))), max(0, int(b * (1 + k))), a)


def check(rows, w, name):
    for i, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f'{name} {i}행 길이 {len(r)} (기대 {w}): {r!r}')


def palette(spec):
    pal = {k: hx(v) for k, v in COMMON.items()}
    pal.update({k: hx(v) for k, v in spec['pal'].items()})
    pal.setdefault('I', shade(pal['i'], -0.45))
    return pal


class Frame:
    def __init__(self):
        self.im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        self.px = self.im.load()

    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H and c is not None:
            self.px[x, y] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.put(x, y, c)

    def stamp(self, rows, ox, oy, pal):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in '. ':
                    continue
                self.put(ox + x, oy + y, pal[ch])

    def paste(self, img, ox, oy):
        self.im.alpha_composite(img, (int(round(ox)), int(round(oy))))
        self.px = self.im.load()

    def outline(self, col):
        src = self.im.copy()
        sp = src.load()
        for y in range(H):
            for x in range(W):
                if sp[x, y][3]:
                    continue
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + ox, y + oy
                    if 0 <= nx < W and 0 <= ny < H and sp[nx, ny][3] > 200:
                        self.px[x, y] = col
                        break


def grid_image(rows, pal):
    w = len(rows[0])
    im = Image.new('RGBA', (w, len(rows)), (0, 0, 0, 0))
    p = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch not in '. ':
                p[x, y] = pal[ch]
    return im


def rotated(img, pivot, deg):
    w, h = img.size
    big = Image.new('RGBA', (w * 3, h * 3), (0, 0, 0, 0))
    big.alpha_composite(img, (w, h))
    px, py = pivot[0] + w, pivot[1] + h
    return big.rotate(-deg, resample=Image.NEAREST, center=(px, py)), (px, py)


def eye_variant(rows, mode):
    if mode == 'normal':
        return rows
    g = [list(r) for r in rows]
    for ex, ey in EYES:
        if g[ey][ex] not in 'e':  # 눈이 가려진 영웅(복면 등)은 그대로
            continue
        for dy in range(3):
            for dx in range(2):
                if g[ey + dy][ex + dx] in 'eiwI':
                    g[ey + dy][ex + dx] = 's'
        if mode == 'closed':
            g[ey + 1][ex] = 'e'; g[ey + 1][ex + 1] = 'e'
        elif mode == 'happy':
            g[ey + 1][ex] = 'e'; g[ey][ex + 1] = 'e'
            if ex + 2 < len(g[0]):
                pass
        elif mode == 'x':
            g[ey][ex] = 'e'; g[ey + 1][ex + 1] = 'e'; g[ey][ex + 1] = 'e'; g[ey + 1][ex] = 'e'
    return [''.join(r) for r in g]


def merge(base, over):
    out = []
    for br, orow in zip(base, over):
        out.append(''.join(('.' if o == '_' else (b if o == '.' else o)) for b, o in zip(br, orow)))
    return out


def head_rows(spec, eyes='normal'):
    face = spec.get('face', FACE)
    check(face, 18, 'face')
    check(spec['head'], 18, 'head')
    h = merge(face, spec['head'])
    if 'eyes' in spec:  # 눈 모양을 바꾸는 영웅 (복면, 안대 등)
        h = merge(h, spec['eyes'])
    return eye_variant(h, eyes)


# 무기 각도 (도, 0 = 오른쪽, 90 = 아래, -90 = 위)
ANG = {
    'melee': dict(rest=60, windup=-130, strike=15, follow=80, hurt=20, win=-85),
    'heavy': dict(rest=70, windup=-150, strike=30, follow=95, hurt=40, win=-80),
    'staff': dict(rest=-70, windup=-110, strike=-15, follow=-40, hurt=-50, win=-95),
    'bow': dict(rest=0, windup=0, strike=0, follow=0, hurt=10, win=-60),
    'gun': dict(rest=10, windup=-10, strike=0, follow=-20, hurt=40, win=-70),
    'hold': dict(rest=20, windup=-60, strike=-5, follow=30, hurt=40, win=-80),
}


def pose(i, spec):
    A = {**ANG[spec['kind']], **spec.get('ang', {})}
    p = dict(bob=0, la=0, lb=0, wa=A['rest'], lean=0, eyes='normal', atk=None, cape=0)
    if i < 4:
        p['bob'] = [0, 0, 1, 1][i]
        p['wa'] = A['rest'] + [0, 2, 3, 1][i]
        p['cape'] = [0, 0, 1, 1][i]
    elif i < 10:
        k = (i - 4) / 6 * math.tau
        p['la'] = round(math.sin(k) * 2.2)
        p['lb'] = -p['la']
        p['bob'] = 1 if (i - 4) % 3 == 0 else 0
        p['wa'] = A['rest'] + round(math.sin(k) * 6)
        p['lean'] = 1
        p['cape'] = 2 + (i % 2)
    elif i == 10:
        p.update(wa=A['windup'], atk=0, lean=-1, cape=1)
    elif i == 11:
        p.update(wa=A['strike'], atk=1, lean=2, cape=3)
    elif i == 12:
        p.update(wa=A['follow'], atk=2, lean=1, cape=2)
    elif i == 13:
        p.update(wa=A['hurt'], eyes='closed', lean=-2, bob=1, cape=1, atk='hurt')
    elif i == 15:
        p.update(wa=A['win'], eyes='happy', bob=-1, cape=2, atk='win')
    elif i == 14:
        p.update(eyes='x')
    return p


def draw_legs(f, p, pal, spec):
    pc, oc, ol = (pal[c] for c in spec['legs'])
    base = 29 + OY
    for lx, ph, dark in ((15, p['lb'], True), (20, p['la'], False)):
        col = shade(pc, -0.25) if dark else pc
        lift = 1 if ph > 0 else 0
        x = lx + p['lean'] // 2 + ph
        f.rect(x, base - lift, x + 2, base + 4 - lift, col)
        f.rect(x, base + 5 - lift, x + 3, base + 7 - lift, shade(oc, -0.25) if dark else oc)
        f.put(x + 1, base + 5 - lift, ol)


def draw_frame(key, i):
    spec = HEROES[key]
    pal = palette(spec)
    p = pose(i, spec)
    f = Frame()
    b, l = p['bob'], p['lean']
    # 등 뒤
    for rows, (bx, by) in spec.get('back', []):
        sway = [0, 0, -1, 1][p['cape'] % 4] if spec.get('sway', True) else 0
        f.stamp(rows, bx + l + sway, by + b + OY, pal)
    # 뒤 무기 (무기가 몸 뒤로 가는 자세)
    W_ = spec['weapon']
    wimg = grid_image(W_['grid'], pal)
    sx, sy = 25 + l + spec.get('shoulder', (0, 0))[0], 21 + b + OY + spec.get('shoulder', (0, 0))[1]
    if spec['kind'] in ('melee', 'heavy', 'hold'):
        a = math.radians(p['wa'])
        reach = spec.get('reach', 4)
        hxp, hyp = sx + math.cos(a) * reach, sy + math.sin(a) * reach + 1
    else:
        push = {0: -1, 1: 2, 2: 1, 'win': 0, 'hurt': -1}.get(p['atk'], 0)
        hxp, hyp = sx + 2 + push, sy + 1 + (-3 if p['atk'] == 'win' else 0)
    rimg, (px_, py_) = rotated(wimg, W_['pivot'], p['wa'])
    behind = spec.get('behind') and (p['wa'] < -60)
    if behind:
        f.paste(rimg, hxp - px_, hyp - py_)
    draw_legs(f, p, pal, spec)
    check(spec['body'], 14, key + ' body')
    f.stamp(spec['body'], 13 + l, 18 + b + OY, pal)
    hd = head_rows(spec, p['eyes'])
    hat = spec.get('hat', [])
    check(hat, 18, key + ' hat')
    f.stamp(hat, 11 + l, 2 + b + OY - len(hat), pal)
    f.stamp(hd, 11 + l, 2 + b + OY, pal)
    for rows, (fx, fy) in spec.get('front', []):
        f.stamp(rows, fx + l, fy + b + OY, pal)
    if not behind:
        f.paste(rimg, hxp - px_, hyp - py_)
    # 팔 (어깨 → 손)
    arm = pal[spec.get('arm', 'a')]
    for k in range(7):
        t = k / 6
        f.put(sx + (hxp - sx) * t, sy + (hyp - sy) * t, arm)
        f.put(sx + (hxp - sx) * t, sy + (hyp - sy) * t + 1, shade(arm, -0.35))
    f.rect(hxp - 1, hyp - 1, hxp, hyp, pal[spec.get('glove', 's')])
    f.outline(pal['k'])
    return f.im


def dead_frame(key):
    img = draw_frame(key, 14)
    lying = img.rotate(90, resample=Image.NEAREST)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(lying, (0, 10))
    return out


def portrait(key):
    """64x64 얼굴: 머리(+모자)와 어깨를 3배로"""
    spec = HEROES[key]
    pal = palette(spec)
    hat = spec.get('hat', [])
    top = len(hat)
    canvas = Image.new('RGBA', (24, top + 26), (0, 0, 0, 0))
    for rows, (bx, by) in spec.get('back', []):
        if spec.get('back_in_portrait', True):
            canvas.alpha_composite(grid_image(rows, pal), (bx - 10, by - 2 + top))
    canvas.alpha_composite(grid_image(spec['body'], pal), (3 + 2, 16 + top))
    if hat:
        canvas.alpha_composite(grid_image(hat, pal), (1 + 2, 0))
    canvas.alpha_composite(grid_image(head_rows(spec), pal), (1 + 2, top))
    for rows, (fx, fy) in spec.get('front', []):
        canvas.alpha_composite(grid_image(rows, pal), (fx - 10 + 2, fy - 2 + top))
    # 얼굴이 가운데 오도록 22x22 잘라서 3배
    cy = top + 9
    crop = canvas.crop((1, cy - 10, 23, cy + 12)).resize((66, 66), Image.NEAREST).crop((1, 1, 65, 65))
    out = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    out.alpha_composite(crop)
    src = out.copy(); sp = src.load(); dp = out.load()
    for y in range(64):
        for x in range(64):
            if sp[x, y][3]:
                continue
            for ox, oy in ((2, 0), (-2, 0), (0, 2), (0, -2), (1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + ox, y + oy
                if 0 <= nx < 64 and 0 <= ny < 64 and sp[nx, ny][3] > 200:
                    dp[x, y] = pal['k']
                    break
    return out


# ============================================================
#  직접 그려 온 도트 (tools/art/*.png) → 동작 만들기
#  무기 부분만 떼어서 손잡이를 중심으로 돌리고, 다리는 번갈아 움직임
# ============================================================
FW = FH = 48  # 최종 칸 크기 (격자로 그린 영웅은 40 칸을 가운데에 놓음)


def sprite_frames(key):
    spec = HEROES[key]
    S = spec['sprite']
    img = Image.open(ROOT / S['file']).convert('RGBA')
    w, h = img.size
    px = img.load()
    sx0, sy0 = S['weapon_from']
    pivot = S['pivot']
    body = Image.new('RGBA', (w, h), (0, 0, 0, 0)); bp = body.load()
    wep = Image.new('RGBA', (w, h), (0, 0, 0, 0)); wp = wep.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                continue
            if x >= sx0 and y >= sy0:
                wp[x, y] = px[x, y]
            else:
                bp[x, y] = px[x, y]
    leg_y, leg_split = S['legs']
    ox, oy = S.get('place', ((FW - w) // 2, FH - 2 - h))
    A = dict(rest=0, windup=-150, strike=-25, follow=25, hurt=12, win=-115)
    A.update(S.get('ang', {}))
    push = S.get('push', {})  # 활 등: 무기를 돌리지 않고 앞뒤로만

    def compose(bob=0, lean=0, la=0, lb=0, wa=0, hurt=False, wpush=0):
        f = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
        # 몸: 다리 줄 위만 흔들림
        top = body.crop((0, 0, w, leg_y))
        f.alpha_composite(top, (ox + lean, oy + bob))
        for side, ph in ((0, lb), (1, la)):
            x0, x1 = (0, leg_split) if side == 0 else (leg_split, w)
            leg = body.crop((x0, leg_y, x1, h))
            lift = 1 if ph > 0 else 0
            f.alpha_composite(leg, (ox + x0 + ph + lean // 2, oy + leg_y - lift))
        r, (cx, cy) = rotated(wep, pivot, wa)
        f.alpha_composite(r, (ox + lean + wpush - cx + pivot[0], oy + bob - cy + pivot[1]))
        return f

    frames = []
    for i in range(16):
        if i < 4:
            frames.append(compose(bob=[0, 0, 1, 1][i], wa=[0, 2, 3, 1][i]))
        elif i < 10:
            k = (i - 4) / 6 * math.tau
            la = round(math.sin(k) * 1.6)
            frames.append(compose(bob=1 if (i - 4) % 3 == 0 else 0, lean=0, la=la, lb=-la, wa=round(math.sin(k) * 5)))
        elif i == 10:
            frames.append(compose(lean=-1, wa=A['windup'], wpush=push.get('windup', 0)))
        elif i == 11:
            frames.append(compose(lean=2 if not push else 0, wa=A['strike'], wpush=push.get('strike', 0)))
        elif i == 12:
            frames.append(compose(lean=1 if not push else 0, wa=A['follow'], wpush=push.get('follow', 0)))
        elif i == 13:
            frames.append(compose(lean=-2, bob=1, wa=A['hurt']))
        elif i == 14:
            idle = compose()
            out = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
            out.alpha_composite(idle.rotate(90, resample=Image.NEAREST), (0, 10))
            frames.append(out)
        else:
            frames.append(compose(bob=-1, wa=A['win']))
    # 얼굴 그림: 머리 부분을 3배로
    hx0, hy0, hs = S['face']
    k = max(1, 64 // hs)
    crop = img.crop((hx0, hy0, hx0 + hs, hy0 + hs)).resize((hs * k, hs * k), Image.NEAREST)
    port = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    port.alpha_composite(crop, ((64 - hs * k) // 2, 64 - hs * k))
    return frames, port


def main():
    sheet = Image.new('RGBA', (FW * FRAMES, FH * len(ORDER)), (0, 0, 0, 0))
    ports = Image.new('RGBA', (64 * len(ORDER), 64), (0, 0, 0, 0))
    for r, key in enumerate(ORDER):
        if key not in HEROES:
            continue
        if 'sprite' in HEROES[key]:
            frames, port = sprite_frames(key)
            for i, fr in enumerate(frames):
                sheet.alpha_composite(fr, (i * FW, r * FH))
            ports.alpha_composite(port, (r * 64, 0))
            continue
        for i in range(FRAMES):
            sheet.alpha_composite(dead_frame(key) if i == 14 else draw_frame(key, i), (i * FW + (FW - W) // 2, r * FH + (FH - H)))
        ports.alpha_composite(portrait(key), (r * 64, 0))
    sheet.save(ROOT / 'assets' / 'heroes.png')
    ports.save(ROOT / 'assets' / 'portraits.png')
    print('saved', sheet.size, ports.size)


if __name__ == '__main__':
    main()
