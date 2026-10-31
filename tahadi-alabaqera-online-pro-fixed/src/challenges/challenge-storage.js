// Keep every guess in append-only pages, and atomically persist bounded live state.
// Each stored value remains well below the Durable Object per-value size limit.
export const HISTORY_PAGE=50;
const CHUNK=16000,bytes=v=>new TextEncoder().encode(JSON.stringify(v)).byteLength;
export async function loadChallenge(storage){const head=await storage.get('challenge');if(!head||head.format!=='challenge-chunks-v1')return head||null;let text='';for(let i=0;i<head.count;i++){const value=await storage.get('challenge-part:'+i);if(typeof value!=='string')throw Error('challenge_storage_incomplete');text+=value;}return JSON.parse(text);}
export async function persistChallenge(storage,room,extra={}){
 const text=JSON.stringify(room),chunks=bytes(room)>80000?Array.from({length:Math.ceil(text.length/CHUNK)},(_,i)=>text.slice(i*CHUNK,(i+1)*CHUNK)):[],writes={...extra,challenge:chunks.length?{format:'challenge-chunks-v1',count:chunks.length}:room};chunks.forEach((c,i)=>writes['challenge-part:'+i]=c);
 await storage.transaction(async tx=>{const old=await tx.get('challenge');const rows=Object.entries(writes);for(let i=0;i<rows.length;i+=40)await tx.put(Object.fromEntries(rows.slice(i,i+40)));if(old?.format==='challenge-chunks-v1'&&old.count>chunks.length)for(let i=chunks.length;i<old.count;i++)await tx.delete('challenge-part:'+i);});
}
const historyKey=(round,actor,target,page)=>'challenge-history:'+round+':'+actor+':'+target+':'+page;
export async function historyWrites(storage,round,actor,target,rows,total){const writes={};for(let i=0;i<rows.length;i++){const row=rows[i],number=row.number??total-rows.length+i+1;if(number<1)continue;const page=Math.floor((number-1)/HISTORY_PAGE),key=historyKey(round,actor,target,page);if(!writes[key])writes[key]=await storage.get(key)||[];writes[key][(number-1)%HISTORY_PAGE]={...row,number};}return writes;}
export async function readHistory(storage,round,actor,target,start,limit,total,fallback=[]){const entries=[],pages=new Map();for(let n=start;n<Math.min(total,start+limit);n++){const page=Math.floor(n/HISTORY_PAGE),key=historyKey(round,actor,target,page);if(!pages.has(key))pages.set(key,await storage.get(key));
 const stored=pages.get(key),row=stored?.[n%HISTORY_PAGE]||fallback.find((r,i)=>(r.number??total-fallback.length+i+1)===n+1);if(row)entries.push(row);}
 return{entries,start,total,hasOlder:start>0,hasNewer:start+limit<total};}
