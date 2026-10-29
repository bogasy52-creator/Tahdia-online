import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createSoloPathsSession} from '../public/assets/js/engines/paths-solo.js';
import {createPaths,restorePaths,starsFor} from '../public/assets/js/engines/journey-engine.js';
import {createBalootMatch,applyBalootAction,legalCards,selectProjects,balootView} from '../public/assets/js/engines/baloot-engine.js';
import {applyBalootMove} from '../src/games/baloot-server.js';
import {createPawnAnimationFrames,createBoardMovePlan,snakesTurnDisplayMs} from '../public/assets/js/snakes-v4-fx.js';
import {stepsTime} from '../src/games/board-tables.js';
import {createStepPlayer} from '../public/assets/js/board-online.js';
import {PARTY_GAMES,normalizePlaylist,partyGame} from '../public/assets/js/engines/party-catalog-v29.js';

test('all 120 solo stages and the daily board remain solvable with replay-verified stars',()=>{
 for(const [level,daily] of [...Array.from({length:120},(_,i)=>[i+1,'']),[1,'2026-10-29']]){
  const session=createSoloPathsSession(level,daily),solution=createPaths(level,daily).solution;
  for(const [color,path]of solution.entries())assert.equal(session.move('path',{color,path}),true);
  assert.equal(session.snapshot().status,'finished');assert.equal(starsFor(restorePaths(session.proof(),{requireWin:true})),3);
  assert.equal(session.move('reset'),false,'a finished proof cannot append moves');
 }
});
test('the single paths catalog accepts old playlists as the canonical friends game',()=>{
 assert.equal(PARTY_GAMES.filter(g=>['paths','paths-online'].includes(g.id)).length,1);
 assert.equal(partyGame('paths').id,'paths-online');assert.equal(normalizePlaylist(['paths'])[0].game,'paths-online');
});
test('manual projects validate the actual selected sequence and ignore invented point values',()=>{
 const hand=['7S','8S','9S','TS','JS','AH','AD','AC'];
 const short=selectProjects(hand,'sun',[{type:'sira',cards:['9S','7S','8S'],value:9999}]);
 assert.deepEqual(short[0].cards,['7S','8S','9S']);assert.notEqual(short[0].value,9999);
 const long=selectProjects(hand,'sun',[{type:'hundred',cards:hand.slice(0,5)}]);assert.equal(long[0].cards.length,5);
 for(const rows of [[{type:'sira',cards:['7S','8S','AS']}],[{type:'sira',cards:['7S','7S','8S']}],[{type:'sira',cards:hand.slice(0,3)},{type:'sira',cards:hand.slice(2,5)}]])assert.throws(()=>selectProjects(hand,'sun',rows),/invalid_projects/);
 assert.deepEqual(selectProjects(hand,'sun',[]),[]);
});
function projectState(){
 let state=createBalootMatch({dealer:3});state.phase='playing';state.contract={type:'sun',buyer:0,taker:0,trump:null,multiplier:1};state.turn=0;
 state.hands[0]=['7S','8S','9S','TS','JS','AH','AD','AC'];state.startHands=state.hands.map(hand=>[...hand]);state.trick={leader:0,cards:[]};state.tricks=[];return state;
}
test('room protocol declares the selected cards, reveals compact projects without a modal, and keeps other hands private',()=>{
 const players=Object.fromEntries(Array.from({length:4},(_,seat)=>['p'+seat,{id:'p'+seat,seat,connected:true}]));const room={state:projectState(),status:'playing',players,bots:[],batchVersion:0};
 applyBalootMove(room,players.p0,{type:'play',card:'AH',projectCards:[{type:'sira',cards:['7S','8S','9S']}]},()=>.5,1000);
 assert.deepEqual(room.state.declared[0][0].cards,['7S','8S','9S']);assert.equal(room.state.projectShows[0],false);
 while(room.state.turn!==0||room.state.tricks.length===0)room.state=applyBalootAction(room.state,room.state.turn,{type:'play',card:legalCards(room.state)[0],projectCards:[]}).state;
 applyBalootMove(room,players.p0,{type:'show_projects'},()=>.5,2000);assert.equal(room.state.review,null);assert.equal(room.state.projectShows[0],true);
 for(let seat=0;seat<4;seat++){const view=balootView(room.state,seat);assert.equal(view.startHands,null);assert.ok(view.hands.filter((_,i)=>i!==seat).flat().every(card=>card==='??'));}
 assert.throws(()=>applyBalootMove(room,players.p0,{type:'show_projects'},()=>.5,3000),/project_show_closed/);
});
test('pawn keyframes follow the same board coordinates using transform alone',()=>{
 const frames=createPawnAnimationFrames([{left:'10%',top:'20%',transform:'scale(1)',offset:0},{left:'50%',top:'70%',transform:'scale(.9)',offset:1}],{width:400,height:500,left:'10%',top:'20%'});
 assert.match(frames[0].transform,/translate3d\(0px,0px,0\)/);assert.match(frames[1].transform,/translate3d\(160px,250px,0\)/);assert.equal(frames[1].offset,1);assert.ok(frames.every(frame=>!('left'in frame)&&!('top'in frame)));
 assert.ok(createBoardMovePlan(10,16).duration>900);
});
test('turn deadlines reserve the full snake and bonus animation instead of a fixed short step',()=>{
 const plain={from:10,landed:16,to:16},snake={...plain,to:4,jumpType:'snake'},bonus={...snake,bonusRoll:2,event:'advance',eventFrom:4,eventTo:12,eventLanding:12};
 assert.ok(snakesTurnDisplayMs(snake)>snakesTurnDisplayMs(plain)+1500);assert.ok(snakesTurnDisplayMs(bonus)>snakesTurnDisplayMs(snake)+2300);
 assert.equal(stepsTime({game:'snakes'},{list:[{state:{lastEvent:plain}},{state:{lastEvent:bonus}}]}),snakesTurnDisplayMs(plain)+snakesTurnDisplayMs(bonus));
});
test('reset aborts an old step and starts a new room without replaying old queued turns',async()=>{
 const played=[],errors=[];let oldSignal;const player=createStepPlayer(async(next,{signal})=>{played.push(next.version);if(next.version===9){oldSignal=signal;await new Promise(r=>signal.addEventListener('abort',r,{once:true}));}},{onError:e=>errors.push(e)});
 player.push({version:9});player.push({version:10});player.reset();player.push({version:1});for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
 assert.equal(oldSignal.aborted,true);assert.deepEqual(played,[9,1]);assert.equal(errors.length,0);assert.equal(player.busy,false);
});
test('the night deck keeps bright faces and a dark back for red, black and court cards',async()=>{
 const context={};context.window=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../public/assets/js/baloot-cards.js',import.meta.url),'utf8'),context);
 for(const card of ['AS','7C','TH','9D','KS','QH']){const svg=context.BS_CARDS.face(card,'deck-night');assert.match(svg,/#fffef8/);assert.match(svg,card.endsWith('H')||card.endsWith('D')?/#b91d38/:/#15283f/);}
 assert.match(context.BS_CARDS.back('deck-night'),/#0b0d14/);
});
