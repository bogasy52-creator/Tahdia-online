import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createColorTable,playColorTable,publicColorTable,chooseColorMove,colorTimeout} from '../public/assets/js/engines/color-tables-v33-14.js';
import {startTable,playerMove,tableVariant,seatProgress} from '../src/games/board-tables.js';
import {SIX_TRACK,SIX_LANES} from '../public/assets/js/ludo/six-layout.js';
const next=(s,msg,seat=s.turn)=>playColorTable(s,seat,{seq:s.seq,...msg},{rng:()=>.2,now:s.lookUntil+1});
test('all four bluff outcomes award the promised points and leave the source untouched',()=>{
 for(const honest of [true,false])for(const answer of ['trust','challenge']){
  let s=createColorTable(['أ','ب'],{rng:()=>.2});const before=structuredClone(s),color=s.secretColor;
  s=next(s,{type:'color_claim',color:honest?color:(color+1)%6});assert.equal(s.turn,1);
  s=next(s,{type:'color_answer',answer});const winner=honest?(answer==='trust'?1:0):(answer==='trust'?0:1);
  assert.equal(s.players[winner].score,honest&&answer==='trust'?1:2);assert.equal(s.players[1-winner].score,0);
  assert.equal(s.turnNo,1);assert.equal(s.sender,1);assert.equal(before.seq,0);assert.equal(before.claim,null);
 }
});
test('the secret is private for every recipient and spectator, including intermediate frames',()=>{
 const initial=createColorTable(['أ','ب','ج','د','هـ','و']);
 assert.ok(Number.isInteger(publicColorTable(initial,0).secretColor));
 for(const seat of [-1,1,2,3,4,5])assert.equal('secretColor' in publicColorTable(initial,seat),false);
 const claimed=next(initial,{type:'color_claim',color:3});
 for(const seat of [-1,1,2,3,4,5])assert.equal(JSON.stringify(publicColorTable(claimed,seat)).includes('secretColor'),false);
 const resolved=next(claimed,{type:'color_answer',answer:'challenge'});
 assert.equal(resolved.last.color,initial.secretColor);assert.equal('secretColor' in publicColorTable(resolved,0),false);
 assert.ok(Number.isInteger(publicColorTable(resolved,1).secretColor));
});
test('illegal, replayed and out-of-turn color moves are rejected atomically',()=>{
 const s=createColorTable(['أ','ب']);const snapshot=JSON.stringify(s);
 for(const [seat,msg]of [[1,{type:'color_claim',color:0,seq:0}],[0,{type:'color_claim',color:6,seq:0}],[0,{type:'color_claim',color:1.5,seq:0}],[0,{type:'color_claim',color:0,seq:9}],[0,{type:'color_answer',answer:'trust',seq:0}]])assert.throws(()=>playColorTable(s,seat,msg));
 assert.equal(JSON.stringify(s),snapshot);
});
test('three complete cycles give each player equal turns and all players reach the result',()=>{
 for(const count of [2,3,4,5,6]){let s=createColorTable(Array.from({length:count},(_,i)=>''+i)),senders=[];
 while(s.winner===null){senders.push(s.sender);s=next(s,{type:'color_claim',color:s.secretColor});s=next(s,{type:'color_answer',answer:'trust'});}
 assert.equal(s.turnNo,count*3);for(let i=0;i<count;i++)assert.equal(senders.filter(x=>x===i).length,3);assert.equal(s.ties.length,count);assert.equal(s.phase,'over');}
});
test('vault banking preserves earned points, a miss loses only the unbanked amount',()=>{
 let s=createColorTable(['أ','ب'],{mode:'vault',now:0,rng:()=>.2});assert.throws(()=>playColorTable(s,0,{type:'color_roll',seq:0},{now:100}));
 s=next(s,{type:'color_roll'});let peg=s.pegs.findIndex(p=>p.c===s.die);s=next(s,{type:'color_pick',peg});
 assert.equal(s.pending,1);assert.equal(s.players[0].score,0);s=next(s,{type:'color_bank'});assert.equal(s.players[0].score,1);assert.equal(s.turn,1);
 s=next(s,{type:'color_roll'});peg=s.pegs.findIndex(p=>p.taken===null&&p.c===s.die);s=next(s,{type:'color_pick',peg});s=next(s,{type:'color_continue'});s=next(s,{type:'color_roll'});peg=s.pegs.findIndex(p=>p.taken===null&&p.c!==s.die);s=next(s,{type:'color_pick',peg});assert.equal(s.pending,0);assert.equal(s.players[0].score,1);assert.equal(s.players[1].score,0);assert.equal(s.last.lost,1);
 const view=publicColorTable(s,0,100000);assert.ok(view.pegs.filter(p=>p.taken===null).every(p=>p.c===-1));assert.deepEqual(view.reveals,[]);
});
test('timeouts resolve both bluff phases and safely bank a vault decision',()=>{
 let s=createColorTable(['أ','ب']);s=colorTimeout(s);assert.equal(s.phase,'answer');s=colorTimeout(s);assert.equal(s.turnNo,1);
 s=createColorTable(['أ','ب'],{mode:'vault',now:0});s=next(s,{type:'color_roll'});s=next(s,{type:'color_pick',peg:s.pegs.findIndex(p=>p.c===s.die)});s=colorTimeout(s,{now:6000});assert.equal(s.players[0].score,1);assert.equal(s.pending,0);
});
test('answering bots make the same decision whatever the hidden color',()=>{
 let s=createColorTable(['أ','ب']);s=next(s,{type:'color_claim',color:0});
 for(const roll of [.1,.7]){const a=chooseColorMove(s,'hard',()=>roll);for(let color=0;color<6;color++)assert.deepEqual(chooseColorMove({...s,secretColor:color},'hard',()=>roll),a);}
});
test('table rooms normalize both modes, route commands and retain scores after serializing',()=>{
 for(const mode of ['bluff','vault']){
  assert.equal(tableVariant('pegs',mode),mode);const r={game:'pegs',variant:mode,status:'playing',tableSeats:2,players:{a:{id:'a',name:'أ'},b:{id:'b',name:'ب'}},order:['a','b'],version:0};
  startTable(r,{now:0,rng:()=>.2});assert.equal(r.state.mode,mode);
  const old=r.state.seq;playerMove(r,0,{seq:old,type:mode==='bluff'?'color_claim':'color_roll',color:0},()=>.2,undefined,6000);assert.equal(r.state.seq,old+1);
  const restored=JSON.parse(JSON.stringify(r));assert.deepEqual(restored.state,r.state);assert.equal(seatProgress(restored,0),restored.state.players[0].score);
 }
});
test('all 78 steps of six-player Ludo form one continuous loop and every home lane joins its gate',()=>{
 for(let i=0;i<78;i++){const a=SIX_TRACK[i],b=SIX_TRACK[(i+1)%78];assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-26)<1e-8,'join '+i);}
 for(let seat=0;seat<6;seat++){const a=SIX_TRACK[(seat*13+76)%78],b=SIX_LANES[seat][0];assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-26)<1e-8);}
});
