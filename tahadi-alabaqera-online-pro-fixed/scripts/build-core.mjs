import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {transform} from 'esbuild';
const root=new URL('../public/',import.meta.url),check=process.argv.includes('--check');
const names=['profile-core','social-client','career-client','platform','audio-manager','ui-icons'];
if(!check)await mkdir(new URL('assets/js/compact/',root),{recursive:true});
for(const name of names){const source=await readFile(new URL('assets/js/'+name+'.js',root),'utf8'),{code}=await transform(source,{loader:'js',target:'es2020',minify:true,charset:'utf8',legalComments:'inline'}),target=new URL('assets/js/compact/'+name+'.js',root);if(check){if(await readFile(target,'utf8')!==code)throw Error('Rebuild compact core: '+name);}else await writeFile(target,code);}
for(const file of (await readdir(root)).filter(n=>n.endsWith('.html'))){const target=new URL(file,root),html=await readFile(target,'utf8'),next=html.replace(/(<script\b[^>]*\bsrc=["']\/?assets\/js\/)([^/"'?]+)(\.js(?:\?[^"']*)?["'])/g,(all,prefix,name,suffix)=>names.includes(name)?prefix+'compact/'+name+suffix:all);if(check){if(next!==html)throw Error('Compact core references: '+file);}else if(next!==html)await writeFile(target,next);}
console.log('Compact shared scripts: '+names.length);
