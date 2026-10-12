const lerp=(a,b,t)=>a+(b-a)*t;
export class SerpentRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.game=null;this.previous=null;this.received=0;this.cameras=new Map();this.ids=[];this.online=false;this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.ceil(this.width*this.dpr);this.canvas.height=Math.ceil(this.height*this.dpr);}
 setGame(game,ids=[],online=false){this.previous=this.online?this.game:null;this.game=game;this.ids=ids;this.online=online;this.received=performance.now();}
 draw(now){
  if(!this.game)return;const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#0a1b23';ctx.fillRect(0,0,this.width,this.height);
  const split=this.ids.length===2,sideways=this.width>this.height,views=split?(sideways?[{x:0,y:0,w:this.width/2,h:this.height},{x:this.width/2,y:0,w:this.width/2,h:this.height}]:[{x:0,y:0,w:this.width,h:this.height/2},{x:0,y:this.height/2,w:this.width,h:this.height/2}]):[{x:0,y:0,w:this.width,h:this.height}];
  views.forEach((v,i)=>this.drawView(v,this.ids[i],now,split));
  if(split){ctx.strokeStyle='#5d796580';ctx.lineWidth=2;ctx.beginPath();if(sideways){ctx.moveTo(this.width/2,0);ctx.lineTo(this.width/2,this.height);}else{ctx.moveTo(0,this.height/2);ctx.lineTo(this.width,this.height/2);}ctx.stroke();}
  this.canvas.dataset.tick=String(this.game.tick);this.canvas.dataset.rendered='true';
 }
 interpolate(s,now){const old=this.previous?.snakes.find(p=>p.id===s.id),t=this.online?Math.min(1,Math.max(0,(now-this.received)/100)):1;if(!old||!s.alive||!old.alive)return s;return {...s,x:lerp(old.x,s.x,t),y:lerp(old.y,s.y,t),angle:old.angle+Math.atan2(Math.sin(s.angle-old.angle),Math.cos(s.angle-old.angle))*t,segments:s.segments.map((p,i)=>({x:lerp(old.segments[i]?.x??p.x,p.x,t),y:lerp(old.segments[i]?.y??p.y,p.y,t)}))};}
 drawView(v,id,now,split){
  const ctx=this.ctx,g=this.game,own=g.snakes.find(s=>s.id===id)||g.snakes.find(s=>s.alive)||g.snakes[0],focus=this.interpolate(own,now);
  let camera=this.cameras.get(id);if(!camera){camera={x:focus.x,y:focus.y};this.cameras.set(id,camera);}camera.x=lerp(camera.x,focus.x,.12);camera.y=lerp(camera.y,focus.y,.12);
  const zoom=Math.max(.44,Math.min(1.03,Math.min(v.w,v.h)/650)),halfW=v.w/zoom/2,halfH=v.h/zoom/2;
  ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();
  const light=ctx.createRadialGradient(v.x+v.w*.45,v.y+v.h*.4,0,v.x+v.w*.5,v.y+v.h*.5,v.w*.7);light.addColorStop(0,'#163831');light.addColorStop(1,'#0a1b23');ctx.fillStyle=light;ctx.fillRect(v.x,v.y,v.w,v.h);
  ctx.translate(v.x+v.w/2,v.y+v.h/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  const minX=camera.x-halfW,minY=camera.y-halfH,maxX=camera.x+halfW,maxY=camera.y+halfH;
  ctx.strokeStyle='#5e948118';ctx.lineWidth=1/zoom;ctx.beginPath();for(let x=Math.max(0,Math.floor(minX/60)*60);x<=Math.min(g.width,maxX);x+=60){ctx.moveTo(x,Math.max(0,minY));ctx.lineTo(x,Math.min(g.height,maxY));}for(let y=Math.max(0,Math.floor(minY/60)*60);y<=Math.min(g.height,maxY);y+=60){ctx.moveTo(Math.max(0,minX),y);ctx.lineTo(Math.min(g.width,maxX),y);}ctx.stroke();
  ctx.lineWidth=16;ctx.strokeStyle='#daba5955';ctx.strokeRect(5,5,g.width-10,g.height-10);ctx.lineWidth=2;ctx.strokeStyle='#dccfa2';ctx.strokeRect(10,10,g.width-20,g.height-20);
  const colors=['#98d794','#ecd99a','#b99ae6','#8ccad6','#e8a6b8'];
  for(let hue=0;hue<colors.length;hue++){ctx.fillStyle=colors[hue];ctx.beginPath();for(const f of g.food){if(f.hue!==hue||f.x<minX-20||f.x>maxX+20||f.y<minY-20||f.y>maxY+20)continue;ctx.moveTo(f.x+f.radius,f.y);ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);}ctx.fill();}
  for(const raw of [...g.snakes].sort((a,b)=>Number(a.id===id)-Number(b.id===id))){if(!raw.alive)continue;const s=this.interpolate(raw,now),radius=7+Math.sqrt(s.mass)*.55;
   const points=[{x:s.x,y:s.y},...s.segments];if(!points.some(p=>p.x>=minX-radius*3&&p.x<=maxX+radius*3&&p.y>=minY-radius*3&&p.y<=maxY+radius*3))continue;
   const index=g.snakes.findIndex(x=>x.id===s.id);ctx.save();
   if(s.skin==='snake-wild')ctx.filter='hue-rotate('+index*53+'deg)';window.BS_COSMETIC_ART.body(ctx,points,s.skin,radius,s.boost);
   ctx.translate(s.x,s.y);ctx.rotate(s.angle);window.BS_COSMETIC_ART.head(ctx,s.skin,radius*1.25);ctx.restore();
   ctx.fillStyle=s.id===id?'#ecedc6':'#becdba';ctx.textAlign='center';ctx.font='11px Tahoma,Arial';ctx.fillText(s.name+(s.bot?' · BOT':''),s.x,s.y-radius*2.9);if(s.id===id){ctx.strokeStyle='#e3e8b45c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.x,s.y,radius*2.2,0,Math.PI*2);ctx.stroke();}
  }
  ctx.restore();
  if(split){ctx.fillStyle='#13302abf';ctx.fillRect(v.x+v.w/2-93,v.y+v.h-32,186,26);ctx.fillStyle=own.alive?'#d7e4bd':'#d6afa3';ctx.font='10px Tahoma,Arial';ctx.textAlign='center';ctx.fillText(own.name+' · '+own.score+(own.alive?'':' · خارج الجولة'),v.x+v.w/2,v.y+v.h-14);}
  else this.minimap(v,id);
 }
 minimap(v,id){const ctx=this.ctx,g=this.game,size=this.width<650?72:98,x=v.x+19,y=v.y+v.h-size-(this.width<650?147:24);ctx.save();ctx.fillStyle='#0b2427bd';ctx.fillRect(x,y,size,size);ctx.strokeStyle='#62835c88';ctx.lineWidth=1;ctx.strokeRect(x,y,size,size);for(const s of g.snakes){if(!s.alive)continue;ctx.fillStyle=s.id===id?'#f3e8ad':s.bot?'#7eac9a':'#a2c8d7';ctx.beginPath();ctx.arc(x+s.x/g.width*size,y+s.y/g.height*size,s.id===id?3:2,0,Math.PI*2);ctx.fill();}ctx.restore();}
}
