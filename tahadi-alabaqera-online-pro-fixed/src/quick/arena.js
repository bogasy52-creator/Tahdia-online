import {CATEGORIES} from '../questions.js';
import {createMatch,submitAnswer,advanceMatch,publicMatch} from './core.js';
import {getSocialStub} from '../social/social-api.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function questionPool(){return CATEGORIES.flatMap(c=>(c.questions||[]).filter(q=>q.a&&q.q&&q.distractors?.length>=3&&!q.media&&!q.memory).map(q=>{const options=shuffle([q.a,...q.distractors.slice(0,3)]);return {text:q.q,category:c.name,options,correct:options.indexOf(q.a),value:Math.min(300,Math.max(100,Number(q.v)||100))}}))}

export function createQuickArenaClass(DurableObject){return class QuickArena extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.match=null;ctx.blockConcurrencyWhile(async()=>{this.match=await ctx.storage.get('match')||null})}
  async fetch(request){
    const url=new URL(request.url),body=request.method==='POST'?await request.json().catch(()=>({})):{};
    if(url.pathname==='/init')return this.ctx.blockConcurrencyWhile(async()=>{if(this.match)return json({ok:true});this.match=createMatch(body.players,shuffle(questionPool()).slice(0,10));try{await this.saveMatch()}catch(error){this.match=await this.ctx.storage.get('match')||null;throw error}return json({ok:true})});
    if(url.pathname==='/join')return this.join(body);
    if(url.pathname==='/ticket'||url.pathname==='/leave')return this.ticket(body,url.pathname==='/leave');
    if(url.pathname==='/state'||url.pathname==='/answer'){
      if(!this.match)return json({ok:false,error:'المواجهة غير موجودة'},404);
      const secretHash=await hash(String(body.secret||'')),player=this.match.players.find(p=>p.id===body.id&&p.secretHash===secretHash);
      if(!player)return json({ok:false,error:'غير مصرح'},403);
      return this.ctx.blockConcurrencyWhile(async()=>{
        advanceMatch(this.match);
        let failure=null;
        if(url.pathname==='/answer')try{submitAnswer(this.match,player.id,body.index,body.choice)}catch(e){failure=e.message}
        await this.saveMatch();try{await this.rewardPlayers()}catch{await this.ctx.storage.setAlarm(Date.now()+10000)}
        return json({ok:!failure,error:failure,state:publicMatch(this.match,player.id)},failure?409:200);
      });
    }
    return json({ok:false,error:'not_found'},404);
  }
  async join(body){
    const oldId=String(body.id||''),oldSecret=String(body.secret||'');
    if(oldId&&oldSecret){const old=await this.ctx.storage.get('ticket:'+oldId);if(old&&old.secretHash===await hash(oldSecret)&&old.expiresAt>Date.now()){const ready=!old.matchId||await this.ensureMatch(old.matchId);return json({ok:true,id:old.id,secret:oldSecret,status:old.matchId&&ready?'matched':'waiting',preparing:!!old.matchId&&!ready,matchId:old.matchId})}}
    const id=crypto.randomUUID(),secret=crypto.randomUUID()+crypto.randomUUID(),secretHash=await hash(secret),now=Date.now();
    const mine={id,name:String(body.name||'عبقري').replace(/[<>\u0000-\u001f]/g,'').slice(0,24),username:body.username||null,secretHash,expiresAt:now+90000,createdAt:now};
    const pair=await this.ctx.storage.transaction(async tx=>{
      const waiting=await tx.list({prefix:'waiting:',limit:32});let other=null;
      for(const [key,value] of waiting){const t=await tx.get('ticket:'+value);if(!t||t.expiresAt<=now||t.matchId){await tx.delete(key);if(t&&!t.matchId)await tx.delete('ticket:'+t.id);continue}if(mine.username&&mine.username===t.username)continue;other=t;await tx.delete(key);break}
      if(other){const matchId=crypto.randomUUID();mine.matchId=matchId;other.matchId=matchId;mine.expiresAt=other.expiresAt=now+30*60000;await tx.put('ticket:'+other.id,other);await tx.put('pending:'+matchId,{players:[other,mine],expiresAt:mine.expiresAt})}else await tx.put('waiting:'+String(now).padStart(14,'0')+':'+id,id);
      await tx.put('ticket:'+id,mine);return other;
    });
    const cleanupAt=await this.ctx.storage.getAlarm();
    if(cleanupAt===null||cleanupAt>mine.expiresAt)await this.ctx.storage.setAlarm(mine.expiresAt);
    const ready=!pair||await this.ensureMatch(mine.matchId);
    return json({ok:true,id,secret,status:pair&&ready?'matched':'waiting',preparing:!!pair&&!ready,matchId:mine.matchId});
  }
  async ensureMatch(matchId){
    const pending=await this.ctx.storage.get('pending:'+matchId);
    if(!pending)return true;
    try{const stub=this.env.QUICK_ARENA.get(this.env.QUICK_ARENA.idFromName('match:'+matchId));const response=await stub.fetch('https://quick.internal/init',{method:'POST',body:JSON.stringify({players:pending.players})});if(!response.ok)return false;await this.ctx.storage.delete('pending:'+matchId);return true}catch{return false}
  }
  async ticket(body,leave){
    const id=String(body.id||''),secretHash=await hash(String(body.secret||''));
    const result=await this.ctx.storage.transaction(async tx=>{
      const t=await tx.get('ticket:'+id);if(!t||t.secretHash!==secretHash||t.expiresAt<=Date.now())return json({ok:false,error:'انتهت مهلة البحث، ابدأ من جديد'},404);
      if(leave&&!t.matchId){await tx.delete('ticket:'+id);await tx.delete('waiting:'+String(t.createdAt).padStart(14,'0')+':'+id);return json({ok:true,status:'cancelled'})}
      if(!t.matchId){t.expiresAt=Date.now()+90000;await tx.put('ticket:'+id,t)}
      return t;
    });
    if(result instanceof Response)return result;
    const ready=!result.matchId||await this.ensureMatch(result.matchId);
    return json({ok:true,status:result.matchId&&ready?'matched':'waiting',preparing:!!result.matchId&&!ready,matchId:result.matchId});
  }
  async saveMatch(){await this.ctx.storage.put('match',this.match);await this.ctx.storage.setAlarm(this.match.phase==='question'?this.match.deadline:this.match.phase==='reveal'?this.match.revealUntil:Date.now()+3600000)}
  async rewardPlayers(){
    if(this.match.phase!=='finished'||this.match.rewarded)return;
    for(const p of this.match.players){if(!p.username)continue;const stub=getSocialStub(this.env,p.username);if(!stub)continue;const response=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:'quick:'+this.ctx.id.toString()+':'+p.id,game:'quiz',win:this.match.winners.length===1&&this.match.winners.includes(p.id)})});if(!response.ok)throw new Error('career_reward_failed')}
    this.match.rewarded=true;await this.ctx.storage.put('match',this.match);
  }
  async alarm(){
    if(this.match){if(this.match.phase==='finished'&&Date.now()-(this.match.finishedAt||0)>=3600000){await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();this.match=null;return}advanceMatch(this.match);await this.saveMatch();try{await this.rewardPlayers()}catch{await this.ctx.storage.setAlarm(Date.now()+10000)}return}
    const now=Date.now();let next=Infinity,startAfter;
    for(;;){const tickets=await this.ctx.storage.list({prefix:'ticket:',limit:1000,...(startAfter?{startAfter}:{})});
      for(const [key,t] of tickets){if(t.expiresAt<=now){await this.ctx.storage.delete(key);if(!t.matchId)await this.ctx.storage.delete('waiting:'+String(t.createdAt).padStart(14,'0')+':'+t.id);else await this.ctx.storage.delete('pending:'+t.matchId)}else next=Math.min(next,t.expiresAt);startAfter=key}
      if(tickets.size<1000)break;
    }
    if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);else await this.ctx.storage.deleteAlarm();
  }
}}
