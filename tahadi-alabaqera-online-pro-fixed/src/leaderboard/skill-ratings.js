export const SKILL_GAMES=Object.freeze(['tanks','billiards']);
export const SKILL_START=1000,SKILL_K=32,SKILL_PLACEMENTS=10;
const validUser=v=>typeof v==='string'&&/^[a-z0-9_]{3,20}$/.test(v);
const clean=v=>String(v||'').normalize('NFKC').replace(/[<>\u0000-\u001f\u202a-\u202e]/g,'').trim().slice(0,24);
const row=p=>({username:p.u,name:p.n||p.u,rating:p.r,points:p.r,wins:p.w,games:p.g,provisional:p.g<SKILL_PLACEMENTS,placementsLeft:Math.max(0,SKILL_PLACEMENTS-p.g),delta:p.delta||0});
export function skillDeltas(players){return players.map(p=>{const opponents=players.filter(q=>q.team!==p.team);return Math.round(SKILL_K*opponents.reduce((sum,q)=>sum+(p.score===q.score ? .5 : p.score>q.score?1:0)-1/(1+10**((q.rating-p.rating)/400)),0)/opponents.length);});}
export class SkillRatings{
 constructor(ctx){this.ctx=ctx;}
 async record(body,now=Date.now()){
  const {game,id,players}=body||{};
  if(!SKILL_GAMES.includes(game)||typeof id!=='string'||!/^[a-zA-Z0-9:._-]{8,160}$/.test(id)||!Array.isArray(players)||players.length<2||players.length>4||game==='billiards'&&players.length!==2||players.some(p=>!validUser(p?.username)||![0,.5,1].includes(p.score)||!Number.isInteger(p.team)||p.team<0||p.team>3)||new Set(players.map(p=>p.username)).size!==players.length)return {ok:false,error:'invalid_match'};
  const teams=[...new Set(players.map(p=>p.team))];if(teams.length<2||teams.some(t=>new Set(players.filter(p=>p.team===t).map(p=>p.score)).size!==1)||!(players.every(p=>p.score===.5)||players.some(p=>p.score===1)&&players.some(p=>p.score===0)))return {ok:false,error:'invalid_result'};
  const receipt='skill:receipt:'+id;
  return this.ctx.storage.transaction(async tx=>{
   const previous=await tx.get(receipt);if(previous)return {ok:true,applied:false,...previous};
   const day=new Date(now+10800000).toISOString().slice(0,10),pairKeys=[];
   for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)if(players[i].team!==players[j].team)pairKeys.push('skill:pair:'+game+':'+[players[i].username,players[j].username].sort().join(':'));
   const pairs=await Promise.all(pairKeys.map(k=>tx.get(k)));
   if(pairs.some(p=>p?.day===day&&p.count>=5)){const ignored={rated:false,reason:'repeat_opponents'};await tx.put(receipt,ignored);return {ok:true,applied:false,...ignored};}
   const keys=players.map(p=>'skill:'+game+':p:'+p.username),entries=await Promise.all(keys.map(k=>tx.get(k))),prepared=players.map((p,i)=>({...p,rating:entries[i]?.r??SKILL_START})),deltas=skillDeltas(prepared);let top=await tx.get('skill:'+game+':top')||[];
   for(let i=0;i<players.length;i++){const p=players[i],old=entries[i]||{u:p.username,r:SKILL_START,w:0,g:0},next={...old,n:clean(p.name)||p.username,r:old.r+deltas[i],w:old.w+Number(p.score===1),g:old.g+1,delta:deltas[i],at:now};await tx.put(keys[i],next);top=top.filter(v=>v.u!==p.username);top.push(next);}
   top.sort((a,b)=>b.r-a.r||b.w-a.w||a.at-b.at||a.u.localeCompare(b.u));await tx.put('skill:'+game+':top',top.slice(0,100));
   for(let i=0;i<pairKeys.length;i++)await tx.put(pairKeys[i],{day,count:(pairs[i]?.day===day?pairs[i].count:0)+1});
   const result={rated:true,deltas:Object.fromEntries(players.map((p,i)=>[p.username,deltas[i]]))};await tx.put(receipt,result);return {ok:true,applied:true,...result};
  });
 }
 async top(game,username){
  if(!SKILL_GAMES.includes(game))return {ok:false,error:'invalid_game'};const top=await this.ctx.storage.get('skill:'+game+':top')||[],players=top.map((p,i)=>({...row(p),rank:i+1}));let me=null;
  if(validUser(username)){const p=await this.ctx.storage.get('skill:'+game+':p:'+username);me=p?{...row(p),rank:players.find(p=>p.username===username)?.rank||null}:{username,name:username,rating:SKILL_START,points:SKILL_START,games:0,wins:0,provisional:true,placementsLeft:SKILL_PLACEMENTS,rank:null};}
  return {ok:true,period:'skill',game,players,me,placements:SKILL_PLACEMENTS,start:SKILL_START,k:SKILL_K,serverNow:Date.now()};
 }
}
