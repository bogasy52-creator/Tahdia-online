import test from 'node:test';
import assert from 'node:assert/strict';
import * as Choice from '../public/assets/js/engines/snakes-choice.js';
import * as Base from '../public/assets/js/engines/snakes-engine.js';
import * as Enhanced from '../public/assets/js/engines/snakes-adventure.js';
import * as FX from '../public/assets/js/snakes-v4-fx.js';
import {rollSnakesServer} from '../src/games/snakes-server.js';
import {playerMove,timeoutMove,botTurn,stepsTime} from '../src/games/board-tables.js';
import {HockeyOnline} from '../public/assets/js/hockey/online.js';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
const roomOf=state=>({game:'snakes',variant:'choice',status:'playing',state,order:['a','b'],players:{a:{id:'a'},b:{id:'b'}},version:1});
test('choice dice are offered by the server; repeated rolls and wrong seats do not mutate the match',()=>{
 const room=roomOf(Choice.createChoiceGame(['A','B']));let rolls=0;
 playerMove(room,0,{type:'roll',rolls:[6,6]},()=>.5,()=>++rolls);
 assert.deepEqual(room.state.pendingChoice.rolls,[1,2]);assert.equal(room.state.moveCount,0);
 const before=structuredClone(room);
 assert.throws(()=>playerMove(room,0,{type:'roll'},()=>.5,()=>{rolls++;return 6}),/choose_first/);
 assert.throws(()=>playerMove(room,1,{type:'snakes_choose',index:0},()=>.5),/wrong_turn/);
 for(const index of [-1,2,6,'1',null,NaN])assert.throws(()=>playerMove(room,0,{type:'snakes_choose',index},()=>.5),/invalid_choice/);
 assert.deepEqual(room,before);assert.equal(rolls,2);
 playerMove(room,0,{type:'snakes_choose',index:1,rolls:[6,6],value:6},()=>.5);
 assert.equal(room.state.players[0].position,2);assert.equal(room.state.turn,1);assert.equal(room.state.pendingChoice,null);assert.equal(room.state.moveCount,1);
});
test('choice previews match the applied route, exact finishes and extra turns',()=>{
 let state=Choice.createChoiceGame(['A','B']);state=Choice.openChoiceTurn(state,[3,6]);
 assert.equal(Choice.choiceDestination(state,0),22);assert.equal(Choice.chooseChoiceTurn(state,0).players[0].position,22);
 assert.equal(Choice.chooseChoiceTurn(state,1).turn,0);
 state.players[0].position=99;assert.equal(Choice.choiceDestination(state,1),99);
 state.pendingChoice.rolls=[1,6];assert.equal(Choice.bestChoice(state),0);assert.equal(Choice.chooseChoiceTurn(state,0).winner,0);
});
test('choice timeouts resolve either phase and bots can complete whole matches',()=>{
 for(const offered of [false,true]){let s=Choice.createChoiceGame(['A','B']);if(offered)s=Choice.openChoiceTurn(s,[1,3]);const r=roomOf(s);const steps=timeoutMove(r,()=>.5,()=>2);assert.equal(r.state.pendingChoice,null);assert.equal(r.state.moveCount,1);assert.ok(steps.list.length>=1);assert.ok(stepsTime(r,steps)>0);}
 for(let seed=1;seed<=30;seed++){let n=seed;const rng=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296),r=roomOf(Choice.createChoiceGame(['A','B']));for(let turn=0;r.state.winner===null&&turn<2000;turn++)botTurn(r,{from:r.version,list:[]},rng);assert.notEqual(r.state.winner,null);assert.ok(r.state.players.every(p=>p.position>=0&&p.position<=100));}
});
test('choice controls expose both destinations and submit the chosen index only',async()=>{
 const h=await createDOM('snakes.html',{...Choice,...Base,...Enhanced,...FX});await h.runInline();
 const table=h.context.tables.at(-1),state=Choice.openChoiceTurn(Choice.createChoiceGame(['A','B']),[3,5]);
 await table.apply({code:'401234',variant:'choice',status:'playing',version:2,me:{id:'a',index:0},players:[{id:'a',index:0},{id:'b',index:1}],state});
 assert.equal(h.doc.getElementById('choiceDock').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('roll').disabled,true);
 assert.match(h.doc.getElementById('chooseDie0').textContent,/22/);h.doc.getElementById('chooseDie1').click();assert.deepEqual(table.sent.at(-1),{type:'snakes_choose',index:1});
});
test('hockey reconnect accepts an authoritative welcome, resets input sequence and discards stale frames',async()=>{
 const saved=new Map(),instances=[];const originals=Object.fromEntries(['window','document','location','localStorage','sessionStorage','WebSocket'].map(k=>[k,globalThis[k]]));
 class Socket{constructor(url,protocols){this.url=url;this.protocols=protocols;this.readyState=1;this.sent=[];instances.push(this)}send(text){this.sent.push(JSON.parse(text))}close(){this.readyState=3}message(data){this.onmessage?.({data:JSON.stringify(data)})}}
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
 Object.assign(globalThis,{window:{dispatchEvent(){}},document:{hidden:false},location:{protocol:'https:',host:'game.test'},localStorage:storage,sessionStorage:storage,WebSocket:Socket});
 const seen=[],client=new HockeyOnline({onState:s=>seen.push(s.frame)}),state={players:[{id:'a'},{id:'b'}],me:0,round:1,frame:200,seq:80,status:'playing'};
 try{const opening=client.enter('join',{code:'951234'});instances[0].message({type:'welcome',token:'resume-token',state});await opening;
 const reconnect=client.resume({force:true});assert.equal(instances[0].onmessage,null);assert.ok(instances[1].protocols.includes('rt.resume-token'));
 instances[1].message({type:'welcome',token:'resume-token',state:{...state,frame:3,seq:4}});await reconnect;
 instances[1].message({type:'state',state:{...state,frame:2}});assert.deepEqual(seen,[200,3]);
 client.lastInput=-100;client.input(300,800);assert.equal(instances[1].sent.at(-1).seq,5);
 instances[1].message({type:'state',state:{...state,frame:4}});assert.deepEqual(seen,[200,3,4]);
 }finally{client.close({leave:false});for(const [k,v]of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
test('hockey rejects a malformed welcome and settles a cancelled opening',async()=>{
 const originals=Object.fromEntries(['window','document','location','localStorage','sessionStorage','WebSocket'].map(k=>[k,globalThis[k]]));const instances=[];
 class Socket{constructor(){instances.push(this)}close(){}send(){}}
 Object.assign(globalThis,{window:{dispatchEvent(){}},document:{hidden:false},location:{protocol:'https:',host:'game.test'},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},WebSocket:Socket});
 const client=new HockeyOnline();try{
 const first=client.enter('join',{code:'951234'});instances[0].onmessage({data:JSON.stringify({type:'welcome',state:{me:-1,players:[]}})});await assert.rejects(first,/غير صالحة/);
 const second=client.enter('join',{code:'951234'});client.close({leave:false});await assert.rejects(second,{name:'AbortError'});
 }finally{client.close({leave:false});for(const [k,v]of Object.entries(originals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

test('all catalogue emotes have shared illustrated art in place of a device emoji',async()=>{
 const h=await createDOM('snakes.html');await h.runFile('assets/js/reaction-performers.js');
 for(const item of Career.CATALOG.filter(item=>item.type==='emote')){const art=h.context.BS_REACTION_ART.make(item);assert.ok(art,item.id);assert.ok(art.querySelector('.rx-studio-sprite'),item.id);assert.equal(art.textContent,'');}
});
