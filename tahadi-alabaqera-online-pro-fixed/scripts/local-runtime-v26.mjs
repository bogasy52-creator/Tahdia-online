// Test-only Cloudflare runtime with temporary SQLite storage and real WebSockets.
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=join(root,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.wav':'audio/wav'};
export async function createRuntime(){
 const temp=await mkdtemp(join(tmpdir(),'tahdia-v26-')),bundle=join(temp,'worker.mjs');
 await build({entryPoints:[join(root,'src/index.js')],outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],logLevel:'silent'});
 const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
 const assets=async request=>{
  try{
   const url=new URL(request.url),relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
   let path=resolve(publicRoot,relative);if(!path.startsWith(publicRoot+'/'))return new Response('Forbidden',{status:403});
   if(!extname(path))path+='.html';
   return new Response(await readFile(path),{headers:{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-cache'}});
  }catch{return new Response('Not found',{status:404});}
 };
 const mf=new Miniflare(convertV4MiniflareOptions({name:config.name,modules:true,modulesRoot:temp,scriptPath:bundle,compatibilityDate:config.compatibility_date,cf:false,host:'127.0.0.1',port:0,log:new Log(LogLevel.ERROR),durableObjects:Object.fromEntries(config.durable_objects.bindings.map(b=>[b.name,{className:b.class_name,useSQLite:true}])),serviceBindings:{ASSETS:assets}}));
 try{const url=String(await mf.ready);return{mf,url,dispose:async()=>{await mf.dispose();await rm(temp,{recursive:true,force:true});}};}
 catch(error){await mf.dispose();await rm(temp,{recursive:true,force:true});throw error;}
}
