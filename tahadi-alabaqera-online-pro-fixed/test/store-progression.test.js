import test from 'node:test';
import assert from 'node:assert/strict';
import {Career} from '../src/career/core.js';
const now=Date.parse('2026-10-12T12:00:00Z');
function play(p,count,{win=true,verified=false,game='snakes',time=now}={}){
 for(let i=0;i<count;i++)p=Career.reward(p,{id:game+':'+time+':'+i,game,win,verified,now:time});
 return p;
}
test('old inventories migrate without losing balances, stats or equipped items',()=>{
 const p=Career.normalize({version:7,coins:777,xp:1234,games:8,owned:['dice-copper'],equipped:{dice:'dice-copper'},role:'owner',permissions:['*']});
 assert.equal(p.coins,777);assert.equal(p.xp,1234);assert.equal(p.games,8);assert.equal(p.equipped.dice,'dice-copper');
 assert.equal(p.equipped.trail,'trail-none');assert.equal(p.equipped.victory,'victory-classic');assert.equal(p.role,undefined);
 assert.equal(p.owned.includes('title-legend'),false);
});
test('mission progress follows credited receipts and daily practice caps',()=>{
 let p=play(Career.normalize(),3);p=Career.reward(p,{id:'snakes:'+now+':0',game:'snakes',win:true,now});
 const mission=Career.objectives(p,{now}).find(x=>x.id==='daily-play');assert.equal(mission.current,3);assert.equal(mission.ready,true);
 const before=p.coins;p=Career.claimObjective(p,'daily-play',{now});assert.equal(p.coins,before+30);
 assert.equal(Career.claimObjective(p,'daily-play',{now}).coins,p.coins);
 p=play(p,30);assert.equal(p.games,20);assert.equal(Career.objectives(p,{now}).find(x=>x.id==='daily-play').current,20);
 assert.throws(()=>Career.claimObjective({},'weekly-play',{now}),/objective_incomplete/);
});
test('daily and weekly mission periods reset at Riyadh boundaries while achievements persist',()=>{
 let p=play({},3);p=Career.claimObjective(p,'daily-play',{now});p=Career.claimObjective(p,'first-win',{now});
 const tomorrow=now+86400000,rows=Career.objectives(p,{now:tomorrow});
 assert.equal(rows.find(x=>x.id==='daily-play').current,0);assert.equal(rows.find(x=>x.id==='daily-play').claimed,false);
 assert.equal(rows.find(x=>x.id==='weekly-play').current,3);assert.equal(rows.find(x=>x.id==='first-win').claimed,true);
 assert.equal(Career.objectives(p,{now:now+7*86400000}).find(x=>x.id==='weekly-play').current,0);
 const boundary=Date.parse('2026-10-12T21:00:00Z');assert.equal(Career.riyadhDay(boundary),'2026-10-13');
});
test('online missions require server-verified results and capped practice cannot advance them',()=>{
 let p=play({},3);assert.equal(Career.objectives(p,{now}).find(x=>x.id==='weekly-online').current,0);
 p=play(p,3,{verified:true,game:'jackaroo'});const before=p.coins;
 p=Career.claimObjective(p,'weekly-online',{now});assert.equal(p.coins,before+160);
});
test('bundles charge only discounted missing items and repeated purchases never charge again',()=>{
 const bundle=Career.BUNDLES.find(x=>x.id==='royal-set'),start=Career.normalize({coins:5000,owned:['pawn-gold']});
 const price=Career.bundleQuote(start,bundle.id,{now});assert.equal(price.missing.includes('pawn-gold'),false);assert.ok(price.saving>0);
 const p=Career.purchaseBundle(start,bundle.id,{now});assert.equal(p.coins,start.coins-price.price);
 for(const id of bundle.items){assert.ok(p.owned.includes(id));const item=Career.CATALOG.find(x=>x.id===id);assert.equal(p.equipped[item.type],id)}
 assert.equal(Career.purchaseBundle(p,bundle.id,{now}).coins,p.coins);
 assert.throws(()=>Career.purchaseBundle({coins:0},bundle.id,{now}),/insufficient_coins/);
});
test('exclusive achievement cosmetics must be earned and cannot be bought for zero coins',()=>{
 assert.throws(()=>Career.purchase({coins:9999},'title-legend',{now}),/item_locked/);
 let p=Career.normalize({games:50});p=Career.claimObjective(p,'fifty-games',{now});assert.ok(p.owned.includes('title-legend'));
 assert.equal(Career.equip(p,'title-legend').equipped.title,'title-legend');
});
test('a changed price never silently debits more coins than the displayed quote',()=>{
 const offer=Career.dailyOffer(now);assert.throws(()=>Career.purchase({coins:5000},offer.id,{now,expectedPrice:offer.price-1}),/price_changed/);
 const bundle=Career.BUNDLES[0],quote=Career.bundleQuote({coins:5000},bundle.id,{now});assert.throws(()=>Career.purchaseBundle({coins:5000},bundle.id,{now,expectedPrice:quote.price-1}),/price_changed/);
});
test('the daily practice cap and missions both roll over at midnight in Riyadh',()=>{
 const before=Date.parse('2026-10-12T20:59:59Z'),after=before+1000;
 let p=play({},20,{time:before});assert.equal(p.practiceCount,20);
 p=Career.reward(p,{id:'midnight:new',game:'snakes',win:true,now:after});assert.equal(p.practiceCount,1);assert.equal(p.games,21);assert.equal(Career.objectives(p,{now:after}).find(x=>x.id==='daily-play').current,1);
});
