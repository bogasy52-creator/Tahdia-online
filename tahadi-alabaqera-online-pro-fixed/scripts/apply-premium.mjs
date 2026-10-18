import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
let count=0;const css='<link rel="stylesheet" href="/assets/css/tahdia-premium-v25.css?v=25.0.0">';
const js='<script src="/assets/js/tahdia-premium-v25.js?v=25.0.0"></script>';
for(const name of await readdir(root)){
 if(!name.endsWith('.html')||['offline.html','admin.html'].includes(name))continue;
 const target=path.join(root,name);const raw=await readFile(target,'utf8');let next=raw;
 if(!next.includes('tahdia-premium-v25.css'))next=next.replace(/<\/head>/i,css+'</head>');
 if(!next.includes('tahdia-premium-v25.js'))next=next.replace(/<\/body>/i,js+'</body>');
 if(name==='sudoku.html')next=next.replace(/sudoku-online\.js\?v=24\.0\.1/g,'sudoku-online.js?v=25.0.0');
 if(next!==raw){await writeFile(target,next);count++;}
}
console.log('Tahdia premium 25 active on '+count+' route(s).');
