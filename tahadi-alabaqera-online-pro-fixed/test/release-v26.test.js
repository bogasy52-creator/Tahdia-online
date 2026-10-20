import test from 'node:test';
import assert from 'node:assert/strict';
import {Career} from '../src/career/core.js';
import {accountCareer} from '../src/social/account-policy.js';
import {normalizeRoomCode,normalizeGame} from '../src/social/social-core.js';
import {BoardOnlineClient} from '../public/assets/js/board-online.js';

test('Arabic and Persian codes identify exactly one six-digit room; overflow is rejected',()=>{
 assert.equal(normalizeRoomCode('١۲٣-۴٥۶'),'123456');
 assert.equal(normalizeRoomCode('1234567'),'');
 assert.equal(normalizeRoomCode('12345'),'');
 assert.equal(normalizeGame('accuracy'),'');
});

test('sovereign serpent is granted by the authenticated manager policy, never ordinary ownership',()=>{
 const item=Career.CATALOG.find(i=>i.id==='snake-sovereign');
 assert.equal(item?.source,'owner');
 const owner=accountCareer({}, {username:'BoSraG'});
 assert.ok(owner.owned.includes(item.id));
 assert.equal(owner.equipped.snake,item.id);
 const forged=accountCareer({owned:[item.id],equipped:{snake:item.id}}, {username:'ordinary'});
 assert.ok(!forged.owned.includes(item.id));
 assert.equal(forged.equipped.snake,'snake-wild');
 assert.throws(()=>Career.purchase({},item.id),/locked/);
});

test('retired color variants remain usable by owners but cannot be sold or offered again',()=>{
 const item=Career.CATALOG.find(i=>i.retired&&i.price>0);
 assert.ok(item,'curated retirement metadata exists');
 assert.throws(()=>Career.purchase({coins:5000},item.id),/retired/);
 assert.throws(()=>Career.cartQuote({coins:5000},[item.id]),/retired/);
 const legacy=Career.equip({owned:[item.id]},item.id);
 assert.equal(legacy.equipped[item.type],item.id);
 for(let n=0;n<180;n++)assert.ok(!Career.CATALOG.find(i=>i.id===Career.dailyOffer(Date.UTC(2026,0,1)+n*86400000).id).retired);
});

test('new dice have distinct material geometry and remain in the deterministic economy',()=>{
 const ids=['dice-porcelain','dice-crystal','dice-obsidian'];
 assert.equal(new Set(ids.map(id=>Career.CATALOG.find(i=>i.id===id)?.design)).size,3);
 for(const id of ids){const p=Career.purchase({coins:5000},id);assert.equal(p.equipped.dice,id);assert.ok(p.coins<5000);assert.ok(Career.COSMETIC_STYLES[id]);}
});

function boardHarness(t){
 const originals=new Map(['location','localStorage','WebSocket'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const sockets=[],statuses=[];
 globalThis.location={protocol:'https:',host:'game.test'};
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 globalThis.WebSocket=class{static OPEN=1;constructor(){this.readyState=0;this.sent=[];sockets.push(this);}close(code=1000){this.readyState=3;this.code=code;}send(raw){this.sent.push(JSON.parse(raw));}};
 const client=new BoardOnlineClient('snakes',{onStatus:s=>statuses.push(s)});client.code='123456';
 t.after(()=>{client.close();for(const[k,d]of originals)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];});
 return {client,sockets,statuses};
}

test('board connection becomes online only after the room welcome and disposes old sockets',async t=>{
 const {client,sockets,statuses}=boardHarness(t);
 const first=client.openSocket(),a=sockets[0];a.readyState=1;a.onopen();
 assert.ok(!statuses.some(s=>s.online),'TCP open alone is not a joined room');
 a.onmessage({data:JSON.stringify({type:'welcome',token:'saved',state:{version:1}})});await first;
 assert.equal(statuses.at(-1).online,true);
 const second=client.openSocket(),b=sockets[1];
 assert.equal(a.readyState,3);
 b.onmessage({data:JSON.stringify({type:'welcome',state:{version:1}})});await second;
});

test('board fatal handshake error is surfaced immediately and does not schedule reconnect',async t=>{
 const {client,sockets}=boardHarness(t);const opening=client.openSocket(),a=sockets[0];
 const outcome=assert.rejects(opening,/الغرفة ممتلئة/);
 a.onmessage({data:JSON.stringify({type:'error',message:'الغرفة ممتلئة'})});
 await outcome;
 assert.equal(client.reconnectTimer,null);
 assert.equal(a.readyState,3);
});

test('returning to a displaced board tab never steals the active seat back',async t=>{
 const {client,sockets}=boardHarness(t),opening=client.openSocket(),a=sockets[0];
 a.onmessage({data:JSON.stringify({type:'welcome',token:'seat',state:{version:1}})});await opening;
 a.onclose({code:4001,reason:'replaced'});
 client.resume();
 assert.equal(sockets.length,1,'terminal displacement requires an explicit join');
 assert.equal(client.reconnectTimer,null);
});

test('a silent board socket recovers even when closing never delivers a close event',async t=>{
 let heartbeat,clock=1000;
 t.mock.method(Date,'now',()=>clock);
 t.mock.method(globalThis,'setInterval',fn=>{heartbeat=fn;return{unref(){}};});
 t.mock.method(globalThis,'clearInterval',()=>{});
 const {client,sockets}=boardHarness(t),opening=client.openSocket(),a=sockets[0];a.readyState=1;
 a.onmessage({data:JSON.stringify({type:'welcome',token:'seat',state:{version:1}})});await opening;
 clock+=56000;heartbeat();
 assert.equal(client.ws,null,'a half-open socket is abandoned without awaiting onclose');
 assert.notEqual(client.reconnectTimer,null);
});

for(const operation of ['create','join'])test('closing a pending board '+operation+' never opens an orphan socket',async t=>{
 const {client,sockets}=boardHarness(t);let respond;
 t.mock.method(globalThis,'fetch',()=>new Promise(resolve=>respond=resolve));
 const pending=operation==='create'?client.create('Alice',2):client.join('123456','Alice');
 const cancelled=assert.rejects(pending,/إلغاء/);
 client.close();
 respond({ok:true,json:async()=>({ok:true,game:'snakes',code:'123456',hostKey:'host'})});
 await cancelled;
 assert.equal(sockets.length,0,'an abandoned HTTP response must not join a room');
 assert.equal(client.reconnectTimer,null);
});
