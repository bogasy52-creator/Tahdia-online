/* Original cut-crystal artwork and a cancellable Canvas presentation layer.
   This module never decides a move: it replays the engine's before/phases record. */
export const GEM_COLORS = Object.freeze([
  { base:'#ff477d', light:'#ffe4ee', dark:'#9e134e', glow:'#ff86b5' },
  { base:'#ffcc38', light:'#fff8d0', dark:'#c46b08', glow:'#ffe884' },
  { base:'#25d8a6', light:'#d0fff0', dark:'#067a6d', glow:'#75ffda' },
  { base:'#37afff', light:'#d9f7ff', dark:'#175bc2', glow:'#84e1ff' },
  { base:'#af6aff', light:'#f4dfff', dark:'#6425bd', glow:'#d6a1ff' },
  { base:'#ff9252', light:'#ffead3', dark:'#c64035', glow:'#ffbc7a' },
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
function paintCrystal(ctx,x,y,size,color=0,special='',time=0) {
  const palette=GEM_COLORS[color]||GEM_COLORS[0],r=size*.4;
  ctx.save();ctx.translate(x,y);
  if(special==='ball'){
    ctx.save();ctx.shadowColor='#020912dd';ctx.shadowBlur=r*.25;ctx.shadowOffsetY=r*.16;ctx.beginPath();ctx.arc(0,0,r,0,studioTAU);ctx.fillStyle='#172347';ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(0,0,r*.91,0,studioTAU);ctx.clip();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;studioPath(ctx,[[0,-r*.12],[Math.cos(a)*r,Math.sin(a)*r],[Math.cos(a+Math.PI/6)*r,Math.sin(a+Math.PI/6)*r]]);const g=ctx.createLinearGradient(0,-r,0,r);g.addColorStop(0,GEM_COLORS[i%6].light);g.addColorStop(.25,GEM_COLORS[i%6].base);g.addColorStop(1,'#181641');ctx.fillStyle=g;ctx.fill();}
    const orb=ctx.createRadialGradient(-r*.3,-r*.4,0,0,0,r);orb.addColorStop(0,'#fffae1c9');orb.addColorStop(.25,'#ffffff19');orb.addColorStop(.55,'#19214522');orb.addColorStop(1,'#050d26cc');ctx.fillStyle=orb;ctx.fillRect(-r,-r,2*r,2*r);
    ctx.rotate(-.5);ctx.strokeStyle='#f7d1a8aa';ctx.lineWidth=r*.035;for(const n of[-.5,0,.5]){ctx.beginPath();ctx.ellipse(0,0,r*(1-Math.abs(n)*.2),r*(.25+Math.abs(n)*.4),n,0,studioTAU);ctx.stroke();}ctx.restore();ctx.strokeStyle='#efc88e';ctx.lineWidth=r*.035;ctx.beginPath();ctx.arc(0,0,r*.96,0,studioTAU);ctx.stroke();studioSpark(ctx,-r*.4,-r*.53,r*.19,.95);ctx.restore();return;
  }
  const points=studioPoints(color,r),inner=points.map(([px,py])=>[px*.55,py*.55-r*.1]);
  ctx.save();ctx.shadowColor='#0c0738a0';ctx.shadowBlur=r*.24;ctx.shadowOffsetY=r*.17;studioPath(ctx,points.map(([px,py])=>[px,py+r*.07]));ctx.fillStyle=palette.dark;ctx.fill();ctx.restore();
  let grad=ctx.createLinearGradient(-r*.65,-r,r*.65,r);grad.addColorStop(0,palette.light);grad.addColorStop(.24,palette.base);grad.addColorStop(.68,palette.base);grad.addColorStop(1,palette.dark);
  studioPath(ctx,points);ctx.fillStyle=grad;ctx.fill();
  points.forEach((point,i)=>{
    const next=(i+1)%points.length;studioPath(ctx,[point,points[next],inner[next],inner[i]]);
    const shade=ctx.createLinearGradient(point[0],point[1],inner[i][0],inner[i][1]);
    const top=(point[1]+points[next][1])/2<-r*.15;
    shade.addColorStop(0,top?'#ffffffe3':'#ffffff10');shade.addColorStop(.46,top?'#ffffff6b':(i%2?'#ffffff12':'#4c12583d'));shade.addColorStop(1,top?'#ffffff08':'#160a4352');ctx.fillStyle=shade;ctx.fill();
    ctx.strokeStyle=top?'#ffffff6b':'#ffffff24';ctx.lineWidth=Math.max(.5,r*.018);ctx.stroke();
    const mid=[(point[0]+points[next][0])/2,(point[1]+points[next][1])/2];
    studioPath(ctx,[point,mid,inner[i]]);ctx.fillStyle=top?'#fff9e56b':i%2?'#b5eaff2b':'#050d355c';ctx.fill();
    studioPath(ctx,[inner[i],inner[next],[r*.09,-r*.12]]);ctx.fillStyle=i%3===0?'#fff4c925':i%3===1?'#070e3c38':'#bcefff25';ctx.fill();

  });
  grad=ctx.createLinearGradient(-r*.4,-r*.7,r*.45,r*.65);grad.addColorStop(0,palette.light);grad.addColorStop(.28,palette.base);grad.addColorStop(.75,palette.base);grad.addColorStop(1,palette.dark);studioPath(ctx,inner);ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#ffffff5c';ctx.lineWidth=r*.025;ctx.stroke();
  ctx.save();studioPath(ctx,points);ctx.clip();grad=ctx.createRadialGradient(-r*.43,-r*.57,0,-r*.43,-r*.57,r*.75);grad.addColorStop(0,'#ffffffb8');grad.addColorStop(.4,'#ffffff24');grad.addColorStop(1,'#ffffff00');ctx.fillStyle=grad;ctx.fillRect(-r,-r,r*2,r*2);
  ctx.beginPath();ctx.moveTo(-r*.8,-r*.38);ctx.quadraticCurveTo(-r*.15,-r*.89,r*.36,-r*.64);ctx.strokeStyle='#ffffffad';ctx.lineWidth=r*.065;ctx.lineCap='round';ctx.stroke();ctx.restore();
  studioPath(ctx,points);ctx.strokeStyle='#ffffff84';ctx.lineWidth=Math.max(.7,r*.033);ctx.stroke();
  if(special==='rh'||special==='rv'){
    ctx.save();if(special==='rh')ctx.rotate(Math.PI/2);ctx.shadowColor='#061129b0';ctx.shadowBlur=r*.1;ctx.shadowOffsetY=r*.08;
    studioPath(ctx,[[0,-r*.71],[r*.17,-r*.32],[r*.14,r*.36],[0,r*.5],[-r*.14,r*.36],[-r*.17,-r*.32]]);
    const g=ctx.createLinearGradient(-r*.17,0,r*.17,0);g.addColorStop(0,'#807665');g.addColorStop(.3,'#fff4d4');g.addColorStop(.53,'#fffef4');g.addColorStop(1,'#9bb5bc');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#fff9dc';ctx.lineWidth=r*.025;ctx.stroke();
    studioPath(ctx,[[0,-r*.71],[r*.17,-r*.32],[-r*.17,-r*.32]]);ctx.fillStyle='#edb55d';ctx.fill();for(const dir of[-1,1]){studioPath(ctx,[[dir*r*.11,r*.1],[dir*r*.35,r*.43],[dir*r*.1,r*.35]]);ctx.fillStyle='#f4ce82';ctx.fill();}studioPath(ctx,[[-r*.09,r*.36],[0,r*.77],[r*.09,r*.36]]);ctx.fillStyle='#fff1a7';ctx.fill();ctx.restore();
  }else if(special==='bomb'){
    ctx.save();ctx.shadowColor='#0b0e27b0';ctx.shadowBlur=r*.15;ctx.shadowOffsetY=r*.1;const g=ctx.createRadialGradient(-r*.12,-r*.2,0,0,0,r*.49);g.addColorStop(0,'#fff1c6');g.addColorStop(.35,'#dec07b');g.addColorStop(.7,'#7f6739');g.addColorStop(1,'#efe0a6');ctx.beginPath();ctx.arc(0,0,r*.49,0,studioTAU);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(0,0,r*.35,0,studioTAU);ctx.fillStyle='#1a243a';ctx.fill();ctx.strokeStyle='#fff1b6';ctx.lineWidth=r*.025;ctx.stroke();studioSpark(ctx,0,0,r*.24,.95);ctx.restore();
  }
  studioSpark(ctx,-r*.43,-r*.58,r*.13,.92);ctx.restore();
}
const crystalAtlas=new Map();
export function drawStudioGem(ctx,x,y,size,color=0,special='',time=0){
  const key=color+':'+special;let atlas=crystalAtlas.get(key);
  if(!atlas){atlas=globalThis.document?.createElement?.('canvas')||(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(224,224):null);if(atlas){atlas.width=atlas.height=224;paintCrystal(atlas.getContext('2d'),112,106,224,color,special,time);crystalAtlas.set(key,atlas);if(crystalAtlas.size>32)crystalAtlas.delete(crystalAtlas.keys().next().value);}}
  if(atlas)ctx.drawImage(atlas,x-size/2,y-size*.473,size,size);else paintCrystal(ctx,x,y,size,color,special,time);
  if(special)studioSpark(ctx,x+size*.25,y-size*.28,size*.045,.35+Math.sin(time*.003+x*.01)*.2);
}
export function drawBoosterIcon(canvas,index,size=112) {
  canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);const s=size/100;ctx.save();ctx.scale(s,s);ctx.translate(50,50);ctx.lineJoin='round';ctx.lineCap='round';
  if(index===0){ctx.rotate(-.48);ctx.shadowColor='#60154766';ctx.shadowBlur=5;ctx.shadowOffsetY=4;studioRound(ctx,-5,-4,10,38,4);ctx.fillStyle='#d97b49';ctx.fill();studioRound(ctx,-23,-24,46,26,8);const gr=ctx.createLinearGradient(0,-24,0,2);gr.addColorStop(0,'#ffe9f0');gr.addColorStop(.3,'#ff6d9e');gr.addColorStop(1,'#d62b6c');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#fff3fa';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffffff9c';studioRound(ctx,-17,-20,10,17,4);ctx.fill();}
  else if(index===1){ctx.rotate(-.65);for(const dx of [-12,12]){ctx.save();ctx.translate(dx,0);studioPath(ctx,[[0,-31],[9,-11],[7,18],[-7,18],[-9,-11]]);const gr=ctx.createLinearGradient(-8,0,8,0);gr.addColorStop(0,'#dffbff');gr.addColorStop(.4,'#8ce6ff');gr.addColorStop(1,'#329ce3');ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();studioPath(ctx,[[-7,13],[-12,23],[0,18],[12,23],[7,13]]);ctx.fillStyle='#7ccfff';ctx.fill();studioPath(ctx,[[-4,20],[0,35],[4,20]]);ctx.fillStyle='#ffd071';ctx.fill();ctx.restore();}}
  else {for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,(i-1)*10,26-i*5,9,0,Math.PI*.1,Math.PI*1.85);ctx.strokeStyle=['#e8ceff','#cb8cff','#a568fa'][i];ctx.lineWidth=8-i;ctx.stroke();}studioSpark(ctx,17,-25,8);studioSpark(ctx,-17,14,5);}
  ctx.restore();
}
export function drawStudioBoard(ctx,board,size,{selection=-1,cursor=-1,focus=false,hint=null,aim=[],time=0,tiles=null}={}){
  const pad=Math.round(size*.038),cell=(size-pad*2)/8;ctx.clearRect(0,0,size,size);ctx.save();
  let g=ctx.createLinearGradient(0,0,size,size);g.addColorStop(0,'#f3dc9c');g.addColorStop(.18,'#97835d');g.addColorStop(.42,'#4a4c51');g.addColorStop(.72,'#968365');g.addColorStop(1,'#e8c98c');studioRound(ctx,1,1,size-2,size-2,size*.046);ctx.fillStyle=g;ctx.fill();
  studioRound(ctx,3,3,size-6,size-6,size*.043);ctx.fillStyle='#172136';ctx.fill();ctx.strokeStyle='#e4cf9b80';ctx.lineWidth=1;ctx.stroke();g=ctx.createLinearGradient(0,0,0,size);g.addColorStop(0,'#344057');g.addColorStop(.25,'#172236');g.addColorStop(.7,'#111b2d');g.addColorStop(1,'#475064');studioRound(ctx,7,7,size-14,size-14,size*.037);ctx.fillStyle=g;ctx.fill();
  studioRound(ctx,pad-4,pad-4,size-pad*2+8,size-pad*2+8,size*.019);ctx.fillStyle='#030b19';ctx.fill();ctx.strokeStyle='#d9bb783f';ctx.lineWidth=1;ctx.stroke();ctx.save();studioRound(ctx,pad-1,pad-1,size-pad*2+2,size-pad*2+2,size*.015);ctx.clip();
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){const x=pad+col*cell,y=pad+row*cell;g=ctx.createLinearGradient(0,y,0,y+cell);g.addColorStop(0,'#07101f');g.addColorStop(.2,(row+col)%2?'#101d31':'#0d182b');g.addColorStop(1,(row+col)%2?'#1d2a43':'#17263d');studioRound(ctx,x+1,y+1,cell-2,cell-2,cell*.12);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#9bafc615';ctx.lineWidth=.6;ctx.stroke();ctx.beginPath();ctx.moveTo(x+cell*.2,y+cell-2);ctx.lineTo(x+cell*.8,y+cell-2);ctx.strokeStyle='#91b8dd16';ctx.stroke();}
  for(const index of aim){if(index<0||index>=64)continue;studioRound(ctx,pad+index%8*cell+2,pad+Math.floor(index/8)*cell+2,cell-4,cell-4,cell*.12);ctx.fillStyle='#e5c98328';ctx.fill();ctx.strokeStyle='#efdb9f';ctx.lineWidth=1.3;ctx.stroke();}
  const paint=(tile,index,scale=1,alpha=1)=>{const x=pad+(tile.x??index%8)*cell+cell/2,y=pad+(tile.y??Math.floor(index/8))*cell+cell/2;ctx.save();ctx.globalAlpha=alpha;if(hint?.includes(index))scale*=1+Math.sin(time/150)*.045;drawStudioGem(ctx,x,y,cell*.98*scale,tile.c,tile.s,time);ctx.restore();};
  if(tiles){for(const tile of tiles.values())if(tile.alpha>0)paint(tile,board.findIndex(t=>t?.i===tile.id),tile.scale,Math.max(0,Math.min(1,tile.alpha)));}else board?.forEach((tile,index)=>{if(tile)paint(tile,index);});ctx.restore();
  const ring=(index,color,dash=false)=>{if(index<0)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=selection===index?2.2:1.5;if(dash)ctx.setLineDash([4,3]);ctx.shadowColor=color;ctx.shadowBlur=selection===index?8:0;studioRound(ctx,pad+index%8*cell+1.5,pad+Math.floor(index/8)*cell+1.5,cell-3,cell-3,cell*.13);ctx.stroke();ctx.restore();};if(focus)ring(cursor,'#a7dfff',true);ring(selection,'#ffe6a5');
  for(const x of[pad*.49,size-pad*.49])for(const y of[pad*.5,size-pad*.5]){ctx.fillStyle='#19253c';ctx.beginPath();ctx.arc(x,y,size*.009,0,studioTAU);ctx.fill();ctx.strokeStyle='#d9bc7b';ctx.lineWidth=.8;ctx.stroke();studioSpark(ctx,x,y,size*.005,.7);}ctx.restore();return{size,pad,cell};
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
  function addFx([kind,index,color]){const t0=now(),base={index,t0,ms:420};if(kind==='rh'||kind==='rv')scene.fx.push({...base,kind:'beam',vertical:kind==='rv'});else if(kind==='cross'||kind==='bombline'){const deltas=kind==='bombline'?[-1,0,1]:[0];for(const d of deltas){scene.fx.push({...base,kind:'beam',index:index+d*8,vertical:false},{...base,kind:'beam',index:index+d,vertical:true});}}else if(/bomb|hammer/.test(kind))scene.fx.push({...base,kind:'ring',radius:kind==='bomb2'?3.2:1.8});else if(kind==='ball'||kind==='storm'){const col=kind==='storm'?scene.tiles.get(scene.grid[index])?.c:color,to=scene.board.map((t,i)=>t?.c===col?i:-1).filter(i=>i>=0);scene.fx.push({...base,kind:'arcs',to,color:GEM_COLORS[col]?.glow||'#f8e0ff'});}else if(kind==='all')scene.fx.push({...base,kind:'ring',radius:7});scene.shake=reduceMotion()||lightEffects()?0:Math.min(4,scene.cell*.055);invalidate();}
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
      if(!active(token))return false;const phase=last.phases[k];if(phase.shuffle){onCascade('نرتّب فرصة جديدة',true);if(!await tween(180,t=>{for(const tile of scene.tiles.values())tile.scale=1-t*.7;},token))return false;setBoard(phase.board);continue;}
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
