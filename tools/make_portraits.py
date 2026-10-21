"""카이엔 프로필(얼굴) 다시 만들기 → assets/portraits.png 의 0번 칸만 바꿈

기본 생성 방식으로는 투구 깃털 때문에 얼굴이 작고 한쪽으로 치우쳐서,
인게임 서 있는 그림(heroes.png 0번 줄 0번 칸)에서 투구 부분을 21x21로 잘라 정확히 3배로 키움.
실행: python3 tools/make_portraits.py  (make_heroes.py 가 끝에 자동으로 부름)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'assets'
FIX = {'knight': {'row': 0, 'box': (14, 10, 21)}}  # 칸 안 (왼쪽, 위, 크기) — 투구가 가운데 오게


def main():
    ports = Image.open(A / 'portraits.png').convert('RGBA')
    sheet = Image.open(A / 'heroes.png').convert('RGBA')
    for i, (key, F) in enumerate(FIX.items()):
        r = F['row']; x, y, n = F['box']
        crop = sheet.crop((x, r * 48 + y, x + n, r * 48 + y + n)).resize((n * 3, n * 3), Image.NEAREST)
        cell = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        cell.alpha_composite(crop, ((64 - n * 3) // 2, 64 - n * 3))
        ports.paste(cell, (r * 64, 0))
    ports.save(A / 'portraits.png')


if __name__ == '__main__':
    main()
