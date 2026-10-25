"""Downsample the zoom renders to 1200 × 800 WebP (the zoom frame is 3:2)."""
import os, sys, glob
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
total = 0
for path in sorted(glob.glob(os.path.join(src, '*.png'))):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert('RGB').resize((1200, 800), Image.LANCZOS)
    out = os.path.join(dst, name + '.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    total += os.path.getsize(out)
print('bytes', total)
