import {boardGeometry,boardStonePosition,stoneOffset} from './engines/board-geometry-v29.js?v=33.9.2';
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
  royal:{label:'#ffffff',medal:'#f1cf7d',frame:['#f6dc86','#b8862a','#5e3b10'],rim:'#f1cf7d',surface:'#f8f3fc',cell:'#ffffff',line:'#dccbea',ink:'#3a2452',felt:['#5d3d80','#4a2f66','#2a183c'],hole:'#1a0f26',holeRim:'#f1cf7d',plate:'#fbf7ff'},
  // 33.4.0: the club, the majlis and the reactor are boards of their own
  club:{label:'#fff4dc',medal:'#e8c66a',frame:['#6b4a35','#3a2418','#140a05'],rim:'#e8c66a',surface:'#f6efdf',cell:'#fffaf0',line:'#d9c7a2',ink:'#3a2a12',felt:['#1f7a52','#13603f','#08391f'],hole:'#0b2016',holeRim:'#c9a46a',plate:'#fff8e6'},
  majlis:{label:'#fff0d8',medal:'#e7bf62',frame:['#6a3d26','#3e2112','#1c0d06'],rim:'#e7bf62',surface:'#fbf1e2',cell:'#fffaf2',line:'#e2cfae',ink:'#5a1a24',felt:['#8a2430','#5e131c','#310709'],hole:'#1c0507',holeRim:'#e7bf62',plate:'#fff6ea'},
  reactor:{label:'#e2f4ff',medal:'#5ab8ff',frame:['#8ea2b6','#3a4858','#151c24'],rim:'#5ab8ff',surface:'#12253a',cell:'#1a3149',line:'#2f5574',ink:'#e2f4ff',felt:['#1b4a78','#123456','#081a30'],hole:'#04101e',holeRim:'#5ab8ff',plate:'#173a5c'}
};
const MATERIALS={'table-club':'club','table-walnut':'walnut','table-gallery':'ivory','table-nocturne':'carbon','table-midnight':'carbon','table-cyber':'reactor','table-slate':'carbon','table-botanic':'jade','table-emerald':'jade','table-royal':'royal','table-majlis':'majlis'};
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
const layouts=new Map();
function layoutFor(game,seats,arm=13){const key=game+seats+':'+arm;if(!layouts.has(key))layouts.set(key,game==='jackaroo'?(seats===4?jackCrossLayout(arm):starLayout(seats,arm)):crossLayout(seats));return layouts.get(key);}
function rawPoint(state,seat,index,progress,game){
  const g=boardGeometry(state),L=layoutFor(game,g.seats,g.arm);
  if(progress<0)return L.bases[seat][index%4];
  if(progress>=g.track){const h=progress-g.track;return h<4?L.lanes[seat][h]:L.finish[seat];}
  return L.track[boardStonePosition(seat,progress,state)];
}
export function petalStonePoint(state,seat,index,game='zahra'){
  const g=boardGeometry(state),list=state.players[seat].tokens||state.players[seat].marbles,value=list[index],p=rawPoint(state,seat,index,value,game);
  if(value<0)return {x:p.x,y:p.y};
  const stack=[];
  state.players.forEach((player,pi)=>(player.tokens||player.marbles).forEach((v,ti)=>{if(value<g.track?boardStonePosition(pi,v,state)===boardStonePosition(seat,value,state):pi===seat&&v===value)stack.push(pi+':'+ti);}));
  // finished marbles gather in the cup at the end of their lane
  const o=stoneOffset(stack.indexOf(seat+':'+index),stack.length,game==='jackaroo'?(value>=g.track+4?Math.min(3,1.4+stack.length*.45):Math.min(3.4,1.6+stack.length*.45)):Math.min(4.2,1.9+stack.length*.5));
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

// the weave of each surface, as an SVG pattern
const WEAVE={
  walnut:[3,3,[['path',{d:'M0 3 3 0',stroke:'#fff','stroke-opacity':.06,'stroke-width':.5}]]],
  club:[3.2,3.2,[['circle',{cx:1.6,cy:1.6,r:.42,fill:'#fff','fill-opacity':.07}]]],
  ivory:[5,5,[['path',{d:'M0 5 5 0M0 0 5 5',stroke:'#8d6a27','stroke-opacity':.05,'stroke-width':.35}]]],
  carbon:[6.93,12,[['path',{d:'M3.46 0 6.93 2V6L3.46 8 0 6V2ZM3.46 8V12',fill:'none',stroke:'#55e1ff','stroke-opacity':.09,'stroke-width':.35}]]],
  jade:[16,16,[['path',{d:'M0 8C4 3 12 3 16 8M8 0C3 4 3 12 8 16M0 8C4 13 12 13 16 8',fill:'none',stroke:'#e9f7ee','stroke-opacity':.08,'stroke-width':.4}],['ellipse',{cx:8,cy:8,rx:1.1,ry:2.2,fill:'#e9f7ee','fill-opacity':.07}]]],
  royal:[18,18,[['path',{d:'M9 3c1.6 2 1.6 3.6 0 5.6-1.6-2-1.6-3.6 0-5.6zM9 8.6c2-1 3.6-.4 4.3 1.6-2 1-3.6.4-4.3-1.6zM9 8.6c-2-1-3.6-.4-4.3 1.6 2 1 3.6.4 4.3-1.6z',fill:'#f1cf7d','fill-opacity':.08}],...[[0,0],[18,0],[0,18],[18,18]].map(([cx,cy])=>['circle',{cx,cy,r:1.2,fill:'#f1cf7d','fill-opacity':.08}])]],
  majlis:[8,8,[['path',{d:'M4 0 8 4 4 8 0 4Z',fill:'none',stroke:'#f1e4c8','stroke-opacity':.07,'stroke-width':.45}],['path',{d:'M0 2H8M0 6H8',stroke:'#000','stroke-opacity':.12,'stroke-width':.3}]]],
  reactor:[8,8,[['path',{d:'M8 0V8H0',fill:'none',stroke:'#5ab8ff','stroke-opacity':.12,'stroke-width':.3}]]],
};
function pattern(defs,id,w,h,parts){const el=n('pattern',{id,width:w,height:h,patternUnits:'userSpaceOnUse'});for(const [tag,attrs] of parts)el.append(n(tag,attrs));defs.append(el);return paint(id);}
/* ---------- Jackaroo: the star board (33.6.0) ----------
   An octagon (a hexagon for six) edged in every player's colour. The walk is a star: each
   seat's start is the tip of a finger in a corner, its home lane runs from that tip toward the
   middle, and its quarter of the walk — numbered 1 to 18 (13 on six-seat and older boards) —
   runs along its own side. Each player sits on that side: a portrait, a name plate, and the
   yard (four holes in a plus) by the start. The last cards played lie face up in the middle.
   Several looks dress the same board (LOOKS); the board turns so your side is the bottom one,
   your start at its right-hand tip. */
let ROT=0;
const up=(el,x,y)=>{if(ROT)el.setAttribute('transform',`rotate(${-ROT} ${(+x).toFixed(2)} ${(+y).toFixed(2)})`);return el;};
// a step on the screen (down = toward the bottom of the phone) as a step on the turned board
const shift=(p,dx,dy)=>{const r=-ROT*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return{x:p.x+dx*c-dy*s,y:p.y+dx*s+dy*c};};
// six seats leave no room on a side for the yard, so it sits just inside the walk, facing its player
const STAR=Object.freeze({4:{Ra:86,D:48,alpha:28,tip:5,bend:14,yard:[73,37],seat:72,avatar:9.6,plate:7.6,name:3.7,room:33},6:{Ra:88,D:54,alpha:24,tip:5,bend:9,yard:[39.5,0],seat:70.5,avatar:6.6,plate:5.8,name:2.8,room:24}});
function starLayout(seats,arm){
  const six=seats===6,cfg=STAR[six?6:4],C={x:100,y:100},sector=2*Math.PI/seats,T=seats*arm,alpha=cfg.alpha*Math.PI/180;
  const side=s=>s*sector-Math.PI/2,finger=s=>side(s)-sector/2,at=(a,r)=>({x:C.x+Math.cos(a)*r,y:C.y+Math.sin(a)*r}),dir=a=>({x:Math.cos(a),y:Math.sin(a)});
  // the corners of the walk: each finger's tip, and where its edges meet the side lines
  const corners=[];
  for(let s=0;s<seats;s++){
    const u=dir(side(s)),tip=at(finger(s),cfg.Ra),next=at(finger(s+1),cfg.Ra);
    const meet=(p,e)=>{const t=(cfg.D-((p.x-C.x)*u.x+(p.y-C.y)*u.y))/(e.x*u.x+e.y*u.y);return{x:p.x+e.x*t,y:p.y+e.y*t};};
    corners.push({p:tip,r:cfg.tip},{p:meet(tip,dir(finger(s)+Math.PI-alpha)),r:cfg.bend},{p:meet(next,dir(finger(s+1)+Math.PI+alpha)),r:cfg.bend});
  }
  const dense=[];
  corners.forEach((c,i)=>{
    const prev=corners[(i+corners.length-1)%corners.length].p,next=corners[(i+1)%corners.length].p,cur=c.p,la=Math.hypot(cur.x-prev.x,cur.y-prev.y),lb=Math.hypot(next.x-cur.x,next.y-cur.y),da=Math.min(c.r,la*.45),db=Math.min(c.r,lb*.45);
    const a={x:cur.x+(prev.x-cur.x)/la*da,y:cur.y+(prev.y-cur.y)/la*da},b={x:cur.x+(next.x-cur.x)/lb*db,y:cur.y+(next.y-cur.y)/lb*db};
    for(let k=0;k<=20;k++){const t=k/20;dense.push({x:(1-t)*(1-t)*a.x+2*(1-t)*t*cur.x+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*cur.y+t*t*b.y});}
  });
  // from the middle of seat 0's tip all the way round to it again; the holes at equal steps
  const loop=[...dense.slice(10),...dense.slice(0,11)],cum=[0];
  for(let i=1;i<loop.length;i++)cum.push(cum[i-1]+Math.hypot(loop[i].x-loop[i-1].x,loop[i].y-loop[i-1].y));
  const step=cum.at(-1)/T,track=[];
  for(let k=0,i=1;k<T;k++){const d=k*step;while(i<cum.length-1&&cum[i]<d)i++;const f=(d-cum[i-1])/((cum[i]-cum[i-1])||1),p=loop[i-1],q=loop[i];track.push({x:+(p.x+(q.x-p.x)*f).toFixed(2),y:+(p.y+(q.y-p.y)*f).toFixed(2)});}
  // a lane starts where it clears both edges of its finger
  const hole=Math.min(3.2,step*.43),gap=Math.min(step,6.9),d0=(hole*1.92+1.4)/Math.sin(alpha);
  const lanes=[],finish=[],bases=[],seatsAt=[],tips=[];
  for(let s=0;s<seats;s++){
    const a=finger(s),w=dir(a+Math.PI),tip=at(a,cfg.Ra),u=dir(side(s)),t=dir(side(s)-Math.PI/2),along=d=>({x:+(tip.x+w.x*d).toFixed(2),y:+(tip.y+w.y*d).toFixed(2)});
    tips.push({x:tip.x,y:tip.y,w});
    lanes.push([0,1,2,3].map(h=>along(d0+h*gap)));
    finish.push(along(d0+4*gap+1.4));
    // the yard: four holes in a plus, on the seat's side by its start
    const yard={x:C.x+u.x*cfg.yard[0]+t.x*cfg.yard[1],y:C.y+u.y*cfg.yard[0]+t.y*cfg.yard[1]},g=hole*2.2;
    bases.push([[-1,0],[0,1],[0,-1],[1,0]].map(([i,j])=>({x:+(yard.x+t.x*i*g+u.x*j*g).toFixed(2),y:+(yard.y+t.y*i*g+u.y*j*g).toFixed(2)})));
    seatsAt.push({x:C.x+u.x*cfg.seat,y:C.y+u.y*cfg.seat,yard,u,t});
  }
  return{kind:'star',seats,arm,C,cfg,track,lanes,finish,bases,seatsAt,tips,hole,step,gap,loop};
}
// the looks of the board: the same board, dressed differently
const LOOKS=Object.freeze({
  neon:{base:['#1d2e62','#121e46','#080f27'],frame:['#0b1433','#04081a'],edge:'seats',glow:true,road:['#ffffff',.055],tint:.16,hole:['#ffffff','#e7edf8','#9fadc9'],holeLine:'#7f8fb3',ink:'#1b2643',inset:'#6f8fff',insetFill:'#0b1536',plate:['#0c1636','#ffffff'],lane:.24,weave:'neon'},
  carbon:{base:['#22374a','#152433','#0a131c'],frame:['#30465a','#0a1219'],edge:'#55e1ff',glow:true,road:['#55e1ff',.07],tint:.12,hole:['#f2fcff','#cfeef8','#6a98aa'],holeLine:'#55e1ff',ink:'#0b2531',inset:'#55e1ff',insetFill:'#0d1c28',plate:['#0e1f2c','#e3f8ff'],lane:.24,weave:'carbon'},
  ivory:{base:['#fffefa','#f6efe2','#e4d5b6'],frame:['#f5e6c2','#b08739'],edge:'#c9a24f',glow:false,road:['#8d6a27',.085],tint:.18,hole:['#ffffff','#fbf6eb','#d3c098'],holeLine:'#b89a5a',ink:'#47351a',inset:'#c9a24f',insetFill:'#fbf5e8',plate:['#fffaf0','#3e2f14'],lane:.32,weave:'ivory'},
  emerald:{base:['#3a9d71','#246f4e','#113d2b'],frame:['#9a6a3d','#3a2210'],edge:'#ecc57c',glow:false,road:['#000000',.13],tint:.17,hole:['#ffffff','#eef4ed','#9ab4a3'],holeLine:'#e2bf7a',ink:'#163626',inset:'#ecc57c',insetFill:'#1c5a3f',plate:['#173d2c','#fff4dc'],lane:.3,weave:'club'},
  royal:{base:['#4e2e70','#321c4c','#180c27'],frame:['#f8e08f','#7a5216'],edge:'#f6dc86',glow:false,road:['#f1cf7d',.075],tint:.15,hole:['#fffaf0','#f3e1b0','#ad8737'],holeLine:'#f1cf7d',ink:'#3a2452',inset:'#f1cf7d',insetFill:'#2a173c',plate:['#2a173c','#fff3d0'],lane:.28,weave:'royal'},
  majlis:{base:['#a2303f','#721b28','#3b0b13'],frame:['#82502e','#2c1609'],edge:'#e7bf62',glow:false,road:['#000000',.15],tint:.15,hole:['#fff8ec','#f3e2c4','#b48e57'],holeLine:'#e7bf62',ink:'#4a1520',inset:'#e7bf62',insetFill:'#5c1622',plate:['#3c0e16','#fff0d8'],lane:.3,weave:'majlis'},
});
// 33.7.0: the board's look is the Jackaroo board you equipped from the shop (type «jboard»)
const BOARD_OF_ITEM={'jboard-neon':'neon','jboard-gold':'gold','jboard-emerald':'emerald','jboard-marble':'marble','jboard-royal':'royal','jboard-carbon':'carbon','jboard-majlis':'majlis'};
// the six-seat star keeps its own dresses; each board has one of them
const STAR_LOOK={neon:'neon',gold:'royal',emerald:'emerald',marble:'ivory',royal:'royal',carbon:'carbon',majlis:'majlis'};
/** The boards a player can pick on the Jackaroo page: [look, name, shop item]. */
export const JACK_LOOKS=Object.freeze([['neon','نيون','jboard-neon'],['gold','ذهب','jboard-gold'],['emerald','زمرد','jboard-emerald'],['marble','رخام','jboard-marble'],['carbon','كربون','jboard-carbon'],['royal','قصر','jboard-royal'],['majlis','مجلس','jboard-majlis']]);
const profileOf=()=>{try{return globalThis.BS_CAREER?.get?.()||null;}catch{return null;}};
export function jackLookOpen(key){const id=JACK_LOOKS.find(x=>x[0]===key)?.[2];if(!id)return false;if(id==='jboard-neon')return true;return Boolean(profileOf()?.owned?.includes(id));}
/** The look this player sees: the board they equipped, else neon. */
export function jackLook(){const id=equipped('jboard');return BOARD_OF_ITEM[id]&&jackLookOpen(BOARD_OF_ITEM[id])?BOARD_OF_ITEM[id]:'neon';}
/** Equip a board you own; the boards on the page redraw with it. */
export async function setJackLook(key){const id=JACK_LOOKS.find(x=>x[0]===key)?.[2];if(!id||!jackLookOpen(key))return false;try{await globalThis.BS_CAREER?.equip?.(id);}catch{return false;}for(const [target,{state,options}] of surfaces){if(target.isConnected&&options.game==='jackaroo')renderPetalBoard(target,state,options);else if(!target.isConnected)surfaces.delete(target);}return true;}
const WEAVE_NEON=[6,6,[['circle',{cx:3,cy:3,r:.38,fill:'#9fb6ff','fill-opacity':.09}]]];
function polygon(n,r,turn=0){return 'M'+Array.from({length:n},(_,i)=>{const a=turn+i*2*Math.PI/n;return (100+Math.cos(a)*r).toFixed(2)+' '+(100+Math.sin(a)*r).toFixed(2);}).join('L')+'Z';}
// the board's outline: an octagon cut at the corners where the fingers point (a hexagon for six)
function starOutline(seats,inset){
  if(seats===6)return polygon(6,98-inset);
  const a=2+inset,b=198-inset,k=40-inset*.41;return `M${a+k} ${a}H${b-k}L${b} ${a+k}V${b-k}L${b-k} ${b}H${a+k}L${a} ${b-k}V${a+k}Z`;
}
function starVertices(seats,inset){
  if(seats===6)return Array.from({length:6},(_,i)=>({x:100+Math.cos((i*60-120)*Math.PI/180)*(98-inset),y:100+Math.sin((i*60-120)*Math.PI/180)*(98-inset)}));
  const a=2+inset,b=198-inset,k=40-inset*.41;return [[a+k,a],[b-k,a],[b,a+k],[b,b-k],[b-k,b],[a+k,b],[a,b-k],[a,a+k]].map(([x,y])=>({x,y}));
}
// what each card does (jackaroo-cards.js), and the colours of its plate (jackaroo-v33-4.css)
const ACT_OF={A:'exit',K:'king',J:'swap','7':'split','5':'any','4':'back'};
const ACT_COLOR={exit:'#16936a',king:'#c58a1f',step:'#2b6fd6',back:'#cf6f22',swap:'#7550d0',split:'#0f97a0',any:'#cc4040'};
// the small drawings of jackaroo-cards.js, as SVG elements
function iconParts(markup){const out=[];for(const m of String(markup||'').matchAll(/<(path|circle)\b([^>]*)\/>/g)){const attrs={};for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=a[2];out.push(n(m[1],attrs));}return out;}
function cardCode(card){const rank=String(card).replace(/[SHDC]$/,''),suit=String(card).slice(-1);return (rank==='10'?'T':rank)+suit;}
function deckOf(){try{return globalThis.BS_CAREER?.get?.()?.equipped?.deck||'deck-classic';}catch{return 'deck-classic';}}
// one card lying in the middle: the deck's face, or a plain face where the deck is not loaded
function pileCard(defs,prefix,card,x,y,w,h,angle,top){
  const g=n('g',{transform:`rotate(${angle} ${(x+w/2).toFixed(2)} ${(y+h+7).toFixed(2)})`,'data-pile-card':card||'back'});
  g.append(n('rect',{x:x+.5,y:y+1.1,width:w,height:h,rx:1.6,fill:'#000',opacity:.35}));
  // 33.7.0: Jackaroo's own deck (jackaroo-cards.js), the same faces as in your hand
  let url='';try{url=globalThis.BS_JACK_CARDS?.url?.(card||'back')||globalThis.BS_CARDS?.url?.(card?cardCode(card):'back',deckOf())||'';}catch{url='';}
  if(url)g.append(n('image',{href:url,x,y,width:w,height:h,preserveAspectRatio:'none'}));
  else{
    g.append(n('rect',{x,y,width:w,height:h,rx:1.6,fill:card?'#fbfaf5':'#2a3a8a',stroke:'#c9c3b0','stroke-width':.3}));
    if(card){const rank=String(card).replace(/[SHDC]$/,''),suit=String(card).slice(-1),red=suit==='H'||suit==='D',sym={S:'♠',H:'♥',D:'♦',C:'♣'}[suit]||'';
      g.append(n('text',{x:x+1.4,y:y+4.6,'font-size':4,'font-weight':900,fill:red?'#d23a3f':'#1d2230','font-family':'Arial,sans-serif'},rank),n('text',{x:x+w/2,y:y+h/2+3.2,'text-anchor':'middle','font-size':8.5,fill:red?'#d23a3f':'#1d2230'},sym));}
  }
  if(top&&card){
    const act=globalThis.BS_JACK_CARDS?.info?.(card)?.act||ACT_OF[String(card).replace(/[SHDC]$/,'')]||'step',icon=globalThis.BS_JACK_CARDS?.ICON?.[act];
    const cx=x+w/2,cy=y+h+.4,badge=n('g',{'data-pile-act':act});
    badge.append(n('circle',{cx,cy,r:4.3,fill:ACT_COLOR[act]||'#2b6fd6',stroke:'#ffffff','stroke-width':.6}));
    if(icon){const art=n('g',{transform:`translate(${(cx-3.1).toFixed(2)} ${(cy-3.1).toFixed(2)}) scale(.26)`,fill:'none',stroke:'#ffffff','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round'});for(const part of iconParts(icon))art.append(part);badge.append(art);}
    else badge.append(n('text',{x:cx,y:cy+1.5,'text-anchor':'middle','font-size':4.2,'font-weight':900,fill:'#ffffff'},{exit:'↑',king:'♔',back:'↶',swap:'⇄',split:'⑂',any:'◎'}[act]||'→'));
    g.append(badge);
  }
  return g;
}
// the middle of the board: the last three cards played, the newest in front
function drawPile(root,defs,prefix,state,look,seats,pile){
  const L=n('g',{'data-pile':'true'}),inner=seats===6?polygon(6,25.5):polygon(8,27.5,Math.PI/8);
  L.append(n('path',{d:inner,fill:look.insetFill,opacity:.82}));
  if(look.glow)L.append(n('path',{d:inner,fill:'none',stroke:look.inset,'stroke-width':2.6,opacity:.16}));
  L.append(n('path',{d:inner,fill:'none',stroke:look.inset,'stroke-width':.6,opacity:.95}));
  const shown=(Array.isArray(pile)?pile:(state.discard||[])).filter(c=>c&&c!=='?').slice(-3);
  if(!shown.length&&state.lastEvent?.card&&state.lastEvent.card!=='?')shown.push(state.lastEvent.card);
  const cards=n('g',{'data-pile-cards':shown.length}),w=13.6,h=19;
  if(!shown.length)cards.append(pileCard(defs,prefix,null,100-w/2,100-h/2-2,w,h,0,false));
  const angles=shown.length===3?[-17,17,0]:shown.length===2?[-12,0]:[0];
  shown.forEach((card,i)=>cards.append(pileCard(defs,prefix,card,100-w/2,100-h/2-2.4,w,h,angles[i],i===shown.length-1)));
  L.append(up(cards,100,100));root.append(L);
}
function drawStar(root,defs,prefix,state,L,look,active,lookKey,{avatars=[],pile=null}={}){
  const seats=L.seats,names=state.players.map(playerLabel),geo=boardGeometry(state),six=seats===6;
  // the frame and the surface
  const frame=gradient(defs,prefix+'-frame',[[0,look.frame[0]],[1,look.frame[1]]]);
  const surface=radial(defs,prefix+'-surface',[[0,look.base[0]],[.62,look.base[1]],[1,look.base[2]]],.5,.5,.72);
  root.append(n('path',{d:starOutline(seats,0),fill:'#000',opacity:.32,transform:'translate(0 1.8)'}),n('path',{d:starOutline(seats,0),fill:frame}),n('path',{d:starOutline(seats,4.2),fill:surface}));
  const [ww,wh,wparts]=look.weave==='neon'?WEAVE_NEON:WEAVE[look.weave]||WEAVE_NEON;root.append(n('path',{d:starOutline(seats,4.2),fill:pattern(defs,prefix+'-weave',ww,wh,wparts)}));
  // the edge: every side in its player's colour (one colour on the other looks), lit on the neon ones
  const V=starVertices(seats,2.4),edge=n('g',{'data-edge':look.edge==='seats'?'seats':'one'});
  for(let i=0;i<V.length;i++){
    const a=V[i],b=V[(i+1)%V.length],s=six?i:Math.floor(i/2),own=six||i%2===0;
    let ink=look.edge;
    if(look.edge==='seats')ink=own?JACK_COLORS[s]:gradientLine(defs,`${prefix}-edge-${i}`,a,b,JACK_COLORS[s],JACK_COLORS[(s+1)%seats]);
    const seg=d=>n('path',{d:`M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`,fill:'none',stroke:ink,'stroke-linecap':'round',...d});
    if(look.glow)edge.append(seg({'stroke-width':6.5,opacity:.1}),seg({'stroke-width':3.2,opacity:.3}));
    edge.append(seg({'stroke-width':look.glow?1.25:1.1,opacity:1}));
  }
  if(!look.glow)edge.append(n('path',{d:starOutline(seats,5.6),fill:'none',stroke:look.edge==='seats'?'#ffffff':look.edge,'stroke-width':.35,opacity:.7}));
  root.append(edge);
  // the walk: a road under the holes, each player's quarter tinted in its colour
  const road=L.loop.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join('')+'Z';
  root.append(n('path',{d:road,fill:'none',stroke:'#000','stroke-width':L.hole*2+3.4,'stroke-linejoin':'round',opacity:look.glow?.32:.14}),n('path',{d:road,fill:'none',stroke:look.road[0],'stroke-width':L.hole*2+2.6,'stroke-linejoin':'round',opacity:look.road[1]}));
  for(let s=0;s<seats;s++){
    const pts=Array.from({length:L.arm},(_,k)=>L.track[(geo.starts[s]+k)%L.track.length]);
    root.append(n('path',{d:pts.map((p,i)=>(i?'L':'M')+xy(p)).join(''),fill:'none',stroke:JACK_COLORS[s],'stroke-width':L.hole*2+1.6,'stroke-linecap':'round','stroke-linejoin':'round',opacity:look.tint,'data-quarter':s}));
  }
  // the home lanes: a capsule from each finger's tip toward the middle, and a cup at its end
  for(let s=0;s<seats;s++){
    const color=JACK_COLORS[s],lane=L.lanes[s],w=L.tips[s].w,from={x:lane[0].x-w.x*(L.hole+.9),y:lane[0].y-w.y*(L.hole+.9)},to={x:L.finish[s].x+w.x*(L.hole+.6),y:L.finish[s].y+w.y*(L.hole+.6)};
    const line=attrs=>n('line',{x1:from.x.toFixed(2),y1:from.y.toFixed(2),x2:to.x.toFixed(2),y2:to.y.toFixed(2),'stroke-linecap':'round',...attrs});
    const g=n('g',{'data-lane':s});
    if(look.glow)g.append(line({stroke:color,'stroke-width':L.hole*2+6.2,opacity:.12}));
    g.append(line({stroke:color,'stroke-width':L.hole*2+3.4,opacity:.95}),line({stroke:look.insetFill,'stroke-width':L.hole*2+2.2}),line({stroke:color,'stroke-width':L.hole*2+2.2,opacity:look.lane}));
    const well=radial(defs,`${prefix}-well-${s}`,[[0,mix(color,'#000000',.55)],[.7,mix(color,'#000000',.3)],[1,mix(color,'#ffffff',.25)]],.42,.38,.62);
    lane.forEach((p,h)=>g.append(n('circle',{cx:p.x,cy:p.y,r:+(L.hole*.96).toFixed(2),fill:well,stroke:mix(color,'#ffffff',.35),'stroke-width':.45,'data-home':s+':'+h,'data-safe':s+':'+h,class:'tbl-hole'})));
    const cup=L.finish[s];g.append(n('circle',{cx:cup.x,cy:cup.y,r:+(L.hole*1.3).toFixed(2),fill:mix(color,'#000000',.55),stroke:color,'stroke-width':.8,'data-finish-cup':s}),n('path',{d:star(cup.x,cup.y,L.hole*.82),fill:color,opacity:.9}));
    root.append(g);
  }
  // the holes of the walk, numbered 1–18 from every seat's start
  const holeFill=radial(defs,prefix+'-hole',[[0,look.hole[0]],[.62,look.hole[1]],[1,look.hole[2]]],.4,.36,.68);
  L.track.forEach((p,i)=>{
    const seat=Math.floor(i/L.arm),num=i-seat*L.arm+1,start=num===1,color=JACK_COLORS[seat];
    if(start&&look.glow)root.append(n('circle',{cx:p.x,cy:p.y,r:+(L.hole+1.6).toFixed(2),fill:'none',stroke:color,'stroke-width':1.8,opacity:.28}));
    root.append(n('circle',{cx:p.x,cy:p.y,r:L.hole,fill:holeFill,stroke:start?color:look.holeLine,'stroke-width':start?1.15:.35,'data-track':i,class:'tbl-hole'}));
    root.append(up(n('text',{x:+p.x.toFixed(2),y:+(p.y+L.hole*.38).toFixed(2),'text-anchor':'middle','font-size':+(L.hole*(num<10?1.1:.98)).toFixed(2),'font-weight':900,'font-family':'Tajawal,Arial,sans-serif',fill:start?mix(color,'#000000',.25):look.ink,'pointer-events':'none','data-track-number':num,class:'tbl-num'},String(num)),p.x,p.y));
  });
  // the players: the yard by the start, the portrait and the name on their own side
  const cfg=L.cfg;
  for(let s=0;s<seats;s++){
    const color=JACK_COLORS[s],on=s===active,live=s<state.players.length,S=L.seatsAt[s],g=n('g',{'data-pocket':s,'data-seat':s,'data-active':String(on),opacity:live?1:.38});
    const yard=L.bases[s],plate=n('path',{d:'M'+[yard[0],yard[2],yard[3],yard[1]].map(p=>xy({x:+(p.x+(p.x-S.yard.x)*.55).toFixed(2),y:+(p.y+(p.y-S.yard.y)*.55).toFixed(2)})).join('L')+'Z',fill:color,'fill-opacity':.13,stroke:color,'stroke-width':.5,'stroke-opacity':.7,'stroke-linejoin':'round'});
    g.append(plate);
    const socket=radial(defs,`${prefix}-socket-${s}`,[[0,mix(look.hole[2],'#000000',.6)],[.75,mix(look.hole[2],'#000000',.35)],[1,mix(color,'#ffffff',.2)]],.42,.38,.62);
    yard.forEach((b,i)=>g.append(n('circle',{cx:b.x,cy:b.y,r:+(L.hole*1.02).toFixed(2),fill:socket,stroke:color,'stroke-width':.45,'data-yard':s+':'+i})));
    const H=cfg.avatar*2+1.6+cfg.plate,face=shift(S,0,-(1.6+cfg.plate)/2),tag=shift(S,0,cfg.avatar+.8);
    // the portrait: the player's character, or the first letter of the name
    const ring=n('g',{'data-avatar':s});
    if(look.glow||on)ring.append(n('circle',{cx:face.x,cy:face.y,r:cfg.avatar+1.7,fill:'none',stroke:color,'stroke-width':on?2.4:1.6,opacity:on?.55:.22,class:on?'yard-glow':null}));
    ring.append(n('circle',{cx:face.x,cy:face.y,r:cfg.avatar,fill:mix(color,'#000000',.6),stroke:color,'stroke-width':on?1.4:1}));
    const hero=avatars[s],url=hero?(String(hero).includes('/')?String(hero):globalThis.BS_CHARACTERS?.poster?.(hero)):'';
    if(url){
      const clip=n('clipPath',{id:`${prefix}-face-${s}`});clip.append(n('circle',{cx:face.x,cy:face.y,r:cfg.avatar-.5}));defs.append(clip);
      const W=cfg.avatar*4.1,Hh=W*320/384,img=n('image',{href:url,x:(face.x-W/2).toFixed(2),y:(face.y-Hh*.36).toFixed(2),width:W.toFixed(2),height:Hh.toFixed(2),preserveAspectRatio:'xMidYMid meet','clip-path':`url(#${prefix}-face-${s})`});
      ring.append(up(img,face.x,face.y));
    }else ring.append(up(n('text',{x:face.x.toFixed(2),y:(face.y+cfg.avatar*.36).toFixed(2),'text-anchor':'middle','font-size':(cfg.avatar*1.05).toFixed(2),'font-weight':900,'font-family':'Tajawal,Arial,sans-serif',fill:'#ffffff'},([...(names[s]||'؟')][0]||'؟')),face.x,face.y));
    g.append(ring);
    // the name plate, under the portrait on the screen
    const fit=fitName(live?names[s]:'',cfg.room,cfg.name,1),pw=Math.min(cfg.room+5,Math.max(cfg.avatar*2.4,fit.width+5.2)),ph=cfg.plate;
    const name=n('g',{'data-name-plate':s});
    name.append(n('rect',{x:(tag.x-pw/2).toFixed(2),y:(tag.y-ph/2).toFixed(2),width:pw.toFixed(2),height:ph,rx:ph/2,fill:on?mix(color,look.plate[0],.45):look.plate[0],stroke:color,'stroke-width':on?.9:.55,opacity:.96}));
    name.append(nameText(tag.x,tag.y,fit,{fill:look.plate[1]}));
    g.append(up(name,tag.x,tag.y));
    root.append(g);
  }
  drawPile(root,defs,prefix,state,look,seats,pile);
}
function gradientLine(defs,id,a,b,from,to){const g=n('linearGradient',{id,gradientUnits:'userSpaceOnUse',x1:a.x.toFixed(2),y1:a.y.toFixed(2),x2:b.x.toFixed(2),y2:b.y.toFixed(2)});g.append(n('stop',{offset:0,'stop-color':from}),n('stop',{offset:1,'stop-color':to}));defs.append(g);return paint(id);}

/* ---------- Jackaroo: the board of the picture (33.7.0) ----------
   The board the players drew for us: an octagon, and a walk shaped as a cross of four arms.
   Each seat's house (its start) sits at the end of its arm; from it the seat's eighteen holes,
   numbered 1 to 18 beside them, go up its arm, across a diagonal, along the next arm and up its
   end to the next house. The home lane runs up the middle of the arm, tied to its house by a
   line; the yard (two by two) waits in the corner by the arm. Your arm is the bottom one, your
   house at its left end. The looks are the shop's Jackaroo boards (BOARD_LOOKS).
   33.9.0: the turn passes to the right (the engine), so the player after you is the one on your
   right; a house with its owner's marble on it is locked, and says so (lockBadge). */
export const JACK_COLORS=Object.freeze(['#8b5cf6','#f2711c','#2f86e8','#22a565','#e0474c','#f0b429']);
// measured on the picture (1254 px → 200 units at 0.184 a pixel): arm half-width, arm end,
// where the diagonal starts, the lane, the yard, and how far a number sits from its hole
const CROSS=Object.freeze({a:14.72,L:77.28,c:40.48,lane:[69.1,61.3,53.5,45.7],cup:38.4,yard:[-37,65],yardGap:4.1,label:6.2});
const quarterTurn=(p,q)=>{let x=p.x,y=p.y;for(let i=0;i<((q%4)+4)%4;i++)[x,y]=[-y,x];return{x,y};};
function jackCrossLayout(arm){
  const {a,L,c}=CROSS,C=100,pts=[[-a,L],[-a,c],[-c,a],[-L,a],[-L,-a]].map(([x,y])=>({x,y}));
  const normals=[{x:-1,y:0},{x:-Math.SQRT1_2,y:Math.SQRT1_2},{x:0,y:1},{x:-1,y:0}];
  const segs=pts.slice(0,4).map((p,i)=>({from:p,to:pts[i+1],len:Math.hypot(pts[i+1].x-p.x,pts[i+1].y-p.y),n:normals[i]}));
  const quarter=[];
  const put=(i,t,corner)=>{const s=segs[i],m=corner?{x:segs[i-1].n.x+s.n.x,y:segs[i-1].n.y+s.n.y}:s.n,l=Math.hypot(m.x,m.y);quarter.push({x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t,n:{x:m.x/l,y:m.y/l},...(corner?{corner:segs[i-1].n,n2:s.n}:{})});};
  // the picture: holes 5, 10 and 15 on the corners, four steps up the arm's end to the next house
  if(arm===19)[5,5,5,4].forEach((count,i)=>{for(let k=0;k<count;k++)put(i,k/count,k===0&&i>0);});
  // a game from before the picture keeps its own count: the same walk, holes at equal steps
  else{const total=segs.reduce((m,s)=>m+s.len,0),step=total/arm;for(let k=0;k<arm;k++){let d=k*step,i=0;while(i<3&&d>segs[i].len+1e-9){d-=segs[i].len;i++;}put(i,d/segs[i].len,false);}}
  const place=(p,s)=>{const q=quarterTurn(p,s);return{x:+(C+q.x).toFixed(2),y:+(C+q.y).toFixed(2)};};
  const track=[],labels=[];
  // 33.9.2: every number sits outside the path, on the same side all the way round (the corner ones
  // used to sit inside, alone). A corner's number takes the free spot in its corner's outer fan.
  const D=CROSS.label,spot=quarter.map((p,k)=>k?{x:p.x+p.n.x*D,y:p.y+p.n.y*D}:null);
  quarter.forEach((p,k)=>{
    if(!k||!p.corner)return;let best=null,score=-Infinity;const a0=Math.atan2(p.corner.y,p.corner.x),a1=Math.atan2(p.n2.y,p.n2.x);
    for(let r=D;r<=D*1.6;r+=.3)for(let t=-.6;t<=1.6;t+=.05){const ang=a0+(a1-a0)*t,x=p.x+Math.cos(ang)*r,y=p.y+Math.sin(ang)*r;let m=Infinity;
      spot.forEach((o,j)=>{if(o&&j!==k)m=Math.min(m,Math.hypot(o.x-x,(o.y-y)*1.3));});for(const h of quarter)m=Math.min(m,Math.hypot(h.x-x,h.y-y)+1.2);
      m=Math.min(m,6.5);if(m-(r-D)*.1>score){score=m-(r-D)*.1;best={x,y};}}
    spot[k]=best;});
  for(let s=0;s<4;s++)quarter.forEach((p,k)=>{track.push(place(p,s));if(!k){labels.push(null);return;}const q=quarterTurn(spot[k],s);labels.push({x:+(C+q.x).toFixed(2),y:+(C+q.y).toFixed(2),num:k});});
  const g=CROSS.yardGap,[yx,yy]=CROSS.yard,step=arm===19?7.36:segs.reduce((m,s)=>m+s.len,0)/arm;
  return{kind:'cross',seats:4,arm,track,labels,step,hole:+Math.min(3.15,step*.4).toFixed(2),
    lanes:[0,1,2,3].map(s=>CROSS.lane.map(y=>place({x:0,y},s))),
    finish:[0,1,2,3].map(s=>place({x:0,y:CROSS.cup},s)),
    bases:[0,1,2,3].map(s=>[[-1,-1],[1,-1],[-1,1],[1,1]].map(([i,j])=>place({x:yx+i*g,y:yy+j*g},s)))};
}
// each player's portrait and name, in the corner of the screen by their yard (bottom = you)
const SEAT_SPOTS=Object.freeze([[-66,64,-66,77],[-64,-66,-64,-53],[66,-64,66,-51],[64,66,64,79]]);
// the octagon of the picture: corners cut at 54 units, flat sides at 98 from the middle
function octagon(inset){const E=98-inset,K=54.3-inset*.414;return [[-E+K,-E],[E-K,-E],[E,-E+K],[E,E-K],[E-K,E],[-E+K,E],[-E,E-K],[-E,-E+K]].map(([x,y])=>({x:+(100+x).toFixed(2),y:+(100+y).toFixed(2)}));}
const pathOf=pts=>'M'+pts.map(p=>p.x+' '+p.y).join('L')+'Z';
// the shop's Jackaroo boards: one board, many dresses
const BOARD_LOOKS=Object.freeze({
  neon:{surface:['#1d3378','#14275f','#0a1638'],weave:'grid',frame:'neon',edge:'#5cc0ff',spark:['#ff9b3d','#ffb347'],corners:['#7cc8ff','#3ee6c4','#b06cff','#ff9b3d'],hole:['#ffffff','#e8eef8','#a9b8d6'],holeRim:'#8fd3ff',label:'#ffffff',labelStroke:'#0a1638',lane:'#0b1532',house:'#f6f9ff',houseIcon:'#16224a',inset:'#56b6ff',insetFill:'#0f2257',plate:['#0c1636','#ffffff'],glow:true,emblem:'aces'},
  gold:{surface:['#2b2b2b','#1c1c1c','#0d0d0d'],weave:'felt',frame:'gold',edge:'#f3cf72',hole:['#fff8e3','#f2dfb2','#c49b52'],holeRim:'#b98a32',label:'#ecd39b',labelStroke:'#0d0d0d',lane:'#151515',house:'#fff3d4',houseIcon:'#3a2a10',inset:'#e9c46a',insetFill:'#141414',plate:['#151515','#f3d9a0'],glow:false,emblem:'crest'},
  emerald:{surface:['#36996c','#226a4a','#103a28'],weave:'club',frame:'wood',edge:'#e8c27a',hole:['#ffffff','#f1f5ee','#a6bfae'],holeRim:'#e2bf7a',label:'#fff4dc',labelStroke:'#0f3a28',lane:'#0f2e20',house:'#fffaf0',houseIcon:'#163626',inset:'#e8c27a',insetFill:'#1a5a3e',plate:['#123a2a','#fff4dc'],glow:false,emblem:'crest'},
  marble:{surface:['#ffffff','#f3f0ea','#ddd6c8'],weave:'marble',frame:'goldline',edge:'#c9a24f',hole:['#ffffff','#f7f4ee','#cfc4ad'],holeRim:'#a99268',label:'#3d3424',labelStroke:'#ffffff',lane:'#3a3631',house:'#ffffff',houseIcon:'#3d3424',inset:'#c9a24f',insetFill:'#f6f1e6',plate:['#fffaf0','#3a2f1a'],glow:false,emblem:'crest'},
  royal:{surface:['#5c3689','#3e2263','#1e1034'],weave:'royal',frame:'gold',edge:'#f6dc86',hole:['#fffaf0','#f3e1b0','#ae8838'],holeRim:'#f1cf7d',label:'#f6dc86',labelStroke:'#1e1034',lane:'#1c0f2e',house:'#fff6dc',houseIcon:'#3a2452',inset:'#f1cf7d',insetFill:'#2c1747',plate:['#2a1642','#fff3d0'],glow:false,emblem:'crest'},
  carbon:{surface:['#22313f','#16222e','#0a1118'],weave:'carbon',frame:'neon',edge:'#55e1ff',spark:['#2fb8ff','#9be9ff'],corners:['#55e1ff','#9b7bff','#55e1ff','#9b7bff'],hole:['#f2fdff','#cdeef8','#6a98aa'],holeRim:'#55e1ff',label:'#dff8ff',labelStroke:'#0a1118',lane:'#08121b',house:'#f2fdff',houseIcon:'#0b2531',inset:'#55e1ff',insetFill:'#0e1c28',plate:['#0e1f2c','#e3f8ff'],glow:true,emblem:'aces'},
  majlis:{surface:['#a3323f','#741c29','#3c0b14'],weave:'majlis',frame:'wood',edge:'#e7bf62',hole:['#fff8ec','#f3e2c4','#b48e57'],holeRim:'#e7bf62',label:'#fff0d8',labelStroke:'#3c0b14',lane:'#2a070d',house:'#fff6ea',houseIcon:'#4a1520',inset:'#e7bf62',insetFill:'#5c1622',plate:['#3c0e16','#fff0d8'],glow:false,emblem:'crest'},
});
/** Two colours and a hole for each board's button on the page. */
export const JACK_LOOK_SWATCH=Object.freeze(Object.fromEntries(Object.entries(BOARD_LOOKS).map(([k,v])=>[k,[v.surface[1],v.edge,v.hole[0]]])));
const WEAVE_GRID=[8,8,[['path',{d:'M8 0V8H0',fill:'none',stroke:'#9fc4ff','stroke-opacity':.07,'stroke-width':.25}]]];
const WEAVE_FELT=[2.4,2.4,[['circle',{cx:.6,cy:.6,r:.28,fill:'#ffffff','fill-opacity':.035}],['circle',{cx:1.8,cy:1.7,r:.22,fill:'#000000','fill-opacity':.18}]]];
const WEAVE_MARBLE=[60,60,[['path',{d:'M-5 18C12 10 22 30 38 20S58 6 66 14M-4 46C10 40 18 54 34 47S52 33 64 40M20 -4C24 10 18 24 26 36S30 56 24 64',fill:'none',stroke:'#b9b1a2','stroke-opacity':.35,'stroke-width':.45}]]];
function crossWeave(defs,prefix,key){if(key==='grid')return pattern(defs,prefix+'-weave',...WEAVE_GRID);if(key==='felt')return pattern(defs,prefix+'-weave',...WEAVE_FELT);if(key==='marble')return pattern(defs,prefix+'-weave',...WEAVE_MARBLE);const [w,h,parts]=WEAVE[key]||WEAVE.club;return pattern(defs,prefix+'-weave',w,h,parts);}
const HOUSE_ICON='M-1.55 -.15L0 -1.45L1.55 -.15M-1.05 -.55V1.25H1.05V-.55M-.38 1.25V.35H.38V1.25';
const LOCK_ICON='M-1.15 -.2V-.95A1.15 1.15 0 0 1 1.15 -.95V-.2M-1.6 -.2H1.6V1.75H-1.6Z';
/** 33.9.0: «مقفل» — a house with its owner's marble on it shuts the road (no marble passes it, the
    engine's roadShut). A gold ring round the house, and an upright plate in the nearest free spot
    by it (the holes, their numbers, the yards and the portraits are kept clear). */
export const LOCK_PHRASE='مقفل — صاحب البيت، لا يمكن المرور';
function lockBadges(root,overlay,L,state,colors){
  const locked=state.players.map((p,s)=>s<4&&(p.marbles||[]).some(m=>m===0)).map((on,s)=>on?s:-1).filter(s=>s>=0);
  if(!locked.length)return;
  const turn=p=>{const r=ROT*Math.PI/180,c=Math.cos(r),q=Math.sin(r),x=p.x-100,y=p.y-100;return{x:100+x*c-y*q,y:100+x*q+y*c};};
  const dots=[...L.track,...L.lanes.flat(),...L.bases.flat()].map(p=>({...turn(p),r:L.hole+1.1})).concat(L.labels.filter(Boolean).map(p=>({...turn(p),r:3.1})),{x:100,y:100,r:29});
  const view=SEAT_SPOTS.map(([ax,ay,px,py])=>[{x:100+ax,y:100+ay,r:8.6},{x:100+px,y:100+py,w:30,h:7.4}]).flat();
  const W=16.6,H=7,taken=[];
  const clear=(c)=>{const x0=c.x-W/2,x1=c.x+W/2,y0=c.y-H/2,y1=c.y+H/2;if(x0<9.5||x1>190.5||y0<9||y1>191)return false;
    for(const o of [...dots,...view.filter(v=>v.r),...taken]){if(o.w){if(Math.abs(o.x-c.x)<(o.w+W)/2+.6&&Math.abs(o.y-c.y)<(o.h+H)/2+.6)return false;continue;}const dx=Math.max(x0-o.x,0,o.x-x1),dy=Math.max(y0-o.y,0,o.y-y1);if(Math.hypot(dx,dy)<o.r+.5)return false;}
    for(const o of view.filter(v=>v.w))if(Math.abs(o.x-c.x)<(o.w+W)/2+.6&&Math.abs(o.y-c.y)<(o.h+H)/2+.6)return false;return true;};
  for(const s of locked){
    const house=L.track[s*L.arm],h=turn(house),out=Math.atan2(h.y-100,h.x-100);
    // the gold ring stays on the turned board, round the house (outside its marble)
    root.append(n('circle',{cx:house.x,cy:house.y,r:+(L.hole*1.2+2.2).toFixed(2),fill:'none',stroke:'#f6c25c','stroke-width':.75,'stroke-dasharray':'1.6 1','data-house-lock':s,'pointer-events':'none'}));
    let at=null;
    for(const d of [9,10.5,12,13.5,15,17,19,21,24])for(let k=0;k<24&&!at;k++){const a=out+(k%2?1:-1)*Math.ceil(k/2)*Math.PI/12,c={x:h.x+Math.cos(a)*d,y:h.y+Math.sin(a)*d};if(clear(c))at=c;}
    if(!at)continue;
    taken.push({x:at.x,y:at.y,w:W,h:H});
    const g=n('g',{'data-lock-badge':s,'data-cx':+at.x.toFixed(2),'data-cy':+at.y.toFixed(2),role:'img','aria-label':LOCK_PHRASE});
    g.append(n('rect',{x:+(at.x-W/2).toFixed(2),y:+(at.y-H/2).toFixed(2),width:W,height:H,rx:H/2,fill:'#1a1306',stroke:'#f6c25c','stroke-width':.6,opacity:.96}));
    g.append(n('path',{d:LOCK_ICON,transform:`translate(${(at.x+W/2-3.2).toFixed(2)} ${(at.y-.3).toFixed(2)}) scale(.9)`,fill:'none',stroke:colors[s]||'#f6c25c','stroke-width':.62,'stroke-linejoin':'round'}));
    g.append(n('text',{x:+(at.x-2.3).toFixed(2),y:+(at.y+1.45).toFixed(2),'text-anchor':'middle','font-size':4.1,'font-weight':900,'font-family':'Tajawal,Arial,sans-serif',fill:'#ffe7a3'},'مقفل'));
    overlay.append(g);
  }
}
// the frame of each look: neon light, a gold band, walnut wood, or a gold line on marble
function crossFrame(root,defs,prefix,look){
  const outer=pathOf(octagon(0)),band=pathOf(octagon(3.1)),inner=pathOf(octagon(4));
  root.append(n('path',{d:outer,fill:'#000',opacity:.35,transform:'translate(0 1.6)'}));
  if(look.frame==='neon'){
    root.append(n('path',{d:outer,fill:'#050a1c'}),n('path',{d:band,fill:radial(defs,prefix+'-surface',[[0,look.surface[0]],[.6,look.surface[1]],[1,look.surface[2]]],.5,.5,.72)}));
    const line=(d,attrs)=>root.append(n('path',{d,fill:'none','stroke-linejoin':'round',...attrs}));
    line(pathOf(octagon(2.6)),{stroke:look.edge,'stroke-width':3.8,opacity:.13});line(pathOf(octagon(2.6)),{stroke:look.edge,'stroke-width':1.8,opacity:.32});
    line(pathOf(octagon(2.6)),{stroke:mix(look.edge,'#ffffff',.55),'stroke-width':1.1});line(pathOf(octagon(5.6)),{stroke:look.edge,'stroke-width':.45,opacity:.75});
    // the lights along the frame, warm on the sides as in the picture
    const spark=radial(defs,prefix+'-spark',[[0,look.spark[1],1],[.35,look.spark[0],.55],[1,look.spark[0],0]]);
    for(const [x,y] of [[70,2.6],[130,2.6],[70,197.4],[130,197.4]])root.append(n('ellipse',{cx:x,cy:y,rx:9,ry:3.1,fill:spark,opacity:.9}));
    for(const [x,y] of [[2.6,73],[2.6,127],[197.4,73],[197.4,127]])root.append(n('ellipse',{cx:x,cy:y,rx:9,ry:3.1,fill:spark,opacity:.9,transform:`rotate(90 ${x} ${y})`}));
    look.corners.forEach((tint,i)=>{const [x,y,a]=[[31,31,-45],[169,31,45],[169,169,-45],[31,169,45]][i],glow=radial(defs,`${prefix}-corner-${i}`,[[0,'#ffffff',.85],[.3,tint,.6],[1,tint,0]]);root.append(n('ellipse',{cx:x,cy:y,rx:12,ry:3.4,fill:glow,transform:`rotate(${a} ${x} ${y})`}));});
  }else{
    const gold=gradient(defs,prefix+'-gold',[[0,'#fff3c4'],[.22,'#e4b552'],[.5,'#9b6b1d'],[.74,'#f2cf74'],[1,'#a4741f']],1,1);
    const wood=gradient(defs,prefix+'-wood',[[0,'#a87444'],[.45,'#6b4424'],[1,'#3a2210']],1,1);
    root.append(n('path',{d:outer,fill:look.frame==='wood'?wood:look.frame==='goldline'?'#f3efe6':gold}));
    if(look.frame==='wood')root.append(n('path',{d:outer,fill:pattern(defs,prefix+'-grain',14,4,[['path',{d:'M0 1C4 .2 9 2 14 1M0 3C5 2.4 9 3.6 14 3',fill:'none',stroke:'#2a1608','stroke-opacity':.25,'stroke-width':.35}]])}));
    root.append(n('path',{d:band,fill:radial(defs,prefix+'-surface',[[0,look.surface[0]],[.6,look.surface[1]],[1,look.surface[2]]],.5,.5,.72)}));
    root.append(n('path',{d:outer,fill:'none',stroke:look.frame==='goldline'?'#c9a24f':'#ffffff','stroke-width':look.frame==='goldline'?1.1:.5,opacity:look.frame==='goldline'?1:.45}));
    root.append(n('path',{d:band,fill:'none',stroke:look.frame==='wood'?'#e2bf7a':look.edge,'stroke-width':look.frame==='gold'?.9:.6}));
    if(look.frame==='goldline')root.append(n('path',{d:inner,fill:'none',stroke:'#c9a24f','stroke-width':.35,opacity:.8}));
  }
  root.append(n('path',{d:band,fill:crossWeave(defs,prefix,look.weave)}));
}
// the middle: an octagon; the last three cards played, or the board's own crest before the first
function crossMiddle(root,defs,prefix,state,look,pile,colors){
  const g=n('g',{'data-pile':'true'}),oct=polygon(8,26.9,Math.PI/8),in2=polygon(8,24.6,Math.PI/8);
  if(look.glow)g.append(n('path',{d:oct,fill:'none',stroke:look.inset,'stroke-width':5,opacity:.14}));
  g.append(n('path',{d:oct,fill:look.insetFill,stroke:look.inset,'stroke-width':look.frame==='gold'?1.6:1}),n('path',{d:in2,fill:'none',stroke:look.inset,'stroke-width':.45,opacity:.8}));
  const shown=(Array.isArray(pile)?pile:(state.discard||[])).filter(c=>c&&c!=='?').slice(-3);
  if(!shown.length&&state.lastEvent?.card&&state.lastEvent.card!=='?')shown.push(state.lastEvent.card);
  const cards=n('g',{'data-pile-cards':shown.length}),w=13.4,h=18.8;
  if(!shown.length){
    if(look.emblem==='crest'){
      cards.append(n('path',{d:'M100 85.2C96 89.6 92.4 92.2 92.4 95.4C92.4 97.6 94 98.9 95.8 98.9C97.2 98.9 98.3 98.2 99 97.2C98.8 99 98.2 100.4 97 101.4H103C101.8 100.4 101.2 99 101 97.2C101.7 98.2 102.8 98.9 104.2 98.9C106 98.9 107.6 97.6 107.6 95.4C107.6 92.2 104 89.6 100 85.2Z',fill:'none',stroke:look.inset,'stroke-width':.7}));
      cards.append(n('text',{x:100,y:108.4,'text-anchor':'middle','font-size':6.4,'font-weight':900,'font-family':'Tajawal,Arial,sans-serif',fill:look.inset},'الجاكارو'));
      cards.append(n('path',{d:'M92 112.6C95 114.6 98 115 100 113.6C102 115 105 114.6 108 112.6M93.6 111.4C94.6 110.2 95.8 110 96.6 110.8M106.4 111.4C105.4 110.2 104.2 110 103.4 110.8',fill:'none',stroke:look.inset,'stroke-width':.55,'stroke-linecap':'round'}));
    }else [[-13,'AD'],[0,'AH'],[13,'AS']].forEach(([angle,card],i)=>cards.append(pileCard(defs,prefix,card,100-w/2,100-h/2-1.6,w,h,angle,false)));
  }else{
    const angles=shown.length===3?[-15,15,0]:shown.length===2?[-11,0]:[0];
    shown.forEach((card,i)=>cards.append(pileCard(defs,prefix,card,100-w/2,100-h/2-2.2,w,h,angles[i],i===shown.length-1)));
  }
  g.append(up(cards,100,100));root.append(g);
}
function drawJackCross(root,overlay,defs,prefix,state,L,look,active,{avatars=[],pile=null,viewer=-1}={}){
  const names=state.players.map(playerLabel),geo=boardGeometry(state),colors=JACK_COLORS,fill=geo.fill;
  crossFrame(root,defs,prefix,look);
  // the home lanes: a line from the house to the lane, the four holes up the middle of the arm
  for(let s=0;s<4;s++){
    const color=colors[s],house=L.track[s*L.arm],lane=L.lanes[s],g=n('g',{'data-lane':s});
    g.append(n('path',{d:'M'+xy(house)+lane.map(p=>'L'+xy(p)).join(''),fill:'none',stroke:color,'stroke-width':.55,opacity:.9}));
    lane.forEach((p,h)=>{if(look.glow)g.append(n('circle',{cx:p.x,cy:p.y,r:L.hole+1,fill:'none',stroke:color,'stroke-width':1.2,opacity:.25}));g.append(n('circle',{cx:p.x,cy:p.y,r:L.hole*.92,fill:look.lane,stroke:color,'stroke-width':.95,'data-home':s+':'+h,'data-safe':s+':'+h,class:'tbl-hole'}));});
    if(!fill){const cup=L.finish[s];g.append(n('circle',{cx:cup.x,cy:cup.y,r:L.hole*1.05,fill:look.lane,stroke:color,'stroke-width':.6,'stroke-dasharray':'1 .8','data-finish-cup':s}),n('path',{d:star(cup.x,cup.y,L.hole*.7),fill:color,opacity:.85}));}
    root.append(g);
  }
  // the yards: four holes, two by two, in the corner by each arm
  for(let s=0;s<4;s++){
    const color=colors[s],on=s===active,g=n('g',{'data-pocket':s,'data-active':String(on)});
    L.bases[s].forEach((b,i)=>g.append(n('circle',{cx:b.x,cy:b.y,r:L.hole,fill:look.lane,stroke:color,'stroke-width':.8,opacity:.9,'data-yard':s+':'+i})));
    root.append(g);
  }
  // the walk: white holes, their numbers outside the path on one side, upright; the houses with their roofs
  const holeFill=radial(defs,prefix+'-hole',[[0,look.hole[0]],[.62,look.hole[1]],[1,look.hole[2]]],.42,.36,.7);
  L.track.forEach((p,i)=>{
    const seat=Math.floor(i/L.arm),k=i-seat*L.arm,color=colors[seat];
    if(k===0){
      if(look.glow)root.append(n('circle',{cx:p.x,cy:p.y,r:L.hole*1.2+1.6,fill:'none',stroke:color,'stroke-width':2,opacity:.3}));
      root.append(n('circle',{cx:p.x,cy:p.y,r:+(L.hole*1.2).toFixed(2),fill:look.house,stroke:color,'stroke-width':1.3,'data-track':i,'data-house':seat,class:'tbl-hole'}));
      // the roof stays upright: the icon turns inside its own group
      const roof=n('g',{'pointer-events':'none'});roof.append(n('path',{d:HOUSE_ICON,transform:`translate(${p.x} ${p.y}) scale(${(L.hole*.62).toFixed(2)})`,fill:'none',stroke:look.houseIcon,'stroke-width':(.42/(L.hole*.62)).toFixed(3),'stroke-linecap':'round','stroke-linejoin':'round'}));root.append(up(roof,p.x,p.y));
      return;
    }
    const r=L.hole;
    root.append(n('circle',{cx:p.x,cy:+(p.y+.35).toFixed(2),r:+(r+.45).toFixed(2),fill:'#000',opacity:.28}),n('circle',{cx:p.x,cy:p.y,r,fill:holeFill,stroke:look.holeRim,'stroke-width':.55,'data-track':i,class:'tbl-hole'}));
    const at=L.labels[i],size=k<10?4.7:4.3;
    root.append(up(n('text',{x:at.x,y:+(at.y+size*.36).toFixed(2),'text-anchor':'middle','font-size':size,'font-weight':900,'font-family':'Arial,sans-serif',direction:'ltr',fill:look.label,'paint-order':'stroke',stroke:look.labelStroke,'stroke-width':.55,'pointer-events':'none','data-track-number':k,class:'tbl-num'},String(k)),at.x,at.y));
  });
  crossMiddle(root,defs,prefix,state,look,pile,colors);
  lockBadges(root,overlay,L,state,colors);
  // the players: on the screen, each in the corner by their own yard; you at the bottom
  const view=Number.isInteger(viewer)&&viewer>=0&&viewer<4?viewer:0;
  for(let s=0;s<4&&s<state.players.length;s++){
    const color=colors[s],on=s===active,[ax,ay,px,py]=SEAT_SPOTS[(s-view+4)%4],face={x:100+ax,y:100+ay},tag={x:100+px,y:100+py},r=6.6;
    const g=n('g',{'data-seat':s,'data-player-tag':s,'data-active':String(on),role:'button',tabindex:0,'aria-label':'ملف '+(names[s]||'اللاعب')});
    if(on||look.glow)g.append(n('circle',{cx:face.x,cy:face.y,r:r+1.6,fill:'none',stroke:color,'stroke-width':on?2.2:1.3,opacity:on?.6:.22,class:on?'yard-glow':null}));
    g.append(n('circle',{cx:face.x,cy:face.y,r,fill:mix(color,'#000000',.62),stroke:color,'stroke-width':on?1.3:.9}));
    const hero=avatars[s],url=hero?(String(hero).includes('/')?String(hero):globalThis.BS_CHARACTERS?.poster?.(hero)):'';
    if(url){const clip=n('clipPath',{id:`${prefix}-face-${s}`});clip.append(n('circle',{cx:face.x,cy:face.y,r:r-.45}));defs.append(clip);const W=r*4.1,H=W*320/384;g.append(n('image',{href:url,x:(face.x-W/2).toFixed(2),y:(face.y-H*.36).toFixed(2),width:W.toFixed(2),height:H.toFixed(2),preserveAspectRatio:'xMidYMid meet','clip-path':`url(#${prefix}-face-${s})`}));}
    else g.append(n('text',{x:face.x,y:(face.y+r*.36).toFixed(2),'text-anchor':'middle','font-size':(r*1.05).toFixed(2),'font-weight':900,'font-family':'Tajawal,Arial,sans-serif',fill:'#ffffff'},([...(names[s]||'؟')][0]||'؟')));
    const fit=fitName(names[s]||'',24,3.2,1),pw=Math.min(28,Math.max(15,fit.width+5)),ph=6.2;
    g.append(n('rect',{x:(tag.x-pw/2).toFixed(2),y:(tag.y-ph/2).toFixed(2),width:pw.toFixed(2),height:ph,rx:ph/2,fill:on?mix(color,look.plate[0],.5):look.plate[0],stroke:color,'stroke-width':on?.9:.55,opacity:.97}),nameText(tag.x,tag.y,fit,{fill:look.plate[1]}));
    overlay.append(g);
  }
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
function stoneGraphic(game,defs,prefix,seat,c,own,size=.66){
  const P=pieces(),color=(game==='jackaroo'?JACK_COLORS:BOARD_COLORS)[seat],chosen=own||equipped('pawn'),pawn=chosen==='pawn-character'?'pawn-classic':chosen;
  if(game==='jackaroo'){
    const g=n('g',{transform:`scale(${size})`});
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
  const {game='zahra',legal=[],legalStones=[],onPick=()=>{},onSelect=null,active=state.turn,material,pawn,preview=false,looks=null,viewer=-1,avatars=null,pile=null,quiet=false}=options;
  const g=boardGeometry(state),themeKey=material&&THEMES[material]?material:MATERIALS[material]||MATERIALS[equipped('table')]||'walnut',theme=THEMES[themeKey],pawnId=pawn?Object.keys(KINDS).find(k=>KINDS[k]===(LEGACY_KINDS[pawn]||pawn))||'pawn-classic':equipped('pawn');
  // 33.6.0: the Jackaroo board's look: asked for, else a shop table's (previews), else the player's
  // 33.7.0: the Jackaroo board's look: asked for (the shop's previews), else the board you equipped
  const lookKey=game!=='jackaroo'?'':options.look&&BOARD_LOOKS[options.look]?options.look:jackLook();
  // the Jackaroo board turns so your own seat is at the bottom, by your hand
  const seat=Number.isInteger(viewer)&&viewer>=0&&viewer<g.seats?viewer:-1;
  ROT=game!=='jackaroo'||seat<0?0:g.seats===4?[0,-90,180,90][seat]:((180-seat*360/g.seats)%360+540)%360-180;if(ROT===-180)ROT=180;
  const pileCards=game==='jackaroo'?(Array.isArray(pile)?pile:(state.discard||[]).slice(-3)).concat(state.lastEvent?.card||[]):[];
  const signature=JSON.stringify([game,active,themeKey,lookKey,pawnId,legal,legalStones,quiet,looks,avatars,pileCards,g.arm,ROT,seat,state.players.map(p=>[p.name,p.tokens||p.marbles])]),existing=target.querySelector('.petal-board-v30'),previous=existing?motionHistory.get(target):null;
  if(!preview)surfaces.set(target,{state,options});
  if(existing&&previous?.signature===signature)return existing;
  const prefix='tbl-'+(++sequence),L=layoutFor(game,g.seats,g.arm);
  const svg=n('svg',{viewBox:'0 0 200 200',role:'group','aria-label':game==='zahra'?'لوحة الزهرة؛ أربعة أحجار لكل لاعب':'طاولة جاكارو؛ أربع كرات لكل لاعب','data-material':themeKey,'data-look':lookKey||null,'data-game':game,'data-seats':g.seats,'data-arm':game==='jackaroo'?g.arm:null});
  svg.classList.add('petal-board-v29','petal-board-v30','table-v31');
  const defs=n('defs'),root=n('g',{'data-board-root':'','data-rot':ROT,transform:ROT?`rotate(${ROT} 100 100)`:null});svg.append(defs,root);
  // the players' portraits stay upright in the corners of the screen, outside the turned board
  const overlay=n('g',{'data-layer':'players'});
  if(game==='jackaroo'&&L.kind==='cross')drawJackCross(root,overlay,defs,prefix,state,L,BOARD_LOOKS[lookKey],active,{avatars:avatars||[],pile,viewer:seat});
  else if(game==='jackaroo')drawStar(root,defs,prefix,state,L,LOOKS[STAR_LOOK[lookKey]||'neon'],active,lookKey,{avatars:avatars||[],pile});else drawCross(root,defs,prefix,state,L,theme,active);
  const positions=new Map(),values=new Map(),motions=[],effects=[],traces=[],cellSize=L.c||12.8;
  // a marble a little bigger than its hole, never wider than the step between two holes
  const marble=game==='jackaroo'?Math.min(L.hole*1.38,L.step*.49):0,marbleScale=+(marble/6.5*1.35).toFixed(3);
  const stoneLayer=n('g',{'data-layer':'stones'});
  // Stones further down the board are drawn later so they overlap correctly.
  const order=[];state.players.forEach((player,seat)=>(player.tokens||player.marbles).forEach((progress,index)=>order.push({seat,index,progress,p:petalStonePoint(state,seat,index,game)})));
  order.sort((a,b)=>a.p.y-b.p.y);
  for(const {seat,index,progress,p} of order){
    const player=state.players[seat],key=seat+':'+index,can=seat===active&&legal.includes(index)||legalStones.includes(key);
    // 33.9.0: quiet — the taps are read by the page from the whole board; a playable marble only keeps the keyboard
    const piece=n('g',{'data-stone':key,'data-player':seat,'data-token':index,transform:`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`,role:'button',tabindex:can?0:-1,'pointer-events':can&&!quiet?'auto':'none','aria-label':player.name+'، '+(game==='jackaroo'?'كرة ':'حجر ')+(index+1)+(can&&!quiet?'، حركة متاحة':''),'aria-disabled':String(!can)});
    piece.classList.add('petal-stone-v29','atelier-piece-v30');if(can&&!quiet)piece.classList.add('legal');
    piece.append(n('circle',{r:game==='jackaroo'?+Math.max(3.6,Math.min(4.6,L.step*.62)).toFixed(2):6.2,cy:game==='jackaroo'?0:-2,fill:'transparent'}));
    if(can&&!quiet)piece.append(n('ellipse',{cx:0,cy:game==='jackaroo'?0:cellSize*.28,rx:game==='jackaroo'?+(marble+.9).toFixed(2):cellSize*.42,ry:game==='jackaroo'?+(marble+.9).toFixed(2):cellSize*.2,fill:'none',stroke:'#ffffff','stroke-width':.7,'data-legal-ring':'true',class:'legal-ring'}));
    // 33.9.2: a ring of the seat's colour round every marble: a white or silver one shows on a white hole
    if(game==='jackaroo')piece.append(n('circle',{r:+(marble+1.05).toFixed(2),fill:'none',stroke:'#08101f','stroke-width':.5,opacity:.55,'data-seat-ring':'out'}),n('circle',{r:+(marble+.5).toFixed(2),fill:'none',stroke:JACK_COLORS[seat],'stroke-width':1,'data-seat-ring':seat}));
    const bob=n('g',{class:'stone-bob'});bob.append(stoneGraphic(game,defs,prefix,seat,cellSize,looks?.[seat],marbleScale||.66));piece.append(bob);piece.append(n('text',{x:0,y:game==='jackaroo'?+(marble*.27).toFixed(2):0,'text-anchor':'middle','data-piece-number':true,'pointer-events':'none','font-size':game==='jackaroo'?3.6:2.5,'font-weight':700,fill:'#ffffff',stroke:'#15202b','stroke-width':.5,'paint-order':'stroke',transform:ROT?`rotate(${-ROT})`:null},String(index+1)));
    if(can){const pick=()=>onSelect?onSelect(seat,index):onPick(index);if(!quiet)piece.onclick=pick;piece.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick();}};}
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
        if(!captured)traces.push({points,color:(game==='jackaroo'?JACK_COLORS:BOARD_COLORS)[seat],duration});
      }
      effects.push({p:captured?old:p,color:captured?'#f38286':progress>=g.finish?'#f4d9a0':(game==='jackaroo'?JACK_COLORS:BOARD_COLORS)[seat],kind:captured?'capture':progress>=g.finish?'finish':'land'});
    }
    positions.set(key,p);values.set(key,progress);
  }
  root.append(stoneLayer);svg.append(overlay);
  target.replaceChildren(svg);
  for(const fx of traces)trace(root,fx.points,fx.color,fx.duration);
  for(const fx of effects)flourish(root,fx.p,fx.color,fx.kind);
  ROT=0;
  motionHistory.set(target,{positions,values,signature});
  target.atelierMotion=Promise.all(motions);target.dispatchEvent(new Event('bs-board-render'));
  return svg;
}
globalThis.addEventListener?.('bs-career-change',()=>{for(const [target,{state,options}] of surfaces){if(target.isConnected)renderPetalBoard(target,state,options);else surfaces.delete(target);}});

export function clearBoardPreview(target){target?.querySelectorAll('[data-move-preview]').forEach(el=>el.remove());}
export function paintBoardPreview(target,before,after,{game='jackaroo',action={}}={}){
 clearBoardPreview(target);const svg=target.querySelector('svg');if(!svg)return;
 const host=svg.querySelector('[data-board-root]')||svg,rot=Number(host.getAttribute?.('data-rot'))||0;
 const layer=n('g',{'data-move-preview':true,'aria-hidden':'true','pointer-events':'none'}),g=boardGeometry(before),key=game==='jackaroo'?'marbles':'tokens';
 before.players.forEach((player,seat)=>player[key].forEach((from,index)=>{
  const to=after.players[seat][key][index];if(from===to)return;const first=petalStonePoint(before,seat,index,game),last=petalStonePoint(after,seat,index,game);
  if(to<0){layer.append(n('circle',{cx:first.x,cy:first.y,r:5,fill:'#ef6d6d28',stroke:'#ff9393','stroke-width':.9}));return;}
  const points=[first];
  if(from>=0&&action.type!=='swap'){
   const steps=action.backward?(from-to+g.track)%g.track:to-from;
   if(steps>=0&&steps<=14)for(let i=1;i<steps;i++){const p=action.backward?(from-i+g.track)%g.track:from+i;points.push(rawPoint(before,seat,index,p,game));}
  }
  points.push(last);layer.append(n('path',{d:points.map((p,i)=>(i?'L':'M')+xy(p)).join(' '),'data-preview-route':true}));
  layer.append(n('circle',{cx:last.x,cy:last.y,r:game==='jackaroo'?5:6,'data-preview-destination':true}));
  layer.append(n('text',{x:last.x,y:last.y+1.3,'text-anchor':'middle','font-size':3.6,fill:'#fff5da','paint-order':'stroke',stroke:'#142632','stroke-width':.7,transform:rot?`rotate(${-rot} ${last.x} ${last.y})`:null},String(index+1)));
 }));host.append(layer);return layer;
}

// Fit the board coordinates to the viewport, preserving round marbles and upright type.
const viewportTransforms=new WeakMap();
function fitMark(node,ratio,rot,x=0,y=0,upright=false){
 if(!viewportTransforms.has(node))viewportTransforms.set(node,node.getAttribute('transform')||'');
 const base=viewportTransforms.get(node),angle=upright?0:rot,unit=Math.min(1,ratio);
 node.setAttribute('transform',base+' translate('+x+' '+y+') rotate('+(-angle)+') scale('+unit+' '+(unit/ratio)+') rotate('+angle+') translate('+(-x)+' '+(-y)+')');
}
export function fitJackarooViewport(target,width,height){
 const svg=target.querySelector('svg');
 if(!svg||width<1||height<1)return;
 const ratio=Math.max(.25,Math.min(3,height/width));
 let fit=svg.querySelector('[data-board-fit]');
 if(!fit){
  fit=n('g',{'data-board-fit':'true'});
  for(const child of [...svg.children])if(child.tagName.toLowerCase()!=='defs')fit.append(child);
  svg.append(fit);
 }
 fit.setAttribute('transform','scale(1 '+ratio+')');
 svg.setAttribute('viewBox','0 0 200 '+(200*ratio));
 svg.setAttribute('preserveAspectRatio','xMidYMid meet');
 svg.dataset.fitRatio=String(ratio);
 const root=svg.querySelector('[data-board-root]'),rot=Number(root?.getAttribute('data-rot'))||0;
 for(const piece of svg.querySelectorAll('[data-stone]')){
  let shape=piece.querySelector('[data-viewport-piece]');
  if(!shape){
   shape=n('g',{'data-viewport-piece':'true'});
   for(const child of [...piece.children])shape.append(child);
   piece.append(shape);
  }
  fitMark(shape,ratio,rot);
 }
 for(const group of svg.querySelectorAll('[data-pile]'))fitMark(group,ratio,rot,100,100);
 for(const group of svg.querySelectorAll('[data-player-tag],[data-avatar],[data-lock-badge]')){
  const circle=group.querySelector('circle'),cx=group.getAttribute('data-cx')??circle?.getAttribute('cx'),cy=group.getAttribute('data-cy')??circle?.getAttribute('cy');
  fitMark(group,ratio,group.getAttribute('data-avatar')!==null?rot:0,Number(cx)||100,Number(cy)||100);
 }
 for(const node of svg.querySelectorAll('circle,ellipse,text')){
  if(node.closest('defs,[data-stone],[data-pile],[data-player-tag],[data-avatar],[data-lock-badge]'))continue;
  const text=node.tagName.toLowerCase()==='text';
  fitMark(node,ratio,rot,Number(node.getAttribute(text?'x':'cx'))||0,Number(node.getAttribute(text?'y':'cy'))||0,text);
 }
}
