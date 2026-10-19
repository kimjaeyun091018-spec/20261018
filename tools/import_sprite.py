"""AI로 만든 '도트풍' 그림(큰 해상도, 분홍 배경) → 진짜 1픽셀 도트로 바꾸기

  python3 tools/import_sprite.py 원본.png 결과.png [픽셀크기]

1) 픽셀 크기(원본에서 도트 한 칸이 몇 px인지)를 가장자리 간격으로 추정
2) 칸마다 가운데 색을 골라 1픽셀로
3) 분홍(#FF00FF 근처) 배경을 투명으로, 떠다니는 작은 조각(불씨 등)은 지우고 가장 큰 덩어리만 남김
"""
import sys
from collections import Counter
import numpy as np
from PIL import Image


def is_bg(c):
    r, g, b = c[:3]
    return r > 170 and b > 170 and g < 110


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


def main(src, out, p=None):
    im = np.array(Image.open(src).convert('RGB')).astype(int)
    mask = np.array([[is_bg(px) for px in row] for row in im[::1]]) if im.shape[0] < 1 else (
        (im[:, :, 0] > 170) & (im[:, :, 2] > 170) & (im[:, :, 1] < 110))
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
    # 분홍이 섞인 가장자리 색 정리
    for j in range(ny):
        for i in range(nx):
            r, g, b, a = res[j, i]
            if a and r > 110 and b > 110 and g < 80:
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
    img.save(out)
    print(f'픽셀 크기 {p:.2f}px → {img.size[0]}x{img.size[1]}')


if __name__ == '__main__':
    main(*sys.argv[1:])
