import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
import {createSerpentGame,serpentSnapshot} from '../public/assets/js/engines/serpent-engine.js';
async function ui(){
 const peers=[],h=await createDOM('serpent.html');h.context.requestAnimationFrame=()=>0;
 h.context.AbortSignal=AbortSignal;
 h.context.SerpentRenderer=class{constructor(){this.cameras=new Map()}resize(){}setGame(){}draw(){}};
 h.context.WebSocket=class{static OPEN=1;constructor(){this.readyState=0;peers.push(this)}close(){}send(){}};
 h.context.fetch=async()=>Response.json({ok:true,status:'playing'});h.context.BS_CAREER={get:()=>({name:'A'}),account:()=>null};
 const source=(await readFile(new URL('../public/assets/js/serpent-ui.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');
 vm.runInContext(source+'\nglobalThis.hooks={acceptRoom,connectRoom,network:()=>networkActive,init:()=>{online=true;selfId="a";mode="online";networkActive=true;}};',vm.createContext(h.context));
 return {...h,peers};
}
test('resuming a finished online room reveals results and the host rematch control',async()=>{
 const h=await ui();h.context.hooks.init();const g=createSerpentGame([{id:'a',name:'A'},{id:'b',name:'B'}]);g.status='finished';g.winners=['a'];
 h.context.hooks.acceptRoom({code:'123456',round:1,status:'finished',rewardsComplete:true,players:[{id:'a',role:'host'},{id:'b',role:'guest'}],game:serpentSnapshot(g)});
 assert.equal(h.doc.getElementById('arenaPlay').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('arenaResults').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('arenaAgain').disabled,false);
});
test('a failed reconnect preserves intent for the remaining bounded retries',async()=>{
 const h=await ui();h.context.hooks.init();const attempt=h.context.hooks.connectRoom('123456',{token:'valid-reconnect-token'});const rejection=assert.rejects(attempt,/تعذر/);
 for(let i=0;i<5&&!h.peers.length;i++)await new Promise(r=>setImmediate(r));assert.equal(h.peers.length,1);h.peers[0].onerror();await rejection;assert.equal(h.context.hooks.network(),true);
});
