"""Measure sprite UVs and foot anchors without repainting the source artwork.
Development dependencies: Pillow, numpy, scipy, ffmpeg. Runtime uses shipped JSON.
"""
from pathlib import Path
import argparse, json, shutil, hashlib, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--inputs', type=Path, required=True)
args = parser.parse_args()
out = ROOT / 'public/assets/characters-v33'
(out / 'portraits').mkdir(parents=True, exist_ok=True)
catalog = []
for source in json.loads(args.inputs.read_text()):
    identity, path = source['id'], Path(source['path'])
    im = Image.open(path).convert('RGBA')
    alpha = np.asarray(im)[:, :, 3]
    labels, count = ndimage.label(alpha > 35)
    sizes = np.bincount(labels.ravel())
    bodies = []
    for label, slices in enumerate(ndimage.find_objects(labels), 1):
        if slices is None or sizes[label] < 1000:
            continue
        ys, xs = slices
        bodies.append(dict(label=label, x=xs.start, y=ys.start, w=xs.stop-xs.start, h=ys.stop-ys.start))
    if len(bodies) != 32:
        raise ValueError(f'{identity}: expected 32 connected figures, got {len(bodies)}')
    bodies.sort(key=lambda b:b['y'])
    bodies = sum([sorted(bodies[i:i+8], key=lambda b:b['x']) for i in range(0,32,8)], [])
    anchors = []
    for b in bodies[:8]:
        yy, xx = np.where(labels[b['y']+int(b['h']*.90):b['y']+b['h'], b['x']:b['x']+b['w']] == b['label'])
        anchors.append(float(b['x'] + np.mean(xx)))
    frames = []
    for i,b in enumerate(bodies):
        x, y = max(0,b['x']-2), max(0,b['y']-2)
        right, bottom = min(im.width,b['x']+b['w']+2), min(im.height,b['y']+b['h']+2)
        region = labels[y:bottom,x:right]
        cuts = []
        for other in np.unique(region):
            if not other or other == b['label'] or sizes[other] < 20:
                continue
            oy,ox = np.where(region == other)
            cut = [max(0,int(ox.min())-1),max(0,int(oy.min())-1),min(right-x,int(ox.max())+2),min(bottom-y,int(oy.max())+2)]
            if np.any(region[cut[1]:cut[3],cut[0]:cut[2]] == b['label']):
                raise ValueError(f'{identity}: overlapping figure in frame {i}')
            cuts.append(dict(x=cut[0],y=cut[1],w=cut[2]-cut[0],h=cut[3]-cut[1]))
        center = anchors[i%8] - x
        frames.append(dict(x=x,y=y,w=right-x,h=bottom-y,anchorX=round(center,3),anchorY=b['y']+b['h']-y,cutouts=cuts,usable=x>0 and y>0 and right<im.width and bottom<im.height))
    height = float(np.median([b['h'] for b in bodies[:8]]))
    usable=[f for f in frames if f['usable']]
    scale=min(230/height,280/max(f['anchorY'] for f in usable),180/max(f['anchorX'] for f in usable),180/max(f['w']-f['anchorX'] for f in usable))
    meta = dict(version=1,id=identity,atlas=identity+'.png',poster='portraits/'+identity+'.webp',width=im.width,height=im.height,source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),frameCount=32,scale=scale,idleHeight=height,viewport=dict(width=384,height=320,baseline=296),frames=frames,states={})
    for row,(name,fps,loop) in enumerate([('idle',6,True),('walk',12,True),('entry',6,False),('win',6,False)]):
        indices = [i for i in range(row*8,row*8+8) if frames[i]['usable']]
        if len(indices) < 6:
            raise ValueError(f'{identity}: {name} has too few safe poses')
        meta['states'][name] = dict(frames=indices,fps=fps,loop=loop)
    shutil.copyfile(path, out / meta['atlas'])
    (out / (identity+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
    frame=frames[0]
    width,height_px=round(frame['w']*scale),round(frame['h']*scale)
    left,top=round(192-frame['anchorX']*scale),round(296-frame['anchorY']*scale)
    filters=f"crop={frame['w']}:{frame['h']}:{frame['x']}:{frame['y']},scale={width}:{height_px},pad=384:320:{left}:{top}:color=0x00000000"
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-vf',filters,'-frames:v','1','-c:v','libwebp','-lossless','1',str(out/meta['poster'])],check=True)
    catalog.append(dict(id=identity,metadata=identity+'.json',poster=meta['poster']))
    print(identity, [len(v['frames']) for v in meta['states'].values()], flush=True)
(out/'index.json').write_text(json.dumps(dict(version='33.0.0-full1',characters=catalog),indent=2)+'\n')
