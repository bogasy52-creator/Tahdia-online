window.TahdiaMatchmaking={
 firebaseReady:false,queue:false,
 join(){
  this.queue=true;
  const old=document.getElementById('matchBox'); if(old)old.remove();
  const box=document.createElement('div'); box.id='matchBox';
  box.className='bs-panel';
  box.style='position:fixed;inset:15%;z-index:9999;padding:28px;text-align:center;display:grid;place-content:center;gap:12px';
  box.innerHTML=`<div style="font-size:48px">⚡</div><h2>البحث عن منافس</h2><p id="matchText">جاري الاتصال...</p><button class="bs-btn" id="cancelMatch">إلغاء</button>`;
  document.body.appendChild(box);
  box.querySelector('#cancelMatch').onclick=()=>{this.queue=false;box.remove()};
  const t=box.querySelector('#matchText');
  const wait=()=>{
   if(window.TahdiaOnline){
    t.textContent='تم تسجيلك في قائمة الانتظار';
    window.TahdiaOnline.addDoc(window.TahdiaOnline.collection(window.TahdiaOnline.db,'match_queue'),{createdAt:window.TahdiaOnline.serverTimestamp()});
   } else t.textContent='جاري تجهيز الاتصال...';
  };
  setTimeout(wait,800);
 }
};