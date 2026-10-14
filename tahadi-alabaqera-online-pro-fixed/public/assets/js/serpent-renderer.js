import {SERPENT_SPEED,SERPENT_BOOST_SPEED,SERPENT_TURN_RATE} from './engines/serpent-engine.js?v=13.3.0';
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const foodSprites=new Map();
function foodSprite(kind){
 if(foodSprites.has(kind))return foodSprites.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');
 const dot=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const leaf=()=>{c.fillStyle='#a7e67a';c.beginPath();c.ellipse(55,24,13,6,-.55,0,Math.PI*2);c.fill();c.strokeStyle='#405d28';c.lineWidth=3;c.beginPath();c.moveTo(47,34);c.lineTo(49,19);c.stroke();};
 c.shadowBlur=8;c.shadowColor=kind==='gem'?'#62e9ff':'#efbd7955';
 if(kind==='apple'){dot(37,49,21,'#ff5772');dot(59,49,21,'#ef3f5f');dot(48,63,18,'#ef3f5f');leaf();}
 else if(kind==='citrus'){dot(48,50,29,'#ffc873');dot(48,50,24,'#ff9a42');c.strokeStyle='#ffe7af';c.lineWidth=2;for(let i=0;i<7;i++){const a=i*Math.PI*2/7;c.beginPath();c.moveTo(48,50);c.lineTo(48+Math.cos(a)*21,50+Math.sin(a)*21);c.stroke();}leaf();}
 else if(kind==='grapes'){for(const [x,y]of [[34,37],[57,37],[25,56],[48,56],[69,56],[37,74],[58,74]])dot(x,y,12,'#b494fa');leaf();}
 else if(kind==='star'||kind==='remains'){c.fillStyle=kind==='star'?'#ffda74':'#b6efb6';c.strokeStyle='#fff0ba';c.lineWidth=3;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?15:32;const x=48+Math.cos(a)*r,y=48+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.stroke();}
 else if(kind==='gem'){c.fillStyle='#69def9';c.strokeStyle='#c0faff';c.lineWidth=3;c.beginPath();c.moveTo(48,14);c.lineTo(79,43);c.lineTo(48,82);c.lineTo(17,43);c.closePath();c.fill();c.stroke();c.strokeStyle='#1e98c3';c.beginPath();c.moveTo(48,14);c.lineTo(48,82);c.moveTo(17,43);c.lineTo(79,43);c.stroke();}
 else{dot(48,54,27,'#eb86c4');dot(36,43,12,'#ffafd9');leaf();for(const [x,y]of [[35,59],[54,44],[61,66]])dot(x,y,2.5,'#fff0c1');}
 c.shadowBlur=0;c.globalAlpha=.55;dot(35,40,5,'#ffffff');foodSprites.set(kind,canvas);return canvas;
}

export function arenaZoom(width,height,mass=28){
 return clamp(clamp(Math.min(width,height)/580,.44,1.1)/Math.sqrt(1+Math.max(0,mass-28)/240),.34,1.1);
}
export function arenaTelemetry(game,id){
 const snakes=game?.snakes||[],mine=snakes.find(s=>s.id===id),sorted=[...snakes].sort((a,b)=>b.score-a.score);
 return {rank:mine?sorted.findIndex(s=>s.id===id)+1:0,alive:snakes.filter(s=>s.alive).length,total:snakes.length,kills:mine?.kills||0,boost:mine?.alive?clamp((mine.mass-24)/40,0,1):0,danger:!!mine?.alive&&Math.min(mine.x,mine.y,game.width-mine.x,game.height-mine.y)<115};
}
export function resolveTrialSkin(catalog,search){
 const id=new URLSearchParams(search).get('preview');
 return catalog.find(item=>item.id===id&&item.type==='snake'&&item.source!=='owner')||null;
}

export class SerpentRenderer {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
  this.game=null;this.previous=null;this.received=0;this.ids=[];this.online=false;
  this.cameras=new Map();this.inputs=new Map();this.poses=new Map();this.samples=new Map();
  this.effects=[];this.trails=[];this.lastDraw=0;
  this.reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  this.resize();
 }
 resize(){
  const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);
  this.dpr=Math.min(window.devicePixelRatio||1,2);
  this.canvas.width=Math.ceil(this.width*this.dpr);this.canvas.height=Math.ceil(this.height*this.dpr);
 }
 reset(){this.cameras.clear();this.poses.clear();this.samples.clear();this.effects=[];this.trails=[];this.lastDraw=0;this.previous=null;this.game=null;this.online=false;}
 setGame(game,ids=[],online=false){
  if(this.game&&game.tick<this.game.tick)this.reset();
  this.previous=this.online?this.game:null;this.game=game;this.ids=ids;this.online=online;this.received=performance.now();
 }
 setInput(id,angle,boost){this.inputs.set(id,{angle,boost});}
 viewRects(){
  if(this.ids.length!==2)return [{x:0,y:0,w:this.width,h:this.height}];
  return this.width>this.height?
   [{x:0,y:0,w:this.width/2,h:this.height},{x:this.width/2,y:0,w:this.width/2,h:this.height}]:
   [{x:0,y:0,w:this.width,h:this.height/2},{x:0,y:this.height/2,w:this.width,h:this.height/2}];
 }
 aimAt(index,x,y){
  const id=this.ids[index],own=this.poses.get(id)||this.game?.snakes.find(s=>s.id===id),v=this.viewRects()[index];
  if(!own||!v)return null;
  const camera=this.cameras.get(id)||{x:own.x,y:own.y,zoom:arenaZoom(v.w,v.h,own.mass)};
  const dx=x-(v.x+v.w/2+(own.x-camera.x)*camera.zoom),dy=y-(v.y+v.h/2+(own.y-camera.y)*camera.zoom);
  return Math.hypot(dx,dy)>4?Math.atan2(dy,dx):null;
 }
 interpolate(s,now){
  if(this.online&&s.alive&&this.game.status==='playing'&&this.ids.includes(s.id)){
   const age=Math.min(.1,Math.max(0,(now-this.received)/1000)),input=this.inputs.get(s.id);
   const delta=input?Math.atan2(Math.sin(input.angle-s.angle),Math.cos(input.angle-s.angle)):0;
   const angle=s.angle+Math.max(-SERPENT_TURN_RATE*age,Math.min(SERPENT_TURN_RATE*age,delta));
   const speed=input?.boost&&s.mass>24?SERPENT_BOOST_SPEED:SERPENT_SPEED,travel=(s.angle+angle)/2;
   const x=s.x+Math.cos(travel)*speed*age,y=s.y+Math.sin(travel)*speed*age;
   // Presentation only. Collisions, rewards and death remain server-owned.
   return {...s,x,y,angle,segments:[{x,y},...s.segments.slice(0,-1)]};
  }
  const old=this.previous?.snakes.find(p=>p.id===s.id);
  const t=this.online?Math.min(1,Math.max(0,(now-this.received)/100)):1;
  if(!old||!s.alive||!old.alive)return s;
  return {...s,x:lerp(old.x,s.x,t),y:lerp(old.y,s.y,t),
   angle:old.angle+Math.atan2(Math.sin(s.angle-old.angle),Math.cos(s.angle-old.angle))*t,
   segments:s.segments.map((p,i)=>({x:lerp(old.segments[i]?.x??p.x,p.x,t),y:lerp(old.segments[i]?.y??p.y,p.y,t)}))};
 }
 updatePresentation(now,dt){
  const present=new Set();
  for(const raw of this.game.snakes){
   present.add(raw.id);
   const target=this.interpolate(raw,now),old=this.poses.get(raw.id),t=1-Math.exp(-dt/48);
   const snap=!old||!raw.alive||Math.hypot(old.x-target.x,old.y-target.y)>120;
   let pose=snap?{...target,segments:target.segments.map(p=>({...p}))}:
    {...target,x:lerp(old.x,target.x,t),y:lerp(old.y,target.y,t),
     angle:old.angle+Math.atan2(Math.sin(target.angle-old.angle),Math.cos(target.angle-old.angle))*t,
     segments:target.segments.map((p,i)=>({x:lerp(old.segments[i]?.x??p.x,p.x,t),y:lerp(old.segments[i]?.y??p.y,p.y,t)}))};
   if(!snap&&this.online&&this.ids.includes(raw.id)&&this.game.status==='playing'){
    if(now-this.received>180){pose={...target,x:old.x,y:old.y,angle:old.angle,segments:old.segments.map(p=>({...p}))};this.poses.set(raw.id,pose);continue;}
    const input=this.inputs.get(raw.id),seconds=clamp(dt/1000,0,.08),desired=input?.angle??raw.angle;
    const turn=Math.atan2(Math.sin(desired-old.angle),Math.cos(desired-old.angle)),angle=old.angle+clamp(turn,-SERPENT_TURN_RATE*seconds,SERPENT_TURN_RATE*seconds);
    const speed=input?.boost&&raw.mass>24?SERPENT_BOOST_SPEED:SERPENT_SPEED,heading=(old.angle+angle)/2;
    const x=old.x+Math.cos(heading)*speed*seconds,y=old.y+Math.sin(heading)*speed*seconds,correction=1-Math.exp(-dt/180),limit=speed*seconds*.3;
    pose={...pose,x:x+clamp((target.x-x)*correction,-limit,limit),y:y+clamp((target.y-y)*correction,-limit,limit),angle};
    pose.segments[0]={x:pose.x,y:pose.y};
   }
   this.poses.set(raw.id,pose);
   const sample=this.samples.get(raw.id);
   let combo=sample?.combo||0,lastEat=sample?.lastEat||0;
   if(sample&&this.ids.includes(raw.id)&&!this.reducedMotion){
    const gained=raw.score-sample.score,kill=raw.kills>sample.kills;
    if(gained>0||kill){combo=kill?0:now-lastEat<1600?Math.min(8,combo+1):1;lastEat=now;
     this.effects.push({id:raw.id,x:pose.x,y:pose.y,born:now,text:kill?'افتراس +'+(raw.kills-sample.kills):combo>=3?'سلسلة ×'+combo+' · +'+gained:'+'+gained,color:kill?'#f2d58c':combo>=3?'#fac8ef':'#a1f4d0',strong:kill||combo>=3});
     window.BS_AUDIO?.play?.(kill?'capture':'pop',{volume:kill?.3:.14});
    }
    if(sample.alive&&!raw.alive)this.effects.push({id:raw.id,x:pose.x,y:pose.y,born:now,text:'خارج المطاردة',color:'#ffbaaa',strong:true});
   }
   let trailAt=sample?.trailAt||0;
   if(raw.alive&&raw.boost&&this.ids.includes(raw.id)&&!this.reducedMotion&&now-trailAt>65){
    const tail=pose.segments.at(-1)||pose;this.trails.push({x:tail.x,y:tail.y,born:now,color:raw.color});trailAt=now;
   }
   this.samples.set(raw.id,{score:raw.score,kills:raw.kills,alive:raw.alive,trailAt,combo,lastEat});
  }
  for(const id of this.poses.keys())if(!present.has(id)){this.poses.delete(id);this.samples.delete(id);}
  this.effects=this.effects.filter(e=>now-e.born<850).slice(-16);this.trails=this.trails.filter(e=>now-e.born<450).slice(-24);
 }
 draw(now){
  if(!this.game||!this.game.snakes.length)return;
  const ctx=this.ctx,dt=this.lastDraw?clamp(now-this.lastDraw,0,80):16;
  this.lastDraw=now;this.frameBlend=1-Math.exp(-dt/95);this.updatePresentation(now,dt);
  ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#071720';ctx.fillRect(0,0,this.width,this.height);
  const split=this.ids.length===2,sideways=this.width>this.height;
  const views=this.viewRects();
  views.forEach((v,i)=>this.drawView(v,this.ids[i],now,split));
  if(split){
   ctx.strokeStyle='#83bba880';ctx.lineWidth=2;ctx.beginPath();
   if(sideways){ctx.moveTo(this.width/2,0);ctx.lineTo(this.width/2,this.height);}
   else{ctx.moveTo(0,this.height/2);ctx.lineTo(this.width,this.height/2);}
   ctx.stroke();
  }
  this.canvas.dataset.tick=String(this.game.tick);this.canvas.dataset.rendered='true';
 }
 drawView(v,id,now,split){
  const ctx=this.ctx,g=this.game;
  const player=g.snakes.find(s=>s.id===id),own=player?.alive?player:g.snakes.find(s=>s.alive)||player||g.snakes[0];
  const focus=this.poses.get(own.id)||this.interpolate(own,now),info=arenaTelemetry(g,id);
  let camera=this.cameras.get(id);
  if(!camera){camera={x:focus.x,y:focus.y,zoom:arenaZoom(v.w,v.h,own.mass)};this.cameras.set(id,camera);}
  camera.x=own.id===id?focus.x:lerp(camera.x,focus.x,this.frameBlend);camera.y=own.id===id?focus.y:lerp(camera.y,focus.y,this.frameBlend);
  camera.zoom=lerp(camera.zoom,arenaZoom(v.w,v.h,own.mass),this.frameBlend*.6);
  const zoom=camera.zoom,halfW=v.w/zoom/2,halfH=v.h/zoom/2;
  const minX=camera.x-halfW,minY=camera.y-halfH,maxX=camera.x+halfW,maxY=camera.y+halfH;
  ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();
  const light=ctx.createRadialGradient(v.x+v.w*.45,v.y+v.h*.4,0,v.x+v.w*.5,v.y+v.h*.5,v.w*.7);
  light.addColorStop(0,'#15383b');light.addColorStop(1,'#071720');ctx.fillStyle=light;ctx.fillRect(v.x,v.y,v.w,v.h);
  ctx.translate(v.x+v.w/2,v.y+v.h/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  ctx.strokeStyle='#75bbb31b';ctx.lineWidth=1/zoom;ctx.beginPath();
  for(let x=Math.max(0,Math.floor(minX/80)*80);x<=Math.min(g.width,maxX);x+=80){ctx.moveTo(x,Math.max(0,minY));ctx.lineTo(x,Math.min(g.height,maxY));}
  for(let y=Math.max(0,Math.floor(minY/80)*80);y<=Math.min(g.height,maxY);y+=80){ctx.moveTo(Math.max(0,minX),y);ctx.lineTo(Math.min(g.width,maxX),y);}
  ctx.stroke();ctx.fillStyle='#7ab8ac32';ctx.beginPath();
  for(let x=Math.max(0,Math.floor(minX/240)*240);x<=Math.min(g.width,maxX);x+=240)
   for(let y=Math.max(0,Math.floor(minY/240)*240);y<=Math.min(g.height,maxY);y+=240){ctx.moveTo(x+2,y);ctx.arc(x,y,2,0,Math.PI*2);}
  ctx.fill();
  ctx.lineWidth=18;ctx.strokeStyle=info.danger?'#df87684d':'#83c9b936';ctx.strokeRect(5,5,g.width-10,g.height-10);
  ctx.lineWidth=2;ctx.strokeStyle=info.danger?'#ffb197':'#9cdfce';ctx.strokeRect(10,10,g.width-20,g.height-20);
  for(const f of g.food){
   if(f.x<minX-20||f.x>maxX+20||f.y<minY-20||f.y>maxY+20)continue;
   const kind=f.kind||['apple','citrus','grapes','gem','berry'][f.hue%5],size=(f.radius||6)*3.6;
   ctx.drawImage(foodSprite(kind),f.x-size/2,f.y-size/2,size,size);
  }
  ctx.shadowBlur=0;
  for(const trail of this.trails){const t=(now-trail.born)/450;if(trail.x<minX||trail.x>maxX||trail.y<minY||trail.y>maxY)continue;ctx.save();ctx.globalAlpha=(1-t)*.65;ctx.fillStyle=trail.color||'#e8d9ad';ctx.beginPath();ctx.arc(trail.x,trail.y,2.5*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();}
  for(const raw of [...g.snakes].sort((a,b)=>Number(a.id===id)-Number(b.id===id))){
   if(!raw.alive)continue;
   const s=this.poses.get(raw.id)||this.interpolate(raw,now),radius=7+Math.sqrt(s.mass)*.55;
   const points=[{x:s.x,y:s.y},...s.segments];
   if(!points.some(p=>p.x>=minX-radius*3&&p.x<=maxX+radius*3&&p.y>=minY-radius*3&&p.y<=maxY+radius*3))continue;
   const index=g.snakes.findIndex(x=>x.id===s.id),variant=s.skin==='snake-wild'?index:0;
   ctx.save();
   window.BS_COSMETIC_ART.body(ctx,points,s.skin,radius,s.boost,variant);
   ctx.translate(s.x,s.y);ctx.rotate(s.angle);
   window.BS_COSMETIC_ART.head(ctx,s.skin,radius*1.55,variant);
   if(!this.reducedMotion&&Math.sin(now/125+index)>.7){ctx.strokeStyle='#f0a4af';ctx.lineWidth=1.15;ctx.beginPath();ctx.moveTo(radius*2.45,0);ctx.lineTo(radius*3.2,0);ctx.lineTo(radius*3.4,-radius*.15);ctx.moveTo(radius*3.2,0);ctx.lineTo(radius*3.4,radius*.15);ctx.stroke();}
   if(s.id===id){
    ctx.strokeStyle=s.boost?'#f6df96':'#b9f3db';ctx.lineWidth=1.25/zoom;ctx.beginPath();
    ctx.moveTo(radius*3.9,-radius*.45);ctx.lineTo(radius*4.3,0);ctx.lineTo(radius*3.9,radius*.45);ctx.stroke();
   }
   ctx.restore();
   ctx.fillStyle=s.id===id?'#f0f4d5':'#b7d0c9';ctx.textAlign='center';ctx.font='600 11px Tahoma,Arial';
   ctx.fillText(s.name+(s.bot?' · BOT':''),s.x,s.y-radius*2.9);
  }
  for(const effect of this.effects){
   if(split&&effect.id!==id)continue;
   const t=clamp((now-effect.born)/850,0,1);
   ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle=effect.color;ctx.textAlign='center';
   ctx.font='700 18px Tahoma,Arial';ctx.fillText(effect.text,effect.x,effect.y-50-t*50);
   if(t<.7)for(let i=0;i<(effect.strong?10:4);i++){
    const angle=i*Math.PI*2/(effect.strong?10:4)+t*1.2,r=12+t*(effect.strong?65:32);
    ctx.beginPath();ctx.arc(effect.x+Math.cos(angle)*r,effect.y+Math.sin(angle)*r,(effect.strong?3:2)*(1-t),0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
  }
  ctx.restore();
  if(split){
   ctx.fillStyle='#0a242aca';ctx.fillRect(v.x+v.w/2-106,v.y+v.h-31,212,25);
   ctx.fillStyle=own.alive?'#e0ebd2':'#e6ae9e';ctx.font='11px Tahoma,Arial';ctx.textAlign='center';
   ctx.fillText(own.name+' · '+own.score+(own.alive?'':' · خارج الجولة'),v.x+v.w/2,v.y+v.h-14);
  }else this.minimap(v,id);
 }
 minimap(v,id){
  const ctx=this.ctx,g=this.game,size=this.width<650?80:104;
  const x=v.x+v.w-size-20,y=v.y+v.h-size-(this.width<650?36:24);
  ctx.save();ctx.fillStyle='#081d25da';ctx.fillRect(x,y,size,size);
  ctx.strokeStyle='#82b6a783';ctx.lineWidth=1;ctx.strokeRect(x,y,size,size);
  for(const s of g.snakes){
   if(!s.alive)continue;
   const sx=x+s.x/g.width*size,sy=y+s.y/g.height*size;
   ctx.fillStyle=s.id===id?'#f3e8ad':s.bot?'#76b4a5':'#aeddec';
   ctx.beginPath();ctx.arc(sx,sy,s.id===id?3.3:2,0,Math.PI*2);ctx.fill();
   if(s.id===id){ctx.strokeStyle='#f3e8ad';ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(s.angle)*7,sy+Math.sin(s.angle)*7);ctx.stroke();}
  }
  ctx.fillStyle='#98b5ab';ctx.font='9px Tahoma,Arial';ctx.textAlign='center';ctx.fillText('الحلبة',x+size/2,y-8);ctx.restore();
 }
}
