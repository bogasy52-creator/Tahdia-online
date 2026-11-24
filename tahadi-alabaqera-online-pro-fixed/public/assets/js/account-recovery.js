(()=>{
 const $=id=>document.getElementById(id),api=window.BS_SOCIAL;if(!api||!$('recoveryForm'))return;let epoch=0;
 const message=text=>{$('recoveryMessage').textContent=text;};
 function clear(){epoch++;$('recoveryCodes').replaceChildren();$('recoveryCopy').hidden=true;$('recoveryPassword').value='';}
 function recovery(on){$('recoveryForm').classList.toggle('hidden',!on);$('loginForm').classList.toggle('hidden',on);$('signupForm').classList.add('hidden');$('recoveryNotice').textContent='';if(on)$('recoveryUsername').focus();}
 $('forgotPassword').onclick=()=>recovery(true);$('recoveryBack').onclick=()=>recovery(false);
 for(const id of ['loginTab','signupTab'])$(id).addEventListener('click',()=>{$('recoveryForm').classList.add('hidden');});
 $('recoveryForm').onsubmit=async event=>{
  event.preventDefault();const button=$('recoveryReset'),password=$('recoveryNewPassword').value;if(password!==$('recoveryConfirm').value){$('recoveryNotice').textContent='كلمتا المرور غير متطابقتين.';return;}
  button.disabled=true;$('recoveryNotice').textContent='جاري التحقق…';
  try{await api.recover({username:$('recoveryUsername').value.trim(),code:$('recoveryCode').value.trim(),password});$('loginUsername').value=$('recoveryUsername').value.trim();$('recoveryForm').reset();recovery(false);window.BS_PLATFORM?.toast?.('تم تغيير كلمة المرور. سجّل دخولك بكلمتك الجديدة.');}catch(error){$('recoveryNotice').textContent=error.message;}finally{button.disabled=false;}
 };
 $('recoveryIssue').onclick=async()=>{
  const password=$('recoveryPassword').value;if(!password){message('اكتب كلمة المرور الحالية لتأكيد ملكية الحساب.');return;}
  const button=$('recoveryIssue'),run=++epoch,username=api.profile()?.username;button.disabled=true;message('جاري إنشاء رموز جديدة…');
  try{const result=await api.recoveryCodes(password);$('recoveryPassword').value='';if(run!==epoch||api.profile()?.username!==username)return;$('recoveryCodes').replaceChildren();for(const code of result.codes){const n=document.createElement('code');n.dir='ltr';n.textContent=code;$('recoveryCodes').append(n);}$('recoveryCopy').hidden=false;message('احفظ الرموز الآن في مكان آمن. كل رمز يستخدم مرة واحدة. الصلاحية حتى '+new Date(result.expiresAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')+'. أُلغيت الرموز السابقة.');}catch(error){if(run===epoch)message(error.message);}finally{button.disabled=false;}
 };
 $('recoveryCopy').onclick=async()=>{const text=[...$('recoveryCodes').querySelectorAll('code')].map(n=>n.textContent).join('\n');try{await navigator.clipboard.writeText('لعبة العباقرة · '+api.profile()?.username+'\n'+text);message('تم النسخ؛ احفظها خارج هذا الجهاز في مكان آمن.');}catch{message('تعذّر النسخ التلقائي؛ حدد الرموز وانسخها يدويًا.');}};
 async function status(){clear();if(!api.isLoggedIn())return;const run=epoch;try{const r=await api.recoveryStatus();if(run===epoch)message(r.remaining?'عندك '+r.remaining+' رموز صالحة. إنشاء مجموعة جديدة يلغي السابقة.':'احمِ تقدمك: أنشئ رموز الاسترجاع واحفظها قبل أن تنسى كلمة المرور.');}catch(error){if(run===epoch)message(error.message);}}
 $('logoutBtn')?.addEventListener('click',clear);window.addEventListener('storage',e=>{if(e.key==='bs_social_session')status();});document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 if(typeof MutationObserver==='function')new MutationObserver(()=>{if(!$('appPanel').classList.contains('hidden'))status();}).observe($('appPanel'),{attributes:true,attributeFilter:['class']});status();
})();
