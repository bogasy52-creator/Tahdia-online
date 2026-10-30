"""Build short nonverbal character signatures from the included CC0 Kenney Foley.
Each cue has its own source layers, timing and pitch; no speech or voice model.
"""
from pathlib import Path
import argparse, json, hashlib, subprocess, wave, shutil
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/sounds/character-foley-v33'
parser=argparse.ArgumentParser()
parser.add_argument('--source-packs',type=Path)
args=parser.parse_args()
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=OUT/'source';SOURCE.mkdir(exist_ok=True)
SR=22050
def file(pack,name):
    dest=SOURCE/(pack+'-'+name+'.ogg')
    if args.source_packs and not dest.exists():shutil.copyfile(args.source_packs/pack/'Audio'/(name+'.ogg'),dest)
    if not dest.exists():raise FileNotFoundError(dest)
    return dest
R='rpg-audio';I='impact-sounds';S='sci-fi-sounds'
# event = (source pack, clip, start seconds, gain, pitch ratio)
def e(p,n,t=0,g=1,pitch=1):return[p,n,t,g,pitch]
recipes={
 'fox':{
  'entry':[e(R,'clothBelt',0,.65),e(R,'footstep02',.25,.7),e(R,'cloth1',.55,.7),e(R,'handleCoins',.9,.2,.85)],
  'move':[e(I,'footstep_grass_001',0,.7,.9),e(R,'cloth3',.12,.23),e(I,'footstep_grass_003',.33,.65,.94)],
  'win':[e(R,'cloth2',0,.55),e(R,'handleCoins2',.28,.25),e(I,'footstep_wood_001',.65,.6),e(R,'cloth4',1,.55),e(I,'impactBell_heavy_000',1.2,.23,1.35)]},
 'cat':{
  'entry':[e(R,'cloth1',0,.5,1.15),e(R,'drawKnife1',.35,.65,1.22),e(R,'knifeSlice',.7,.55,1.25)],
  'move':[e(I,'footstep_carpet_001',0,.5,1.1),e(R,'cloth2',.13,.35,1.2),e(I,'footstep_carpet_004',.31,.5,1.12)],
  'win':[e(R,'knifeSlice2',0,.55,1.2),e(R,'cloth4',.35,.5,1.15),e(R,'drawKnife3',.7,.65,1.2),e(R,'knifeSlice',1.1,.6,1.3)]},
 'robot':{
  'entry':[e(S,'doorOpen_001',0,.55,1.2),e(S,'computerNoise_003',.35,.2,1.2),e(S,'forceField_001',.7,.4,1.25)],
  'move':[e(S,'impactMetal_003',0,.55,1.3),e(S,'doorClose_001',.12,.16,1.6),e(S,'impactMetal_004',.33,.5,1.35)],
  'win':[e(S,'computerNoise_000',0,.23,1.2),e(S,'forceField_003',.25,.45,1.35),e(S,'impactMetal_001',.65,.35,1.4),e(S,'laserRetro_003',1.05,.35,1.3)]},
 'princess':{
  'entry':[e(I,'footstep_concrete_000',0,.7,.85),e(R,'metalLatch',.25,.45,.9),e(R,'drawKnife2',.65,.55,.8)],
  'move':[e(I,'footstep_concrete_001',0,.7,.8),e(I,'impactMetal_light_000',.08,.27,.9),e(I,'footstep_concrete_003',.34,.7,.85)],
  'win':[e(R,'drawKnife3',0,.55,.82),e(I,'impactMetal_heavy_001',.38,.6,.95),e(I,'impactBell_heavy_002',.8,.45,1.1),e(R,'clothBelt',1.2,.25)]},
 'fairy':{
  'entry':[e(R,'cloth3',0,.7,.7),e(R,'knifeSlice2',.35,.25,.7),e(I,'impactGlass_light_001',.7,.45,1.4)],
  'move':[e(R,'cloth4',0,.65,.72),e(I,'footstep_wood_003',.05,.3,1.15),e(R,'cloth1',.31,.6,.8)],
  'win':[e(R,'cloth3',0,.6,.7),e(R,'cloth4',.35,.6,.75),e(I,'impactGlass_light_002',.65,.4,1.45),e(I,'impactBell_heavy_000',1,.3,1.5)]},
 'astronaut':{
  'entry':[e(S,'doorOpen_000',0,.35,.85),e(S,'thrusterFire_001',.4,.38,1.2),e(S,'computerNoise_002',.85,.13)],
  'move':[e(S,'thrusterFire_000',0,.35,1.5),e(I,'footstep_carpet_002',.09,.35,.75),e(S,'thrusterFire_003',.31,.3,1.45)],
  'win':[e(S,'spaceEngineSmall_001',0,.15,1.3),e(S,'thrusterFire_004',.35,.35,1.35),e(S,'forceField_004',.9,.3,1.3)]},
 'racer':{
  'entry':[e(S,'engineCircular_001',0,.3,.8),e(R,'clothBelt2',.25,.3),e(S,'engineCircular_003',.65,.35,1.2)],
  'move':[e(I,'footstep_concrete_002',0,.6,1.25),e(R,'cloth2',.12,.3,1.25),e(I,'footstep_concrete_004',.31,.6,1.3)],
  'win':[e(S,'engineCircular_000',0,.35,.9),e(I,'footstep_concrete_001',.4,.55,1.2),e(S,'engineCircular_004',.65,.3,1.45),e(R,'cloth1',1.2,.3)]},
 'diver':{
  'entry':[e(S,'slime_000',0,.25,.7),e(R,'metalClick',.38,.5,.75),e(S,'doorOpen_002',.7,.24,.65)],
  'move':[e(I,'footstep_snow_001',0,.55,.65),e(S,'slime_001',.12,.2,1.4),e(I,'footstep_snow_003',.34,.55,.7)],
  'win':[e(S,'slime_000',0,.25,.7),e(S,'slime_001',.4,.23,1.15),e(R,'metalPot2',.75,.3,.85),e(S,'slime_000',1.1,.2,1.6)]},
 'viking':{
  'entry':[e(I,'footstep_snow_000',0,.75,.7),e(R,'clothBelt',.25,.4,.8),e(S,'lowFrequency_explosion_000',.65,.24,1.3)],
  'move':[e(I,'footstep_wood_000',0,.8,.62),e(R,'clothBelt2',.12,.3,.8),e(I,'footstep_wood_004',.34,.8,.66)],
  'win':[e(I,'impactMetal_heavy_003',0,.5,.7),e(I,'footstep_wood_002',.45,.75,.65),e(I,'footstep_wood_003',.85,.75,.68),e(S,'lowFrequency_explosion_001',1.1,.23,1.2)]},
 'gladiator':{
  'entry':[e(R,'drawKnife2',0,.55,.92),e(I,'impactMetal_medium_002',.38,.55,.86),e(I,'footstep_concrete_003',.75,.6,.9)],
  'move':[e(I,'footstep_concrete_004',0,.7,.88),e(R,'metalLatch',.11,.3,1.1),e(I,'footstep_concrete_002',.34,.7,.92)],
  'win':[e(R,'knifeSlice2',0,.6,.9),e(I,'impactMetal_medium_001',.4,.65,.82),e(I,'impactMetal_medium_003',.8,.65,.86),e(R,'drawKnife1',1.2,.4,.95)]},
 'cyber':{
  'entry':[e(S,'forceField_002',0,.3,1.5),e(S,'computerNoise_001',.3,.17,1.4),e(S,'laserSmall_002',.8,.32,1.5)],
  'move':[e(I,'footstep_carpet_003',0,.45,1.2),e(S,'laserSmall_000',.1,.16,1.7),e(I,'footstep_carpet_000',.31,.45,1.25)],
  'win':[e(S,'laserRetro_001',0,.33,1.4),e(S,'forceField_000',.35,.3,1.6),e(S,'laserSmall_004',.75,.3,1.5),e(S,'laserRetro_004',1.1,.3,1.6)]},
 'samurai':{
  'entry':[e(R,'clothBelt2',0,.5,.85),e(R,'drawKnife3',.4,.75,.7),e(R,'knifeSlice2',.85,.4,.85)],
  'move':[e(I,'footstep_wood_002',0,.65,.85),e(R,'clothBelt',.11,.3,.9),e(I,'footstep_wood_001',.34,.65,.9)],
  'win':[e(R,'drawKnife1',0,.7,.72),e(R,'knifeSlice',.38,.7,.8),e(R,'knifeSlice2',.75,.6,.85),e(R,'metalClick',1.2,.4,.75)]}
}
decoded={}
def decode(path,pitch):
    key=(path,pitch)
    if key not in decoded:
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(SR),'pipe:1'])
        data=np.frombuffer(raw,dtype='<f4').copy();data-=np.mean(data)
        peak=np.max(np.abs(data));data=data/max(.05,peak)
        data=np.interp(np.arange(0,len(data),pitch),np.arange(len(data)),data)
        decoded[key]=data
    return decoded[key]
rows=[]
for identity,states in recipes.items():
    for state,events in states.items():
        duration={'entry':1.45,'move':.65,'win':2.0}[state];mix=np.zeros(int(SR*duration),dtype=np.float64)
        for pack,name,start,gain,pitch in events:
            data=decode(file(pack,name),pitch)*gain;offset=int(start*SR);n=min(len(data),len(mix)-offset)
            if n>0:mix[offset:offset+n]+=data[:n]
        # Small room reflection and a gentle final fade; never extend a cue into a queue.
        delay=int(.045*SR);mix[delay:]+=mix[:-delay].copy()*.10
        fade=min(int(.12*SR),len(mix)//3);mix[-fade:]*=np.linspace(1,0,fade);mix[:110]*=np.linspace(0,1,110)
        peak=float(np.max(np.abs(mix)));mix*=.68/max(.01,peak)
        path=OUT/(identity+'-'+state+'.wav')
        with wave.open(str(path),'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
        rows.append(dict(path=path.name,character=identity,state=state,duration=duration,peak=float(np.max(np.abs(mix))),rms=float(np.sqrt(np.mean(mix**2))),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),layers=events))
if args.source_packs:
    for pack in [R,I,S]:shutil.copyfile(args.source_packs/pack/'License.txt',OUT/(pack+'-LICENSE.txt'))
manifest=dict(version='33.0.0-full1',speech=False,voice_clone=False,license='CC0-1.0',credit='Kenney (kenney.nl)',sources=['https://kenney.nl/assets/impact-sounds','https://kenney.nl/assets/rpg-audio','https://kenney.nl/assets/sci-fi-sounds'],files=rows)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built',len(rows),'character Foley cues from',len(list(SOURCE.glob('*.ogg'))),'included CC0 recordings')
