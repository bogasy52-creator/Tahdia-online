import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {MiniElement} from './dom-harness.mjs';
import {SERPENT_WORLDS,worldPreset,trainingProgress} from '../public/assets/js/engines/arena-worlds-v27.js';
export async function installExperienceHarness(h){
 if(!MiniElement.prototype.before)MiniElement.prototype.before=function(c){const p=this.parentElement;if(p){c.remove();c.parentElement=p;p.children.splice(p.children.indexOf(this),0,c);}};
 Object.assign(h.context,{SERPENT_WORLDS,worldPreset,trainingProgress,drawWorldPreview(){}});
 const source=(await readFile(new URL('../public/assets/js/arena-experience-v27.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'').replace(/^export /gm,'').replace(/^const \$=id=>.*;\n/m,'');
 vm.runInContext(source.replaceAll('$(', 'document.getElementById('),vm.createContext(h.context));
}
