import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {environment,api} from './worker-harness.mjs';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';

async function boardRoom(game='zahra'){
 const env=environment(),created=await api(env,'/api/board/rooms',{game,name:'A',playerLimit:2});
 assert.equal(created.response.status,200,JSON.stringify(created.data));
 const {instance,ctx}=env.BOARD_ROOMS.peek(created.data.code);await ctx.ready;
 const host=instance.addPlayer('مضيف','host'),guest=instance.addPlayer('ضيف','guest'),inbox={[host.id]:[],[guest.id]:[]};
 const sockets=new Map();for(const p of [host,guest]){const socket={deserializeAttachment:()=>({playerId:p.id}),send:raw=>inbox[p.id].push(JSON.parse(raw))};sockets.set(p.id,socket);ctx.sockets.push(socket);}
 return {instance,ctx,host,guest,inbox,send:(p,msg)=>instance.webSocketMessage(sockets.get(p.id),JSON.stringify(msg))};
}

test('emoji, phrases and moves are owned with coins but never take an equipment slot',()=>{
 assert.deepEqual([...new Set(Career.REACTIONS.map(i=>i.type))].sort(),['emote','move','phrase']);
 for(const item of Career.REACTIONS){assert.ok(Career.CATALOG.includes(item));assert.ok(item.glyph,item.id);if(item.type==='phrase')assert.ok(item.text,item.id);assert.ok(Career.STOREFRONT.includes(item.id));}
 assert.equal(new Set(Career.CATALOG.map(i=>i.id)).size,Career.CATALOG.length);
 let p=Career.normalize({coins:5000});
 for(const item of Career.REACTIONS.filter(i=>i.price===0&&!i.source))assert.ok(p.owned.includes(item.id),item.id);
 assert.ok(!p.owned.includes('move-sovereign'));
 p=Career.purchase(p,'emote-crown');assert.ok(p.owned.includes('emote-crown'));assert.deepEqual(Object.keys(p.equipped).sort(),[...Career.SLOTS].sort());
 p=Career.equip(p,'emote-crown');assert.equal(p.equipped.emote,undefined);
 const quote=Career.bundleQuote(p,'react-show');p=Career.purchaseBundle(p,'react-show',{expectedPrice:quote.price});
 assert.ok(['move-fireworks','move-lightning','move-goldrain'].every(id=>p.owned.includes(id)));assert.equal(p.equipped.move,undefined);
 const cart=Career.cartQuote(p,['phrase-genius','pawn-orb']);p=Career.purchaseCart(p,['phrase-genius','pawn-orb'],{expectedPrice:cart.price,requestId:'reactions-cart-0001'});
 assert.equal(p.equipped.pawn,'pawn-orb');assert.equal(p.equipped.phrase,undefined);
 assert.deepEqual(Object.keys(Career.normalize({equipped:{emote:'emote-clap',pawn:'pawn-classic'}}).equipped).sort(),[...Career.SLOTS].sort());
 assert.throws(()=>Career.purchase(Career.normalize({coins:9999}),'move-sovereign'),/item_locked/);
 for(let day=0;day<120;day++)assert.ok(Career.STOREFRONT.includes(Career.dailyOffer(Date.UTC(2026,9,1)+day*864e5).id));
 assert.equal(Career.reactionOf('clap').id,'emote-clap');assert.equal(Career.reactionOf('gg').id,'phrase-gg');assert.equal(Career.reactionOf('<b>hi</b>'),null);
});

test('a room relays a bought reaction only for the account that owns it, and keeps short ids for older pages',async t=>{
 const r=await boardRoom();let now=5_000_000;t.mock.method(Date,'now',()=>now);
 await r.send(r.guest,{type:'emote',emote:'emote-crown'});
 assert.equal(r.inbox[r.host.id].length,0,'a locked reaction is not relayed');assert.deepEqual(r.inbox[r.guest.id],[{type:'emote-locked',emote:'emote-crown'}]);
 r.guest.reactions=['emote-crown'];now+=2000;await r.send(r.guest,{type:'emote',emote:'emote-crown'});
 assert.deepEqual({...r.inbox[r.host.id][0],at:0},{type:'emote',from:r.guest.id,name:'ضيف',emote:'emote-crown',at:0});
 now+=2000;await r.send(r.guest,{type:'emote',emote:'emote-clap'});assert.equal(r.inbox[r.host.id].at(-1).emote,'clap');
 now+=2000;await r.send(r.guest,{type:'emote',emote:'phrase-hello'});assert.equal(r.inbox[r.host.id].at(-1).emote,'phrase-hello');
});

test('board-wide moves have their own slower limit and never pass for free when bought ones are missing',async t=>{
 const r=await boardRoom('jackaroo');let now=7_000_000;t.mock.method(Date,'now',()=>now);r.host.reactions=['move-fireworks'];
 await r.send(r.host,{type:'emote',emote:'move-confetti'});now+=2000;await r.send(r.host,{type:'emote',emote:'move-fireworks'});
 assert.equal(r.inbox[r.guest.id].length,1,'a second move within six seconds is dropped');
 now+=2000;await r.send(r.host,{type:'emote',emote:'emote-wow'});assert.equal(r.inbox[r.guest.id].length,2,'emoji are not slowed by moves');
 for(let i=0;i<10;i++){now+=6500;await r.send(r.host,{type:'emote',emote:'move-confetti'});}
 const recent=r.inbox[r.guest.id].filter(m=>m.emote==='move-confetti'&&m.at>now-60000).length;assert.ok(recent<=4,'at most four moves a minute');
 now+=10000;await r.send(r.guest,{type:'emote',emote:'move-goldrain'});assert.equal(r.inbox[r.host.id].filter(m=>m.emote==='move-goldrain').length,0);
});

test('the reactions an account bought arrive with the room connection, never from the page',async t=>{
 const originalPair=globalThis.WebSocketPair,OriginalResponse=globalThis.Response;
 globalThis.WebSocketPair=class{constructor(){for(let i=0;i<2;i++)this[i]={send(){},serializeAttachment(v){this.attachment=v},deserializeAttachment(){return this.attachment},close(){}};}};
 globalThis.Response=class extends OriginalResponse{constructor(body,init){if(init?.status===101){super(null,{status:200,headers:init.headers});Object.defineProperty(this,'status',{value:101});this.webSocket=init.webSocket;}else super(body,init);}};
 t.after(()=>{globalThis.WebSocketPair=originalPair;globalThis.Response=OriginalResponse;});
 const env=environment(),created=await api(env,'/api/board/rooms',{game:'jackaroo',name:'A',playerLimit:4}),{instance,ctx}=env.BOARD_ROOMS.peek(created.data.code);await ctx.ready;
 const host=instance.addPlayer('A','host');
 const first=await instance.fetch(new Request('https://board.internal/ws?name=A',{headers:{upgrade:'websocket','sec-websocket-protocol':'busraj-v1, rt.'+host.token,'x-bs-reactions':'["emote-crown","pawn-orb","<x>","emote-crown","emote-clap"]'}}));
 assert.equal(first.status,101);assert.deepEqual(instance.room.players[host.id].reactions,['emote-crown'],'only paid reactions are kept, once');
 await instance.fetch(new Request('https://board.internal/ws?name=A',{headers:{upgrade:'websocket','sec-websocket-protocol':'busraj-v1, rt.'+host.token}}));
 assert.deepEqual(instance.room.players[host.id].reactions,[],'a connection without an account keeps only the free reactions');
 const edge=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(edge,/headers\.delete\('x-bs-reactions'\)/,'the Worker drops a page-supplied list before it adds the verified one');
});

async function page({owned=[],signed=false}={}){
 const h=await createDOM('zahra.html');await h.runFile('assets/js/profile-core.js');
 const p=h.context.BS_CAREER_CORE.normalize({coins:500,owned});h.context.BS_CAREER={get:()=>p,account:()=>signed?'reem22':null,refresh:async()=>p};
 await h.runFile('assets/js/reactions-v31.js');
 return {h,$:id=>h.doc.getElementById(id),q:s=>h.doc.querySelector(s),all:s=>h.doc.querySelectorAll(s)};
}
const local=h=>{h.context.BS_TABLE={active:true,mode:'local',bots:[1],players:[{index:0,name:'أنت'},{index:1,name:'سالم'}]};h.doc.body.classList.add('game-running');};

test('a local table shows the reaction button on the board, free reactions first and locked ones with a shop link',async()=>{
 const {h,q,all}=await page();
 assert.equal(q('.rx-fab').hidden,true,'nothing shows before a game starts');
 local(h);h.context.BS_REACTIONS.open();
 assert.equal(q('.rx-fab').hidden,false);assert.equal(q('.rx-fab').parentElement,h.doc.getElementById('board').parentElement);
 assert.equal(q('#rxSheet').hidden,false);assert.equal(all('.rx-tab').length,3);
 assert.ok(!q('[data-reaction="emote-clap"]').classList.contains('is-locked'));assert.ok(q('[data-reaction="emote-crown"]').classList.contains('is-locked'));
 assert.ok(!q('[data-reaction="move-sovereign"]'),'the manager move is not offered to players');
 q('[data-reaction="emote-crown"]').click();const note=q('.rx-lock-note');assert.ok(note);assert.match(note.textContent,/480/);const link=note.querySelector('a');assert.match(String(link.getAttribute('href')||link.href),/\/shop\?filter=emote/);
 q('.rx-tab[data-tab="phrase"]').click();assert.ok(q('[data-reaction="phrase-hello"]'));assert.ok(q('[data-reaction="phrase-genius"].is-locked'));
});

test('sending on a local table shows it at once, starts the cool-down and a bot may answer',async t=>{
 const {h,q,all}=await page();local(h);t.mock.method(Math,'random',()=>.1);
 h.context.BS_REACTIONS.open();q('[data-reaction="emote-laugh"]').click();
 assert.equal(q('#rxSheet').hidden,true);assert.ok(q('.rx-fab').classList.contains('is-cooling'));
 assert.equal(all('.rx-emote').length,1);assert.match(q('.rx-emote').textContent,/😂/);assert.match(q('.rx-emote').textContent,/أنت/);
 assert.equal(h.context.BS_REACTIONS.send('emote-fire'),false,'a second reaction inside the cool-down is ignored');
 for(const timer of [...h.timers.values()].filter(t=>t.ms>=1100&&t.ms<=2400))timer.fn();
 assert.ok([...all('.rx-emote'),...all('.rx-phrase')].some(e=>/سالم/.test(e.textContent)),'the bot answered with its name');
});

test('online rooms send the short id for old reactions, ask paid ones to sign in, and show incoming moves',async()=>{
 const {h,q,all}=await page({owned:['emote-crown']}),sent=[];
 h.context.dispatchEvent({type:'bs-board-room',detail:{client:{react:id=>{sent.push(id);return true}},state:{me:{id:'p1'}}}});
 h.context.BS_REACTIONS.open();q('[data-reaction="emote-clap"]').click();assert.deepEqual(sent,['clap']);
 h.context.BS_REACTIONS.open();q('[data-reaction="emote-crown"]').click();assert.deepEqual(sent,['clap'],'a guest cannot use a bought reaction online');assert.match(q('.rx-lock-note').textContent,/سجّل الدخول/);
 h.context.dispatchEvent({type:'bs-board-emote',detail:{from:'p2',name:'فهد',emote:'move-fireworks'}});
 assert.match(q('.rx-banner').textContent,/فهد/);assert.match(q('.rx-banner').textContent,/ألعاب نارية/);
 h.context.dispatchEvent({type:'bs-board-emote',detail:{from:'p2',name:'فهد',emote:'bogus'}});assert.equal(all('.rx-banner').length,1);
 h.context.dispatchEvent({type:'bs-board-emote',detail:{from:'p1',name:'أنا',emote:'gg'}});assert.match(q('.rx-phrase').textContent,/أنت/);
});

test('a signed-in owner of a paid reaction can send it online',async()=>{
 const {h,q}=await page({owned:['emote-crown'],signed:true}),sent=[];
 h.context.dispatchEvent({type:'bs-board-room',detail:{client:{react:id=>{sent.push(id);return true}},state:{me:{id:'p1'}}}});
 h.context.BS_REACTIONS.open();q('[data-reaction="emote-crown"]').click();assert.deepEqual(sent,['emote-crown']);
});
