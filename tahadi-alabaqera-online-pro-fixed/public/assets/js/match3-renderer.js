import {GEM_COLORS} from './engines/match3-engine.js?v=18.0.0';
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>1-Math.pow(1-n,3);
const pathColors=['#62e7ba','#ffd35d','#b79aff','#ff83ad','#79d1ff','#ffac66'];
function gemPath(c,kind,r) {
  c.beginPath();
  if(kind===0){c.moveTo(0,-r);c.lineTo(r,0);c.lineTo(0,r);c.lineTo(-r,0);}
  else if(kind===1){c.moveTo(0,-r);c.lineTo(r*.94,r*.78);c.quadraticCurveTo(0,r*1.04,-r*.94,r*.78);}
  else if(kind===2){c.roundRect(-r*.82,-r*.82,r*1.64,r*1.64,r*.19);}
  else if(kind===3){c.arc(0,0,r*.89,0,Math.PI*2);}
  else if(kind===4){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=r*(i%2?.53:1);i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}}
  else {c.moveTo(-r*.74,-r*.65);c.lineTo(r*.74,-r*.65);c.lineTo(r,-r*.13);c.lineTo(0,r);c.lineTo(-r,-r*.13);}
  c.closePath();
}
export function paintGem(c,kind,special='',size=112) {
  const r=size*.34;c.save();c.translate(size/2,size/2);
  gemPath(c,kind,r);c.save();c.translate(0,size*.035);c.fillStyle='#080b23';c.fill();c.restore();
  const color=GEM_COLORS[kind],g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#ffffff');g.addColorStop(.16,color);g.addColorStop(.75,color);g.addColorStop(1,'#242449');c.fillStyle=g;c.fill();
  c.strokeStyle='#ffffff75';c.lineWidth=size*.025;c.stroke();
  c.save();gemPath(c,kind,r*.79);c.clip();
  c.beginPath();c.moveTo(-r,-r);c.lineTo(r,-r);c.lineTo(r*.45,-r*.2);c.lineTo(-r*.4,-r*.2);c.closePath();c.fillStyle='#ffffff42';c.fill();
  c.beginPath();c.moveTo(r,-r);c.lineTo(r,r);c.lineTo(0,r*.83);c.lineTo(r*.5,0);c.closePath();c.fillStyle='#0000001f';c.fill();
  c.restore();gemPath(c,kind,r*.75);c.strokeStyle='#17203c47';c.lineWidth=size*.018;c.stroke();
  c.beginPath();c.moveTo(-r*.48,-r*.51);c.lineTo(-r*.19,-r*.62);c.strokeStyle='#ffffffbf';c.lineWidth=size*.045;c.lineCap='round';c.stroke();
  if(special) {
    c.fillStyle='#102542';c.strokeStyle='#fff7d0';c.lineWidth=size*.038;c.lineJoin='round';
    if(special==='prism') {
      const prism=c.createLinearGradient(-r,-r,r,r);['#ff719c','#fce675','#65f0b3','#5fc8ff','#c69bff'].forEach((v,i)=>prism.addColorStop(i/4,v));
      gemPath(c,4,r*.98);c.fillStyle=prism;c.fill();c.stroke();c.fillStyle='#fff';c.font='900 '+size*.37+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('✦',0,0);
    } else if(special==='bomb') {
      c.beginPath();c.arc(0,size*.025,r*.48,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(0,-r*.4);c.quadraticCurveTo(r*.15,-r*.82,r*.4,-r*.53);c.stroke();
    } else {
      c.save();if(special==='column')c.rotate(Math.PI/2);c.beginPath();c.moveTo(-r*.65,0);c.lineTo(-r*.3,-r*.25);c.lineTo(-r*.3,-r*.09);c.lineTo(r*.3,-r*.09);c.lineTo(r*.3,-r*.25);c.lineTo(r*.65,0);c.lineTo(r*.3,r*.25);c.lineTo(r*.3,r*.09);c.lineTo(-r*.3,r*.09);c.lineTo(-r*.3,r*.25);c.closePath();c.fill();c.stroke();c.restore();
    }
  }
  c.restore();
}
export function animationPlan(events,reduced=false) {
  const duration=event=>event.type==='swap'?145:event.type==='clear'?170:event.type==='fall'?255:230;
  const total=events.reduce((n,e)=>n+duration(e),0),speed=Math.min(1,1850/Math.max(1,total));let at=0;
  return events.map(event=>{const d=reduced?0:duration(event)*speed,row={event,start:at,duration:d};at+=d;return row;});
}
export class BoardRenderer {
  constructor(canvas,{makeCanvas,raf=fn=>requestAnimationFrame(fn),caf=id=>cancelAnimationFrame(id),reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}) {
    this.canvas=canvas;this.c=canvas.getContext?.('2d',{alpha:false});this.makeCanvas=makeCanvas||((w,h)=>{const out=document.createElement('canvas');out.width=w;out.height=h;return out;});
    this.raf=raf;this.caf=caf;this.reduced=reduced;this.sprites=new Map();this.frame=0;this.state=null;this.selection=[];this.hover=-1;this.timeline=null;this.stats={frames:0,spriteBuilds:0};
  }
  sprite(gem) {const side=Math.round(this.canvas.width/(this.state?.size||7)),key=side+':'+gem.color+':'+gem.special;if(!this.sprites.has(key)){const image=this.makeCanvas(side,side);paintGem(image.getContext('2d'),gem.color,gem.special,side);this.sprites.set(key,image);this.stats.spriteBuilds++;}return this.sprites.get(key);}
  background(s) {
    const key=this.canvas.width+':'+s.size+':'+s.game;if(this.bgKey===key)return this.bg;
    const w=this.canvas.width,cell=w/s.size,bg=this.makeCanvas(w,w),c=bg.getContext('2d');
    c.fillStyle=s.game==='jewels'?'#161633':'#0c1e2b';c.fillRect(0,0,w,w);
    for(let i=0;i<s.size*s.size;i++){const x=i%s.size*cell,y=(i/s.size|0)*cell;c.fillStyle=(i%s.size+(i/s.size|0))%2?(s.game==='jewels'?'#22214b':'#142e3d'):(s.game==='jewels'?'#292654':'#193747');c.beginPath();c.roundRect(x+cell*.035,y+cell*.035,cell*.93,cell*.93,cell*.09);c.fill();}
    this.bgKey=key;this.bg=bg;return bg;
  }
  setState(state,selection=[],hover=-1) {this.state=state;this.selection=selection.slice();this.hover=hover;this.invalidate();}
  invalidate() {if(this.frame||!this.c)return;this.frame=this.raf(t=>{this.frame=0;this.paint(t);if(this.timeline)this.invalidate();});}
  cancel() {if(this.frame)this.caf(this.frame);this.frame=0;const timeline=this.timeline;this.timeline=null;timeline?.resolve(false);}
  snap() {const timeline=this.timeline;if(!timeline)return;this.cancel();this.selection=[];this.invalidate();}
  animate(events,state,onEvent=()=>{}) {
    this.cancel();this.state=state;this.selection=[];
    if(!this.c||this.reduced()){this.invalidate();return Promise.resolve(true);}
    return new Promise(resolve=>{this.timeline={plan:animationPlan(events),start:null,resolve,onEvent,index:-1};this.invalidate();});
  }
  point(i,s) {const cell=this.canvas.width/s.size;return {x:(i%s.size+.5)*cell,y:(Math.floor(i/s.size)+.5)*cell};}
  piece(gem,i,s,{x,y,scale=1,alpha=1}={}) {if(!gem||alpha<=0)return;const c=this.c,p=this.point(i,s),side=Math.round(this.canvas.width/s.size)*scale,sprite=this.sprite(gem),left=(x??p.x)-side/2,top=(y??p.y)-side/2;c.globalAlpha=alpha;if(scale===1)c.drawImage(sprite,left,top);else c.drawImage(sprite,left,top,side,side);c.globalAlpha=1;}
  ice(ice,s) {if(!ice)return;const c=this.c,cell=this.canvas.width/s.size;ice.forEach((layers,i)=>{if(!layers)return;const p=this.point(i,s);c.fillStyle=layers>1?'#87dcff51':'#88dfff28';c.strokeStyle='#b5e8ff75';c.lineWidth=cell*.022;c.beginPath();c.roundRect(p.x-cell*.45,p.y-cell*.45,cell*.9,cell*.9,cell*.1);c.fill();c.stroke();c.beginPath();c.moveTo(p.x-cell*.34,p.y-cell*.32);c.lineTo(p.x-cell*.14,p.y-cell*.4);c.stroke();});}
  settled(s) {
    if(this.staticBoard===s.board&&this.staticIce===s.ice&&this.staticWidth===this.canvas.width)return this.staticImage;
    const w=this.canvas.width,image=this.makeCanvas(w,w),display=this.c;this.c=image.getContext('2d');
    this.c.drawImage(this.background(s),0,0);this.ice(s.ice,s);s.board.forEach((gem,i)=>this.piece(gem,i,s));this.c=display;
    this.staticBoard=s.board;this.staticIce=s.ice;this.staticWidth=w;return this.staticImage=image;
  }
  paint(timestamp=0) {
    const s=this.state,c=this.c;if(!c||!s)return;this.stats.frames++;c.globalAlpha=1;const cell=this.canvas.width/s.size;
    if(s.game==='paths'){c.drawImage(this.background(s),0,0);this.paintPaths(s);return;}
    let step=null,p=1,timeline=this.timeline;
    if(timeline) {
      if(timeline.start===null)timeline.start=Number.isFinite(timestamp)?timestamp:0;
      const elapsed=(Number.isFinite(timestamp)?timestamp:timeline.start)-timeline.start;
      const index=timeline.plan.findIndex(row=>elapsed<row.start+row.duration);
      if(index<0){this.timeline=null;timeline.resolve(true);}
      else {step=timeline.plan[index].event;p=clamp((elapsed-timeline.plan[index].start)/timeline.plan[index].duration);if(index!==timeline.index){timeline.index=index;timeline.onEvent(step);}}
    }
    if(step){c.drawImage(this.background(s),0,0);this.ice(step.iceBefore||s.ice,s);}
    if(!step) {c.drawImage(this.settled(s),0,0);}
    else if(step.type==='swap') {
      const [a,b]=step.swap,e=ease(p);step.before.forEach((gem,i)=>{const from=this.point(i,s),to=this.point(i===a?b:i===b?a:i,s);this.piece(gem,i,s,{x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e});});
    } else if(step.type==='fall') {
      const moving=new Set(step.motions.map(m=>m.tile.id));step.after.forEach((gem,i)=>{if(gem&&!moving.has(gem.id))this.piece(gem,i,s);});
      c.save();c.beginPath();c.rect(0,0,this.canvas.width,this.canvas.height);c.clip();
      for(const motion of step.motions){const from=this.point(motion.from,s),to=this.point(motion.to,s),x=(motion.from%s.size+s.size)%s.size;from.x=(x+.5)*cell;const e=ease(p),bounce=p>.82?Math.sin((p-.82)/.18*Math.PI)*cell*.045:0;this.piece(motion.tile,motion.to,s,{x:to.x,y:from.y+(to.y-from.y)*e+bounce});}c.restore();
    } else if(step.type==='clear') {
      const removed=new Set(step.cleared);step.before.forEach((gem,i)=>this.piece(gem,i,s,removed.has(i)?{scale:1-ease(p)*.85,alpha:1-p}:{}));
      for(const item of step.created)this.piece(item.tile,item.cell,s,{scale:ease(p),alpha:p});
      c.lineCap='round';for(const activation of step.activated){const pos=this.point(activation.cell,s);c.globalAlpha=1-p;c.strokeStyle='#fff5be';c.lineWidth=cell*.08*(1-p);c.beginPath();if(activation.special==='row'||activation.special==='column'){activation.special==='row'?(c.moveTo(0,pos.y),c.lineTo(this.canvas.width,pos.y)):(c.moveTo(pos.x,0),c.lineTo(pos.x,this.canvas.width));}else c.arc(pos.x,pos.y,cell*(.3+p*1.7),0,Math.PI*2);c.stroke();}c.globalAlpha=1;
      // Fixed particle budget, no objects allocated per particle or gradient per frame.
      for(let n=0;n<Math.min(12,step.cleared.length);n++){const pos=this.point(step.cleared[n],s);c.fillStyle=GEM_COLORS[step.before[step.cleared[n]].color];c.globalAlpha=(1-p)*.9;for(let k=0;k<3;k++){const a=(n*1.7+k*2.1),distance=cell*p*.7;c.fillRect(pos.x+Math.cos(a)*distance,pos.y+Math.sin(a)*distance,cell*.035,cell*.035);}}c.globalAlpha=1;
    } else {step.after.forEach((gem,i)=>this.piece(gem,i,s,{scale:.7+.3*Math.abs(p*2-1),alpha:.45+.55*Math.abs(p*2-1)}));}
    if(!this.timeline)for(const i of [...this.selection,...(this.hover>=0?[this.hover]:[])]){const pos=this.point(i,s);c.strokeStyle='#fff3ae';c.lineWidth=cell*.045;c.beginPath();c.roundRect(pos.x-cell*.45,pos.y-cell*.45,cell*.9,cell*.9,cell*.12);c.stroke();}
  }
  paintPaths(s) {
    const c=this.c,cell=this.canvas.width/s.size,selection=this.selection,color=s.pairs.findIndex(pair=>pair.includes(selection[0]));
    const line=(path,tint,active=false)=>{if(path.length<2)return;c.beginPath();path.forEach((i,j)=>{const p=this.point(i,s);j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.lineWidth=cell*(active?.25:.23);c.lineJoin=c.lineCap='round';c.strokeStyle=tint;c.stroke();c.lineWidth=cell*.055;c.strokeStyle='#ffffff33';c.stroke();};
    for(const [key,path] of Object.entries(s.paths))if(!selection.length||+key!==color)line(path,pathColors[key]);
    if(selection.length)line(selection,pathColors[color]||'#fff',true);
    s.pairs.forEach((pair,i)=>pair.forEach(index=>{const p=this.point(index,s);c.beginPath();c.arc(p.x,p.y,cell*.29,0,Math.PI*2);c.fillStyle=pathColors[i];c.fill();c.lineWidth=cell*.035;c.strokeStyle='#ffffff9c';c.stroke();c.fillStyle='#12303a';c.font='800 '+cell*.26+'px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),p.x,p.y+cell*.015);}));
    if(this.hover>=0){const p=this.point(this.hover,s);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(p.x-cell*.43,p.y-cell*.43,cell*.86,cell*.86);}
  }
}
