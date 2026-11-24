import test from 'node:test';import assert from 'node:assert/strict';
import {createDOM,MiniElement} from './dom-harness.mjs';
import * as Colors from '../public/assets/js/engines/color-tables-v33-14.js';
async function page(saved){
 const h=await createDOM('colorbluff.html',Colors),store=new Map();let clock=Date.now();
 if(saved)store.set('bs-color-practice-v33-14',JSON.stringify(saved));
 h.context.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 h.context.Date=class extends Date{static now(){return clock;}};
 h.context.setInterval=fn=>{h.tick=fn;return 1;};h.advance=ms=>{clock+=ms;};h.doc.hidden=false;
 h.doc.createTextNode=t=>{const n=new MiniElement('#text');n.textContent=t;return n;};
 h.context.createTable=options=>(h.table={options,leaves:0,menu:{setMode(){}},leave(){this.leaves++;options.onMenu?.();},send(){return true;},again(){}});
 await h.runFile('assets/js/color-table-page-v33-14.js');return h;
}
test('resume reads the newest training save and closes the online lobby first',async()=>{
 const old=Colors.createColorTable(['قديم','ثان']);const h=await page({state:old,kind:'ai',level:'easy',savedAt:Date.now()});
 h.doc.querySelector('[data-color-mode="vault"]').click();h.doc.getElementById('ctLocal').value='pass';h.doc.getElementById('ctStart').click();h.doc.getElementById('ctExit').click();
 h.table.options.onLobby({code:'051234',variant:'bluff',status:'lobby'});const before=h.table.leaves;h.doc.getElementById('ctResume').click();
 assert.equal(h.context.BS_COLOR_TABLE.state.mode,'vault');assert.equal(h.table.leaves,before+1);assert.equal(h.context.BS_COLOR_TABLE.mode,'pass');
});
test('training keeps its remaining turn time while the application is hidden',async()=>{
 const h=await page();h.doc.getElementById('ctStart').click();h.advance(4000);h.tick();
 h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});h.advance(60000);h.doc.hidden=false;h.doc.dispatchEvent({type:'visibilitychange'});h.tick();
 assert.equal(h.context.BS_COLOR_TABLE.state.phase,'claim');h.advance(6100);h.tick();assert.equal(h.context.BS_COLOR_TABLE.state.phase,'answer');
});
test('the lobby keeps its real room mode instead of changing the title to another game',async()=>{
 const h=await page();h.table.options.onLobby({code:'051234',variant:'bluff',status:'lobby'});
 const vault=h.doc.querySelector('[data-color-mode="vault"]');assert.equal(vault.disabled,true);vault.click();assert.equal(h.doc.getElementById('ctTitle').textContent,'خدعة الألوان');
 h.table.leave();assert.equal(vault.disabled,false);vault.click();assert.equal(h.doc.getElementById('ctTitle').textContent,'خزنة الألوان');
});
test('the previous revealed color is separated from the next mystery capsule',async()=>{
 const h=await page();h.doc.getElementById('ctLocal').value='pass';h.doc.getElementById('ctStart').click();h.doc.getElementById('ctReveal').click();
 const c=h.context.BS_COLOR_TABLE.state.secretColor;h.context.BS_COLOR_TABLE.action('color_claim',{color:c});h.doc.getElementById('ctReveal').click();h.context.BS_COLOR_TABLE.action('color_answer',{answer:'trust'});
 assert.equal(h.context.BS_COLOR_TABLE.state.phase,'claim');assert.equal(h.doc.getElementById('ctCapsuleSymbol').textContent,'?');assert.equal(h.doc.getElementById('ctResolution').hidden,false);
});
test('a classic memory invitation opens its actual lobby and retains the party handoff parameters',async()=>{
 const h=await page();let target='';h.context.location.href='https://game.test/colorbluff?room=051234&party=151234&round=r';h.context.location.replace=url=>{target=url;};
 h.table.options.onLobby({code:'051234',variant:'classic',status:'lobby'});assert.equal(target,'/pegs?room=051234&party=151234&round=r');
});
test('hard bluff opponents react to public behavior and never to the current hidden color',()=>{
 let s=Colors.createColorTable(['أ','ب']);s=Colors.playColorTable(s,0,{type:'color_claim',color:0,seq:0});
 s.players[0].bluffStats={claims:12,lies:12};assert.equal(Colors.chooseColorMove(s,'hard',()=>.4).answer,'challenge');
 s.players[0].bluffStats={claims:12,lies:0};assert.equal(Colors.chooseColorMove(s,'hard',()=>.4).answer,'trust');
 for(let color=0;color<6;color++)assert.equal(Colors.chooseColorMove({...s,secretColor:color},'hard',()=>.4).answer,'trust');
 let turn=Colors.createColorTable(['أ','ب']);turn.players[1].bluffStats={answers:12,challenges:12};assert.equal(Colors.chooseColorMove(turn,'hard',()=>.6).color,turn.secretColor);
 turn.players[1].bluffStats={answers:12,challenges:0};assert.notEqual(Colors.chooseColorMove(turn,'hard',()=>.6).color,turn.secretColor);
});
test('random full games finish with finite scores and valid actors for every supported player count',()=>{
 for(const mode of ['bluff','vault'])for(const count of [2,3,4,5,6])for(let seed=1;seed<=10;seed++){
  let n=seed;const rng=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};let s=Colors.createColorTable(Array.from({length:count},(_,i)=>String(i)),{mode,rng,now:0}),steps=0;
  while(s.winner===null&&steps++<300){assert.ok(s.turn>=0&&s.turn<count);const move=Colors.chooseColorMove(s,['easy','medium','hard'][steps%3],rng);s=Colors.playColorTable(s,s.turn,move,{rng,now:6000});for(const p of s.players)assert.ok(Number.isSafeInteger(p.score)&&p.score>=0);}
  assert.ok(s.winner!==null&&steps<300);assert.equal(s.phase,'over');assert.ok(s.ties.includes(s.winner));
 }
});
