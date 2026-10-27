import {planBotAnswers,dueBotAnswers,nextBotAnswer,hurryBotAnswers} from '../quiz/quiz-bots.js';
export const QUESTION_MS=15000,REVEAL_MS=2200;
export function createMatch(players,questions,now=Date.now()){
  if(players.length!==2||players[0].id===players[1].id||!questions.length)throw new Error('invalid_match');
  return {players:structuredClone(players),questions:structuredClone(questions),index:0,phase:'question',scores:Object.fromEntries(players.map(p=>[p.id,0])),correctCounts:Object.fromEntries(players.map(p=>[p.id,0])),answers:{},deadline:now+QUESTION_MS,startedAt:now,updatedAt:now,result:null,winners:[],rewarded:false};
}
export function submitAnswer(match,playerId,index,choice,now=Date.now()){
  if(!match.players.some(p=>p.id===playerId))throw new Error('forbidden');
  if(match.phase!=='question'||Number(index)!==match.index)throw new Error('stale_question');
  if(now>=match.deadline)throw new Error('deadline_passed');
  if(match.answers[playerId])throw new Error('already_answered');
  const q=match.questions[match.index];
  if(!Number.isInteger(choice)||choice<0||choice>=q.options.length)throw new Error('invalid_answer');
  match.answers[playerId]={choice,at:now};match.updatedAt=now;
  if(match.players.every(p=>match.answers[p.id]))reveal(match,now);
  return match;
}
function reveal(match,now){
  const q=match.questions[match.index],results={};
  for(const p of match.players){const a=match.answers[p.id];const correct=Boolean(a&&a.at<match.deadline&&a.choice===q.correct);const gain=correct?q.value+Math.max(0,Math.min(30,Math.floor((match.deadline-a.at)/500))):0;match.scores[p.id]+=gain;if(correct)match.correctCounts[p.id]++;results[p.id]={correct,gain,choice:a?.choice??null}}
  match.phase='reveal';match.result={index:match.index,answer:q.options[q.correct],correct:q.correct,results};match.revealUntil=now+REVEAL_MS;match.updatedAt=now;
}
export function advanceMatch(match,now=Date.now()){
  if(match.phase==='question'&&now>=match.deadline)reveal(match,now);
  if(match.phase==='reveal'&&now>=match.revealUntil){
    if(match.index+1>=match.questions.length){match.phase='finished';match.finishedAt=now;const best=Math.max(...Object.values(match.scores));match.winners=match.players.filter(p=>match.scores[p.id]===best).map(p=>p.id)}
    else{match.index++;match.phase='question';match.answers={};match.result=null;match.startedAt=now;match.deadline=now+QUESTION_MS}
    match.updatedAt=now;
  }
  return match;
}
export function publicMatch(match,viewer,now=Date.now()){
  if(!match.players.some(p=>p.id===viewer))throw new Error('forbidden');
  const q=match.questions[match.index];
  return {phase:match.phase,index:match.index,total:match.questions.length,updatedAt:match.updatedAt,serverNow:now,deadline:match.deadline,revealUntil:match.revealUntil,players:match.players.map(p=>({id:p.id,name:p.name,...(p.bot?{bot:true,level:p.level}:{})})),scores:match.scores,correctCounts:match.correctCounts,question:match.phase==='finished'?null:{text:q.text,category:q.category,value:q.value,options:q.options},answered:Boolean(match.answers[viewer]),result:match.phase==='question'?null:match.result,winners:match.winners,rewarded:match.rewarded};
}

// 33.0.0: a quick match against a bot (nobody else was looking for one). The bot answers
// each question at its own moment, right or wrong by its strength. Returns when it next answers.
export function botsAct(match,now=Date.now()){
  if(match.phase!=='question')return Infinity;
  const bots=match.players.filter(p=>p.bot);if(!bots.length)return Infinity;
  if(match.botPlanFor!==match.index){const q=match.questions[match.index];match.botPlan=planBotAnswers({opensAt:match.startedAt,deadline:match.deadline,options:q.options.length,correct:q.correct},bots);match.botPlanFor=match.index;}
  for(const a of dueBotAnswers(match.botPlan,match.answers,now)){if(match.phase!=='question')break;try{submitAnswer(match,a.id,match.index,a.choice,Math.min(a.at,match.deadline-1))}catch{}}
  if(match.phase==='question'&&match.players.every(p=>p.bot||match.answers[p.id]))hurryBotAnswers(match.botPlan,match.answers,now>0?now:Date.now());
  return match.phase==='question'?nextBotAnswer(match.botPlan,match.answers):Infinity;
}
