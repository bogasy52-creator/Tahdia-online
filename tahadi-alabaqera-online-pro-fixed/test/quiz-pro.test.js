import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATEGORIES } from '../src/questions.js';

const root = new URL('../', import.meta.url).pathname;
const pub = join(root,'public');
const byId = id => CATEGORIES.find(c=>c.id===id);

test('quiz bank is expanded, balanced, and uniquely identified', () => {
  assert.equal(CATEGORIES.length,23);
  const total=CATEGORIES.reduce((n,c)=>n+c.questions.length,0);
  assert.ok(total>=680,`expected >=680 challenges, got ${total}`);
  const ids=new Set();
  for(const c of CATEGORIES){
    if(!['sounds','zoom'].includes(c.id)) assert.ok(c.questions.length>=27,`${c.id} too small`);
    for(const q of c.questions){
      assert.ok(q.id,`${c.id} missing question id`);
      assert.ok(!ids.has(q.id),`duplicate id ${q.id}`);ids.add(q.id);
      assert.ok([100,200,300].includes(q.v),`${q.id} invalid difficulty`);
      assert.ok(Array.isArray(q.distractors)&&q.distractors.length>=3,`${q.id} needs curated distractors`);
      const wrong=[...new Set(q.distractors.map(String))];
      assert.ok(wrong.length>=3,`${q.id} duplicate distractors`);
      assert.ok(!wrong.includes(String(q.a)),`${q.id} answer appears as distractor`);
    }
  }
});

test('sound challenge ships 60 balanced local clips with two-play fairness', async()=>{
  const c=byId('sounds');assert.ok(c);assert.equal(c.questions.length,60);
  for(const v of [100,200,300]) assert.equal(c.questions.filter(q=>q.v===v).length,20);
  for(const q of c.questions){
    assert.equal(q.media,'sound');assert.equal(q.replays,2);assert.ok(!/^https?:/i.test(q.src));
    await access(join(pub,q.src));
  }
});

test('zoom challenge ships 60 balanced local photographic challenges', async()=>{
  const c=byId('zoom');assert.ok(c);assert.equal(c.questions.length,60);
  for(const v of [100,200,300]) assert.equal(c.questions.filter(q=>q.v===v).length,20);
  for(const q of c.questions){
    assert.equal(q.media,'zoom');assert.ok(!/^https?:/i.test(q.src));assert.match(q.src,/assets\/quiz_photos\/.+\.webp$/);
    assert.ok(Number(q.zoom)>Number(q.hintZoom)&&Number(q.hintZoom)>=1,`${q.id} zoom stages`);
    assert.ok(Number(q.focusX)>=0&&Number(q.focusX)<=100&&Number(q.focusY)>=0&&Number(q.focusY)<=100,`${q.id} focus`);
    assert.ok(String(q.credit||'').includes('صورة'),`${q.id} needs photo provenance note`);
    await access(join(pub,q.src));
  }
});

test('local quiz consumes the shared expanded bank and removes old external media', async()=>{
  const html=await readFile(join(pub,'local.html'),'utf8');
  const data=await readFile(join(pub,'assets/js/questions-data.js'),'utf8');
  assert.match(html,/assets\/js\/questions-data\.js/);
  assert.match(html,/window\.BS_QUIZ_CATEGORIES/);
  assert.doesNotMatch(html,/sounds_guess\//);
  assert.doesNotMatch(html,/upload\.wikimedia\.org/);
  assert.match(html,/Fisher|function shuffled\(a\)\{const b=\[\.\.\.a\]/);
  assert.ok(data.includes('sounds_pro/'));assert.ok(data.includes('quiz_photos/'));
  assert.match(data,/\*\/\nwindow\.BS_QUIZ_CATEGORIES=/);assert.doesNotMatch(data,/\\nwindow\.BS_QUIZ_CATEGORIES=/);
});

test('online quiz has fair round options, anti-repeat and professional media controls', async()=>{
  const html=await readFile(join(pub,'online.html'),'utf8');
  const worker=await readFile(join(root,'src/index.js'),'utf8');
  for(const marker of ['data-round="12"','data-round="18"','data-round="24"','soundPlayCounts','drawSoundWave','hintZoom','focusX','focusY']) assert.ok(html.includes(marker),`online missing ${marker}`);
  for(const marker of ['set_round_count','recentQids','balancedModes','q.distractors']) assert.ok(worker.includes(marker),`worker missing ${marker}`);
});

test('service worker lazily caches large quiz media instead of relying on external hosts', async()=>{
  const sw=await readFile(join(pub,'service-worker.js'),'utf8');
  assert.match(sw,/busraj-games-v16/);assert.match(sw,/busraj-quiz-media-v3/);
  assert.match(sw,/assets\/quiz_photos/);assert.match(sw,/assets\/sounds_pro/);assert.match(sw,/questions-data\.js/);
  assert.doesNotMatch(sw,/upload\.wikimedia\.org/);
});

test('approved premium dice uses large black pips and physical lift/impact motion', async()=>{
  const css=await readFile(join(pub,'assets/css/luxury-game-ui.css'),'utf8');
  const audio=await readFile(join(pub,'assets/js/audio-manager.js'),'utf8');
  assert.match(css,/Porcelain Pro Dice/);assert.match(css,/width:clamp\(12px,28%,25px\)/);
  assert.match(css,/luxuryDiceBody/);assert.match(css,/luxuryDiceShadow/);assert.match(css,/calc\(var\(--die-rx\) \+ 90deg\)/);
  assert.match(audio,/porcelain roll/);
});


test('quiz text questions have no exact duplicates and use category-aware curated distractors', () => {
  const textQs=CATEGORIES.flatMap(c=>['sounds','zoom'].includes(c.id)?[]:c.questions.map(q=>({...q,cat:c.id})));
  const seen=new Set();
  for(const q of textQs){
    const key=String(q.q||'').trim().replace(/\s+/g,' ').toLowerCase();
    assert.ok(!seen.has(key),`duplicate question text: ${q.id}`);seen.add(key);
    assert.ok(q.kind,`${q.id} missing answer kind`);
  }
  const find=id=>textQs.find(q=>q.id===id);
  assert.deepEqual(find('general-003').distractors,['العربية','الهندية','الإسبانية']);
  assert.deepEqual(find('general-006').distractors,['مليون','مليار','تريليون']);
  assert.deepEqual(new Set(find('history-009').distractors),new Set(['معاهدة أوترخت','صلح وستفاليا','معاهدة تورديسيلاس']));
});

test('audio mastering manifest confirms 60 clear consistently leveled quiz clips', async()=>{
  const m=JSON.parse(await readFile(join(pub,'assets/sounds_pro/manifest.json'),'utf8'));
  assert.equal(m.targetActiveRmsDb,-16.5);assert.equal(m.clips.length,60);
  const files=new Set();
  for(const c of m.clips){
    assert.ok(!files.has(c.file),`duplicate audio ${c.file}`);files.add(c.file);
    assert.ok(c.activeRmsDb>=-17.1&&c.activeRmsDb<=-16.1,`${c.file} loudness ${c.activeRmsDb}`);
    assert.ok(c.peakDb<=0,`${c.file} clips above 0 dBFS`);
    assert.match(c.sha256,/^[a-f0-9]{64}$/);
    await access(join(pub,'assets/sounds_pro',c.file));
  }
});
