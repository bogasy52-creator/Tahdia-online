import {BOMB_PROMPTS,bombCandidates,bombWordKey,normalizeBombWord,BOMB_WORDS} from './wordbank-ar.js';
const duration=m=>Math.max(5000,(m.players.length>6?6000:8500)-Math.floor(m.accepted/8)*500);
function finish(m,now,winners){m.phase='finished';m.finishedAt=now;m.winners=winners;m.version++;}
function best(m){const rows=[...m.players].sort((a,b)=>Number(b.alive)-Number(a.alive)||b.hearts-a.hearts||b.score-a.score),top=rows[0];return rows.filter(p=>p.alive===top.alive&&p.hearts===top.hearts&&p.score===top.score).map(p=>p.id);}
function turn(m,now){const used=new Set(m.usedWords),offset=(m.seed+m.turnId*37)>>>0;let fragment=null;for(let i=0;i<BOMB_PROMPTS.length;i++){const f=BOMB_PROMPTS[(offset+i)%BOMB_PROMPTS.length];if(bombCandidates(f,used).length){fragment=f;break;}}if(!fragment){finish(m,now,best(m));return;}m.prompt=fragment;m.turnStartedAt=now;m.turnDuration=duration(m);m.turnDeadline=now+m.turnDuration;}
function pass(m,now){m.turnId++;for(let i=1;i<=m.players.length;i++){const slot=(m.turn+i)%m.players.length;if(m.players[slot].alive){m.turn=slot;break;}}turn(m,now);}
export function initWordBomb(m,now){m.endsAt=now+240000;m.turn=m.seed%m.players.length;m.turnId=1;m.accepted=0;m.usedWords=[];m.recent=[];m.explosions=0;for(const p of m.players){p.hearts=m.players.length>6?2:3;p.words=0;}turn(m,now);}
export function applyWordBomb(m,p,a,now){
 if(now>=m.endsAt||now>=m.turnDeadline)throw Error('انتهى وقت الدور');
 if(m.turn!==p.slot)throw Error('انتظر دورك');
 if(a.turnId!==m.turnId)throw Error('تغيّر الدور؛ راجع الحروف');
 if(now<m.turnStartedAt+250)throw Error('انتظر ظهور الحروف');
 const word=normalizeBombWord(a.word),key=bombWordKey(a.word);
 if(!key)throw Error('الكلمة غير موجودة في قاموس اللعبة');
 if(!word.includes(m.prompt))throw Error('اكتب كلمة تحتوي «'+m.prompt+'» بالترتيب');
 if(m.usedWords.includes(key))throw Error('الكلمة استُخدمت؛ اختر كلمة مختلفة');
 m.usedWords.push(key);m.accepted++;p.words++;p.moves++;const gain=100+10*Math.floor(Math.max(0,m.turnDeadline-now)/1000);p.score+=gain;
 m.recent.push({id:p.id,name:p.name,word,gain,turnId:m.turnId});if(m.recent.length>12)m.recent.shift();
 pass(m,now);
}
export function advanceWordBomb(m,now){
 if(now>=m.endsAt){finish(m,now,best(m));return;}
 if(now>=m.turnDeadline){const p=m.players[m.turn];p.hearts=Math.max(0,p.hearts-1);p.score-=20;m.explosions++;m.lastExplosion={id:p.id,turnId:m.turnId};if(!p.hearts){p.alive=false;p.eliminatedAt=now;}const alive=m.players.filter(p=>p.alive);if(alive.length===1){finish(m,now,[alive[0].id]);return;}pass(m,now);m.version++;}
}
export function wordBombBot(m,p,now){if(m.turn!==p.slot||now<m.turnStartedAt+2100)return null;const words=bombCandidates(m.prompt,new Set(m.usedWords));return words.length?{turnId:m.turnId,word:words[(m.seed+m.turnId)%words.length]}:null;}
export function wordBombView(m){return{turnId:m.turnId,prompt:m.prompt,turnStartedAt:m.turnStartedAt,turnDuration:m.turnDuration,accepted:m.accepted,recent:structuredClone(m.recent),explosions:m.explosions,lastExplosion:m.lastExplosion?{...m.lastExplosion}:null,dictionarySize:BOMB_WORDS.length};}
