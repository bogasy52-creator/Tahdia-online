import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createJackarooGame,getJackarooActions,playJackarooAction,previewJackarooAction} from '../public/assets/js/engines/jackaroo-engine.js';
import {createDOM} from './dom-harness.mjs';
function table(){
 const s=createJackarooGame(['أ','ب','ج','د'],{arm:19,home:'fill'});
 s.turn=0;s.hands=[['10S','AS'],['2H','KH'],['4S','5S'],['7D','9C']];
 s.players[0].marbles=[1,-1,-1,-1];return s;
}
test('ten offers independent movement and next-card burn choices',()=>{
 const s=table(),actions=getJackarooActions(s,0);
 assert.ok(actions.some(a=>a.type==='move'&&a.steps===10));
 const burn=actions.find(a=>a.type==='burn');assert.deepEqual(burn,{type:'burn',target:1});
 const before=structuredClone(s),preview=previewJackarooAction(s,burn,'10S');
 assert.deepEqual(preview.hands,s.hands);
 const next=playJackarooAction(s,0,burn);
 assert.deepEqual(s,before);assert.deepEqual(next.hands[1],['KH']);assert.equal(next.turn,2);
 assert.deepEqual(next.discard.slice(-2),['2H','10S']);
 assert.deepEqual(next.players,s.players);
});
test('burn requires a ten and a next-player card and is consumed only once',()=>{
 const s=table();s.hands[0]=['8S','AS'];
 assert.throws(()=>playJackarooAction(s,0,{type:'burn',target:1}),/illegal/);
 s.hands[0]=['10S','AS'];s.hands[1]=[];
 assert.ok(!getJackarooActions(s,0).some(a=>a.type==='burn'));
});
test('aces, sevens, fives and fours retain their distinct action alternatives',()=>{
 const s=table();s.players[0].marbles=[10,20,-1,-1];
 s.hands[0]=['AS','7S','5S','4S'];
 const ace=getJackarooActions(s,0);
 assert.ok(ace.some(a=>a.type==='enter'));
 assert.ok(ace.some(a=>a.type==='move'&&a.steps===1));
 assert.ok(ace.some(a=>a.type==='move'&&a.steps===11));
 assert.ok(getJackarooActions(s,1).some(a=>a.type==='split7'));
 assert.ok(getJackarooActions(s,2).every(a=>a.type==='moveAny5'));
 assert.ok(getJackarooActions(s,3).every(a=>a.backward===true&&a.steps===4));
});
test('card illustrations are inside each face and explain both ten choices',async()=>{
 const h=await createDOM('jackaroo.html');await h.runFile('assets/js/jackaroo-cards.js');
 const cards=h.context.BS_JACK_CARDS,face=cards.face('10H');
 assert.equal(face.querySelectorAll('.jk-act').length,0);
 const svg=decodeURIComponent(cards.url('10H').split(',')[1]);
 assert.match(svg,/data-card-action="move10"/);assert.match(svg,/data-card-action="burn-next"/);
 assert.match(cards.info('10H').say,/تحرق/);
});
