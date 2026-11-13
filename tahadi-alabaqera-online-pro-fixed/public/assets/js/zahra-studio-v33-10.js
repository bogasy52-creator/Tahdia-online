import {boardGeometry,boardStonePosition} from './engines/board-geometry-v29.js?v=33.9.10';
import {petalStonePoint} from './board-petals-v29.js?v=33.9.10';

// A dedicated Zahra renderer. The engine and move preview retain their 200-unit geometry.
export const ZAHRA_COLORS=Object.freeze(['#c53d60','#267bc0','#d2a448','#168b78','#805ad5','#d97036']);
const NS='http://www.w3.org/2000/svg',history=new WeakMap(),effectsByTarget=new WeakMap();let serial=0;
const make=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))if(value!==null&&value!==undefined)el.setAttribute(key,String(value));if(text!==undefined)el.textContent=String(text);return el;};
const ref=id=>'url(#'+id+')',num=x=>+x.toFixed(3),point=p=>num(p.x)+' '+num(p.y);
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
function mix(a,b,t){const rgb=h=>[0,2,4].map(i=>parseInt(h.replace('#','').slice(i,i+2),16));const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
function gradient(defs,id,stops,radial=false){if(defs.querySelector('#'+id))return ref(id);const g=make(radial?'radialGradient':'linearGradient',{id,...(radial?{cx:'.3',cy:'.2',r:'.9'}:{x1:'0',y1:'0',x2:'1',y2:'1'})});stops.forEach(([offset,color])=>g.append(make('stop',{offset,'stop-color':color})));defs.append(g);return ref(id);}
function star(x,y,r){return Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.43:r;return(i?'L':'M')+num(x+Math.cos(a)*d)+' '+num(y+Math.sin(a)*d);}).join('')+'Z';}
function flowerPath(x,y,r){return Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,b=a+Math.PI/8,c=a+Math.PI/4;const p=k=>({x:x+Math.cos(k)*r,y:y+Math.sin(k)*r}),q=p(a),t=p(c),m=p(b);return(i?'':'M'+point(q))+'Q'+point({x:x+(m.x-x)*1.35,y:y+(m.y-y)*1.35})+' '+point(t);}).join('')+'Z';}
export function zahraLayout(state){
 const seats=boardGeometry(state).seats,c=seats===6?10.7:12.8,R0=seats===6?3*c:2*c;
 const angle=s=>Math.PI+s*2*Math.PI/seats;
 const at=(s,u,v=0)=>{const a=angle(s),r=R0+u*c;return{x:100+Math.cos(a)*r-Math.sin(a)*v*c,y:100+Math.sin(a)*r+Math.cos(a)*v*c,a};};
 const track=Array.from({length:seats*13},(_,g)=>{const k=(g+1)%(seats*13),arm=Math.floor(k/13),l=k%13;return l<=5?at(arm,5-l,1):l<=11?at((arm+1)%seats,l-6,-1):at((arm+1)%seats,5,0);});
 const yards=Array.from({length:seats},(_,s)=>{const a=angle(s)+(seats===6?Math.PI/6:Math.PI/4),r=seats===6?6.75*c:Math.SQRT2*4.5*c;return{x:100+Math.cos(a)*r,y:100+Math.sin(a)*r};});
 return{seats,c,R0,angle,at,track,yards,lanes:Array.from({length:seats},(_,s)=>[4,3,2,1].map(u=>at(s,u))),finish:Array.from({length:seats},(_,s)=>{const r=seats===6?R0*.48:c*.95;return{x:100+Math.cos(angle(s))*r,y:100+Math.sin(angle(s))*r};}),bases:yards.map(y=>{const d=seats===6?1.72*c*.47:c*1.15;return[[-1,-1],[1,-1],[-1,1],[1,1]].map(([i,j])=>({x:y.x+i*d,y:y.y+j*d}));})};
}
function slot(root,p,size,fill,attrs={},angle=0,material={}){
 const g=make('g',angle?{transform:`rotate(${num(angle*180/Math.PI)} ${point(p)})`}:{}),x=num(p.x-size/2),y=num(p.y-size/2);
 g.append(make('rect',{x,y:y+.6,width:size,height:size,rx:1.9,fill:material.slotShadow||'#8f8067','fill-opacity':'.2'}),make('rect',{x,y,width:size,height:size,rx:1.9,fill:material.slotRim||'#cfc0a5',...attrs}),make('rect',{x:x+.5,y:y+.7,width:size-1,height:size-1.15,rx:1.5,fill,stroke:material.slotStroke||'#ffffff','stroke-opacity':'.74','stroke-width':'.28'}),make('path',{d:`M${x+1.8} ${y+size-.8}H${x+size-1.8}`,stroke:material.slotLip||'#fffaf0','stroke-width':'.5','stroke-linecap':'round','pointer-events':'none'}));
 root.append(g);return g;
}
// Each catalog table keeps its material identity in the rebuilt arena.
const TABLE_MATERIALS={'table-gallery':'ivory','table-walnut':'walnut','table-club':'club','table-royal':'royal','table-majlis':'majlis','table-botanic':'jade','table-emerald':'jade','table-nocturne':'carbon','table-midnight':'carbon','table-slate':'carbon','table-cyber':'reactor'};
const TABLE_THEMES={
 ivory:{surface:['#fffdf6','#f1ebdc','#ded3bc'],frame:['#fff1c0','#a78247','#f4d894','#b68e50','#60492c'],slot:['#fffef8','#f9f5e9','#dfd4bc'],tray:['#c9bda6','#fdfaf2','#ede5d1'],ink:'#76644b',rim:'#b5a17d',middle:'#f5efdf',edge:'#24353d'},
 walnut:{surface:['#fff7e7','#eee0c6','#d2ba92'],frame:['#dfb17a','#89582f','#bf8c55','#70451f','#382310'],slot:['#fffaf0','#f8efda','#dcc6a2'],tray:['#baa180','#fff6e5','#e2ceb1'],ink:'#6c4426',rim:'#9b7143',middle:'#f5e8cf',edge:'#322519',weave:'wood',detail:'#795435',slotRim:'#b89c76'},
 club:{surface:['#edf3e5','#dce7d5','#b6c9ae'],frame:['#bb9161','#49301e','#9b7248','#543a25','#25180f'],slot:['#fffcf1','#f4eddc','#cfbd9e'],tray:['#bdc6ae','#fff9e8','#dce3cd'],ink:'#3e5544',rim:'#8d815b',middle:'#e8e8d3',edge:'#1c3025',weave:'club',detail:'#748a63',slotRim:'#b5a581'},
 royal:{surface:['#62447f','#3e265b','#21132f'],frame:['#fff0b4','#b7832c','#f0cf77','#b38a3d','#634018'],slot:['#fffaf5','#efe6f5','#c9b9d8'],tray:['#34223f','#67497c','#432a58'],ink:'#edcf8b',rim:'#b79554',middle:'#352147',edge:'#160d24',weave:'royal',detail:'#e6c47f',slotRim:'#9d81b0',slotShadow:'#170a27',slotLip:'#f7ebff'},
 majlis:{surface:['#9b3744','#681e2b','#350d19'],frame:['#e2ad70','#8a532e','#bf864b','#6d3b21','#32180f'],slot:['#fff8ed','#f4e6cb','#d4b78b'],tray:['#6b2031','#a74b51','#632134'],ink:'#f4d49a',rim:'#c99b59',middle:'#5c1d2c',edge:'#270d15',weave:'majlis',detail:'#edbe78',slotRim:'#b58b5a',slotShadow:'#340d17',slotLip:'#fff1d9'},
 jade:{surface:['#43886d','#26674f','#123d30'],frame:['#badfc0','#37735b','#d7c88c','#56896b','#173f31'],slot:['#fafff7','#e8f0e4','#b7cfbd'],tray:['#749a7e','#edf6df','#bdd4b5'],ink:'#ecdfae',rim:'#89aa7c',middle:'#dce9d2',edge:'#0c3024',weave:'leaf',detail:'#d6e5b3',slotRim:'#8aa88b',slotShadow:'#0f3629',slotLip:'#f1ffeb'},
 carbon:{surface:['#37515b','#263a43','#1a2b33'],frame:['#d2eef1','#5d8a95','#88c7d0','#42636f','#142b36'],slot:['#f4fdff','#e4eef1','#afc8cf'],tray:['#233d46','#496776','#293f4c'],ink:'#c5eaf0',rim:'#6d929b',middle:'#253b44',edge:'#081c27',weave:'carbon',detail:'#a0c6cd',slotRim:'#658c98',slotShadow:'#091c26',slotLip:'#e7fbff'},
 reactor:{surface:['#285985','#163d65','#09243e'],frame:['#e2edff','#728da9','#adc6dc','#466888','#132c45'],slot:['#fbfdff','#e0edfb','#aac5e0'],tray:['#103153','#315d8a','#153b61'],ink:'#cae9ff',rim:'#699ccc',middle:'#173a5c',edge:'#071728',weave:'reactor',detail:'#8bcbff',slotRim:'#6f9dce',slotShadow:'#071c34',slotLip:'#e9f5ff'}
};
function materialDetail(root,defs,id,theme){
 const shapes={wood:['M0 2C6 .5 14 4 24 2M0 6C8 4 15 8 24 6',24,8],club:['M0 6H12M6 0V12M3 3L9 9M3 9L9 3',12,12],royal:['M7 1L13 7L7 13L1 7ZM7 4L10 7L7 10L4 7Z',14,14],majlis:['M0 1L3 4L6 1L9 4L12 1M0 5L3 8L6 5L9 8L12 5',12,8],leaf:['M1 14Q8 5 13 1M7 8Q1 6 3 2Q8 3 7 8M8 6Q12 8 14 4',14,14],carbon:['M0 1H4M1 0V4',4,4],reactor:['M10 0V10H0M5 3V7M3 5H7',10,10]},spec=shapes[theme.weave];
 if(!spec)return;const [d,width,height]=spec,pattern=make('pattern',{id:id+'-material-detail',patternUnits:'userSpaceOnUse',width,height});pattern.append(make('path',{d,fill:'none',stroke:theme.detail,'stroke-width':'.27',opacity:theme.weave==='carbon'?'.08':'.14'}));defs.append(pattern);root.append(make('rect',{x:3.8,y:3.3,width:192.4,height:190.4,rx:12.4,fill:ref(id+'-material-detail'),'pointer-events':'none'}));
}
function arena(root,defs,id,state,L,active,material){
 const theme=TABLE_THEMES[TABLE_MATERIALS[material]||material]||TABLE_THEMES.ivory,ink=theme.ink;
 const frame=gradient(defs,id+'-metal',theme.frame.map((color,i)=>[[0,.2,.48,.72,1][i],color]));
 const ivory=gradient(defs,id+'-ivory',theme.surface.map((color,i)=>[[0,.55,1][i],color]));
 const cell=gradient(defs,id+'-cell',theme.slot.map((color,i)=>[[0,.62,1][i],color]));
 root.append(make('rect',{x:1.5,y:3.1,width:197,height:196,rx:15,fill:'#020b12','fill-opacity':'.45'}),make('rect',{x:1,y:1,width:198,height:196,rx:15,fill:theme.edge}),make('rect',{x:2.1,y:1.6,width:195.8,height:193.8,rx:13.7,fill:frame}),make('rect',{x:3.8,y:3.3,width:192.4,height:190.4,rx:12.4,fill:ivory}),make('rect',{x:5,y:4.5,width:190,height:188,rx:11.3,fill:'none',stroke:theme.rim,'stroke-width':'.35'}));materialDetail(root,defs,id,theme);
 // Tiny inlays sit in the frame, away from every playable slot.
 for(const [x,y]of [[8,8],[192,8],[192,188],[8,188]])root.append(make('path',{d:star(x,y,1.45),fill:ink,opacity:'.65'}));
 for(let seat=0;seat<L.seats;seat++){
  const color=ZAHRA_COLORS[seat],p=L.yards[seat],live=seat<state.players.length,on=seat===active,rx=L.seats===6?20.1:35.8,ry=rx;
  const lacquer=gradient(defs,id+'-yard-'+seat,[[0,mix(color,'#ffffff',.19)],[.42,color],[1,mix(color,'#102b31',.53)]]);
  const g=make('g',{'data-yard':seat,'data-active':String(on),opacity:live?1:.3});
  const d=`M${p.x-rx} ${p.y}Q${p.x-rx} ${p.y-ry} ${p.x} ${p.y-ry}Q${p.x+rx} ${p.y-ry} ${p.x+rx} ${p.y}Q${p.x+rx} ${p.y+ry} ${p.x} ${p.y+ry}Q${p.x-rx} ${p.y+ry} ${p.x-rx} ${p.y}Z`;
  g.append(make('path',{d,fill:'#655740',transform:'translate(0 1.1)',opacity:'.24'}),make('path',{d,fill:lacquer,stroke:frame,'stroke-width':'.8'}));
  g.append(make('rect',{x:p.x-rx+2.1,y:p.y-ry+2.1,width:rx*2-4.2,height:ry*2-4.2,rx:rx*.52,fill:'none',stroke:'#ffffff','stroke-opacity':'.22','stroke-width':'.4'}));
  const inner=L.seats===6?14.9:25.4;
  g.append(make('rect',{x:p.x-inner,y:p.y-inner,width:inner*2,height:inner*2,rx:L.seats===6?8:11.5,fill:theme.tray[0],stroke:mix(color,'#102b31',.3),'stroke-width':'.45'}),make('rect',{x:p.x-inner+.7,y:p.y-inner+.7,width:inner*2-1.4,height:inner*2-1.4,rx:L.seats===6?7.4:10.9,fill:gradient(defs,id+'-tray-'+seat,theme.tray.map((color,i)=>[[0,.2,1][i],color])),stroke:'#ffffff','stroke-width':'.35'}));
  for(const b of L.bases[seat])g.append(make('circle',{cx:b.x,cy:b.y+.4,r:L.c*.49,fill:'#716753',opacity:'.24'}),make('circle',{cx:b.x,cy:b.y,r:L.c*.49,fill:frame}),make('circle',{cx:b.x,cy:b.y,r:L.c*.42,fill:mix(color,'#1b3038',.67),stroke:mix(color,'#ffffff',.42),'stroke-width':'.35'}),make('path',{d:`M${b.x-L.c*.32} ${b.y-L.c*.12}A${L.c*.34} ${L.c*.34} 0 0 1 ${b.x+L.c*.12} ${b.y-L.c*.32}`,fill:'none',stroke:'#050c12','stroke-opacity':'.45','stroke-width':'.7'}));
  if(on)g.append(make('rect',{x:p.x-rx+1,y:p.y-ry+1,width:rx*2-2,height:ry*2-2,rx:rx*.52,fill:'none',stroke:'#fff4c7','stroke-width':'.85',class:'zahra-yard-active'}));
  if(live){const y=p.y+ry-(L.seats===6?2.3:4),name=String(state.players[seat].name||'').slice(0,L.seats===6?11:18);g.append(make('text',{x:p.x,y,'font-family':'Tajawal,Arial,sans-serif','font-weight':800,'font-size':L.seats===6?2.65:3.15,'text-anchor':'middle',fill:'#fff8e8','data-seat-label':seat,direction:'rtl','unicode-bidi':'plaintext'},name));}
  root.append(g);
 }
 const geo=boardGeometry(state),size=L.c*.91;
 L.track.forEach((p,i)=>{const start=geo.starts.indexOf(i),color=ZAHRA_COLORS[start],fill=start>=0?gradient(defs,id+'-start-'+i,[[0,mix(color,'#ffffff',.18)],[1,mix(color,'#19323b',.35)]]):cell;
  const g=slot(root,p,size,fill,{'data-track':i},L.seats===6?p.a:0,theme);
  if(start>=0){const next=L.track[(i+1)%L.track.length],a=Math.atan2(next.y-p.y,next.x-p.x)-(L.seats===6?p.a:0,theme);g.append(make('path',{d:'M-2.4 -1.6L.5 -1.6V-3L3 0L.5 3V1.6H-2.4Z',fill:'#fff9e5',transform:`translate(${point(p)}) rotate(${a*180/Math.PI}) scale(.72)`}));}
  else if(geo.safe.has(i))g.append(make('path',{d:star(p.x,p.y,L.c*.24),fill:'#b69553','data-safe':i}));
 });
 for(let seat=0;seat<L.seats;seat++){
  const color=ZAHRA_COLORS[seat],lane=gradient(defs,id+'-lane-'+seat,[[0,mix(color,'#ffffff',.64)],[1,mix(color,'#ffffff',.3)]]);
  L.lanes[seat].forEach((p,h)=>{slot(root,p,size,lane,{'data-home':seat+':'+h},L.seats===6?L.angle(seat):0,theme);});
  const gate=L.at(seat,0);slot(root,gate,size,lane,{'data-gate':seat},L.seats===6?L.angle(seat):0,theme);
 }
 // A cast flower at the finish: each player has a separate cup.
 const middle=make('g',{'data-finish':'true'}),r=L.seats===6?22.6:18.7;
 middle.append(make('path',{d:flowerPath(100,100,r),fill:'#81704f',transform:'translate(0 .8)',opacity:'.28'}),make('path',{d:flowerPath(100,100,r),fill:frame,stroke:'#f9e8b6','stroke-width':'.45'}),make('path',{d:flowerPath(100,100,r-1.5),fill:theme.middle,stroke:theme.rim,'stroke-width':'.35'}));
 for(let s=0;s<L.seats;s++){const p=L.finish[s],color=ZAHRA_COLORS[s];middle.append(make('circle',{cx:p.x,cy:p.y,r:L.c*.41,fill:mix(color,'#e9e0c8',.66),stroke:mix(color,'#14313a',.2),'stroke-width':'.6','data-finish-cup':s}));}
 for(let i=0;i<6;i++)middle.append(make('ellipse',{cx:100,cy:96.8,rx:1.7,ry:3.15,fill:frame,stroke:'#fff1c8','stroke-width':'.18',transform:`rotate(${i*60} 100 100)`}));
 middle.append(make('circle',{cx:100,cy:100,r:1.7,fill:'#d4ab5b',stroke:'#fff6d3','stroke-width':'.35'}));root.append(middle);
}
function characterPawn(seat,c,value){
 const heroes={fox:'desert',cat:'ninja',robot:'robot',princess:'knight',fairy:'falcon',astronaut:'astronaut',racer:'racer',diver:'diver',viking:'viking',gladiator:'gladiator',cyber:'cyber',samurai:'samurai'},hero=String(value||'fox').replace(/^character-/,'');
 const key=Object.hasOwn(heroes,hero)?hero:'fox',href=globalThis.BS_CAREER_CORE?.heroArt?.(key)||'/assets/heroes/'+heroes[key]+'.webp',color=ZAHRA_COLORS[seat],g=make('g',{transform:`scale(${num(c/12.8)})`,'data-character-piece':key});
 g.append(make('ellipse',{cx:.4,cy:3.6,rx:4.6,ry:1.5,fill:'#142e36',opacity:'.22'}),make('path',{d:'M-4.3 1.8A4.3 1.5 0 0 0 4.3 1.8V3A4.3 1.5 0 0 1-4.3 3Z',fill:mix(color,'#102832',.4),stroke:'#dabd7b','stroke-width':'.3'}),make('ellipse',{cx:0,cy:1.8,rx:4.3,ry:1.5,fill:color,stroke:'#e8cd93','stroke-width':'.4','data-character-plinth':seat}),make('image',{href,x:-4.4,y:-10.4,width:8.8,height:12.1,preserveAspectRatio:'xMidYMax meet','data-character-art':key}));return g;
}
function sculptedPawn(defs,id,seat,c){
 const color=ZAHRA_COLORS[seat],paint=gradient(defs,id+'-pawn-'+seat,[[0,mix(color,'#ffffff',.66)],[.24,mix(color,'#ffffff',.14)],[.53,color],[1,mix(color,'#112932',.67)]]);
 const metal=gradient(defs,id+'-pawn-band-'+seat,[[0,'#fff3c5'],[.38,'#dfc080'],[.7,'#98743c'],[1,'#eddaa5']]);
 const g=make('g',{transform:`scale(${num(c/12.8)})`,'data-sculpted-pawn':'true'});
 g.append(make('ellipse',{cx:.55,cy:2.8,rx:4.4,ry:1.65,fill:'#11242c',opacity:'.28'}),make('path',{d:'M-4 1.65C-4 .6-2.35-.25-1.65-2.3L-1.5-4.3H1.5L1.65-2.3C2.35-.25 4 .6 4 1.65V2.15C3.45 3.5-3.45 3.5-4 2.15Z',fill:paint,stroke:mix(color,'#142732',.6),'stroke-width':'.3'}),make('ellipse',{cx:0,cy:1.6,rx:3.95,ry:1.15,fill:paint,stroke:mix(color,'#ffffff',.35),'stroke-width':'.25'}),make('path',{d:'M-3.85 1.7Q0 3.7 3.85 1.7V2.1Q0 4.1-3.85 2.1Z',fill:metal}),make('ellipse',{cx:0,cy:-3.1,rx:1.9,ry:.65,fill:metal}),make('circle',{cx:0,cy:-5.35,r:2.65,fill:paint,stroke:mix(color,'#162c35',.4),'stroke-width':'.28'}),make('ellipse',{cx:-.7,cy:-6.45,rx:1.05,ry:.5,fill:'#ffffff',opacity:'.58',transform:'rotate(-32 -.7 -6.45)'}),make('path',{d:'M-1.4 -1.9Q-1.8-.1-2.4 .7',fill:'none',stroke:'#ffffff','stroke-width':'.48',opacity:'.35','stroke-linecap':'round'}));
 return g;
}
// Motion is scoped to the board session and canceled on redraw or exit.
function clearZahraEffects(target,reset=true){
 const record=effectsByTarget.get(target);if(record){for(const timer of record.timers)clearTimeout(timer);for(const animation of record.animations)animation.cancel?.();for(const layer of record.layers)layer.remove();effectsByTarget.delete(target);}if(reset)history.delete(target);target.atelierMotion=Promise.resolve();
}
function motionTrail(root,record,points,seat,style,duration,captured=false,finished=false){
 if(reduced()||globalThis.BS_AUDIO?.getSettings?.().effects===false)return;
 const defaults={'trail-none':'#20ccff','trail-pencil':'#e5d6b8','trail-ripple':'#7bd0be','trail-meteor':'#f4b36c','trail-echo':'#94b4e5','trail-comet':'#4ce6ff','trail-plasma':'#e777ff'},color=captured?'#ef858c':finished?'#e9c574':globalThis.BS_CAREER_CORE?.COSMETIC_STYLES?.[style]?.['--trail-color']||defaults[style]||ZAHRA_COLORS[seat],last=points.at(-1),effect=make('g',{'data-board-trail':style,'data-board-effect':captured?'capture':finished?'finish':'land','pointer-events':'none','aria-hidden':'true'});
 const path=make('path',{d:points.map((p,i)=>(i?'L':'M')+point(p)).join(' '),fill:'none',stroke:color,'stroke-width':style==='trail-meteor'||style==='trail-comet'?1.3:.8,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':style==='trail-echo'?'1 2':null,opacity:'.72'});if(!captured)effect.append(path);
 const animate=(node,frames,timing)=>{const animation=node.animate?.(frames,timing);if(animation)record.animations.push(animation);};
 if(!captured&&(style==='trail-meteor'||style==='trail-comet'||style==='trail-echo'))points.slice(1).forEach((p,i)=>{const echo=style==='trail-echo',part=make(echo?'rect':'circle',echo?{x:p.x-.65,y:p.y-.65,width:1.3,height:1.3,fill:color,rx:.2}:{cx:p.x,cy:p.y,r:style==='trail-meteor'?.64:.9,fill:color});effect.append(part);animate(part,[{opacity:.1},{opacity:1,offset:.25},{opacity:0}],{duration:duration+180,delay:i*18,easing:'ease-out'});});
 if(style==='trail-plasma'&&!captured)effect.append(make('path',{d:path.getAttribute('d'),fill:'none',stroke:color,'stroke-width':2.5,opacity:'.19','stroke-linecap':'round'}));
 const rings=style==='trail-ripple'?3:1;for(let i=0;i<rings;i++){const ring=make('circle',{cx:last.x,cy:last.y,r:2+i*1.6,fill:'none',stroke:color,'stroke-width':i?.45:.8,opacity:.75-i*.15});effect.append(ring);animate(ring,[{r:(2+i*1.6)+'px',opacity:.75},{r:(8+i*1.6)+'px',opacity:0}],{duration:500+i*90,delay:Math.max(0,duration-220),easing:'ease-out'});}
 root.append(effect);record.layers.add(effect);animate(effect,[{opacity:.9},{opacity:.8,offset:.65},{opacity:0}],{duration:duration+220,easing:'ease-out'});const timer=setTimeout(()=>{effect.remove();record.layers.delete(effect);record.timers.delete(timer);},duration+450);record.timers.add(timer);
}
export function renderZahraBoard(target,state,{active=state.turn,legal=[],onPick=()=>{},looks=[],characters=[],preview=false,material,trail}={}){
 if(!target||!state?.players?.length)return null;
 const L=zahraLayout(state),selectedMaterial=material||globalThis.BS_CAREER?.get?.()?.equipped?.table||'',selectedTrail=trail||globalThis.BS_CAREER?.get?.()?.equipped?.trail||'trail-pencil',signature=JSON.stringify([active,legal,looks,characters,selectedMaterial,selectedTrail,reduced(),state.players.map(p=>[p.name,p.tokens])]),prev=history.get(target);
 if(prev?.signature===signature&&target.querySelector('.zahra-studio-board'))return target.querySelector('.zahra-studio-board');
 clearZahraEffects(target,false);const effects={timers:new Set(),animations:[],layers:new Set()};effectsByTarget.set(target,effects);target.zahraCleanup=()=>clearZahraEffects(target);
 const id='zahra-studio-'+(++serial),svg=make('svg',{xmlns:NS,viewBox:'0 0 200 200',role:'group','aria-label':'لوحة الزهرة؛ المسار والخانات الآمنة وأربعة أحجار لكل لاعب','data-game':'zahra','data-seats':L.seats,'data-material':selectedMaterial||'ivory',class:'zahra-studio-board petal-board-v29 petal-board-v30 table-v31'}),defs=make('defs'),root=make('g',{'data-board-root':'','data-rot':0});
 svg.append(defs,root);arena(root,defs,id,state,L,active,selectedMaterial);
 const positions=new Map(),values=new Map(),motions=[],layer=make('g',{'data-layer':'stones'}),order=[];
 state.players.forEach((player,seat)=>player.tokens.forEach((progress,index)=>order.push({seat,index,progress,p:petalStonePoint(state,seat,index,'zahra')})));order.sort((a,b)=>a.p.y-b.p.y);
 for(const {seat,index,progress,p}of order){
  const key=seat+':'+index,can=seat===active&&legal.includes(index),item=looks[seat]||'pawn-classic',g=make('g',{'data-stone':key,'data-player':seat,'data-token':index,'data-pawn-item':item,transform:`translate(${num(p.x)} ${num(p.y)})`,role:'button',tabindex:can?0:-1,'aria-disabled':String(!can),'aria-label':state.players[seat].name+'، حجر '+(index+1)+(can?'، حركة متاحة':''),'pointer-events':can?'auto':'none',class:'zahra-pawn petal-stone-v29 atelier-piece-v30'+(can?' legal':'')});
  g.append(make('circle',{cy:-1.6,r:6.6,fill:'transparent'}));
  if(can)g.append(make('ellipse',{cy:2.3,rx:5.35,ry:2.6,fill:'#ffffff',opacity:'.75','data-legal-ring':'true',class:'zahra-legal-ring'}));
  const peers=order.filter(o=>o!==undefined&&o.progress>=0&&(progress<boardGeometry(state).track?boardStonePosition(o.seat,o.progress,state)===boardStonePosition(seat,progress,state):o.seat===seat&&o.progress===progress)).length,scale=progress>=0&&peers>1?.76:1,bob=make('g',{class:'stone-bob',transform:scale!==1?'scale('+scale+')':null});
  const P=globalThis.BS_PIECES;
  if(item==='pawn-character')bob.append(characterPawn(seat,L.c,characters[seat]||globalThis.BS_CAREER?.get?.()?.equipped?.character));
  else if(item!=='pawn-classic'&&P?.pawn){const art=make('g',{transform:`translate(0 ${num(L.c*.24)}) scale(${num(L.c/12.8*.8)})`});art.append(P.pawn(document,defs,{design:P.designFor(item),item,color:ZAHRA_COLORS[seat],scope:id+'-'+key}));bob.append(art);}else bob.append(sculptedPawn(defs,id,seat,L.c));
  bob.append(make('text',{x:0,y:item==='pawn-character'?3:1.1,'text-anchor':'middle','font-size':2.3,'font-weight':900,'font-family':'Arial,sans-serif',fill:'#ffffff','paint-order':'stroke',stroke:mix(ZAHRA_COLORS[seat],'#102631',.62),'stroke-width':'.3','data-piece-number':'true'},index+1));g.append(bob);
  if(can){g.onclick=()=>onPick(index);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(index);}};}
  layer.append(g);positions.set(key,p);values.set(key,progress);
  const old=prev?.positions.get(key),from=prev?.values.get(key);
  if(old&&!preview&&!reduced()&&g.animate&&(Math.abs(old.x-p.x)>.01||Math.abs(old.y-p.y)>.01)){
   const points=[old],captured=from>=0&&progress<0;
   if(!captured&&from>=0&&progress>=0&&progress-from<=20)for(let v=from+1;v<progress;v++){const copy={...state,players:state.players.map((player,s)=>s===seat?{...player,tokens:player.tokens.map((value,i)=>i===index?v:value)}:player)};points.push(petalStonePoint(copy,seat,index,'zahra'));}
   points.push(p);const duration=captured?380:Math.min(850,240+points.length*65),frames=points.map((q,i)=>({transform:`translate(${q.x}px,${q.y}px)`,offset:i/(points.length-1)}));const animation=g.animate(frames,{duration,easing:points.length>3?'linear':'cubic-bezier(.18,.72,.25,1)'});effects.animations.push(animation);motions.push(animation.finished.catch(()=>{}));motionTrail(root,effects,points,seat,selectedTrail,duration,captured,progress===boardGeometry(state).finish);
  }
 }
 root.append(layer);target.replaceChildren(svg);history.set(target,{signature,positions,values});target.atelierMotion=Promise.all(motions);target.dispatchEvent(new Event('bs-board-render'));return svg;
}
