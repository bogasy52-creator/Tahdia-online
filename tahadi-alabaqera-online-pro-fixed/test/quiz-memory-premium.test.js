import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CATEGORIES } from '../src/questions.js';

const read = (p) => readFile(new URL('../'+p, import.meta.url),'utf8');

test('memory pack is balanced and contains multiple memory challenge types',()=>{
  const memory=CATEGORIES.find(c=>c.id==='memory');
  assert.ok(memory,'memory category missing');
  assert.equal(memory.questions.length,18);
  for(const value of [100,200,300]) assert.equal(memory.questions.filter(q=>q.v===value).length,6);
  const kinds=new Set(memory.questions.map(q=>q.memory?.kind));
  for(const kind of ['digits','symbols','words','colors','grid','photo','arrows']) assert.ok(kinds.has(kind),kind+' missing');
  assert.ok(memory.questions.every(q=>q.media==='memory'&&q.memory?.previewMs>=2500));
});

test('local quiz has separated premium hero and random category picker',async()=>{
  const html=await read('public/local.html');
  assert.match(html,/quizHero/);assert.match(html,/quizConsole/);assert.match(html,/randomCatsLocal/);
  assert.match(html,/mountMemoryChallenge/);assert.doesNotMatch(html,/class="hero"[\s\S]*<svg viewBox="0 0 1200 420"/);
});

test('online quiz protects memory preview before answers open',async()=>{
  const html=await read('public/online.html');const server=await read('src/index.js');
  assert.match(html,/quizOnlineHero/);assert.match(html,/اختيار 6 فئات عشوائيًا/);assert.match(html,/answerOpensAt/);assert.match(html,/mountMemoryChallenge/);
  assert.match(server,/answerOpensAt/);assert.match(server,/q\.media === "memory"/);assert.match(server,/now < \(c\.answerOpensAt/);
});

test('quiz luxury stylesheet is cached by the PWA',async()=>{
  const sw=await read('public/service-worker.js');assert.match(sw,/busraj-games-v20/);assert.match(sw,/quiz-luxury\.css/);
});
