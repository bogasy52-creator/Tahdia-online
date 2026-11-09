import {Career} from '../career/core.js';
import {getSocialStub} from './social-api.js';
// The socket's authenticated member selects a fixed catalogue item. No scores or game state are touched.
export async function relayGameReaction(host,player,message){
 const item=Career.reactionOf(message.emote);if(!item)return false;
 if(item.price>0||item.source){if(!player.username)return false;const cache=host.reactionAccess??=new Map();let allowed=cache.get(player.username);if(!allowed||Date.now()-allowed.at>15000){const stub=getSocialStub(host.env,player.username);if(!stub)return false;const res=await stub.fetch('https://social.internal/reactions');if(!res.ok)return false;allowed={at:Date.now(),ids:(await res.json()).owned};cache.set(player.username,allowed);}if(!allowed.ids?.includes(item.id))return false;}
 // 33.9.0: one after another (40 a minute, a short breath between two); a thrown move names its target
 const now=Date.now(),all=host.reactionLimits??=new Map(),old=all.get(player.id)||{times:[],moveAt:0};old.times=old.times.filter(t=>now-t<60000);if(old.times.length>=40||old.times.length&&now-old.times.at(-1)<450||item.type==='move'&&now-old.moveAt<1400)return false;old.times.push(now);if(item.type==='move')old.moveAt=now;all.set(player.id,old);
 const to=item.target&&typeof message.to==='string'&&/^[\w:.-]{1,80}$/.test(message.to)?message.to:undefined;
 const packet=JSON.stringify({type:'emote',emote:item.id,from:player.id,name:player.name,at:now,...(to?{to}:{})});for(const ws of host.ctx.getWebSockets())try{ws.send(packet);}catch{}return true;
}
