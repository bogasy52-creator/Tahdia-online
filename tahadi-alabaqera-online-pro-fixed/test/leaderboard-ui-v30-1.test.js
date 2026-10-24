import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';

const players=[['bosrag','BoSraG',true],['fahad_7','فهد'],['noura','نورة'],['reem22','ريم'],['majed','ماجد']].map(([username,name,owner],i)=>({rank:i+1,username,name,owner:Boolean(owner),points:1500-i*200,wins:6-i,games:8}));
function payload(period,player,overrides={}){const now=Date.UTC(2026,9,24,9);return {ok:true,period,key:period==='week'?'2026-10-19':'2026-10',startsAt:now-86400000,endsAt:now+2*86400000+4*3600000+30000,serverNow:now,points:{win:250,play:80},players,me:player?players.find(p=>p.username===player)||{username:player,name:player,points:0,wins:0,games:0,rank:null}:null,previous:{key:'prev',players:players.slice(0,3)},...overrides};}
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};

async function page({session='',respond=(period,player)=>({status:200,body:payload(period,player)})}={}){
 const requests=[],globals={Intl,history:{replaceState(){}},fetch:async url=>{const u=new URL(url,'https://game.test');requests.push(u);const {status,body}=respond(u.searchParams.get('period'),u.searchParams.get('player'));return new Response(JSON.stringify(body),{status});}};
 const h=await createDOM('leaderboard.html',globals);if(session)h.storage.set('bs_social_session',session);
 await h.runFile('assets/js/leaderboard-v30-1.js');await settle();
 return {...h,requests,$:id=>h.doc.getElementById(id)};
}

test('the page is reachable from the home navigation, the shared shell and the offline list',async()=>{
 const read=path=>readFile(new URL('../public/'+path,import.meta.url),'utf8');
 const index=await read('index.html'),shell=await read('assets/js/tahdia-premium-v25.js'),html=await read('leaderboard.html');
 assert.match(index,/href="\/leaderboard"/);assert.match(shell,/'\/leaderboard','leaderboard'/);assert.match(shell,/shellRoutes = new Set\(\[[^\]]*'leaderboard'/);
 assert.match(html,/role="tablist"/);assert.match(html,/leaderboard-v30-1\.js/);assert.match(html,/tahdia-premium-v25\.css/);
});

test('a signed-in player sees the podium, the list, their own standing and last week champions',async()=>{
 const h=await page({session:'reem22.'+'x'.repeat(43)});
 assert.equal(h.requests[0].searchParams.get('period'),'week');assert.equal(h.requests[0].searchParams.get('player'),'reem22');
 const steps=h.$('lbPodium').children;assert.equal(steps.length,3);
 assert.deepEqual(steps.map(s=>s.dataset.rank),['1','2','3']);
 assert.match(steps[0].textContent,/BoSraG/);assert.match(steps[0].textContent,/المدير/);assert.match(steps[0].textContent,/١/);
 const rows=h.$('lbList').children;assert.equal(rows.length,2);assert.ok(rows[0].classList.contains('is-me'));assert.equal(rows[0].getAttribute('aria-current'),'true');
 assert.match(h.$('lbMe').textContent,/مركزك 4/);assert.equal(h.$('lbMe').hidden,false);
 assert.equal(h.$('lbPrevious').hidden,false);assert.equal(h.$('lbPrevList').children.length,3);
 assert.match(h.$('lbCountdown').textContent,/يومين و4 ساعات/);
 assert.equal(h.$('lbPanel').getAttribute('aria-busy'),'false');
});

test('guests are invited to sign in, and switching to the season reloads with the season period',async()=>{
 const h=await page();
 assert.equal(h.requests[0].searchParams.get('player'),null,'anonymous views use the cacheable request');
 assert.match(h.$('lbMe').textContent,/سجّل دخولك/);
 h.$('tabSeason').click();await settle();
 assert.equal(h.requests.at(-1).searchParams.get('period'),'season');
 assert.equal(h.$('tabSeason').getAttribute('aria-selected'),'true');assert.equal(h.$('tabWeek').getAttribute('aria-selected'),'false');
 assert.match(h.$('lbCountdown').textContent,/ينتهي الموسم/);assert.match(h.$('lbPrevTitle').textContent,/الموسم الماضي/);
});

test('an empty period shows open podium places and a way to start playing',async()=>{
 const h=await page({respond:p=>({status:200,body:payload(p,null,{players:[],previous:{key:'p',players:[]}})})});
 assert.equal(h.$('lbEmpty').hidden,false);assert.equal(h.$('lbPodium').children.length,3);
 assert.ok(h.$('lbPodium').children.every(step=>step.classList.contains('is-empty')));
 assert.equal(h.$('lbPrevious').hidden,true);
});

test('a player who has not played this week is told how to earn points',async()=>{
 const h=await page({session:'newbie.'+'x'.repeat(43)});
 assert.match(h.$('lbMe').textContent,/لم تلعب مباراة موثّقة هذا الأسبوع/);
});

test('server errors are explained and can be retried',async()=>{
 let fail=true;
 const h=await page({respond:p=>fail?{status:503,body:{ok:false,code:'DURABLE_REQUEST_LIMIT',error:'وصلت خدمة الأونلاين إلى حد الطلبات اليومي.'}}:{status:200,body:payload(p,null)}});
 assert.equal(h.$('lbError').hidden,false);assert.match(h.$('lbErrorText').textContent,/حد الطلبات/);
 fail=false;h.$('lbRetry').click();await settle();
 assert.equal(h.$('lbError').hidden,true);assert.equal(h.$('lbPodium').children.length,3);
});
