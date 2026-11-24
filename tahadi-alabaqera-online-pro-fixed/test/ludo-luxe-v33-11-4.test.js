import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import * as Ludo from '../public/assets/js/engines/ludo-engine.js';
import * as Six from '../public/assets/js/ludo/six-layout.js';
import{createZahraPractice}from'../public/assets/js/zahra-practice-v33-10.js';
import{Career}from'../src/career/core.js';
import{createDOM,MiniElement}from'./dom-harness.mjs';import{loadAtelier}from'./atelier-harness.mjs';
import{seatsFor,cleanLook}from'../src/games/board-tables.js';
const six=()=>Ludo.createLudoGame(['أ','ب','ج','د','هـ','و'],{layout:'classic'});
const ids=['eclipse','tide','sakura','forge','astral','arabesque'];
test('six-player Ludo preserves entry, capture, shields, exact home and extra turns',()=>{
 let s=six(),g=Ludo.ludoGeometry(s);assert.deepEqual(g.starts,[0,13,26,39,52,65]);assert.equal(g.track,78);assert.equal(g.lane,77);assert.equal(g.finish,82);
 assert.deepEqual(Ludo.getLegalLudoMoves(s,5),[]);s=Ludo.applyLudoMove(s,0,6);assert.equal(s.turn,0);
 s.players[0].tokens[0]=4;s.players[5].tokens[0]=(5-65+78)%78;s=Ludo.applyLudoMove(s,0,1);assert.equal(s.players[5].tokens[0],-1);assert.equal(s.turn,0);
 s.players[0].tokens[0]=7;s.players[5].tokens[0]=(8-65+78)%78;s=Ludo.applyLudoMove(s,0,1);assert.ok(s.players[5].tokens[0]>=0,'safe square cannot capture');
 s.turn=0;s.players[0].tokens=[81,82,82,82];assert.deepEqual(Ludo.getLegalLudoMoves(s,2),[]);s=Ludo.applyLudoMove(s,0,1);assert.equal(s.winner,0);
 assert.equal(seatsFor('zahra',5,false,null,'ludo'),6,'a room with five humans fills its sixth seat');
});
test('six-player classic matches finish, all turns and every token stay in bounds',()=>{
 for(let seed=1;seed<=3;seed++){
  let n=seed,s=six(),turns=0,visited=new Set();const roll=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return 1+n%6;};
  while(s.winner===null&&turns++<6000){visited.add(s.turn);const r=roll(),moves=Ludo.getLegalLudoMoves(s,r);s=moves.length?Ludo.applyLudoMove(s,moves[0],r):Ludo.passLudoTurn(s,r);assert.ok(s.players.flatMap(p=>p.tokens).every(t=>Number.isInteger(t)&&t>=-1&&t<=82));}
  assert.notEqual(s.winner,null);assert.equal(visited.size,6);assert.equal(s.players.flatMap(p=>p.tokens).length,24);
 }
});
test('the actual Ludo page renders all six names, dice and 24 selectable pawn objects',async()=>{
 const h=await createDOM('ludo.html',{...Ludo,...Six,createZahraPractice,ludoSound:new Proxy({},{get:()=>()=>{}})});h.doc.createTextNode=text=>{const n=new MiniElement('#text');n.textContent=text;return n;};
 await h.runFile('assets/js/ludo/board.js');await h.runFile('assets/js/ludo/main.js');
 const table=h.context.tables[0],state=six(),players=state.players.map((p,index)=>({id:'p'+index,index,name:p.name,look:{dice:'dice-eclipse',frame:'frame-eclipse'}}));
 await table.apply({code:'450001',status:'playing',variant:'ludo',state,pendingRoll:null,version:1,players,me:{id:'p0',index:0,role:'host'}});
 assert.equal(h.doc.querySelectorAll('.ludo-plate').filter(p=>!p.hidden).length,6);
 assert.equal(h.doc.getElementById('board').querySelectorAll('[data-pawns] [data-token]').length,24);assert.equal(h.doc.getElementById('board').querySelectorAll('[data-track]').length,78);assert.equal(h.doc.getElementById('board').querySelectorAll('[data-home]').length,30);
 assert.ok(h.doc.body.classList.contains('ludo-six'));assert.equal(h.doc.querySelectorAll('.lp-face.bs-frame-eclipse').length,6);
 const dice=h.doc.querySelectorAll('.ludo-plate .die');assert.equal(new Set(dice.map(d=>d.id)).size,6);assert.ok(dice.every(d=>d.dataset.diceSkin==='dice-eclipse'));
 assert.equal(table.options.seatsDefault,6);assert.ok(table.options.seats.includes(4));
});
test('every classic six progress maps to its track, five home tiles and finish for every viewer',()=>{
 const s=six();assert.equal(new Set(Six.SIX_TRACK.map(p=>p.x+':'+p.y)).size,78);
 for(let seat=0;seat<6;seat++)for(let progress=-1;progress<=82;progress++){
  const p=Six.sixSpot(s,seat,0,progress);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(progress>=0&&progress<77)assert.deepEqual({x:p.x,y:p.y},Six.SIX_TRACK[Ludo.globalLudoPosition(seat,progress,s)]);
  for(let viewer=0;viewer<6;viewer++){const q=Six.sixRotate(p,viewer);assert.ok(q.x>=-24&&q.x<=624&&q.y>=-24&&q.y<=624);}
 }
 for(let i=0;i<78;i++)for(let j=i+1;j<78;j++)assert.ok(Math.hypot(Six.SIX_TRACK[i].x-Six.SIX_TRACK[j].x,Six.SIX_TRACK[i].y-Six.SIX_TRACK[j].y)>21,'separate tiles');
});
test('all twelve signature items are purchasable, persist and cannot be equipped without ownership',()=>{
 let p=Career.normalize({coins:50000});
 for(const id of ids)for(const type of ['dice','frame']){
  const key=type+'-'+id,item=Career.CATALOG.find(i=>i.id===key);assert.ok(item);assert.ok(Career.STOREFRONT.includes(key));assert.equal(item.features.length,type==='frame'?6:3);
  assert.throws(()=>Career.equip(Career.normalize({}),key),/not_owned/);
  p=Career.purchase(p,key);p=Career.normalize(JSON.parse(JSON.stringify(p)));assert.ok(p.owned.includes(key));assert.equal(p.equipped[type],key);
 }
 for(const id of ids){assert.ok(!Career.BUNDLES.some(b=>b.id==='signature-'+id),'frames and dice are separate');assert.equal(cleanLook({dice:'dice-'+id,frame:'frame-'+id}).frame,'frame-'+id);}
 assert.equal(cleanLook({frame:'frame-fake'}).frame,undefined);
});
test('dice preview plays its own sound without coupling a frame',async()=>{
 const played=[],h=await createDOM('shop.html');h.context.BS_CAREER={get:()=>Career.normalize({coins:20000}),now:()=>Date.now()};
 await loadAtelier(h);h.context.BS_AUDIO={play:(name)=>played.push(name),getSettings:()=>({muted:false,effects:true,volume:.5})};
 h.doc.querySelector('[data-item="dice-eclipse"] [data-control="inspect"]').click();assert.ok(h.doc.querySelector('.signature-panel'));assert.equal(h.doc.querySelectorAll('.signature-features li').length,3);
 h.doc.querySelector('.signature-panel .sx-try-button').click();assert.deepEqual(played,['luxe-eclipse']);
 assert.equal(h.doc.querySelector('.signature-pair'),null,'dice previews do not link to frame purchases');
 h.context.BS_AUDIO.getSettings=()=>({muted:true});h.doc.querySelector('.signature-panel .sx-try-button').click();assert.equal(played.length,1,'preview never bypasses mute');
});
test('signature audio and frame assets exist, are distinct and keep cosmetic code outside the rule engine',async()=>{
 const hashes=new Set();for(const id of ids){const svg=await readFile(new URL('../public/assets/collectibles-v33-11-4/frame-'+id+'.svg',import.meta.url),'utf8');assert.match(svg,/viewBox="0 0 160 160"/);hashes.add(svg);for(const kind of ['roll','land','reveal']){const wav=await readFile(new URL('../public/assets/sounds/luxe-v33-11-4/'+id+'-'+kind+'.wav',import.meta.url));assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.ok(wav.length>10000);}}
 assert.equal(hashes.size,6);const engine=await readFile(new URL('../public/assets/js/engines/ludo-engine.js',import.meta.url),'utf8');assert.doesNotMatch(engine,/signature|eclipse|frame|skin/);
});
test('each equipped die selects its own roll and impact recordings and global mute stops them',async()=>{
 const sounds=[],h=await createDOM('dice.html',{Audio:class{constructor(src){this.src=src;this.paused=true;this.ended=false;sounds.push(this);}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}}});
 await h.runFile('assets/js/audio-manager.js');
 for(const id of ids){h.context.BS_AUDIO.play('dice',{skin:'dice-'+id});h.context.BS_AUDIO.play('diceImpact',{skin:'dice-'+id});}
 const paths=sounds.map(s=>s.src);for(const id of ids){assert.ok(paths.includes('assets/sounds/luxe-v33-11-4/'+id+'-roll.wav'));assert.ok(paths.includes('assets/sounds/luxe-v33-11-4/'+id+'-land.wav'));}
 h.context.BS_AUDIO.setMuted(true);assert.ok(sounds.every(s=>s.paused));const n=sounds.length;h.context.BS_AUDIO.play('dice',{skin:'dice-eclipse'});assert.equal(sounds.length,n);
});
