/* «صيد الكلمات» (33.5.0) — what the hunter sees and touches. The room checks every pick:
   a word counts only if its letters sit in a straight line, and only for whoever got there first. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const NS='http://www.w3.org/2000/svg';
const shape=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
// the seat colours of the challenge rooms: a found word is marked in its finder's colour
const COLORS=['#5de2c2','#f5c76e','#84baff','#f796b2','#bca3ff','#ff9875','#96db68','#66d8ed','#f4a6ff','#e9da81','#77a6ed','#d0a47a','#99bdb3','#e5a6ae','#bdca72','#c595dd','#64bca3','#debd99','#9ba3d9','#d58b70'];
const ROUNDS=['الجولة الأولى','الجولة الثانية','الجولة الأخيرة'];
let mounted=false,current=null,hooks=null,paused=false,gridKey='',start=-1,drag=null,pending=null,seenMiss=-1,seenFeed=null,seenRound='',mine=-1,note='';
function clear(){mounted=false;current=null;hooks=null;paused=false;gridKey='';start=-1;drag=null;pending=null;seenMiss=-1;seenFeed=null;seenRound='';mine=-1;note='';}
function sound(name){if(!document.hidden)window.BS_AUDIO?.play?.(name);}
function line(from,to,n){if(from===to)return[from];const r0=Math.floor(from/n),c0=from%n,r1=Math.floor(to/n),c1=to%n,dr=r1-r0,dc=c1-c0;if(dr&&dc&&Math.abs(dr)!==Math.abs(dc))return null;const k=Math.max(Math.abs(dr),Math.abs(dc));return Array.from({length:k+1},(_,i)=>(r0+Math.sign(dr)*i)*n+c0+Math.sign(dc)*i);}
// a finger is never exactly straight: lean the pick to the nearest of the eight directions
function snap(from,to,n){if(from===to)return from;const r0=Math.floor(from/n),c0=from%n,dr=Math.floor(to/n)-r0,dc=to%n-c0,a=Math.round(Math.atan2(dr,dc)/(Math.PI/4))*Math.PI/4,ur=Math.round(Math.sin(a)),uc=Math.round(Math.cos(a));for(let k=Math.max(Math.abs(dr),Math.abs(dc));k>0;k--){const r=r0+ur*k,c=c0+uc*k;if(r>=0&&r<n&&c>=0&&c<n)return r*n+c;}return from;}
const colorOf=id=>COLORS[(current?.players.find(p=>p.id===id)?.slot||0)%COLORS.length];
const now=()=>hooks?.now?.()??Date.now();
function playable(){const m=current,h=m?.hunt;return!!h&&m.phase==='playing'&&h.phase==='play'&&!paused&&!document.hidden&&now()>=(h.wait||0)&&now()<h.deadline;}
function q(selector){return $('chBoard').querySelector(selector);}
function cellAt(e){const hit=document.elementFromPoint?.(e.clientX,e.clientY)||e.target,cell=hit?.closest?.('[data-cell]');return cell&&q('.ch-hunt-grid')?.contains(cell)?Number(cell.dataset.cell):-1;}
function mount(){
 const board=$('chBoard');board.className='ch-board ch-hunt';
 const head=el('div','ch-hunt-head'),topic=el('div','ch-hunt-topic');topic.append(el('small','ch-hunt-round'),el('b','ch-hunt-theme'));head.append(topic,el('span','ch-hunt-count'),el('b','ch-hunt-clock'));
 const timer=el('div','ch-hunt-timer');timer.append(el('i'));
 const frame=el('div','ch-hunt-frame'),lines=shape('svg',{class:'ch-hunt-lines','aria-hidden':'true',focusable:'false'}),grid=el('div','ch-hunt-grid'),rest=el('div','ch-hunt-break');
 grid.setAttribute('role','grid');grid.setAttribute('aria-label','شبكة الحروف');rest.hidden=true;rest.append(el('b','ch-hunt-break-title'),el('span','ch-hunt-break-count'),el('small','ch-hunt-break-note','الكلمات اللي ما أحد لقاها مرسومة بخط منقّط'));
 frame.append(lines,grid,rest);
 const pick=el('p','ch-hunt-pick');pick.setAttribute('aria-live','polite');
 board.replaceChildren(head,timer,frame,pick);
 const words=el('section','ch-hunt-words');words.setAttribute('aria-label','الكلمات المطلوبة');
 $('chControls').replaceChildren(words);
 $('chTactics').replaceChildren(el('div','ch-hunt-feed'));
 grid.addEventListener('pointerdown',e=>{if(e.button>0||!playable())return;const c=cellAt(e);if(c<0)return;e.preventDefault();try{grid.setPointerCapture(e.pointerId);}catch{}drag={id:e.pointerId,from:c,to:c};note='';draw();});
 grid.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const c=cellAt(e);if(c<0)return;const to=snap(drag.from,c,current.hunt.size);if(to!==drag.to){drag.to=to;draw();}});
 const up=e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(e.type==='pointercancel'||!playable()){draw();return;}if(d.to!==d.from){start=-1;claim(d.from,d.to);}else tap(d.from);};
 grid.addEventListener('pointerup',up);grid.addEventListener('pointercancel',up);
 grid.addEventListener('keydown',e=>{if(e.key==='Escape'&&start>=0){start=-1;draw();}});
 mounted=true;
}
function tap(c){const n=current.hunt.size;if(start<0||c===start){start=c===start?-1:c;note=start<0?'':'اختر آخر حرف من الكلمة';draw();return;}const cells=line(start,c,n);if(!cells){start=c;note='اختر آخر حرف من الكلمة';draw();return;}const from=start;start=-1;claim(from,c);}
function claim(from,to){const h=current.hunt,cells=line(from,to,h.size);if(!cells||cells.length<3){note='الكلمة ثلاث حروف أو أكثر بخط مستقيم';draw();return;}pending={cells,at:now()};note='';draw();hooks.act({round:h.round,from,to});}
function grid(h){
 const key=h.round+':'+h.size+':'+h.grid.join('');if(gridKey===key)return;gridKey=key;start=-1;drag=null;pending=null;
 const area=q('.ch-hunt-grid');area.style.setProperty('--n',String(h.size));
 area.replaceChildren(...h.grid.map((letter,i)=>{const b=el('button','ch-hunt-cell',letter);b.type='button';b.dataset.cell=String(i);b.setAttribute('role','gridcell');b.setAttribute('aria-label',letter+' · سطر '+(Math.floor(i/h.size)+1)+' · خانة '+(i%h.size+1));
  // keyboards and screen readers (a click with no pointer behind it): the first letter, then the last one
  b.addEventListener('click',e=>{if(!e.detail&&playable())tap(i);});return b;}));
 q('.ch-hunt-lines').setAttribute('viewBox','0 0 '+h.size+' '+h.size);
}
// cell 0 is the top right cell, so a column counts from the right
function centre(c,n){return[n-1-c%n+.5,Math.floor(c/n)+.5];}
function stroke(cells,n,cls,color){const [x1,y1]=centre(cells[0],n),[x2,y2]=centre(cells.at(-1),n),node=shape('line',{x1,y1,x2,y2,class:cls});if(color)node.style.setProperty('--hit',color);return node;}
function draw(){
 if(!mounted||!current?.hunt)return;const h=current.hunt,n=h.size,marks=[];
 for(const w of h.words)if(w.cells)marks.push(stroke(w.cells,n,w.by?(w.by===hooks.me?'found mine':'found'):'missed',w.by?colorOf(w.by):null));
 if(h.phase==='play'&&h.miss&&now()<(h.wait||0))marks.push(stroke(h.miss.cells,n,'wrong'));
 const live=drag?line(drag.from,drag.to,n):start>=0?[start]:null,shown=live||pending?.cells||null;
 if(shown)marks.push(stroke(shown,n,live?'select':'pending'));
 q('.ch-hunt-lines').replaceChildren(...marks);
 const picked=new Set(shown||[]),taken=new Set(h.words.flatMap(w=>w.by&&w.cells?w.cells:[]));
 for(const b of q('.ch-hunt-grid').children){const c=Number(b.dataset.cell);b.classList.toggle('sel',picked.has(c));b.classList.toggle('anchor',c===start||c===drag?.from);b.classList.toggle('hit',taken.has(c));}
 const pick=q('.ch-hunt-pick');pick.classList.toggle('live',!!shown&&shown.length>1);
 pick.textContent=shown&&shown.length>1?shown.map(c=>h.grid[c]).join(' '):note||(h.phase==='play'?(h.hidden?'دوّر كلمات من موضوع «'+h.theme+'»':'اسحب على الكلمة، أو اضغط أول حرف وآخر حرف'):'');
}
function list(m){
 const h=m.hunt,area=$('chControls').querySelector('.ch-hunt-words');if(!area)return;
 const key=JSON.stringify([h.round,h.phase,h.words.map(w=>[w.label,w.by,w.mask])]);if(area.dataset.key===key)return;area.dataset.key=key;
 const head=el('div','ch-hunt-words-head');head.append(el('b','',h.hidden?'كلمات مخفية · نقاطها دبل':'الكلمات'),el('small','',h.found+' من '+h.words.length));
 const rows=el('ul','ch-hunt-list');
 for(const w of h.words){
  const row=el('li','ch-hunt-word'+(w.by?' found':'')+(w.by===hooks.me?' mine':'')+(w.golden?' golden':'')+(!w.by&&w.cells?' missed':''));if(w.by)row.style.setProperty('--hit',colorOf(w.by));
  const name=el('b','ch-hunt-label');
  if(w.label)name.textContent=w.label;else{name.classList.add('ch-hunt-mask');for(const c of w.mask)name.append(el('i','',c||''));const first=w.mask[0],last=w.mask.at(-1);name.setAttribute('aria-label','كلمة من '+w.length+' حروف'+(first?' تبدأ بـ'+first:'')+(last?' وتنتهي بـ'+last:''));}
  row.append(name,w.by?el('span','ch-hunt-by',w.by===hooks.me?'أنت':w.name):el('small','ch-hunt-points',(w.golden?'★ ':'')+'+'+w.points));
  rows.append(row);
 }
 area.replaceChildren(head,rows);
}
function feed(m){
 const h=m.hunt,area=$('chTactics').querySelector('.ch-hunt-feed');if(!area)return;const key=h.recent.map(x=>x.at+x.id).join('|');if(seenFeed===key)return;
 const fresh=seenFeed===null?[]:h.recent.filter(x=>!seenFeed.includes(x.at+x.id));seenFeed=key;
 for(const x of fresh)if(x.id!==hooks.me)sound('pop');
 area.replaceChildren(...[...h.recent].reverse().slice(0,4).map(x=>{const row=el('p','ch-hunt-news'+(x.id===hooks.me?' mine':''));row.style.setProperty('--hit',colorOf(x.id));row.append(el('i'),el('b','',x.id===hooks.me?'أنت':x.name),el('span','',(x.id===hooks.me?' لقيت':' لقى')+' «'+x.label+'»'+(x.golden?' ★':'')),el('small','',' +'+x.points));return row;}));
 if(!h.recent.length)area.append(el('p','ch-hunt-news empty','أول واحد يلقى الكلمة ياخذ نقاطها، والكلمة الذهبية ★ نقاطها دبل.'));
}
function render(m,next){
 current=m;hooks=next;if(!m.hunt)return;if(!mounted)mount();
 const h=m.hunt,round=h.round+':'+h.phase,finds=h.words.filter(w=>w.by===next.me).length;
 grid(h);
 q('.ch-hunt-round').textContent=ROUNDS[h.round]||'الجولة '+(h.round+1);
 q('.ch-hunt-theme').textContent=h.theme;
 q('.ch-hunt-count').textContent='لقيتوا '+h.found+' من '+h.words.length;
 q('.ch-hunt-break-title').textContent=h.phase==='break'?'خلصت '+(ROUNDS[h.round]||'الجولة'):'';q('.ch-hunt-break-note').hidden=h.found>=h.words.length;
 if(seenRound&&seenRound!==round){if(h.phase==='play')sound('round');else if(h.phase==='break')sound('reveal');}seenRound=round;
 if(mine>=0&&finds>mine)sound('correct');mine=finds;
 const missAt=h.miss?.at||0;if(seenMiss<0)seenMiss=missAt;else if(missAt>seenMiss){seenMiss=missAt;sound('wrong');note='مو من الكلمات · استنى ثانية';const area=q('.ch-hunt-grid');area.classList.remove('shake');void area.offsetWidth;area.classList.add('shake');}
 if(pending){const key=pending.cells.join();if(h.words.some(w=>w.cells?.join()===key||w.cells&&[...w.cells].reverse().join()===key)||h.miss?.cells.join()===key)pending=null;}
 if(h.phase!=='play'){start=-1;drag=null;pending=null;}
 list(m);feed(m);draw();tick(m,{me:next.me,now:next.now,paused});
}
function tick(m,next){
 if(!mounted||!m.hunt)return;paused=!!next.paused;const h=m.hunt,t=next.now(),live=m.phase==='playing'&&h.phase==='play',left=live?Math.max(0,h.deadline-t):0;
 q('.ch-hunt-clock').textContent=live?Math.ceil(left/1000)+' ث':h.phase==='break'?'استراحة':'انتهت';
 const bar=q('.ch-hunt-timer');bar.firstChild.style.width=(live?Math.min(1,left/h.duration)*100:0).toFixed(1)+'%';bar.classList.toggle('urgent',live&&left<10000);
 const rest=q('.ch-hunt-break');rest.hidden=!(m.phase==='playing'&&h.phase==='break');if(!rest.hidden)q('.ch-hunt-break-count').textContent=(ROUNDS[h.round+1]||'الجولة الجاية')+' بعد '+Math.max(1,Math.ceil((h.nextAt-t)/1000));
 if(m.phase==='playing'){$('chTime').textContent=live?Math.ceil(left/1000)+' ث':'—';$('chRound').textContent='الجولة '+(h.round+1)+' من '+h.rounds;}
 const area=q('.ch-hunt-grid'),cooling=live&&t<(h.wait||0);area.classList.toggle('cooling',cooling);area.classList.toggle('locked',!live||paused);
 if(pending&&t-pending.at>1600){pending=null;draw();}
 if(!cooling&&note==='مو من الكلمات · استنى ثانية'){note='';draw();}
}
window.BS_WORD_HUNT={render,tick,clear};
})();
