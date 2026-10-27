import test from 'node:test';
import assert from 'node:assert/strict';
import {cognitiveQuestion,createMemorySequence,stepMemorySequence,LOGIC_CATEGORIES} from '../public/assets/js/engines/cognitive-v34.js';
import {createJackarooGame,getJackarooActions,playJackarooAction,previewJackarooAction} from '../public/assets/js/engines/jackaroo-engine.js';
import {createParty,addPartyPlayer,startPartyRound,applyPartyAction,partyRoundView,partySnapshot,advanceParty,seeded} from '../src/party/party-engine.js';
import {normalizePlaylist} from '../public/assets/js/engines/party-catalog-v29.js';
import {MEMORY_THEMES} from '../public/assets/js/memory-themes-v34.js';
import {readFile,stat} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
for(let difficulty=1;difficulty<=5;difficulty++)test('logic has ten unambiguous categories at difficulty '+difficulty,()=>{
 const kinds=new Set();for(let i=0;i<1000;i++){const q=cognitiveQuestion(i,seeded(i+1),difficulty);kinds.add(q.category);assert.equal(q.difficulty,difficulty);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.equal(q.options.filter(v=>v===q.answer).length,1);assert.ok(q.explanation.length>15);assert.ok(q.question);}
 assert.equal(kinds.size,LOGIC_CATEGORIES.length);
});
test('sequence rules reject malformed, locked and completed input; three errors finish the attempt',()=>{
 const order=createMemorySequence(8,seeded(7));assert.equal(order.length,8);assert.equal(new Set(order).size,8);
 let s={deck:Array(9).fill(0),sequence:[0,2,1],cursor:0,mistakes:0,moves:0,active:true};
 assert.equal(stepMemorySequence(s,-1).accepted,false);assert.equal(stepMemorySequence({...s,locked:true},0).accepted,false);
 s=stepMemorySequence(s,0);assert.equal(s.cursor,1);s=stepMemorySequence(s,1);assert.equal(s.cursor,0);assert.equal(s.mistakes,1);
 s=stepMemorySequence(s,1);s=stepMemorySequence(s,1);assert.equal(s.over,true);assert.equal(s.won,false);assert.equal(stepMemorySequence(s,0).accepted,false);
 s={...s,cursor:0,mistakes:0,active:true};for(const i of s.sequence)s=stepMemorySequence(s,i);assert.equal(s.won,true);
});
function roomWith20(memoryMode='sequence'){
 const room=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:[{game:'memory',memoryMode,memoryTheme:'ocean',difficulty:5,duration:180}],now:1000});for(let i=0;i<20;i++)addPartyPlayer(room,{name:'Player '+i,now:1000});room.roster=[...room.order];startPartyRound(room,2000,42);return room;
}
test('20-player sequence uses the same deck and order, masks after preview, and accepts one authoritative completion',()=>{
 const room=roomWith20(),r=room.round,id=room.order[0],p=r.participants[id],initial=structuredClone(p.state),start=r.memoryPreviewUntil;
 for(const player of Object.values(r.participants)){assert.deepEqual(player.state.deck,p.state.deck);assert.deepEqual(player.state.sequence,p.state.sequence);}
 const message=cell=>({sessionId:room.sessionId,roundId:r.id,seq:p.seq+1,action:{cell}});
 assert.throws(()=>applyPartyAction(room,id,message(initial.sequence[0]),start-1),/انتظر/);
 assert.ok(partyRoundView(room,id,2000).me.sequence);assert.equal(partySnapshot(room,null,2000).round.me,null);
 const change=advanceParty(room,start);assert.equal(change.full,true);const hidden=partyRoundView(room,id,start).me;assert.equal(hidden.sequence,null);assert.ok(hidden.deck.every(x=>x===null));
 for(let i=0;i<initial.sequence.length;i++)applyPartyAction(room,id,message(initial.sequence[i]),start+i+1);
 assert.equal(p.done,true);assert.equal(p.won,true);assert.equal(p.progress,1);assert.equal(p.score,10000);assert.ok(room.order.slice(1).every(other=>r.participants[other].seq===0));
 assert.throws(()=>applyPartyAction(room,id,message(0),start+100),/اكتملت/);
});
test('sequence wrong answer resets progress, locks briefly and never reveals its remaining order',()=>{
 const room=roomWith20(),r=room.round,id=room.order[0],p=r.participants[id],now=r.memoryPreviewUntil,wrong=(p.state.sequence[0]+1)%9;
 applyPartyAction(room,id,{sessionId:room.sessionId,roundId:r.id,seq:1,action:{cell:wrong}},now);
 assert.equal(p.mistakes,1);assert.equal(p.state.locked,true);assert.equal(partyRoundView(room,id,now).me.sequence,null);
 advanceParty(room,now+700);assert.equal(p.state.locked,false);assert.ok(partyRoundView(room,id,now+700).me.deck.every(v=>v===null));
});
test('memory settings reject unknown themes and modes without altering the old playlist contract',()=>{
 assert.deepEqual(normalizePlaylist(['memory']),[{game:'memory',difficulty:2,duration:180,worldId:'classic'}]);
 assert.throws(()=>normalizePlaylist([{game:'memory',memoryTheme:'../../secret'}]));assert.throws(()=>normalizePlaylist([{game:'memory',memoryMode:'calm'}]));
});
test('all five memory collections have sixteen labels and shipped images',async()=>{
 assert.equal(Object.keys(MEMORY_THEMES).length,5);for(const theme of Object.values(MEMORY_THEMES)){assert.equal(theme.faces.length,16);assert.equal(new Set(theme.faces).size,16);assert.ok((await stat(new URL('../public'+theme.src,import.meta.url))).size>0);}
});
for(const seats of [4,6])test('Jackaroo preview matches actual piece resolution without consuming a card at '+seats+' seats',()=>{
 let state=createJackarooGame(Array.from({length:seats},(_,i)=>'P'+i),{rng:seeded(seats)});let checked=0;
 for(let turn=0;turn<80;turn++){
  let picked=null;for(let card=0;card<state.hands[state.turn].length;card++)for(const action of getJackarooActions(state,card)){
   const original=structuredClone(state),preview=previewJackarooAction(state,action,state.hands[state.turn][card]),actual=playJackarooAction(state,card,action);
   assert.deepEqual(state,original);assert.deepEqual(preview.players,actual.players);assert.equal(preview.turn,state.turn);assert.deepEqual(preview.hands,state.hands);assert.deepEqual(preview.deck,state.deck);checked++;picked??={card,action};
  }
  if(!picked)break;state=playJackarooAction(state,picked.card,picked.action);if(state.winnerTeam!==null)break;
 }
 assert.ok(checked>40);
});
test('game selection guard blocks label selection while preserving text entry',async()=>{
 const h=await createDOM('party.html');await h.runFile('assets/js/platform.js');assert.equal(h.doc.body.classList.contains('bs-game-interaction-v34'),true);
 let prevented=0;h.doc.dispatchEvent({type:'selectstart',target:h.doc.getElementById('gameStage'),preventDefault(){prevented++;}});assert.equal(prevented,1);
 h.doc.dispatchEvent({type:'selectstart',target:h.doc.getElementById('name'),preventDefault(){prevented++;}});assert.equal(prevented,1);
 const css=await readFile(new URL('../public/assets/css/game-interaction-v34.css',import.meta.url),'utf8');assert.match(css,/-webkit-user-select:none/);assert.match(css,/user-select:text/);assert.doesNotMatch(css,/touch-action:none/);
});
for(const page of ['online','local','baloot'])test('selection guard also covers '+page+' play',async()=>{
 const h=await createDOM(page+'.html');await h.runFile('assets/js/platform.js');assert.equal(h.doc.body.classList.contains('bs-game-interaction-v34'),true);const bundles=JSON.parse(await readFile(new URL('../scripts/style-bundles.json',import.meta.url),'utf8'));assert.ok(bundles[page+'.html'].includes('assets/css/game-interaction-v34.css'));
});
