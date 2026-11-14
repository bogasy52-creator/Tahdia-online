/* A failed module load must leave a useful, recoverable menu. */
try{await import('./main.js?v=33.10.0-crowd1');}
catch(error){console.error('crowd startup',error);const status=document.getElementById('crLoad'),reload=document.getElementById('crReload');for(const id of['crStart','crDaily']){const button=document.getElementById(id);if(button)button.disabled=true;}if(status){status.classList.add('error');status.textContent='تعذّر تجهيز اللعبة. أعد التحميل للمحاولة مجددًا.';}if(reload){reload.hidden=false;reload.addEventListener('click',()=>location.reload());}}
