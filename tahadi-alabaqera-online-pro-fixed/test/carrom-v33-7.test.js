import test from 'node:test';
import assert from 'node:assert/strict';
import {createCarrom,placeStriker,shootCarrom,stepCarrom,settleCarrom,chooseCarromShot,carromScore,FIXED_DT} from '../public/assets/js/carrom/engine.js';
const own=(s,p)=>s.coins.filter(c=>c.kind===(p?'dark':'light'));
function shot(s,captured=[],foul=false){
 s.phase='moving';s.shot={seat:s.turn,captured,foul,ownBefore:carromScore(s)[s.turn].coins,queenBefore:s.queen.pending,quiet:0,elapsed:0};
 for(const id of captured)s.coins.find(c=>c.id===id).pocketed=true;
}
function rest(s){let n=0;while(s.phase==='moving'&&n++<1600)stepCarrom(s,FIXED_DT);assert.notEqual(s.phase,'moving');}
test('the board starts with nine coins each, a queen and a separate striker',()=>{
 const s=createCarrom();assert.equal(s.coins.length,19);assert.equal(own(s,0).length,9);assert.equal(own(s,1).length,9);
 assert.equal(new Set(s.coins.map(c=>c.id)).size,19);assert.equal(s.phase,'aim');
});
test('invalid and repeated shots cannot mutate or double-fire the state',()=>{
 const s=createCarrom(),before=structuredClone(s);
 assert.throws(()=>shootCarrom(s,{angle:NaN,power:.5}));assert.deepEqual(s,before);
 shootCarrom(s,{angle:-Math.PI/2,power:.7});const running=structuredClone(s);
 assert.throws(()=>shootCarrom(s,{angle:0,power:.5}));assert.deepEqual(s,running);
});
test('a real break conserves coins, moves them and stops without NaN or escaped bodies',()=>{
 const a=createCarrom({seed:5}),b=createCarrom({seed:5});
 for(const s of [a,b]){shootCarrom(s,{angle:-Math.PI/2,power:.8});rest(s);}
 assert.deepEqual(a,b);assert.equal(a.coins.length,19);
 assert.ok(a.coins.some(c=>Math.hypot(c.x-500,c.y-500)>120));
 for(const c of a.coins)if(!c.pocketed){assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));assert.ok(c.x>=45&&c.x<=955&&c.y>=45&&c.y<=955);}
});
test('legal placement avoids a coin on the baseline',()=>{
 const s=createCarrom();Object.assign(s.coins[1],{x:500,y:825});
 assert.equal(placeStriker(s,500),true);assert.notEqual(s.striker.x,500);
 assert.ok(Math.hypot(s.striker.x-500,s.striker.y-825)>s.striker.r+s.coins[1].r);
});
test('own pockets keep the turn, misses switch it and opposing pockets benefit their owner',()=>{
 const s=createCarrom(),light=own(s,0)[0],dark=own(s,1)[0];
 shot(s,[light.id]);settleCarrom(s);assert.equal(s.turn,0);assert.equal(carromScore(s)[0].coins,1);
 shot(s,[dark.id]);settleCarrom(s);assert.equal(s.turn,1);assert.equal(carromScore(s)[1].coins,1);
});
test('queen needs a previous own coin and one subsequent cover, or returns',()=>{
 const s=createCarrom();own(s,0)[0].pocketed=true;
 shot(s,['queen']);settleCarrom(s);assert.equal(s.queen.pending,0);assert.equal(s.turn,0);
 const cover=own(s,0)[1];shot(s,[cover.id]);settleCarrom(s);
 assert.equal(s.queen.status,'covered');assert.equal(s.queen.owner,0);
 const missed=createCarrom();own(missed,0)[0].pocketed=true;
 shot(missed,['queen']);settleCarrom(missed);shot(missed);settleCarrom(missed);
 assert.equal(missed.queen.status,'board');assert.equal(missed.coins[0].pocketed,false);
});
test('striker fouls return a coin, and unpaid dues are recovered on the next capture',()=>{
 const s=createCarrom();shot(s,[],true);settleCarrom(s);assert.equal(s.due[0],1);assert.equal(s.turn,1);
 shot(s);settleCarrom(s);const c=own(s,0)[0];shot(s,[c.id]);settleCarrom(s);
 assert.equal(s.due[0],0);assert.equal(c.pocketed,false);
});
test('the last coin cannot finish before the queen is covered',()=>{
 const s=createCarrom(),coins=own(s,0);coins.slice(0,8).forEach(c=>c.pocketed=true);
 shot(s,[coins[8].id]);settleCarrom(s);assert.equal(s.winner,null);assert.equal(carromScore(s)[0].coins,8);
 s.queen={status:'covered',owner:0,pending:null};s.coins[0].pocketed=true;
 shot(s,[coins.find(c=>!c.pocketed).id]);settleCarrom(s);assert.equal(s.winner,0);assert.equal(s.phase,'finished');
});
test('a coin returned to pay a due cannot also cover the queen',()=>{
 const s=createCarrom();own(s,0)[0].pocketed=true;
 shot(s,['queen']);settleCarrom(s);assert.equal(s.queen.pending,0);
 s.due[0]=1;shot(s,[own(s,0)[1].id]);settleCarrom(s);
 assert.equal(s.due[0],0);assert.equal(s.queen.status,'board');
 assert.equal(carromScore(s)[0].coins,1);
});
test('computer matches finish with a legal queen cover and all physical coins accounted for',()=>{
 for(const seed of [1,13,52]){
  const s=createCarrom({difficulty:'expert',seed});
  for(let i=0;i<100&&s.phase!=='finished';i++){
   const move=chooseCarromShot(s);assert.ok(move.power>=.08&&move.power<=1);
   placeStriker(s,move.x);shootCarrom(s,move);rest(s);
   for(const c of s.coins)assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));
  }
  assert.equal(s.phase,'finished');assert.equal(carromScore(s)[s.winner].coins,9);
  assert.equal(s.queen.status,'covered');assert.equal(s.coins.length,19);
 }
});
