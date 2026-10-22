import * as engine from './engines/quiz-relay-v28.js';

function render(container,view,{names={},connected={},onAnswer,onReady,onFinish,local=false}={}){
 container.replaceChildren();if(!view)return;
 const card=document.createElement('section');card.className='quiz-relay';card.setAttribute('aria-label','سلسلة الفريق');
 const top=document.createElement('div');top.className='relay-heading';const tag=document.createElement('span');tag.textContent='تعاون · كل جزء يكمل الآخر';const title=document.createElement('h3');title.textContent=view.title;top.append(tag,title);card.append(top);
 const progress=document.createElement('ol');progress.className='relay-members';
 for(const [index,id]of view.members.entries()){const item=document.createElement('li');item.className=index<view.stage?'is-complete':id===view.ownerId?'is-active':'';const mark=document.createElement('b');mark.textContent=index<view.stage?'✓':String(index+1);const name=document.createElement('span');name.textContent=names[id]||'اللاعب '+(index+1);item.append(mark,name);progress.append(item);}card.append(progress);
 const status=document.createElement('p');status.className='relay-status';status.setAttribute('role','status');
 if(view.complete){status.textContent='اكتملت السلسلة! كل واحد فيكم صنع الفرق · +50 تعاون';card.classList.add('is-complete');}
 else if(view.failed){status.textContent=view.endReason==='timeout'?'انتهى الوقت. يُحسب ما أنجزتم من أجزاء.':view.endReason==='stopped'?'أنهيتم المهمة. يُحسب ما أنجزتم من أجزاء.':'انتهت المحاولات الثلاث. يُحسب ما أنجزتم من أجزاء.';card.classList.add('is-failed');}
 else if(local&&!view.clue){status.textContent='سلّم الجهاز إلى '+(names[view.ownerId]||'زميلك')+'؛ عليه إكمال الجزء '+(view.stage+1);const ready=document.createElement('button');ready.type='button';ready.className='btn gold relay-ready';ready.textContent='جاهز لجزئي ←';ready.onclick=onReady;card.append(status,ready);}
 else if(!view.clue){status.textContent=(connected[view.ownerId]===false?'بانتظار عودة ':'الدور عند ')+(names[view.ownerId]||'زميلك')+' · شجّعه ليكمّل السلسلة';}
 else{status.textContent=`جزؤك ${view.stage+1} / ${view.count} · أخطاء الفريق ${view.mistakes} / ${view.maxMistakes}`;const clue=document.createElement('p');clue.className='relay-clue';clue.textContent=view.clue;const choices=document.createElement('div');choices.className='relay-choices';for(const [index,label]of view.options.entries()){const button=document.createElement('button');button.type='button';button.className='choice relay-choice';button.textContent=label;button.disabled=view.attempted.includes(index);if(button.disabled)button.classList.add('was-wrong');button.onclick=()=>{for(const child of choices.children)child.disabled=true;onAnswer?.(index,view.stageId);};choices.append(button);}card.append(clue,choices);}
 if(!status.parentElement)card.append(status);
 const note=document.createElement('small');note.className='relay-note';note.textContent='النقاط مشتركة للفريق. اكتمال كل الأجزاء يمنح 50 نقطة إضافية. ثلاث محاولات خطأ للفريق.';card.append(note);
 if(onFinish&&(view.complete||view.failed)){const finish=document.createElement('button');finish.type='button';finish.className='btn gold relay-finish';finish.textContent='احتسب نتيجة الفريق ←';finish.onclick=onFinish;card.append(finish);}
 container.append(card);
}
window.BS_QUIZ_TEAM=Object.freeze({...engine,render});
window.dispatchEvent(new Event('bs-quiz-team-ready'));
