import test from 'node:test';
import assert from 'node:assert/strict';
import {createBalootMatch,applyBalootAction,legalCards,createDeck,findProjects,balootView,provenCuts,cardPoints,trickWinner} from '../public/assets/js/engines/baloot-engine.js';
import {balootKnowledge} from '../public/assets/js/engines/baloot-bot.js';

const HOKM={type:'hokm',trump:'S',buyer:0,taker:0,multiplier:1,gahwa:false,locked:false};
function seeded(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
function fixture({hand=['7S','AD'],cards=[{seat:0,card:'QH'},{seat:1,card:'9S'}],seat=2,open=true,contract={}}={}){
  const state=createBalootMatch({dealer:3,rng:seeded(3),open});
  state.phase='playing';state.contract={...HOKM,...contract};state.turn=seat;
  state.hands=[[],[],[],[]];state.hands[seat]=[...hand];state.startHands=state.hands.map(cards=>[...cards]);
  for(const entry of cards)state.startHands[entry.seat].push(entry.card);
  state.played=cards.map(entry=>entry.card);state.trick={leader:cards[0]?.seat??seat,cards:[...cards],top:false};state.leadTop=false;
  return state;
}
function play(state,card,extra={}){return applyBalootAction(state,state.turn,{type:'play',card,projects:[],...extra},seeded(9)).state;}
function dealt(seed,type='hokm',multiplier=1,gahwa=false){
  const rng=seeded(seed);let state=createBalootMatch({dealer:3,rng});
  state=applyBalootAction(state,state.turn,{type:'bid',bid:'sun'},rng).state;
  state.contract={...state.contract,type,trump:type==='hokm'?'S':null,multiplier,gahwa};state.baloot=null;
  return state;
}
function finish(state,{declare=false}={}){
  while(state.phase==='playing')state=applyBalootAction(state,state.turn,{type:'play',card:legalCards(state)[0],...(declare?{}:{projects:[]})},seeded(4)).state;
  return state;
}

test('no higher trump: discard or undertrump is legal when the led plain suit is absent',()=>{
  for(const open of [true,false])for(const card of ['7S','AD']){
    const state=fixture({open});assert.deepEqual(legalCards(state),['7S','AD']);
    const after=play(state,card);assert.equal(after.violations.length,0);assert.ok(after.played.includes(card));
  }
});
test('the overtrump duty is checked for all trump ranks, hand subsets, and suits',()=>{
  const ranks=['7','8','Q','K','T','A','9','J'];let cases=0;
  for(const trump of ['S','H','D','C'])for(let winning=0;winning<ranks.length;winning++){
    const led=['S','H','D','C'].find(suit=>suit!==trump),discard=['S','H','D','C'].find(suit=>suit!==trump&&suit!==led);
    const remaining=ranks.filter((_,index)=>index!==winning);
    for(let mask=0;mask<1<<remaining.length;mask++){
      const trumps=remaining.filter((_,index)=>mask&(1<<index)).map(rank=>rank+trump),hand=[...trumps,'A'+discard];
      const state=fixture({hand,cards:[{seat:0,card:'7'+led},{seat:1,card:ranks[winning]+trump}],contract:{trump}});
      const higher=trumps.filter(card=>ranks.indexOf(card[0])>winning);
      assert.deepEqual(legalCards(state),higher.length?higher:hand);cases++;
    }
  }
  assert.equal(cases,4096);
});
test('a higher trump in hand makes both a discard and an undertrump a real cut',()=>{
  for(const card of ['7S','AD']){
    const state=fixture({hand:['7S','JS','AD']});assert.deepEqual(legalCards(state),['JS']);
    assert.equal(play(state,card).violations.length,1);
    const strict={...state,open:false};assert.throws(()=>play(strict,card),/illegal_card/);
  }
});
test('following the led suit takes priority over every freedom to discard or trump',()=>{
  const state=fixture({hand:['7H','7S','AD']});assert.deepEqual(legalCards(state),['7H']);
  assert.equal(play(state,'7S').violations[0].reason,'follow');
});
test('a trump lead still requires a trump when no higher one is held',()=>{
  const state=fixture({hand:['7S','AD'],cards:[{seat:1,card:'JS'}],seat:2});
  assert.deepEqual(legalCards(state),['7S']);assert.equal(play(state,'AD').violations.length,1);assert.equal(play(state,'7S').violations.length,0);
});
test('a plain opposing winner must be trumped when the led suit is absent',()=>{
  const state=fixture({cards:[{seat:0,card:'7H'},{seat:1,card:'AH'}]});
  assert.deepEqual(legalCards(state),['7S']);assert.equal(play(state,'AD').violations[0].reason,'trump');
});
test('partner wins with a trump: a void last player may discard even a higher trump is held',()=>{
  const state=fixture({seat:3,hand:['JS','AD'],cards:[{seat:0,card:'QH'},{seat:1,card:'9S'},{seat:2,card:'7H'}]});
  assert.deepEqual(legalCards(state),['JS','AD']);assert.equal(play(state,'AD').violations.length,0);
});
test('locked trumps restrict the opening lead without changing the no-overtrump exception',()=>{
  const state=fixture({contract:{locked:true,multiplier:2}});assert.deepEqual(legalCards(state),['7S','AD']);
  const lead=fixture({cards:[],seat:2,contract:{locked:true,multiplier:2}});assert.deepEqual(legalCards(lead),['AD']);
});
test('an undertrump escape never becomes a cut from a later low trump sighting',()=>{
  const view={open:true,contract:HOKM,tricks:[{leader:0,cards:[{seat:0,card:'QH'},{seat:1,card:'9S'},{seat:2,card:'AD'},{seat:3,card:'7H'}],top:false}],trick:{cards:[{seat:1,card:'8H'},{seat:2,card:'7S'}]}};
  assert.equal(provenCuts(view,0).some(proof=>proof.card==='AD'),false);
  view.trick.cards[1].card='JS';assert.equal(provenCuts(view,0).some(proof=>proof.card==='AD'),true);
});
test('a real server claim cannot win on a discarded card when no overtrump existed',()=>{
  const state=play(fixture(),'AD');
  const result=applyBalootAction(state,1,{type:'claim',target:2,reason:'cut'},seeded(2)).state;
  assert.equal(result.claim.correct,false);assert.equal(result.claim.proof,null);
});
test('an old false cut log is rechecked before a review can award points',()=>{
  const state=play(fixture(),'AD');state.violations.push({seat:2,card:'AD',trick:0,reason:'trump',should:['7S']});
  const pending=applyBalootAction(state,1,{type:'review_claim',target:2,reason:'cut',card:'AD',tricks:[0]}).state;
  const done=applyBalootAction(pending,1,{type:'confirm_review',reviewId:pending.review.id}).state;
  assert.equal(done.claim.correct,false);assert.equal(done.violations.length,0);assert.equal(done.result.cuts.length,0);
});
test('bots do not infer no trumps from a lawful undertrump escape or a free partner discard',()=>{
  const state=fixture();state.trick.cards.push({seat:2,card:'AD'});
  const knowledge=balootKnowledge(state);assert.equal(knowledge.voids[2].has('H'),true);assert.equal(knowledge.voids[2].has('S'),false);
  const partner=fixture({seat:3,cards:[{seat:0,card:'QH'},{seat:1,card:'AH'},{seat:2,card:'7H'},{seat:3,card:'AD'}]});
  assert.equal(balootKnowledge(partner).voids[3].has('S'),false);
});
test('a later visible suit corrects a bot inference after an open-play cut',()=>{
  const state=fixture();state.tricks=[{cards:[{seat:0,card:'QH'},{seat:1,card:'9S'},{seat:2,card:'AD'},{seat:3,card:'7H'}]}];
  state.trick={cards:[{seat:1,card:'8H'},{seat:2,card:'KH'}]};assert.equal(balootKnowledge(state).voids[2].has('H'),false);
});
test('Sun doubling is offered to an opponent at exactly 100 against a buyer over 100',()=>{
  for(const [scores,expected]of [[[101,100],'doubling'],[[100,100],'playing'],[[101,101],'playing'],[[120,99],'doubling']]){
    let state=createBalootMatch({dealer:3,rng:seeded(2)});state.scores=scores;
    state=applyBalootAction(state,0,{type:'bid',bid:'sun'}).state;assert.equal(state.phase,expected,JSON.stringify(scores));
  }
});
test('a sequence hundred outranks an ace quartet hundred after both are shown',()=>{
  const first=['7H','8H','9H','TH','JH','7D','8D','9D'],second=['AS','AH','AD','AC','7S','8S','9S','TS'];
  const rest=createDeck().filter(card=>!first.includes(card)&&!second.includes(card));
  let state=fixture({cards:[],seat:0});state.hands=[first,second,rest.slice(0,8),rest.slice(8)];state.startHands=structuredClone(state.hands);
  for(let i=0;i<4;i++){
    const seat=state.turn,projects=seat<2?[findProjects(state.hands[seat],'hokm').findIndex(p=>p.type==='hundred'&&p.kind===(seat===0?'sequence':'four'))]:[];
    assert.ok(projects.every(id=>id>=0));state=play(state,legalCards(state)[0],{projects});
  }
  while(state.tricks.length===1){
    const seat=state.turn;
    if(seat<2&&!state.projectShows[seat])state=applyBalootAction(state,seat,{type:'show_projects'}).state;
    if(state.projectShows[0]&&state.projectShows[1])break;
    state=play(state,legalCards(state)[0]);
  }
  assert.equal(state.projects.team,0);
});
test('projects double only in double, not triple or four',()=>{
  for(const multiplier of [1,2,3,4]){
    const result=finish(dealt(4,'hokm',multiplier),{declare:true}).result;
    const value=result.projects[0]+result.projects[1];assert.ok(value>0);
    const plain=finish(dealt(4,'hokm',1),{declare:true}).result;
    assert.equal(value,(plain.projects[0]+plain.projects[1])*(multiplier===2?2:1));
  }
});
test('a kaboot stays 25 Hokm or 44 Sun at every doubling level',()=>{
  const top=['AS','TS','AH','TH','AD','TD','AC','TC'],rest=createDeck().filter(card=>!top.includes(card));
  for(const type of ['sun','hokm'])for(const multiplier of [1,2,3,4]){
    let state=fixture({cards:[],seat:0,contract:{type,trump:type==='hokm'?'S':null,multiplier}});
    const first=type==='sun'?top:['JS','9S','AS','TS','KS','QS','8S','7S'];
    const remainder=type==='sun'?rest:createDeck().filter(card=>!first.includes(card));
    state.hands=[first,remainder.slice(0,8),remainder.slice(8,16),remainder.slice(16)];state.startHands=structuredClone(state.hands);
    const r=finish(state).result;assert.equal(r.kaboot,0);assert.equal(r.score[0],type==='hokm'?25:44);assert.equal(r.projects[1],0);
  }
});
test('Baloot counts inside a revealed sequence hundred and is blocked only by a shown king or queen quartet',()=>{
  for(const [hand,blocked]of [
    [['9S','TS','JS','QS','KS','AS','7H','7D'],false],
    [['KS','KH','KD','KC','QS','7H','7D','7C'],true],
    [['QS','QH','QD','QC','KS','7H','7D','7C'],true],
  ]){
    const rest=createDeck().filter(card=>!hand.includes(card));
    let state=fixture({cards:[],seat:0});
    state.hands=[hand,rest.slice(0,8),rest.slice(8,16),rest.slice(16)];state.startHands=structuredClone(state.hands);
    state.baloot={seat:0,played:0,announced:false};
    let calls=0;
    while(state.phase==='playing'){
      const seat=state.turn;
      const next=applyBalootAction(state,seat,{type:'play',card:legalCards(state)[0],...(seat===0?{}:{projects:[]})});
      calls+=next.events.filter(event=>event.type==='baloot').length;state=next.state;
    }
    assert.equal(state.projects.team,0);assert.equal(state.result.baloot[0],blocked?0:2,hand.join(','));
    assert.equal(calls,blocked?0:1,'a blocked Baloot must not generate a false call');
  }
});
test('an 81–81 Hokm tie falls on the last raiser, while an undoubled tie stays with the buyer',()=>{
  for(const [multiplier,gahwa,winner]of [[1,false,0],[2,false,0],[3,false,1],[4,false,0],[4,true,1]]){
    const r=finish(dealt(40,'hokm',multiplier,gahwa)).result;assert.deepEqual(r.abnat,[81,81]);
    assert.equal(r.winnerTeam,winner);assert.equal(r.counting,gahwa||multiplier%2===1?1:0);
  }
});
test('complete deals preserve 32 distinct cards, totals and hand privacy across both modes',()=>{
  for(const type of ['sun','hokm'])for(const open of [false,true])for(let seed=1;seed<=30;seed++){
    let state=dealt(seed,type);state.open=open;
    assert.equal(new Set(state.hands.flat()).size,32);
    for(let seat=0;seat<4;seat++)assert.ok(balootView(state,seat).hands.filter((_,i)=>i!==seat).flat().every(card=>card==='??'));
    state=finish(state);assert.equal(state.played.length,32);assert.equal(new Set(state.played).size,32);
    assert.equal(state.result.abnat[0]+state.result.abnat[1],type==='hokm'?162:130);assert.equal(state.violations.length,0);
  }
});
