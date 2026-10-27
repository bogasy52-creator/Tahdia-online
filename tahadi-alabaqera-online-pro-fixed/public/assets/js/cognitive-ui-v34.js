export function createLogicQuestion(doc,q,{disabled=false,selected=-1,revealed=false,onChoose}={}){
 const root=doc.createElement('div');root.className='cognitive-question-v34';
 const tag=doc.createElement('span');tag.className='cognitive-category';tag.textContent=q.category||'تحدي المنطق';
 const title=doc.createElement('h3');title.textContent=q.question||'ما العنصر التالي؟';root.append(tag,title);
 if(q.sequence?.length){const sequence=doc.createElement('div');sequence.className='logic-sequence-v34'+(q.visual?' visual':'');sequence.dir='ltr';for(const item of [...q.sequence,'؟']){const tile=doc.createElement('span');tile.className=item==='؟'?'missing':'';tile.textContent=item;sequence.append(tile);}root.append(sequence);}
 const grid=doc.createElement('div');grid.className='logic-options';q.options.forEach((option,i)=>{const b=doc.createElement('button');b.type='button';b.className='bs-btn'+(i===selected?' selected':'')+(revealed&&String(option)===String(q.answer)?' right':'');b.textContent=option;b.disabled=disabled;b.onclick=()=>onChoose?.(i);grid.append(b);});root.append(grid);
 if(revealed){const explain=doc.createElement('p');explain.className='cognitive-explanation';explain.setAttribute('role','status');explain.textContent=q.explanation;root.append(explain);}return root;
}
