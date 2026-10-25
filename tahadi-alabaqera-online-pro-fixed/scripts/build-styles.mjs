import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/',import.meta.url)),manifestPath=fileURLToPath(new URL('./style-bundles.json',import.meta.url));
let sources;try{sources=JSON.parse(await readFile(manifestPath,'utf8'));}catch{sources={};}
let packageRevision=null;try{packageRevision=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;}catch{}
const check=process.argv.includes('--check');let count=0;
const requested=process.argv.find(arg=>arg.startsWith('--pages='));
const selection=requested?requested.slice('--pages='.length).split(','):null;
const pages=(await readdir(root)).filter(name=>name.endsWith('.html')&&!['offline.html','accuracy.html'].includes(name));
if(selection&&(!selection.length||selection.some(page=>!pages.includes(page))||new Set(selection).size!==selection.length))throw Error('Invalid CSS page selection.');
for(const page of pages.filter(page=>!selection||selection.includes(page))){
 const pagePath=path.join(root,page),html=await readFile(pagePath,'utf8');
 if(!sources[page])sources[page]=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)].map(match=>match[0].match(/href=["']([^"']+)/)?.[1].split('?')[0]).filter(Boolean);
 const finalStyles=new Set(['assets/css/picture.css','assets/css/quiz-v19.css','assets/css/home-v19.css','assets/css/sudoku.css','assets/css/brain-v20.css','assets/css/picture-v21.css','assets/css/quiz-v21.css','assets/css/mobile-v21.css','assets/css/sudoku-v22.css','assets/css/arena-v23.css','assets/css/arena-hotfix-v23-1.css','assets/css/arena-v24.css','assets/css/paths-online-v24.css','assets/css/quiz-v28.css','assets/css/party-v29.css','assets/css/atelier-shop-v30.css','assets/css/tabletop-v30.css','assets/css/memory-v30.css','assets/css/release-v31.css','assets/css/dice-v31.css','assets/css/snakes-v31.css','assets/css/tables-v31.css','assets/css/shop-v31.css','assets/css/quiz-v31.css','assets/css/reactions-v31.css','assets/css/snakes-board-v31-1.css','assets/css/shop-v31-1.css']);
 const files=[...new Set([...sources[page].filter(x=>!finalStyles.has(x)),'assets/css/design-system.css',...sources[page].filter(x=>finalStyles.has(x))])];
 const content=(await Promise.all(files.map(async file=>'/* '+file+' */\n'+await readFile(path.join(root,file),'utf8')))).join('\n');
 const bundle='assets/css/app-'+page.replace('.html','')+'.css';
 const revision=packageRevision||(['serpent.html','journey.html','paths-online.html'].includes(page)?'24.0.1':html.match(/assets\/css\/app-[^"']+\?v=([^"']+)/)?.[1]||'23.0.1');
 // Keep the standalone v25 theme stylesheet outside each generated route bundle.
 // Rebuilding the route bundle must not remove the theme, and --check must
 // compare against the SAME normalized output as the release builder.
 const premiumLinks=[];
 const normalHtml=html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g,tag=>{
  if(/href=["']\/?assets\/css\/tahdia-premium-v25\.css\?v=[0-9.]+["']/.test(tag)){premiumLinks.push(tag);return '';}
  return tag;
 });
 if(premiumLinks.length>1)throw Error('Duplicate premium stylesheet: '+page);
 const next=normalHtml.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g,'').replace('</head>','<link rel="stylesheet" href="'+bundle+'?v='+revision+'">'+premiumLinks.join('')+'</head>');
 if(check){if(html!==next||await readFile(path.join(root,bundle),'utf8')!==content)throw Error('Rebuild styles: '+page);}else{await writeFile(path.join(root,bundle),content);await writeFile(pagePath,next);}
 count++;
}
if(!check)await writeFile(manifestPath,JSON.stringify(sources,null,2)+'\n');
console.log('Verified '+count+' route-specific CSS bundles.');
