import os,sys,glob
from PIL import Image
src=sys.argv[1];dst=sys.argv[2]
os.makedirs(dst,exist_ok=True);os.makedirs(os.path.join(dst,'s'),exist_ok=True)
total=0
for p in sorted(glob.glob(os.path.join(src,'*.png'))):
    name=os.path.splitext(os.path.basename(p))[0]
    im=Image.open(p).convert('RGBA')
    marble=name.startswith('marble-')
    big=(192,192) if marble else (192,302)
    small=(64,64) if marble else (96,151)
    pm=im.convert('RGBa')
    for size,folder in ((big,''),(small,'s')):
        out=pm.resize(size,Image.LANCZOS).convert('RGBA')
        path=os.path.join(dst,folder,name+'.webp')
        out.save(path,'WEBP',quality=90,method=6,alpha_quality=100)
        total+=os.path.getsize(path)
print('bytes',total)
