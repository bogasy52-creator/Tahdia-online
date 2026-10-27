// Pure shared rules: browser practice and authoritative party rooms use these.
const shuffle=(items,rng)=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[out[i],out[j]]=[out[j],out[i]];}return out;};
export const LOGIC_CATEGORIES=Object.freeze(['خطوة ثابتة','خطوتان متعاقبتان','تضاعف','فروق متزايدة','جمع السابقين','دورة أشكال','عدّ بصري','اتجاه ودوران','استنتاج وترتيب','عدد الأضلاع']);
export function cognitiveQuestion(index,rng=Math.random,difficulty=2){
 const tier=Math.max(1,Math.min(5,Number(difficulty)||2)),n=Math.max(0,Math.floor(index)),kind=n%10,a=2+Math.floor(rng()*(tier+2)),b=1+Math.floor(rng()*(tier*4+3));
 let sequence=[],answer,wrong=[],explanation='',question='ما العنصر التالي؟',visual=false;
 if(kind===0){sequence=Array.from({length:4},(_,i)=>b+a*i);answer=b+a*4;wrong=[answer-a,answer+a,answer+2*a];explanation='نضيف '+a+' إلى كل عدد؛ '+sequence[3]+' + '+a+' = '+answer+'.';}
 if(kind===1){const c=a+1+tier;let v=b;sequence=[v];for(let i=0;i<4;i++){v+=i%2?c:a;sequence.push(v);}answer=v+a;wrong=[v+c,v+a+c,v+1];explanation='الزيادتان تتعاقبان: +'+a+' ثم +'+c+'؛ الدور الآن لزيادة '+a+'.';}
 if(kind===2){const factor=tier>=4?3:2;sequence=Array.from({length:4},(_,i)=>a*factor**i);answer=a*factor**4;wrong=[answer+factor,answer/factor,answer*factor];explanation='نضرب في '+factor+' كل مرة؛ '+sequence[3]+' × '+factor+' = '+answer+'.';}
 if(kind===3){sequence=Array.from({length:4},(_,i)=>b+(i+1)**2);answer=b+25;wrong=[answer-2,answer+2,answer+4];explanation='الفروق هي 3، 5، 7؛ الفرق التالي 9، لذلك '+sequence[3]+' + 9 = '+answer+'.';}
 if(kind===4){sequence=[a,b+a];for(let i=2;i<5;i++)sequence.push(sequence[i-1]+sequence[i-2]);answer=sequence[4]+sequence[3];wrong=[answer+1,sequence[4]*2,answer-a];explanation='كل عدد يساوي مجموع العددين السابقين: '+sequence[3]+' + '+sequence[4]+' = '+answer+'.';}
 if(kind===5){const cycle=shuffle(['●','▲','■','◆'],rng),len=tier>=3?4:3;sequence=Array.from({length:len+2},(_,i)=>cycle[i%len]);answer=cycle[(len+2)%len];wrong=cycle.filter(x=>x!==answer);visual=true;explanation='تتكرر مجموعة الأشكال بالترتيب نفسه؛ الشكل التالي هو '+answer+'.';}
 if(kind===6){const shape=['●','◆','▲'][Math.floor(rng()*3)],step=tier>=4?2:1;sequence=Array.from({length:4},(_,i)=>shape.repeat(1+i*step));answer=shape.repeat(1+4*step);wrong=[2+4*step,3+4*step,4+4*step].map(k=>shape.repeat(k));visual=true;explanation='يزيد العدد بمقدار '+step+' في كل مجموعة؛ المجموعة التالية فيها '+(1+4*step)+' أشكال.';}
 if(kind===7){const arrows=['↑','→','↓','←'],start=Math.floor(rng()*4),step=tier>=4?3:1;sequence=Array.from({length:4},(_,i)=>arrows[(start+i*step)%4]);answer=arrows[(start+4*step)%4];wrong=arrows.filter(x=>x!==answer);visual=true;explanation='يدور الاتجاه ربع دورة '+(step===1?'مع عقارب الساعة':'عكس عقارب الساعة')+' في كل خطوة.';}
 if(kind===8){const names=shuffle(['راشد','سالم','ماجد','فهد'],rng);question=names[0]+' أطول من '+names[1]+'، و'+names[1]+' أطول من '+names[2]+'، و'+names[2]+' أطول من '+names[3]+'. من الأطول؟';answer=names[0];wrong=names.slice(1);explanation='الترتيب من الأطول للأقصر: '+names.join('، ثم ')+'.';}
 if(kind===9){sequence=['مثلث','مربع','خماسي','سداسي'];answer='سباعي';wrong=['ثماني','مثلث','عشاري'];explanation='عدد الأضلاع يزيد واحدًا: 3، 4، 5، 6؛ التالي شكل له 7 أضلاع.';}
 // Deduplicate distractors, then fill mathematically, without changing the answer.
 wrong=[...new Set(wrong)].filter(v=>v!==answer);for(let k=1;wrong.length<3;k++){const v=typeof answer==='number'?answer+k*7:'خيار '+k;if(v!==answer&&!wrong.includes(v))wrong.push(v);}
 return {kind,category:LOGIC_CATEGORIES[kind],difficulty:tier,question,sequence,answer,options:shuffle([answer,...wrong.slice(0,3)],rng),explanation,visual};
}
export function createMemorySequence(length=6,rng=Math.random,cells=9){return shuffle(Array.from({length:cells},(_,i)=>i),rng).slice(0,Math.max(3,Math.min(cells,length)));}
export function stepMemorySequence(state,cell){
 if(!state.active||state.locked||!Number.isInteger(cell)||cell<0||cell>=state.deck.length)return {...state,accepted:false};
 const correct=state.sequence[state.cursor]===cell,cursor=correct?state.cursor+1:0,mistakes=(state.mistakes||0)+(correct?0:1),won=cursor===state.sequence.length,over=won||mistakes>=3;
 return {...state,cursor,mistakes,moves:(state.moves||0)+1,active:!over,won,over,correct,accepted:true};
}
