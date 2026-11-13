import test from 'node:test';
import assert from 'node:assert/strict';
let E;
try { E=await import('../public/assets/js/engines/jewels-race-engine.js'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
function requireEngine(){assert.ok(E,'the independent-run engine must exist');}
function create(options={}){requireEngine();return E.createJewelsRace(['أ','ب'],{seed:713,now:1000,durationMs:0,...options});}
function move(s,seat){return E.playJewelsRaceSwap(s,seat,...E.legalRaceSwaps(s,seat)[0],{expectedSeq:s.players[seat].seq,now:1100});}

test('both players receive identical independent starting boards and random streams',()=>{
 const s=create();assert.equal(s.mode,'race');assert.equal(s.moves,25);
 assert.deepEqual(s.players[0].board,s.players[1].board);assert.notEqual(s.players[0].board,s.players[1].board);
 assert.equal(s.players[0].remaining,25);assert.equal(s.players[1].remaining,25);
 const before=structuredClone(s),next=move(s,1);
 assert.deepEqual(s,before);assert.deepEqual(next.players[0],s.players[0]);assert.equal(next.players[1].used,1);
});
test('a player completes the whole move budget without waiting for the other player',()=>{
 let s=create({moves:4});for(let n=0;n<4;n++)s=move(s,0);
 assert.equal(s.players[0].done,true);assert.equal(s.players[0].remaining,0);
 assert.equal(s.players[1].used,0);assert.equal(s.finished,false);assert.equal(s.winner,null);
 assert.throws(()=>E.playJewelsRaceSwap(s,0,0,1,{now:1100}),/run_finished/);
 for(let n=0;n<4;n++)s=move(s,1);
 assert.equal(s.finished,true);assert.equal(s.winner,-1,'identical choices produce an honest draw');
});
test('interleaving identical moves produces identical scores, boards and future refills',()=>{
 let a=create({moves:8}),b=create({moves:8});const choices=[];
 for(let n=0;n<6;n++){const pair=E.legalRaceSwaps(a,0)[0];choices.push(pair);a=E.playJewelsRaceSwap(a,0,...pair,{now:1100});}
 for(const pair of choices){b=E.playJewelsRaceSwap(b,1,...pair,{now:1100});b=E.playJewelsRaceSwap(b,0,...pair,{now:1100});}
 assert.deepEqual(a.players[0],b.players[0]);assert.deepEqual(b.players[0].board,b.players[1].board);
 assert.equal(b.players[0].score,b.players[1].score);assert.equal(b.players[0].seed,b.players[1].seed);
});
test('invalid swaps and a stale own sequence cannot consume moves or mutate either run',()=>{
 let s=create();const next=move(s,0),before=structuredClone(next);
 assert.throws(()=>E.playJewelsRaceSwap(next,0,...E.legalRaceSwaps(next,0)[0],{expectedSeq:0,now:1100}),/stale_move/);
 assert.throws(()=>E.playJewelsRaceSwap(next,0,0,63,{now:1100}),/not_adjacent/);
 assert.throws(()=>E.playJewelsRaceSwap(next,7,0,1,{now:1100}),/invalid_seat/);
 assert.deepEqual(next,before);
});
test('charged boosters consume one fair action and never spend the opponent charge',()=>{
 let s=create();s.players[1].charge=[22,26,32];const other=structuredClone(s.players[0]);
 const next=E.playJewelsRaceBooster(s,1,'hammer',20,{expectedSeq:0,now:1100});
 assert.equal(next.players[1].used,1);assert.equal(next.players[1].remaining,24);assert.equal(next.players[1].charge[0],0);
 assert.deepEqual(next.players[0],other);assert.ok(next.players[1].score>0);
});
test('special gems award their effects without increasing the equal action budget',()=>{
 let s=create();s.players[0].board[0].s='rh';s.players[0].board[1].s='rv';
 const next=E.playJewelsRaceSwap(s,0,0,1,{now:1100});
 assert.equal(next.players[0].remaining,24);assert.equal(next.players[0].last.extra,false);assert.ok(next.players[0].score>=15);
});
test('the common deadline closes both runs and the highest actual score wins',()=>{
 let s=create({durationMs:1000});s=move(s,1);assert.ok(s.players[1].score>0);
 assert.equal(E.advanceJewelsRace(s,1999).finished,false);
 const next=E.advanceJewelsRace(s,2000);assert.equal(next.finished,true);assert.equal(next.winner,1);
 assert.ok(next.players.every(p=>p.done));assert.equal(next.players[0].used,0);
 assert.throws(()=>E.playJewelsRaceSwap(s,0,...E.legalRaceSwaps(s,0)[0],{now:2000}),/match_expired/);
});
test('local handover can finish only one player and exact score ties remain draws',()=>{
 let s=create();s=E.finishJewelsRace(s,{seat:0,now:1100});
 assert.equal(s.players[0].done,true);assert.equal(s.players[1].done,false);assert.equal(s.finished,false);
 s=E.finishJewelsRace(s,{seat:1,now:1100});assert.equal(s.finished,true);assert.equal(s.winner,-1);
});
test('public snapshots keep the opponent board and replay private',()=>{
 let s=create();s=move(s,1);const view=E.publicJewelsRace(s,0);
 assert.deepEqual(view.players[0].board,s.players[0].board);assert.equal(view.players[1].score,s.players[1].score);
 for(const name of ['board','seed','serial','last'])assert.equal(view.players[1][name],undefined,name);
 assert.notEqual(view.players[0].board,s.players[0].board);
});
test('every AI strength completes valid independent boards within the same action budget',()=>{
 for(const level of['easy','medium','hard'])for(const seed of[1,17,713,9001]){let s=create({seed});for(let used=0;used<25;used++){const m=E.chooseJewelsRaceMove(s,1,level,()=>.4);assert.ok(m);s=m.type==='booster'?E.playJewelsRaceBooster(s,1,m.id,m.cell,{now:1100}):E.playJewelsRaceSwap(s,1,m.a,m.b,{now:1100});assert.equal(s.players[1].used,used+1);assert.equal(s.players[1].board.length,64);assert.ok(s.players[1].board.every(Boolean));}assert.equal(s.players[1].done,true);assert.equal(s.players[0].used,0);assert.equal(s.finished,false);}
});
