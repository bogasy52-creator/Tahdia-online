"""Downsample the hero renders: the full bust for boards and the shop, and a
square face crop used as an avatar at card tables."""
import os, sys, glob
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(dst, 'face'), exist_ok=True)
total = 0
for path in sorted(glob.glob(os.path.join(src, '*.png'))):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    pm = im.convert('RGBa')
    full = pm.resize((w // 2, h // 2), Image.LANCZOS).convert('RGBA')
    out = os.path.join(dst, name + '.webp')
    full.save(out, 'WEBP', quality=88, method=6, alpha_quality=92)
    total += os.path.getsize(out)
    # the head sits at world height .95; the frame is 1.28 × 1.74 units
    unit = w / 1.28
    cx, cy, half = w / 2, (1.62 - 0.95 * 0.976) * unit, 0.45 * unit
    face = pm.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((160, 160), Image.LANCZOS).convert('RGBA')
    out = os.path.join(dst, 'face', name + '.webp')
    face.save(out, 'WEBP', quality=86, method=6, alpha_quality=90)
    total += os.path.getsize(out)
print('bytes', total)
