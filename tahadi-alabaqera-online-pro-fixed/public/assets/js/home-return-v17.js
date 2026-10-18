import * as progress from './journey-client.js?v=23.0.1';
const $=id=>document.getElementById(id);
function render(){const p=progress.get(),s=progress.stats(),day=progress.today();if(!$('homeJourneyProgress'))return;$('homeJourneyProgress').textContent=s.completed?s.completed+' مرحلة مكتملة · '+s.stars+' نجمة · كمّل من مكانك':'300 مرحلة تنتظرك · ابدأ أول نجمة';$('homeJewelsDaily').textContent=p.daily[day]?.jewels?'✓ اكتمل اليوم · '+p.daily[day].jewels+' نجوم':'لوحة اليوم جاهزة · ابدأ التحدي';$('homePathsDaily').textContent=p.daily[day]?.paths?'✓ اكتمل اليوم · '+p.daily[day].paths+' نجوم':'مسار جديد اليوم · جرّب حلك';}
window.addEventListener('tahdia-journey-change',render);window.addEventListener('bs-career-change',render);render();progress.ready.then(render);
