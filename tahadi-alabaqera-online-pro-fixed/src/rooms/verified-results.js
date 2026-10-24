import {getSocialStub} from '../social/social-api.js';

// A friends-room match counts as a verified online result (career XP, the
// "online winner" achievement and the leaderboard) only when real opponents
// played it for a meaningful time. Solo rooms stay practice.
export const VERIFIED_MIN_PLAYERS=2,VERIFIED_MIN_MS=20000,VERIFIED_MAX_ATTEMPTS=6;

export function verifiedEligible(room){
  return room.order.length>=VERIFIED_MIN_PLAYERS&&room.finishedAt-room.startsAt>=VERIFIED_MIN_MS;
}

/**
 * Sends each account holder's result to their own account object. Receipts are
 * stable per match, so retries after a lost response never pay twice. After a
 * bounded number of failed attempts the room stops retrying rather than block
 * a rematch forever.
 */
export async function issueVerifiedResults(env,room,game){
  if(room.status!=='finished'||room.rewardsComplete!==false)return;
  try{
    if(verifiedEligible(room))for(const id of room.order){
      const player=room.players[id];if(!player?.username)continue;
      const stub=getSocialStub(env,player.username);if(!stub)throw new Error('career_binding_missing');
      const res=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:`${game}:${room.code}:${room.startsAt}:${player.id}`,game,win:room.winnerId===player.id})});
      if(!res.ok)throw new Error('career_reward_failed');
    }
    room.rewardsComplete=true;room.rewardRetryAt=null;
  }catch{
    room.rewardAttempts=(room.rewardAttempts||0)+1;
    if(room.rewardAttempts>=VERIFIED_MAX_ATTEMPTS){room.rewardsComplete=true;room.rewardRetryAt=null;}
    else room.rewardRetryAt=Date.now()+10000;
  }
}
