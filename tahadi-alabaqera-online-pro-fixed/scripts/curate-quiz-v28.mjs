import {CATEGORIES} from '../src/questions.js';
import {writeFile,access,mkdir,rename} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),zoom=CATEGORIES.find(c=>c.id==='zoom'),sounds=CATEGORIES.find(c=>c.id==='sounds');
const generated=[
 ['ai-zoom-01',100,'أناناس','pineapple',50,70,3.8],
 ['ai-zoom-02',200,'صدفة بحرية حلزونية','seashell',44,50,4.5],
 ['ai-zoom-03',100,'كيوي','kiwi',30,50,3.8],
 ['ai-zoom-04',300,'زهرة دوار الشمس','sunflower',50,50,5.3],
];
for(const [id,v,a,file,focusX,focusY,z]of generated){
 const src=`assets/quiz_ai_v28/${file}.webp`;await access(join(root,'public',src));
 if(!zoom.questions.some(q=>q.id===id))zoom.questions.push({id,v,q:'ما الشيء الظاهر في هذه اللقطة المقرّبة؟',a,media:'zoom',src,revealSrc:src,zoom:z,hintZoom:Math.max(1.8,z*.65),focusX,focusY,credit:'صورة مولّدة بالذكاء الاصطناعي خصيصًا للتحدي',generated:true,kind:'image_object'});
}
const parentOf=file=>({china_detail:'china_roof',china_temple:'china_temple',china_roof:'china_roof',grace_medals:'grace_hopper',grace_hopper:'grace_hopper'}[file]||file.split('_')[0]);
for(const q of zoom.questions){
 const file=q.src.split('/').at(-1).replace('.webp',''),parent=q.generated?file:parentOf(file);
 q.mediaFamily='image:'+parent.replace(/^china_.*/,'china');
 if(!q.generated){const reveal=`assets/quiz_photos/${parent}.webp`;try{await access(join(root,'public',reveal));q.revealSrc=reveal;}catch{q.revealSrc=q.src;}}
}
const soundFamilies={knock:'impacts',keyboard:'office',applause:'human',camera:'office',clock:'clockwork',water:'water',doorbell:'bells',phone:'electronics',alarm:'electronics',whistle:'whistles',mouse:'office',coin:'metal',footsteps:'human',basketball:'sports',elevator:'bells',snap:'human',zipper:'fabric',glass:'glass',heartbeat:'body',rain:'water',engine:'motors',thunder:'weather',waves:'water',train:'whistles',siren:'whistles',helicopter:'motors',airplane:'motors',motorcycle:'motors',vacuum:'motors',hairdryer:'motors',blender:'motors',printer:'office',bikebell:'bells',brakes:'motors',tennis:'sports',boiling:'water',fire:'fire',wind:'weather',copier:'office',electric_hum:'electronics',notification:'electronics',gate:'metal',bowling:'sports',revving:'motors',scanner:'office',robotvac:'motors',drill:'motors',saw:'motors',kitchen_timer:'bells',radio:'electronics',bell:'bells',drops:'water',pen_click:'office',pages:'paper',microwave:'electronics',stapler:'office',keys:'metal',spray:'air',paper_tear:'paper',bottle_pop:'air'};
for(const q of sounds.questions){const file=q.src.split('/').at(-1).replace('.wav','');q.mediaFamily='sound:'+(soundFamilies[file]||file);}
for(const category of [zoom,sounds]){
 for(const q of category.questions){const candidates=category.questions.filter(other=>other.mediaFamily!==q.mediaFamily&&other.a!==q.a);const offset=[...q.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%candidates.length;candidates.push(...candidates.splice(0,offset));const options=[];for(const other of candidates){if(options.some(item=>item.a===other.a||item.mediaFamily===other.mediaFamily))continue;options.push(other);if(options.length===3)break;}if(options.length!==3)throw Error('Not enough distinct alternatives for '+q.id);q.distractors=options.map(item=>item.a);}
 category.questionCount=category.questions.length;
 if(category.id==='zoom')category.desc=category.questions.length+' تحديًا بصريًا بصور فوتوغرافية وصور مولّدة خصيصًا بالذكاء — زوم وتفاصيل وتلميح بصري';
 else category.desc='60 مقطعًا للتعرّف على الأصوات — محاولتا استماع لكل تحدٍ';
}
for(const q of CATEGORIES.find(c=>c.id==='logic').questions)if(['logic-006','logic-009'].includes(q.id))q.distractors=['نعم، دائمًا','جميع الاحتمالات متساوية','المعلومة تناقض نفسها'];
await writeFile(join(root,'src/questions.js'),'export const CATEGORIES = '+JSON.stringify(CATEGORIES)+';\n');
await mkdir(join(root,'docs'),{recursive:true});
try{await rename(join(root,'public/assets/quiz_ai_v28/provenance.json'),join(root,'docs/quiz-v28-image-provenance.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
console.log(`Curated ${zoom.questions.length} image questions and ${sounds.questions.length} sound questions with distinct alternatives.`);
