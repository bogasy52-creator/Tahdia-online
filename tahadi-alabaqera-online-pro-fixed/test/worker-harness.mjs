import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};return next(specifier,context)}});
const Worker=await import('../src/index.js');
class Storage{
 constructor(){this.values=new Map();this.alarm=null;this.queue=Promise.resolve()}
 async get(k){return structuredClone(this.values.get(k))}
 async put(k,v){this.values.set(k,structuredClone(v))}
 async delete(k){if(Array.isArray(k))return k.map(x=>this.values.delete(x));return this.values.delete(k)}
 async deleteAll(){this.values.clear()}
 async list({prefix='',limit=1000,reverse=false}={}){let rows=[...this.values].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b));if(reverse)rows.reverse();return new Map(rows.slice(0,limit).map(([k,v])=>[k,structuredClone(v)]))}
 async setAlarm(t){this.alarm=t}async getAlarm(){return this.alarm}async deleteAlarm(){this.alarm=null}
 transaction(fn){const work=this.queue.then(async()=>{const before=structuredClone(this.values),alarm=this.alarm;try{return await fn(this)}catch(error){this.values=before;this.alarm=alarm;throw error}});this.queue=work.catch(()=>{});return work}
}
class Context{
 constructor(name){this.storage=new Storage();this.id={toString:()=>name};this.ready=Promise.resolve();this.sockets=[]}
 blockConcurrencyWhile(fn){const result=this.ready.then(fn);this.ready=result.catch(()=>{});return result}
 getWebSockets(){return this.sockets}acceptWebSocket(ws){this.sockets.push(ws)}
}
class Namespace{
 constructor(Class,env){this.Class=Class;this.env=env;this.objects=new Map()}
 idFromName(name){return name}
 get(name){if(!this.objects.has(name)){const ctx=new Context(name),instance=new this.Class(ctx,this.env);this.objects.set(name,{ctx,instance})}const entry=this.objects.get(name);return {fetch:async(input,init)=>{await entry.ctx.ready;return entry.instance.fetch(input instanceof Request?input:new Request(input,init))}}}
 peek(name){this.get(name);return this.objects.get(name)}
}
function environment(){const env={ROOMS:{},ASSETS:{fetch:async()=>new Response('asset')}};env.QUICK_ARENA=new Namespace(Worker.QuickArena,env);env.BOARD_ROOMS=new Namespace(Worker.BoardRoom,env);return env}
async function api(env,path,body,token){const headers={Origin:'https://game.test','CF-Connecting-IP':'127.0.0.'+Math.floor(Math.random()*250)};if(body)headers['content-type']='application/json';if(token)headers.authorization='Bearer '+token;const request=new Request('https://game.test'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const response=await Worker.default.fetch(request,env);return {response,data:await response.json()}}
async function signup(env,name='playera'){return api(env,'/api/social/signup',{username:name,displayName:name,password:'StrongPass123!'})}


export {environment,api,signup};
