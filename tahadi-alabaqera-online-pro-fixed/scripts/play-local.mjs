import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const port=Number(process.env.PORT)||4173;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'اللعب المحلي جاهز. الغرف والحسابات تحتاج تشغيل السيرفر عبر npm run dev.'}));return}
  const relative=pathname==='/'?'index.html':pathname.replace(/^\//,''),base=resolve(root,relative);
  if(!base.startsWith(root+sep)&&base!==root)throw new Error('invalid_path');
  const file=extname(base)?base:base+'.html',bytes=await readFile(file);
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(bytes);
 }catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('الصفحة غير موجودة')}
}).listen(port,'0.0.0.0',()=>console.log('PRO V7 local games: http://localhost:'+port));
