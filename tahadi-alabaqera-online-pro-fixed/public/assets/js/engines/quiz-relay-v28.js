// Shared deterministic team challenge. Only relayView() is sent to clients.
const PACKS = [
 ['خزنة المتحف',3,4,4,2],['مهمة المرصد',4,5,2,3],['جسر الجزيرة',5,6,6,4],
 ['شيفرة المكتبة',6,4,4,5],['قطار الرحلة',7,3,3,3],['بوابة المدينة',4,8,8,4],
 ['مختبر الأرقام',8,5,4,6],['رحلة الفضاء',6,7,6,6],['سر الحديقة',9,4,6,5],
 ['مفتاح القلعة',7,8,8,6],['الكنز المفقود',8,9,9,7],['مسار القمة',9,6,6,8],
];
function optionsFor(answer,seed){
 const values=[answer,answer+1,Math.max(0,answer-2),answer+3];
 for(let i=values.length-1;i>0;i--){const j=(seed+i*7)%(i+1);[values[i],values[j]]=[values[j],values[i]];}
 return values.map(String);
}
export function createRelay({seed=0,members,now=Date.now(),duration=60000}={}){
 if(!Array.isArray(members)||![2,3].includes(members.length)||new Set(members).size!==members.length)throw Error('relay_members');
 seed=Math.abs(Math.trunc(Number(seed)||0))%12000;
 const [title,a,b,c,d]=PACKS[seed%PACKS.length],one=a*b,two=one-c,three=two/d;
 const prompts=[`في المخزن ${a} صناديق، في كل صندوق ${b} مفاتيح. كم مفتاحًا لدينا؟`,`استلمت من زميلك ${one}. نستخدم ${c} مفاتيح لفتح الأبواب. كم يتبقى؟`,`وصل من زميلك ${two}. وزّعها بالتساوي على ${d} خزائن. كم مفتاحًا لكل خزنة؟`];
 const steps=[one,two,three].slice(0,members.length).map((answer,i)=>{const options=optionsFor(answer,seed+i);return{prompt:prompts[i],options,correctIndex:options.indexOf(String(answer)),answer:String(answer)};});
 return{seed,title,members:[...members],steps,stage:0,answers:[],attempted:[],mistakes:0,deadline:now+duration,complete:false,failed:false};
}
export function relayStageId(relay){return `r${relay.seed}:${relay.stage}`;}
export function relayView(relay,playerId){
 if(!relay||!relay.members.includes(playerId))return null;
 const finished=relay.complete||relay.failed,ownerId=finished?null:relay.members[relay.stage],step=relay.steps[relay.stage];
 return{title:relay.title,stage:relay.stage,count:relay.members.length,members:[...relay.members],ownerId,stageId:relayStageId(relay),mistakes:relay.mistakes,maxMistakes:3,deadline:relay.deadline,complete:relay.complete,failed:relay.failed,
  progress:relay.members.map((id,i)=>({id,complete:i<relay.stage})),previous:relay.stage?relay.steps[relay.stage-1].answer:null,
  clue:ownerId===playerId?step.prompt:null,options:ownerId===playerId?[...step.options]:null,attempted:ownerId===playerId?[...relay.attempted]:[]};
}
export function answerRelay(relay,{playerId,choice,stageId,now=Date.now()}={}){
 if(!relay||relay.complete||relay.failed||now>=relay.deadline)return{accepted:false,error:'closed'};
 if(stageId!==relayStageId(relay))return{accepted:false,error:'stage_changed'};
 if(relay.members[relay.stage]!==playerId)return{accepted:false,error:'wrong_member'};
 if(!Number.isInteger(choice)||choice<0||choice>3||relay.attempted.includes(choice))return{accepted:false,error:'invalid_choice'};
 const correct=choice===relay.steps[relay.stage].correctIndex;
 if(correct){relay.answers.push(choice);relay.stage++;relay.attempted=[];relay.complete=relay.stage===relay.members.length;}
 else{relay.attempted.push(choice);relay.mistakes++;relay.failed=relay.mistakes>=3;}
 return{accepted:true,correct,complete:relay.complete,failed:relay.failed};
}
export function relayResults(relay,value=200){
 const total=relay.complete?value+50:Math.floor(value/2*relay.stage/relay.members.length);
 const count=relay.stage,share=count?Math.floor(total/count):0,remainder=total-share*count;
 return Object.fromEntries(relay.members.map((id,i)=>[id,{correct:i<count,gain:i<count?share+(i<remainder?1:0):0,choice:relay.answers[i]??null,teamComplete:relay.complete}]));
}
export function relayReveal(relay){return{title:relay.title,complete:relay.complete,failed:relay.failed,parts:relay.members.map((id,i)=>({id,question:relay.steps[i].prompt,answer:relay.steps[i].answer,correct:i<relay.stage}))};}
export function restoreRelay(saved){
 try{
  if(!saved||!Number.isInteger(saved.seed)||saved.seed<0||saved.seed>=12000||!Number.isFinite(saved.deadline)||!Array.isArray(saved.members)||!saved.members.every(id=>typeof id==='string'&&id.length<=60))return null;
  const fresh=createRelay({seed:saved.seed,members:saved.members,now:saved.deadline,duration:0});
  if(!Number.isInteger(saved.stage)||saved.stage<0||saved.stage>fresh.members.length||!Array.isArray(saved.answers)||saved.answers.length!==saved.stage||!saved.answers.every((x,i)=>x===fresh.steps[i].correctIndex)||!Number.isInteger(saved.mistakes)||saved.mistakes<0||saved.mistakes>3||!Array.isArray(saved.attempted)||new Set(saved.attempted).size!==saved.attempted.length||saved.attempted.length>saved.mistakes||!saved.attempted.every(x=>Number.isInteger(x)&&x>=0&&x<4&&x!==fresh.steps[saved.stage]?.correctIndex))return null;
  return{...fresh,stage:saved.stage,answers:[...saved.answers],attempted:[...saved.attempted],mistakes:saved.mistakes,complete:saved.stage===fresh.members.length,failed:saved.mistakes===3};
 }catch{return null;}
}
