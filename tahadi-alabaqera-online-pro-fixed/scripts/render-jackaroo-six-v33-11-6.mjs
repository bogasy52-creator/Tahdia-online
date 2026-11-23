// Native raster preview of the SVG produced by the actual board renderer.
import{createRequire}from'node:module';import{readFile,writeFile,mkdir}from'node:fs/promises';import vm from'node:vm';import{createDOM}from'../test/dom-harness.mjs';import * as Jack from'../public/assets/js/engines/jackaroo-engine.js';
const require=createRequire(import.meta.url),sharp=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'),{createCanvas,loadImage,GlobalFonts}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=new URL('../',import.meta.url),dir=new URL('../verification/jackaroo-six-33-11-6/',import.meta.url);await mkdir(dir,{recursive:true});
GlobalFonts.registerFromPath(new URL('../public/assets/fonts/busraj-royal.woff',import.meta.url).pathname,'Royal');GlobalFonts.registerFromPath(new URL('../public/assets/fonts/tajawal-arabic-700.woff2',import.meta.url).pathname,'Tajawal');
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),camel={lineargradient:'linearGradient',radialgradient:'radialGradient',clippath:'clipPath'};
function xml(el){const tag=camel[el.tagName.toLowerCase()]||el.tagName.toLowerCase(),attrs={...el.attributes};if(el.className)attrs.class=el.className;if(tag==='svg'){attrs.xmlns='http://www.w3.org/2000/svg';attrs.width=1400;attrs.height=1400;}return'<'+tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('')+'>'+esc(el._text||'')+el.children.map(xml).join('')+'</'+tag+'>';}
const names=['أبو سراج','سعد','خالد','نورة','ماجد','ريم'],heroes=['fox','princess','cat','astronaut','viking','diver'];
async function draw(seats,look,{viewer=0,sample=false}={}){
 const state=Jack.createJackarooGame(names.slice(0,seats),{arm:19,home:'fill',rng:()=>.42});state.turn=0;state.discard=['5D','8S','JH'];
 state.players.forEach((p,s)=>{p.marbles=sample?[s===0?2:0,s%2?10:114,-1,-1]:[-1,-1,-1,-1];if(seats===4&&sample)p.marbles=[s===0?2:0,-1,-1,-1];});
 const h=await createDOM('jackaroo.html',{...Jack});await h.runFile('assets/js/profile-core.js');h.context.BS_CHARACTERS={poster:h.context.BS_CAREER_CORE.heroPoster};await h.runFile('assets/js/pieces-v31.js');await h.runFile('assets/js/jackaroo-cards.js');const target=h.doc.createElement('div');h.context.args={target,state,options:{game:'jackaroo',viewer,look,preview:true,avatars:heroes.slice(0,seats)}};vm.runInContext('renderPetalBoard(args.target,args.state,args.options)',h.context);
 let svg=xml(target.querySelector('svg'));for(const m of [...svg.matchAll(/href="(\/assets\/[^"?]+)(?:\?[^"\s]*)?"/g)]){const bytes=await sharp(await readFile(new URL('public'+m[1],root))).png().toBuffer();svg=svg.replaceAll(m[0],'href="data:image/png;base64,'+bytes.toString('base64')+'"');}
 await writeFile(new URL('jackaroo-'+seats+'-'+look+'.svg',dir),svg);return await loadImage(await sharp(Buffer.from(svg)).png().toBuffer());
}
const cv=createCanvas(1480,1700),c=cv.getContext('2d');c.fillStyle='#080f20';c.fillRect(0,0,1480,1700);
function text(t,x,y,s=25,color='#e6eaf3'){c.font=`700 ${s}px Royal,Tajawal`;c.textAlign='center';c.direction='rtl';c.fillStyle=color;c.fillText(t,x,y);}
text('جاكارو · المسار الكلاسيكي',740,55,42,'#f2d69a');text('نفس الخامات والأحجار · ستة أذرع متوازية · البيت وأربع خانات أمان',740,99,22,'#b8c4d8');
for(const [row,look,title]of[[0,'neon','نيون'],[1,'gold','ذهب']]){
 const y=130+row*760;text('٤ لاعبين · '+title,370,y+35,27);text('٦ لاعبين · '+title,1110,y+35,27);
 for(const [col,seats]of[[0,4],[1,6]]){const img=await draw(seats,look,{sample:true});c.drawImage(img,col*740+20,y+64,700,700);}
}
text('رسم من كود اللوحة الفعلي؛ ليست لقطة متصفح أو هاتف',740,1682,19,'#8d9db5');await writeFile('/workspace/scratch/f2f92a310cb2/Albqry-33.11.6-Jackaroo-Preview.png',cv.toBuffer('image/png'));
