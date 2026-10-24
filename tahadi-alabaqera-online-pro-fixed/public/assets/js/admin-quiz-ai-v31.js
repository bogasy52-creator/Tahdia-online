/* Tahdia 31.0.0 — the manager adds AI pictures to the quiz.
   Each picture is generated on the server with the OpenAI key stored as the
   AI_IMAGE_API_KEY secret, one at a time, within a daily limit. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),LEVEL={100:'سهل',200:'متوسط',300:'صعب'};
 const token=()=>{try{return localStorage.getItem('bs_social_session')||''}catch{return ''}};
 let pack=null,busy=false;
 const errors={not_configured:'التوليد غير مفعّل بعد: أضف مفتاح OpenAI باسم AI_IMAGE_API_KEY في Cloudflare (Workers › tahdia-online › Settings › Variables and Secrets) ثم حدّث الصفحة.',daily_limit:'وصلت حد اليوم من الصور. يتجدد الحد بعد منتصف الليل بتوقيت السعودية.',busy:'فيه صورة قيد التوليد الآن، انتظر لحظات.',complete:'كل الصور المتاحة جاهزة.',generation_failed:'تعذر توليد الصورة هذه المرة. أعد المحاولة بعد قليل.',unauthorized:'سجّل الدخول بحساب BoSraG.',forbidden:'هذه الأداة لحساب المدير فقط.',not_found:'الصورة غير موجودة.'};
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
 async function call(path,body){
  const response=await fetch('/api/quiz/ai/'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token()},body:JSON.stringify(body||{}),cache:'no-store',signal:AbortSignal.timeout(150000)});
  const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error||'request_failed');error.status=response.status;throw error;}return data;
 }
 function say(text){$('aiQuizMessage').textContent=text||'';}
 function setBusy(value){busy=value;for(const id of ['aiQuizOne','aiQuizBatch','aiQuizRefresh'])$(id).disabled=value||(!pack?.enabled&&id!=='aiQuizRefresh');$('aiQuizGrid').querySelectorAll('button').forEach(b=>b.disabled=value);}
 function render(){
  if(!pack)return;const ready=pack.items?.length||0;
  $('aiQuizReady').textContent=String(ready);$('aiQuizTotal').textContent='من '+pack.total+' صورة';$('aiQuizMeter').style.width=Math.round(ready/Math.max(1,pack.total)*100)+'%';
  $('aiQuizStatus').textContent=!pack.enabled?errors.not_configured:(pack.category?'فئة «صور الذكاء» ظاهرة للاعبين في التحدي المحلي والأونلاين.':'تظهر فئة «صور الذكاء» للاعبين بعد صورتين من كل مستوى.')+' صور اليوم: '+pack.usedToday+' من '+pack.limit+'.';
  const grid=$('aiQuizGrid');grid.replaceChildren();
  for(const q of pack.items||[]){
   const id=String(q.id).replace(/^ai-pic-/,''),card=node('article','admin-ai-card'),img=node('img');img.src=q.src;img.alt=q.a;img.loading='lazy';img.decoding='async';
   const copy=node('div');copy.append(node('b',null,q.a),node('small',null,(LEVEL[q.v]||'')+' · '+q.v+' نقطة'));
   const tools=node('nav'),again=node('button',null,'أعد التوليد'),remove=node('button',null,'احذف');again.type=remove.type='button';
   again.onclick=()=>generate(1,id);remove.onclick=()=>removeOne(id,q.a);tools.append(again,remove);card.append(img,copy,tools);grid.append(card);
  }
  setBusy(busy);
 }
 async function load(){try{pack=await call('status');$('adminQuizAi').hidden=false;render();}catch(error){if(error.status===401||error.status===403){$('adminQuizAi').hidden=true;return;}$('adminQuizAi').hidden=false;say('تعذر تحميل حالة الصور. تأكد أن السيرفر محدّث.');}}
 async function generate(count,id){
  if(busy)return;setBusy(true);let made=0;
  try{
   for(let i=0;i<count;i++){say('جاري توليد الصورة '+(i+1)+' من '+count+'… قد تأخذ دقيقة.');pack=await call('generate',id?{id}:{});made++;render();setBusy(true);if(id)break;}
   say(made===1?'أُضيفت صورة جديدة إلى التحدي.':'أُضيفت '+made+' صور جديدة إلى التحدي.');
  }catch(error){say((made?'أُضيفت '+made+' ثم توقف التوليد: ':'')+(errors[error.message]||'تعذر التوليد: '+error.message));}
  finally{setBusy(false);render();}
 }
 async function removeOne(id,name){if(busy||!window.confirm?.('حذف صورة «'+name+'» من التحدي؟'))return;setBusy(true);try{pack=await call('remove',{id});say('حُذفت صورة «'+name+'».');}catch(error){say(errors[error.message]||'تعذر الحذف.');}finally{setBusy(false);render();}}
 $('aiQuizOne').onclick=()=>generate(1);$('aiQuizBatch').onclick=()=>generate(6);$('aiQuizRefresh').onclick=()=>{say('');load();};
 if(token())load();
 window.BS_ADMIN_AI=Object.freeze({load,generate,get pack(){return pack;}});
})();
