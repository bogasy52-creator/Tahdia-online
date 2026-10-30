/* Software preview of the production Canvas commands. This is not a browser capture.
 * Requires Sharp in CODEX_PRIMARY_RUNTIME_NODE_MODULES, plus ffmpeg.
 */
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createDOM} from '../test/dom-harness.mjs';
import {Career} from '../src/career/core.js';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const root=resolve(new URL('..',import.meta.url).pathname),out=resolve(process.argv[2]||join(root,'verification/characters/preview'));
await mkdir(out,{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let serial=0;
class Pen{
 constructor(){this.parts=[];this.path='';this.transform='';this.stack=[];this.fillStyle='#fff';this.strokeStyle='#fff';this.globalAlpha=1;this.lineWidth=1;}
 save(){this.stack.push([this.transform,this.fillStyle,this.strokeStyle,this.globalAlpha,this.lineWidth]);}
 restore(){[this.transform,this.fillStyle,this.strokeStyle,this.globalAlpha,this.lineWidth]=this.stack.pop();}
 translate(x,y){this.transform+=` translate(${x} ${y})`;}
 rotate(a){this.transform+=` rotate(${a*180/Math.PI})`;}
 beginPath(){this.path='';}
 moveTo(x,y){this.path+=`M${x},${y}`;}
 lineTo(x,y){this.path+=`L${x},${y}`;}
 quadraticCurveTo(x,y,a,b){this.path+=`Q${x},${y} ${a},${b}`;}
 closePath(){this.path+='Z';}
 ellipse(x,y,rx,ry,angle,start,end){
  const cos=Math.cos(angle),sin=Math.sin(angle),point=a=>[x+rx*Math.cos(a)*cos-ry*Math.sin(a)*sin,y+rx*Math.cos(a)*sin+ry*Math.sin(a)*cos];
  const [sx,sy]=point(start);this.path+=`M${sx},${sy}`;const count=Math.max(2,Math.ceil(Math.abs(end-start)/.08));for(let i=1;i<=count;i++){const [px,py]=point(start+(end-start)*i/count);this.path+=`L${px},${py}`;}
 }
 arc(x,y,r,start,end){this.ellipse(x,y,r,r,0,start,end);}
 fill(){this.parts.push(`<path d="${this.path}" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}" transform="${this.transform}"/>`);}
 stroke(){this.parts.push(`<path d="${this.path}" fill="none" stroke="${escape(this.strokeStyle)}" stroke-width="${this.lineWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${this.globalAlpha}" transform="${this.transform}"/>`);}
 fillRect(x,y,w,h){this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}" transform="${this.transform}"/>`);}
 clearRect(x,y,w,h){if(x===0&&y===0&&w===384&&h===320){this.parts=[];return;}const id='cut'+ ++serial;this.parts=[`<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="384" height="320"><rect width="384" height="320" fill="white"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/></mask></defs><g mask="url(#${id})">${this.parts.join('')}</g>`];}
 drawImage(image,...args){
  if(image.pen){this.parts.push(`<g>${image.pen.parts.join('')}</g>`);return;}
  const [sx,sy,sw,sh,dx,dy,dw,dh]=args;
  this.parts.push(`<svg x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="${sx} ${sy} ${sw} ${sh}" overflow="hidden"><image href="${image.data}" width="${image.naturalWidth}" height="${image.naturalHeight}"/></svg>`);
 }
}
const images=new Map();
class Image{
 set src(path){const clean=path.split('?')[0];const file=join(root,'public',clean);readFile(file).then(b=>{this.data='data:image/png;base64,'+b.toString('base64');this.naturalWidth=b.readUInt32BE(16);this.naturalHeight=b.readUInt32BE(20);images.set(clean,this);this.onload?.();}).catch(()=>this.onerror?.());}
}
const rafs=new Map();let rafId=0,clock=0;
const h=await createDOM('reaction.html',{Image,fetch:async url=>({ok:true,json:async()=>JSON.parse(await readFile(join(root,'public',url.split('?')[0])))}),matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{rafs.set(++rafId,fn);return rafId;},cancelAnimationFrame:id=>rafs.delete(id)});
const create=h.doc.createElement;h.doc.createElement=tag=>{const el=create(tag);if(tag==='canvas'){el.pen=new Pen();el.getContext=()=>el.pen;}return el;};h.context.BS_CAREER_CORE=Career;h.context.BS_AUDIO={getSettings:()=>({effects:true})};await h.runFile('assets/js/character-player.js');
const player=h.context.BS_CHARACTERS,ids=['samurai','cat','robot','princess','fairy','astronaut','racer','diver','viking','gladiator','cyber','fox'];
const frames=join(out,'frames');await mkdir(frames,{recursive:true});let frameNo=0;const soundEvents=[];
for(const id of ids){
 const hero=Career.heroOf(id),spec=Career.HERO_SIGNATURES[id],actor=player.actor(id,{staticIdle:true});h.doc.body.append(actor);await actor.ready;if(actor.dataset.loaded!=='true')throw Error('Preview actor failed '+id);const canvas=actor.querySelector('canvas');
 for(const state of ['entry','walk','win']){
  player.setState(actor,state,{loop:state==='walk',explicit:true});const count=state==='walk'?20:40;const label={entry:'الدخول',walk:'المشي',win:'احتفال الفوز'}[state];soundEvents.push({frame:frameNo,id,state});
  for(let i=0;i<count;i++){
   clock+=1000/24;const callbacks=[...rafs.values()];rafs.clear();for(const fn of callbacks)fn(clock);
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720"><defs><radialGradient id="bg"><stop stop-color="#1d3549"/><stop offset="1" stop-color="#0b1420"/></radialGradient></defs><rect width="960" height="720" fill="url(#bg)"/><path d="M80 81H880M80 636H880" stroke="#31485b"/><text x="880" y="55" text-anchor="end" fill="#b6c6d3" font-family="Noto Sans Arabic" font-size="20">بوسراج · معرض الشخصيات</text><text x="80" y="55" fill="#7490a3" font-family="sans-serif" font-size="14">${String(ids.indexOf(id)+1).padStart(2,'0')} / 12</text><ellipse cx="480" cy="559" rx="150" ry="13" fill="#000" opacity=".25"/><g transform="translate(173 70) scale(1.6)">${canvas.pen.parts.join('')}</g><text x="480" y="618" text-anchor="middle" fill="${spec.color}" font-family="Noto Sans Arabic" font-size="31" font-weight="bold">${escape(hero.name)}</text><text x="480" y="677" text-anchor="middle" fill="#c6d8e3" font-family="Noto Sans Arabic" font-size="22">${label}</text></svg>`;
   await sharp(Buffer.from(svg)).png().toFile(join(frames,String(frameNo++).padStart(5,'0')+'.png'));
  }
 }
 player.dispose(actor);actor.remove();console.log('Rendered',id,frameNo);
}
await writeFile(join(out,'sound-events.json'),JSON.stringify({fps:24,frames:frameNo,events:soundEvents},null,2));
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:'inherit'});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error(cmd+' '+code)));});
await run('ffmpeg',['-v','error','-y','-framerate','24','-i',join(frames,'%05d.png'),'-c:v','libx264','-crf','20','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',join(out,'silent.mp4')]);
console.log('Production animation commands rendered,',frameNo,'frames at 24 fps. Add the packaged Foley using sound-events.json.');
