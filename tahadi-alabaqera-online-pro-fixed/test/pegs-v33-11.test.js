import test from 'node:test';import assert from 'node:assert/strict';
import {createPegsGame,rollPegs,pickPegs,pegsHoles,PEG_COLORS} from '../public/assets/js/engines/pegs-engine.js';
import {createPegsRace,playPegsRace,publicPegsRace,advancePegsRace} from '../public/assets/js/engines/pegs-race-engine.js';
import {nearestPegsTarget} from '../public/assets/js/pegs/targets.js';
import {startTable,playerMove,tableOver,winnerSeats,chosenSeats,seatsFor} from '../src/games/board-tables.js';
import {createDOM,MiniElement} from './dom-harness.mjs';
import * as engine from '../public/assets/js/engines/pegs-engine.js';import * as race from '../public/assets/js/engines/pegs-race-engine.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const names=['سعد','عمر','محمد','خالد','علي','نايف'];
test('large table has 48 pieces, six of each of eight colors, and six distinct player seats',()=>{
 const s=createPegsGame(names,{large:true,rng:rng(2)});assert.equal(s.players.length,6);assert.equal(s.pegs.length,48);assert.equal(PEG_COLORS.length,8);
 for(let c=0;c<8;c++)assert.equal(s.pegs.filter(p=>p.c===c).length,6);
 for(const n of [24,48]){const h=pegsHoles(n===48);assert.equal(h.length,n);assert.equal(new Set(h.map(p=>p.x+':'+p.y)).size,n);}
});
test('team tables normalize to 4 or 6 seats, then count the captures of the two partners together',()=>{
 assert.equal(chosenSeats('pegs',3,'teams'),6);assert.equal(chosenSeats('pegs',4,'teams'),4);assert.equal(seatsFor('pegs',5,false,4,'teams'),6);
 let s=createPegsGame(names,{large:true,teams:true,first:0,showMs:0,rng:rng(7)});
 // Seat 0 and seat 3 share one team and collect the entire board legally.
 while(s.winner===null){s=rollPegs(s,s.turn,rng(s.seq+1));const i=s.pegs.findIndex(p=>p.taken===null&&p.c===s.die);s=pickPegs(s,s.turn,i);}
 assert.equal(s.winnerTeam,0);assert.equal(s.ties.length,0);assert.deepEqual(winnerSeats({game:'pegs',state:s,order:names}),[0,3]);
 assert.equal(s.players[0].score,48);
});
test('head selection chooses the back pawn being pointed at instead of the front body',()=>{
 const points=[{x:100,y:100},{x:100,y:132}],pegs=[{taken:null},{taken:null}];
 assert.equal(nearestPegsTarget(100,101,points,pegs),0);assert.equal(nearestPegsTarget(100,131,points,pegs),1);
 pegs[0].taken=0;assert.equal(nearestPegsTarget(100,100,points,pegs),-1);
 assert.equal(nearestPegsTarget(5,5,points,pegs),-1);
});
test('race participants get exactly the same initial layout and color sequence',()=>{
 const s=createPegsRace(names,{large:true,now:1000,showMs:0,rng:rng(8)});
 for(const run of s.runs)assert.deepEqual(run.pegs,s.runs[0].pegs);
 const a=playPegsRace(s,0,{type:'pegs_roll',seq:0},{now:1001}),b=playPegsRace(a,4,{type:'pegs_roll',seq:0},{now:1002});
 assert.equal(b.runs[0].die,b.runs[4].die);assert.equal(b.runs[4].turn,4);assert.equal(b.runs[1].seq,0);
});
test('a race snapshot contains only its own run, no seed, target queue or opponent peek',()=>{
 let s=createPegsRace(names,{large:true,now:1000,showMs:0,rng:rng(9)});
 s=playPegsRace(s,4,{type:'pegs_peek',peg:3,seq:0},{now:1001});
 const mine=publicPegsRace(s,0,2000),theirs=publicPegsRace(s,4,2000);
 assert.ok(mine.pegs.every(p=>p.c===-1));assert.equal(mine.peek,null);assert.ok(theirs.peek.c>=0);
 for(const k of ['runs','order','salt','seed'])assert.equal(mine[k],undefined);
});
test('race actions require own sequence and enforce server-side reveal duration and wrong-answer cooldown',()=>{
 let s=createPegsRace(names.slice(0,2),{now:1000,showMs:0,rng:rng(3)});
 s=playPegsRace(s,0,{type:'pegs_roll',seq:0},{now:1001});const run=s.runs[0],peg=run.pegs.findIndex(p=>p.c!==run.die);
 assert.throws(()=>playPegsRace(s,0,{type:'pegs_pick',peg,seq:1},{now:1002}),/cooldown/);
 s=playPegsRace(s,0,{type:'pegs_pick',peg,seq:1},{now:2500});assert.equal(s.runs[0].turn,0);
 assert.throws(()=>playPegsRace(s,0,{type:'pegs_roll',seq:2},{now:3000}),/cooldown/);
 assert.throws(()=>playPegsRace(s,0,{type:'pegs_roll',seq:1},{now:6000}),/stale_action/);
 s=playPegsRace(s,0,{type:'pegs_roll',seq:2},{now:6000});assert.equal(s.runs[0].phase,'pick');
});
test('one racer reaching 12 captures ends the match once without changing opponents boards',()=>{
 let now=1000,s=createPegsRace(names,{large:true,now,showMs:0,rng:rng(88)});
 for(let i=0;i<12;i++){
  s=playPegsRace(s,3,{type:'pegs_roll',seq:s.runs[3].seq},{now:now+=4000});const run=s.runs[3],peg=run.pegs.findIndex(p=>p.taken===null&&p.c===run.die);
  s=playPegsRace(s,3,{type:'pegs_pick',seq:run.seq,peg},{now:now+=4000});
 }
 assert.equal(s.winner,3);assert.equal(s.players[3].score,12);assert.ok(s.runs[0].pegs.every(p=>p.taken===null));
 assert.throws(()=>playPegsRace(s,0,{type:'pegs_roll',seq:0},{now:now+4000}),/match_over/);
});
test('race expiration produces a stable tie and six-player board rooms accept independent actions',()=>{
 const s=createPegsRace(names,{now:1000,showMs:0});assert.equal(advancePegsRace(s,2000),s);const done=advancePegsRace(s,s.endsAt);assert.equal(done.ties.length,6);
 const players=Object.fromEntries(names.map((name,i)=>['p'+i,{id:'p'+i,name,connected:true,ready:true}])),room={game:'pegs',variant:'race-large',players,order:Object.keys(players),status:'lobby',tableSeats:6,version:1};
 startTable(room,{rng:rng(5),now:1000});assert.equal(room.order.length,6);
 playerMove(room,5,{type:'pegs_roll',seq:0},rng(8),()=>1,10000);assert.equal(room.state.runs[5].phase,'pick');assert.equal(room.state.runs[0].phase,'roll');assert.equal(tableOver(room),false);
});
async function page(){
 let options,drawn;const h=await createDOM('pegs.html',{requestAnimationFrame:()=>1,cancelAnimationFrame(){},location:{pathname:'/pegs',search:'?debug&flat',href:'https://game.test/pegs?debug&flat'},Event:class{constructor(type){this.type=type}}});
 h.doc.createTextNode=v=>{const n=new MiniElement('#text');n.textContent=v;return n;};
 const board={draw:v=>{drawn=v;},resize(){},setLayout(){},get size(){return {W:390,H:570,cx:195,cy:285,R:170,pawn:55};},middle:()=>({x:100,y:100}),foot:()=>({x:100,y:100}),toBoard:()=>({x:0,y:0}),hit:()=>0};
 await h.runFile('assets/js/pegs/main.js',{...engine,...race,createPegsBoard:()=>board,guardPegs:()=>{},createTable:o=>{options=o;return {busy:false,send:()=>true,leave(){},menu:{}};}});
 return {...h,options,get drawn(){return drawn;}};
}
function snapshot(state,patch={}){return {code:'051234',game:'pegs',status:'playing',version:state.seq+1,startedAt:100,serverNow:Date.now(),clientReceivedAt:Date.now(),me:{index:0},players:state.players.map((p,index)=>({index,name:p.name})),state,...patch};}
test('controller resumption restores collected pieces and scores from the authority, cancelling stale animations',async()=>{
 const h=await page();let s=createPegsGame(names.slice(0,2),{first:0,showMs:0,rng:rng(2)});s=rollPegs(s,0,rng(4));const peg=s.pegs.findIndex(p=>p.c===s.die);s=pickPegs(s,0,peg);
 h.options.onResync();await h.options.apply(snapshot(s,{resync:true}),{animate:false});assert.equal(h.drawn.pegs[peg].taken,0);assert.equal(h.context.BS_PEGS.state.players[0].score,1);
 // A duplicate connection update is authoritative even if local visual data was damaged.
 h.context.BS_PEGS.ctl.state={...s,pegs:s.pegs.map(p=>({...p,taken:null}))};
 await h.options.apply(snapshot(s),{animate:false});assert.equal(h.drawn.pegs[peg].taken,0);
 h.context.BS_PEGS.fx[peg].keep=true;h.options.onResync();await h.options.apply(snapshot(s,{resync:true}),{animate:false});assert.equal(h.context.BS_PEGS.fx[peg].keep,undefined);
});
test('older states cannot resurrect pieces while a deliberate new match starts a fresh board',async()=>{
 const h=await page(),old=createPegsGame(names.slice(0,2),{first:0,showMs:0}),rolled=rollPegs(old,0,rng(1)),s=pickPegs(rolled,0,rolled.pegs.findIndex(p=>p.c===rolled.die));
 await h.options.apply(snapshot(s,{resync:true}),{animate:false});await h.options.apply(snapshot(old),{animate:false});assert.equal(h.context.BS_PEGS.state.seq,s.seq);
 await h.options.apply(snapshot(old,{startedAt:200,resync:true}),{animate:false});assert.ok(h.context.BS_PEGS.state.pegs.every(p=>p.taken===null));
});
test('the real page controller supports a 48-piece six-person board and eight shape paths',async()=>{
 const h=await page(),s=createPegsGame(names,{large:true,showMs:0});await h.options.apply(snapshot(s,{resync:true}),{animate:false});
 assert.equal(h.context.BS_PEGS.fx.length,48);assert.equal(h.doc.getElementById('players').children.length,6);assert.equal(h.doc.getElementById('pegsGame').classList.contains('pg-large'),true);
 assert.equal(h.doc.getElementById('pegsPeekNotice').closest('#status')?.id,'status');
});
