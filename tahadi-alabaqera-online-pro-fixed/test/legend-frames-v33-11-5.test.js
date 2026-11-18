import test from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';
import {createDOM}from'./dom-harness.mjs';import {loadAtelier}from'./atelier-harness.mjs';import{Career}from'../src/career/core.js';
const ids=['eclipse','tide','sakura','forge','astral','arabesque'];
async function ui(page='shop.html',extra={}){const h=await createDOM(page,extra);await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/legend-frame-art-v33-11-5.js');await h.runFile('assets/js/legend-frames-v33-11-5.js');return h;}
function state(){return{code:'450001',startedAt:123456,status:'playing',me:{id:'a',index:0},players:[{id:'a',index:0,name:'أبو سراج',look:{frame:'frame-eclipse',character:'fox'}},{id:'b',index:1,name:'لاعب',look:{frame:'frame-forge',character:'robot'}}],state:{winner:null,players:[{},{}]}};}
test('each frame has an independent price and purchase/equip never changes dice',()=>{
 const prices=new Set();for(const id of ids){const item=Career.CATALOG.find(i=>i.id==='frame-'+id);assert.equal(item.collection,'legend-frames-33-11-5');prices.add(item.price);assert.equal(item.features.length,6);
  const old=Career.normalize({coins:20000,equipped:{dice:'dice-ivory'}}),p=Career.purchase(old,item.id);assert.equal(p.equipped.dice,old.equipped.dice);assert.equal(p.equipped.frame,item.id);assert.ok(!p.owned.includes('dice-'+id));
  assert.throws(()=>Career.equip(Career.normalize({}),item.id),/not_owned/);
 }
 assert.equal(prices.size,6);assert.ok(Career.BUNDLES.every(b=>!b.items.some(id=>id.startsWith('frame-'))||!b.items.some(id=>id.startsWith('dice-'))),'no frame-and-dice bundle');
});
test('avatars reuse their ornament, restore decoration after roster class updates, and keep SVG paint IDs unique',async()=>{
 const h=await ui(),fx=h.context.BS_LEGEND_FRAMES,host=h.doc.createElement('div');h.doc.body.append(host);
 for(let i=0;i<2;i++){const pic=h.doc.createElement('span');host.append(pic);fx.decorateAvatar(pic,'frame-eclipse');const art=pic.querySelector('.legend-ornament');pic.className='lp-face bs-avatar';fx.decorateAvatar(pic,'frame-eclipse');assert.ok(pic.classList.contains('legend-decorated'));assert.equal(pic.querySelector('.legend-ornament'),art);assert.ok(pic.querySelector('.lf-crown'));}
 const paint=host.querySelectorAll('[id]').map(n=>n.id);assert.equal(new Set(paint).size,paint.length);fx.decorateAvatar(host.children[0],'frame-none');assert.equal(host.children[0].querySelector('.legend-ornament'),null);
});
test('entry and win follow actual room events once, including reconnect and team winners',async()=>{
 const h=await ui(),fx=h.context.BS_LEGEND_FRAMES,s=state(),events=[];h.context.addEventListener('bs-legend-effect',e=>events.push(e.detail));
 h.context.dispatchEvent({type:'bs-board-room',detail:{state:s}});assert.equal(events.length,1);assert.equal(events[0].pose,'entry');fx.frame(structuredClone(s));assert.equal(events.length,1,'resync must not replay entrance');
 s.status='finished';s.state.winner=1;fx.frame(s);assert.equal(events.at(-1).pose,'win');assert.equal(events.at(-1).id,'frame-forge');const before=events.length;fx.frame(structuredClone(s));assert.equal(events.length,before);
 fx.frame(null);assert.equal(h.doc.querySelectorAll('.legend-scene').length,0);
 const next=state();next.startedAt++;next.status='finished';next.state={winnerTeam:0,players:[{},{}]};fx.frame(next);assert.equal(events.at(-1).id,'frame-eclipse');
});
test('reduced motion produces a static scene, preferences stop game scenes, preview remains available and leave cleans up',async()=>{
 const h=await ui(),fx=h.context.BS_LEGEND_FRAMES;fx.setEnabled(false);fx.frame(state());assert.equal(h.doc.querySelectorAll('.legend-scene').length,0);
 const preview=fx.play('frame-sakura','win',{preview:true,name:'أنت'});assert.equal(h.doc.querySelectorAll('.legend-particle').length,0);assert.equal(h.doc.querySelectorAll('.legend-scene').length,1);preview.destroy();await preview.finished;
 fx.setEnabled(true);fx.frame(state());assert.equal(h.doc.querySelectorAll('.legend-scene').length,1);h.context.dispatchEvent({type:'pagehide'});assert.equal(h.doc.querySelectorAll('.legend-scene').length,0);
});
test('frame preview exposes entry, win, sound and individual price without buying or a matching-die link',async()=>{
 const h=await ui(),p=Career.normalize({coins:20000,name:'أبو سراج'}),audio=[];h.context.BS_CAREER={get:()=>p,now:()=>Date.now()};await loadAtelier(h);
 h.context.BS_AUDIO={play:(...args)=>audio.push(args),getSettings:()=>({muted:false,volume:.5})};
 h.doc.querySelector('[data-item="frame-eclipse"] [data-control="inspect"]').click();assert.ok(h.doc.querySelector('.legend-shop-details'));assert.equal(h.doc.querySelectorAll('.legend-shop-details li').length,6);assert.equal(h.doc.querySelector('.signature-pair'),null);
 h.doc.querySelector('[data-legend-preview="entry"]').click();assert.equal(h.doc.querySelector('.legend-scene').dataset.pose,'entry');assert.equal(audio.at(-1)[0],'legend-eclipse-entry');
 h.doc.querySelector('[data-legend-preview="win"]').click();assert.equal(h.doc.querySelectorAll('.legend-scene').length,1);assert.equal(audio.at(-1)[0],'legend-eclipse-win');h.doc.getElementById('previewDialog').close();assert.equal(h.doc.querySelectorAll('.legend-scene').length,0);assert.equal(p.equipped.frame,'frame-none');
});
test('the actual menu shows six seats and sends six independently to quick and private room creation',async()=>{
 for(const [game,seats]of[['zahra',[2,3,4,6]],['jackaroo',[4,6]]]){
  const h=await createDOM('jackaroo.html');await h.runFile('assets/js/game-menu-v33.js');const sent=[],host=h.doc.createElement('div');h.doc.body.append(host);
  h.context.BS_GAME_MENU.mount(host,{game,seats,seatsDefault:6,onCreate:async row=>sent.push(['create',row]),onQuick:async row=>sent.push(['quick',row])});
  const button=host.querySelector('[data-seats="6"]');assert.ok(button);assert.equal(button.getAttribute('aria-checked'),'true');button.click();host.querySelector('.gm33-create').click();await Promise.resolve();await Promise.resolve();assert.equal(sent[0][1].seats,6);await new Promise(r=>setImmediate(r));host.querySelector('.gm33-quick').click();await new Promise(r=>setImmediate(r));assert.equal(sent[1][0],'quick');assert.equal(sent[1][1].seats,6);
 }
});
test('standalone art, original sounds and licensed Arabic typefaces all ship locally',async()=>{
 for(const id of ids){const art=await readFile(new URL('../public/assets/legend-frames-v33-11-5/frame-'+id+'.svg',import.meta.url),'utf8');assert.match(art,/class="lf-crown"/);assert.match(art,/prefers-reduced-motion/);for(const pose of['entry','win']){const bytes=await readFile(new URL('../public/assets/sounds/legend-frames-v33-11-5/'+id+'-'+pose+'.wav',import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'RIFF');}}
 for(const font of['royal','geometric'])assert.ok((await readFile(new URL('../public/assets/fonts/busraj-'+font+'.woff',import.meta.url))).length>10000);
 assert.match(await readFile(new URL('../public/assets/fonts/LICENSE-LEGEND-FONTS.txt',import.meta.url),'utf8'),/Open Font License/);
});
