import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {environment} from './worker-harness.mjs';const {default:Worker}=await import('../src/index.js');
import {ChallengeRoom} from '../src/challenges/challenge-room.js';import {normalizeGame} from '../src/social/social-core.js';
import {PARTY_GAMES,normalizePlaylist} from '../public/assets/js/engines/party-catalog-v29.js';
import {createParty,addPartyPlayer,startPartyRound,retirePartyChallenges} from '../src/party/party-engine.js';
const removed=['labyrinth','territory','survival'];
for(const game of removed)test(game+': unavailable in menus, invitations, queues and old links',async()=>{
 const env=environment();for(const endpoint of ['rooms','quick']){const r=await Worker.fetch(new Request('https://game.test/api/challenges/'+endpoint,{method:'POST',headers:{origin:'https://game.test','content-type':'application/json'},body:JSON.stringify({game})}),env);assert.equal(r.status,400);}
 for(const path of ['/'+game,'/'+game+'.html']){const r=await Worker.fetch(new Request('https://game.test'+path),env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://game.test/#games');}
 assert.equal(normalizeGame(game),'');assert.ok(!PARTY_GAMES.some(p=>p.id===game));assert.throws(()=>normalizePlaylist([game]));
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(!home.includes('href="/'+game+'"'));for(const page of ['focus','cipher']){const html=await readFile(new URL('../public/'+page+'.html',import.meta.url),'utf8');assert.ok(!html.includes('href="/'+game+'"'));}
 const ctx={storage:{get:async()=>({game,code:'951234'}),deleteAlarm:async()=>{}},blockConcurrencyWhile:fn=>fn(),getWebSockets:()=>[]};const room=new ChallengeRoom(ctx,{});await room.ready;assert.equal((await room.fetch(new Request('https://challenge.internal/status'))).status,410);
});
test('old party rounds end without rewards and saved playlists advance to available games',()=>{
 const r=createParty({code:'151234',hostKey:'x'.repeat(40),playlist:['focus','memory'],links:true});addPartyPlayer(r,{name:'A'});addPartyPlayer(r,{name:'B'});r.roster=[...r.order];startPartyRound(r,100000,1);r.round.game='territory';r.playlist[0].game='territory';r.round.participants[r.order[0]].score=900;r.round.participants[r.order[0]].actions=3;
 assert.equal(retirePartyChallenges(r,101000),true);assert.equal(r.round,null);assert.equal(r.status,'intermission');assert.equal(r.playlist[0].game,'focus');assert.ok(r.history[0].aborted);assert.ok(r.order.every(id=>r.players[id].score===0&&r.players[id].wins===0));startPartyRound(r,r.nextAt,2);assert.equal(r.round.game,'memory');assert.equal(retirePartyChallenges(r),false);
});
