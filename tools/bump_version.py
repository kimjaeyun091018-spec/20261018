"""index.html의 ?v= 캐시 번호를 지금 시각으로 바꿉니다. 실행: python3 tools/bump_version.py"""
import re, time
from pathlib import Path
p = Path(__file__).resolve().parent.parent / 'index.html'
v = time.strftime('%Y%m%d%H%M')
s = re.sub(r'(\?v=|__ASSET_V = \')\d{12}', lambda m: m.group(1) + v, p.read_text(encoding='utf-8'))
p.write_text(s, encoding='utf-8')
print('version', v)
