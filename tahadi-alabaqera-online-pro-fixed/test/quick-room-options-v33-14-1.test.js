import test from 'node:test';import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';import * as Catalog from '../public/assets/js/engines/party-catalog-v29.js';import * as Modes from '../public/assets/js/engines/party-modes.js';
import {quickRoomSeats,normalizeQuickRoomChoice} from '../public/assets/js/engines/quick-room-options-v33-14-1.js';
import {createLinkedRoom} from '../src/party/party-link.js';
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
async function page(){
 const requests=[],h=await createDOM('party.html',{...Catalog,...Modes,history:{replaceState(){}},sessionStorage:{getItem(){return null;},setItem(){}},SerpentRenderer:class{},requestAnimationFrame:()=>1,cancelAnimationFrame(){},BS_AUDIO:{play(){},getSettings:()=>({volume:.72}),registerContent:()=>()=>{}},fetch:async(url,options)=>{if(String(url).includes('/api/party/rooms'))requests.push(JSON.parse(options.body));return{ok:!String(url).includes('/api/party/rooms'),json:async()=>String(url).includes('/api/party/rooms')?{ok:false,error:'captured request'}:[]};}});
 await h.runFile('assets/js/party-v29.js');await settle();
 h.pick=id=>h.doc.getElementById('entry').dispatchEvent({type:'click',target:h.doc.querySelector('[data-quick="'+id+'"]')});
 h.change=(id,value)=>{const el=h.doc.getElementById(id);el.value=value;h.doc.getElementById('entry').dispatchEvent({type:'change',target:el});};
 h.create=()=>{const button=h.doc.querySelector('[data-quick-create]');h.doc.getElementById('entry').dispatchEvent({type:'click',target:button});return button;};return{...h,requests};
}
test('selecting a game makes no request; the confirmed room carries the chosen mode and six seats once',async()=>{
 const h=await page();h.pick('ludo');assert.equal(h.requests.length,0);h.change('quickMode','ludo-quick');h.change('quickCount','6');
 const button=h.create();h.doc.getElementById('entry').dispatchEvent({type:'click',target:button});await settle();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].capacity,6);assert.equal(h.requests[0].playlist[0].mode,'ludo-quick');assert.equal(h.requests[0].playlist[0].seats,6);
 h.pick('pegs');h.pick('ludo');assert.equal(h.doc.getElementById('quickMode').value,'ludo-quick');assert.equal(h.doc.getElementById('quickCount').value,'6');
});
test('team modes offer valid even counts and fixed two-player games explain their fixed count',async()=>{
 const h=await page();h.pick('pegs');h.change('quickCount','3');h.change('quickMode','teams');
 assert.deepEqual(h.doc.getElementById('quickCount').children.map(o=>o.value),['4','6']);assert.equal(h.doc.getElementById('quickCount').value,'4');
 h.pick('billiards');assert.notEqual(h.doc.getElementById('quickCount').getAttribute('disabled'),null);assert.equal(h.doc.getElementById('quickCount').value,'2');
 assert.equal(normalizeQuickRoomChoice('pegs',null).seats,2);assert.deepEqual(quickRoomSeats('jackaroo','quick'),[4,6]);
});
test('Baloot retains the selected strict rules when opening its own room page',async()=>{
 const h=await page();h.pick('baloot');h.change('quickMode','strict');h.create();assert.equal(h.context.location.href,'/baloot?play=room&rule=strict');
});
test('the Baloot entry applies its requested rules before pressing create',async()=>{
 const h=await createDOM('baloot.html');h.context.location.search='?play=room&rule=strict';h.doc.readyState='complete';let chosen='open',created='';
 const strict=h.doc.createElement('button');strict.className='gm33-mode';strict.dataset.mode='strict';strict.onclick=()=>{chosen='strict';};const create=h.doc.createElement('button');create.className='gm33-create';create.onclick=()=>{created=chosen;};h.doc.body.append(strict,create);
 await h.runFile('assets/js/instant-play-v33-12.js');for(const timer of h.timers.values())if(timer.ms===60)timer.fn();await settle();assert.equal(created,'strict');
});
test('playlist validation retains allowed seat choices and rejects invalid combinations',()=>{
 const row=Catalog.normalizePlaylist([{game:'ludo',mode:'ludo-quick',seats:4}])[0];assert.equal(row.seats,4);assert.equal(row.mode,'ludo-quick');
 for(const row of [{game:'ludo',mode:'ludo',seats:5},{game:'jackaroo',mode:'quick',seats:3},{game:'pegs',mode:'teams',seats:3},{game:'billiards',mode:'classic',seats:4}])assert.throws(()=>Catalog.normalizePlaylist([row]));
});
test('linked table initialization passes the chosen physical seats and rules through to the game server',async()=>{
 for(const [game,mode,seats]of [['ludo','ludo-quick',4],['ludo','ludo',6],['jackaroo','quick',4],['pegs','teams',6],['pegs','vault',4],['dice','classic',5]]){
  let body;const namespace={idFromName:n=>n,get:()=>({fetch:async(_url,options)=>{body=JSON.parse(options.body);return new Response('{}',{status:201});}})};
  const opened=await createLinkedRoom({BOARD_ROOMS:namespace},game,{settings:{mode,seats},count:2,link:{code:'151234',round:'test',token:'x'.repeat(40)}});
  assert.equal(opened.ok,true);assert.equal(body.seats,seats);assert.equal(body.playerLimit,seats);assert.equal(body.variant,mode);
 }
});
