// Small non-verbal game cues. Original synthesis; no speech or voice cloning.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Career} from '../src/career/core.js';
const directory=new URL('../public/assets/sounds/hero-signatures-v33/',import.meta.url),rate=22050,files=[];await mkdir(directory,{recursive:true});
function wave(samples){const out=Buffer.alloc(44+samples.length*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return out;}
const specs=Object.values(Career.HERO_SIGNATURES);
for(let index=0;index<specs.length;index++)for(const kind of ['entry','move','win']){
 const spec=specs[index],duration=kind==='move'?.19:kind==='entry'?.78:1.18,count=Math.round(rate*duration),samples=new Float64Array(count),notes=kind==='move'?[spec.notes[0]*1.5]:kind==='entry'?spec.notes.slice(0,3):spec.notes;
 const metallic=['robot','cyber','princess','gladiator'].includes(spec.id),airy=['fairy','astronaut','diver'].includes(spec.id);let seed=1777+index*13;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296*2-1;};
 for(let i=0;i<count;i++){
  const time=i/rate;let value=0;
  for(let n=0;n<notes.length;n++){
   const local=time-n*(kind==='entry'?.13:kind==='win'?.16:0);if(local<0)continue;
   const length=kind==='move'?.16:kind==='entry'?.37:.58;if(local>length)continue;
   const attack=1-Math.exp(-local/(metallic?.004:.012)),decay=Math.exp(-local/(kind==='move'?.045:airy?.2:.14)),tail=Math.min(1,(length-local)/.07),frequency=notes[n],phase=2*Math.PI*frequency*local;
   value+=(Math.sin(phase)+.25*Math.sin(phase*(metallic?2.01:2))+.08*Math.sin(phase*(airy?3:3.99)))*attack*decay*tail*.42;
  }
  // A soft, short transient gives the cue weight on a phone speaker.
  const sweep=Math.sin(2*Math.PI*(95+index*4)*time+11*(1-Math.exp(-time*32)))*Math.exp(-time*23)*Math.min(1,time/.006)*.14;
  const air=random()*Math.exp(-time*(kind==='move'?70:30))*Math.min(1,time/.008)*(airy?.035:.06);
  const fade=Math.min(1,time/.006,(duration-time)/.035);samples[i]=(value+sweep+air)*Math.max(0,fade);
 }
 const peak=Math.max(...samples.map(Math.abs)),scale=.68/peak;let sum=0;
 for(let i=0;i<count;i++){samples[i]*=scale;sum+=samples[i]*samples[i];}
 const bytes=wave(samples),name=spec.id+'-'+kind+'.wav';await writeFile(new URL(name,directory),bytes);
 files.push({path:name,hero:spec.id,kind,duration,peak:.68,rms:Number(Math.sqrt(sum/count).toFixed(5)),sha256:createHash('sha256').update(bytes).digest('hex')});
}
const manifest=JSON.stringify({version:1,speech:false,sampleRate:rate,channels:1,files},null,2)+'\n';await writeFile(new URL('manifest.json',directory),manifest);console.log('Built '+files.length+' original non-verbal character cues.');
