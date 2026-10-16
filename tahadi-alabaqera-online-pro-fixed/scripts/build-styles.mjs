import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/',import.meta.url)),manifestPath=fileURLToPath(new URL('./style-bundles.json',import.meta.url));
let sources;try{sources=JSON.parse(await readFile(manifestPath,'utf8'));}catch{sources={};}
const check=process.argv.includes('--check');let count=0;
for(const page of (await readdir(root)).filter(name=>name.endsWith('.html')&&name!=='offline.html')){
 const pagePath=path.join(root,page),html=await readFile(pagePath,'utf8');
 if(!sources[page])sources[page]=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)].map(match=>match[0].match(/href=["']([^"']+)/)?.[1].split('?')[0]).filter(Boolean);
 const files=[...new Set([...sources[page],'assets/css/design-system.css'])];
 const content=(await Promise.all(files.map(async file=>'/* '+file+' */\n'+await readFile(path.join(root,file),'utf8')))).join('\n');
 const bundle='assets/css/app-'+page.replace('.html','')+'.css';
 const next=html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g,'').replace('</head>','<link rel="stylesheet" href="'+bundle+'?v=17.0.0"></head>');
 if(check){if(html!==next||await readFile(path.join(root,bundle),'utf8')!==content)throw Error('Rebuild styles: '+page);}else{await writeFile(path.join(root,bundle),content);await writeFile(pagePath,next);}
 count++;
}
if(!check)await writeFile(manifestPath,JSON.stringify(sources,null,2)+'\n');
console.log('Verified '+count+' route-specific CSS bundles.');
