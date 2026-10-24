// Deterministic visual exports of the production SVGs, not concept artwork.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createDOM} from '../test/dom-harness.mjs';
const output=resolve(process.env.QA_OUTPUT_DIR||'../qa-v30');await mkdir(output,{recursive:true});
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function serialize(el){const attrs={...el.attributes},tag={LINEARGRADIENT:'linearGradient',RADIALGRADIENT:'radialGradient'}[el.tagName]||el.tagName.toLowerCase();if(el.className)attrs.class=el.className;for(const[k,v]of Object.entries(el.dataset))attrs['data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=v;return '<'+tag+Object.entries(attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+escape(el._text||'')+el.children.map(serialize).join('')+'</'+tag+'>';}
for(const game of ['jackaroo','zahra'])for(const seats of [4,6])for(const material of ['walnut','ivory','carbon','jade']){
 const h=await createDOM(game+'.html'),target=h.doc.getElementById('board'),state={turn:1,players:Array.from({length:seats},(_,i)=>({name:['أطلس','سارة','محمد','ريم','خالد','نور'][i],tokens:[i===0?7:-1,-1,-1,-1]}))};
 const svg=h.context.renderPetalBoard(target,state,{game,material,pawn:material==='jade'?'lotus':material==='ivory'?'orbit':'rook',legal:[0,1],preview:true});svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',800);svg.setAttribute('height',800);await writeFile(join(output,game+'-'+seats+'-'+material+'.svg'),serialize(svg));
}
console.log('Exported 16 exact board SVGs to '+output);
