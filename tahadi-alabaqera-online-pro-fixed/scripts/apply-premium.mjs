import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
let count=0;const css='<link rel="stylesheet" href="/assets/css/tahdia-premium-v25.css?v=25.1.0">';
const js='<script src="/assets/js/tahdia-premium-v25.js?v=25.1.0"></script>';
const changed=new Set(['arcade-games','journey-ui','paths-online-v24','picture-ui','play-feedback-v24-1','serpent-ui','social-client','sudoku-online','sudoku-ui','home-v19']);
for(const name of await readdir(root)){
 if(!name.endsWith('.html')||['offline.html','admin.html'].includes(name))continue;
 const target=path.join(root,name);const raw=await readFile(target,'utf8');let next=raw;
 next=next.replace(/<link\b[^>]*href=["']\/?assets\/css\/tahdia-premium-v25\.css[^"']*["'][^>]*>/g,'');
 next=next.replace(/<script\b[^>]*src=["']\/?assets\/js\/tahdia-premium-v25\.js[^"']*["'][^>]*><\/script>/g,'');
 next=next.replace(/<\/head>/i,css+'</head>').replace(/<\/body>/i,js+'</body>');
 next=next.replace(/(assets\/js\/)([a-z0-9-]+)(\.js\?v=)[\d.]+/g,(all,prefix,file,suffix)=>changed.has(file)?prefix+file+suffix+'25.1.0':all);
 if(next!==raw){await writeFile(target,next);count++;}
}
console.log('Tahdia premium 25 active on '+count+' route(s).');
