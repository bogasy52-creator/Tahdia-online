import {boardGeometry,boardStonePosition,stoneOffset} from './engines/board-geometry-v29.js';
export const BOARD_COLORS=['#db7680','#62badd','#e8bd70','#75c6a4','#b8a0e0','#efa676'];
const NS='http://www.w3.org/2000/svg',motionHistory=new WeakMap(),surfaces=new Map();let sequence=0;
const palettes={
 walnut:{base:'#34241d',dark:'#180f0c',light:'#785443',metal:'#c5a575',ink:'#f1e4cc',hole:'#0f171a',grain:'#d2ad7c'},
 ivory:{base:'#ded8c8',dark:'#9d9480',light:'#faf5e9',metal:'#7d7666',ink:'#293638',hole:'#28383d',grain:'#9d9584'},
 carbon:{base:'#202c32',dark:'#0b1318',light:'#43515a',metal:'#8ca6ad',ink:'#edf1e8',hole:'#050c11',grain:'#6f858e'},
 jade:{base:'#214c42',dark:'#102d28',light:'#4c8775',metal:'#d0b77e',ink:'#e9efdc',hole:'#0a2624',grain:'#b3c8a4'}
};
const materials={'table-club':'walnut','table-gallery':'ivory','table-nocturne':'carbon','table-botanic':'jade','table-emerald':'jade','table-midnight':'carbon','table-cyber':'carbon'};
const pawnKinds={'pawn-atlas':'spire','pawn-rook':'rook','pawn-orbit':'orbit','pawn-lance':'lance','pawn-lotus':'lotus','pawn-monolith':'monolith','pawn-orb':'orbit','pawn-crown':'lotus','pawn-prism':'monolith'};
const n=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=String(text);return el;};
const polar=(a,r)=>({x:100+Math.cos(a)*r,y:100+Math.sin(a)*r});
const xy=p=>p.x+' '+p.y,paint=id=>'url(#'+id+')';
const reduce=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
const equipped=type=>globalThis.BS_CAREER?.get?.()?.equipped?.[type]||document.documentElement?.dataset?.[type]||'';
function trackPoint(g,index,game){const a=index*2*Math.PI/g.track-Math.PI/2,c=Math.cos(a),s=Math.sin(a),r=game==='jackaroo'&&g.seats===4?53/Math.pow(c**4+s**4,.25):54;return polar(a,r);}
function rawPoint(state,seat,index,progress,game){
 const g=boardGeometry(state),a=seat*2*Math.PI/g.seats-Math.PI/2;
 if(progress<0){const p=polar(a,81),t=a+Math.PI/2,side=index%2?4.2:-4.2,depth=index<2?-4.4:4.4;return{x:p.x+Math.cos(t)*side+Math.cos(a)*depth,y:p.y+Math.sin(t)*side+Math.sin(a)*depth};}
 if(progress>=g.track)return polar(a,progress===g.finish?9:36-(progress-g.track)*6);
 return trackPoint(g,boardStonePosition(seat,progress,state),game);
}
export function petalStonePoint(state,seat,index,game='zahra'){
 const g=boardGeometry(state),value=(state.players[seat].tokens||state.players[seat].marbles)[index],p=rawPoint(state,seat,index,value,game);
 if(value<0)return p;const stack=[];
 state.players.forEach((player,pi)=>(player.tokens||player.marbles).forEach((v,ti)=>{if(value<g.track?boardStonePosition(pi,v,state)===boardStonePosition(seat,value,state):pi===seat&&v===value)stack.push(pi+':'+ti);}));
 const o=stoneOffset(stack.indexOf(seat+':'+index),stack.length,Math.min(4.1,1.8+stack.length*.5));return{x:p.x+o.x,y:p.y+o.y};
}
export function createAtelierPiece({prefix='piece',color='#72b9cb',kind='spire',number='',metal='#c3ac82'}={}){
 const piece=n('g',{'data-piece-design':kind}),body=paint(prefix+'-body'),edge=paint(prefix+'-metal');
 piece.append(n('ellipse',{cx:0,cy:2.5,rx:4.8,ry:1.5,fill:'#000',opacity:.32}),n('path',{d:'M-3.9 0v1.3Q0 3.1 3.9 1.3V0Z',fill:'#1d2428'}),n('ellipse',{cx:0,cy:0,rx:3.9,ry:1.5,fill:edge,stroke:metal,'stroke-width':.24}),n('ellipse',{cx:0,cy:-.1,rx:3.1,ry:1,fill:color,opacity:.95}));
 if(kind==='rook')piece.append(n('path',{d:'M-2.8-1.2 -2.1-6.5 -2.8-7V-10h1.8v1.1h.8V-10h1.8v1.1h.8V-10H3v3l-.8.5L2.8-1.2Q0 .5-2.8-1.2Z',fill:body,stroke:metal,'stroke-width':.23}),n('path',{d:'M-1.3-6.7v4.6M1.3-6.7v4.6',stroke:'#fff',opacity:.35,'stroke-width':.3}));
 else if(kind==='orbit')piece.append(n('path',{d:'M-1.7-1.3 -1-4h2l.7 2.7Z',fill:edge}),n('circle',{cx:0,cy:-6.2,r:2.8,fill:body,stroke:metal,'stroke-width':.23}),n('ellipse',{cx:0,cy:-6.2,rx:3.8,ry:1.55,fill:'none',stroke:metal,'stroke-width':.55,transform:'rotate(-28 0 -6.2)'}),n('circle',{cx:-.8,cy:-7.2,r:.65,fill:'#fff',opacity:.8}));
 else if(kind==='lance')piece.append(n('path',{d:'M-2.9-1.1 -1.2-6.7 0-11.5 2-7.2 2.8-1.1Q0 .6-2.9-1.1Z',fill:body,stroke:metal,'stroke-width':.25}),n('path',{d:'M0-10.7 .4-2.2',stroke:'#fff','stroke-width':.45,opacity:.65}));
 else if(kind==='lotus')piece.append(n('path',{d:'M0-1Q-5-3-3.3-7.5-1.4-7 0-4 1.4-7 3.3-7.5 5-3 0-1Z',fill:body,stroke:metal,'stroke-width':.23}),n('path',{d:'M0-2.4Q-3.1-5.5 0-10.5 3.1-5.5 0-2.4Z',fill:body,stroke:'#ffffff99','stroke-width':.3}));
 else if(kind==='monolith')piece.append(n('path',{d:'M0-11.4 3.3-7.7 2.7-2 0-.7 -2.7-2 -3.3-7.7Z',fill:body,stroke:metal,'stroke-width':.25}),n('path',{d:'M0-11.4V-.7L-2.7-2-3.3-7.7Z',fill:'#fff',opacity:.16}),n('path',{d:'M-3.3-7.7 0-6.3 3.3-7.7M0-6.3V-.7',fill:'none',stroke:'#fff',opacity:.5,'stroke-width':.25}));
 else piece.append(n('path',{d:'M-3-1.2Q-1.1-3.6-1.2-6.4L1.2-6.4Q1.1-3.6 3-1.2Q0 .4-3-1.2Z',fill:body,stroke:metal,'stroke-width':.22}),n('circle',{cx:0,cy:-8,r:2.25,fill:body,stroke:metal,'stroke-width':.22}),n('ellipse',{cx:-.7,cy:-8.7,rx:.6,ry:.8,fill:'#fff',opacity:.6}));
 if(number!=='')piece.append(n('text',{x:0,y:1.15,'text-anchor':'middle','font-size':1.65,'font-family':'sans-serif',fill:'#faffff','font-weight':800,'paint-order':'stroke',stroke:'#102127','stroke-width':.25},number));return piece;
}
function gradient(defs,id,stops){const g=n('linearGradient',{id,x1:'0',x2:'1',y1:'0',y2:'.4'});stops.forEach(([offset,color])=>g.append(n('stop',{offset,'stop-color':color})));defs.append(g);}
function outline(game,seats){if(game==='jackaroo'&&seats===4)return'M29 3H171Q197 3 197 29V171Q197 197 171 197H29Q3 197 3 171V29Q3 3 29 3Z';if(game==='jackaroo')return Array.from({length:6},(_,i)=>(i?'L':'M')+xy(polar(i*Math.PI/3-Math.PI/2,98))).join(' ')+'Z';return Array.from({length:144},(_,i)=>{const a=i/144*Math.PI*2;return(i?'L':'M')+xy(polar(a,94+4*Math.cos(a*seats)));}).join(' ')+'Z';}
function flourish(svg,p,color,kind){
 if(globalThis.BS_AUDIO?.getSettings?.().effects===false)return;
 if(kind==='land')color=globalThis.BS_CAREER_CORE?.COSMETIC_STYLES?.[equipped('trail')]?.['--trail-color']||color;
 const fx=n('g',{'data-board-effect':kind,'pointer-events':'none'}),ring=n('circle',{cx:p.x,cy:p.y,r:2,fill:'none',stroke:color,'stroke-width':.6});fx.append(ring);
 if(reduce()){ring.setAttribute('r',6);ring.setAttribute('opacity',.7);svg.append(fx);setTimeout(()=>fx.remove(),650);return;}
 const style=equipped('trail'),count=kind==='finish'?12:style==='trail-meteor'?9:style==='trail-echo'?5:6;
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2,dx=Math.cos(a)*9,dy=Math.sin(a)*9,dot=n(style==='trail-echo'?'rect':'circle',style==='trail-echo'?{x:p.x-1,y:p.y-1,width:2,height:2,fill:color}:{cx:p.x,cy:p.y,r:kind==='capture'?.8:.55,fill:color});fx.append(dot);dot.animate?.([{transform:'translate(0px,0px)',opacity:.9},{transform:`translate(${dx}px,${dy}px)`,opacity:0}],{duration:kind==='capture'?530:420,easing:'ease-out'});}
 ring.animate?.([{r:'2px',opacity:.85},{r:style==='trail-ripple'?'12px':'9px',opacity:0}],{duration:560,easing:'ease-out'});svg.append(fx);setTimeout(()=>fx.remove(),650);
}
function trace(svg,points,color,duration){
 if(reduce()||globalThis.BS_AUDIO?.getSettings?.().effects===false)return;
 const design=equipped('trail'),ink=globalThis.BS_CAREER_CORE?.COSMETIC_STYLES?.[design]?.['--trail-color']||color,fx=n('g',{'data-board-trail':design||'trail-pencil','pointer-events':'none'}),length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
 const path=n('path',{d:points.map((p,i)=>(i?'L':'M')+xy(p)).join(' '),fill:'none',stroke:ink,'stroke-width':design==='trail-meteor'?1.1:.55,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':design==='trail-echo'?'1 2':length,opacity:.55});fx.append(path);svg.append(fx);
 path.animate?.([{strokeDashoffset:String(length),opacity:.15},{strokeDashoffset:'0',opacity:.65,offset:.72},{strokeDashoffset:'0',opacity:0}],{duration:duration+180,easing:'ease-out'});
 if(design==='trail-ripple'||design==='trail-echo'){
  for(const[p,i]of points.filter((_,i)=>i%Math.max(1,Math.ceil(points.length/5))===0).map((p,i)=>[p,i])){const ring=n(design==='trail-echo'?'rect':'circle',design==='trail-echo'?{x:p.x-1.4,y:p.y-1.4,width:2.8,height:2.8,rx:.3,fill:'none',stroke:ink,'stroke-width':.5}:{cx:p.x,cy:p.y,r:2,fill:'none',stroke:ink,'stroke-width':.5});fx.append(ring);ring.animate?.([{opacity:0},{opacity:.75,offset:.3},{opacity:0}],{duration:450,delay:i*55,easing:'ease-out'});}
 }
 fx.animate?.([{opacity:1,offset:0},{opacity:1,offset:.65},{opacity:0}],{duration:duration+220,easing:'ease-out'});setTimeout(()=>fx.remove(),duration+250);
}
export function renderPetalBoard(target,state,options={}){
 const {game='zahra',legal=[],legalStones=[],onPick=()=>{},onSelect=null,active=state.turn,material,pawn,preview=false}=options;
 const g=boardGeometry(state),materialKey=material||materials[equipped('table')]||'walnut',theme=palettes[materialKey]||palettes.walnut,kind=pawn||pawnKinds[equipped('pawn')]||'spire';
 const signature=JSON.stringify([game,active,materialKey,kind,legal,legalStones,state.players.map(p=>[p.name,p.tokens||p.marbles])]),existing=target.querySelector('.petal-board-v30'),previous=existing?motionHistory.get(target):null;
 if(!preview)surfaces.set(target,{state,options});
 // Some game turns redraw twice. Retain the same SVG and in-flight motion.
 if(existing&&previous?.signature===signature)return existing;
 const prefix='atelier-board-'+(++sequence),svg=n('svg',{viewBox:'0 0 200 200',role:'group','aria-label':game==='zahra'?'لوحة الزهرة المنحوتة؛ أربعة أحجار لكل لاعب':'لوحة جاكارو المطعّمة؛ أربعة أحجار لكل لاعب','data-material':materialKey,'data-game':game});
 svg.classList.add('petal-board-v29','petal-board-v30');const defs=n('defs');gradient(defs,prefix+'-plate',[[0,theme.light],[.22,theme.base],[.8,theme.base],[1,theme.dark]]);gradient(defs,prefix+'-metal',[[0,theme.dark],[.18,theme.metal],[.4,'#fff0ca'],[.6,theme.metal],[1,theme.dark]]);
 const grain=n('pattern',{id:prefix+'-grain',width:5,height:6,patternUnits:'userSpaceOnUse'});grain.append(n('path',{d:materialKey==='carbon'?'M0 0 5 6M-2 0 3 6':'M0 1Q3 0 5 1M0 4Q3 5 5 4',fill:'none',stroke:theme.grain,'stroke-width':.17,opacity:.16}));defs.append(grain);
 for(let seat=0;seat<g.seats;seat++){gradient(defs,prefix+'-seat-'+seat+'-body',[[0,'#fff4de'],[.24,BOARD_COLORS[seat]],[.7,BOARD_COLORS[seat]],[1,'#13232b']]);gradient(defs,prefix+'-seat-'+seat+'-metal',[[0,theme.dark],[.2,theme.metal],[.45,'#fff4d4'],[.7,theme.metal],[1,theme.dark]]);}svg.append(defs);
 const shape=outline(game,g.seats);svg.append(n('path',{d:shape,fill:'#000',opacity:.25,transform:'translate(0 1.4)'}),n('path',{d:shape,fill:paint(prefix+'-plate'),stroke:paint(prefix+'-metal'),'stroke-width':1.6}),n('path',{d:shape,fill:paint(prefix+'-grain')}));svg.append(n('circle',{cx:100,cy:100,r:66,fill:theme.dark,'fill-opacity':.17,stroke:theme.metal,'stroke-width':.35}),n('circle',{cx:100,cy:100,r:63.8,fill:'none',stroke:theme.metal,'stroke-width':.18,opacity:.7}));
 for(let seat=0;seat<g.seats;seat++){
  const a=seat*Math.PI*2/g.seats-Math.PI/2,p=polar(a,81),color=BOARD_COLORS[seat],activeSeat=seat===active;
  if(game==='zahra')svg.append(n('path',{d:`M100 100Q${p.x-24*Math.cos(a+Math.PI/2)} ${p.y-24*Math.sin(a+Math.PI/2)} ${p.x} ${p.y}Q${p.x+24*Math.cos(a+Math.PI/2)} ${p.y+24*Math.sin(a+Math.PI/2)} 100 100`,fill:color,opacity:.065}));
  const pod=n('g',{'data-seat':seat,'data-active':String(activeSeat)});pod.append(n('circle',{cx:p.x,cy:p.y,r:13.2,fill:theme.dark,'fill-opacity':.58,stroke:activeSeat?color:theme.metal,'stroke-width':activeSeat?1:.35}),n('circle',{cx:p.x,cy:p.y,r:11.6,fill:'none',stroke:color,'stroke-width':.3,opacity:.5}));
  for(let t=0;t<4;t++){const q=rawPoint(state,seat,t,-1,game);pod.append(n('ellipse',{cx:q.x,cy:q.y,rx:3.45,ry:2,fill:theme.hole,stroke:color,'stroke-opacity':.6,'stroke-width':.25}));}
  pod.append(n('text',{x:p.x,y:p.y+17.3,'text-anchor':'middle','font-size':3.1,'font-weight':700,fill:theme.ink},String(state.players[seat]?.name||'').slice(0,11)));svg.append(pod);
  for(let h=0;h<4;h++){const q=polar(a,36-h*6);svg.append(n('circle',{cx:q.x,cy:q.y,r:2.65,fill:theme.hole,stroke:color,'stroke-width':.5,'data-home':seat+':'+h}),n('circle',{cx:q.x,cy:q.y,r:1,fill:color,opacity:.3}));}
 }
 for(let i=0;i<g.track;i++){const p=trackPoint(g,i,game),start=g.starts.indexOf(i),color=start>=0?BOARD_COLORS[start]:theme.metal;svg.append(n('circle',{cx:p.x,cy:p.y,r:2.1,fill:theme.hole,stroke:color,'stroke-width':start>=0?.65:.25,'data-track':i}));if(start>=0)svg.append(n('circle',{cx:p.x,cy:p.y,r:1.1,fill:color}));else if(g.safe.has(i)&&game==='zahra')svg.append(n('path',{d:`M${p.x} ${p.y-1.1}l.35.75.8.1-.6.6.15.8-.7-.4-.7.4.15-.8-.6-.6.8-.1Z`,fill:theme.metal}));}
 const finish=n('g',{'data-finish':'true'});finish.append(n('circle',{cx:100,cy:100,r:17.6,fill:theme.dark,'fill-opacity':.66,stroke:theme.metal,'stroke-width':.45}),n('circle',{cx:100,cy:100,r:15.6,fill:'none',stroke:theme.metal,'stroke-width':.17}),n('path',{d:'M92 100h16M100 92v16',stroke:theme.metal,'stroke-width':.3,opacity:.35}),n('text',{x:100,y:99,'text-anchor':'middle','font-size':4.7,'font-weight':800,fill:theme.ink},game==='zahra'?'الزهرة':'جاكارو'),n('text',{x:100,y:105,'text-anchor':'middle','font-size':2.4,'letter-spacing':.5,fill:theme.metal},'ATELIER · 30'));svg.append(finish);
 const positions=new Map(),values=new Map(),motions=[],effects=[],traces=[];
 state.players.forEach((player,seat)=>(player.tokens||player.marbles).forEach((progress,index)=>{
  const key=seat+':'+index,p=petalStonePoint(state,seat,index,game),can=seat===active&&legal.includes(index)||legalStones.includes(key),piece=n('g',{'data-stone':key,'data-player':seat,'data-token':index,transform:`translate(${p.x} ${p.y})`,role:'button',tabindex:can?0:-1,'pointer-events':can?'auto':'none','aria-label':player.name+'، حجر '+(index+1)+(can?'، حركة متاحة':''),'aria-disabled':String(!can)});piece.classList.add('petal-stone-v29','atelier-piece-v30');if(can)piece.classList.add('legal');piece.append(n('circle',{r:6.5,cy:-2,fill:'transparent'}));if(can)piece.append(n('ellipse',{cx:0,cy:.4,rx:5.1,ry:2.5,fill:'none',stroke:'#fff2ca','stroke-width':.5,'data-legal-ring':'true'}));piece.append(createAtelierPiece({prefix:prefix+'-seat-'+seat,color:BOARD_COLORS[seat],kind,number:index+1,metal:theme.metal}));
  if(can){const pick=()=>onSelect?onSelect(seat,index):onPick(index);piece.onclick=pick;piece.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick();}};}svg.append(piece);
  const old=previous?.positions.get(key),oldValue=previous?.values.get(key),moved=old&&(Math.abs(old.x-p.x)>.01||Math.abs(old.y-p.y)>.01);
  if(moved&&!preview){const captured=oldValue>=0&&progress<0;if(!reduce()&&piece.animate){const points=[old];if(!captured&&oldValue>=0&&progress>=0&&Math.abs(progress-oldValue)<=20){const step=progress>oldValue?1:-1;for(let v=oldValue+step;step>0?v<progress:v>progress;v+=step)points.push(rawPoint(state,seat,index,v,game));}points.push(p);const duration=captured?450:Math.min(700,240+points.length*22),frames=points.map((q,i)=>({transform:`translate(${q.x}px,${q.y}px)`,offset:i/(points.length-1)})),animation=piece.animate(frames,{duration,easing:points.length>3?'linear':'cubic-bezier(.18,.75,.25,1)'});motions.push(animation.finished.catch(()=>{}));if(!captured)traces.push({points,color:BOARD_COLORS[seat],duration});}effects.push({p:captured?old:p,color:captured?'#f38286':progress>=g.finish?'#f4d9a0':BOARD_COLORS[seat],kind:captured?'capture':progress>=g.finish?'finish':'land'});}
  positions.set(key,p);values.set(key,progress);
 }));
 target.replaceChildren(svg);for(const fx of traces)trace(svg,fx.points,fx.color,fx.duration);for(const fx of effects)flourish(svg,fx.p,fx.color,fx.kind);motionHistory.set(target,{positions,values,signature});target.atelierMotion=Promise.all(motions);return svg;
}
globalThis.addEventListener?.('bs-career-change',()=>{for(const[target,{state,options}]of surfaces){if(target.isConnected)renderPetalBoard(target,state,options);else surfaces.delete(target);}});
