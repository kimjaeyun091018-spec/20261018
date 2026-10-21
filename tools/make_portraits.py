"""영웅 프로필(얼굴) 그림 → assets/portraits.png (64x64, 영웅 순서대로 가로)

인게임 서 있는 그림(0번 칸)에서 머리~어깨를 같은 비율로 잘라 내서
모든 영웅의 얼굴 크기·위치가 고르게 보이도록 만듦.
실행: python3 tools/make_portraits.py  (make_heroes.py 다음에)
"""
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'assets'
OUT = 64
HEAD = 0.56     # 자르는 칸 = 캐릭터 키의 이 비율 (머리+어깨)
TOP_PAD = 0.04  # 머리 위 여백 (자르는 칸 대비)
NUDGE = {'knight': 0.1, 'reaper': 0.22}  # 얼굴이 가운데 오도록 가로로 살짝 옮김 (자르는 칸 대비)


def hero_keys():
    src = (ROOT / 'src' / 'data.js').read_text()
    body = src[src.index('export const CHARS'):]
    keys = re.findall(r"\n  (\w+): \{\n    name:", body)
    sheets = dict(re.findall(r"(\w+): \{ file: 'hero_\w+\.png', cell: (\d+)", src))
    return keys, {k: int(v) for k, v in sheets.items()}


def idle_frame(key, row, sheets):
    if key in sheets:
        c = sheets[key]
        return Image.open(A / f'hero_{key}.png').convert('RGBA').crop((0, 0, c, c))
    sh = Image.open(A / 'heroes.png').convert('RGBA')
    return sh.crop((0, row * 48, 48, row * 48 + 48))


def body_center(im, top, h):
    """머리 부분 가로 중심: 위쪽 줄마다 가장 긴 덩어리의 가운데 (무기·장식 무시)"""
    a = im.getchannel('A').load()
    xs = []
    for y in range(top + int(h * 0.18), top + int(h * 0.45)):
        best, run, start = (0, 0), 0, 0
        for x in range(im.width + 1):
            on = x < im.width and a[x, y] > 40
            if on:
                if run == 0: start = x
                run += 1
            else:
                if run > best[0]: best = (run, start)
                run = 0
        if best[0] >= 3: xs.append(best[1] + best[0] / 2)
    xs.sort()
    return xs[len(xs) // 2] if xs else im.width / 2


def portrait(im, key=''):
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    l, t, r, b = a.getbbox()
    h = b - t
    size = max(8, round(h * HEAD))
    cx = body_center(im, t, h)
    x0 = round(cx - size / 2 + NUDGE.get(key, 0) * size)
    y0 = round(t - size * TOP_PAD)
    pad = Image.new('RGBA', (im.width + size * 2, im.height + size * 2), (0, 0, 0, 0))
    pad.alpha_composite(im, (size, size))
    crop = pad.crop((x0 + size, y0 + size, x0 + size * 2, y0 + size * 2))
    big = crop.resize((OUT, OUT), Image.NEAREST if size <= 40 else Image.LANCZOS)
    return big


def main():
    keys, sheets = hero_keys()
    ports = Image.new('RGBA', (OUT * len(keys), OUT), (0, 0, 0, 0))
    for i, k in enumerate(keys):
        ports.alpha_composite(portrait(idle_frame(k, i, sheets), k), (i * OUT, 0))
    ports.save(A / 'portraits.png')
    print('portraits', keys)


if __name__ == '__main__':
    main()
