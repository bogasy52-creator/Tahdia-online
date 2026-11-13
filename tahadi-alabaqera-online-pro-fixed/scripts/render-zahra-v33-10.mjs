import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createDOM} from '../test/dom-harness.mjs';
import {createLudoGame,applyLudoMove} from '../public/assets/js/engines/ludo-engine.js';
import {renderZahraBoard} from '../public/assets/js/zahra-studio-v33-10.js';
const require=createRequire(import.meta.url),sharp=require('sharp'),output=new URL('../docs/verification/zahra-v33-10/',import.meta.url);await mkdir(output,{recursive:true});
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function serialize(el){const tags={LINEARGRADIENT:'linearGradient',RADIALGRADIENT:'radialGradient',CLIPPATH:'clipPath'},tag=tags[el.tagName]||el.tagName.toLowerCase(),attrs={...el.attributes};if(el.className)attrs.class=el.className;return '<'+tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('')+'>'+esc(el._text||'')+el.children.map(serialize).join('')+'</'+tag+'>';}
const reports=[];
for(const scenario of [
 {name:'zahra-four-start',count:4,size:1200},
 {name:'zahra-four-playing',count:4,size:1200,playing:true},
 {name:'zahra-six-playing',count:6,size:1200,playing:true},
 {name:'zahra-four-phone-board',count:4,size:390,playing:true},
 {name:'zahra-character-loadout',count:4,size:1200,playing:true,character:true},
 {name:'zahra-royal-table',count:4,size:1200,playing:true,material:'table-royal'},
 {name:'zahra-majlis-table',count:4,size:1200,playing:true,material:'table-majlis'},
 {name:'zahra-meteor-trail',count:4,size:1200,trail:'trail-meteor'}
]){
 const h=await createDOM('zahra.html');globalThis.document=h.doc;globalThis.Event=h.context.Event;globalThis.BS_PIECES=h.context.BS_PIECES;globalThis.matchMedia=()=>({matches:!scenario.trail});
 let state=createLudoGame(['فهد','نورة','ليان','ماجد','سارة','عمر'].slice(0,scenario.count));if(scenario.playing)state.players.forEach((p,i)=>{p.tokens=[i*5+2,-1,i%2?0:17,i===0?(scenario.count>4?80:54):-1];});
 const board=h.doc.getElementById('board'),options={active:0,legal:scenario.playing?[0,2]:[],preview:!scenario.trail,material:scenario.material,trail:scenario.trail,...(scenario.character?{looks:['pawn-character','pawn-rook','pawn-classic','pawn-classic'],characters:['character-samurai','fox','fox','fox']}:{})};
 if(scenario.trail){state.players[0].tokens[0]=3;renderZahraBoard(board,state,options);state=applyLudoMove(state,0,5);}
 const svg=renderZahraBoard(board,state,options);svg.setAttribute('width',scenario.size);svg.setAttribute('height',scenario.size);
 for(const image of svg.querySelectorAll('image')){const href=image.getAttribute('href');if(href?.startsWith('/assets/')){const data=await readFile(new URL('../public'+href.split('?')[0],import.meta.url));image.setAttribute('href','data:image/png;base64,'+(await sharp(data).png().toBuffer()).toString('base64'));}}
 await writeFile(new URL(scenario.name+'.svg',output),serialize(svg));await sharp(Buffer.from(serialize(svg))).png().toFile(new URL(scenario.name+'.png',output).pathname);
 reports.push({name:scenario.name,players:scenario.count,width:scenario.size,height:scenario.size,pieces:svg.querySelectorAll('[data-stone]').length,slots:svg.querySelectorAll('[data-track]').length,material:scenario.material||'ivory',trail:svg.querySelector('[data-board-trail]')?.getAttribute('data-board-trail')||null,renderer:'public/assets/js/zahra-studio-v33-10.js',evidence:'Current SVG renderer rasterized through Sharp/librsvg; board artwork only, not a browser screenshot.'});board.zahraCleanup?.();
}
await writeFile(new URL('render-results.json',output),JSON.stringify({reports},null,2)+'\n');console.log(JSON.stringify(reports,null,2));
