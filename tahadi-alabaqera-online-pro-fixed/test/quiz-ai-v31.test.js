import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import {CATEGORIES} from '../src/questions.js';
import {AI_SUBJECTS,aiQuestion,aiCategory,aiDistractors} from '../src/quiz/ai-subjects.js';
import {QuizImageBank,QUIZ_AI_OBJECT,nextAiSubject} from '../src/quiz/ai-bank.js';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
const Worker=await import('../src/index.js'),{GameRoom}=Worker;

const webp=(size=96)=>{const b=new Uint8Array(size);b.set([82,73,70,70],0);b.set([87,69,66,80],8);for(let i=12;i<size;i++)b[i]=i%251;return b;};
class Store{constructor(){this.map=new Map();}async get(k){if(Array.isArray(k))return new Map(k.filter(x=>this.map.has(x)).map(x=>[x,structuredClone(this.map.get(x))]));return structuredClone(this.map.get(k));}async put(k,v){if(k&&typeof k==='object'){for(const [a,b] of Object.entries(k))this.map.set(a,structuredClone(b));}else this.map.set(k,structuredClone(v));}async delete(k){for(const x of [].concat(k))this.map.delete(x);}async setAlarm(){}}
const bank=(env={AI_IMAGE_API_KEY:'test'},generate=async(_env,s)=>({bytes:webp(150000).buffer,subject:s.id}))=>{const ctx={storage:new Store()};return {ctx,bank:new QuizImageBank(ctx,env,{generate})};};
const post=(path,body,owner=true)=>new Request('https://quizai.internal'+path,{method:'POST',headers:owner?{'x-bs-owner':'1'}:{},body:JSON.stringify(body||{})});

test('zoom pictures are answered with the plain name of the thing',()=>{
 const zoom=CATEGORIES.find(c=>c.id==='zoom');
 for(const q of zoom.questions){assert.ok(q.a.split(/\s+/).length<=2,q.id+' '+q.a);assert.doesNotMatch(q.a,/نقوش|تفاصيل|هيكل|سطح|شفرات|أوعية|منصة|بدلة|خوذة|مركز|جسم|محرك|عجلة|مصباح/,q.id);assert.equal(q.q,'وش اللي في الصورة؟');}
 assert.deepEqual([...new Set(zoom.questions.filter(q=>q.mediaFamily==='image:cheetah').map(q=>q.a))],['فهد']);
 for(const q of zoom.questions)assert.ok(!q.distractors.includes(q.a),q.id);
});

test('AI subjects have short answers and choices from the same group',()=>{
 assert.equal(new Set(AI_SUBJECTS.map(s=>s.id)).size,AI_SUBJECTS.length);assert.equal(new Set(AI_SUBJECTS.map(s=>s.a)).size,AI_SUBJECTS.length);
 for(const s of AI_SUBJECTS){assert.ok(s.a.split(/\s+/).length<=2,s.a);const d=aiDistractors(s);assert.equal(new Set([s.a,...d]).size,4);for(const x of d)assert.equal(AI_SUBJECTS.find(o=>o.a===x).group,s.group);assert.deepEqual(aiDistractors(s),d,'stable choices');}
 const q=aiQuestion(AI_SUBJECTS[0],123);assert.equal(q.media,'zoom');assert.equal(q.generated,true);assert.match(q.credit,/مولّدة/);assert.match(q.src,/^\/api\/quiz\/ai\/image\/cheetah\.webp\?v=/);assert.ok(q.zoom>q.hintZoom);
 const two=AI_SUBJECTS.filter(s=>s.level===1).slice(0,2).concat(AI_SUBJECTS.filter(s=>s.level===2).slice(0,2),AI_SUBJECTS.filter(s=>s.level===3).slice(0,1)).map(s=>aiQuestion(s,1));
 assert.equal(aiCategory(two),null,'five pictures are not enough');
 assert.equal(aiCategory([...two,aiQuestion(AI_SUBJECTS.filter(s=>s.level===3)[1],1)]).questions.length,6);
});

test('only the manager can generate; pictures are stored in parts and served byte for byte',async()=>{
 const {bank:b,ctx}=bank();
 assert.equal((await b.fetch(post('/generate',{},false))).status,403);
 const res=await b.fetch(post('/generate'));assert.equal(res.status,200);const pack=await res.json();
 assert.equal(pack.ready,1);assert.equal(pack.items[0].a,AI_SUBJECTS[0].a);assert.equal(pack.usedToday,1);assert.equal(pack.category,false);
 assert.equal([...ctx.storage.map.keys()].filter(k=>k.startsWith('quizai:img:')).length,3,'150 KB is kept as three parts');
 const image=await b.fetch(new Request('https://quizai.internal/image?id='+AI_SUBJECTS[0].id));assert.equal(image.headers.get('content-type'),'image/webp');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),webp(150000));
 assert.equal((await b.fetch(new Request('https://quizai.internal/image?id=../x'))).status,404);
 const removed=await(await b.fetch(post('/remove',{id:AI_SUBJECTS[0].id}))).json();assert.equal(removed.ready,0);assert.equal([...ctx.storage.map.keys()].filter(k=>k.startsWith('quizai:img:')).length,0);
});

test('the daily limit, a failed generation and a missing key never cost a picture',async()=>{
 const {bank:off}=bank({});assert.equal((await off.fetch(post('/generate'))).status,503);
 let fail=true;const {bank:b}=bank({AI_IMAGE_API_KEY:'k',AI_QUIZ_DAILY_LIMIT:'2'},async(_e,s)=>{if(fail){fail=false;throw new Error('provider down');}return {bytes:webp().buffer,subject:s.id};});
 assert.equal((await b.fetch(post('/generate'))).status,502);assert.equal((await(await b.fetch(new Request('https://quizai.internal/pack'))).json()).usedToday,0,'refunded');
 assert.equal((await b.fetch(post('/generate'))).status,200);assert.equal((await b.fetch(post('/generate'))).status,200);
 const limited=await b.fetch(post('/generate'));assert.equal(limited.status,429);assert.equal((await limited.json()).error,'daily_limit');
});

test('the Worker lets only the signed-in manager generate and serves the pack to everyone',async()=>{
 const env=environment();env.AI_IMAGE_API_KEY='k';
 const player=await signup(env,'playera');
 assert.equal((await api(env,'/api/quiz/ai/generate',{})).response.status,401);
 assert.equal((await api(env,'/api/quiz/ai/generate',{},player.data.token)).response.status,403);
 const forged=await api(env,'/api/quiz/ai/pack');assert.equal(forged.response.status,200,JSON.stringify(forged.data));assert.equal(forged.data.ready,0);assert.equal(forged.data.enabled,true);
 const owner=await signup(env,'bosrag'),original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({data:[{b64_json:Buffer.from(webp(4000)).toString('base64')}]}));
 try{const made=await api(env,'/api/quiz/ai/generate',{},owner.data.token);assert.equal(made.response.status,200,JSON.stringify(made.data));assert.equal(made.data.ready,1);}
 finally{globalThis.fetch=original;}
 const image=await Worker.default.fetch(new Request('https://game.test/api/quiz/ai/image/'+AI_SUBJECTS[0].id+'.webp',{headers:{'CF-Connecting-IP':'127.0.0.9'}}),env);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/webp');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),webp(4000));
});

test('an online quiz room offers the AI category once the bank is balanced and plans its questions',async()=>{
 const env=environment(),entry=env.BOARD_ROOMS.peek(QUIZ_AI_OBJECT);await entry.ctx.ready;
 const index={},pick=[...AI_SUBJECTS.filter(s=>s.level===1).slice(0,2),...AI_SUBJECTS.filter(s=>s.level===2).slice(0,2),...AI_SUBJECTS.filter(s=>s.level===3).slice(0,2)];
 for(const s of pick)index[s.id]={at:1,length:10,chunks:1};await entry.ctx.storage.put('quizai:index',index);
 const game=Object.create(GameRoom.prototype);game.env=env;game.ctx={storage:new Store(),getWebSockets:()=>[]};game.aiPack=null;
 await game.loadAiPack();
 assert.ok(game.hasCategory('aiPictures'));assert.ok(game.categoryList().some(c=>c.id==='aiPictures'&&c.name==='صور الذكاء'));
 const cat=game.extraCategories().get('aiPictures');assert.equal(cat.questions.length,6);assert.ok(cat.questions.every(q=>q.src.startsWith('/api/quiz/ai/image/')));
 delete index[pick[5].id];await entry.ctx.storage.put('quizai:index',index);await game.loadAiPack();assert.equal(game.hasCategory('aiPictures'),false);
});

test('the quiz hub shows saved AI pictures at once and asks the server at most every ten minutes',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/assets/quiz-catalog.json',import.meta.url),'utf8'));
 const items=[1,1,2,2,3,3].map((level,i)=>aiQuestion(AI_SUBJECTS.filter(s=>s.level===level)[i%2],1));let asked=0;
 const hub=async saved=>{const d=await createDOM('quiz.html',{fetch:async url=>{if(String(url).includes('/api/quiz/ai/pack')){asked++;return Response.json({ok:true,items});}return Response.json(catalog);}});
  d.storage.set('bs-quiz-ai-pack-v31',JSON.stringify(saved));vm.runInContext(await readFile(new URL('../public/assets/js/quiz-hub.js',import.meta.url),'utf8'),d.context);await new Promise(r=>setTimeout(r,20));return d;};
 const fresh=await hub({at:Date.now(),items});
 assert.equal(asked,0,'a fresh copy needs no request');assert.match(fresh.doc.getElementById('quizCatalog').textContent,/صور الذكاء/);
 const stale=await hub({at:Date.now()-11*60000,items:[]});
 assert.equal(asked,1);assert.match(stale.doc.getElementById('quizCatalog').textContent,/صور الذكاء/);assert.equal(JSON.parse(stale.storage.get('bs-quiz-ai-pack-v31')).items.length,6);
});

test('six pictures in a row already open the category, spread over levels and groups',async()=>{
 const {bank:b}=bank({AI_IMAGE_API_KEY:'k'},async(_e,s)=>({bytes:webp().buffer,subject:s.id}));let pack;
 for(let i=0;i<6;i++){const res=await b.fetch(post('/generate'));assert.equal(res.status,200);pack=await res.json();}
 assert.equal(pack.category,true);for(const v of [100,200,300])assert.equal(pack.items.filter(q=>q.v===v).length,2,'level '+v);
 const groups=new Set(pack.items.map(q=>AI_SUBJECTS.find(s=>'ai-pic-'+s.id===q.id).group));assert.ok(groups.size>=4,[...groups].join());
 const all={};for(const s of AI_SUBJECTS)all[s.id]={at:1};assert.equal(nextAiSubject(all),null);
});
