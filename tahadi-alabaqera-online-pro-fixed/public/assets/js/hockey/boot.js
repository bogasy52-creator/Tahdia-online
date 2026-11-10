const status=document.getElementById('hockeyBootStatus');
let loading=false,ready=false;
async function boot(){if(loading||ready)return;loading=true;if(status)status.textContent='نجهّز الطاولة…';
 try{await import('./main.js?v=33.9.5-studio1');ready=true;if(status)status.hidden=true;}
 catch(error){console.error('Hockey startup failed',error);if(status){status.replaceChildren();status.append(document.createTextNode('تعذّر تحميل اللعبة. تحقق من الاتصال ثم أعد المحاولة. '));const b=document.createElement('button');b.type='button';b.textContent='إعادة التحميل';b.onclick=()=>location.reload();status.append(b);}}
 finally{loading=false;}}
boot();
