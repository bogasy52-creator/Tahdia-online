// Shared by browser room entry and the Worker. Never truncate into another room.
export function normalizeRoomCode(value) {
 const digits=String(value??'').normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');
 return /^\d{6}$/.test(digits)?digits:'';
}

export async function timedFetch(url,options={},timeout=10000) {
 const controller=new AbortController(),upstream=options.signal;
 const cancel=()=>controller.abort(upstream.reason);
 if(upstream?.aborted)cancel();else upstream?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('انتهت مهلة الاتصال، حاول مجددًا.','TimeoutError')),timeout);
 try{return await fetch(url,{...options,cache:'no-store',signal:controller.signal});}
 finally{clearTimeout(timer);upstream?.removeEventListener('abort',cancel);}
}
