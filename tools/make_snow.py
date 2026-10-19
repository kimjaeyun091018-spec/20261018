"""4장(얼어붙은 봉우리) 도트: 설인 · 서리 정령 · 꼬마 눈사람(아군) · 눈보라 대왕(통째·몸통·머리)

실행: python3 tools/make_snow.py
  assets/enemies.png 의 앞 9종(27칸)은 그대로 두고, 그 뒤에 yeti · frostwisp · minisnow 를 [1, 2, 쓰러짐]으로 붙임
  assets/bosses.png 의 앞 3종(9칸) 뒤에 snowman · snowbody · snowhead 를 붙임 (40x40)
"""
from pathlib import Path
from PIL import Image
import make_sprites as M

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'assets'

M.MON.update({
    'Q': (240, 248, 255, 255), 'q': (190, 215, 235, 255), 'j': (150, 180, 210, 255),   # 눈
    'I': (128, 222, 234, 255), 'i': (77, 182, 210, 255), 'J': (225, 250, 255, 255),    # 얼음
    'c': (255, 138, 50, 255),                                                            # 당근
    'k': (60, 70, 90, 255),                                                              # 석탄
    'f': (200, 40, 50, 255), 'F': (240, 80, 80, 255),                                    # 목도리
    'y': (210, 205, 225, 255), 'Y2': (0, 0, 0, 0),
})


def yeti(f, size=24):
    c = M.Canvas(size, size)
    cx, base = size // 2, size - 3
    bob = 0 if f == 0 else 1
    c.rect(cx - 6, base - 4, cx - 3, base, 'q'); c.rect(cx + 2, base - 4 + bob, cx + 5, base, 'q')
    c.ellipse(cx, base - 10, 7, 7, 'Q', 'q')
    c.ellipse(cx, base - 17, 5.5, 4.8, 'Q', 'q')
    c.rect(cx - 3, base - 17, cx + 3, base - 14, 'j')            # 얼굴
    c.set(cx - 2, base - 16, 'i'); c.set(cx + 2, base - 16, 'i')  # 눈
    c.rect(cx - 1, base - 15, cx + 1, base - 15, 'k')
    c.set(cx - 2, base - 14, 'Q'); c.set(cx + 2, base - 14, 'Q')  # 송곳니
    c.set(cx - 4, base - 21, 'j'); c.set(cx + 4, base - 21, 'j')  # 뿔
    c.set(cx - 5, base - 22, 'j'); c.set(cx + 5, base - 22, 'j')
    c.rect(cx - 10, base - 14 + bob, cx - 7, base - 6 + bob, 'Q')  # 팔
    c.rect(cx + 7, base - 14 - bob, cx + 10, base - 6 - bob, 'Q')
    c.rect(cx - 10, base - 7 + bob, cx - 8, base - 6 + bob, 'j'); c.rect(cx + 8, base - 7 - bob, cx + 10, base - 6 - bob, 'j')
    return c.image()


def frostwisp(f, size=24):
    c = M.Canvas(size, size)
    cx, cy = size // 2, 11 + (0 if f == 0 else 1)
    for y in range(cy + 3, cy + 11):                              # 꼬리
        w = max(0, 4 - (y - cy - 3) // 2)
        sway = (1 if (y // 2 + f) % 2 else -1)
        c.rect(cx - w + sway, y, cx + w + sway, y, 'I' if y % 3 else 'i')
    c.ellipse(cx, cy, 5.5, 5.5, 'I', 'i', 'J')
    for (x, y) in [(cx - 6, cy - 6), (cx + 6, cy - 6), (cx, cy - 8)]:  # 얼음 가시
        c.set(x, y, 'J'); c.set(x, y + 1, 'I')
    c.rect(cx - 3, cy - 1, cx - 2, cy, 'k'); c.rect(cx + 2, cy - 1, cx + 3, cy, 'k')
    c.set(cx - 2, cy - 1, 'J'); c.set(cx + 3, cy - 1, 'J')
    return c.image()


def snowman(f, size=24, scale=1.0, scarf=True, hat=True, arms=True, body=True, head=True, crown=False):
    """눈사람. 몸통(아래 큰 공) + 머리(위 작은 공)"""
    c = M.Canvas(size, size)
    s = scale
    cx, base = size / 2, size - 2
    bob = 0 if f == 0 else 1
    rb, rh = 7.2 * s, 5.0 * s
    by = base - rb
    hy = by - rb - rh * 0.65 + bob * 0.5
    if not body:  # 머리만: 가운데에
        hy = size / 2 + 1
    if body:
        c.ellipse(cx, by, rb, rb, 'Q', 'q', None)
        c.ellipse(cx, by - rb * 0.55, rb * 0.82, rb * 0.55, 'Q', 'q')
        for i in range(3):                                         # 단추
            yy = int(by - rb * 0.5 + i * rb * 0.45)
            c.rect(int(cx), yy, int(cx + s * 0.6), yy + int(s * 0.6), 'k')
        if arms:
            for side in (-1, 1):
                x0 = int(cx + side * rb * 0.85)
                for k in range(int(5 * s)):
                    c.set(x0 + side * k, int(by - rb * 0.6 - k * 0.7 - (bob if side > 0 else 0)), 'w')
                c.set(x0 + side * int(4 * s), int(by - rb * 0.6 - 4 * s), 'w')
    if head:
        c.ellipse(cx, hy, rh, rh, 'Q', 'q', 'Q')
        e = max(1, int(s * 0.7))
        c.rect(int(cx - rh * 0.45), int(hy - rh * 0.25), int(cx - rh * 0.45) + e, int(hy - rh * 0.25) + e, 'k')
        c.rect(int(cx + rh * 0.25), int(hy - rh * 0.25), int(cx + rh * 0.25) + e, int(hy - rh * 0.25) + e, 'k')
        for k in range(int(3.5 * s)):                               # 당근 코
            c.rect(int(cx + k), int(hy + rh * 0.05), int(cx + k), int(hy + rh * 0.05) + (e if k < 2 * s else 0), 'c')
        for k in range(-2, 3):                                     # 입
            c.set(int(cx - 1 + k * s * 0.8), int(hy + rh * 0.5 - (1 if abs(k) == 2 else 0)), 'k')
        if hat:
            top = int(hy - rh) + 1
            c.rect(int(cx - rh * 0.9), top - int(s), int(cx + rh * 0.9), top, 'K')
            c.rect(int(cx - rh * 0.6), top - int(5 * s), int(cx + rh * 0.6), top - int(s), 'K')
            c.rect(int(cx - rh * 0.6), top - int(2 * s), int(cx + rh * 0.6), top - int(1.4 * s), 'f')
        if crown:
            top = int(hy - rh) + 2
            c.rect(int(cx - rh * 0.7), top - int(1.2 * s), int(cx + rh * 0.7), top, 'I')
            for k in (-1, 0, 1):
                x = int(cx + k * rh * 0.55)
                c.rect(x - int(s * 0.4), top - int(3 * s), x + int(s * 0.4), top - int(1.2 * s), 'J' if k == 0 else 'I')
    if scarf and body and head:
        ny = int(hy + rh * 0.85)
        c.rect(int(cx - rh * 0.9), ny, int(cx + rh * 0.9), ny + int(1.6 * s), 'f')
        c.rect(int(cx - rh * 0.9), ny, int(cx + rh * 0.9), ny, 'F')
        c.rect(int(cx - rh * 0.8) - bob, ny + int(1.6 * s), int(cx - rh * 0.8) + int(s) - bob, ny + int(5 * s), 'f')
    return c.image()


def main():
    en = Image.open(A / 'enemies.png').convert('RGBA')
    base = [en.crop((i * 24, 0, i * 24 + 24, 24)) for i in range(27)]
    new = []
    for mk in (yeti, frostwisp, lambda f: snowman(f, 24, 1.0, hat=False)):
        a, b = mk(0), mk(1)
        new += [a, b, M.dead_of(a)]
    frames = base + new
    sheet = Image.new('RGBA', (24 * len(frames), 24), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.alpha_composite(fr, (i * 24, 0))
    sheet.save(A / 'enemies.png')

    bo = Image.open(A / 'bosses.png').convert('RGBA')
    bbase = [bo.crop((i * 40, 0, i * 40 + 40, 40)) for i in range(9)]
    bnew = []
    whole = lambda f: snowman(f, 40, 1.42, crown=True, hat=False)
    body = lambda f: snowman(f, 40, 1.9, head=False, scarf=False)
    head = lambda f: snowman(f, 40, 2.4, body=False, crown=True, hat=False)
    for mk in (whole, body, head):
        a, b = mk(0), mk(1)
        bnew += [a, b, M.dead_of(a)]
    frames = bbase + bnew
    sheet = Image.new('RGBA', (40 * len(frames), 40), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.alpha_composite(fr, (i * 40, 0))
    sheet.save(A / 'bosses.png')
    print('enemies', len(base) + len(new), 'bosses', len(frames))


if __name__ == '__main__':
    main()
