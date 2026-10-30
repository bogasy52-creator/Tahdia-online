/* Whole-character sprite animation. Artwork, UVs and foot anchors are shipped together. */
(function(root){
 'use strict';
 const doc=root.document,BASE='/assets/characters-v33/',REV='33.0.0-full1';
 const IDS=new Set(['fox','cat','robot','princess','fairy','astronaut','racer','diver','viking','gladiator','cyber','samurai']);
 const cache=new Map(),controllers=new WeakMap(),live=new Set(),actors=new Set();
 let raf=0,lastTick=0,paused=false;
 const identity=value=>{const id=String(value||'fox').replace(/^character-/,'');return IDS.has(id)?id:'fox';};
 const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const effects=()=>root.BS_AUDIO?.getSettings?.().effects!==false;
 const poster=value=>BASE+'portraits/'+identity(value)+'.webp?v='+REV;
 function validate(meta,id){
  if(meta.id!==id||meta.frameCount!==32||meta.frames?.length!==32||meta.atlas!==id+'.png'||!Number.isFinite(meta.scale)||meta.scale<=0)throw Error('Invalid character atlas');
  for(const f of meta.frames)if(![f.x,f.y,f.w,f.h,f.anchorX,f.anchorY].every(Number.isFinite)||f.x<0||f.y<0||f.w<=0||f.h<=0||f.x+f.w>meta.width||f.y+f.h>meta.height)throw Error('Invalid character frame');
  for(const key of ['idle','walk','entry','win']){const s=meta.states?.[key];if(!s||s.frames.length<6||!Number.isFinite(s.fps)||s.fps<1||s.fps>30||s.frames.some(n=>!Number.isInteger(n)||!meta.frames[n]?.usable))throw Error('Invalid character sequence');}
  return meta;
 }
 function prune(){for(const [id,entry]of cache){if(cache.size<=5)break;if(!entry.users&&entry.loaded)cache.delete(id);}}
 function load(value){
  const id=identity(value);let entry=cache.get(id);if(entry){cache.delete(id);cache.set(id,entry);return entry.promise;}
  entry={users:0,loaded:false};cache.set(id,entry);
  entry.promise=(async()=>{
   const response=await root.fetch(BASE+id+'.json?v='+REV,{cache:'force-cache'});if(!response.ok)throw Error('Character unavailable');const meta=validate(await response.json(),id);
   const image=new root.Image();image.decoding='async';const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Character image unavailable'));});image.src=BASE+meta.atlas+'?v='+REV;await ready;
   if(image.naturalWidth!==meta.width||image.naturalHeight!==meta.height)throw Error('Character image dimensions');entry.loaded=true;entry.data={meta,image};prune();return entry.data;
  })().catch(error=>{cache.delete(id);throw error;});return entry.promise;
 }
 function sequenceFrame(meta,state,elapsed,loop){
  const seq=meta.states[state]||meta.states.idle,step=Math.max(0,elapsed)*seq.fps/1000,count=seq.frames.length;
  return{index:seq.frames[loop?Math.floor(step)%count:Math.min(count-1,Math.floor(step))],done:!loop&&step>=count,duration:count/seq.fps*1000};
 }
 function motif(ctx,id,t,state){
  if(state==='idle'||!effects())return;const spec=root.BS_CAREER_CORE?.HERO_SIGNATURES?.[id],color=spec?.color||'#e8ba67',kind=spec?.effect||'dust',win=state==='win';
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=win?2:1.3;ctx.globalAlpha=win?.68:.44;ctx.translate(192,260);const phase=t/1000;
  const line=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
  if(kind==='dust'){for(let i=0;i<12;i++){const p=(phase*.6+i/12)%1;ctx.globalAlpha=(1-p)*.45;ctx.beginPath();ctx.ellipse((i%2?1:-1)*(18+60*p),10-12*p,6+12*p,1+2*p,-.3,0,Math.PI*2);ctx.fill();}}
  else if(kind==='bubble'){for(let i=0;i<10;i++){const p=(phase*.28+i/10)%1;ctx.globalAlpha=Math.sin(p*Math.PI)*.6;ctx.beginPath();ctx.arc(Math.sin(i*9)*90+Math.sin(p*5)*9,14-190*p,3+i%4,0,Math.PI*2);ctx.stroke();}}
  else if(kind==='circuit'){for(let i=0;i<8;i++){const p=(phase*.6+i/8)%1,x=(i%2?1:-1)*(55+i%3*13),y=10-160*p;ctx.globalAlpha=(1-p)*.7;line([[x,18],[x,y],[x+(i%2?14:-14),y],[x+(i%2?14:-14),y-16]]);ctx.fillRect(x-2,y-2,4,4);}}
  else if(kind==='orbit'){for(let i=0;i<3;i++){ctx.save();ctx.translate(0,-65);ctx.rotate((i-1)*.6+phase*.3);ctx.beginPath();ctx.ellipse(0,0,105,24,0,0,Math.PI*2);ctx.stroke();const a=phase*2+i*2;ctx.beginPath();ctx.arc(Math.cos(a)*105,Math.sin(a)*24,3,0,Math.PI*2);ctx.fill();ctx.restore();}}
  else if(kind==='streak'){for(let i=0;i<9;i++){const p=(phase*1.8+i/9)%1;ctx.globalAlpha=(1-p)*.6;line([[110-p*220,4-i*8],[145-p*220,4-i*8]]);}}
  else if(kind==='thunder'){for(let side of [-1,1]){const x=side*82;ctx.globalAlpha=.3+.3*Math.abs(Math.sin(phase*4));line([[x,-175],[x-side*14,-126],[x+side*6,-130],[x-side*12,-76],[x+side*13,-92],[x-side*2,-25]]);}}
  else if(kind==='shield'){ctx.translate(0,-70);ctx.globalAlpha=.3+.2*Math.sin(phase*2);ctx.beginPath();ctx.moveTo(0,-110);ctx.lineTo(96,-70);ctx.lineTo(78,35);ctx.quadraticCurveTo(50,72,0,95);ctx.quadraticCurveTo(-50,72,-78,35);ctx.lineTo(-96,-70);ctx.closePath();ctx.stroke();}
  else if(kind==='feather'){for(let side of [-1,1])for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(side*35,-60+i*7);ctx.quadraticCurveTo(side*(60+Math.sin(phase*3)*7),-140+i*18,side*(110-i*7),-65+i*19);ctx.stroke();}}
  else if(kind==='prism'){for(let i=0;i<6;i++){const a=i*Math.PI/3+phase*.35,x=Math.cos(a)*100,y=-70+Math.sin(a)*80;ctx.strokeStyle=i%2?'#e898ff':color;line([[x,y-10],[x-8,y+6],[x+8,y+6],[x,y-10]]);}}
  else if(kind==='shuriken'){for(let i=0;i<3;i++){const a=phase*2+i*2.1;ctx.save();ctx.translate(Math.cos(a)*100,-70+Math.sin(a)*65);ctx.rotate(phase*5);line([[0,-11],[3,-3],[11,0],[3,3],[0,11],[-3,3],[-11,0],[-3,-3],[0,-11]]);ctx.restore();}}
  else if(kind==='slash'){ctx.save();ctx.translate(0,-70);ctx.rotate(-.7+Math.sin(phase*2)*.2);ctx.beginPath();ctx.ellipse(0,0,114,66,0,.2,Math.PI*1.5);ctx.lineWidth=3;ctx.stroke();ctx.restore();}
  else if(kind==='ember'){for(let i=0;i<18;i++){const p=(phase*.55+i/18)%1,a=i*2.4;ctx.globalAlpha=(1-p)*.8;line([[Math.cos(a)*(25+80*p),12-140*p],[Math.cos(a)*(25+80*p)+3,17-140*p]]);}}
  ctx.restore();
 }
 function draw(c,elapsed=0){
  if(!c.data||!c.ctx)return;const {meta,image}=c.data,ctx=c.ctx,frame=sequenceFrame(meta,c.state,elapsed,c.loop),f=meta.frames[frame.index],scale=meta.scale;
  ctx.clearRect(0,0,384,320);if(!reduced()||c.explicit)motif(ctx,c.id,elapsed,c.state);
  // Clear tiny neighbouring-weapon overlaps on a local layer, never on the art master.
  if(!c.layer){c.layer=doc.createElement('canvas');c.layer.width=384;c.layer.height=320;c.layerCtx=c.layer.getContext('2d');}
  const layer=c.layerCtx;if(!layer)return;layer.clearRect(0,0,384,320);
  const dx=192-f.anchorX*scale,dy=meta.viewport.baseline-f.anchorY*scale;
  layer.drawImage(image,f.x,f.y,f.w,f.h,dx,dy,f.w*scale,f.h*scale);
  for(const cut of f.cutouts||[])layer.clearRect(dx+cut.x*scale,dy+cut.y*scale,cut.w*scale,cut.h*scale);
  ctx.drawImage(c.layer,0,0);c.el.dataset.frame=String(frame.index);return frame;
 }
 function schedule(){if(!raf&&!paused&&!doc.hidden&&live.size)raf=root.requestAnimationFrame(tick);}
 function stop(c){live.delete(c);if(!live.size&&raf){root.cancelAnimationFrame(raf);raf=0;}}
 function dispose(el){const c=controllers.get(el);if(!c)return;c.disposed=true;c.observer?.disconnect();stop(c);actors.delete(c);if(c.entry)c.entry.users=Math.max(0,c.entry.users-1);controllers.delete(el);prune();}
 function tick(now){raf=0;const delta=lastTick?Math.max(0,Math.min(70,now-lastTick)):0;lastTick=now;
  for(const c of [...live]){if(!c.el.isConnected){dispose(c.el);continue;}if(c.visible===false||paused||doc.hidden)continue;c.elapsed+=delta;if(now-c.drawn<1000/(c.state==='idle'?6:30))continue;c.drawn=now;
   const frame=draw(c,c.elapsed);if(frame?.done){if(c.returnIdle){c.state='idle';c.el.dataset.pose='idle';c.elapsed=0;c.loop=true;c.explicit=false;if(c.staticIdle||reduced()){draw(c,0);stop(c);}}else stop(c);}}
  schedule();
 }
 function setState(el,state='idle',options={}){
  const c=controllers.get(el);if(!c||c.disposed)return false;state=state==='move'?'walk':state;if(!['idle','walk','entry','win'].includes(state))state='idle';
  c.cancelled=false;c.state=state;c.playOptions=options;c.elapsed=0;c.drawn=-Infinity;c.loop=options.loop??(state==='idle'||state==='walk');c.returnIdle=options.returnIdle!==false;c.explicit=options.explicit===true;el.dataset.pose=state;
  if(c.data){draw(c,0);if(effects()&&(!reduced()||c.explicit)&&(!c.staticIdle||state!=='idle')){live.add(c);schedule();}else stop(c);}return true;
 }
 function actor(value,options={}){
  const id=identity(value),el=doc.createElement('span');el.className='character-actor'+(options.piece?' character-actor-piece':'');el.dataset.hero=id;el.dataset.pose=options.pose||'idle';el.setAttribute('aria-hidden','true');
  const img=doc.createElement('img');img.className='character-poster';img.src=poster(id);img.alt='';img.draggable=false;img.decoding='async';el.append(img);
  const c={id,el,poster:img,state:options.pose||'idle',playOptions:options,staticIdle:options.staticIdle===true,disposed:false,visible:true,elapsed:0,drawn:0,returnIdle:true,attached:false};controllers.set(el,c);actors.add(c);
  el.ready=options.posterOnly?Promise.resolve(el):load(id).then(data=>{
   if(c.disposed)return el;c.entry=cache.get(id);if(c.entry)c.entry.users++;c.data=data;const canvas=doc.createElement('canvas');canvas.width=384;canvas.height=320;canvas.className='character-canvas';c.ctx=canvas.getContext?.('2d');if(!c.ctx)throw Error('Character canvas unavailable');c.canvas=canvas;el.append(canvas);if(c.cancelled)draw(c,0);else setState(el,c.state,c.playOptions);img.hidden=true;el.dataset.loaded='true';
   c.attached=el.isConnected;if(root.IntersectionObserver){c.observer=new root.IntersectionObserver(entries=>{c.visible=entries[0]?.isIntersecting!==false;if(el.isConnected)c.attached=true;else if(c.attached)dispose(el);});c.observer.observe(el);}return el;
  }).catch(()=>{el.dataset.loaded='error';return el;});
  return el;
 }
 function cancel(){for(const c of [...actors]){if(!c.el.isConnected){dispose(c.el);continue;}setState(c.el,'idle');c.cancelled=true;stop(c);}}
 function suspend(){lastTick=0;if(raf){root.cancelAnimationFrame(raf);raf=0;}if(!paused&&!doc.hidden)schedule();}
 doc.addEventListener('visibilitychange',suspend);root.addEventListener('bs-match-pause',event=>{paused=event.detail?.paused===true;suspend();});root.addEventListener('pagehide',cancel);root.addEventListener('bs-social-session',cancel);root.addEventListener('bs-audio-change',()=>{if(!effects())cancel();});
 if(root.MutationObserver&&doc.body)new root.MutationObserver(()=>{for(const c of [...actors]){if(c.el.isConnected)c.attached=true;else if(c.attached)dispose(c.el);}}).observe(doc.body,{childList:true,subtree:true});
 root.BS_CHARACTERS=Object.freeze({actor,setState,dispose:el=>{const c=controllers.get(el);c?.observer?.disconnect();dispose(el);},poster,load,cancel,identity,validate,sequenceFrame,revision:REV});
})(window);
