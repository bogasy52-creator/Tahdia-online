import { CROWD, crowdLane, crowdTarget } from '../engines/crowd-engine.js?v=33.10.0-crowd1';
const TAU=Math.PI*2;
function round(ctx,x,y,w,h,r=8){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function polygon(ctx,points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function label(ctx,text,x,y,size,color='#fff',stroke='#123b6e'){ctx.font=`900 ${Math.round(size)}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=Math.max(2,size*.12);ctx.strokeStyle=stroke;ctx.strokeText(String(text),x,y);ctx.fillStyle=color;ctx.fillText(String(text),x,y);}
export function crowdProjection(width,height,x,z){
  const depth=Math.max(0,Math.min(1,z/CROWD.VIEW)),t=1-depth,road=Math.min(width,height*1.25)*(.18+.78*t),y=height*(.15+.82*t*t);
  return {x:width*.5+x*road/3,y,scale:.2+.8*t,road};
}
export function drawCrowdToy(ctx,x,y,size,color='blue',phase=0){
  const red=color==='red',dark=red?'#8e1830':'#133d9b',base=red?'#e83b4a':'#226cf7',light=red?'#ff9c94':'#7bbdff';
  ctx.save();ctx.translate(x,y);ctx.scale(size/36,size/36);
  ctx.fillStyle='#091e4340';ctx.beginPath();ctx.ellipse(0,5,12,4,0,0,TAU);ctx.fill();
  ctx.strokeStyle=dark;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-4,-6);ctx.lineTo(-5+Math.sin(phase)*2,2);ctx.moveTo(4,-6);ctx.lineTo(5-Math.sin(phase)*2,2);ctx.stroke();
  const body=ctx.createLinearGradient(-10,-23,10,-8);body.addColorStop(0,light);body.addColorStop(.35,base);body.addColorStop(1,dark);ctx.fillStyle=body;round(ctx,-9,-25,18,19,6);ctx.fill();
  ctx.strokeStyle=base;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-9,-20);ctx.lineTo(-12,-12);ctx.moveTo(9,-20);ctx.lineTo(12,-12);ctx.stroke();
  ctx.fillStyle='#edb780';ctx.beginPath();ctx.ellipse(0,-28,7,7,0,0,TAU);ctx.fill();
  const helm=ctx.createLinearGradient(-8,-39,8,-26);helm.addColorStop(0,light);helm.addColorStop(.4,base);helm.addColorStop(1,dark);ctx.fillStyle=helm;ctx.beginPath();ctx.ellipse(0,-32,10,9,0,Math.PI,TAU);ctx.lineTo(11,-30);ctx.quadraticCurveTo(0,-25,-11,-30);ctx.closePath();ctx.fill();
  ctx.strokeStyle=light;ctx.lineWidth=1;ctx.beginPath();ctx.arc(-2,-34,5,Math.PI*1.1,Math.PI*1.75);ctx.stroke();ctx.fillStyle='#f3c85b';ctx.fillRect(-8,-12,16,2);
  ctx.restore();
}
function toy(ctx,p,size,color,phase,sprites){
  const sprite=sprites?.[color];if(sprite)ctx.drawImage(sprite,p.x-size*.5,p.y-size*1.12,size,size*1.4);else drawCrowdToy(ctx,p.x,p.y,size,color,phase);
}
function gate(ctx,run,width,height,row,lane){
  const cell=row.cells[lane],z=row.z-run.distance;if(z<0||z>CROWD.VIEW)return;
  const p=crowdProjection(width,height,lane-1,z),gw=p.road*.29,gh=gw*.82,top=p.y-gh;
  if(cell.type==='enemy'){
    if(cell.defeated)return;
    polygon(ctx,[[p.x-gw*.45,p.y],[p.x+gw*.45,p.y],[p.x+gw*.4,top+gh*.2],[p.x-gw*.4,top+gh*.2]],'#b81e36');
    ctx.fillStyle='#f65a65';round(ctx,p.x-gw*.48,top,gw*.96,gh*.3,3);ctx.fill();
    for(let i=0;i<3;i++)drawCrowdToy(ctx,p.x+(i-1)*gw*.22,p.y-gh*.3,gw*.25,'red');
    const bar=gw*.9;ctx.fillStyle='#661b2a';round(ctx,p.x-bar/2,top-gh*.27,bar,gh*.15,3);ctx.fill();ctx.fillStyle='#ff7e84';round(ctx,p.x-bar/2,top-gh*.27,Math.max(1,bar*cell.hp/cell.maxHp),gh*.15,3);ctx.fill();label(ctx,Math.ceil(cell.hp),p.x,top-gh*.37,Math.max(10,gw*.22),'#fff','#9c2038');return;
  }
  const bad=cell.op==='−'||cell.op==='÷',gold=cell.op==='×'||cell.value===777;
  const rim=bad?'#d32f4b':gold?'#f9ba35':'#278ce7',bright=bad?'#ff9a91':gold?'#ffea8a':'#a3eaff',ink=bad?'#b31b3b':gold?'#bb6b06':'#1263b7';
  ctx.save();ctx.globalAlpha=Math.max(.3,Math.min(1,(CROWD.VIEW-z)/13));
  const g=ctx.createLinearGradient(0,top,0,p.y);g.addColorStop(0,rim);g.addColorStop(1,bad?'#f55f6ba0':gold?'#ffdd6690':'#30c9ff70');ctx.fillStyle=g;round(ctx,p.x-gw/2,top,gw,gh,Math.max(3,gw*.1));ctx.fill();
  ctx.lineWidth=Math.max(2,gw*.05);ctx.strokeStyle=bright;ctx.stroke();ctx.fillStyle=rim;ctx.fillRect(p.x-gw*.55,top+gh*.2,gw*.09,gh*.8);ctx.fillRect(p.x+gw*.46,top+gh*.2,gw*.09,gh*.8);
  label(ctx,cell.label,p.x,top+gh*.48,Math.max(12,gw*(cell.label.length>3?.29:.37)),'#fff',ink);
  ctx.fillStyle=bright;ctx.beginPath();ctx.ellipse(p.x,p.y,gw*.48,gh*.065,0,0,TAU);ctx.fill();ctx.restore();
}
function castle(ctx,run,w,h){
  const boss=run.boss,z=boss.z-run.distance;if(z<0||z>CROWD.VIEW||boss.defeated)return;const p=crowdProjection(w,h,0,z),width=p.road*.9,height=width*.48;
  const grad=ctx.createLinearGradient(0,p.y-height,0,p.y);grad.addColorStop(0,'#fa5b62');grad.addColorStop(1,'#9b1936');ctx.fillStyle=grad;round(ctx,p.x-width/2,p.y-height,width,height,8);ctx.fill();
  ctx.fillStyle='#641b31';round(ctx,p.x-width*.14,p.y-height*.55,width*.28,height*.56,[12,12,0,0]);ctx.fill();
  for(const s of[-1,1]){ctx.fillStyle='#b9253e';round(ctx,p.x+s*width*.42-width*.08,p.y-height*1.2,width*.16,height*1.2,4);ctx.fill();polygon(ctx,[[p.x+s*width*.42-width*.12,p.y-height*1.19],[p.x+s*width*.42+width*.12,p.y-height*1.19],[p.x+s*width*.42,p.y-height*1.5]],'#ff7575');ctx.fillStyle='#ffc55c';ctx.fillRect(p.x+s*width*.42-2,p.y-height*1.9,3,height*.4);polygon(ctx,[[p.x+s*width*.42,p.y-height*1.9],[p.x+s*width*.42+width*.2,p.y-height*1.78],[p.x+s*width*.42,p.y-height*1.65]],'#ed3253');}
  for(let i=0;i<7;i++)drawCrowdToy(ctx,p.x+(i-3)*width*.1,p.y-height*.58,width*.12,'red');
  const bh=Math.max(8,width*.065);ctx.fillStyle='#641b31';round(ctx,p.x-width*.48,p.y-height*1.62,width*.96,bh,4);ctx.fill();ctx.fillStyle='#fa6473';round(ctx,p.x-width*.48,p.y-height*1.62,Math.max(1,width*.96*boss.hp/boss.maxHp),bh,4);ctx.fill();label(ctx,'القلعة · '+Math.ceil(boss.hp),p.x,p.y-height*1.85,Math.max(13,width*.09));
}
export function drawCrowdFrame(ctx,run,width,height,time=0,effects=[],sprites=null){
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#76d8fd');sky.addColorStop(.24,'#c3f2ff');sky.addColorStop(.25,'#33c3ef');sky.addColorStop(1,'#078fbf');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#ffffffba';for(let i=0;i<4;i++){const x=((i*.33+time*.000008)%1.4-.2)*width,y=height*(.055+(i%2)*.045);ctx.beginPath();ctx.ellipse(x,y,width*.11,height*.021,0,0,TAU);ctx.ellipse(x+width*.06,y-height*.013,width*.055,height*.034,0,0,TAU);ctx.fill();}
  ctx.strokeStyle='#b2f5ff60';ctx.lineWidth=2;for(let i=0;i<15;i++){const y=height*(.27+i*.052),ox=Math.sin(i*7+time*.0003)*width*.07;ctx.beginPath();ctx.moveTo(ox,y);ctx.lineTo(ox+width*.15,y);ctx.moveTo(width*.83+ox,y);ctx.lineTo(width+ox,y);ctx.stroke();}
  const far=crowdProjection(width,height,0,CROWD.VIEW),near=crowdProjection(width,height,0,0);
  polygon(ctx,[[far.x-far.road/2-3,far.y],[far.x+far.road/2+3,far.y],[near.x+near.road/2+14,near.y+30],[near.x-near.road/2-14,near.y+30]],'#b29d77');
  const stone=ctx.createLinearGradient(0,far.y,0,near.y);stone.addColorStop(0,'#e8d7b0');stone.addColorStop(1,'#fff4d9');polygon(ctx,[[far.x-far.road/2,far.y],[far.x+far.road/2,far.y],[near.x+near.road/2,near.y+30],[near.x-near.road/2,near.y+30]],stone);
  for(let i=0;i<18;i++){const z=(i*7-run.distance%7);if(z<0||z>CROWD.VIEW)continue;const p=crowdProjection(width,height,0,z);ctx.strokeStyle='#d8c6a0';ctx.lineWidth=Math.max(.5,p.scale);ctx.beginPath();ctx.moveTo(p.x-p.road/2,p.y);ctx.lineTo(p.x+p.road/2,p.y);ctx.stroke();}
  for(const x of[-.5,.5]){const a=crowdProjection(width,height,x,0),b=crowdProjection(width,height,x,CROWD.VIEW);ctx.strokeStyle='#ffffffb0';ctx.lineWidth=2;ctx.setLineDash([height*.025,height*.022]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
  for(const side of[-1,1]){const a=crowdProjection(width,height,side*1.5,0),b=crowdProjection(width,height,side*1.5,CROWD.VIEW);ctx.strokeStyle='#fdf2cf';ctx.lineWidth=width*.022;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#d4aa57';ctx.lineWidth=width*.007;ctx.stroke();for(let i=0;i<9;i++){const z=i*10-run.distance%10;if(z<0)continue;const p=crowdProjection(width,height,side*1.5,z),s=width*.025*p.scale;ctx.fillStyle='#edd8ac';ctx.fillRect(p.x-s*.45,p.y-s*2.4,s*.9,s*2.4);ctx.fillStyle='#f4bd3f';ctx.beginPath();ctx.arc(p.x,p.y-s*2.5,s*.6,0,TAU);ctx.fill();}}
  castle(ctx,run,width,height);
  for(let i=run.rows.length-1;i>=0;i--)if(!run.rows[i].passed)for(let lane=0;lane<3;lane++)gate(ctx,run,width,height,run.rows[i],lane);
  const viewWidth=Math.min(width,height*1.25),n=Math.min(72,Math.max(1,run.army)),cols=Math.min(9,Math.ceil(Math.sqrt(n*1.1))),unit=viewWidth*.055;
  for(let i=n-1;i>=0;i--){const col=i%cols,row=Math.floor(i/cols),z=5.2+row*.8,p=crowdProjection(width,height,run.x+(col-(cols-1)/2)*.105,z);toy(ctx,p,unit*p.scale,'blue',time*.013+i,sprites);}
  const head=crowdProjection(width,height,run.x,13);label(ctx,run.army.toLocaleString('en-US'),head.x,head.y-unit*1.9,Math.max(23,viewWidth*.075),'#fff','#155aa9');
  for(const effect of effects){const age=(time-effect.at)/1000;if(age<0||age>.8)continue;ctx.save();ctx.globalAlpha=1-age/.8;
    if(effect.type==='shot'){const from=crowdProjection(width,height,effect.x,9),to=crowdProjection(width,height,effect.lane-1,Math.max(10,effect.z-run.distance));ctx.strokeStyle='#e9faff';ctx.lineWidth=Math.max(1,width*.006);ctx.shadowColor='#60cfff';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(from.x,from.y-unit);ctx.lineTo(to.x,to.y);ctx.stroke();}
    else if(effect.type==='gate'||effect.type==='hit'){label(ctx,(effect.delta>0?'+':'')+effect.delta,head.x,head.y-height*(.13+age*.09),Math.max(20,viewWidth*.065),effect.delta>0?'#fff2a0':'#ff9b94',effect.delta>0?'#94670b':'#941b33');}
    else if(effect.type==='burst'){const p=crowdProjection(width,height,effect.lane-1,effect.z-run.distance);for(let i=0;i<12;i++){const a=i/12*TAU,r=age*width*.15;ctx.fillStyle=i%2?'#ffd35e':'#fff';ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,Math.max(1,width*.01*(1-age)),0,TAU);ctx.fill();}}
    ctx.restore();
  }
  const target=crowdTarget(run),boss=run.boss.z-run.distance<=25;
  if(boss&&run.status==='running'){label(ctx,'اهزم القلعة!',width/2,height*.055,Math.max(16,viewWidth*.045),'#fff8db','#b22a43');}
  else if(run.elapsed<3.5&&run.status==='running'){label(ctx,'اسحب لاختيار البوابة',width/2,height*.08,Math.max(16,viewWidth*.045));}
  return {lane:crowdLane(run),target:Boolean(target)};
}
export function createCrowdPainter(canvas){
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D unavailable');let w=390,h=650,dpr=1;
  const sprites={};if(globalThis.document?.createElement)for(const color of['blue','red']){const sprite=document.createElement('canvas');sprite.width=96;sprite.height=134;drawCrowdToy(sprite.getContext('2d'),48,106,80,color);sprites[color]=sprite;}
  return Object.freeze({resize(width,height,pixelRatio=1){w=Math.max(1,width);h=Math.max(1,height);dpr=Math.max(1,Math.min(1.8,pixelRatio));canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);},draw(run,time,effects){ctx.setTransform(dpr,0,0,dpr,0,0);return drawCrowdFrame(ctx,run,w,h,time,effects,sprites);}});
}
