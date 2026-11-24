/* Original cut-crystal artwork and a cancellable Canvas presentation layer.
   This module never decides a move: it replays the engine's before/phases record. */
// 33.16: faceted ruby, star, emerald, sapphire, amethyst and amber stones.
export const GEM_COLORS = Object.freeze([
  { base:'#ff3d63', light:'#ffc2cf', dark:'#b0153a', rim:'#6d0a22', glow:'#ff8aa5' },
  { base:'#ffc21c', light:'#fff4b0', dark:'#c97c00', rim:'#734300', glow:'#ffe27a' },
  { base:'#3ed35d', light:'#cbffd0', dark:'#138a3a', rim:'#0a4f22', glow:'#8cf5a2' },
  { base:'#2f9cff', light:'#c3e6ff', dark:'#1452c8', rim:'#0a2c78', glow:'#8fd0ff' },
  { base:'#b65cff', light:'#efd2ff', dark:'#6c21c9', rim:'#3c0d7a', glow:'#dcaaff' },
  { base:'#ff8b2b', light:'#ffd8b0', dark:'#c9480c', rim:'#702804', glow:'#ffbd85' },
]);
const studioTAU = Math.PI * 2;
function studioPath(ctx, points) { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); }
function studioRound(ctx,x,y,w,h,r) {
  r = Math.max(0,Math.min(r,w/2,h/2)); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function studioPoints(color,r) {
  if (color===0) return Array.from({length:12},(_,i)=>{ const a=-Math.PI/2+i*studioTAU/12; return [Math.cos(a)*r*.9,Math.sin(a)*r*.94]; });
  if (color===1) return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,q=r*(i%2?.61:1);return [Math.cos(a)*q,Math.sin(a)*q];});
  if (color===2) return [[-.49*r,-.98*r],[.49*r,-.98*r],[.79*r,-.65*r],[.79*r,.65*r],[.49*r,.98*r],[-.49*r,.98*r],[-.79*r,.65*r],[-.79*r,-.65*r]];
  if (color===3) return [[0,-1.06*r],[.87*r,-.1*r],[.65*r,.35*r],[0,1.03*r],[-.65*r,.35*r],[-.87*r,-.1*r]];
  if (color===4) return [[-.18*r,-.99*r],[.18*r,-.99*r],[.98*r,.47*r],[.79*r,.83*r],[-.79*r,.83*r],[-.98*r,.47*r]];
  return Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return [Math.cos(a)*r*.98,Math.sin(a)*r*.98];});
}
function studioSpark(ctx,x,y,r,alpha=1) {
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.08,-r*.08,r,0);ctx.quadraticCurveTo(r*.08,r*.08,0,r);ctx.quadraticCurveTo(-r*.08,r*.08,-r,0);ctx.quadraticCurveTo(-r*.08,-r*.08,0,-r);ctx.fill();ctx.restore();
}
function paintCrystal(ctx,x,y,size,color=0,special=''){
  // Cut stones share silhouettes with the accessibility colour labels.
  const pal=GEM_COLORS[color]||GEM_COLORS[0],r=size*.405;
  const points=studioPoints(color,r),inner=points.map(([px,py])=>[px*.56,py*.56-r*.08]);
  ctx.save();ctx.translate(x,y);
  ctx.save();ctx.translate(0,r*.15);studioPath(ctx,points);ctx.fillStyle='#00000085';ctx.shadowColor='#00000080';ctx.shadowBlur=r*.2;ctx.fill();ctx.restore();
  studioPath(ctx,points);let g=ctx.createLinearGradient(-r,-r,r,r);g.addColorStop(0,pal.light);g.addColorStop(.37,pal.base);g.addColorStop(1,pal.dark);ctx.fillStyle=g;ctx.fill();
  const tones=[pal.light,pal.base,pal.dark,pal.rim,pal.dark,pal.base];
  for(let i=0;i<points.length;i++){
    const next=(i+1)%points.length;
    studioPath(ctx,[points[i],points[next],inner[next],inner[i]]);
    ctx.fillStyle=special==='ball'?GEM_COLORS[i%6].base:tones[Math.floor(i/points.length*6)];ctx.fill();
    ctx.strokeStyle='#ffffff24';ctx.lineWidth=.6;ctx.stroke();
  }
  studioPath(ctx,inner);g=ctx.createLinearGradient(-r*.4,-r*.5,r*.5,r*.6);g.addColorStop(0,'#ffffffd9');g.addColorStop(.22,pal.light);g.addColorStop(.48,pal.base);g.addColorStop(1,pal.dark);ctx.fillStyle=g;ctx.fill();
  ctx.lineWidth=Math.max(.8,r*.035);ctx.strokeStyle=pal.light+'c0';ctx.stroke();
  ctx.save();studioPath(ctx,inner);ctx.clip();studioPath(ctx,[[-r,-r],[r*.5,-r],[-r*.2,r],[-r,r]]);ctx.fillStyle='#ffffff27';ctx.fill();ctx.restore();
  studioPath(ctx,points);ctx.lineWidth=Math.max(1,r*.055);ctx.strokeStyle=pal.rim;ctx.stroke();
  ctx.beginPath();ctx.moveTo(...points[points.length-1]);for(let i=0;i<=Math.floor(points.length*.4);i++)ctx.lineTo(...points[i]);ctx.strokeStyle=pal.light;ctx.lineWidth=Math.max(.8,r*.03);ctx.stroke();
  if(special==='rh'||special==='rv'){
    ctx.save();if(special==='rv')ctx.rotate(Math.PI/2);ctx.shadowColor='#fff';ctx.shadowBlur=r*.12;ctx.lineWidth=r*.17;ctx.strokeStyle=pal.rim;ctx.beginPath();ctx.moveTo(-r*.75,0);ctx.lineTo(r*.75,0);ctx.stroke();ctx.lineWidth=r*.075;ctx.strokeStyle='#fff';ctx.stroke();
    for(const d of[-1,1]){studioPath(ctx,[[d*r*.87,0],[d*r*.56,-r*.18],[d*r*.56,r*.18]]);ctx.fillStyle='#fff';ctx.fill();}ctx.restore();
  }
  if(special==='bomb'){ctx.beginPath();ctx.arc(0,0,r*.34,0,studioTAU);ctx.fillStyle='#18101f';ctx.fill();ctx.lineWidth=r*.065;ctx.strokeStyle='#ffe0a0';ctx.stroke();studioSpark(ctx,0,0,r*.23);}
  if(special==='ball'){studioSpark(ctx,0,0,r*.48);ctx.beginPath();ctx.arc(0,0,r*.27,0,studioTAU);ctx.strokeStyle='#ffffffb0';ctx.lineWidth=r*.035;ctx.stroke();}
  studioSpark(ctx,-r*.34,-r*.6,r*.105,.9);ctx.restore();
}
const crystalAtlas=new Map();
export function drawStudioGem(ctx,x,y,size,color=0,special='',time=0){
  const key=color+':'+special;let atlas=crystalAtlas.get(key);
  if(!atlas){atlas=globalThis.document?.createElement?.('canvas')||(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(224,224):null);if(atlas){atlas.width=atlas.height=224;paintCrystal(atlas.getContext('2d'),112,108,224,color,special);crystalAtlas.set(key,atlas);if(crystalAtlas.size>32)crystalAtlas.delete(crystalAtlas.keys().next().value);}}
  if(atlas)ctx.drawImage(atlas,x-size/2,y-size*.482,size,size);else paintCrystal(ctx,x,y,size,color,special);
  if(special)studioSpark(ctx,x+size*.25,y-size*.28,size*.045,.35+Math.sin(time*.003+x*.01)*.2);
}
export function drawBoosterIcon(canvas,index,size=112) {
  canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);const s=size/100;ctx.save();ctx.scale(s,s);ctx.translate(50,50);ctx.lineJoin='round';ctx.lineCap='round';
  if(index===0){ctx.rotate(-.48);ctx.shadowColor='#60154766';ctx.shadowBlur=5;ctx.shadowOffsetY=4;studioRound(ctx,-5,-4,10,38,4);ctx.fillStyle='#d97b49';ctx.fill();studioRound(ctx,-23,-24,46,26,8);const gr=ctx.createLinearGradient(0,-24,0,2);gr.addColorStop(0,'#ffe9f0');gr.addColorStop(.3,'#ff6d9e');gr.addColorStop(1,'#d62b6c');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#fff3fa';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffffff9c';studioRound(ctx,-17,-20,10,17,4);ctx.fill();}
  else if(index===1){ctx.rotate(-.65);for(const dx of [-12,12]){ctx.save();ctx.translate(dx,0);studioPath(ctx,[[0,-31],[9,-11],[7,18],[-7,18],[-9,-11]]);const gr=ctx.createLinearGradient(-8,0,8,0);gr.addColorStop(0,'#dffbff');gr.addColorStop(.4,'#8ce6ff');gr.addColorStop(1,'#329ce3');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();studioPath(ctx,[[-7,13],[-12,23],[0,18],[12,23],[7,13]]);ctx.fillStyle='#7ccfff';ctx.fill();studioPath(ctx,[[-4,20],[0,35],[4,20]]);ctx.fillStyle='#ffd071';ctx.fill();ctx.restore();}}
  else if(index===3){
    // the beak: a pickaxe with a green head
    ctx.rotate(.62);ctx.shadowColor='#0b3a1a66';ctx.shadowBlur=5;ctx.shadowOffsetY=4;studioRound(ctx,-4,-14,8,46,4);ctx.fillStyle='#c98a4b';ctx.fill();ctx.strokeStyle='#7a4a1e';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-32,-6);ctx.quadraticCurveTo(0,-34,32,-6);ctx.quadraticCurveTo(0,-20,-32,-6);ctx.closePath();const gr=ctx.createLinearGradient(0,-30,0,-6);gr.addColorStop(0,'#d7ffd9');gr.addColorStop(.4,'#4fdc6c');gr.addColorStop(1,'#168a3c');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#eaffee';ctx.lineWidth=2;ctx.stroke();studioRound(ctx,-7,-24,14,14,4);ctx.fillStyle='#9a6431';ctx.fill();studioSpark(ctx,-24,-14,5);}
  else if(index===4){
    // the mix: two arrows chasing round a candy
    for(const turn of[0,Math.PI]){ctx.save();ctx.rotate(turn);ctx.beginPath();ctx.arc(0,0,28,Math.PI*1.08,Math.PI*1.86);ctx.strokeStyle='#ffd23f';ctx.lineWidth=8;ctx.lineCap='round';ctx.stroke();const ex=Math.cos(Math.PI*1.86)*28,ey=Math.sin(Math.PI*1.86)*28;studioPath(ctx,[[ex+9,ey-2],[ex-4,ey-10],[ex-2,ey+8]]);ctx.fillStyle='#ffd23f';ctx.fill();ctx.restore();}
    ctx.beginPath();ctx.arc(0,0,14,0,studioTAU);const gr=ctx.createRadialGradient(-4,-5,1,0,0,15);gr.addColorStop(0,'#fff4b0');gr.addColorStop(.4,'#ffc21c');gr.addColorStop(1,'#c97c00');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#734300';ctx.lineWidth=2;ctx.stroke();studioSpark(ctx,-5,-6,4);studioSpark(ctx,22,-24,5);}
  else {for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,(i-1)*10,26-i*5,9,0,Math.PI*.1,Math.PI*1.85);ctx.strokeStyle=['#e8ceff','#cb8cff','#a568fa'][i];ctx.lineWidth=8-i;ctx.stroke();}studioSpark(ctx,17,-25,8);studioSpark(ctx,-17,14,5);}
  ctx.restore();
}
export function drawStudioBoard(ctx,board,size,{selection=-1,cursor=-1,focus=false,hint=null,aim=[],time=0,tiles=null,palette=globalThis.BS_TABLE_STUDIO?.palette}={}){
  // Brushed-metal frame, inset stone bed and individual bevelled sockets.
  const p=palette||{edge:'#bd995c',light:'#f7e0a0',surface:'#24133e',well:'#100b21',tile:'#302344',alternate:'#3a2a53',pattern:'velvet'};
  const pad=Math.round(size*.038),cell=(size-pad*2)/8;ctx.clearRect(0,0,size,size);ctx.save();
  let g=ctx.createLinearGradient(0,0,0,size);g.addColorStop(0,p.light);g.addColorStop(.08,p.edge);g.addColorStop(.49,p.surface);g.addColorStop(.53,p.edge);g.addColorStop(1,p.light);studioRound(ctx,1,1,size-2,size-2,size*.05);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#f1e6ff99';ctx.lineWidth=1.5;ctx.stroke();
  studioRound(ctx,pad-5,pad-5,size-pad*2+10,size-pad*2+10,size*.035);g=ctx.createLinearGradient(0,pad,0,size-pad);g.addColorStop(0,p.well);g.addColorStop(1,p.surface);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#14053a';ctx.lineWidth=2;ctx.stroke();
  ctx.save();studioRound(ctx,pad-2,pad-2,size-pad*2+4,size-pad*2+4,size*.03);ctx.clip();
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){const x=pad+col*cell,y=pad+row*cell,odd=(row+col)%2;g=ctx.createLinearGradient(0,y,0,y+cell);g.addColorStop(0,odd?p.alternate:p.tile);g.addColorStop(1,p.well);studioRound(ctx,x+1.2,y+1.2,cell-2.4,cell-2.4,cell*.16);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#ffffff12';ctx.lineWidth=.65;ctx.stroke();ctx.fillStyle='#ffffff0c';studioRound(ctx,x+cell*.14,y+cell*.08,cell*.72,cell*.035,cell*.015);ctx.fill();}
  // inner shadow of the well
  g=ctx.createLinearGradient(0,pad-2,0,pad+cell*.6);g.addColorStop(0,'#0c0228aa');g.addColorStop(1,'#0c022800');ctx.fillStyle=g;ctx.fillRect(pad-2,pad-2,size-pad*2+4,cell*.6);
  for(const index of aim){if(index<0||index>=64)continue;studioRound(ctx,pad+index%8*cell+2,pad+Math.floor(index/8)*cell+2,cell-4,cell-4,cell*.16);ctx.fillStyle='#ffe58a3a';ctx.fill();ctx.strokeStyle='#ffe58a';ctx.lineWidth=1.6;ctx.stroke();}
  const paint=(tile,index,scale=1,alpha=1)=>{const x=pad+(tile.x??index%8)*cell+cell/2,y=pad+(tile.y??Math.floor(index/8))*cell+cell/2;ctx.save();ctx.globalAlpha=alpha;if(hint?.includes(index))scale*=1+Math.sin(time/150)*.06;drawStudioGem(ctx,x,y,cell*.98*scale,tile.c,tile.s,time);ctx.restore();};
  if(tiles){for(const tile of tiles.values())if(tile.alpha>0)paint(tile,board.findIndex(t=>t?.i===tile.id),tile.scale,Math.max(0,Math.min(1,tile.alpha)));}else board?.forEach((tile,index)=>{if(tile)paint(tile,index);});ctx.restore();
  const ring=(index,color,dash=false)=>{if(index<0)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=selection===index?3:1.8;if(dash)ctx.setLineDash([4,3]);ctx.shadowColor=color;ctx.shadowBlur=selection===index?10:0;studioRound(ctx,pad+index%8*cell+1.5,pad+Math.floor(index/8)*cell+1.5,cell-3,cell-3,cell*.16);ctx.stroke();ctx.restore();};if(focus)ring(cursor,'#9fe3ff',true);ring(selection,'#fff3b0');
  // Material grain is restricted to the rim; it never obscures a stone.
  ctx.save();ctx.globalAlpha=.18;ctx.strokeStyle=p.light;ctx.lineWidth=.6;
  for(let i=0;i<26;i++){const x=size*(i+.5)/26;ctx.beginPath();ctx.moveTo(x,3);ctx.lineTo(x+size*.014,pad-6);ctx.stroke();}
  ctx.restore();
  for(const [x,y] of [[pad*.48,pad*.48],[size-pad*.48,pad*.48],[pad*.48,size-pad*.48],[size-pad*.48,size-pad*.48]])studioSpark(ctx,x,y,size*.008,.8);
  ctx.restore();return{size,pad,cell};
}
export function drawStudioHero(ctx,width=840,height=570,time=0) {
  ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);
  const glow=ctx.createRadialGradient(0,0,0,0,0,width*.45);glow.addColorStop(0,'#b58bff52');glow.addColorStop(.55,'#a48bff18');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(-width/2,-height/2,width,height);
  ctx.save();ctx.rotate(-.27);for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,18,185+i*40,86+i*21,0,0,studioTAU);ctx.strokeStyle=i===0?'#d6c0ff57':'#d6c0ff20';ctx.lineWidth=i===0?2:1;ctx.stroke();}ctx.restore();
  const gems=[[-245,25,115,4,'',-.17],[-123,-109,148,1,'',.12],[63,-54,222,3,'',.08],[237,-8,118,0,'',.22],[-96,123,125,2,'',-.2],[120,137,145,5,'',.16],[-285,-121,54,2,'',.1],[277,127,55,4,'',-.2]];
  gems.forEach(([x,y,size,col,special,angle],i)=>{ctx.save();ctx.translate(x,y+Math.sin(time/1400+i)*4);ctx.rotate(angle);drawStudioGem(ctx,0,0,size,col,special,time);ctx.restore();});
  [[-183,113,10],[187,-137,12],[304,-60,7],[-43,-174,6],[27,171,7],[-305,61,5]].forEach(([x,y,r],i)=>studioSpark(ctx,x,y,r,.55+Math.sin(time/800+i)*.2));ctx.restore();
}

export function createJewelsRenderer({canvas,reduceMotion=()=>false,lightEffects=()=>false,onScore=()=>{},onCascade=()=>{},onSound=()=>{},onFrame=()=>{},raf=fn=>requestAnimationFrame(fn),caf=id=>cancelAnimationFrame(id),now=()=>performance.now()}={}) {
  const ctx=canvas.getContext('2d');
  const scene={board:[],tiles:new Map(),grid:[],size:400,dpr:1,pad:15,cell:46,selection:-1,cursor:0,hint:null,aim:[],focus:false,fx:[],parts:[],floaters:[],frame:0,shake:0};
  let epoch=0,animations=0;const pending=new Set();
  const active=token=>token===epoch;
  function setBoard(board){scene.board=board||[];scene.tiles.clear();scene.grid=[];scene.board.forEach((t,i)=>{if(!t)return;scene.tiles.set(t.i,{id:t.i,c:t.c,s:t.s,x:i%8,y:Math.floor(i/8),scale:1,alpha:1});scene.grid[i]=t.i;});invalidate();}
  function resize(size,dpr=1){scene.size=Math.max(200,Math.round(size));scene.dpr=Math.max(1,Math.min(lightEffects()?1.5:2.5,dpr));canvas.width=Math.round(scene.size*scene.dpr);canvas.height=Math.round(scene.size*scene.dpr);canvas.style.width=scene.size+'px';canvas.style.height=scene.size+'px';scene.pad=Math.round(scene.size*.038);scene.cell=(scene.size-2*scene.pad)/8;invalidate();return geometry();}
  function geometry(){return {size:scene.size,pad:scene.pad,cell:scene.cell};}
  function invalidate(){if(!scene.frame)scene.frame=raf(frame);}
  function frame(time){scene.frame=0;render(Number.isFinite(time)?time:now());if(animations||scene.fx.length||scene.parts.length||scene.floaters.length||(!reduceMotion()&&(scene.selection>=0||scene.hint)))invalidate();}
  function render(time=now()){
    const d=scene.dpr;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,scene.size,scene.size);ctx.save();
    if(scene.shake>0&&!reduceMotion()){ctx.translate(Math.sin(time*.12)*scene.shake,Math.cos(time*.14)*scene.shake*.55);scene.shake*=.8;if(scene.shake<.25)scene.shake=0;}
    drawStudioBoard(ctx,scene.board,scene.size,{selection:scene.selection,cursor:scene.cursor,focus:scene.focus,hint:scene.hint,aim:scene.aim,time,tiles:scene.tiles});drawEffects(time);ctx.restore();ctx.setTransform(1,0,0,1,0,0);onFrame();
  }
  function configure(options){Object.assign(scene,options);invalidate();}
  function cancel(){epoch++;for(const task of pending){caf(task.frame);task.resolve(false);}pending.clear();animations=0;scene.fx=[];scene.parts=[];scene.floaters=[];scene.selection=-1;scene.hint=null;scene.aim=[];scene.shake=0;invalidate();}
  function tween(ms,update,token=epoch){
    if(!active(token))return Promise.resolve(false);
    if(reduceMotion()||globalThis.document?.hidden){update(1);invalidate();return Promise.resolve(true);}
    animations++;invalidate();
    return new Promise(resolve=>{const task={resolve,frame:0},start=now();pending.add(task);const step=time=>{if(!active(token)){pending.delete(task);resolve(false);return;}const progress=Math.max(0,Math.min(1,(time-start)/ms));update(progress);invalidate();if(progress<1)task.frame=raf(step);else{pending.delete(task);animations--;resolve(true);}};task.frame=raf(step);});
  }
  const ease=t=>1-Math.pow(1-t,3);
  async function swap(a,b,back=false,token=epoch){const first=scene.tiles.get(scene.grid[a]),second=scene.tiles.get(scene.grid[b]);if(!first||!second)return false;const ax=a%8,ay=Math.floor(a/8),bx=b%8,by=Math.floor(b/8);onSound('swap');if(!await tween(150,t=>{const e=ease(t);first.x=ax+(bx-ax)*e;first.y=ay+(by-ay)*e;second.x=bx+(ax-bx)*e;second.y=by+(ay-by)*e;},token))return false;if(back){await tween(180,t=>{const e=ease(t);first.x=bx+(ax-bx)*e;first.y=by+(ay-by)*e;second.x=ax+(bx-ax)*e;second.y=ay+(by-ay)*e;},token);return active(token);}scene.grid[a]=second.id;scene.grid[b]=first.id;return true;}
  const center=index=>[scene.pad+(index%8+.5)*scene.cell,scene.pad+(Math.floor(index/8)+.5)*scene.cell];
  function burst(tile,count=7){if(reduceMotion())return;if(lightEffects())count=Math.min(count,3);const [x,y]=center(Math.round(tile.y)*8+Math.round(tile.x));for(let i=0;i<count;i++){const angle=(i/count)*studioTAU+Math.random()*.2;scene.parts.push({x,y,vx:Math.cos(angle)*(scene.cell*2.1+Math.random()*scene.cell*2),vy:Math.sin(angle)*scene.cell*2.4-scene.cell*1.7,color:GEM_COLORS[tile.c]?.light||'#fff',size:scene.cell*(.045+Math.random()*.055),born:now(),life:500+Math.random()*240,spin:Math.random()*10,star:i%3===0});}const cap=lightEffects()?60:220;if(scene.parts.length>cap)scene.parts.splice(0,scene.parts.length-cap);}
  function addFx([kind,index,color]){const t0=now(),base={index,t0,ms:420};if(kind==='rh'||kind==='rv')scene.fx.push({...base,kind:'beam',vertical:kind==='rv'});else if(kind==='cross'||kind==='bombline'){const deltas=kind==='bombline'?[-1,0,1]:[0];for(const d of deltas){scene.fx.push({...base,kind:'beam',index:index+d*8,vertical:false},{...base,kind:'beam',index:index+d,vertical:true});}}else if(kind==='pick')scene.fx.push({...base,kind:'ring',radius:.85});else if(/bomb|hammer/.test(kind))scene.fx.push({...base,kind:'ring',radius:kind==='bomb2'?3.2:1.8});else if(kind==='ball'||kind==='storm'){const col=kind==='storm'?scene.tiles.get(scene.grid[index])?.c:color,to=scene.board.map((t,i)=>t?.c===col?i:-1).filter(i=>i>=0);scene.fx.push({...base,kind:'arcs',to,color:GEM_COLORS[col]?.glow||'#f8e0ff'});}else if(kind==='all')scene.fx.push({...base,kind:'ring',radius:7});scene.shake=reduceMotion()||lightEffects()?0:Math.min(4,scene.cell*.055);invalidate();}
  function drawEffects(time){
    scene.fx=scene.fx.filter(f=>time-f.t0<f.ms);scene.parts=scene.parts.filter(p=>time-p.born<p.life);scene.floaters=scene.floaters.filter(p=>time-p.t0<950);
    for(const fx of scene.fx){const t=Math.max(0,(time-fx.t0)/fx.ms),a=1-t,[x,y]=center(fx.index);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=a;
      if(fx.kind==='beam'){const width=scene.cell*(.15+.48*a),length=scene.size*Math.min(1,t*4),grad=fx.vertical?ctx.createLinearGradient(x-width,0,x+width,0):ctx.createLinearGradient(0,y-width,0,y+width);grad.addColorStop(0,'#a9eeff00');grad.addColorStop(.35,'#a9eeff80');grad.addColorStop(.5,'#fff');grad.addColorStop(.65,'#ffd7f880');grad.addColorStop(1,'#ffd7f800');ctx.fillStyle=grad;if(fx.vertical)ctx.fillRect(x-width,y-length,width*2,length*2);else ctx.fillRect(x-length,y-width,length*2,width*2);}
      else if(fx.kind==='ring'){const radius=scene.cell*fx.radius*(.1+t);for(let ray=0;ray<(lightEffects()?4:12);ray++){const a=ray*studioTAU/12+t*.4;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*radius*.62,y+Math.sin(a)*radius*.62);ctx.lineTo(x+Math.cos(a)*radius*1.18,y+Math.sin(a)*radius*1.18);ctx.strokeStyle='#ffdba655';ctx.lineWidth=2;ctx.stroke();}ctx.beginPath();ctx.arc(x,y,radius,0,studioTAU);ctx.strokeStyle='#ffefda';ctx.lineWidth=scene.cell*.17*a+1;ctx.shadowColor='#ffb9da';ctx.shadowBlur=lightEffects()?0:20;ctx.stroke();}
      else if(fx.kind==='arcs'){ctx.strokeStyle=fx.color;ctx.lineWidth=2;ctx.shadowColor=fx.color;ctx.shadowBlur=lightEffects()?0:9;for(const i of fx.to){const[tx,ty]=center(i);ctx.beginPath();ctx.moveTo(x,y);const ox=Math.sin(i*12+time*.04)*scene.cell*.35;ctx.lineTo(x+(tx-x)*.33+ox,y+(ty-y)*.33-ox);ctx.lineTo(x+(tx-x)*.66-ox,y+(ty-y)*.66+ox);ctx.lineTo(tx,ty);ctx.stroke();studioSpark(ctx,tx,ty,scene.cell*.15*a);}}ctx.restore();
    }
    for(const part of scene.parts){const dt=Math.max(0,(time-part.born)/1000),alpha=1-(time-part.born)/part.life;ctx.save();ctx.globalAlpha=alpha;ctx.translate(part.x+part.vx*dt,part.y+part.vy*dt+scene.cell*7*dt*dt);ctx.rotate(dt*part.spin);ctx.fillStyle=part.color;if(part.star)studioSpark(ctx,0,0,part.size);else{studioPath(ctx,[[0,-part.size],[part.size*.65,0],[0,part.size],[-part.size*.65,0]]);ctx.fill();}ctx.restore();}
    for(const floater of scene.floaters){const t=(time-floater.t0)/950;ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*2.2);ctx.translate(floater.x,floater.y-scene.cell*t*.8);ctx.scale(1+Math.sin(Math.min(1,t*3)*Math.PI)*.14,1+Math.sin(Math.min(1,t*3)*Math.PI)*.14);ctx.textAlign='center';ctx.font=`900 ${Math.round(scene.cell*(floater.big?.59:.46))}px system-ui,sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='#45216c';ctx.strokeText(floater.text,0,0);ctx.fillStyle='#fff8dc';ctx.shadowColor='#ffbadb';ctx.shadowBlur=lightEffects()?0:12;ctx.fillText(floater.text,0,0);ctx.restore();}
  }
  async function animate(last,{skipSwap=false}={}){
    const token=epoch;if(!last?.before)return false;scene.selection=-1;scene.hint=null;scene.aim=[];setBoard(last.before);
    if(last.kind==='swap'){if(skipSwap){const a=scene.tiles.get(scene.grid[last.a]),b=scene.tiles.get(scene.grid[last.b]);if(a&&b){[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];[scene.grid[last.a],scene.grid[last.b]]=[scene.grid[last.b],scene.grid[last.a]];}}else if(!await swap(last.a,last.b,false,token))return false;}
    for(let k=0;k<(last.phases?.length||0);k++){
      if(!active(token))return false;const phase=last.phases[k];if(phase.shuffle){onCascade(phase.booster?'خلطة سحرية! ✨':'نرتّب فرصة جديدة',true);if(phase.booster)onSound('special',0);if(!await tween(phase.booster?260:180,t=>{for(const tile of scene.tiles.values()){tile.scale=1-t*.7;if(phase.booster)tile.alpha=1-t*.6;}},token))return false;setBoard(phase.board);
        // 33.10.5: «الخلطة» — the three gems it turns special pop in
        const grown=(phase.made||[]).map(([i])=>scene.tiles.get(scene.grid[i])).filter(Boolean);if(grown.length){grown.forEach(t=>{t.scale=0;burst(t,6);});onSound('made',0);if(!await tween(320,t=>{for(const tile of grown)tile.scale=Math.min(1.25,t*1.5)-Math.max(0,t-.7)*.8;},token))return false;grown.forEach(t=>{t.scale=1;});}continue;}
      (phase.fx||[]).forEach(addFx);const gone=(phase.clear||[]).map(i=>scene.tiles.get(scene.grid[i])).filter(Boolean);gone.forEach(t=>burst(t,gone.length>20?4:7));
      onSound(phase.fx?.length?'special':'match',k);if(phase.made?.length)onSound('made',k);
      if(phase.pts){const sum=(phase.clear||[]).reduce((v,i)=>[v[0]+i%8,v[1]+Math.floor(i/8)],[0,0]),count=Math.max(1,phase.clear.length);scene.floaters.push({text:'+'+phase.pts,x:scene.pad+(sum[0]/count+.5)*scene.cell,y:scene.pad+(sum[1]/count+.5)*scene.cell,t0:now(),big:phase.pts>=15||k>=2});}
      if(k>=1)onCascade(['','سلسلة جميلة!','يا سلام!','نتيجة مذهلة!','إبداع!'][Math.min(4,k)],false,k);
      if(!await tween(175,t=>{for(const tile of gone){tile.scale=1+.25*Math.sin(t*Math.PI);tile.alpha=1-t;}},token))return false;
      gone.forEach(tile=>scene.tiles.delete(tile.id));onScore(last.seat,phase.pts||0);
      const changes=[],made=new Set((phase.made||[]).map(([index])=>index)),fresh=Array(8).fill(0);phase.board.forEach((t,i)=>{if(!scene.tiles.has(t.i)&&!made.has(i))fresh[i%8]++;});
      phase.board.forEach((t,i)=>{const x=i%8,y=Math.floor(i/8);let tile=scene.tiles.get(t.i);if(!tile){tile={id:t.i,c:t.c,s:t.s,x,y:made.has(i)?y:y-fresh[x]-.4,scale:made.has(i)?0:1,alpha:1};scene.tiles.set(t.i,tile);}tile.c=t.c;tile.s=t.s;changes.push({tile,x0:tile.x,y0:tile.y,x,y,made:made.has(i)});});
      const distance=Math.max(1,...changes.map(m=>m.y-m.y0));scene.board=phase.board;
      if(!await tween(Math.min(390,170+distance*28),t=>{for(const m of changes){const e=t<.83?(t/.83)**2:1-Math.sin((t-.83)/.17*Math.PI)*.045;m.tile.x=m.x0+(m.x-m.x0)*e;m.tile.y=m.y0+(m.y-m.y0)*e;if(m.made)m.tile.scale=Math.min(1,t*2)*(1+Math.sin(t*Math.PI)*.13);}},token))return false;
      changes.forEach(m=>{m.tile.x=m.x;m.tile.y=m.y;m.tile.scale=1;m.tile.alpha=1;});scene.grid=phase.board.map(t=>t.i);
    }
    invalidate();return active(token);
  }
  return Object.freeze({setBoard,resize,geometry,configure,invalidate,cancel,animate,swap,render,get board(){return scene.board;},get selected(){return scene.selection;},get cursor(){return scene.cursor;},get hint(){return scene.hint;}});
}
