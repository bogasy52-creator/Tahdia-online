import {getSocialStub} from '../social/social-api.js';
import {LEADERBOARD_OBJECT} from '../leaderboard/leaderboard.js';
export function tankResult(room,now=Date.now()){
 const id='tanks:'+room.code+':'+(room.matchId||room.startedAt+':'+room.match),winners=new Set(room.g?.winners||[]),draw=winners.size===0;
 const eligible=room.g?.phase==='finished'&&room.players.length>=2&&now-room.startedAt>=20000&&room.players.some(p=>!p.forfeit);
 const players=room.players.map((p,seat)=>({username:p.username,name:p.name,team:room.mode==='teams'?seat%2:seat,score:draw ? .5 : winners.has(seat)&&!p.forfeit?1:0}));
 return {id,winnerUsername:winners.size===1?room.players[[...winners][0]]?.username||null:null,complete:!eligible,at:now,retryAt:0,attempts:0,skillDone:false,rewards:eligible?players.filter(p=>p.username).map(p=>({username:p.username,id:id+':'+p.username,game:'tanks',win:p.score===1,draw,done:false})):[],skill:eligible&&players.every(p=>p.username)?{id,game:'tanks',players}:null};
}
export async function settleTankResult(env,result,now=Date.now()){
 if(result.complete||result.retryAt>now)return;let failed=false;
 for(const reward of result.rewards){if(reward.done)continue;try{const stub=getSocialStub(env,reward.username);if(!stub)throw Error('missing_account_binding');const response=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify(reward)}),data=await response.json().catch(()=>({}));if(!response.ok&&!['account_not_found','account_suspended'].includes(data.error))throw Error('reward_unavailable');reward.done=true;}catch{failed=true;}}
 if(!result.skill)result.skillDone=true;
 if(!result.skillDone)try{const ns=env.BOARD_ROOMS;if(!ns)throw Error('missing_rating_binding');const response=await ns.get(ns.idFromName(LEADERBOARD_OBJECT)).fetch('https://leaderboard.internal/skill/record',{method:'POST',body:JSON.stringify(result.skill)});if(!response.ok)throw Error('rating_unavailable');result.skillDone=true;}catch{failed=true;}
 result.complete=!failed&&result.rewards.every(p=>p.done)&&result.skillDone;result.attempts++;result.retryAt=result.complete?0:now+Math.min(300000,5000*2**Math.min(result.attempts-1,6));
}
