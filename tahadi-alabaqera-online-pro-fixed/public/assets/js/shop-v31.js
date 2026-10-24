/* Tahdia 31.0.0 — the shop.
   Everything sold here changes how a game looks or how you react in a room,
   never the rules. Prices, ownership and checkout go through BS_CAREER, which
   the server checks again. The page keeps the hooks older tests and pages use
   (data-item, data-control, data-view, data-filter, the bag and preview dialogs). */
import {renderPetalBoard} from './board-petals-v29.js?v=31.0.0';
const $=id=>document.getElementById(id),core=window.BS_CAREER_CORE,api=()=>window.BS_CAREER;
const SVG_NS='http://www.w3.org/2000/svg';
const CATS=[
 ['pawn','الأحجار','♟️','أحجار مجسّمة تتلوّن بلونك في السلم والثعبان والزهرة، وتصير كرات زجاجية في الجاكارو.'],
 ['character','الشخصيات','🦊','شخصيات على قاعدة ذهبية تمشي بدل الأحجار في السلم والثعبان.'],
 ['dice','النرد','🎲','نرد ثلاثي الأبعاد يظهر في كل ألعاب النرد.'],
 ['table','الطاولات','🪵','خامة لوحتي الجاكارو والزهرة: الإطار والسطح والخانات.'],
 ['board','ألواح السلالم','🪜','لوح السلم والثعبان بخاناته وإطاره.'],
 ['snake','الثعابين','🐍','إطلالتك في حلبة الثعبان أمام بقية اللاعبين.'],
 ['emote','إيموجي','😎','إيموجي متحرك تطلقه داخل الغرف، ويظهر لكل اللاعبين.'],
 ['phrase','عبارات','💬','عبارات جاهزة تظهر باسمك في فقاعة داخل الغرفة.'],
 ['move','حركات','🎆','مؤثرات وأصوات تملأ اللوحة: ألعاب نارية، مطر ذهبي، صاعقة…'],
 ['trail','آثار الحركة','✨','أثر يرافق حجرك وهو يمشي على اللوحة.'],
 ['victory','احتفالات الفوز','🏆','الاحتفال الذي يظهر عند فوزك.'],
 ['title','الألقاب','🎖️','لقب يظهر بجانب اسمك وفي شاشة الفوز.']
];
const TYPE_LABEL=Object.fromEntries(CATS.map(([id,label])=>[id,label]));
const TIER={common:'عادي',rare:'نادر',epic:'ملحمي',legendary:'أسطوري',exclusive:'حصري'};
const REACTION=new Set(core.REACTION_TYPES||['emote','phrase','move']);
const SLOTS=['pawn','dice','table','board','character','snake','trail','victory','title'];
const TABLE_MATERIAL={'table-club':'walnut','table-gallery':'ivory','table-nocturne':'carbon','table-botanic':'jade','table-royal':'royal','table-walnut':'walnut','table-cyber':'carbon'};
const BOARD_LOOK={'board-forest':{cell:'#f8efd9',alt:'#eedcb6',num:'#7a5532',frame:'#6d4221',dark:'#3f230d',hi:'#b07a45',snake:'#2f9e57'},'board-royal':{cell:'#fbf8f1',alt:'#efe6d2',num:'#8a6a2f',frame:'#c8a159',dark:'#7c5a1c',hi:'#fff0c4',snake:'#8b5cf6'},'board-cyber':{cell:'#13283c',alt:'#0f2131',num:'#7fe7ff',frame:'#0e3550',dark:'#061a28',hi:'#3fd0f5',snake:'#34e0ff'}};
const DIE_ONE={'dice-obsidian':'#ebc677','dice-crystal':'#d6fff1','dice-smoke':'#ffdf9d','dice-nebula':'#ffdf9d'};
const TRY={pawn:['/zahra','جرّبها في الزهرة'],character:['/snakes','جرّبها في السلم والثعبان'],dice:['/dice','افتح تحدي النرد'],table:['/jackaroo','جرّبها في الجاكارو'],board:['/snakes','افتح السلم والثعبان'],snake:['/serpent','افتح حلبة الثعبان'],emote:['/snakes','استخدمه في غرفة لعب'],phrase:['/snakes','استخدمها في غرفة لعب'],move:['/snakes','أطلقها في غرفة لعب'],trail:['/zahra','جرّبه في الزهرة'],victory:['/snakes','العب واربح'],title:['/social','ملفك الشخصي']};
let heroParts=null,view='shop',filter='all',query='',sort='featured',pending=false,previewId=null,previewCleanup=()=>{},bag=[],favorites=[],accountKey='',checkout=null,observer=null,clock=null,artSequence=0;

/* ---------- small helpers ---------- */
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==null)el.textContent=String(text);return el;};
const svgNode=(tag,attrs={},text)=>{const el=document.createElementNS(SVG_NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=String(text);return el;};
const profile=()=>api()?.get?.()||core.normalize({}),now=()=>api()?.now?.()||Date.now(),cost=item=>core.itemPrice(item.id,now());
const tidy=value=>String(value||'').normalize('NFKD').replace(/[ً-ٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const key=()=>{try{return api()?.account?.()||'guest'}catch{return 'guest'}};
const fmt=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const reduced=()=>{try{return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true}catch{return false}};
function tier(item){return item.source?'exclusive':item.price>=450?'legendary':item.price>=300?'epic':item.price>=150?'rare':'common';}
function coin(){const i=make('i','sx-coin');i.setAttribute('aria-hidden','true');return i;}
function subtitle(item){if(item.subtitle)return item.subtitle;if(item.type==='phrase')return item.text;const d=String(item.description||'');return d.split(/[.،]/)[0].slice(0,60);}
function locked(item){return Boolean(item.source)&&item.source!=='owner';}
function lockText(item){return item.source==='achievement'?'يُفتح بإنجاز 50 جولة':item.source==='journey'?'يُفتح بـ '+item.unlockStars+' نجمة في رحلة النجوم':'حصري';}
function catalogue(p=profile()){
 const owned=new Set(p.owned);
 return (core.STOREFRONT||core.COLLECTION.map(i=>i.id)).map(id=>core.CATALOG.find(i=>i.id===id)).filter(item=>item&&!item.retired&&(item.source!=='owner'||owned.has(item.id)));
}
function readList(name){try{const ids=new Set(catalogue().map(i=>i.id)),rows=JSON.parse(localStorage.getItem('atelier30:'+name+':'+key())||'[]');return Array.isArray(rows)?[...new Set(rows)].filter(id=>ids.has(id)).slice(0,name==='bag'?12:60):[];}catch{return [];}}
function saveLists(){try{localStorage.setItem('atelier30:bag:'+key(),JSON.stringify(bag));localStorage.setItem('atelier30:favorites:'+key(),JSON.stringify(favorites));}catch{message('تعذّر حفظ السلة على هذا الجهاز؛ تستطيع الشراء مباشرة.');}}
function message(text,error=false){$('shopMessage').textContent=text;$('shopMessage').dataset.error=String(error);$('shopMessage').classList.toggle('show',Boolean(text));if($('bagDialog').open)$('bagMessage').textContent=text;if($('previewDialog').open)$('previewMessage').textContent=text;}

/* ---------- art ---------- */
function svgGradient(defs,id,stops,x2=0,y2=1){const g=svgNode('linearGradient',{id,x1:0,y1:0,x2,y2});stops.forEach(([o,c,a])=>g.append(svgNode('stop',{offset:o,'stop-color':c,'stop-opacity':a??1})));defs.append(g);return 'url(#'+id+')';}
function pawnColor(item){const list=window.BS_PIECES?.COLORS||['#e0474c','#2f86e8','#f0b429','#22a565','#8b5cf6','#f2711c'];const index=catalogue().filter(i=>i.type==='pawn').findIndex(i=>i.id===item.id);return list[(index<0?1:index)%list.length];}
function miniBoard(stage,item){
 const look=BOARD_LOOK[item.id]||BOARD_LOOK['board-forest'],prefix='sxb'+(++artSequence),svg=svgNode('svg',{viewBox:'0 0 120 120','aria-hidden':'true',focusable:'false',class:'sx-board-art'}),defs=svgNode('defs');svg.append(defs);
 const frame=svgGradient(defs,prefix+'f',[[0,look.hi],[.25,look.frame],[1,look.dark]],1,1);
 svg.append(svgNode('rect',{x:4,y:4,width:112,height:112,rx:12,fill:frame}));
 for(let r=0;r<5;r++)for(let c=0;c<5;c++){const x=12+c*19.2,y=12+r*19.2,n=(4-r)*5+((4-r)%2?5-c:c+1);svg.append(svgNode('rect',{x,y,width:19.2,height:19.2,fill:(r+c)%2?look.alt:look.cell}));svg.append(svgNode('text',{x:x+2.2,y:y+6.4,'font-size':5.4,'font-weight':800,'font-family':'Tajawal,sans-serif',fill:look.num},n));}
 const ladder=svgNode('g',{stroke:'#b07a45','stroke-width':2.2,'stroke-linecap':'round'});ladder.append(svgNode('path',{d:'M30 100 62 38M40 104 72 42'}));for(let i=1;i<6;i++){const t=i/6;ladder.append(svgNode('path',{d:`M${30+32*t} ${100-62*t}L${40+32*t} ${104-62*t}`,'stroke-width':1.6}));}svg.append(ladder);
 svg.append(svgNode('path',{d:'M92 30C78 40 98 54 84 66S70 86 86 98',fill:'none',stroke:look.snake,'stroke-width':5.2,'stroke-linecap':'round'}));
 svg.append(svgNode('ellipse',{cx:92,cy:28,rx:5.4,ry:4.4,fill:look.snake}));svg.append(svgNode('circle',{cx:90,cy:27,r:1,fill:'#fff'}));
 stage.append(svg);
}
function trailArt(stage,item,live){
 const svg=svgNode('svg',{viewBox:'0 0 240 170','aria-hidden':'true',focusable:'false'}),ink=core.COSMETIC_STYLES[item.id]?.['--trail-color']||item.color,design=item.design||'line';
 svg.append(svgNode('path',{d:'M25 132C80 145 145 13 218 45',fill:'none',stroke:'#ffffff22','stroke-width':1}));
 const count=design==='echo'?12:design==='ripple'?14:20;
 for(let i=0;i<count;i++){const t=i/(count-1),x=28+t*185,y=123-84*t+Math.sin(t*Math.PI*2)*17,attrs=design==='echo'?{x:x-4,y:y-4,width:8,height:8,rx:1.5}:{cx:x,cy:y,r:design==='ripple'?3+6*t:design==='meteor'?1+4*t:1.4+3*t};svg.append(svgNode(design==='echo'?'rect':'circle',{...attrs,fill:design==='ripple'?'none':ink,stroke:ink,'stroke-width':design==='ripple'?1.4:.6,opacity:.12+t*.85}));}
 svg.append(svgNode('circle',{cx:214,cy:40,r:10,fill:'#fff6e0',stroke:ink,'stroke-width':2.4}));
 stage.append(svg);
 if(live&&!reduced()&&svg.animate){const a=svg.animate([{opacity:.45},{opacity:1},{opacity:.45}],{duration:1800,iterations:Infinity});stage.cleanups.push(()=>a.cancel());}
}
function victoryArt(stage,item,live){
 const svg=svgNode('svg',{viewBox:'0 0 240 170','aria-hidden':'true',focusable:'false',class:'sx-victory-art'}),c=item.color,design=item.design||(item.id==='victory-royal'?'royal':item.id==='victory-aurora'?'aurora':'studio');
 if(design==='orbit')for(const angle of [-35,35,90])svg.append(svgNode('ellipse',{cx:120,cy:85,rx:62,ry:22,fill:'none',stroke:c,'stroke-width':2,transform:'rotate('+angle+' 120 85)'}));
 else if(design==='bloom')for(let i=0;i<10;i++)svg.append(svgNode('ellipse',{cx:120,cy:56,rx:10,ry:27,fill:c,opacity:.6,transform:'rotate('+i*36+' 120 85)'}));
 else if(design==='aurora'){for(let i=0;i<5;i++)svg.append(svgNode('path',{d:`M${20+i*8} ${130-i*6}C80 ${40+i*10} 160 ${150-i*12} ${222-i*6} ${50+i*8}`,fill:'none',stroke:i%2?'#94d9ff':'#b9a2f2','stroke-width':4-i*.5,opacity:.75,'stroke-linecap':'round'}));}
 else{const n=design==='nova'?18:design==='royal'?12:10;for(let i=0;i<n;i++){const a=i*Math.PI*2/n,r=i%2?50:62;svg.append(svgNode('path',{d:`M${120+Math.cos(a)*30} ${85+Math.sin(a)*30}L${120+Math.cos(a)*r} ${85+Math.sin(a)*r}`,stroke:c,'stroke-width':i%2?2:3.4,'stroke-linecap':'round'}));}}
 if(design==='royal')svg.append(svgNode('path',{d:'M100 96 96 70 110 82 120 64 130 82 144 70 140 96Z',fill:'#f4d88e',stroke:'#a8741c','stroke-width':1.5}));
 else svg.append(svgNode('circle',{cx:120,cy:85,r:16,fill:'#fff6dc',stroke:c,'stroke-width':2}),svgNode('path',{d:'m112 85 6 6 11-12',fill:'none',stroke:'#2b3b3a','stroke-width':2.6,'stroke-linecap':'round'}));
 const colors=['#ff5d8f','#ffd166','#5dd6ff','#7ee081','#b28dff'];for(let i=0;i<14;i++){const x=24+((i*53)%196),y=18+((i*37)%40);svg.append(svgNode('rect',{x,y,width:5,height:3,rx:1,fill:colors[i%5],transform:`rotate(${i*29} ${x} ${y})`,class:'sx-confetti'}));}
 stage.append(svg);
 if(live&&!reduced()&&svg.animate){const a=svg.animate([{transform:'scale(.92)',opacity:.7},{transform:'scale(1.04)',opacity:1},{transform:'scale(.92)',opacity:.7}],{duration:2200,iterations:Infinity});stage.cleanups.push(()=>a.cancel());}
}
function titleArt(stage,item){const plate=make('div','sx-title-plate');plate.style.setProperty('--title-color',item.color);plate.append(make('i',null,'✦'),make('b',null,item.name),make('i',null,'✦'));stage.append(plate);}
export function mountCollectible(target,item,{live=false,playerColor,boardGame='jackaroo',seats=4}={}){
 const stage=make('div','atelier-preview sx-art sx-art-'+item.type+(live?' is-live':''));stage.dataset.collectible=item.id;stage.cleanups=[];target.append(stage);
 if(item.type==='table'){
  const state={turn:0,players:Array.from({length:seats},(_,i)=>({name:['أنت','سارة','محمد','ريم','خالد','نور'][i],tokens:[i===0?3:-1,i===1?9:-1,-1,-1],marbles:[i===0?3:-1,i===1?9:-1,-1,-1]}))};
  renderPetalBoard(stage,state,{game:boardGame,material:TABLE_MATERIAL[item.id]||item.design||'walnut',preview:true,active:-1});
 }else if(item.type==='dice'){
  for(const [name,value]of Object.entries(core.COSMETIC_STYLES[item.id]||{}))stage.style.setProperty(name,value);
  if(DIE_ONE[item.id])stage.style.setProperty('--die-one',DIE_ONE[item.id]);
  const die=make('div','die');stage.append(die);window.BS_DICE?.mount?.(die);window.BS_DICE?.set?.(die,5);stage.roll=()=>window.BS_DICE?.roll?.(die,window.BS_DICE.random(),{quiet:false});
 }else if(item.type==='pawn'){
  const svg=window.BS_PIECES?.icon?.(document,{design:window.BS_PIECES.designFor(item.id),color:playerColor||pawnColor(item),className:'sx-pawn-art',label:''});if(svg)stage.append(svg);
 }else if(item.type==='character'){
  const img=make('img','sx-character-art');img.src='/assets/characters/'+(item.asset||'fox')+'.webp';img.alt='';img.loading='lazy';img.decoding='async';stage.append(img);
 }else if(item.type==='snake'){
  const img=make('img','sx-snake-art'+(item.id==='snake-sovereign'?' is-hero':''));img.src=item.id==='snake-sovereign'?'/assets/brand/sovereign-hero.webp':'/assets/previews/'+item.id+'.webp';img.alt='';img.loading='lazy';img.decoding='async';stage.append(img);
 }else if(item.type==='board'){miniBoard(stage,item);
 }else if(item.type==='emote'){const g=make('span','sx-glyph fx-'+(item.fx||'pop'),item.glyph);stage.append(g);
 }else if(item.type==='phrase'){const b=make('div','sx-bubble tier-'+tier(item));b.append(make('span',null,item.text||item.name));stage.append(b);
 }else if(item.type==='move'){stage.dataset.fx=item.fx;const scene=make('div','sx-scene');for(let i=0;i<9;i++){const d=make('i');d.style.setProperty('--i',String(i));scene.append(d);}stage.append(scene,make('span','sx-glyph',item.glyph));
 }else if(item.type==='trail')trailArt(stage,item,live);
 else if(item.type==='victory')victoryArt(stage,item,live);
 else titleArt(stage,item);
 stage.dispose=()=>{for(const cleanup of stage.cleanups)try{cleanup()}catch{}};
 return stage;
}
/* Cards draw their art when they come close to the screen. */
function lazyArt(slot,item){
 if(typeof IntersectionObserver!=='function'){mountCollectible(slot,item);return;}
 observer??=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const it=core.CATALOG.find(i=>i.id===entry.target.dataset.art);if(it&&!entry.target.firstChild)mountCollectible(entry.target,it);}},{rootMargin:'320px 0px'});
 slot.dataset.art=item.id;observer.observe(slot);
}

/* ---------- actions ---------- */
async function operate(work,success){
 if(pending)return;pending=true;render();
 try{await work();message(success);window.BS_AUDIO?.play?.('reward',{volume:.4});}
 catch(error){const errors={insufficient_coins:'رصيدك لا يكفي. افتح المكافآت واجمع العملات من اللعب.',price_changed:'تغيّر السعر؛ حدّثنا السعر، راجعه قبل التأكيد.',unauthorized:'انتهت جلسة الحساب. سجّل الدخول مرة أخرى.',account_changed:'تغيّر الحساب؛ راجع مقتنيات الحساب الحالي.',checkout_conflict:'تغيّرت السلة؛ راجعها قبل الشراء.',item_not_owned:'هذه القطعة غير مملوكة.',item_locked:'هذه القطعة تُفتح بإنجاز ولا تُشترى.',item_retired:'هذه القطعة لم تعد تُباع.'};if(error.message==='price_changed')checkout=null;message(errors[error.message]||'لم تكتمل العملية. أعد المحاولة بعد التحقق من الاتصال.',true);}
 finally{pending=false;render();}
}
function buy(item,quotedPrice=cost(item)){
 const owned=profile().owned.includes(item.id);
 if(owned&&REACTION.has(item.type))return Promise.resolve();
 return operate(()=>owned?api().equip(item.id):api().purchase(item.id,{expectedPrice:quotedPrice}),REACTION.has(item.type)?'أصبح «'+item.name+'» في حسابك. تجده في زر التفاعل داخل الغرف.':'تم تجهيز '+item.name+' داخل ألعابك.');
}
function addToBag(item){if(bag.includes(item.id))return openBag();if(bag.length>=12)return message('السلة تستوعب 12 قطعة في العملية الواحدة.',true);bag.push(item.id);checkout=null;saveLists();message('أضفنا '+item.name+' إلى السلة.');render();}
function heart(){const svg=svgNode('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});svg.append(svgNode('path',{d:'M20 5c-2-3-6-2-8 1C10 3 6 2 4 5c-4 5 2 10 8 14 6-4 12-9 8-14Z'}));return svg;}

/* ---------- cards ---------- */
function state(item,p){const owned=p.owned.includes(item.id),equipped=!REACTION.has(item.type)&&p.equipped[item.type]===item.id;return {owned,equipped,price:cost(item),offer:core.dailyOffer(now()).id===item.id&&!owned};}
function card(item,p){
 const s=state(item,p),t=tier(item),article=make('article','atelier-product sx-card tier-'+t+(s.owned?' is-owned':'')+(s.equipped?' is-equipped':''));article.dataset.item=item.id;article.dataset.type=item.type;
 const art=make('div','sx-card-art'),inspect=make('button','sx-inspect');inspect.type='button';inspect.dataset.control='inspect';inspect.setAttribute('aria-label','معاينة '+item.name);inspect.setAttribute('aria-haspopup','dialog');
 const slot=make('div','sx-slot');inspect.append(slot);lazyArt(slot,item);inspect.onclick=()=>openPreview(item);art.append(inspect);
 art.append(make('span','sx-tier',TIER[t]));
 const favorite=make('button','atelier-favorite sx-fav');favorite.type='button';favorite.dataset.control='favorite';favorite.setAttribute('aria-label','تفضيل '+item.name);favorite.setAttribute('aria-pressed',String(favorites.includes(item.id)));favorite.append(heart());
 favorite.onclick=()=>{favorites=favorites.includes(item.id)?favorites.filter(id=>id!==item.id):[...favorites,item.id];saveLists();render();document.querySelector('[data-item="'+item.id+'"] [data-control="favorite"]')?.focus();};art.append(favorite);
 if(s.owned)art.append(make('span','atelier-owned-tag sx-owned',s.equipped?'مجهّز':REACTION.has(item.type)?'في حسابك':'في خزانتك'));
 if(s.offer)art.append(make('span','sx-deal','عرض اليوم'));
 article.append(art);
 const body=make('div','sx-card-body');body.append(make('h3',null,item.name),make('p',null,REACTION.has(item.type)?TYPE_LABEL[item.type]+' · '+TIER[t]:TYPE_LABEL[item.type]+' · '+subtitle(item)));
 const actions=make('div','atelier-product-actions sx-actions'),button=make('button','atelier-button sx-price');button.type='button';button.dataset.control='buy';
 if(locked(item)&&!s.owned){button.textContent=lockText(item);button.disabled=true;button.classList.add('is-locked');}
 else if(s.owned){button.textContent=s.equipped?'مجهّز ✓':REACTION.has(item.type)?'مملوك':'تجهيز';button.disabled=pending||s.equipped||REACTION.has(item.type);button.classList.add('is-owned');}
 else{if(s.offer)button.append(make('s',null,fmt(item.price)));button.append(coin(),make('b',null,s.price===0?'مجاني':fmt(s.price)));button.disabled=pending||p.coins<s.price;if(p.coins<s.price)button.classList.add('is-short');}
 button.setAttribute('aria-label',(s.owned?'تجهيز ':'شراء ')+item.name+(s.owned?'':' مقابل '+s.price+' عملة'));button.onclick=()=>buy(item,s.price);actions.append(button);
 if(!s.owned&&!locked(item)){const add=make('button','atelier-add sx-add','+');add.type='button';add.setAttribute('aria-label','إضافة '+item.name+' إلى السلة');add.disabled=pending;add.onclick=()=>addToBag(item);actions.append(add);}
 body.append(actions);article.append(body);return article;
}
function matches(item){return !query||tidy(item.name+' '+subtitle(item)+' '+(item.text||'')+' '+TYPE_LABEL[item.type]).includes(tidy(query));}
function visibleItems(p){
 const rows=catalogue(p).filter(item=>(view!=='inventory'||p.owned.includes(item.id))&&(filter==='all'||filter==='favorites'&&favorites.includes(item.id)||item.type===filter)&&matches(item));
 if(sort!=='featured')rows.sort((a,b)=>sort==='price-low'?cost(a)-cost(b):cost(b)-cost(a));return rows;
}
function renderRail(p){
 const rail=$('collectionFilters');rail.replaceChildren();const all=catalogue(p).filter(item=>view!=='inventory'||p.owned.includes(item.id));
 const entries=[['all','الكل','✦'],...CATS.map(([id,label,icon])=>[id,label,icon]),['favorites','المفضلة','♥']];
 for(const [id,label,icon] of entries){
  const count=id==='all'?all.length:id==='favorites'?all.filter(i=>favorites.includes(i.id)).length:all.filter(i=>i.type===id).length;
  if(!count&&id!=='all'&&id!==filter)continue;
  const b=make('button','sx-filter'+(id===filter?' active':''));b.type='button';b.dataset.filter=id;b.setAttribute('aria-pressed',String(id===filter));b.append(make('span','sx-filter-icon',icon),make('span',null,label),make('small',null,String(count)));
  rail.append(b);
 }
}
function renderCollection(p){
 const items=visibleItems(p),grid=$('collectionGrid');grid.replaceChildren();
 const groups=filter==='all'?CATS.map(([id,label,icon,about])=>({id,label,icon,about,items:items.filter(i=>i.type===id)})).filter(g=>g.items.length):[{id:filter,label:filter==='favorites'?'المفضلة':TYPE_LABEL[filter],icon:'',about:filter==='favorites'?'القطع التي حفظتها بالقلب.':(CATS.find(c=>c[0]===filter)?.[3]||''),items}];
 const rows=filter==='all';
 for(const g of groups){if(!g.items.length)continue;const section=make('section','sx-section');section.dataset.section=g.id;const head=make('header','sx-section-head'),title=make('div');title.append(make('h3',null,(g.icon?g.icon+' ':'')+g.label),make('p',null,g.about));head.append(title);
  if(rows){const more=make('button','sx-see-all');more.type='button';more.append(make('span',null,'عرض الكل'),make('small',null,String(g.items.length)));more.setAttribute('aria-label','عرض كل '+g.label);more.onclick=()=>{filter=g.id;render();$('collection').scrollIntoView?.({block:'start'});};head.append(more);}else head.append(make('span','sx-count',g.items.length+' قطعة'));
  const list=make('div',rows?'sx-row':'sx-grid');for(const item of g.items)list.append(card(item,p));section.append(head,list);grid.append(section);}
 $('collectionCount').textContent=items.length+' قطعة';$('collectionEmpty').hidden=items.length>0;
}

/* ---------- daily offer ---------- */
function nextReset(){const day=core.riyadhDay(now());return Date.parse(day+'T00:00:00Z')-10800000+86400000;}
function clockText(){const left=Math.max(0,nextReset()-now()),h=Math.floor(left/3600000),m=Math.floor(left%3600000/60000),s=Math.floor(left%60000/1000);return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');}
function renderHero(p){
 const hero=$('shopHero'),offer=core.dailyOffer(now()),item=core.CATALOG.find(i=>i.id===offer.id);hero.hidden=view!=='shop'||!item;if(hero.hidden||!item)return;
 if(hero.dataset.offer!==item.id||!heroParts){heroParts?.stage?.dispose?.();hero.replaceChildren();hero.dataset.offer=item.id;
  const art=make('div','sx-hero-art'),copy=make('div','sx-hero-copy'),title=make('h1',null,item.name);art.dataset.slot='offer';title.id='offerName';
  heroParts={eyebrow:make('span','sx-eyebrow sx-hero-eyebrow'),meta:make('p','sx-hero-meta'),price:make('div','sx-hero-price'),timer:make('p','sx-timer'),actions:make('div','sx-hero-actions')};
  copy.append(heroParts.eyebrow,title,heroParts.meta,heroParts.price,heroParts.timer,heroParts.actions);hero.append(art,copy);heroParts.stage=mountCollectible(art,item,{live:true});
 }
 const s=state(item,p),t=tier(item);hero.className='sx-hero tier-'+t;
 heroParts.eyebrow.textContent='عرض اليوم · خصم 20%';
 heroParts.meta.textContent=TYPE_LABEL[item.type]+' · '+TIER[t];
 const price=heroParts.price;price.replaceChildren();if(s.owned)price.append(make('b',null,s.equipped?'مجهّز في ألعابك':'في خزانتك'));else{price.append(make('s',null,fmt(offer.originalPrice)),coin(),make('b',null,fmt(offer.price)));}
 heroParts.clock=make('b','sx-clock',clockText());heroParts.timer.replaceChildren(make('span',null,'يتجدد العرض بعد '),heroParts.clock);
 const actions=heroParts.actions;actions.replaceChildren();
 const main=make('button','sx-button primary',s.owned?(s.equipped||REACTION.has(item.type)?'معاينة':'تجهيز'):p.coins<offer.price?'تحتاج '+fmt(offer.price-p.coins)+' عملة':'اشترِ الآن');main.type='button';main.dataset.offerAction='buy';
 main.disabled=pending||!s.owned&&p.coins<offer.price;main.onclick=()=>s.owned&&(s.equipped||REACTION.has(item.type))?openPreview(item):buy(item,offer.price);
 const look=make('button','sx-button ghost','معاينة');look.type='button';look.dataset.offerAction='inspect';look.onclick=()=>openPreview(item);actions.append(main);if(!(s.owned&&(s.equipped||REACTION.has(item.type))))actions.append(look);
 if(!clock&&typeof setInterval==='function'){clock=setInterval(()=>{if(heroParts?.clock)heroParts.clock.textContent=clockText();if($('shopHero').dataset.offer!==core.dailyOffer(now()).id)render();},1000);clock?.unref?.();}
}

/* ---------- sets, rewards, loadout ---------- */
function renderSets(p){
 const target=$('setsGrid');target.replaceChildren();const shelf=new Set(core.STOREFRONT||[]);
 for(const set of core.BUNDLES.filter(row=>row.items.every(id=>shelf.has(id)))){
  const quote=core.bundleQuote(p,set.id,{now:now()}),card=make('article','atelier-set sx-set');card.dataset.bundle=set.id;card.style.setProperty('--set-color',set.color);
  const art=make('div','sx-set-art');for(const id of set.items.slice(0,3)){const item=core.CATALOG.find(i=>i.id===id);const cell=make('div','sx-set-cell');art.append(cell);lazyArt(cell,item);}
  const footer=make('div','sx-set-footer'),price=make('div','sx-set-price');
  if(quote.missing.length){price.append(make('s',null,fmt(quote.originalPrice)),coin(),make('b',null,fmt(quote.price)),make('small',null,'وفّر '+fmt(quote.saving)));}else price.append(make('b',null,'مكتملة في خزانتك'));
  const button=make('button','sx-button '+(quote.missing.length?'primary':'ghost'),quote.missing.length?'شراء المجموعة':'تجهيز المجموعة');button.type='button';button.disabled=pending||p.coins<quote.price;button.onclick=()=>operate(()=>api().bundle(set.id,{expectedPrice:quote.price}),'تم تجهيز '+set.name+'.');
  footer.append(price,button);
  const copy=make('div','sx-set-copy');copy.append(make('span','sx-eyebrow',set.items.length+' قطع · خصم 25%'),make('h3',null,set.name),make('p',null,set.description));
  card.append(art,copy,footer);target.append(card);
 }
 $('setsSection').hidden=view!=='shop'||!target.children.length;
}
function renderRewards(p){
 const status=core.dailyStatus(p,{now:now()}),gift=$('dailyGift');gift.replaceChildren();
 const head=make('div','sx-daily-head'),copy=make('div');copy.append(make('span','sx-eyebrow','سلسلة الحضور · اليوم '+status.streak+' من 7'),make('h3',null,status.claimed?'هدية اليوم في رصيدك.':'هدية اليوم: '+status.coins+' عملة'),make('p',null,'ادخل كل يوم لترتفع الهدية حتى 120 عملة.'));
 const claim=make('button','sx-button primary',status.claimed?'تم الاستلام':'استلم هديتك');claim.type='button';claim.disabled=pending||status.claimed;claim.onclick=()=>operate(()=>api().daily(),'أُضيفت هدية اليوم إلى رصيدك.');
 head.append(copy,claim);const days=make('ol','sx-days');status.gifts.forEach((coins,i)=>{const d=make('li','sx-day'+(i+1<status.streak||i+1===status.streak&&status.claimed?' is-done':'')+(i+1===status.streak&&!status.claimed?' is-today':''));d.append(make('small',null,'يوم '+(i+1)),make('b',null,coins));days.append(d);});
 gift.append(head,days);
 const grid=$('objectivesGrid');grid.replaceChildren();
 for(const objective of core.objectives(p,{now:now()})){
  const tile=make('article','atelier-objective sx-objective'+(objective.ready?' is-ready':'')+(objective.claimed?' is-claimed':''));tile.dataset.objective=objective.id;
  const footer=make('div','sx-objective-footer'),button=make('button','sx-button '+(objective.ready?'primary':'ghost'),objective.claimed?'مستلمة':objective.ready?'استلام':Math.min(objective.current,objective.goal)+' / '+objective.goal);button.type='button';button.disabled=pending||!objective.ready;button.onclick=()=>operate(()=>api().claim(objective.id),'استلمت مكافأة '+objective.name+'.');
  const reward=make('b','sx-objective-reward');reward.append(coin(),make('span',null,'+'+objective.coins));footer.append(reward,button);
  tile.append(make('span','sx-eyebrow',{daily:'مهمّة يومية',weekly:'تحدٍّ أسبوعي',achievement:'إنجاز دائم'}[objective.kind]),make('h3',null,objective.name),make('p',null,objective.description));
  const meter=make('div','sx-meter'),fill=make('i');fill.style.width=Math.min(100,objective.current/objective.goal*100)+'%';meter.append(fill);tile.append(meter);
  tile.append(footer);grid.append(tile);
 }
}
function renderLoadout(p){
 const target=$('atelierLoadout');target.replaceChildren();
 for(const type of SLOTS){
  const id=p.equipped[type],item=core.CATALOG.find(i=>i.id===id);if(!item)continue;
  const button=make('button','sx-slot-card');button.type='button';button.dataset.loadout=type;const art=make('div','sx-slot-art');mountCollectible(art,item);
  const text=make('span');text.append(make('small',null,TYPE_LABEL[type]),make('b',null,item.name));button.append(art,text);button.onclick=()=>openPreview(item);target.append(button);
 }
}

/* ---------- render ---------- */
function render(){
 if(key()!==accountKey){accountKey=key();bag=readList('bag');favorites=readList('favorites');checkout=null;}
 const p=profile(),rewards=view==='rewards';
 $('collection').hidden=rewards;$('rewardsSection').hidden=!rewards;
 $('collectionTitle').textContent=view==='inventory'?'خزانتي':'المجموعة';$('collectionEyebrow').textContent=view==='inventory'?'كل ما تملكه، جاهز للتجهيز':'كل ما يظهر داخل اللعب';
 document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===view;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=pending;});
 renderHero(p);if(!rewards){renderRail(p);renderCollection(p);}renderSets(p);renderLoadout(p);if(rewards)renderRewards(p);
 $('bagCount').textContent=String(bag.length);$('bagCount').hidden=!bag.length;
 if($('previewDialog').open)updatePreviewControls();if($('bagDialog').open)renderBag();
}

/* ---------- preview ---------- */
function updatePreviewControls(){
 const item=core.CATALOG.find(item=>item.id===previewId);if(!item)return;
 const p=profile(),s=state(item,p),isReaction=REACTION.has(item.type);
 $('previewOwnership').textContent=locked(item)&&!s.owned?lockText(item):s.equipped?'مجهّزة الآن':s.owned?(isReaction?'في حسابك — تجده في زر التفاعل داخل الغرف':'ضمن خزانتك'):fmt(s.price)+' عملة · رصيدك '+fmt(p.coins);
 const action=$('previewAction');action.textContent=locked(item)&&!s.owned?lockText(item):s.equipped?'مجهّزة داخل اللعب':s.owned?(isReaction?'مملوك':'جهّز القطعة'):p.coins<s.price?'تحتاج '+fmt(s.price-p.coins)+' عملة إضافية':'شراء'+(isReaction?'':' وتجهيز')+' · '+fmt(s.price)+' ◈';
 action.disabled=pending||s.equipped||isReaction&&s.owned||locked(item)&&!s.owned||!s.owned&&p.coins<s.price;action.onclick=()=>buy(item,s.price);
 $('previewBag').hidden=s.owned||locked(item);$('previewBag').disabled=pending;$('previewBag').textContent=bag.includes(item.id)?'فتح السلة':'أضف إلى السلة';$('previewBag').onclick=()=>{addToBag(item);};
}
function openPreview(item){
 if($('bagDialog').open)$('bagDialog').close();previewCleanup();previewId=item.id;$('previewMessage').textContent='';
 const t=tier(item);$('previewType').textContent=TYPE_LABEL[item.type]+' · '+TIER[t];$('previewType').className='sx-chip tier-'+t;$('previewName').textContent=item.name;$('previewMaterial').textContent=item.type==='emote'?item.glyph+' إيموجي متحرك':item.type==='phrase'?'عبارة جاهزة':item.type==='move'?item.glyph+' حركة على اللوحة':subtitle(item);$('previewDescription').textContent=item.description;
 const art=$('previewArt'),options=$('previewOptions');art.replaceChildren();art.className='sx-preview-stage tier-'+t;options.replaceChildren();let mounted=mountCollectible(art,item,{live:true}),boardGame='jackaroo',seats=4;
 const replace=extra=>{mounted.dispose();art.replaceChildren();mounted=mountCollectible(art,item,{live:true,...extra});};
 if(item.type==='pawn')(window.BS_PIECES?.COLORS||[]).forEach((color,i)=>{const button=make('button','sx-swatch');button.type='button';button.style.setProperty('--swatch',color);button.setAttribute('aria-label','معاينة بلون اللاعب '+(i+1));button.onclick=()=>{options.querySelectorAll('.sx-swatch').forEach(b=>b.classList.toggle('active',b===button));replace({playerColor:color});};options.append(button);});
 if(item.type==='table'){for(const [label,game]of [['جاكارو','jackaroo'],['الزهرة','zahra']]){const button=make('button',game===boardGame?'active':'',label);button.type='button';button.onclick=()=>{boardGame=game;options.querySelectorAll('[data-board-game]').forEach(b=>b.classList.toggle('active',b.dataset.boardGame===game));replace({boardGame,seats});};button.dataset.boardGame=game;options.append(button);}const count=make('button',null,'6 لاعبين');count.type='button';count.onclick=()=>{seats=seats===4?6:4;count.textContent=seats===6?'4 لاعبين':'6 لاعبين';replace({boardGame,seats});};options.append(count);}
 if(item.type==='dice'){const roll=make('button','sx-try-button','ارمِ النرد للتجربة');roll.type='button';roll.onclick=async()=>{roll.disabled=true;try{await mounted.roll?.();}finally{roll.disabled=false;}};options.append(roll);}
 if(REACTION.has(item.type)){const play=make('button','sx-try-button',item.type==='move'?'شغّل الحركة':'جرّب على الشاشة');play.type='button';play.onclick=()=>window.BS_REACTIONS?.preview?.(item.id,$('previewDialog'));options.append(play);if(!window.BS_REACTIONS?.preview)play.hidden=true;}
 if(item.type==='victory'){const play=make('button','sx-try-button','أعد الاحتفال');play.type='button';play.onclick=()=>replace({});options.append(play);}
 const [href,label]=TRY[item.type]||TRY.pawn;$('previewTry').href=href;$('previewTry').textContent=label;
 updatePreviewControls();previewCleanup=()=>mounted.dispose();if(!$('previewDialog').open)$('previewDialog').showModal();
}

/* ---------- bag ---------- */
function openBag(){if($('previewDialog').open)$('previewDialog').close();renderBag();if(!$('bagDialog').open)$('bagDialog').showModal();}
function renderBag(){
 const target=$('bagItems');target.replaceChildren();const p=profile();let quote={price:0};
 if(bag.length)quote=core.cartQuote(p,bag,{now:now()});else target.append(make('p','sx-bag-empty','سلتك فارغة. اضغط + على أي قطعة لتضيفها هنا.'));
 for(const id of bag){const item=core.CATALOG.find(item=>item.id===id),row=make('div','atelier-bag-row sx-bag-row');row.dataset.bagItem=id;const art=make('div','sx-bag-art');mountCollectible(art,item);const copy=make('div');copy.append(make('h3',null,item.name),make('small',null,p.owned.includes(id)?'مملوكة · تجهيز دون تكلفة':TYPE_LABEL[item.type]+' · '+fmt(cost(item))+' ◈'));const remove=make('button','atelier-bag-remove','إزالة');remove.disabled=pending;remove.onclick=()=>{const at=bag.indexOf(id);bag=bag.filter(value=>value!==id);checkout=null;saveLists();render();($('bagItems').querySelectorAll('.atelier-bag-remove')[Math.min(at,bag.length-1)]||$('bagClose')).focus();};row.append(art,copy,remove);target.append(row);}
 $('bagTotal').textContent=String(quote.price);$('bagCheckout').disabled=pending||!bag.length||p.coins<quote.price;$('bagCheckout').textContent=pending?'جارٍ التأكيد…':p.coins<quote.price?'تحتاج '+fmt(quote.price-p.coins)+' عملة إضافية':'تأكيد الشراء والتجهيز';
}
$('bagCheckout').onclick=()=>{if(!bag.length||pending)return;const quote=core.cartQuote(profile(),bag,{now:now()});checkout??={ids:[...bag],price:quote.price,id:crypto.randomUUID().replaceAll('-','')};const transaction=checkout;return operate(async()=>{await api().cart(transaction.ids,{expectedPrice:transaction.price,requestId:transaction.id});bag=[];checkout=null;saveLists();$('bagDialog').close();},'أُضيفت مقتنيات السلة وتجهّزت داخل ألعابك.');};

/* ---------- wiring ---------- */
function setView(next){view=next;filter='all';query='';$('collectionSearch').value='';render();try{const url=new URL(location.href);url.searchParams.set('view',view);url.searchParams.delete('filter');history.replaceState({},'',url.pathname+url.search);}catch{}}
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
$('walletButton').onclick=()=>setView('rewards');
$('collectionFilters').onclick=event=>{const button=event.target?.closest?.('[data-filter]')||(event.target?.dataset?.filter?event.target:null);if(!button)return;const id=button.dataset.filter;filter=id;render();$('collectionFilters').querySelector('[data-filter="'+id+'"]')?.focus?.();try{const url=new URL(location.href);if(id==='all')url.searchParams.delete('filter');else url.searchParams.set('filter',id);history.replaceState({},'',url.pathname+url.search+url.hash);}catch{}};
$('collectionSearch').oninput=event=>{query=event.target.value;render();};$('collectionSort').onchange=event=>{sort=event.target.value;render();};
$('clearFilters').onclick=()=>{filter='all';query='';$('collectionSearch').value='';render();$('collectionSearch').focus();};
$('bagOpen').onclick=openBag;$('bagClose').onclick=()=>$('bagDialog').close();$('previewClose').onclick=()=>$('previewDialog').close();
$('previewDialog').addEventListener('close',()=>{const id=previewId;previewCleanup();previewId=null;if(!$('bagDialog').open)(document.querySelector('[data-item="'+id+'"] [data-control="inspect"]')||$('collectionSearch')).focus();});
$('bagDialog').addEventListener('close',()=>{if(!$('previewDialog').open)$('bagOpen').focus();});
for(const dialog of [$('previewDialog'),$('bagDialog')]){
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();return;}if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button,a,input,select')].filter(el=>!el.disabled&&!el.hidden&&!el.closest?.('[hidden]')),first=controls[0],last=controls.at(-1);if(!dialog.contains(document.activeElement)){event.preventDefault();first?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
}
window.addEventListener('bs-career-change',render);window.addEventListener('storage',event=>{if(event.key?.startsWith('atelier30:')){bag=readList('bag');favorites=readList('favorites');checkout=null;render();}});
{const params=new URLSearchParams(location.search),initialView=params.get('view'),initialFilter=params.get('filter');if(['shop','inventory','rewards'].includes(initialView))view=initialView;if(initialFilter&&(initialFilter==='favorites'||TYPE_LABEL[initialFilter]))filter=initialFilter;}
function measure(){const h=document.querySelector('.sx-top')?.offsetHeight;if(h)document.body.style.setProperty('--sx-head',h+'px');}
window.addEventListener('resize',measure,{passive:true});measure();
accountKey=key();bag=readList('bag');favorites=readList('favorites');render();
