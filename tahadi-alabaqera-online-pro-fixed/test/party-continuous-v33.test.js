import assert from 'node:assert/strict';
import test from 'node:test';
import { addPartyPlayer, advanceParty, applyLinkResult, createParty, finishPartyRound, openPartyLink, partySnapshot, startPartyRound } from '../src/party/party-engine.js';

function group(playlist) {
  const room = createParty({code:'123456',hostKey:'h'.repeat(40),links:true,continuous:true,playlist});
  for (const name of ['أول','ثاني']) addPartyPlayer(room,{name});
  room.roster = [...room.order];
  return room;
}

test('Jackaroo plays inside the party and the next round starts at five seconds', () => {
  const room=group(['jackaroo','memory']);
  startPartyRound(room,1000,42);
  assert.equal(room.round.link,undefined);
  assert.equal(room.round.tables[0].members.length,4);
  finishPartyRound(room,2000);
  assert.equal(room.nextAt,7000);
  advanceParty(room,6999);
  assert.equal(room.status,'intermission');
  advanceParty(room,7000);
  assert.equal(room.round.game,'memory');
});

test('an embedded race reserves private seats and scores their verified identities once', () => {
  const room=group(['chaos','memory']);
  const [first,second]=room.order;
  room.players[second].connected=false;
  startPartyRound(room,1000,43);
  openPartyLink(room,{code:'654321',page:'/chaos'},1100);
  const own=partySnapshot(room,first).round,other=partySnapshot(room,second).round;
  assert.equal(partySnapshot(room).round.linkSeat,undefined);
  assert.match(own.linkSeat,/^[a-f0-9]{64}$/);
  assert.match(other.linkSeat,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(own).includes(other.linkSeat),false);
  const report={round:room.round.id,game:'chaos',token:room.round.link.tables[0].token,standings:[{partyId:first,name:'changed',rank:1,score:10,won:true}]};
  assert.equal(applyLinkResult(room,{...report,game:'focus'},1900),false);
  assert.equal(applyLinkResult(room,report,2000),true);
  assert.ok(room.players[first].score>0);
  assert.equal(room.players[second].score,0);
  assert.equal(applyLinkResult(room,report,2001),false);
  assert.equal(room.nextAt,7000);
});
