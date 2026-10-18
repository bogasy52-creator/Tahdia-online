import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/',import.meta.url)),manifestPath=fileURLToPath(new URL('./style-bundles.json',import.meta.url));
let sources;try{sources=JSON.parse(await readFile(manifestPath,'utf8'));}catch{sources={};}
const check=process.argv.includes('--check');let count=0;
const requested=process.argv.find(arg=>arg.startsWith('--pages='));
const selection=requested?requested.slice('--pages='.length).split(','):null;
const pages=(await readdir(root)).filter(name=>name.endsWith('.html')&&name!=='offline.html');
if(selection&&(!selection.length||selection.some(page=>!pages.includes(page))||new Set(selection).size!==selection.length))throw Error('Invalid CSS page selection.');
for(const page of pages.filter(page=>!selection||selection.includes(page))){
 const pagePath=path.join(root,page),html=await readFile(pagePath,'utf8');
 if(!sources[page])sources[page]=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)].map(match=>match[0].match(/href=["']([^"']+)/)?.[1].split('?')[0]).filter(Boolean);
 const finalStyles=new Set(['assets/css/picture.css','assets/css/quiz-v19.css','assets/css/home-v19.css','assets/css/sudoku.css','assets/css/brain-v20.css','assets/css/picture-v21.css','assets/css/quiz-v21.css','assets/css/mobile-v21.css','assets/css/sudoku-v22.css','assets/css/arena-v23.css','assets/css/arena-hotfix-v23-1.css','assets/css/arena-v24.css','assets/css/paths-online-v24.css']);
 const files=[...new Set([...sources[page].filter(x=>!finalStyles.has(x)),'assets/css/design-system.css',...sources[page].filter(x=>finalStyles.has(x))])];
 const content=(await Promise.all(files.map(async file=>'/* '+file+' */\n'+await readFile(path.join(root,file),'utf8')))).join('\n');
 const bundle='assets/css/app-'+page.replace('.html','')+'.css';
 const revision=['serpent.html','journey.html','paths-online.html'].includes(page)?'24.0.1':html.match(/assets\/css\/app-[^"']+\?v=([^"']+)/)?.[1]||'23.0.1';
 const next=html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g,'').replace('</head>','<link rel="stylesheet" href="'+bundle+'?v='+revision+'"></head>');
 if(check){if(html!==next||await readFile(path.join(root,bundle),'utf8')!==content)throw Error('Rebuild styles: '+page);}else{await writeFile(path.join(root,bundle),content);await writeFile(pagePath,next);}
 count++;
}
if(!check)await writeFile(manifestPath,JSON.stringify(sources,null,2)+'\n');
console.log('Verified '+count+' route-specific CSS bundles.');
