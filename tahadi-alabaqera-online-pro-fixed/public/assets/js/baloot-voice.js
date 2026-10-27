/* Gulf neural phrases, each played as a complete file. No sprite slicing or seat pitch changes. */
import {BALOOT_PHRASES} from './engines/baloot-talk.js?v=33.0.0';
import {VOICE_RECORDINGS} from './baloot-voice-clips-v33.js?v=33.0.0';
const KEY='bs_baloot_voice',plain=t=>String(t||'').replace(/[ً-ْٰ]/g,'').replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu,'').replace(/[،,؟?!.…]/g,' ').replace(/\s+/g,' ').trim();
const WORDS={'بس':'pass','صن':'sun','أشكل':'ashkal','اشكل':'ashkal','دبل':'double','دبل مقفول':'double_locked','ثري':'triple','فور':'four','فور مقفول':'four_locked','قهوة':'gahwa','سرا':'sira','خمسين':'fifty','مية':'hundred','أربعمية':'fourHundred','اربعمية':'fourHundred','بلوت':'baloot','سجل':'claim','صح قطع':'caught','غلط':'wrong','كبوت':'kaboot','التسجيل صحيح':'claim_ok'};
for(const p of BALOOT_PHRASES)if(!WORDS[plain(p.say)])WORDS[plain(p.say)]=p.id;
const SUITS={'سبيت':'S','هاص':'H','ديمن':'D','شريا':'C'},PROJECTS=['sira','fifty','hundred','fourHundred'];
export function voiceLines(text){
 if(VOICE_RECORDINGS[text])return[text];const words=plain(text);if(WORDS[words])return[WORDS[words]];
 const call=words.match(/^(حكم|ثاني) (سبيت|هاص|ديمن|شريا)$/);if(call)return[(call[1]==='حكم'?'hokom_':'thani_')+SUITS[call[2]]];
 const pair=words.split(/ و /).map(p=>WORDS[p]);if(pair.length===2&&pair.every(p=>PROJECTS.includes(p))){pair.sort((a,b)=>PROJECTS.indexOf(a)-PROJECTS.indexOf(b));const id='projects_'+pair.join('_');return VOICE_RECORDINGS[id]?[id]:[];}return[];
}
function settings(){try{return window.BS_AUDIO?.getSettings?.()||{};}catch{return{};}}
function readEnabled(){try{return localStorage.getItem(KEY)!=='off';}catch{return true;}}
let enabled=readEnabled(),ctx=null,current=null,draining=false,epoch=0,queue=[];
const buffers=new Map(),loading=new Map();
function context(){if(ctx)return ctx;try{const AC=window.AudioContext||window.webkitAudioContext;return ctx=AC?new AC():null;}catch{return null;}}
function allowed(){const s=settings();return enabled&&!s.muted&&s.effects!==false&&Number(s.volume??.85)>0;}
async function load(id){if(buffers.has(id))return buffers.get(id);if(loading.has(id))return loading.get(id);const ac=context(),clip=VOICE_RECORDINGS[id];if(!ac||!clip)return null;const task=fetch(clip.src+'?r=gulf2',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('voice_clip_missing');return r.arrayBuffer();}).then(data=>ac.decodeAudioData(data)).then(buffer=>{buffers.set(id,buffer);return buffer;}).finally(()=>loading.delete(id));loading.set(id,task);return task;}
function playBuffer(buffer){return new Promise(resolve=>{const ac=context();if(!ac||!allowed()){resolve();return;}const src=ac.createBufferSource(),gain=ac.createGain();gain.gain.value=Math.max(0,Math.min(1,Number(settings().volume??.85)));gain.connect(ac.destination);src.buffer=buffer;src.connect(gain);let timer;const done=()=>{if(current?.src===src)current=null;clearInterval(timer);try{src.disconnect();gain.disconnect();}catch{}resolve();};current={src,done};src.onended=done;timer=setInterval(()=>{if(!allowed()){try{src.stop();}catch{}done();}else gain.gain.value=Math.max(0,Math.min(1,Number(settings().volume??.85)));},100);src.start();});}
async function drain(){if(draining)return;const ac=context();if(!ac||ac.state==='suspended')return;draining=true;try{while(queue.length){const next=queue.shift(),ticket=epoch;try{const buffer=await load(next.id);if(ticket===epoch&&buffer&&allowed())await playBuffer(buffer);}catch{/* The visible table call remains available; the next call can retry loading. */}}}finally{draining=false;}}
function stop(){epoch++;queue=[];if(current){const active=current;current=null;try{active.src.stop();}catch{}active.done();}}
export const BalootVoice={
 voice:'ar-KW-FahedNeural',synthetic:true,
 supported(){return typeof window!=='undefined'&&Boolean(window.AudioContext||window.webkitAudioContext);},hasArabic(){return this.supported();},get enabled(){return enabled;},
 setEnabled(on){enabled=Boolean(on);try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}if(!enabled)stop();else this.unlock();},
 unlock(){const ac=context();if(!ac)return;Promise.resolve(ac.state==='suspended'?ac.resume():undefined).then(()=>drain()).catch(()=>{});for(const id of ['pass','sun','claim','review_claim'])load(id).catch(()=>{});},
 say(text,position=0,{urgent=false}={}){if(!allowed()||!this.supported())return false;const ids=voiceLines(text);if(!ids.length)return false;for(const id of ids){if(queue.length>=8)queue.shift();if(urgent)queue.unshift({id});else queue.push({id});}void drain();return true;},
 stop
};
try{addEventListener('pointerdown',()=>BalootVoice.unlock(),{once:true,passive:true});}catch{}
