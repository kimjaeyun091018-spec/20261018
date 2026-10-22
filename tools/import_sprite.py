"""AI로 만든 '도트풍' 그림(큰 해상도, 분홍 배경) → 진짜 1픽셀 도트로 바꾸기

  python3 tools/import_sprite.py 원본.png 결과.png [픽셀크기] [목표키]

목표 키를 주면 (예: 40) 원본 도트가 더 촘촘할 때 그 키로 줄입니다 (색은 원본 색 중에서, 외곽선 우선).

1) 픽셀 크기(원본에서 도트 한 칸이 몇 px인지)를 가장자리 간격으로 추정
2) 칸마다 가운데 색을 골라 1픽셀로
3) 분홍(#FF00FF 근처) 배경을 투명으로, 떠다니는 작은 조각(불씨 등)은 지우고 가장 큰 덩어리만 남김
"""
import sys
from collections import Counter
import numpy as np
from PIL import Image


BG = (255, 0, 255)


def is_bg(c):
    """배경(모서리에서 잰 분홍)과 가까운 색만 배경. 보라색 캐릭터가 지워지지 않게 좁게 잡음"""
    r, g, b = c[:3]
    return (r - BG[0]) ** 2 + (g - BG[1]) ** 2 + (b - BG[2]) ** 2 < 75 ** 2


def estimate_pixel(im, mask, x0):
    """가장자리 위치들이 x0 + k·p 격자에 가장 잘 맞는 p를 찾음"""
    diff = (np.abs(np.diff(im, axis=1)).sum(2) > 60) & ~mask[:, 1:]
    xs = np.where(diff[::3])[1].astype(float) + 1
    ps = np.arange(8.0, 40.0, 0.02)
    scores = []
    for p in ps:
        d = np.abs(((xs - x0) / p) - np.round((xs - x0) / p)) * p
        scores.append(np.mean(d < 1.6))
    scores = np.array(scores)
    # 절반 크기 격자도 잘 맞으므로, 거의 최고 점수인 것 중 가장 큰 칸
    ok = ps[scores >= scores.max() * 0.92]
    return float(ok.max())


def shrink(img, H, glow=False):
    """촘촘한 도트를 키 H로 줄이기: 원본 색(48색)만 쓰고, 칸마다 가장 많은 색 (외곽선·금색은 조금 우선)"""
    w, h = img.size
    if h <= H:
        return img
    W = round(w * H / h)
    arr = np.array(img)
    alpha = arr[:, :, 3] > 0
    q = Image.fromarray(arr[:, :, :3]).quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    idx = np.array(q)
    pal = np.array(q.getpalette()[:48 * 3]).reshape(-1, 3)
    lum = pal.sum(1)
    res = np.zeros((H, W, 4), np.uint8)
    sx, sy = w / W, h / H
    for y in range(H):
        for x in range(W):
            x0, y0 = int(x * sx), int(y * sy)
            x1, y1 = max(x0 + 1, int((x + 1) * sx)), max(y0 + 1, int((y + 1) * sy))
            a = alpha[y0:y1, x0:x1]
            if a.mean() < 0.5:
                continue
            c = Counter(idx[y0:y1, x0:x1][a].tolist())
            gold = lambda k: pal[k][0] > 200 and pal[k][1] > 140 and pal[k][2] < 120
            best = max(c, key=lambda k: c[k] * (1.6 if lum[k] < 110 else 1) * (1.3 if gold(k) else 1))
            col = pal[best]
            if not glow and col[0] > 200 and col[2] > 150 and col[1] < 200:  # 분홍이 섞인 반짝이 → 노란 빛
                col = (255, 245, 157)
            res[y, x, :3] = col
            res[y, x, 3] = 255
    return Image.fromarray(res, 'RGBA')


def main(src, out, p=None, target=None, mode=''):
    glow = mode == 'glow'  # 몸 안쪽의 분홍 빛(눈·보석)은 배경이 아니라 그대로 둠 (바깥과 이어진 분홍만 배경)
    global BG
    im = np.array(Image.open(src).convert('RGB')).astype(int)
    BG = tuple(int(v) for v in np.median(np.concatenate([im[:8, :8].reshape(-1, 3), im[-8:, -8:].reshape(-1, 3), im[:8, -8:].reshape(-1, 3)]), 0))
    mask = ((im - np.array(BG)) ** 2).sum(2) < 75 ** 2
    ys, xs = np.where(~mask)
    x0, y0 = xs.min(), ys.min()
    p = float(p) if p else estimate_pixel(im, mask, x0)
    H, W, _ = im.shape
    nx, ny = int((W - x0) / p) + 1, int((H - y0) / p) + 1
    res = np.zeros((ny, nx, 4), np.uint8)
    for j in range(ny):
        for i in range(nx):
            a0, a1 = int(x0 + i * p + p * 0.3), int(x0 + i * p + p * 0.7)
            b0, b1 = int(y0 + j * p + p * 0.3), int(y0 + j * p + p * 0.7)
            blk = im[b0:b1, a0:a1].reshape(-1, 3)
            if not len(blk):
                continue
            c = np.median(blk, 0).astype(int)
            res[j, i, :3] = c
            res[j, i, 3] = 0 if is_bg(c) else 255
    if glow:  # 바깥 테두리와 이어진 분홍 칸만 배경으로, 안쪽에 갇힌 분홍은 빛으로 남김
        out_bg = np.zeros((ny, nx), bool)
        st = [(j, i) for j in range(ny) for i in (0, nx - 1)] + [(j, i) for i in range(nx) for j in (0, ny - 1)]
        while st:
            j, i = st.pop()
            if not (0 <= j < ny and 0 <= i < nx) or out_bg[j, i] or res[j, i, 3]:
                continue
            out_bg[j, i] = True
            st += [(j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)]
        # 갇힌 분홍 덩어리: 작으면(눈·보석 빛) 남기고, 크면(연기 사이 틈) 배경
        seen = out_bg.copy()
        for j in range(ny):
            for i in range(nx):
                if res[j, i, 3] or seen[j, i]:
                    continue
                comp, st = [], [(j, i)]
                seen[j, i] = True
                while st:
                    y, x = st.pop(); comp.append((y, x))
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < ny and 0 <= xx < nx and not seen[yy, xx] and not res[yy, xx, 3]:
                            seen[yy, xx] = True; st.append((yy, xx))
                if len(comp) <= 30:
                    for y, x in comp:
                        res[y, x, 3] = 255
    # 분홍이 섞인 가장자리 색 정리
    for j in range(ny):
        for i in range(nx):
            r, g, b, a = res[j, i]
            if a and not glow and (int(r) - BG[0]) ** 2 + (int(g) - BG[1]) ** 2 + (int(b) - BG[2]) ** 2 < 120 ** 2:
                edge = any(not (0 <= j + dj < ny and 0 <= i + di < nx) or res[j + dj, i + di, 3] == 0 for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    res[j, i, 3] = 0
                else:
                    res[j, i, :3] = (29, 17, 40)
    # 가장 큰 덩어리만
    alive = res[:, :, 3] > 0
    lab = np.zeros(alive.shape, int)
    sizes = {}
    cur = 0
    for y in range(ny):
        for x in range(nx):
            if alive[y, x] and not lab[y, x]:
                cur += 1
                st = [(y, x)]
                lab[y, x] = cur
                n = 0
                while st:
                    cy, cx = st.pop()
                    n += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < ny and 0 <= xx < nx and alive[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = cur
                            st.append((yy, xx))
                sizes[cur] = n
    big = max(sizes, key=sizes.get)
    res[lab != big] = 0
    img = Image.fromarray(res, 'RGBA')
    img = img.crop(img.getbbox())
    if target:
        img = shrink(img, int(target), glow)
        img = img.crop(img.getbbox())
    img.save(out)
    print(f'픽셀 크기 {p:.2f}px → {img.size[0]}x{img.size[1]}')


if __name__ == '__main__':
    main(*sys.argv[1:])
