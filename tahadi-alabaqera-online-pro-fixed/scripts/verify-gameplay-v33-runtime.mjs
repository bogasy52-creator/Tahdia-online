// Real local Workerd/SQLite and WebSockets. No test routes are added to production.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRuntime} from './local-runtime-v26.mjs';
import {balootActions,findProjects} from '../public/assets/js/engines/baloot-engine.js';
import {stepsTime} from '../src/games/board-tables.js';
const runtime=await createRuntime(),all=[],checks=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(predicate,label){const end=Date.now()+10000;while(Date.now()<end){if(predicate())return;await wait(10);}throw Error('timeout: '+label);}
async function create(game){const res=await runtime.mf.dispatchFetch(new URL('/api/board/rooms',runtime.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({game})});assert.equal(res.status,200);return res.json();}
async function join(room,game,index){const res=await runtime.mf.dispatchFetch(new URL('/api/board/rooms/'+room.code+'/ws?game='+game+'&name=Gameplay'+index,runtime.url),{headers:{upgrade:'websocket','sec-websocket-protocol':['busraj-v1',...(index===0?['hk.'+room.hostKey]:[])].join(',')}});assert.equal(res.status,101);const peer={socket:res.webSocket,state:null,errors:[]};peer.socket.accept();all.push(peer);peer.socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.state)peer.state=m.state;if(m.type==='error')peer.errors.push(m.message);});await until(()=>peer.state,'welcome');return peer;}
async function action(peers,peer,value){const version=peer.state.version;peer.socket.send(JSON.stringify({...value,expectedVersion:version}));await until(()=>peers.every(p=>p.state.version>version),'broadcast');}
try{
 const source=await(await runtime.mf.dispatchFetch(new URL('/paths-online',runtime.url))).text();assert.equal((source.match(/id="pathCanvas"/g)||[]).length,1);assert.match(source,/id="pathSoloStart"/);assert.match(source,/id="pathModeFriends"/);checks.push('merged solo/friends page and one shared board served by the real Worker');
 let peers=[];
 // Select a real deal containing a project; all hands still arrive through their
 // private sockets, and no fixture endpoint or secret server state is exposed.
 for(let attempt=0;attempt<12;attempt++){
  const room=await create('baloot');peers=[];for(let i=0;i<4;i++)peers.push(await join(room,'baloot',i));await action(peers,peers[0],{type:'start'});
  while(peers[0].state.state.phase!=='playing'){const actor=peers.find(p=>p.state.me.index===peers[0].state.state.turn),choices=balootActions(actor.state.state);await action(peers,actor,{type:'baloot',action:choices.find(a=>a.bid==='sun')||choices.find(a=>a.call==='pass')||choices[0]});}
  if(peers.some(p=>findProjects(p.state.state.hands[p.state.me.index],p.state.state.contract.type).length))break;
  for(const p of peers)p.socket.close(1000,'new fixture deal');
 }
 assert.ok(peers.some(p=>findProjects(p.state.state.hands[p.state.me.index],p.state.state.contract.type).length),'a real deal with project cards');
 const first=peers.find(p=>p.state.me.index===peers[0].state.state.turn),version=first.state.version,errors=first.errors.length;
 first.socket.send(JSON.stringify({type:'baloot',expectedVersion:version,action:{type:'play',card:first.state.state.hands[first.state.me.index][0],projectCards:[{type:'sira',cards:['ZZ','XX','YY']}]}}));await until(()=>first.errors.length>errors,'invalid project rejected');assert.equal(first.state.version,version);checks.push('forged manually selected project rejected without advancing the game');
 const selected=new Set();while(peers[0].state.state.tricks.length===0){const actor=peers.find(p=>p.state.me.index===peers[0].state.state.turn),seat=actor.state.me.index,view=actor.state.state,projects=findProjects(view.hands[seat],view.contract.type).slice(0,1).map(({type,cards})=>({type,cards}));if(projects.length)selected.add(seat);await action(peers,actor,{type:'baloot',action:{type:'play',card:balootActions(view)[0].card,projectCards:projects}});assert.equal(actor.state.state.manualProjects[seat],true);}
 while(peers[0].state.state.tricks.length===1){const actor=peers.find(p=>p.state.me.index===peers[0].state.state.turn),seat=actor.state.me.index;if(selected.has(seat)){await action(peers,actor,{type:'baloot',action:{type:'show_projects'}});assert.ok(peers.every(p=>p.state.state.review===null));assert.equal(actor.state.state.projectShows[seat],true);}await action(peers,actor,{type:'baloot',action:{type:'play',card:balootActions(actor.state.state)[0].card,projectCards:[]}});}
 for(const peer of peers)assert.ok(peer.state.state.hands.filter((_,i)=>i!==peer.state.me.index).flat().every(card=>card==='??'));checks.push('first-play manual selections accepted; '+selected.size+' real dealt projects revealed without a modal; other hands remain private');
 const snakes=await create('snakes'),players=[];for(let i=0;i<2;i++)players.push(await join(snakes,'snakes',i));await action(players,players[0],{type:'start'});
 const actor=players.find(p=>p.state.me.index===players[0].state.state.turn);await action(players,actor,{type:'roll'});const next=actor.state,list=next.steps||[];if(!list.some(s=>s.version===next.version))list.push({version:next.version,state:next.state});const display=stepsTime({game:'snakes'},{list});assert.ok(next.turnDeadline-next.serverNow>=next.turnTotal+display-500);checks.push('snakes deadline includes the actual display duration before the next decision window');
 const result={release:'33.0.0',runtime:'native Workerd / SQLite / real WebSockets',published:false,browser_tested:false,physical_phone_tested:false,checks};await mkdir(new URL('../verification/gameplay/',import.meta.url),{recursive:true});await writeFile(new URL('../verification/gameplay/runtime.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{for(const peer of all)try{peer.socket.close(1000,'done');}catch{}await runtime.dispose();}
