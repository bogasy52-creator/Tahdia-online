(function(){
 'use strict';
 const $=id=>document.getElementById(id),actionNames={coins:'تعديل العملات',xp:'إضافة الخبرة','unlock-item':'فتح إضافة','unlock-all':'فتح المقتنيات',suspend:'إيقاف الحساب',restore:'تفعيل الحساب',revoke:'إنهاء الجلسات',announcement:'نشر إعلان','clear-announcement':'إزالة الإعلان'};
 const PENDING='busraj-admin-pending-v11:bosrag';let allowed=false,busy=false,selected=null;
 const token=()=>localStorage.getItem('bs_social_session')||'';
 function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
 function tell(text){$('adminMessage').textContent=text}
 function outstanding(){try{return JSON.parse(localStorage.getItem(PENDING)||'null')}catch{return null}}
 function syncRetry(){$('adminRetry').classList.toggle('hidden',!outstanding());$('adminRetry').disabled=busy}
 function setBusy(value){busy=value;$('adminWorkspace').querySelectorAll('button').forEach(b=>b.disabled=value);syncRetry()}
 function errorLabel(error){const messages={server_update_required:'واجهة الإدارة محدثة، لكن السيرفر يحتاج تحديث الحزمة كاملة. نشر الواجهة وحدها لا يفعّل مدير BoSraG أو غرف الأونلاين.',unauthorized:'سجّل الدخول بحساب BoSraG لفتح لوحة المدير.',forbidden:'هذه اللوحة مخصّصة لحساب المدير BoSraG. إذا كان هذا حسابك، حدّث السيرفر وأعد تسجيل الدخول.',account_not_found:'الحساب غير موجود.',invalid_username:'اسم الحساب غير صالح.',invalid_amount:'العدد غير صالح أو يتجاوز الرصيد والحد المسموح.',owner_protected:'حساب المدير محمي من الإيقاف وإنهاء جلساته.',request_conflict:'رقم الطلب استُخدم لعملية أخرى.',invalid_item:'الإضافة غير صالحة لهذا الحساب.',invalid_announcement:'اكتب نص الإعلان أولًا.'};return messages[error.message]||'تعذر إكمال الطلب: '+error.message}
 async function request(path,body,session=token()){
  const response=await fetch('/api/social/admin'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+session},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(9000)});
  const data=await response.json().catch(()=>({}));if(session!==token())throw new Error('تغيّر الحساب — أعد تسجيل الدخول');if(!response.ok){const e=new Error([404,405].includes(response.status)&&!path?'server_update_required':data.error||'تعذر الاتصال');e.status=response.status;throw e}if(!path&&!data.access)throw new Error('server_update_required');return data;
 }
 function paintAccount(account){
  selected=account;$('adminUsername').value=account.profile.username;const box=$('adminAccount');box.replaceChildren();box.append(node('h3',null,account.profile.displayName),node('span','account-handle','@'+account.profile.username),node('span','account-status'+(account.suspended?' suspended':''),account.suspended?'موقوف':'نشط'));
  const stats=node('div','account-values');for(const [label,value]of [['العملات',account.career.coins],['الخبرة',account.career.xp],['المستوى',account.career.level],['المقتنيات',account.career.owned.length]]){const e=node('div');e.append(node('b',null,value),node('small',null,label));stats.appendChild(e)}box.appendChild(stats);$('adminActionForm').classList.remove('hidden');
  const items=$('adminItem');items.replaceChildren();for(const item of window.BS_CAREER_CORE?.CATALOG||[]){if(item.source==='owner'&&account.profile.username!=='bosrag')continue;const o=node('option',null,item.name+(account.career.owned.includes(item.id)?' · مملوك':''));o.value=item.id;items.appendChild(o)}paintAction();
 }
 function paintAction(){
  const action=$('adminAction').value;$('adminAmountField').classList.toggle('hidden',!['coins','xp'].includes(action));$('adminItemField').classList.toggle('hidden',action!=='unlock-item');$('adminAmountLabel').textContent=action==='xp'?'خبرة التقدم · رقم موجب':'العملات · رقم موجب للإضافة، وسالب للخصم';$('adminAmount').min=action==='xp'?'1':'-100000';
  const help={coins:'من 1 إلى 100000 عملة في العملية. الخصم لا يجعل الرصيد سالبًا.',xp:'خبرة التقدم ترفع المستوى. رتبة الأونلاين تُكتسب بالمباريات الموثّقة.',suspend:'يمنع تسجيل الدخول ويُنهي جلسات الحساب حتى تعيد تفعيله.',restore:'يعيد الدخول للحساب مع الحفاظ على تقدمه ومقتنياته.',revoke:'ينهي جلسات الدخول الحالية. يستطيع اللاعب تسجيل الدخول مرة أخرى.', 'unlock-all':'يفتح كل المقتنيات للاعب دون تغيير رصيده.', 'unlock-item':'يفتح الإضافة المختارة دون خصم عملات.'};$('adminActionHelp').textContent=help[action]||'';
 }
 function paintAudit(data){
  const list=$('adminAudit');list.replaceChildren();for(const entry of data.audit||[]){const row=node('tr');const date=new Date(entry.at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const detail=[entry.amount?String(entry.amount):'',entry.item?window.BS_CAREER_CORE?.CATALOG.find(i=>i.id===entry.item)?.name||entry.item:'',entry.reason||''].filter(Boolean).join(' · ');for(const value of [date,entry.username||'الحلبة',actionNames[entry.action]||entry.action,detail||'—'])row.appendChild(node('td',null,value));list.appendChild(row)}$('adminAuditEmpty').classList.toggle('hidden',Boolean(data.audit?.length));$('adminCurrentAnnouncement').textContent=data.announcement?.text||'لا يوجد إعلان حالي.';
 }
 async function load(){
  const session=token();allowed=false;$('adminWorkspace').classList.add('hidden');$('adminAccess').classList.remove('hidden');
  try{if(!session)throw new Error('unauthorized');const data=await request('',undefined,session);if(data.access?.role!=='owner')throw new Error('forbidden');allowed=true;paintAudit(data);$('adminWorkspace').classList.remove('hidden');$('adminAccess').classList.add('hidden');if(outstanding())tell('لديك طلب ينتظر التحقق. اضغط «تحقّق من نتيجة الطلب السابق» لمعرفة نتيجته.');syncRetry()}
  catch(error){$('adminAccessMessage').textContent=errorLabel(error)}
 }
 async function search(){if(!allowed||busy)return;setBusy(true);try{const name=$('adminUsername').value.trim().toLowerCase();const data=await request('/account?username='+encodeURIComponent(name));paintAccount(data.account);tell('تم عرض حساب '+name)}catch(error){selected=null;$('adminAccount').textContent=errorLabel(error);$('adminActionForm').classList.add('hidden');tell(errorLabel(error))}finally{setBusy(false)}}
 async function run(command){
  if(!allowed||busy)return;const old=outstanding();if(old&&JSON.stringify({...old,requestId:undefined})!==JSON.stringify({...command,requestId:undefined})){tell('تحقّق من الطلب السابق أولًا حتى لا تتكرر العملية.');return}
  const body=old||{...command,requestId:'admin-'+crypto.randomUUID()};localStorage.setItem(PENDING,JSON.stringify(body));setBusy(true);tell('جاري تنفيذ العملية…');
  try{const data=await request('/action',body);localStorage.removeItem(PENDING);if(data.account)paintAccount(data.account);if('announcement' in data){$('adminCurrentAnnouncement').textContent=data.announcement?.text||'لا يوجد إعلان حالي.';$('adminAnnouncement').value=''}tell((data.replayed?'تم التحقق من الطلب المحفوظ: ':'تم تنفيذ: ')+(actionNames[body.action]||body.action));try{paintAudit(await request(''))}catch{}}
  catch(error){if(error.status>=400&&error.status<500){localStorage.removeItem(PENDING);tell(errorLabel(error))}else tell('لم نتحقق من نتيجة العملية. استخدم زر التحقق لإعادة نفس الطلب بأمان.');if([401,403].includes(error.status)){allowed=false;$('adminWorkspace').classList.add('hidden');$('adminAccess').classList.remove('hidden');$('adminAccessMessage').textContent=errorLabel(error)}}
  finally{setBusy(false)}
 }
 $('adminSearchForm').onsubmit=e=>{e.preventDefault();return search()};$('adminAction').onchange=paintAction;
 $('adminActionForm').onsubmit=e=>{e.preventDefault();if(!selected||!allowed)return;tell('');const action=$('adminAction').value;return run({username:selected.profile.username,action,amount:['coins','xp'].includes(action)?Number($('adminAmount').value):undefined,item:action==='unlock-item'?$('adminItem').value:undefined,reason:$('adminReason').value.trim()})};
 $('adminAnnouncementForm').onsubmit=e=>{e.preventDefault();return run({action:'announcement',text:$('adminAnnouncement').value.trim()})};$('adminRetry').onclick=()=>{const command=outstanding();if(command)return run(command)};
 $('adminClearAnnouncement').onclick=()=>run({action:'clear-announcement'});
 $('adminAccessRetry').onclick=()=>load();
 $('adminRefresh').onclick=async()=>{if(!allowed||busy)return;setBusy(true);try{paintAudit(await request(''));tell('السجل محدث')}catch(error){tell(errorLabel(error))}finally{setBusy(false)}};
 window.addEventListener('bs-social-session',()=>{selected=null;load()});window.addEventListener('storage',e=>{if(e.key==='bs_social_session'){selected=null;load()}});
 window.BS_ADMIN={ready:load(),search,refresh:load};
})();
