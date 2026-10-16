// Bounded, same-origin error intake. No extra Durable Object or external service.
const limits=new Map();
const reply=status=>new Response(null,{status,headers:{'cache-control':'no-store'}});
const clean=value=>String(value||'').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/[A-Za-z0-9_-]{24,}/g,'[redacted]').replace(/[\w.+-]+@[\w.-]+/g,'[redacted]').replace(/[\u0000-\u001f]/g,' ').slice(0,180);
export async function clientErrorReport(request,{release='unknown',now=Date.now(),log=console.warn}={}){
  if(request.method!=='POST')return reply(405);
  if(!request.headers.get('content-type')?.includes('application/json'))return reply(415);
  const ip=request.headers.get('cf-connecting-ip')||'unknown',old=limits.get(ip),row=old&&now-old.start<60000?old:{start:now,count:0};
  if(++row.count>6)return reply(429);limits.set(ip,row);if(limits.size>512)limits.delete(limits.keys().next().value);
  const reader=request.body?.getReader();if(!reader)return reply(400);let size=0,chunks=[];
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply(413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const data=JSON.parse(new TextDecoder().decode(bytes));
    const route=String(data.route||'').split(/[?#]/)[0];if(!/^\/[a-z0-9/_-]{0,70}$/i.test(route)||!['error','rejection'].includes(data.type))return reply(400);
    log('tahdia-client-error',JSON.stringify({release,route,type:data.type,message:clean(data.message),script:clean(String(data.script||'').split(/[?#]/)[0].split('/').at(-1)),line:Math.max(0,Math.min(100000,Number(data.line)||0))}));
    return reply(202);
  }catch{return reply(400);}
}
