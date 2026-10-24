import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';
import {createDOM} from './dom-harness.mjs';

async function boardRoom(){
 const env=environment(),created=await api(env,'/api/board/rooms',{game:'zahra',name:'A',playerLimit:2});
 assert.equal(created.response.status,200,JSON.stringify(created.data));
 const {instance,ctx}=env.BOARD_ROOMS.peek(created.data.code);await ctx.ready;
 const host=instance.addPlayer('مضيف','host'),guest=instance.addPlayer('ضيف','guest'),inbox={[host.id]:[],[guest.id]:[]};
 for(const p of [host,guest])ctx.sockets.push({deserializeAttachment:()=>({playerId:p.id}),send:raw=>inbox[p.id].push(JSON.parse(raw))});
 const socketOf=p=>ctx.sockets.find(s=>s.deserializeAttachment().playerId===p.id);
 return {instance,ctx,host,guest,inbox,send:(p,msg)=>instance.webSocketMessage(socketOf(p),JSON.stringify(msg))};
}

test('a reaction reaches everyone in the room without touching the game state or storage',async t=>{
 const r=await boardRoom(),version=r.instance.room.version;let writes=0;const put=r.ctx.storage.put.bind(r.ctx.storage);r.ctx.storage.put=async(...a)=>{writes++;return put(...a)};
 let now=1_000_000;t.mock.method(Date,'now',()=>now);
 await r.send(r.guest,{type:'emote',emote:'fire'});
 for(const id of [r.host.id,r.guest.id]){assert.equal(r.inbox[id].length,1);assert.deepEqual({...r.inbox[id][0],at:0},{type:'emote',from:r.guest.id,name:'ضيف',emote:'fire',at:0});}
 assert.equal(r.instance.room.version,version);assert.equal(writes,0);
});

test('reactions are a fixed vocabulary and are rate limited per player',async t=>{
 const r=await boardRoom();let now=2_000_000;t.mock.method(Date,'now',()=>now);
 for(const emote of ['<b>hi</b>','free text',42,null])await r.send(r.host,{type:'emote',emote});
 assert.equal(r.inbox[r.guest.id].length,0,'unknown reactions are dropped');
 await r.send(r.host,{type:'emote',emote:'clap'});now+=200;await r.send(r.host,{type:'emote',emote:'clap'});
 assert.equal(r.inbox[r.guest.id].length,1,'a second reaction within 1.5 s is dropped');
 for(let i=0;i<20;i++){now+=1600;await r.send(r.host,{type:'emote',emote:'gg'});}
 assert.equal(r.inbox[r.guest.id].length,12,'at most twelve reactions a minute');
 await r.send(r.guest,{type:'emote',emote:'wow'});assert.equal(r.inbox[r.host.id].filter(m=>m.from===r.guest.id).length,1,'limits are per player');
});

async function page(){
 const h=await createDOM('zahra.html');const sent=[];
 const client={react:id=>{sent.push(id);return true}};
 await h.runFile('assets/js/board-reactions-v30-1.js');
 return {h,sent,client,$:id=>h.doc.getElementById(id)};
}
const roomEvent=(h,detail)=>h.context.dispatchEvent({type:'bs-board-room',detail});

test('the reaction button appears in the online bar only for a joined room and sends one choice',async()=>{
 const {h,sent,client,$}=await page();
 assert.equal(h.doc.querySelector('.bs-react-trigger'),null,'nothing is shown before a room exists');
 roomEvent(h,{client,state:{me:{id:'p1'}}});
 const trigger=h.doc.querySelector('.bs-react-trigger');assert.ok(trigger);assert.equal(trigger.parentElement,$('livebar'));
 trigger.click();assert.equal($('bsReactPanel').hidden,false);assert.equal(trigger.getAttribute('aria-expanded'),'true');
 const options=h.doc.querySelectorAll('.bs-react-option');assert.equal(options.length,8);
 options[1].click();assert.deepEqual(sent,['fire']);assert.equal($('bsReactPanel').hidden,true);
 options[2].click();assert.deepEqual(sent,['fire'],'cool-down blocks rapid repeats');
 roomEvent(h,null);assert.equal($('bsReactPanel').hidden,true);
});

test('incoming reactions show the sender name, mark your own, and never stack more than three',async()=>{
 const {h,client}=await page();roomEvent(h,{client,state:{me:{id:'p1'}}});
 const emote=detail=>h.context.dispatchEvent({type:'bs-board-emote',detail});
 emote({from:'p2',name:'فهد',emote:'laugh'});const feed=h.doc.querySelector('.bs-react-feed');
 assert.match(feed.textContent,/فهد/);assert.match(feed.textContent,/😂/);
 emote({from:'p1',name:'أنا',emote:'gg'});assert.ok(feed.children.at(-1).classList.contains('is-mine'));assert.match(feed.children.at(-1).textContent,/أنت/);
 emote({from:'p2',name:'فهد',emote:'bogus'});assert.equal(feed.children.length,2,'unknown reactions are ignored');
 for(const e of ['wow','fire','clap'])emote({from:'p2',name:'فهد',emote:e});
 assert.equal(feed.children.length,3);
});

test('the board client sends reactions quietly and clears the shared room when it closes',async()=>{
 const events=[];globalThis.WebSocket??=class{static OPEN=1};
 const original={dispatchEvent:globalThis.dispatchEvent,CustomEvent:globalThis.CustomEvent};
 globalThis.dispatchEvent=e=>{events.push(e.type);return true};
 try{
  const {BoardOnlineClient}=await import('../public/assets/js/board-online.js');
  const errors=[],client=new BoardOnlineClient('zahra',{onError:m=>errors.push(m)}),sent=[];
  assert.equal(client.react('fire'),false,'no socket, no send, no error toast');assert.deepEqual(errors,[]);
  client.ws={readyState:WebSocket.OPEN,bufferedAmount:0,send:v=>sent.push(JSON.parse(v)),close(){}};
  assert.equal(client.react('fire'),true);assert.deepEqual(sent,[{type:'emote',emote:'fire'}]);
  globalThis.BS_BOARD_ROOM={client,state:{}};client.close();
  assert.equal(globalThis.BS_BOARD_ROOM,null);assert.ok(events.includes('bs-board-room'));
 }finally{globalThis.dispatchEvent=original.dispatchEvent;delete globalThis.BS_BOARD_ROOM;}
});
