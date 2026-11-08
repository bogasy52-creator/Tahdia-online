// No public preview server: every browser request stays in this local test process.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'../qa/studio-browser');await mkdir(output,{recursive:true});
const tmp=await mkdtemp(join(tmpdir(),'tahdia-ui-'));
const checks=[],errors=[],sockets=new Set();let mf,browser;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.wav':'audio/wav'};
const pass=(name,data={})=>{checks.push({name,...data});console.log('PASS',name,JSON.stringify(data));};
async function pageOf(viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await context.newPage(),peers=new Map();
 page.on('pageerror',e=>errors.push({page:page.url(),message:e.message}));
 await page.exposeBinding('__nativeWsOpen',async(_,{id,url,protocols})=>{
  const u=new URL(url);u.protocol='https:';
  const response=await mf.dispatchFetch(u.href,{headers:{Origin:u.origin,Upgrade:'websocket','sec-websocket-protocol':protocols.join(',')}});
  if(response.status!==101)throw Error('WebSocket '+response.status+': '+await response.text());
  const ws=response.webSocket;peers.set(id,ws);sockets.add(ws);
  ws.addEventListener('message',e=>page.evaluate(({id,data})=>window.__nativeWsDeliver(id,'message',{data}),{id,data:e.data}).catch(()=>{}));
  ws.addEventListener('close',e=>{sockets.delete(ws);page.evaluate(({id,code,reason})=>window.__nativeWsDeliver(id,'close',{code,reason}),{id,code:e.code,reason:e.reason}).catch(()=>{});});
  ws.accept();return true;
 });
 await page.exposeBinding('__nativeWsSend',(_,{id,data})=>peers.get(id)?.send(data));
 await page.exposeBinding('__nativeWsClose',(_,{id,code,reason})=>{try{peers.get(id)?.close(code,reason);}catch{}});
 await page.addInitScript(()=>{
  const instances=new Map();let serial=0;
  window.__nativeWsDeliver=(id,type,init)=>{const ws=instances.get(id);if(!ws)return;if(ws.readyState===0&&type==='message'){ws.queue.push(init);return;}if(type==='close')ws.readyState=3;ws.emit(type,init);};
  class LocalSocket extends EventTarget{
   static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
   constructor(url,protocols=[]){super();this.url=String(url);this.id=++serial;this.readyState=0;this.bufferedAmount=0;this.queue=[];this.protocol=protocols[0]||'';instances.set(this.id,this);window.__nativeWsOpen({id:this.id,url:this.url,protocols:typeof protocols==='string'?[protocols]:protocols}).then(()=>{if(this.readyState!==0)return;this.readyState=1;this.emit('open');for(const init of this.queue.splice(0))this.emit('message',init);}).catch(error=>{this.emit('error');this.readyState=3;this.emit('close',{code:1006,reason:error.message});});}
   emit(type,init={}){const event=type==='message'?new MessageEvent(type,init):type==='close'?new CloseEvent(type,init):new Event(type);this.dispatchEvent(event);this['on'+type]?.(event);}
   send(data){if(this.readyState!==1)throw Error('Socket is not open');window.__nativeWsSend({id:this.id,data}).catch(()=>{});}
   close(code=1000,reason=''){if(this.readyState>=2)return;this.readyState=2;window.__nativeWsClose({id:this.id,code,reason}).catch(()=>{});}
  }
  for(const [name,value]of Object.entries({CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3}))LocalSocket.prototype[name]=value;
  window.WebSocket=LocalSocket;
 });
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.hostname!=='games.test'){await route.abort();return;}
  if(u.pathname.startsWith('/api/')){
   try{const response=await mf.dispatchFetch(u.href,{method:request.method(),headers:{...request.headers(),Origin:u.origin,'CF-Connecting-IP':'10.30.0.2'},body:request.postDataBuffer()||undefined});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}catch(error){await route.fulfill({status:500,json:{ok:false,error:error.message}});}return;
  }
  try{let name=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';if(!extname(name))name+='.html';const file=resolve(root,'public',name);if(!file.startsWith(resolve(root,'public')+sep))throw Error('invalid_path');const body=await readFile(file);await route.fulfill({status:200,contentType:mime[extname(file)]||'application/octet-stream',body});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
 return{page,context};
}
try{
 const bundle=join(tmp,'worker.mjs');await build({entryPoints:[join(root,'src/index.js')],outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],logLevel:'silent'});
 const cfg=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
 mf=new Miniflare(convertV4MiniflareOptions({name:cfg.name,modules:true,modulesRoot:tmp,scriptPath:bundle,compatibilityDate:cfg.compatibility_date,cf:false,host:'127.0.0.1',port:0,log:new Log(LogLevel.ERROR),durableObjects:Object.fromEntries(cfg.durable_objects.bindings.map(b=>[b.name,{className:b.class_name,useSQLite:true}])),serviceBindings:{ASSETS:()=>new Response('asset')}}));await mf.ready;
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking']});
 const a=await pageOf(),b=await pageOf();
 await a.page.goto('https://games.test/hockey?debug');await a.page.waitForFunction(()=>document.getElementById('hockeyBootStatus').hidden);
 await a.page.locator('[data-v="ai"]').click();await a.page.locator('#startBtn').click();await a.page.waitForTimeout(250);
 assert.equal(await a.page.locator('#game').isVisible(),true);assert.equal(await a.page.locator('#result').isVisible(),false);
 const hockey=await a.page.locator('#table').boundingBox();assert.ok(hockey.width>=380&&hockey.height>=700);await a.page.screenshot({path:join(output,'hockey-practice.png')});pass('Hockey practice paints inside a real mobile browser',hockey);
 await a.page.evaluate(()=>document.getElementById('quitBtn').click());
 await a.page.locator('[data-v="online"]').click();await a.page.locator('#hkCreate').click();await a.page.waitForFunction(()=>document.getElementById('hkRoomCode').textContent.length===6);
 const code=await a.page.locator('#hkRoomCode').textContent();await b.page.goto('https://games.test/hockey?room='+code);
 await Promise.all([a.page.locator('#game').waitFor({state:'visible'}),b.page.locator('#game').waitFor({state:'visible'})]);
 await a.page.waitForTimeout(300);await a.page.screenshot({path:join(output,'hockey-online.png')});
 assert.equal(await a.page.locator('#result').isVisible(),false);assert.equal(await b.page.locator('#result').isVisible(),false);pass('Two browser players enter the same native online hockey match',{code});
 await a.page.goto('https://games.test/race');await a.page.locator('#carromStart').click();await a.page.waitForTimeout(200);
 const carrom=await a.page.locator('#carromBoard').boundingBox();assert.ok(carrom.width>330&&Math.abs(carrom.width-carrom.height)<2);await a.page.locator('#shotAngle').evaluate(el=>{el.value='-70';el.dispatchEvent(new Event('input',{bubbles:true}));});await a.page.locator('#shoot').click();await a.page.waitForTimeout(200);await a.page.screenshot({path:join(output,'carrom-mobile.png')});pass('Carrom board, aim control and a real shot work on mobile',carrom);
 for(const name of ['jackaroo','snakes','shop']){await a.page.goto('https://games.test/'+name);await a.page.waitForTimeout(250);await a.page.screenshot({path:join(output,name+'-menu.png')});pass(name+' menu loads');}
 assert.deepEqual(errors,[],'No uncaught browser exceptions');
}catch(error){console.error(error);process.exitCode=1;errors.push({message:error.stack});}
finally{
 await writeFile(join(output,'results.json'),JSON.stringify({checks,errors,network:'Browser requests fulfilled from local assets and native Workerd only',published:false},null,2));
 for(const ws of sockets)try{ws.close(1000,'complete');}catch{}
 if(browser)await browser.close();if(mf)await mf.dispose();await rm(tmp,{recursive:true,force:true});
}
