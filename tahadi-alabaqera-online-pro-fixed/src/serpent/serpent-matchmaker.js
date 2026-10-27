import {roomCodeFor} from '../rooms/room-codes.js';
// One public queue coordinates reservations; gameplay uses the existing room actors.
export class SerpentMatchmaker {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.active=null;this.ready=ctx.blockConcurrencyWhile(async()=>{this.active=await ctx.storage.get('serpent-queue')||null});}
 async join(body){
  await this.ready;
  return this.ctx.blockConcurrencyWhile(async()=>{
   for(let attempt=0;attempt<6;attempt++){
    if(!this.active||this.active.deadline<=Date.now()){
     const code=roomCodeFor('serpent'),stub=this.env.ROOMS.get(this.env.ROOMS.idFromName('__serpent__:'+code));
     const response=await stub.fetch('https://serpent.internal/init',{method:'POST',body:JSON.stringify({code,hostKey:crypto.randomUUID()+crypto.randomUUID(),playerLimit:6,duration:120,matchMode:'survival',publicMatch:true,difficulty:'medium'})});
     if(response.status!==201)continue;
     this.active={code,deadline:Date.now()+10000};await this.ctx.storage.put('serpent-queue',this.active);
    }
    const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName('__serpent__:'+this.active.code));
    const response=await stub.fetch('https://serpent.internal/reserve',{method:'POST',body:JSON.stringify({name:body.name,username:body.username||null})});
    if(response.status===201)return Response.json({ok:true,code:this.active.code,...await response.json()},{status:201,headers:{'cache-control':'no-store'}});
    if(response.status===409||response.status===404){this.active=null;continue;}
    return response;
   }
   return Response.json({ok:false,error:'تعذر فتح مواجهة الآن، أعد المحاولة'},{status:503});
  });
 }
}
