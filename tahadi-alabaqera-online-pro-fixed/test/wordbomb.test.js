// 33.5.0: «صيد الكلمات» replaces «قنبلة الكلمات» under the same game id, route and room codes.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import{readFile}from'node:fs/promises';
import{CHALLENGES,createChallenge,applyChallenge,advanceChallenge,challengeView,botAction,nextChallengeAlarm,FOCUS_MODES,focusAnswer,focusModeOf,upgradeFocus,upgradeChallenge,adjacent,edge}from'../public/assets/js/engines/challenge-core.js';
import{HUNT_THEMES,normalizeBombWord,huntLetters}from'../public/assets/js/engines/wordbank-ar.js';
import{HUNT_ROUNDS,HUNT_ROUND_MS,HUNT_BREAK_MS,HUNT_MISS_MS,HUNT_HINTS_MS,huntLine,huntLayout,huntPoints}from'../public/assets/js/engines/wordbomb-core.js';
import{roomCodeFor,gameOfCode,resolveRoomCode}from'../src/rooms/room-codes.js';
import{LINKED_GAMES,linkable}from'../src/party/party-link.js';
import{PARTY_GAMES}from'../public/assets/js/engines/party-catalog-v29.js';
import{createDOM}from'./dom-harness.mjs';
const ps=Array.from({length:20},(_,i)=>({id:'p'+i,name:'لاعب '+i})),start=100000;
function make(n=2,seed=2){return createChallenge('wordbomb',ps.slice(0,n),seed,start);}
const claim=(m,w,reverse=false)=>({round:m.hunt.round,from:reverse?w.cells.at(-1):w.cells[0],to:reverse?w.cells[0]:w.cells.at(-1)});
// a straight pick of three letters that spells none of the round's words
function wrongPick(m){const h=m.hunt;for(let a=0;a<h.size*h.size;a++)for(const b of [a+2,a+2*h.size]){const cells=huntLine(a,b,h.size);if(!cells||cells.length!==3)continue;const text=cells.map(c=>h.grid[c]).join('');if(!h.words.some(w=>w.word===text||w.word===[...text].reverse().join('')))return{round:h.round,from:a,to:b};}throw Error('no wrong pick');}
// the round ends when the listed words are found; the secret word (33.7.0) does not hold it up
function finishRound(m,at){for(const w of m.hunt.words)if(!w.by&&!w.secret)applyChallenge(m,'p0',claim(m,w),at);}

test('the theme bank: twenty-two themes of Arabic words that fit the board, spelled on it as in the list',()=>{
 // 33.7.0: eight more themes, and the board holds every word the way the list writes it (أسد، شاطئ، مرمى)
 assert.equal(HUNT_THEMES.length,22);
 for(const theme of HUNT_THEMES){assert.ok(theme.words.length>=11,theme.name);assert.equal(new Set(theme.words.map(w=>w.word)).size,theme.words.length,theme.name);
  for(const w of theme.words){assert.match(w.word,/^[ء-غف-ي]{3,6}$/,w.label);assert.equal(w.word,w.label);assert.equal(huntLetters(w.label),w.word);}}
 assert.ok(HUNT_THEMES.some(t=>t.words.some(w=>/[أإآؤئى]/.test(w.word))),'hamza and ى stay on the board');
 assert.equal(huntLetters('  أَسَـد '),'أسد');assert.equal(normalizeBombWord('  أَسَـد '),'اسد');assert.equal(normalizeBombWord('مرآة'),'مراة');assert.equal(normalizeBombWord(7),'');assert.equal(huntLetters(7),'');
});
test('a pick is a straight line in any of the eight directions, never bent or off the board',()=>{
 assert.deepEqual(huntLine(0,3,8),[0,1,2,3]);assert.deepEqual(huntLine(3,0,8),[3,2,1,0]);assert.deepEqual(huntLine(0,24,8),[0,8,16,24]);assert.deepEqual(huntLine(0,27,8),[0,9,18,27]);assert.deepEqual(huntLine(7,28,8),[7,14,21,28]);
 for(const [a,b] of [[0,0],[0,10],[0,17],[-1,3],[0,64],[0,1.5],['0',3]])assert.equal(huntLine(a,b,8),null,a+'→'+b);
 assert.equal(huntPoints('تين'),100);assert.equal(huntPoints('ليمون'),150);assert.equal(huntPoints('فراولة',true),350);
});
test('rooms of 2 to 20: a board of 8 or 9, six to eight words, each one spelled on a straight line',()=>{
 for(const [n,size,count] of [[2,8,6],[4,8,6],[5,8,7],[10,8,7],[11,9,8],[20,9,8]])for(let seed=0;seed<60;seed++){
  const m=make(n,seed),h=m.hunt;assert.equal(h.size,size);assert.equal(h.grid.length,size*size);assert.equal(h.words.filter(w=>!w.secret).length,count);assert.ok(h.words.filter(w=>w.secret).length<=1);assert.ok(h.grid.every(c=>/^[ء-غف-ي]$/.test(c)));
  assert.ok(m.players.every(p=>p.score===0&&p.words===0&&p.alive));assert.equal(h.words.filter(w=>w.golden).length,1);assert.ok(!h.words.find(w=>w.golden).secret,'the golden word is on the list');
  for(const w of h.words){assert.equal(w.cells.map(c=>h.grid[c]).join(''),w.word);assert.deepEqual(huntLine(w.cells[0],w.cells.at(-1),size),w.cells);const step=w.cells[1]-w.cells[0];assert.ok([1,size].includes(step),'the first round reads right to left or downwards');}
  for(const a of h.words)for(const b of h.words)if(a!==b)assert.ok(!a.word.includes(b.word)&&!a.word.includes([...b.word].reverse().join('')),'no word hides inside another');
 }
 assert.deepEqual(make(6,9).hunt.grid,make(6,9).hunt.grid,'a seed always deals the same board');
});
test('first finder takes the points; either direction counts; nobody scores the same word twice',()=>{
 const m=make(3),h=m.hunt,[a,b]=h.words;
 applyChallenge(m,'p1',claim(m,a,true),start+3000);
 assert.equal(a.by,'p1');assert.equal(m.players[1].score,a.points);assert.equal(m.players[1].words,1);assert.deepEqual(a.found,[...a.cells].reverse());
 assert.throws(()=>applyChallenge(m,'p2',claim(m,a),start+3100),/سبقك لها لاعب 1/);
 assert.throws(()=>applyChallenge(m,'p1',claim(m,a),start+3200),/لقيتها من قبل/);
 assert.equal(m.players[2].score,0);
 applyChallenge(m,'p2',claim(m,b),start+3300);assert.equal(m.players[2].score,b.points);assert.equal(h.recent.length,2);assert.equal(h.recent.at(-1).label,b.label);
});
test('a wrong pick holds its player for a moment; a bent or stale pick changes nothing',()=>{
 const m=make(2),h=m.hunt,w=h.words[0],v=m.version;
 applyChallenge(m,'p0',wrongPick(m),start+1000);
 assert.equal(h.wait.p0,start+1000+HUNT_MISS_MS);assert.equal(m.players[0].misses,1);assert.equal(m.players[0].score,0);assert.ok(m.version>v);
 assert.throws(()=>applyChallenge(m,'p0',claim(m,w),start+1500),/استنى ثانية/);
 applyChallenge(m,'p1',claim(m,w),start+1500);assert.equal(w.by,'p1','the other player is not held');
 const before=JSON.stringify(m);
 for(const action of [{round:0,from:0,to:10},{round:0,from:0,to:1},{round:1,from:h.words[1].cells[0],to:h.words[1].cells.at(-1)},{round:0,from:'0',to:3}])assert.throws(()=>applyChallenge(m,'p0',action,start+3000));
 assert.equal(JSON.stringify(m),before);
 applyChallenge(m,'p0',claim(m,h.words[1]),start+1000+HUNT_MISS_MS);assert.equal(h.words[1].by,'p0');
});
test('three rounds: a break between them, the diagonal from the second, hidden words with hints and double points in the last',()=>{
 const m=make(2,5),first=m.hunt.theme;
 finishRound(m,start+5000);assert.equal(m.hunt.phase,'break');assert.equal(m.hunt.nextAt,start+5000+HUNT_BREAK_MS);
 assert.throws(()=>applyChallenge(m,'p1',{round:0,from:0,to:2},start+5500),/الجولة الجاية/);
 assert.equal(nextChallengeAlarm(m,start+5100),m.hunt.nextAt);
 advanceChallenge(m,start+5000+HUNT_BREAK_MS);assert.equal(m.round,1);assert.equal(m.hunt.round,1);assert.equal(m.hunt.phase,'play');assert.notEqual(m.hunt.theme,first);
 let diagonal=0;for(let seed=0;seed<40;seed++){const x=make(4,seed);for(const w of huntLayout(x,1).words)if(w.cells[1]-w.cells[0]===x.hunt.size+1)diagonal++;}assert.ok(diagonal>20,'the second round adds the diagonal');
 // the second round runs out of time
 const second=m.hunt.startedAt;advanceChallenge(m,second+HUNT_ROUND_MS[1]);assert.equal(m.hunt.phase,'break');
 const view=challengeView(m,'p1',second+HUNT_ROUND_MS[1]+10);assert.ok(view.hunt.words.every(w=>Array.isArray(w.cells)),'the break shows where every word was');
 advanceChallenge(m,m.hunt.nextAt);const h=m.hunt;assert.equal(h.round,2);assert.equal(h.hidden,true);assert.equal(h.words.filter(w=>w.golden).length,0);
 for(const w of h.words)assert.equal(w.points,huntPoints(w.word,true));
 let v=challengeView(m,'p1',h.startedAt+10).hunt;assert.ok(v.words.every(w=>w.label===null&&w.cells===null&&w.mask.every(c=>c===null)));
 assert.equal(nextChallengeAlarm(m,h.startedAt+10),h.startedAt+HUNT_HINTS_MS[0]);
 const version=m.version;advanceChallenge(m,h.startedAt+HUNT_HINTS_MS[0]);assert.ok(m.version>version,'the hint reaches every screen');
 v=challengeView(m,'p1',h.startedAt+HUNT_HINTS_MS[0]).hunt;for(const [i,w] of v.words.entries())assert.deepEqual(w.mask,[...h.words[i].word].map((c,k)=>k===0?c:null));
 advanceChallenge(m,h.startedAt+HUNT_HINTS_MS[1]);v=challengeView(m,'p1',h.startedAt+HUNT_HINTS_MS[1]).hunt;for(const [i,w] of v.words.entries())assert.equal(w.mask.at(-1),h.words[i].word.at(-1));
 applyChallenge(m,'p1',claim(m,h.words[0]),h.startedAt+HUNT_HINTS_MS[1]+100);assert.equal(challengeView(m,'p0',h.startedAt+HUNT_HINTS_MS[1]+200).hunt.words[0].label,h.words[0].label,'a found word is shown to everyone');
 const total=m.players.map(p=>p.score);finishRound(m,h.startedAt+HUNT_HINTS_MS[1]+500);
 assert.equal(m.phase,'finished');assert.equal(m.hunt.phase,'done');assert.equal(m.players[0].score,total[0]+h.words.slice(1).reduce((s,w)=>s+w.points,0));assert.deepEqual(m.winners,['p0']);
 assert.throws(()=>applyChallenge(m,'p1',{round:2,from:0,to:2},h.startedAt+HUNT_HINTS_MS[1]+600),/الجولة انتهت/);
});
test('ties share the win and a silent match ends with every player on equal terms',()=>{
 const m=make(2,3);m.players[0].score=500;m.players[1].score=500;
 for(let i=0;i<HUNT_ROUNDS;i++){const h=m.hunt;advanceChallenge(m,h.deadline);if(m.phase==='playing')advanceChallenge(m,m.hunt.nextAt);}
 assert.equal(m.phase,'finished');assert.deepEqual(m.winners,['p0','p1']);
});
test('what a player sees: never an unfound word\'s place, nor another player\'s hold',()=>{
 const m=make(3,4);applyChallenge(m,'p0',claim(m,m.hunt.words[0]),start+2000);applyChallenge(m,'p1',wrongPick(m),start+2100);
 const mine=challengeView(m,'p1',start+2200),theirs=challengeView(m,'p2',start+2200);
 assert.ok(mine.hunt.words.slice(1).every(w=>w.cells===null));assert.deepEqual(theirs.hunt.words[0].cells,m.hunt.words[0].cells);
 assert.equal(mine.hunt.wait,start+2100+HUNT_MISS_MS);assert.equal(theirs.hunt.wait,0);assert.equal(theirs.hunt.miss,null);assert.ok(mine.hunt.miss.cells.length===3);
 const text=JSON.stringify(theirs);for(const w of m.hunt.words.slice(1))assert.ok(!text.includes(JSON.stringify(w.cells)),'no hidden positions in the snapshot');
 assert.ok(!('bomb'in theirs));assert.equal(theirs.hunt.found,1);assert.equal(theirs.players[0].words,1);
});
test('the computer opponent thinks first, finds real words and rests during the break',()=>{
 const m=createChallenge('wordbomb',[{id:'me',name:'أنا'},{id:'bot',name:'منافس',bot:true}],11,start),bot=m.players[1];
 assert.equal(botAction(m,'bot',start+1000),null);
 const at=bot.nextThink,a=botAction(m,'bot',at);assert.ok(a&&a.round===0);const w=m.hunt.words.find(w=>w.cells[0]===a.from&&w.cells.at(-1)===a.to);assert.ok(w,'a real word');
 assert.ok(bot.nextThink>=at+9000,'and then it thinks again');
 let t=start;while(m.phase==='playing'&&t<start+400000){t+=250;advanceChallenge(m,t);}
 assert.equal(m.phase,'finished');assert.ok(bot.words>=10&&bot.words<=HUNT_ROUNDS*6,'a steady pace: '+bot.words);
 const room=createChallenge('wordbomb',[{id:'me',name:'أنا'},{id:'b1',name:'1',bot:true},{id:'b2',name:'2',bot:true},{id:'b3',name:'3',bot:true}],11,start);for(const b of room.players.slice(1))assert.ok(b.nextThink-start>=2500+9000*1.7,'more opponents, each a little slower');
});
test('rooms saved by 33.4.0: a live «قنبلة الكلمات» starts over as a hunt; a finished one keeps its winners',()=>{
 const live=make(2,8);delete live.hunt;Object.assign(live,{prompt:'كت',usedWords:['كتاب'],accepted:3,turn:1,turnId:4,turnDeadline:start+5000});for(const p of live.players){p.hearts=2;p.score=300;}
 assert.ok(upgradeChallenge(live,start+1000));assert.equal(live.phase,'playing');assert.ok(live.hunt&&live.hunt.phase==='play');assert.ok(!('prompt'in live)&&!('usedWords'in live));assert.ok(live.players.every(p=>p.score===0&&!('hearts'in p)));
 assert.equal(upgradeChallenge(live,start+2000),false);
 const done=make(2,8);delete done.hunt;done.phase='finished';done.winners=['p1'];done.players[1].score=900;
 assert.ok(upgradeChallenge(done,start));assert.deepEqual(done.winners,['p1']);assert.equal(done.players[1].score,900);assert.equal(challengeView(done,'p0',start).hunt.phase,'done');
});
test('09 codes resolve to challenge namespace and group catalog supports twenty',async()=>{for(let i=0;i<30;i++){const code=roomCodeFor('wordbomb');assert.match(code,/^09\d{4}$/);assert.equal(gameOfCode(code),'wordbomb');}let name='';const env={ROOMS:{idFromName:n=>(name=n),get:()=>({fetch:async()=>Response.json({ok:true,game:'wordbomb'})})}};assert.deepEqual(await resolveRoomCode(env,'091234'),{game:'wordbomb',page:'/wordbomb'});assert.equal(name,'challenge:091234');assert.equal(LINKED_GAMES.wordbomb.max,20);assert.ok(linkable('wordbomb',20));assert.ok(PARTY_GAMES.some(g=>g.id==='wordbomb'));});
test('every focus challenge produces an unambiguous correct choice with no idle points',()=>{for(let seed=0;seed<30;seed++){const m=createChallenge('focus',ps.slice(0,2),seed,start),modes=new Set();for(let round=0;round<12;round++){const t=m.task;modes.add(t.type);assert.notEqual(t.type,'hold');const answer=focusAnswer(t);if(t.type==='count')assert.equal(t.dots.filter(x=>x===t.target).length,t.options[answer]);if(t.type==='max')assert.equal(t.options[answer],Math.max(...t.options));if(t.type==='sum')assert.equal(t.options[answer],t.left+t.right);if(t.type==='match')assert.equal(t.options[answer],t.pattern);if(t.options)assert.equal(new Set(t.options).size,4);if(t.type==='majority'){const c=[0,1,2,3].map(d=>t.arrows.filter(x=>x===d).length);assert.equal(c.indexOf(Math.max(...c)),answer);assert.equal(c.filter(x=>x===Math.max(...c)).length,1);}if(t.type==='dots')assert.equal(t.options[answer],Math.max(...t.options));applyChallenge(m,'p0',t.type==='sequence'?{round,values:answer}:{round,choice:answer},t.opensAt+200);advanceChallenge(m,t.deadline);}assert.equal(modes.size,12,'twelve distinct challenges');assert.ok([...modes].every(x=>FOCUS_MODES.includes(x)));assert.equal(m.players[0].focus.correct,12);assert.equal(m.players[1].score,0);}});
test('focus all answers shorten waiting time without accepting duplicate scores',()=>{const m=createChallenge('focus',ps.slice(0,2),1,start),t=m.task;for(const p of m.players)applyChallenge(m,p.id,{round:0,choice:focusAnswer(t)},t.opensAt+300);assert.equal(m.task.deadline,t.opensAt+1200);assert.throws(()=>applyChallenge(m,'p0',{round:0,choice:focusAnswer(t)},t.opensAt+400));advanceChallenge(m,t.deadline);assert.equal(m.round,1);});
test('legacy patience migrates and rolls back only current pending penalties',()=>{const m=createChallenge('focus',ps.slice(0,2),1,start);m.round=3;m.task.type='hold';m.players[0].score=-40;m.players[0].focus={wrong:1,correct:0,streak:0};m.answers.p0={gain:-40};assert.ok(upgradeFocus(m,start+500));assert.equal(m.task.type,focusModeOf(m,3));assert.equal(m.players[0].score,0);assert.equal(m.players[0].focus.wrong,0);assert.deepEqual(m.answers,{});assert.equal(upgradeFocus(m),false);});

async function client(game){const h=await createDOM(game+'.html',{WebSocket:class{static OPEN=1;}});Object.assign(h.context,{CHALLENGES,createChallenge,applyChallenge,advanceChallenge,challengeView,adjacent,edge});h.context.document.body.dataset.challenge=game;await h.runFile('assets/js/wordbomb-ui.js');await h.runFile('assets/js/challenge-studio.js');await h.runFile('assets/js/challenge-client.js');return{...h,$:id=>h.doc.getElementById(id),probe:s=>vm.runInContext(s,h.context)};}
test('the hunt page: practice deals the board, a tap on the first and last letter takes the word',async()=>{
 const h=await client('wordbomb'),sounds=[];h.context.BS_AUDIO.play=x=>sounds.push(x);h.$('chPractice').click();
 assert.equal(h.$('chPlay').hidden,false);const cells=h.$('chBoard').querySelectorAll('.ch-hunt-cell');assert.equal(cells.length,64);
 assert.deepEqual(cells.map(c=>c.textContent),Array.from(h.probe('local.hunt.grid')));
 const chips=h.$('chControls').querySelectorAll('.ch-hunt-word');assert.equal(chips.length,h.probe('local.hunt.words.length'));assert.deepEqual(chips.map(c=>c.querySelector('.ch-hunt-label').textContent),Array.from(h.probe("local.hunt.words.map(w=>w.secret?'كلمة سرية':w.label)")));
 assert.equal(chips.filter(c=>!c.classList.contains('secret')).length,6,'six words on the list');
 assert.equal(h.$('chBoard').querySelector('.ch-hunt-theme').textContent,h.probe('local.hunt.theme'));
 const w=h.probe('local.hunt.words[0]'),cell=i=>h.$('chBoard').querySelector('.ch-hunt-cell[data-cell="'+i+'"]');
 cell(w.cells.at(-1)).click();assert.ok(cell(w.cells.at(-1)).classList.contains('anchor'));cell(w.cells[0]).click();
 assert.equal(h.probe("local.hunt.words[0].by"),'me');assert.equal(h.probe("local.players[0].score"),w.points);
 assert.ok(h.$('chControls').querySelector('.ch-hunt-word').classList.contains('found'));assert.equal(h.$('chBoard').querySelectorAll('.ch-hunt-lines line').length,1);
 assert.equal(sounds.filter(x=>x==='correct').length,1);h.probe('render();render()');assert.equal(sounds.filter(x=>x==='correct').length,1,'a redraw does not replay the sound');
 assert.match(h.$('chTactics').textContent,/أنت لقيت «/);
 // a wrong pick: the board waits a moment and says so
 h.probe('local.version++;localState();render()');const wrong=wrongPick(h.probe('local'));cell(wrong.from).click();cell(wrong.to).click();
 assert.equal(h.probe('local.players[0].misses'),1);assert.ok(h.$('chBoard').querySelector('.ch-hunt-grid').classList.contains('cooling'));assert.equal(sounds.filter(x=>x==='wrong').length,1);
 assert.match(h.$('chBoard').querySelector('.ch-hunt-pick').textContent,/استنى ثانية/);
});
test('practice pause freezes the round clock and shifts it when resumed',async()=>{
 const h=await client('wordbomb');h.$('chPractice').click();h.$('chPause').click();const frozen=h.probe('now()'),remaining=h.probe('local.hunt.deadline-now()');
 h.probe('Date.now=()=>'+(frozen+120000));h.probe('tick()');assert.equal(h.probe('now()'),frozen);h.$('chResume').click();assert.equal(h.probe('local.hunt.deadline-now()'),remaining);assert.equal(h.probe('pausedAt'),0);
 assert.match(h.$('chTime').textContent,/^\d+ ث$/);assert.equal(h.$('chRound').textContent,'الجولة 1 من 3');
});
test('the hunt is «صيد الكلمات» everywhere: page, home card, party catalog, menus and presence',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 assert.equal(CHALLENGES.wordbomb.title,'صيد الكلمات');assert.equal(PARTY_GAMES.find(g=>g.id==='wordbomb').name,'صيد الكلمات');
 const page=await read('public/wordbomb.html');assert.match(page,/<title>صيد الكلمات — بوسراج للألعاب<\/title>/);assert.match(page,/<h1>صيد الكلمات<\/h1>/);assert.match(page,/الجولة الأخيرة كلماتها مخفية/);
 assert.match(await read('public/index.html'),/<h3>صيد الكلمات<\/h3>/);
 for(const file of ['public/index.html','public/wordbomb.html','public/focus.html','public/cipher.html','public/reaction.html','public/assets/js/social-client.js','public/assets/js/game-menu-v33.js','public/assets/js/engines/party-catalog-v29.js','src/presence/presence-registry.js'])assert.doesNotMatch(await read(file),/قنبلة الكلمات|مرّر القنبلة/,file);
 const art=await read('public/assets/challenges/wordbomb.svg');assert.match(art,/WORD HUNT/);assert.doesNotMatch(art,/BOMB/);
});
test('new focus controls render count dots and numeric/symbol choices through actual client',async()=>{const h=await client('focus');h.$('chPractice').click();for(let i=0;i<9;i++){h.probe('clockOffset=local.task.opensAt-Date.now()+1;tick()');const type=h.probe('local.task.type');if(type==='count')assert.ok(h.$('chBoard').querySelectorAll('.ch-count-dots i').length>=6);if(['max','match','sum'].includes(type))assert.deepEqual([...h.$('chBoard').querySelectorAll('.ch-focus-button')].map(n=>n.textContent),Array.from(h.probe('local.task.options'),String));h.probe('advanceChallenge(local,local.task.deadline);localState();render()');}assert.ok(!h.html.includes('اختبار الصبر'));});
test('33.7.0: the secret word of the first two rounds — off the list, double points, it does not hold the round up',()=>{
 let seen=0;
 for(let seed=0;seed<40;seed++){const m=make(3,seed),h=m.hunt,secret=h.words.find(w=>w.secret);if(!secret)continue;seen++;
  assert.equal(secret.points,huntPoints(secret.word,true));assert.ok(!secret.golden);
  const view=challengeView(m,'p1',start+10).hunt,hidden=view.words.find(w=>w.secret);
  assert.equal(hidden.label,null);assert.ok(hidden.mask.every(c=>c===null),'no hint for the secret word');assert.equal(hidden.cells,null);assert.equal(view.found,0);
  assert.ok(!JSON.stringify(view).includes(JSON.stringify(secret.cells)),'its place is not sent');
  // the computer opponents leave it to the people
  for(let k=0;k<20;k++){const b=botAction({...m,players:m.players.map(p=>({...p,bot:true,nextThink:0}))},'p2',start+1000+k);if(b)assert.ok(!(b.from===secret.cells[0]&&b.to===secret.cells.at(-1)));}
  applyChallenge(m,'p1',claim(m,secret,true),start+2000);
  assert.equal(secret.by,'p1');assert.equal(m.players[1].score,secret.points);assert.equal(h.recent.at(-1).secret,true);assert.equal(m.hunt.phase,'play');
  assert.equal(challengeView(m,'p0',start+2100).hunt.found,0,'the count is of the listed words');
 }
 assert.ok(seen>=30,'most boards hide one: '+seen);
 // the last round has hidden words already: no secret there
 const m=make(2,5);for(let r=0;r<2;r++){finishRound(m,start+5000+r*20000);advanceChallenge(m,m.hunt.nextAt);}assert.equal(m.hunt.round,2);assert.ok(!m.hunt.words.some(w=>w.secret));
});
