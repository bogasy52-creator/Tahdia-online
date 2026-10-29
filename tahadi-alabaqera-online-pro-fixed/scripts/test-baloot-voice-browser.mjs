/* Browser component QA. The temporary WAV fixture tests timing, never human speech quality. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { VOICE_LINES } from '../public/assets/js/baloot-voice-pack.js';

const base = process.env.BALOOT_TEST_URL || 'http://127.0.0.1:4187';
const out = process.env.BALOOT_TEST_OUTPUT || '/tmp/tahdia-voice-browser';
await mkdir(out, { recursive:true });
const browser = await chromium.launch({ headless:true });
const results = { browser:'Chromium', realPhoneTested:false, speechQualityReviewed:false, checks:[] };
const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let oldVoiceRequests = 0;
page.on('request', request => { if (/baloot-gulf-v33|baloot-voice-v33\.mp3/.test(request.url())) oldVoiceRequests++; });
try {
  await page.goto(base + '/baloot.html');
  await page.waitForFunction(() => Boolean(window.BS_BALOOT));
  // Open the component without a live game server. No match result is simulated.
  await page.locator('#talkBtn').evaluate(button => button.click());
  await page.locator('#talkSheet').waitFor({ state:'visible' });
  await page.waitForFunction(() => document.querySelector('#voiceNote').textContent.includes('التسجيلات البشرية'));
  assert.equal(await page.locator('#voicePreview').isDisabled(), true);
  assert.equal(await page.locator('#voiceReplay').isDisabled(), true);
  assert.equal(await page.locator('#voiceToggle').isDisabled(), true);
  assert.equal(oldVoiceRequests,0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({path:out + '/pending-mobile.png'});
  results.checks.push('pending human pack is accurately labeled; rejected audio is never requested');

  const wav = Buffer.alloc(44 + 9600 * 2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);
  wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(19200,40);
  for(let i=0;i<9600;i++)wav.writeInt16LE(Math.round(4000*Math.sin(i*Math.PI*2*440/48000)),44+i*2);
  const sha256 = createHash('sha256').update(wav).digest('hex');
  const pack = {id:'TEST-FIXTURE-NOT-HUMAN-SPEECH',kind:'human',approved:true,voice:'TEST FIXTURE',recordings:{}};
  for(const id of Object.keys(VOICE_LINES))pack.recordings[id]={text:VOICE_LINES[id],seconds:.2,sha256,src:'/assets/audio/baloot-human/test-fixture/'+id+'.mp3'};
  await page.route('**/assets/js/baloot-voice-pack.js?*',route=>route.fulfill({contentType:'text/javascript',body:'export const VOICE_LINES = '+JSON.stringify(VOICE_LINES)+'; export const VOICE_PACK = '+JSON.stringify(pack)+';'}));
  await page.route('**/assets/audio/baloot-human/test-fixture/**',route=>route.fulfill({contentType:'audio/wav',body:wav}));
  await page.addInitScript(() => {
    window.voiceStarts=[];
    addEventListener('bs-baloot-voice-change',event=>{
      if(event.detail.state==='playing'&&window.voiceStarts.at(-1)!==event.detail.current)window.voiceStarts.push(event.detail.current);
    });
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.BS_BALOOT));
  await page.locator('#talkBtn').evaluate(button => button.click());
  await page.locator('#voicePreview').click();
  await page.waitForFunction(() => document.querySelector('#voiceLast').textContent.includes('بس'));
  await page.waitForFunction(() => document.querySelector('#voiceNote').textContent==='الصوت جاهز.');
  assert.equal(await page.locator('#voiceReplay').isDisabled(), false);
  await page.evaluate(async()=>{
    const {BalootVoice}=await import('/assets/js/baloot-voice.js?v=33.0.0-baloot2');
    window.testVoice=BalootVoice;window.voiceStarts=[];
    BalootVoice.say('sun');BalootVoice.say('claim',0,{urgent:true});BalootVoice.say('wrong',0,{urgent:true});
  });
  await page.waitForFunction(() => window.voiceStarts.length===3 && window.testVoice.getStatus().state==='ready');
  assert.deepEqual(await page.evaluate(()=>window.voiceStarts),['sun','claim','wrong']);
  results.checks.push('real Web Audio playback completes three WAV fixtures in order without overlapping');
  await page.locator('#voiceReplay').click();
  await page.waitForFunction(() => window.testVoice.getStatus().state==='ready');
  await page.evaluate(()=>window.BS_AUDIO.setMuted(true));
  await page.waitForFunction(() => document.querySelector('#voiceNote').textContent.includes('مكتوم'));
  assert.equal(await page.locator('#voicePreview').isDisabled(),true);
  await page.evaluate(()=>{window.BS_AUDIO.setMuted(false);dispatchEvent(new Event('pagehide'));});
  assert.equal(await page.evaluate(()=>window.testVoice.getStatus().last),null);
  results.checks.push('replay, global mute, and leaving-page cleanup work in the browser');
  for(const width of [360,390,1280]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));
    const box=await page.locator('#voicePreview').boundingBox();assert.ok(box.height>=44);
  }
  results.checks.push('voice controls fit 360, 390, and 1280 pixel viewports with 44 pixel tap targets');
  assert.deepEqual(errors,[]);assert.equal(oldVoiceRequests,0);
  results.checks.push('no uncaught page errors or rejected legacy voice downloads');
  await writeFile(out+'/browser-results.json',JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }
