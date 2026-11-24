/* Cosmetic table finishes. They never change a match, its rules, or shop ownership. */
(function(root){
  'use strict';
  if(root.BS_TABLE_STUDIO)return;
  const tables=Object.freeze([
    {id:'royal',name:'قاعة التاج',material:'مخمل بنفسجي · نحاس مشغول',surface:'#24133e',well:'#100b21',tile:'#302344',alternate:'#3a2a53',edge:'#bd995c',light:'#f7e0a0',accent:'#c7a1f5',room:'#160e28',pattern:'velvet'},
    {id:'jade',name:'حديقة اليشم',material:'حجر يشم · إطار برونزي',surface:'#163b34',well:'#0b201d',tile:'#21483e',alternate:'#285548',edge:'#c4a16b',light:'#f7e5b1',accent:'#8ce0bd',room:'#0b211e',pattern:'stone'},
    {id:'sapphire',name:'ليل الياقوت',material:'زجاج أزرق · فضة مصقولة',surface:'#172d4a',well:'#0b162b',tile:'#213a58',alternate:'#294664',edge:'#9ab9d6',light:'#e9f7ff',accent:'#8ccbf5',room:'#0c1628',pattern:'glass'},
    {id:'obsidian',name:'قصر الأوبسيديان',material:'رخام أسود · عروق ذهبية',surface:'#25252d',well:'#111116',tile:'#303039',alternate:'#393941',edge:'#c4a16b',light:'#ffe8b0',accent:'#e4c691',room:'#131319',pattern:'marble'},
    {id:'rose',name:'صالون الورد',material:'مخمل عنابي · ذهب وردي',surface:'#402232',well:'#26121f',tile:'#512d40',alternate:'#60394b',edge:'#d0a18f',light:'#ffe3d4',accent:'#edaec7',room:'#27131f',pattern:'velvet'},
    {id:'walnut',name:'ديوان الجوز',material:'خشب جوز · جلد محفور',surface:'#38291f',well:'#211812',tile:'#49362a',alternate:'#574233',edge:'#be9460',light:'#f4d9a7',accent:'#dcbf8d',room:'#241b16',pattern:'wood'}
  ].map(Object.freeze));
  const page=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
  const key='bs_table_studio_v1:'+page;
  let selected=tables[0],dialog,opener;
  try{selected=tables.find(t=>t.id===root.localStorage.getItem(key))||selected;}catch{}
  function apply(table,{persist=true}={}){
    if(!tables.includes(table))return;
    selected=table;
    const html=document.documentElement;
    html.dataset.tableStudio=table.id;html.dataset.tableMaterial=table.pattern;
    for(const field of ['surface','well','tile','alternate','edge','light','accent','room'])html.style.setProperty('--ts-'+field,table[field]);
    if(persist)try{root.localStorage.setItem(key,table.id);}catch{}
    document.querySelectorAll('[data-table-choice]').forEach(input=>{input.checked=input.value===table.id;});
    document.querySelectorAll('[data-table-name]').forEach(el=>{el.textContent=table.name;});
    root.dispatchEvent(new CustomEvent('bs:table-change',{detail:{id:table.id}}));
  }
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
  function build(){
    dialog=make('dialog','ts-dialog');dialog.setAttribute('aria-labelledby','tsTitle');
    const head=make('header','ts-head'),copy=make('div');
    copy.append(make('small','ts-eyebrow','على ذوقك'),Object.assign(make('h2',null,'اختر طاولتك'),{id:'tsTitle'}));
    const close=make('button','ts-close','×');close.type='button';close.setAttribute('aria-label','إغلاق الطاولات');close.addEventListener('click',()=>dialog.close());
    head.append(copy,close);dialog.append(head,make('p','ts-note','ست طاولات مجانية. اختر الخامة وشاهدها في لعبتك.'));
    const group=make('fieldset','ts-grid');group.append(make('legend','ts-sr','طاولات اللعب'));
    for(const table of tables){
      const label=make('label','ts-choice'),radio=make('input');radio.type='radio';radio.name='table-finish';radio.value=table.id;radio.dataset.tableChoice='';radio.checked=selected===table;
      radio.addEventListener('change',()=>{if(radio.checked)apply(table);});
      const preview=make('span','ts-mini');preview.dataset.material=table.pattern;preview.setAttribute('aria-hidden','true');
      for(const field of ['surface','well','tile','alternate','edge','light','accent'])preview.style.setProperty('--ts-'+field,table[field]);
      const cells=make('span','ts-mini-cells');for(let i=0;i<16;i++)cells.append(make('i'));preview.append(cells,make('span','ts-seal','✦'));
      label.append(radio,preview,make('b',null,table.name),make('small',null,table.material));group.append(label);
    }
    const done=make('button','ts-done','اعتمد الطاولة');done.type='button';done.addEventListener('click',()=>dialog.close());
    dialog.append(group,make('p','ts-local-note','اختيارك محفوظ لهذه اللعبة على جهازك.'),done);document.body.append(dialog);
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    dialog.addEventListener('close',()=>opener?.focus());
  }
  function open(event){if(!dialog)build();opener=event.currentTarget;dialog.showModal();dialog.querySelector('input:checked')?.focus();}
  function mount(){
    apply(selected,{persist:false});
    const hosts=new Set(document.querySelectorAll('.jw-top,.jw-bar,.ng-top,.bs-actions,.arcade-options-v16,.pegs-top-actions,.bi-top-actions'));
    if(page==='dice'){
      const utilities=document.querySelector('.v26-command-utilities');
      if(utilities)hosts.add(utilities);
    }
    if(!hosts.size){const h=document.querySelector('main header');if(h)hosts.add(h);}
    for(const host of hosts){
      if(host.closest('.v26-replaced-header'))continue;
      const button=make('button','ts-trigger');button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','اختيار طاولة اللعب');
      const icon=make('span','ts-trigger-art');icon.setAttribute('aria-hidden','true');const name=make('span','ts-trigger-label','الطاولة');
      button.append(icon,name);button.addEventListener('click',open);
      if(host.classList.contains('ng-top')){
        const tools=make('div','ts-top-tools'),sound=host.querySelector('button.ng-icon');
        if(sound)tools.append(sound);tools.append(button);host.append(tools);
      }else host.append(button);
    }
    root.addEventListener('storage',event=>{if(event.key===key)apply(tables.find(t=>t.id===event.newValue)||tables[0],{persist:false});});
  }
  root.BS_TABLE_STUDIO=Object.freeze({tables,get palette(){return selected;}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
