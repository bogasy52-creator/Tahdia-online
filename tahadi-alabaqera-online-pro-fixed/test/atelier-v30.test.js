import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,stat} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
import {loadAtelier} from './atelier-harness.mjs';
import {Career} from '../src/career/core.js';
import * as Arcade from '../public/assets/js/engines/arcade-engine.js';
import {environment,api,signup} from './worker-harness.mjs';
const now=Date.parse('2026-10-23T12:00:00Z');
const state=seats=>({turn:0,players:Array.from({length:seats},(_,i)=>({name:'لاعب '+(i+1),tokens:[-1,-1,-1,-1]}))});
test('the store shows every storefront design once, without retired or duplicate pieces or the manager items',async()=>{
 // 33.0.0 adds «شخصيتي», a free stone that is the player's own hero
 assert.equal(Career.COLLECTION.length,25);assert.equal(new Set(Career.COLLECTION.map(i=>i.id)).size,25);assert.equal(Career.COLLECTION.filter(i=>i.price===0).length,6);
 const h=await createDOM('shop.html');h.context.BS_CAREER={get:()=>Career.normalize({coins:5000}),now:()=>now};await loadAtelier(h);
 const shelf=Career.STOREFRONT.filter(id=>Career.CATALOG.find(i=>i.id===id).source!=='owner');
 assert.equal(h.doc.querySelectorAll('.atelier-product').length,shelf.length);assert.equal(new Set(Career.STOREFRONT).size,Career.STOREFRONT.length);
 for(const item of [...Career.COLLECTION,...Career.REACTIONS.filter(i=>!i.source)])assert.ok(h.doc.querySelector('[data-item="'+item.id+'"]'),item.id);
 for(const id of ['snake-gold','character-princess','board-cyber'])assert.ok(h.doc.querySelector('[data-item="'+id+'"]'),id);
 for(const id of ['pawn-jade','pawn-prism','dice-copper','table-cyber','title-manager','snake-sovereign','move-sovereign'])assert.ok(!h.doc.querySelector('[data-item="'+id+'"]'),id);
});
test('all replacement pieces can be bought and equipped without losing old ownership or receipts',()=>{
 let p=Career.normalize({coins:20000,owned:['pawn-jade','snake-plasma'],receipts:['earlier-round']});
 for(const item of Career.COLLECTION){const before=p.coins,price=p.owned.includes(item.id)?0:Career.itemPrice(item.id,now);p=Career.purchase(p,item.id,{now,expectedPrice:price});assert.equal(p.coins,before-price);assert.equal(p.equipped[item.type],item.id);const retry=Career.purchase(p,item.id,{now});assert.equal(retry.coins,p.coins);}
 assert.ok(p.owned.includes('pawn-jade'));assert.ok(p.owned.includes('snake-plasma'));assert.ok(p.receipts.includes('earlier-round'));
});
test('three replacement sets discount only missing pieces and equip their exact contents',()=>{
 for(const set of Career.BUNDLES.filter(b=>b.collection==='atelier-30')){const p=Career.normalize({coins:5000,owned:[set.items[0]]}),quote=Career.bundleQuote(p,set.id,{now});assert.ok(!quote.missing.includes(set.items[0]));assert.equal(quote.price,Math.floor(quote.originalPrice*.75));const after=Career.purchaseBundle(p,set.id,{now,expectedPrice:quote.price});for(const id of set.items){const item=Career.CATALOG.find(i=>i.id===id);assert.equal(after.equipped[item.type],id);}assert.equal(Career.bundleQuote(after,set.id,{now}).price,0);}
});
test('Worker accepts the new priced cart, refuses forged prices and replays a lost response once',async()=>{
 const env=environment(),sign=await signup(env,'atelier30'),token=sign.data.token,holder=env.BOARD_ROOMS.peek('social:user:atelier30');await holder.ctx.storage.put('career',Career.normalize({coins:5000}));
 const ids=['pawn-orbit','dice-milled','table-nocturne','trail-ripple'],before=(await api(env,'/api/social/career',undefined,token)).data.career,quote=Career.cartQuote(before,ids),body={ids,expectedPrice:quote.price,requestId:'atelier-v30-real-checkout'};
 assert.equal((await api(env,'/api/social/career/cart',{...body,expectedPrice:0},token)).response.status,400);assert.equal((await api(env,'/api/social/career',undefined,token)).data.career.coins,5000);
 for(let i=0;i<2;i++)assert.equal((await api(env,'/api/social/career/cart',body,token)).response.status,200);
 const after=(await api(env,'/api/social/career',undefined,token)).data.career;assert.equal(after.coins,5000-quote.price);assert.equal(after.checkouts.length,1);for(const id of ids)assert.equal(after.equipped[Career.CATALOG.find(i=>i.id===id).type],id);
});
for(const game of ['jackaroo','zahra'])for(const seats of [4,6])test(game+' has the real '+seats+'-seat track and four unique sculptures per player',async()=>{
 const h=await createDOM(game+'.html'),board=h.doc.getElementById('board');h.context.renderPetalBoard(board,state(seats),{game,material:'ivory'});
 assert.equal(board.querySelectorAll('[data-track]').length,seats*13);assert.equal(board.querySelectorAll('[data-home]').length,seats*4);assert.equal(board.querySelectorAll('[data-stone]').length,seats*4);assert.equal(new Set(board.querySelectorAll('[data-stone]').map(e=>e.dataset.stone)).size,seats*4);
 for(const el of board.querySelectorAll('[data-stone]')){const values=el.getAttribute('transform').match(/[\d.]+/g).map(Number);assert.ok(values.every(v=>v>=0&&v<=200));}
});
test('only legal pieces accept pointer and keyboard input; inactive pieces cannot block them',async()=>{
 const h=await createDOM('zahra.html'),board=h.doc.getElementById('board'),picked=[];h.context.renderPetalBoard(board,state(6),{active:1,legal:[0,2],onPick:i=>picked.push(i)});
 const first=board.querySelector('[data-stone="1:0"]'),second=board.querySelector('[data-stone="1:2"]');first.onclick();let prevented=false;second.onkeydown({key:'Enter',preventDefault(){prevented=true}});assert.deepEqual(picked,[0,2]);assert.equal(prevented,true);assert.equal(first.getAttribute('tabindex'),'0');assert.equal(board.querySelector('[data-stone="0:0"]').getAttribute('pointer-events'),'none');
});
test('repeated redraws retain the active motion and capture effects use the previous location',async()=>{
 const frames=[],h=await createDOM('jackaroo.html',{matchMedia:()=>({matches:false})}),board=h.doc.getElementById('board'),create=h.doc.createElementNS;h.doc.createElementNS=(...args)=>{const el=create(...args);el.animate=(keyframes,options)=>{frames.push({keyframes,options});return{finished:Promise.resolve(),cancel(){}}};return el};
 const before=state(4);before.players[0].tokens[0]=1;before.players[1].tokens[0]=1;h.context.renderPetalBoard(board,before,{game:'jackaroo'});const after=structuredClone(before);after.players[0].tokens[0]=8;after.players[1].tokens[0]=-1;
 const svg=h.context.renderPetalBoard(board,after,{game:'jackaroo'}),motion=board.atelierMotion;assert.equal(h.context.renderPetalBoard(board,after,{game:'jackaroo'}),svg);assert.equal(board.atelierMotion,motion);assert.ok(board.querySelector('[data-board-effect="capture"]'));assert.ok(frames.some(row=>row.keyframes.length>2));await motion;
});
test('reduced motion avoids travelling animations and disabled effects avoid particles',async()=>{
 const h=await createDOM('zahra.html'),board=h.doc.getElementById('board'),s=state(4);h.context.BS_AUDIO.getSettings=()=>({effects:false});h.context.renderPetalBoard(board,s);const after=structuredClone(s);after.players[0].tokens[0]=0;h.context.renderPetalBoard(board,after);assert.equal(board.querySelector('[data-board-effect]'),null);await board.atelierMotion;
});
test('equipping updates an already-open board to the owned material and sculpture',async()=>{
 const h=await createDOM('zahra.html'),board=h.doc.getElementById('board');let p=Career.normalize();h.context.BS_CAREER.get=()=>p;h.context.renderPetalBoard(board,state(6));p=Career.normalize({owned:['pawn-monolith','table-botanic'],equipped:{pawn:'pawn-monolith',table:'table-botanic'}});h.context.dispatchEvent({type:'bs-career-change'});assert.equal(board.querySelector('[data-material]').dataset.material,'jade');assert.equal(board.querySelectorAll('[data-piece-design="monolith"]').length,24);
});
test('a hidden memory card contains no face identity or spoken answer until revealed',async()=>{
 const h=await createDOM('memory.html'),tile=h.context.createMemoryTile(null,{index:2});assert.equal(tile.querySelector('.memory-front-v30').dataset.face,undefined);assert.equal(tile.getAttribute('aria-label'),'بطاقة 3 مخفية');h.context.updateMemoryTile(tile,5,{open:true,index:2});assert.equal(tile.querySelector('.memory-front-v30').dataset.face,'5');assert.match(tile.getAttribute('aria-label'),/مفتاح ذهبي/);assert.equal(tile.getAttribute('aria-pressed'),'true');
});
test('memory flip keeps the same DOM tile, reveals the correct image and marks a matched pair',async()=>{
 const h=await createDOM('memory.html');await h.runFile('assets/js/arcade-games.js',{...Arcade,shuffled:items=>items});h.doc.getElementById('start').onclick();const first=h.doc.querySelectorAll('.memory-tile')[0];first.onclick();assert.equal(h.doc.querySelectorAll('.memory-tile')[0],first);assert.equal(first.classList.contains('open'),true);assert.equal(first.querySelector('.memory-front-v30').dataset.face,'0');h.doc.querySelectorAll('.memory-tile')[8].onclick();assert.equal(h.doc.querySelectorAll('.memory-tile.matched').length,2);assert.equal(h.doc.getElementById('memoryProgress').style.width,'12.5%');assert.equal(first.disabled,true);
});
test('expert memory uses 12 distinct pairs and completes once with an accurate result summary',async()=>{
 const h=await createDOM('memory.html');h.storage.set('tahdia-arcade-level-v16:memory','expert');await h.runFile('assets/js/arcade-games.js',{...Arcade,shuffled:items=>items});vm.runInContext('window.readRound=()=>round;',h.context);h.doc.getElementById('start').onclick();const deck=[...h.context.readRound().deck];assert.equal(new Set(deck).size,12);assert.equal(deck.length,24);h.setTime(12000);for(let i=0;i<12;i++){h.doc.querySelectorAll('.memory-tile')[i].onclick();h.doc.querySelectorAll('.memory-tile')[i+12].onclick();}await Promise.resolve();await Promise.resolve();assert.equal(h.doc.querySelectorAll('.memory-tile.matched').length,24);assert.equal(h.records.length,1);assert.equal(h.records[0].win,true);assert.match(h.doc.getElementById('arcadeSummary').textContent,/100%/);assert.equal(h.doc.getElementById('memoryProgress').style.width,'100%');
});
test('new images are light local WebP resources and appear in on-demand offline assets',async()=>{
 const sw=await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');for(const file of ['memory-objects.webp','collection-hero.webp']){assert.ok((await stat(new URL('../public/assets/atelier-v30/'+file,import.meta.url))).size<100000);assert.ok(sw.includes('/assets/atelier-v30/'+file));}const html=await readFile(new URL('../public/shop.html',import.meta.url),'utf8');assert.doesNotMatch(html,/assets\/js\/(?:shop|cosmetic-art)\.js/);
});
