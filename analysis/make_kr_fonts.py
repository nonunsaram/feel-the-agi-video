"""Subset the Korean fonts (KS X 1001 Hangul + ASCII + the symbols the scenes use) into app/public/fonts/kr.
   uv run python make_kr_fonts.py <dir with the downloaded source fonts>"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
from pathlib import Path
import sys
src = Path(sys.argv[1]); out = Path('../app/public/fonts/kr'); out.mkdir(parents=True, exist_ok=True)
hangul = ''.join(bytes([a, b]).decode('euc_kr') for a in range(0xB0, 0xC9) for b in range(0xA1, 0xFF))
extra = ''.join(chr(c) for c in range(0x20, 0x7F)) + '·…—–’‘“”₩×÷±→←↑↓✓■□▪▫░▒▓█▁▂▃▄▅▆▇●○◆◇△▽※☐☑☒正一丁下「」『』〈〉《》℃№™©®°'
text = hangul + extra
jobs = [
    ('Pretendard-Light.ttf', None, 'Pretendard-300.ttf'), ('Pretendard-Medium.ttf', None, 'Pretendard-500.ttf'),
    ('Pretendard-Bold.ttf', None, 'Pretendard-700.ttf'), ('Pretendard-Black.ttf', None, 'Pretendard-900.ttf'),
    ('NotoSerifKR%5Bwght%5D.ttf', 300, 'NotoSerifKR-300.ttf'), ('NotoSerifKR%5Bwght%5D.ttf', 500, 'NotoSerifKR-500.ttf'),
    ('NotoSerifKR%5Bwght%5D.ttf', 900, 'NotoSerifKR-900.ttf'),
    ('Galmuri11.ttf', None, 'Galmuri11.ttf'), ('Galmuri11-Bold.ttf', None, 'Galmuri11-Bold.ttf'),
    ('IBMPlexSansKR-Medium.ttf', None, 'PlexSansKR-500.ttf'),
    ('Hahmlet%5Bwght%5D.ttf', 200, 'Hahmlet-200.ttf'), ('Hahmlet%5Bwght%5D.ttf', 400, 'Hahmlet-400.ttf'),
    ('LINESeedKR-Th.otf', None, 'LINESeedKR-100.otf'), ('LINESeedKR-Rg.otf', None, 'LINESeedKR-400.otf'), ('LINESeedKR-Bd.otf', None, 'LINESeedKR-700.otf'),
    ('GothicA1-Thin.ttf', None, 'GothicA1-100.ttf'), ('GothicA1-Light.ttf', None, 'GothicA1-300.ttf'),
]
for s, wght, name in jobs:
    if not (src / s).exists():
        continue  # keep the existing subset
    f = TTFont(src / s)
    if wght:
        f = instancer.instantiateVariableFont(f, {'wght': wght}, updateFontNames=False)
    opts = subset.Options(); opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True; opts.glyph_names = False
    opts.hinting = False
    sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(f)
    f.save(out / name)
    print(name, (out / name).stat().st_size // 1024, 'KB', 'missing:', ''.join(ch for ch in extra if ord(ch) not in f.getBestCmap())[:60])
