import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const release=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
let count=0;const css='<link rel="stylesheet" href="/assets/css/tahdia-premium-v25.css?v='+release+'">';
const js='<script src="/assets/js/tahdia-premium-v25.js?v='+release+'"></script>';
const changed=new Set(['arcade-games','journey-ui','paths-online-v24','picture-ui','play-feedback-v24-1','serpent-ui','social-client','sudoku-online','sudoku-ui','home-v19']);
for(const name of await readdir(root)){
 if(!name.endsWith('.html')||['offline.html','accuracy.html'].includes(name))continue;
 const target=path.join(root,name);const raw=await readFile(target,'utf8'),atelier=raw.includes('atelier-shop-v30')||raw.includes('<body class="shop31');const isolatedHome=name==='index.html'&&raw.includes('home-palace');let next=(atelier||isolatedHome)?raw.replace(/release-v26 /g,''):raw.replace(/<body class="(?![^"]*release-v26)/,'<body class="release-v26 ');
 next=next.replace(/<link\b[^>]*href=["']\/?assets\/css\/tahdia-premium-v25\.css[^"']*["'][^>]*>/g,'');
 next=next.replace(/<script\b[^>]*src=["']\/?assets\/js\/tahdia-premium-v25\.js[^"']*["'][^>]*><\/script>/g,'');
 if(!atelier)next=next.replace(/<\/head>/i,css+'</head>').replace(/<\/body>/i,js+'</body>');
 next=next.replace(/(assets\/js\/)([a-z0-9/-]+)(\.js\?v=)v?[\d.]+/g,(_all,prefix,file,suffix)=>prefix+file+suffix+release);
 next=next.replace(/<script[^>]+src=["'][^"']*legend-(?:frame-art|frames)-v33-11-5\.js[^"']*["'][^>]*><\/script>/g,'');
 if(next.includes('profile-core.js'))next=next.replace(/<\/body>/i,'<script src="/assets/js/legend-frame-art-v33-11-5.js?v='+release+'"></script><script src="/assets/js/legend-frames-v33-11-5.js?v='+release+'"></script></body>');
 if(next!==raw){await writeFile(target,next);count++;}
}
console.log('Tahdia '+release+' ready; '+count+' page(s) updated.');
