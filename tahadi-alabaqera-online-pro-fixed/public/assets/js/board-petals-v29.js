import {boardGeometry,boardStonePosition,stoneOffset} from './engines/board-geometry-v29.js';
/* Tahdia 31.0.0 — the Zahra and Jackaroo tables (file name kept for imports).
   Zahra: a classic cross board — coloured yards, a cream track, home lanes and
   a flower in the centre — with glossy standing stones.
   Jackaroo: a wood-and-felt ring board with carved holes, side pockets and
   glass marbles. The equipped table from the shop changes the materials.
   SVG units: a 200 × 200 view box. */
export const BOARD_COLORS=['#e0474c','#2f86e8','#f0b429','#22a565','#8b5cf6','#f2711c'];
const NS='http://www.w3.org/2000/svg',motionHistory=new WeakMap(),surfaces=new Map();let sequence=0;
const THEMES={
  walnut:{label:'#ffffff',medal:'#e9c27a',frame:['#c48a52','#7a4a24','#3f230d'],rim:'#e9c27a',surface:'#fbf4e3',cell:'#fffaf0',line:'#d9c7a2',ink:'#4a3018',felt:['#2c7a59','#1f5f45','#123b2b'],hole:'#0d2a1f',holeRim:'#c9a46a',plate:'#fff8e6'},
  ivory:{label:'#5a4520',medal:'#8d6a27',frame:['#fff3d0','#d8b46a','#8d6a27'],rim:'#c9a24f',surface:'#fdfbf6',cell:'#ffffff',line:'#e4d6b8',ink:'#5a4520',felt:['#f6efdf','#e9dcc0','#cdbb94'],hole:'#7d6a45',holeRim:'#caa660',plate:'#fffdf7'},
  carbon:{label:'#d9f6ff',medal:'#55e1ff',frame:['#3b5a74','#16293b','#070f18'],rim:'#55e1ff',surface:'#12253a',cell:'#1a3149',line:'#2f5574',ink:'#d9f6ff',felt:['#1d3a55','#14283d','#0a1626'],hole:'#050c14',holeRim:'#55e1ff',plate:'#1b3550'},
  jade:{label:'#ffffff',medal:'#e9d39a',frame:['#7fc7a6','#2d6e57','#123b2e'],rim:'#e9d39a',surface:'#f1f8f2',cell:'#ffffff',line:'#bfdcc9',ink:'#1e4a3a',felt:['#3f8a6d','#2c6a55','#174334'],hole:'#0f2b22',holeRim:'#e9d39a',plate:'#f6fff9'},
  royal:{label:'#ffffff',medal:'#f1cf7d',frame:['#b08ad8','#4a2f66','#21122f'],rim:'#f1cf7d',surface:'#f8f3fc',cell:'#ffffff',line:'#dccbea',ink:'#3a2452',felt:['#5d3d80','#4a2f66','#2a183c'],hole:'#1a0f26',holeRim:'#f1cf7d',plate:'#fbf7ff'}
};
const MATERIALS={'table-club':'walnut','table-walnut':'walnut','table-gallery':'ivory','table-nocturne':'carbon','table-midnight':'carbon','table-cyber':'carbon','table-slate':'carbon','table-botanic':'jade','table-emerald':'jade','table-royal':'royal'};
const KINDS={'pawn-atlas':'atlas','pawn-rook':'rook','pawn-orbit':'orbit','pawn-lance':'lance','pawn-lotus':'lotus','pawn-monolith':'monolith','pawn-orb':'orb','pawn-crown':'crown','pawn-prism':'monolith','pawn-gold':'crown','pawn-jade':'gem','pawn-amethyst':'gem','pawn-onyx':'rook','pawn-classic':'classic'};
const LEGACY_KINDS={spire:'atlas',rook:'rook',orbit:'orbit',lance:'lance',lotus:'lotus',monolith:'monolith'};
const n=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)el.setAttribute(k,String(v));if(text!==undefined)el.textContent=String(text);return el;};
const xy=p=>p.x+' '+p.y,paint=id=>'url(#'+id+')';
const reduce=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
const equipped=type=>globalThis.BS_CAREER?.get?.()?.equipped?.[type]||document.documentElement?.dataset?.[type]||'';
const pieces=()=>globalThis.BS_PIECES;
function rgb(hex){const h=String(hex).replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0);}
function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}

/* ---------- Player names ---------- */
// A name gets the room its seat has: it shrinks a little, then wraps onto two
// lines (where the seat has height for it), then ends in an ellipsis. Widths
// come from the browser's own text metrics; without a canvas (tests) a
// generous estimate is used.
let ruler;
function nameWidth(text,size){
  if(ruler===undefined){try{ruler=globalThis.document?.createElement?.('canvas')?.getContext?.('2d')||null;}catch{ruler=null;}}
  if(ruler){let w=0;for(const font of ['800 100px Tajawal, Arial, sans-serif','800 100px Arial, sans-serif']){ruler.font=font;w=Math.max(w,ruler.measureText(text).width||0);}if(w>0)return w/100*size;}
  let w=0;for(const ch of text)w+=/\s/.test(ch)?.3:/[A-Z؀-ۿ]/.test(ch)?.66:.6;return w*size;
}
function clipName(text,room,size){
  if(nameWidth(text,size)<=room)return text;
  const chars=[...text];
  while(chars.length>1&&nameWidth(chars.join('').trimEnd()+'…',size)>room)chars.pop();
  return chars.join('').trimEnd()+'…';
}
export function fitName(text,room,size,maxLines=1){
  text=String(text||'').trim();
  if(!text)return {lines:[],size,width:0};
  const full=nameWidth(text,size);
  if(full<=room)return {lines:[text],size,width:full};
  const floor=size*.8,single=Math.max(floor,size*room/full);
  if(nameWidth(text,single)<=room+1e-6)return {lines:[text],size:single,width:nameWidth(text,single)};
  const words=text.split(/\s+/);
  if(maxLines>1&&words.length>1){
    let best=null;
    for(let i=1;i<words.length;i++){const a=words.slice(0,i).join(' '),b=words.slice(i).join(' '),w=Math.max(nameWidth(a,1),nameWidth(b,1));if(!best||w<best.w)best={a,b,w};}
    const s=Math.max(floor,Math.min(size*.92,room/best.w)),lines=[clipName(best.a,room,s),clipName(best.b,room,s)];
    return {lines,size:s,width:Math.max(...lines.map(l=>nameWidth(l,s)))};
  }
  const line=clipName(text,room,floor);
  return {lines:[line],size:floor,width:nameWidth(line,floor)};
}
// Very long names are cut before measuring; the board shows what fits.
function playerLabel(p){const chars=[...String(p?.name||'').trim()];return chars.length>32?chars.slice(0,31).join('').trimEnd()+'…':chars.join('');}
// cy is the middle of the name block.
function nameText(x,cy,fit,attrs={}){
  const size=+fit.size.toFixed(2),lines=fit.lines.length?fit.lines:[''],lh=size*1.12;
  const t=n('text',{x:+x.toFixed(2),'text-anchor':'middle','font-size':size,'font-weight':800,'font-family':'Tajawal,Arial,sans-serif',...attrs});
  if(lines.length===1){t.setAttribute('y',(cy+size*.34).toFixed(2));t.textContent=lines[0];return t;}
  lines.forEach((line,i)=>t.append(n('tspan',{x:+x.toFixed(2),y:(cy+(i-(lines.length-1)/2)*lh+size*.34).toFixed(2)},line)));
  return t;
}

/* ---------- Geometry ---------- */
// Zahra: arms of three cells around the centre. Index order runs clockwise;
// seat s starts on the second cell of its arm and enters its lane from the
// cell before its start (the classic layout of the original 15 × 15 board).
function crossLayout(seats){
  const six=seats===6,c=six?10.7:12.8,R0=six?3*c:2*c,C={x:100,y:100};
  const angle=s=>Math.PI+s*2*Math.PI/seats,dir=s=>({dx:Math.cos(angle(s)),dy:Math.sin(angle(s)),px:-Math.sin(angle(s)),py:Math.cos(angle(s))});
  const at=(s,u,v)=>{const d=dir(s),r=R0+u*c;return {x:C.x+d.dx*r+d.px*v*c,y:C.y+d.dy*r+d.py*v*c,a:angle(s)};};
  const track=[],T=seats*13;
  for(let g=0;g<T;g++){const k=(g+1)%T,arm=Math.floor(k/13)%seats,l=k%13;track.push(l<=5?{...at(arm,5-l,1),arm}:l<=11?{...at((arm+1)%seats,l-6,-1),arm:(arm+1)%seats}:{...at((arm+1)%seats,5,0),arm:(arm+1)%seats});}
  const lanes=Array.from({length:seats},(_,s)=>[4,3,2,1].map(u=>at(s,u,0)));
  const gates=Array.from({length:seats},(_,s)=>at(s,0,0));
  const finish=Array.from({length:seats},(_,s)=>{const d=dir(s),r=six?R0*.48:c*.95;return {x:C.x+d.dx*r,y:C.y+d.dy*r};});
  const yards=Array.from({length:seats},(_,s)=>{
    if(!six){const a=angle(s)+Math.PI/4,dist=Math.SQRT2*4.5*c;return {kind:'square',x:C.x+Math.cos(a)*dist,y:C.y+Math.sin(a)*dist,size:6*c};}
    const a=angle(s)+Math.PI/6,rho=6.75*c;return {kind:'circle',x:C.x+Math.cos(a)*rho,y:C.y+Math.sin(a)*rho,r:1.72*c};
  });
  const bases=yards.map(y=>{const g=y.kind==='square'?c*1.15:y.r*.47;return [[-1,-1],[1,-1],[-1,1],[1,1]].map(([i,j])=>({x:y.x+i*g,y:y.y+j*g}));});
  return {kind:'cross',seats,c,R0,C,track,lanes,gates,finish,yards,bases,angle};
}
// Jackaroo: a ring of holes; each seat has a pocket outside and a lane inside.
function ringLayout(seats){
  const T=seats*13,four=seats===4,C={x:100,y:100};
  const seatAngle=s=>s*2*Math.PI/seats-Math.PI/2;
  const polar=(a,r)=>({x:C.x+Math.cos(a)*r,y:C.y+Math.sin(a)*r});
  const track=Array.from({length:T},(_,i)=>{const a=i*2*Math.PI/T-Math.PI/2,co=Math.cos(a),si=Math.sin(a),r=four?55/Math.pow(co**4+si**4,.25):56;return {...polar(a,r),a};});
  const lanes=Array.from({length:seats},(_,s)=>[0,1,2,3].map(h=>polar(seatAngle(s),40-h*7.4)));
  const finish=Array.from({length:seats},(_,s)=>polar(seatAngle(s),10.5));
  const pockets=Array.from({length:seats},(_,s)=>{const a=seatAngle(s),p=polar(a,four?83:84);return {x:p.x,y:p.y,a};});
  const bases=pockets.map(p=>{const t=p.a+Math.PI/2;return [-1.5,-.5,.5,1.5].map(k=>({x:p.x+Math.cos(t)*k*6.6,y:p.y+Math.sin(t)*k*6.6}));});
  return {kind:'ring',seats,C,track,lanes,finish,pockets,bases,seatAngle,hole:2.55};
}
const layouts=new Map();
function layoutFor(game,seats){const key=game+seats;if(!layouts.has(key))layouts.set(key,game==='jackaroo'?ringLayout(seats):crossLayout(seats));return layouts.get(key);}
function rawPoint(state,seat,index,progress,game){
  const g=boardGeometry(state),L=layoutFor(game,g.seats);
  if(progress<0)return L.bases[seat][index%4];
  if(progress>=g.track)return progress>=g.finish?L.finish[seat]:L.lanes[seat][Math.min(3,progress-g.track)];
  return L.track[boardStonePosition(seat,progress,state)];
}
export function petalStonePoint(state,seat,index,game='zahra'){
  const g=boardGeometry(state),list=state.players[seat].tokens||state.players[seat].marbles,value=list[index],p=rawPoint(state,seat,index,value,game);
  if(value<0)return {x:p.x,y:p.y};
  const stack=[];
  state.players.forEach((player,pi)=>(player.tokens||player.marbles).forEach((v,ti)=>{if(value<g.track?boardStonePosition(pi,v,state)===boardStonePosition(seat,value,state):pi===seat&&v===value)stack.push(pi+':'+ti);}));
  const o=stoneOffset(stack.indexOf(seat+':'+index),stack.length,Math.min(4.2,1.9+stack.length*.5));
  return {x:p.x+o.x,y:p.y+o.y};
}

/* ---------- Painting helpers ---------- */
function gradient(defs,id,stops,x2=1,y2=1){const g=n('linearGradient',{id,x1:0,y1:0,x2,y2});stops.forEach(([o,c])=>g.append(n('stop',{offset:o,'stop-color':c})));defs.append(g);return paint(id);}
function radial(defs,id,stops,cx=.5,cy=.5,r=.5){const g=n('radialGradient',{id,cx,cy,r});stops.forEach(([o,c,a])=>g.append(n('stop',{offset:o,'stop-color':c,'stop-opacity':a??1})));defs.append(g);return paint(id);}
function star(cx,cy,r){let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?'L':'M')+(cx+Math.cos(a)*rr).toFixed(2)+' '+(cy+Math.sin(a)*rr).toFixed(2);}return d+'Z';}
function rotRect(p,w,h,a,attrs){return n('rect',{x:p.x-w/2,y:p.y-h/2,width:w,height:h,rx:Math.min(w,h)*.18,transform:a?`rotate(${(a*180/Math.PI).toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`:null,...attrs});}
function arrow(p,a,size,fill){const t=a,dx=Math.cos(t),dy=Math.sin(t),px=-dy,py=dx;return n('path',{d:`M${p.x+dx*size} ${p.y+dy*size}L${p.x-dx*size*.6+px*size*.75} ${p.y-dy*size*.6+py*size*.75}L${p.x-dx*size*.6-px*size*.75} ${p.y-dy*size*.6-py*size*.75}Z`,fill});}

function drawCross(svg,defs,prefix,state,L,theme,active){
  const seats=L.seats,c=L.c,names=state.players.map(playerLabel);
  const frame=gradient(defs,prefix+'-frame',[[0,theme.frame[0]],[.3,theme.frame[1]],[1,theme.frame[2]]]);
  if(seats===4){
    svg.append(n('rect',{x:1,y:2.6,width:198,height:198,rx:9,fill:'#000',opacity:.28}),n('rect',{x:1,y:1,width:198,height:198,rx:9,fill:frame}),
      n('rect',{x:1.5,y:1.5,width:197,height:197,rx:8.6,fill:'none',stroke:'#ffffff','stroke-width':.6,opacity:.28}),
      n('rect',{x:3.4,y:3.4,width:193.2,height:193.2,rx:6,fill:theme.surface,stroke:theme.rim,'stroke-width':.7}),
      n('rect',{x:3.4,y:3.4,width:193.2,height:193.2,rx:6,fill:radial(defs,prefix+'-vignette',[[0,'#ffffff',.0],[.72,'#000000',0],[1,'#000000',.16]],.42,.38,.75)}));
  }else{
    // A round table: six arms and six yards all reach the rim.
    svg.append(n('circle',{cx:100,cy:101.6,r:99,fill:'#000',opacity:.28}),n('circle',{cx:100,cy:100,r:99,fill:frame}),n('circle',{cx:100,cy:100,r:95.4,fill:theme.surface,stroke:theme.rim,'stroke-width':.7}));
  }
  // Yards.
  for(let s=0;s<seats;s++){
    const y=L.yards[s],color=BOARD_COLORS[s],live=s<state.players.length,on=s===active,fill=gradient(defs,`${prefix}-yard-${s}`,[[0,mix(color,'#ffffff',.18)],[1,mix(color,'#000000',.22)]]);
    const g=n('g',{'data-yard':s,'data-active':String(on),opacity:live?1:.38});
    if(y.kind==='square'){
      const x=y.x-y.size/2,yy=y.y-y.size/2;
      g.append(n('rect',{x:x+.6,y:yy+1.2,width:y.size-1.2,height:y.size-1.2,rx:4,fill:'#000',opacity:.18}));
      g.append(n('rect',{x:x+.6,y:yy+.6,width:y.size-1.2,height:y.size-1.2,rx:4,fill}));
      g.append(n('rect',{x:x+1.1,y:yy+1.1,width:y.size-2.2,height:y.size-2.2,rx:3.6,fill:'none',stroke:'#ffffff','stroke-width':.55,opacity:.38}));
      g.append(n('rect',{x:x+c*.9,y:yy+c*.9,width:y.size-c*1.8,height:y.size-c*1.8,rx:5,fill:theme.plate,stroke:mix(color,'#000000',.15),'stroke-width':.5}));
      g.append(n('rect',{x:x+c*.9,y:yy+c*.9,width:y.size-c*1.8,height:y.size-c*1.8,rx:5,fill:gradient(defs,`${prefix}-tray-${s}`,[[0,'rgba(0,0,0,.16)'],[.22,'rgba(0,0,0,0)'],[1,'rgba(255,255,255,0)']],0,1),'pointer-events':'none'}));
      if(on)g.append(n('rect',{x:x+.6,y:yy+.6,width:y.size-1.2,height:y.size-1.2,rx:4,fill:'none',stroke:'#ffffff','stroke-width':1.3,class:'yard-glow'}));
      g.append(nameText(y.x,yy+c*.62-3.5*.34,fitName(live?names[s]:'',y.size-8,3.5),{fill:'#ffffff'}));
    }else{
      g.append(n('circle',{cx:y.x,cy:y.y,r:y.r+1.6,fill}),n('circle',{cx:y.x,cy:y.y,r:y.r-.4,fill:theme.plate,stroke:mix(color,'#000000',.15),'stroke-width':.45}));
      if(on)g.append(n('circle',{cx:y.x,cy:y.y,r:y.r+1.6,fill:'none',stroke:'#ffffff','stroke-width':1.1,class:'yard-glow'}));
      // the plate sits between two arms, so it never grows past 24 units
      if(live&&names[s]){const fit=fitName(names[s],20.4,3),w=Math.min(24,Math.max(9,fit.width+4.2));g.append(n('rect',{x:y.x-w/2,y:y.y+y.r-2.2,width:w,height:5.2,rx:2.6,fill:mix(color,'#000000',.2),stroke:'#ffffff','stroke-width':.35}),nameText(y.x,y.y+y.r+.4,fit,{fill:'#ffffff'}));}
    }
    const well=radial(defs,`${prefix}-well-${s}`,[[0,mix(color,'#ffffff',.72)],[.62,mix(color,'#ffffff',.45)],[1,mix(color,'#000000',.18)]],.6,.66,.62);
    for(const b of L.bases[s])g.append(n('circle',{cx:b.x,cy:b.y,r:c*.52,fill:well,stroke:mix(color,'#000000',.12),'stroke-width':.45}),n('path',{d:`M${(b.x-c*.42).toFixed(2)} ${(b.y-c*.12).toFixed(2)}A${(c*.44).toFixed(2)} ${(c*.44).toFixed(2)} 0 0 1 ${(b.x+c*.12).toFixed(2)} ${(b.y-c*.42).toFixed(2)}`,fill:'none',stroke:'#000',opacity:.18,'stroke-width':c*.07,'stroke-linecap':'round'}));
    svg.append(g);
  }
  // Track.
  const cellSize=c*.94,cellFill=gradient(defs,prefix+'-cell',[[0,mix(theme.cell,'#ffffff',.6)],[.55,theme.cell],[1,mix(theme.cell,'#000000',.07)]]);
  L.track.forEach((p,i)=>{
    const start=boardGeometry(state).starts.indexOf(i),safe=boardGeometry(state).safe.has(i)&&start<0,color=start>=0?BOARD_COLORS[start]:null,a=seats===6?p.a:0;
    svg.append(rotRect({x:p.x+.25,y:p.y+.45},cellSize,cellSize,a,{fill:'#000',opacity:.12}),rotRect(p,cellSize,cellSize,a,{fill:color?gradient(defs,`${prefix}-start-${i}`,[[0,mix(color,'#ffffff',.28)],[1,mix(color,'#000000',.08)]]):cellFill,stroke:color?mix(color,'#000000',.2):theme.line,'stroke-width':.4,'data-track':i}));
    if(color){const next=L.track[(i+1)%L.track.length];svg.append(arrow(p,Math.atan2(next.y-p.y,next.x-p.x),c*.26,'#ffffff'));}
    else if(safe)svg.append(n('path',{d:star(p.x,p.y,c*.32),fill:'#c9a032',opacity:.9}));
  });
  // Home lanes and gates.
  for(let s=0;s<seats;s++){
    const color=BOARD_COLORS[s],lane=gradient(defs,`${prefix}-lane-${s}`,[[0,mix(color,'#ffffff',.42)],[.5,color],[1,mix(color,'#000000',.12)]]),a=seats===6?L.angle(s):0;
    L.lanes[s].forEach((p,h)=>svg.append(rotRect(p,cellSize,cellSize,a,{fill:lane,stroke:mix(color,'#000000',.18),'stroke-width':.4,'data-home':s+':'+h})));
    const gate=L.gates[s];svg.append(rotRect(gate,cellSize,cellSize,a,{fill:color,stroke:mix(color,'#000000',.18),'stroke-width':.4}),arrow(gate,L.angle(s)+Math.PI,c*.27,'#ffffff'));
  }
  // Centre: one triangle per seat and a flower.
  const finishGroup=n('g',{'data-finish':'true'}),R=seats===6?L.R0-c*.62:c*1.5;
  for(let s=0;s<seats;s++){
    const a1=L.angle(s)-Math.PI/seats,a2=L.angle(s)+Math.PI/seats,k=seats===4?Math.SQRT2:1/Math.cos(Math.PI/6),p1={x:100+Math.cos(a1)*R*k,y:100+Math.sin(a1)*R*k},p2={x:100+Math.cos(a2)*R*k,y:100+Math.sin(a2)*R*k};
    const tri=radial(defs,`${prefix}-tri-${s}`,[[0,mix(BOARD_COLORS[s],'#ffffff',.35)],[1,mix(BOARD_COLORS[s],'#000000',.12)]],.5,.5,.7);
    finishGroup.append(n('path',{d:`M100 100L${xy(p1)}L${xy(p2)}Z`,fill:tri,stroke:'#ffffff','stroke-width':.5,opacity:s<state.players.length?1:.45}));
  }
  finishGroup.append(n('circle',{cx:100.4,cy:101,r:c*.95,fill:'#000',opacity:.12}));
  const petals=n('g',{transform:'translate(100 100)'});
  for(let i=0;i<8;i++)petals.append(n('ellipse',{cx:0,cy:-c*.48,rx:c*.2,ry:c*.42,fill:'#ffffff',opacity:.92,transform:`rotate(${i*45})`}));
  petals.append(n('circle',{r:c*.24,fill:'#f2c14e',stroke:'#ffffff','stroke-width':.5}));
  finishGroup.append(petals);svg.append(finishGroup);
}

function drawRing(svg,defs,prefix,state,L,theme,active){
  const seats=L.seats,four=seats===4,names=state.players.map(playerLabel);
  const frame=gradient(defs,prefix+'-frame',[[0,theme.frame[0]],[.3,theme.frame[1]],[1,theme.frame[2]]]);
  const felt=radial(defs,prefix+'-felt',[[0,theme.felt[0]],[.7,theme.felt[1]],[1,theme.felt[2]]]);
  const outline=four?'M26 1H174Q199 1 199 26V174Q199 199 174 199H26Q1 199 1 174V26Q1 1 26 1Z':'M'+Array.from({length:6},(_,i)=>xy({x:100+Math.cos(i*Math.PI/3-Math.PI/2)*99,y:100+Math.sin(i*Math.PI/3-Math.PI/2)*99})).join('L')+'Z';
  const inner=four?'M28 6H172Q194 6 194 28V172Q194 194 172 194H28Q6 194 6 172V28Q6 6 28 6Z':'M'+Array.from({length:6},(_,i)=>xy({x:100+Math.cos(i*Math.PI/3-Math.PI/2)*93,y:100+Math.sin(i*Math.PI/3-Math.PI/2)*93})).join('L')+'Z';
  svg.append(n('path',{d:outline,fill:'#000',opacity:.3,transform:'translate(0 1.8)'}),n('path',{d:outline,fill:frame}),n('path',{d:outline,fill:'none',stroke:'#ffffff','stroke-width':.6,opacity:.26,transform:'translate(.4 .4) scale(.996)'}),n('path',{d:inner,fill:felt,stroke:theme.rim,'stroke-width':.8}));
  // Felt texture and an inlaid ring.
  const grain=n('pattern',{id:prefix+'-weave',width:3,height:3,patternUnits:'userSpaceOnUse'});grain.append(n('path',{d:'M0 3 3 0',stroke:'#ffffff',opacity:.05,'stroke-width':.5}));defs.append(grain);
  svg.append(n('path',{d:inner,fill:paint(prefix+'-weave')}));
  svg.append(n('circle',{cx:100,cy:100,r:four?66:67,fill:'none',stroke:theme.rim,'stroke-width':.35,opacity:.55}),n('circle',{cx:100,cy:100,r:46,fill:'none',stroke:theme.rim,'stroke-width':.35,opacity:.4}));
  if(four)[['♠',18,18],['♥',182,18],['♦',182,186],['♣',18,186]].forEach(([suit,x,y],i)=>svg.append(n('text',{x,y,'text-anchor':'middle','font-size':9,fill:i===1||i===2?'#e0474c':theme.rim,opacity:.32},suit)));
  // carved holes: dark under the top-left lip, lit on the far wall
  const hole=radial(defs,prefix+'-hole',[[0,mix(theme.hole,'#ffffff',.22),1],[.45,theme.hole,1],[.85,'#000000',1],[1,'#000000',1]],.62,.68,.72);
  // Pockets (bases) with name plates.
  for(let s=0;s<seats;s++){
    const p=L.pockets[s],color=BOARD_COLORS[s],live=s<state.players.length,on=s===active,deg=(p.a+Math.PI/2)*180/Math.PI;
    const g=n('g',{'data-pocket':s,'data-active':String(on),opacity:live?1:.38});
    const tf=`rotate(${deg.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`;
    g.append(n('rect',{x:p.x-15.8,y:p.y-4.9,width:31.6,height:10.8,rx:5.4,fill:'#000',opacity:.25,transform:tf}));
    g.append(n('rect',{x:p.x-15.8,y:p.y-5.4,width:31.6,height:10.8,rx:5.4,fill:gradient(defs,`${prefix}-pocket-${s}`,[[0,mix(color,'#000000',.45)],[.4,mix(color,'#000000',.22)],[1,mix(color,'#ffffff',.08)]],0,1),stroke:on?'#ffffff':mix(color,'#ffffff',.3),'stroke-width':on?1:.5,transform:tf,class:on?'yard-glow':null}));
    for(const b of L.bases[s])g.append(n('circle',{cx:b.x,cy:b.y,r:L.hole,fill:hole,stroke:mix(color,'#ffffff',.3),'stroke-width':.45}));
    // The name sits between the ring and the pocket. Side seats only have a
    // narrow band there, so a long name shrinks, wraps or ends in an ellipsis.
    const side=Math.abs(Math.cos(p.a))>.3,radius=side?(four?67.6:68):(four?68.5:69),room=side?(four?18.4:16.5):50;
    const label={x:100+Math.cos(p.a)*radius,y:100+Math.sin(p.a)*radius};
    g.append(nameText(label.x,label.y,fitName(live?names[s]:'',room,3.2,side?2:1),{fill:theme.label,opacity:.95}));
    svg.append(g);
  }
  // Track holes; start holes wear the seat colour.
  L.track.forEach((p,i)=>{
    const start=boardGeometry(state).starts.indexOf(i);
    svg.append(n('circle',{cx:p.x,cy:p.y,r:L.hole,fill:hole,stroke:start>=0?BOARD_COLORS[start]:theme.holeRim,'stroke-width':start>=0?1:.45,'data-track':i,class:'tbl-hole'}));
    if(start>=0){const next=L.track[(i+1)%L.track.length];svg.append(arrow({x:p.x+(next.x-p.x)*.62,y:p.y+(next.y-p.y)*.62},Math.atan2(next.y-p.y,next.x-p.x),1.25,BOARD_COLORS[start]));}
  });
  for(let s=0;s<seats;s++){
    const color=BOARD_COLORS[s];
    const a=L.seatAngle(s),from={x:100+Math.cos(a)*44.6,y:100+Math.sin(a)*44.6},to={x:100+Math.cos(a)*14.5,y:100+Math.sin(a)*14.5};
    svg.append(n('line',{x1:from.x,y1:from.y,x2:to.x,y2:to.y,stroke:color,'stroke-width':6.6,'stroke-linecap':'round',opacity:.28}));
    L.lanes[s].forEach((p,h)=>svg.append(n('circle',{cx:p.x,cy:p.y,r:L.hole,fill:hole,stroke:color,'stroke-width':.8,'data-home':s+':'+h,'data-safe':s+':'+h,class:'tbl-hole'})));
  }
  // Centre medallion.
  const finish=n('g',{'data-finish':'true'}),medal=radial(defs,prefix+'-medal',[[0,mix(theme.felt[0],'#ffffff',.15)],[1,theme.felt[2]]]);
  const brass=gradient(defs,prefix+'-brass',[[0,'#fff3c4'],[.35,theme.rim],[1,mix(theme.rim,'#000000',.45)]]);
  finish.append(n('circle',{cx:100.5,cy:101.3,r:16.4,fill:'#000',opacity:.25}),n('circle',{cx:100,cy:100,r:16.2,fill:brass}),n('circle',{cx:100,cy:100,r:15,fill:medal,stroke:mix(theme.rim,'#000000',.3),'stroke-width':.4}),n('circle',{cx:100,cy:100,r:13.6,fill:'none',stroke:theme.rim,'stroke-width':.3,opacity:.7}));
  ['♠','♥','♦','♣'].forEach((suit,i)=>{const a=i*Math.PI/2-Math.PI/4;finish.append(n('text',{x:100+Math.cos(a)*9.2,y:100+Math.sin(a)*9.2+1.4,'text-anchor':'middle','font-size':3.8,fill:i===1||i===2?'#e0474c':theme.medal,opacity:.85},suit));});
  finish.append(n('text',{x:100,y:101.4,'text-anchor':'middle','font-size':4,'font-weight':900,fill:theme.medal,'font-family':'Tajawal,Arial,sans-serif'},'جاكارو'));
  svg.append(finish);
}

/* ---------- Pieces ---------- */
export function createAtelierPiece({prefix='piece',color='#2f86e8',kind='classic',number='',metal}={}){
  const design=LEGACY_KINDS[kind]||kind,P=pieces(),g=n('g',{'data-piece-design':design});
  if(P){const defs=n('defs');g.append(defs,P.pawn(document,defs,{design,color,scope:prefix,number:''}));}
  else g.append(n('ellipse',{cx:0,cy:.6,rx:4.6,ry:1.6,fill:'#000',opacity:.3}),n('path',{d:'M-3.6 0Q-3 -6 0 -9.5 3 -6 3.6 0Z',fill:color,stroke:metal||'#3a2a12','stroke-width':.3}),n('circle',{cx:0,cy:-10.2,r:2.6,fill:color,stroke:metal||'#3a2a12','stroke-width':.3}));
  if(number!=='')g.append(n('text',{x:0,y:.4,'text-anchor':'middle','font-size':1.7,'font-weight':800,fill:'#ffffff','paint-order':'stroke',stroke:'#102127','stroke-width':.3},number));
  return g;
}
// 33.0.0: `own` is the seat's own stone from the shop (online tables); «شخصيتي» is a snakes piece
function stoneGraphic(game,defs,prefix,seat,c,own){
  const P=pieces(),color=BOARD_COLORS[seat],chosen=own||equipped('pawn'),pawn=chosen==='pawn-character'?'pawn-classic':chosen;
  if(game==='jackaroo'){
    const g=n('g',{transform:'scale(.66)'});
    if(P)g.append(P.marble(document,defs,{style:P.marbleFor(pawn),color,scope:prefix+'-m'+seat}));
    else g.append(n('circle',{r:5,fill:color,stroke:'#fff','stroke-width':.6}));
    return g;
  }
  const scale=c/12.8*.8,g=n('g',{transform:`translate(0 ${(c*.3).toFixed(2)}) scale(${scale.toFixed(3)})`});
  if(P)g.append(P.pawn(document,defs,{design:KINDS[pawn]||'classic',item:pawn,color,scope:prefix+'-p'+seat}));
  else g.append(createAtelierPiece({prefix:prefix+'-p'+seat,color}));
  return g;
}

/* ---------- Effects ---------- */
function flourish(svg,p,color,kind){
  if(globalThis.BS_AUDIO?.getSettings?.().effects===false)return;
  if(kind==='land')color=globalThis.BS_CAREER_CORE?.COSMETIC_STYLES?.[equipped('trail')]?.['--trail-color']||color;
  const fx=n('g',{'data-board-effect':kind,'pointer-events':'none'}),ring=n('circle',{cx:p.x,cy:p.y,r:2,fill:'none',stroke:color,'stroke-width':.7});fx.append(ring);
  if(reduce()){ring.setAttribute('r',6);ring.setAttribute('opacity',.7);svg.append(fx);setTimeout(()=>fx.remove(),650);return;}
  const style=equipped('trail'),count=kind==='finish'?14:kind==='capture'?10:style==='trail-meteor'?9:style==='trail-echo'?5:6;
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,d=kind==='capture'?12:9,dx=Math.cos(a)*d,dy=Math.sin(a)*d,dot=n(style==='trail-echo'?'rect':'circle',style==='trail-echo'?{x:p.x-1,y:p.y-1,width:2,height:2,fill:color}:{cx:p.x,cy:p.y,r:kind==='capture'?.95:.6,fill:kind==='capture'&&i%2?'#ffffff':color});
    fx.append(dot);dot.animate?.([{transform:'translate(0px,0px)',opacity:.95},{transform:`translate(${dx}px,${dy}px)`,opacity:0}],{duration:kind==='capture'?560:420,easing:'ease-out'});
  }
  if(kind==='capture')fx.append(n('text',{x:p.x,y:p.y-5,'text-anchor':'middle','font-size':6},'💥'));
  ring.animate?.([{r:'2px',opacity:.9},{r:style==='trail-ripple'?'12px':'9px',opacity:0}],{duration:560,easing:'ease-out'});
  svg.append(fx);setTimeout(()=>fx.remove(),700);
}
function trace(svg,points,color,duration){
  if(reduce()||globalThis.BS_AUDIO?.getSettings?.().effects===false)return;
  const design=equipped('trail'),ink=globalThis.BS_CAREER_CORE?.COSMETIC_STYLES?.[design]?.['--trail-color']||color,fx=n('g',{'data-board-trail':design||'trail-pencil','pointer-events':'none'}),length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
  const path=n('path',{d:points.map((p,i)=>(i?'L':'M')+xy(p)).join(' '),fill:'none',stroke:ink,'stroke-width':design==='trail-meteor'?1.3:.8,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':design==='trail-echo'?'1 2':length,opacity:.6});
  fx.append(path);svg.append(fx);
  path.animate?.([{strokeDashoffset:String(length),opacity:.15},{strokeDashoffset:'0',opacity:.7,offset:.72},{strokeDashoffset:'0',opacity:0}],{duration:duration+180,easing:'ease-out'});
  fx.animate?.([{opacity:1,offset:0},{opacity:1,offset:.65},{opacity:0}],{duration:duration+220,easing:'ease-out'});
  setTimeout(()=>fx.remove(),duration+250);
}

/* ---------- Render ---------- */
export function renderPetalBoard(target,state,options={}){
  const {game='zahra',legal=[],legalStones=[],onPick=()=>{},onSelect=null,active=state.turn,material,pawn,preview=false,looks=null}=options;
  const g=boardGeometry(state),themeKey=material&&THEMES[material]?material:MATERIALS[material]||MATERIALS[equipped('table')]||'walnut',theme=THEMES[themeKey],pawnId=pawn?Object.keys(KINDS).find(k=>KINDS[k]===(LEGACY_KINDS[pawn]||pawn))||'pawn-classic':equipped('pawn');
  const signature=JSON.stringify([game,active,themeKey,pawnId,legal,legalStones,looks,state.players.map(p=>[p.name,p.tokens||p.marbles])]),existing=target.querySelector('.petal-board-v30'),previous=existing?motionHistory.get(target):null;
  if(!preview)surfaces.set(target,{state,options});
  if(existing&&previous?.signature===signature)return existing;
  const prefix='tbl-'+(++sequence),L=layoutFor(game,g.seats);
  const svg=n('svg',{viewBox:'0 0 200 200',role:'group','aria-label':game==='zahra'?'لوحة الزهرة؛ أربعة أحجار لكل لاعب':'طاولة جاكارو؛ أربع كرات لكل لاعب','data-material':themeKey,'data-game':game,'data-seats':g.seats});
  svg.classList.add('petal-board-v29','petal-board-v30','table-v31');
  const defs=n('defs');svg.append(defs);
  if(game==='jackaroo')drawRing(svg,defs,prefix,state,L,theme,active);else drawCross(svg,defs,prefix,state,L,theme,active);
  const positions=new Map(),values=new Map(),motions=[],effects=[],traces=[],cellSize=L.c||12.8;
  const stoneLayer=n('g',{'data-layer':'stones'});
  // Stones further down the board are drawn later so they overlap correctly.
  const order=[];state.players.forEach((player,seat)=>(player.tokens||player.marbles).forEach((progress,index)=>order.push({seat,index,progress,p:petalStonePoint(state,seat,index,game)})));
  order.sort((a,b)=>a.p.y-b.p.y);
  for(const {seat,index,progress,p} of order){
    const player=state.players[seat],key=seat+':'+index,can=seat===active&&legal.includes(index)||legalStones.includes(key);
    const piece=n('g',{'data-stone':key,'data-player':seat,'data-token':index,transform:`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`,role:'button',tabindex:can?0:-1,'pointer-events':can?'auto':'none','aria-label':player.name+'، '+(game==='jackaroo'?'كرة ':'حجر ')+(index+1)+(can?'، حركة متاحة':''),'aria-disabled':String(!can)});
    piece.classList.add('petal-stone-v29','atelier-piece-v30');if(can)piece.classList.add('legal');
    piece.append(n('circle',{r:game==='jackaroo'?4.6:6.2,cy:game==='jackaroo'?0:-2,fill:'transparent'}));
    if(can)piece.append(n('ellipse',{cx:0,cy:game==='jackaroo'?0:cellSize*.28,rx:game==='jackaroo'?4.2:cellSize*.42,ry:game==='jackaroo'?4.2:cellSize*.2,fill:'none',stroke:'#ffffff','stroke-width':.7,'data-legal-ring':'true',class:'legal-ring'}));
    const bob=n('g',{class:'stone-bob'});bob.append(stoneGraphic(game,defs,prefix,seat,cellSize,looks?.[seat]));piece.append(bob);
    if(can){const pick=()=>onSelect?onSelect(seat,index):onPick(index);piece.onclick=pick;piece.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick();}};}
    stoneLayer.append(piece);
    const old=previous?.positions.get(key),oldValue=previous?.values.get(key),moved=old&&(Math.abs(old.x-p.x)>.01||Math.abs(old.y-p.y)>.01);
    if(moved&&!preview){
      const captured=oldValue>=0&&progress<0;
      if(!reduce()&&piece.animate){
        const points=[old];
        if(!captured&&oldValue>=0&&progress>=0&&Math.abs(progress-oldValue)<=20){const step=progress>oldValue?1:-1;for(let v=oldValue+step;step>0?v<progress:v>progress;v+=step)points.push(rawPoint(state,seat,index,v,game));}
        points.push(p);
        const duration=captured?460:Math.min(760,260+points.length*70),frames=points.map((q,i)=>({transform:`translate(${q.x}px,${q.y}px)`+(i&&i<points.length-1&&!captured?' scale(1.12)':''),offset:i/(points.length-1)})),animation=piece.animate(frames,{duration,easing:points.length>3?'linear':'cubic-bezier(.18,.75,.25,1)'});
        motions.push(animation.finished.catch(()=>{}));
        if(!captured)traces.push({points,color:BOARD_COLORS[seat],duration});
      }
      effects.push({p:captured?old:p,color:captured?'#f38286':progress>=g.finish?'#f4d9a0':BOARD_COLORS[seat],kind:captured?'capture':progress>=g.finish?'finish':'land'});
    }
    positions.set(key,p);values.set(key,progress);
  }
  svg.append(stoneLayer);
  target.replaceChildren(svg);
  for(const fx of traces)trace(svg,fx.points,fx.color,fx.duration);
  for(const fx of effects)flourish(svg,fx.p,fx.color,fx.kind);
  motionHistory.set(target,{positions,values,signature});
  target.atelierMotion=Promise.all(motions);
  return svg;
}
globalThis.addEventListener?.('bs-career-change',()=>{for(const [target,{state,options}] of surfaces){if(target.isConnected)renderPetalBoard(target,state,options);else surfaces.delete(target);}});
