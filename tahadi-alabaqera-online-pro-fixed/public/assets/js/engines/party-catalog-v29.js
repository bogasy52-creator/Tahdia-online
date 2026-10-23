export const PARTY_CAPACITY=20,PARTY_COUNTDOWN_MS=20000,PARTY_BREAK_MS=10000;
export const PARTY_GAMES=Object.freeze([
 {id:'serpent',name:'حلبة الثعابين',kind:'arena',image:'assets/brand/sovereign-hero.webp',hint:'الجميع في الحلبة، مع نفس قواعد الرأس والذيل والقدرات.'},
 {id:'snakes',name:'الثعبان والسلالم',kind:'board',image:'assets/arena/arena-plate-v17.webp',hint:'حتى 20 لاعبًا على اللوحة نفسها؛ الرميات والتحرك من السيرفر.'},
 {id:'jackaroo',name:'جاكارو',kind:'board',maxPlayers:6,image:'assets/arena/jackaroo-table-v17.webp',hint:'حتى ستة لاعبين؛ فريقان، ولوحة تتسع لأحجار الجميع.'},
 {id:'zahra',name:'الزهرة',kind:'board',maxPlayers:6,image:'assets/game-cards-v27/zahra.svg',hint:'حتى ستة لاعبين؛ ستة ألوان، وأربعة أحجار منفصلة لكل لاعب.'},
 {id:'dice',name:'تحدي النرد',kind:'board',image:'assets/brand/dice-studio-v26.webp',hint:'ارمِ أو ثبّت رصيدك؛ الحظ والخطة يصنعان الفارق.'},
 {id:'quiz',name:'تحدي العباقرة',kind:'quiz',image:'assets/game-cards-v27/quiz.svg',hint:'نفس السؤال والوقت للجميع، مع أسئلة الصور والصوت والذاكرة.'},
 {id:'sudoku',name:'سودوكو',kind:'puzzle',image:'assets/game-cards-v27/sudoku.svg',hint:'نفس اللوحة للجميع. خمس محاولات خطأ، والنتيجة من الخادم.'},
 {id:'jewels',name:'ماستر الجواهر',kind:'puzzle',image:'assets/game-cards-v27/jewels.svg',hint:'بدّل الجواهر واصنع السلاسل؛ يتساوى الجميع في البداية والحركات.'},
 {id:'paths',name:'مسارات الألوان',kind:'puzzle',image:'assets/game-cards-v27/paths.svg',hint:'صِل الأزواج وغطِّ اللوحة؛ المسار الخطأ يعيد التحدي.'},
 {id:'paths-online',name:'توصيل الأرقام',kind:'puzzle',image:'assets/game-cards-v27/paths-online.svg',hint:'صِل الأرقام المتطابقة على لوحة مشتركة في صعوبتها وبدايتها.'},
 {id:'picture',name:'سباق الصور',kind:'puzzle',image:'assets/ai-v19/garden.webp',hint:'قطع خارج الإطار، وصفّها قطعة قطعة قبل أصحابك.'},
 {id:'memory',name:'الذاكرة',kind:'puzzle',image:'assets/game-cards-v27/memory.svg',hint:'نفس الأزواج للجميع، ولا تُكشف إلا البطاقات التي تقلبها.'},
 {id:'reaction',name:'سرعة الاستجابة',kind:'reaction',image:'assets/game-cards-v27/reaction.svg',hint:'انتظر الأخضر، ثم اضغط. عدة محاولات وترتيب نهائي.'},
 {id:'logic',name:'المنطق',kind:'quiz',image:'assets/game-cards-v27/logic.svg',hint:'أنماط وحساب واستنتاج، بنفس الأسئلة والوقت للجميع.'},
 {id:'puzzle',name:'ترتيب الأرقام',kind:'puzzle',image:'assets/game-cards-v27/puzzle.svg',hint:'حرّك الأرقام إلى الفراغ حتى تكتمل اللوحة.'},
]);
export const partyGame=id=>PARTY_GAMES.find(game=>game.id===id)||null;
export function normalizePlaylist(value){
 if(!Array.isArray(value)||value.length<1||value.length>20)throw Error('اختر من لعبة إلى 20 لعبة في القائمة');
 return value.map(row=>{const game=typeof row==='string'?row:row?.game;if(!partyGame(game))throw Error('لعبة غير معروفة');const difficulty=row?.difficulty??2,duration=row?.duration??180;if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!Number.isInteger(duration)||duration<60||duration>900)throw Error('اختر صعوبة من 1 إلى 5 ومدة من دقيقة إلى 15 دقيقة');const worldId=row?.worldId??'classic';if(!['classic','neon','forest','crystals','volcano','ruins','storm'].includes(worldId))throw Error('خريطة غير معروفة');return{game,difficulty,duration,worldId};});
}

export const playlistCapacity=rows=>Math.min(20,...rows.map(row=>partyGame(typeof row==='string'?row:row.game)?.maxPlayers||20));
