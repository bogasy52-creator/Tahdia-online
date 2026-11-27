import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import {createRuntime} from './local-runtime-v26.mjs';

const runtime=await createRuntime();
const sockets=[];
function request(path,options){return runtime.mf.dispatchFetch(new URL(path,runtime.url),options);}
async function api(path,body,auth){
  const response=await request(path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+auth}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
async function connect(path,...protocols){
  const r=await request(path,{headers:{upgrade:'websocket','sec-websocket-protocol':protocols.join(', ')}});
  assert.equal(r.status,101,r.status===101?'':await r.text());
  const ws=r.webSocket, queue=[], listeners=new Set();sockets.push(ws);
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);queue.push(m);if(queue.length>200)queue.shift();for(const f of listeners)f();});ws.accept();
  const wait=pred=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{listeners.delete(check);reject(Error('socket timeout '+path+' '+JSON.stringify(queue.slice(-3))));},10000);
    function check(){const index=queue.findIndex(pred);if(index<0)return;listeners.delete(check);clearTimeout(timeout);resolve(queue.splice(index,1)[0]);}
    listeners.add(check);check();
  });
  return {ws,wait,send:(type,body)=>ws.send(JSON.stringify({type,...body}))};
}
try {
  async function signup(username){
    const a=await api('/api/social/signup',{username,displayName:username,password:'Local-testing-2026-empty'});
    assert.ok(a.data.token,JSON.stringify(a));return a.data.token;
  }
  const a=await signup('toweralice'),b=await signup('towerbob'),c=await signup('towercharlie');
  for(const [target,token]of [['towerbob',b],['towercharlie',c]]){
    assert.ok([200,201].includes((await api('/api/social/friends/request',{username:target},a)).status));
    assert.equal((await api('/api/social/friends/respond',{username:'toweralice',accept:true},token)).status,200);
  }
  const inbox=await connect('/api/social/ws','busraj-social-v1','st.'+b);
  await inbox.wait(m=>m.type==='social_welcome');
  const added=await api('/api/tower/rooms',{mode:'elim',capacity:3},a);
  assert.equal(added.status,200);
  const {code,hostKey}=added.data, path='/api/tower/rooms/'+code+'/ws';
  const host=await connect(path,'bs-tower-v1','st.'+a,'hk.'+hostKey);
  const hello=await host.wait(m=>m.type==='hello');
  const invite=await api('/api/social/invites',{username:'towerbob',game:'tower',roomCode:code},a);
  assert.equal(invite.status,200,JSON.stringify(invite));assert.equal(invite.data.invite.joinPath,'/tower?room='+code);
  assert.equal((await inbox.wait(m=>m.type==='notification'&&m.notification.id===invite.data.invite.id)).notification.read,false);
  assert.ok((await api('/api/social/me',undefined,b)).data.notifications.some(n=>n.id===invite.data.invite.id));
  assert.equal((await api('/api/social/invites/check',{game:'tower',roomCode:code},b)).status,200);
  const page=await request(invite.data.invite.joinPath);assert.equal(page.status,200);assert.match(await page.text(),/twCanvas/);
  const bob=await connect(path,'bs-tower-v1','st.'+b);
  const blue=await bob.wait(m=>m.type==='hello');
  bob.ws.close(1000,'network');
  await host.wait(m=>m.type==='state'&&m.state.players.some(p=>p.id===blue.id&&!p.connected));
  const back=await connect(path,'bs-tower-v1','rt.'+blue.token,'st.'+b);
  assert.equal((await back.wait(m=>m.type==='hello')).id,blue.id);
  await host.wait(m=>m.type==='state'&&m.state.players.filter(p=>p.connected).length===2);
  host.send('start');
  const race=(await host.wait(m=>m.type==='state'&&m.state.status==='playing')).state;
  assert.equal(race.players.length,2);assert.equal(race.mode,'elim');
  back.send('pos',{x:0,y:0,z:1,ry:0,a:1,cp:0});
  await host.wait(m=>m.type==='snap'&&m.p.some(p=>p[0]===blue.id&&p[3]===1));
  back.ws.close(1000,'network');
  const raceBack=await connect(path,'bs-tower-v1','st.'+b,'rt.'+blue.token);
  const returned=await raceBack.wait(m=>m.type==='hello');
  assert.equal(returned.id,blue.id);assert.equal(returned.resume.pos[2],1);assert.equal(returned.resume.match,race.match);
  for(const endpoint of ['/api/social/invites','/api/social/invites/check'])assert.equal((await api(endpoint,{username:'towercharlie',game:'tower',roomCode:code},a)).status,409);
  assert.equal((await api('/api/social/invites/check',{game:'tower',roomCode:code})).status,401);
  assert.equal((await api('/api/social/invites/check',{game:'tower',roomCode:'000000'},b)).status,404);
  assert.equal(hello.resume,null);
  console.log('Tower: real invite, red inbox delivery source, actual route, joins, short lobby and in-race reconnect, closed-room errors');

  // 33.21.0: «عشر ثواني» has live rooms of its own (codes 03xxxx); its page opens them instead of «الغرف»
  {
    const made=await api('/api/ten/rooms',{capacity:4},a);assert.equal(made.status,200,JSON.stringify(made));assert.match(made.data.code,/^03\d{4}$/);
    const code=made.data.code,path='/api/ten/rooms/'+code+'/ws?name=Host';
    const resolved=await api('/api/rooms/resolve/'+code);
    assert.equal(resolved.status,200);
    assert.equal(resolved.data.page,'/ten');
    const note=await api('/api/social/invites',{username:'towercharlie',game:'ten',roomCode:code},a);
    assert.equal(note.status,200,JSON.stringify(note));assert.equal(note.data.invite.joinPath,'/ten?room='+code);
    assert.equal((await api('/api/social/invites/check',{game:'ten',roomCode:code},c)).status,200);
    assert.equal((await request(note.data.invite.joinPath)).status,200);
    const host=await connect(path,'bs-ten-v1','hk.'+made.data.hostKey,'st.'+a);
    const ownerReceipt=await host.wait(m=>m.type==='hello');
    const guestPath='/api/ten/rooms/'+code+'/ws?name=Guest';
    const guest=await connect(guestPath,'bs-ten-v1','st.'+c);
    const guestReceipt=await guest.wait(m=>m.type==='hello');
    const lobby=await host.wait(m=>m.type==='state'&&m.state.players.length===2);assert.equal(lobby.state.status,'lobby');
    host.send('start');
    const counting=await guest.wait(m=>m.type==='state'&&m.state.status==='count');
    assert.equal(counting.state.players.length,2,'a friends room is only the friends');assert.ok(counting.state.goIn>0);
    assert.equal((await api('/api/social/invites/check',{game:'ten',roomCode:code},c)).status,409);
    assert.equal((await request('/api/ten/rooms/'+code+'/ws?name=Late',{headers:{upgrade:'websocket','sec-websocket-protocol':'bs-ten-v1'}})).status,409);
    const quick=await api('/api/ten/quick',{},undefined);assert.equal(quick.status,200,JSON.stringify(quick));assert.match(quick.data.code,/^03\d{4}$/);
    const page=await (await request('/ten')).text();assert.match(page,/id="tsFriendsBtn"/);assert.match(page,/id="tsOnlineBtn"/);
    guest.ws.close(1000,'reconnect test');
    const returned=await connect(guestPath,'bs-ten-v1','st.'+c,'rt.'+guestReceipt.token);
    assert.equal((await returned.wait(m=>m.type==='hello')).id,guestReceipt.id);
    const resumed=(await returned.wait(m=>m.type==='state'&&m.state.round===counting.state.round)).state;
    assert.equal(resumed.match,counting.state.match);
    await sleep(Math.max(0,resumed.goIn)+1000);
    host.send('stop',{round:resumed.round,ms:1000});
    await host.wait(m=>m.type==='state'&&m.state.players.some(p=>p.id===ownerReceipt.id&&p.last!==null));
    await returned.wait(m=>m.type==='state'&&m.state.status==='run'&&m.state.players.every(p=>p.last===null));
    returned.send('stop',{round:resumed.round,ms:1000});
    const final=(await host.wait(m=>m.type==='state'&&m.state.status==='finished')).state;
    assert.equal(final.players.length,2);
    assert.equal(final.players.filter(p=>p.place===1).length,1);
    console.log('Ten: live friends room, room-code resolution, invitation, reconnect, and the result shared by both players');
  }
  for(const game of ['blocks']){
    const party=await api('/api/party/rooms',{capacity:4,playlist:[{game}]},a);
    assert.ok(party.data.code,JSON.stringify(party));
    const sent=await api('/api/social/invites',{username:'towercharlie',game:'party',roomCode:party.data.code},a);
    assert.equal(sent.status,200,JSON.stringify(sent));assert.equal(sent.data.invite.joinPath,'/party?room='+party.data.code);
    assert.equal((await api('/api/social/invites/check',{game:'party',roomCode:party.data.code},c)).status,200);
    const direct=await api('/api/social/invites',{username:'towerbob',game},a);assert.equal(direct.status,200);assert.equal(direct.data.invite.joinPath,'/'+game);
    assert.match(await (await request(direct.data.invite.joinPath)).text(),new RegExp('/party\\?game='+game));
  }
  console.log('Blocks: create a real party room, invite and validate its code, the direct page links to the group room');
  const uno=await api('/api/challenges/rooms',{game:'chaos',capacity:4},a);assert.ok(uno.data.code,JSON.stringify(uno));
  const unoInvite=await api('/api/social/invites',{username:'towercharlie',game:'uno',roomCode:uno.data.code},a);
  assert.equal(unoInvite.status,200,JSON.stringify(unoInvite));assert.equal(unoInvite.data.invite.joinPath,'/chaos?room='+uno.data.code);
  assert.equal((await api('/api/social/invites/check',{game:'chaos',roomCode:uno.data.code},c)).status,200);
  assert.equal((await request(unoInvite.data.invite.joinPath)).status,200);
  assert.equal((await api('/api/social/invites/check',{game:'quiz',roomCode:uno.data.code},c)).status,404);
  for(const [alias,base,canonical,limit]of [['ludo','zahra','ludo',4],['race','carrom','race',2],['pegs','pegs','pegs',4],['jewels','jewels','jewels',2],['billiards','billiards','billiards',2]]){
    const made=await api('/api/board/rooms',{game:base,name:'Host',playerLimit:limit,variant:base==='zahra'?'ludo':'classic'},a);assert.ok(made.data.code,JSON.stringify(made));
    const note=await api('/api/social/invites',{username:'towercharlie',game:alias,roomCode:made.data.code},a);
    assert.equal(note.status,200,JSON.stringify(note));assert.equal(note.data.invite.joinPath,'/'+canonical+'?room='+made.data.code);
    assert.equal((await api('/api/social/invites/check',{game:base,roomCode:made.data.code},c)).status,200);
    assert.equal((await request(note.data.invite.joinPath)).status,200);
  }
  console.log('Uno + Ludo + Carrom + Pegs + Jewels + Pool: real room codes and canonical pages');

  async function startParty(game, mode) {
    const created = await api('/api/party/rooms', { capacity: 2, playlist: [{ game, mode, seats: 2 }] }, a);
    assert.equal(created.status, 200, JSON.stringify(created));
    const { code, hostKey } = created.data;
    const invite = await api('/api/social/invites', { username: 'towerbob', game: 'party', roomCode: code }, a);
    assert.equal(invite.status, 200, JSON.stringify(invite));
    assert.equal(invite.data.invite.joinPath, '/party?room=' + code);
    await inbox.wait(m => m.type === 'notification' && m.notification.id === invite.data.invite.id);
    const path = '/api/party/rooms/' + code + '/ws';
    const owner = await connect(path, 'tahdia-party-v29', 'st.' + a, 'hk.' + hostKey);
    await owner.wait(m => m.type === 'welcome');
    const guest = await connect(path, 'tahdia-party-v29', 'st.' + b);
    await guest.wait(m => m.type === 'welcome');
    owner.send('ready', { ready: true });
    guest.send('ready', { ready: true });
    await owner.wait(m => m.type === 'room' && m.state.players.length === 2 && m.state.players.every(p => p.ready));
    await sleep(80);
    owner.send('start');
    return owner;
  }

  const partyTen = await startParty('ten', 'classic');
  const tenRound = (await partyTen.wait(m => m.type === 'room' && m.state.round?.link?.status === 'open')).state.round;
  assert.equal(tenRound.local, undefined);
  assert.equal(tenRound.link.page, '/ten');
  const liveTenPath = '/api/ten/rooms/' + tenRound.link.list[0].code + '/ws';
  const liveTenA = await connect(liveTenPath, 'bs-ten-v1', 'st.' + a);
  const liveTenB = await connect(liveTenPath, 'bs-ten-v1', 'st.' + b);
  const tenStarted = (await liveTenA.wait(m => m.type === 'state' && m.state.status === 'count')).state;
  assert.deepEqual(tenStarted.players.filter(p => p.user).map(p => p.user).sort(), ['toweralice', 'towerbob']);
  assert.equal((await liveTenB.wait(m => m.type === 'state' && m.state.status === 'count')).state.code, tenStarted.code);
  console.log('Ten: the uploaded live engine resolves room codes, sends direct invitations, resumes a private game, and starts a shared party table');

  assert.equal((await api('/api/tower/rooms', { mode: 'teams', capacity: 3 }, a)).status, 400);
  const sprint = await startParty('tower', 'sprint');
  const { state: quick } = await sprint.wait(m => m.type === 'room' && m.state.round?.link?.status === 'open');
  const towerPath = '/api/tower/rooms/' + quick.round.link.list[0].code + '/ws';
  const runnerA = await connect(towerPath, 'bs-tower-v1', 'st.' + a);
  const runnerB = await connect(towerPath, 'bs-tower-v1', 'st.' + b);
  const receipt = await runnerA.wait(m => m.type === 'hello');
  const active = (await runnerA.wait(m => m.type === 'state' && m.state.status === 'playing')).state;
  assert.deepEqual([active.capacity, active.players.length, active.mode], [2, 2, 'sprint']);
  await sleep(Math.max(0, active.startAt - Date.now() + 150));
  runnerA.send('pos', { x: 0, y: 0, z: 1, ry: 0, a: 1, cp: 0 });
  await runnerB.wait(m => m.type === 'snap' && m.p.some(row => row[0] === receipt.id && row[3] === 1));
  runnerA.ws.close(1000, 'local network drop');
  runnerB.ws.close(1000, 'local network drop');
  await sleep(600);
  assert.equal((await api(towerPath.replace('/ws', '/status'))).data.status, 'playing');
  const backToTower = await connect(towerPath, 'bs-tower-v1', 'st.' + a, 'rt.' + receipt.token);
  const resumed = await backToTower.wait(m => m.type === 'hello');
  assert.equal(resumed.resume.match, active.match);
  assert.equal(resumed.resume.pos[2], 1);
  const world = await api('/api/tower/rooms', { mode: 'teams', capacity: 4, world: 'ice' }, a);
  const privateTower = await connect('/api/tower/rooms/' + world.data.code + '/ws', 'bs-tower-v1', 'st.' + a, 'hk.' + world.data.hostKey);
  assert.equal((await privateTower.wait(m => m.type === 'state')).state.world, 'ice');
  console.log('Tower: selected seats and sprint, simultaneous outage and private world');
}finally{for(const ws of sockets)try{ws.close(1000,'done')}catch{}await runtime.dispose();}
