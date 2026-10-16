import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile,stat} from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
async function worker(fetch=async()=>new Response('asset')){
 const events={},cache=new Map(),names=new Map(),cached=[];
 const caches={open:async name=>{if(!names.has(name))names.set(name,new Map());const data=names.get(name);return{addAll:async files=>{cached.push(...files);for(const file of files)cache.set(file,new Response(file));},put:async(request,response)=>{data.set(request.url||request,response);},keys:async()=>[...data.keys()],delete:async key=>data.delete(key)};},keys:async()=>[...names.keys()],delete:async key=>names.delete(key),match:async request=>{const url=request.url||request;return cache.get(url)||cache.get(String(url).replace('https://game.test',''))||[...names.values()].map(data=>data.get(url)).find(Boolean);}};
 const scope={self:{location:{origin:'https://game.test'},addEventListener:(type,fn)=>events[type]=fn,skipWaiting(){},clients:{claim:async()=>{}}},caches,fetch,Response,URL,Set,Promise};
 vm.runInNewContext(await readFile(new URL('service-worker.js',root),'utf8'),scope);return{events,cached,cache};
}
test('the offline install downloads less than 1 MB and leaves large game images on demand',async()=>{
 const w=await worker();let task;w.events.install({waitUntil:value=>task=value});await task;assert.ok(w.cached.includes('/journey.html'));assert.ok(w.cached.some(x=>x.includes('journey-engine.js')));assert.ok(!w.cached.some(x=>/pawn-crown|jackaroo-table|objects\.webp|questions-data/.test(x)));
 let bytes=0;for(const url of w.cached){const file=url==='/'?'index.html':url.replace(/^\//,'').split('?')[0];bytes+=(await stat(new URL(file,root))).size;}assert.ok(bytes<1000000,'Core was '+bytes+' bytes');
});
test('offline daily routes resolve to their cached page and API requests are never cached',async()=>{
 const w=await worker(async()=>{throw new TypeError('offline');});let task;w.events.install({waitUntil:value=>task=value});await task;
 let result;w.events.fetch({request:{method:'GET',url:'https://game.test/journey?game=paths&daily=1',mode:'navigate'},respondWith:promise=>result=promise,waitUntil(){}});assert.equal(await(await result).text(),'/journey.html');
 let intercepted=false;w.events.fetch({request:{method:'GET',url:'https://game.test/api/social/career'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
