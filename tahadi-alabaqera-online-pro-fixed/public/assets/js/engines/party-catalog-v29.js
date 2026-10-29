export const PARTY_CAPACITY=20,PARTY_COUNTDOWN_MS=10000,PARTY_BREAK_MS=10000;
export const PARTY_GAMES=Object.freeze([
 {id:'serpent',name:'حلبة الثعابين',kind:'arena',real:true,image:'assets/brand/sovereign-hero.webp',hint:'الجميع في الحلبة نفسها، بقواعد الرأس والذيل والقدرات.'},
 {id:'snakes',name:'الثعبان والسلالم',kind:'board',maxPlayers:10,real:true,image:'assets/brand/snakes-studio-v29-1.webp',hint:'اللوحة الكبيرة نفسها بثعابينها وسلالمها، عشرة في كل طاولة.'},
 {id:'jackaroo',name:'جاكارو',kind:'board',maxPlayers:6,real:true,image:'assets/arena/jackaroo-table-v17.webp',hint:'فريقان على الطاولة نفسها لأربعة أو ستة، والبوتات تكمل الناقص.'},
 {id:'zahra',name:'الزهرة',kind:'board',maxPlayers:6,real:true,image:'assets/game-cards-v27/zahra.svg',hint:'ستة ألوان، وأربعة أحجار لكل لاعب، ستة في كل طاولة.'},
 {id:'dice',name:'تحدي النرد',kind:'board',maxPlayers:10,image:'assets/brand/dice-studio-v26.webp',hint:'ارمِ أو ثبّت رصيدك؛ الحظ والخطة يصنعان الفارق.'},
 {id:'quiz',name:'تحدي العباقرة',kind:'quiz',real:true,image:'assets/game-cards-v27/quiz.svg',hint:'نفس الأسئلة والوقت للجميع، مع الصور والصوت والذاكرة.'},
 {id:'sudoku',name:'سودوكو',kind:'puzzle',real:true,image:'assets/game-cards-v27/sudoku.svg',hint:'نفس اللوحة للجميع، وخمس محاولات خطأ لكل لاعب.'},
 {id:'jewels',name:'ماستر الجواهر',kind:'puzzle',image:'assets/game-cards-v27/jewels.svg',hint:'بدّل الجواهر واصنع السلاسل؛ يتساوى الجميع في البداية والحركات.'},
 {id:'paths-online',name:'توصيل الأرقام',kind:'puzzle',real:true,image:'assets/game-cards-v27/paths-online.svg',hint:'صِل الأرقام المتطابقة على نفس اللوحة قبل أصحابك.'},
 {id:'picture',name:'سباق الصور',kind:'puzzle',real:true,image:'assets/ai-v19/garden.webp',hint:'ركّب الصورة قطعة قطعة قبل أصحابك.'},
 {id:'memory',name:'الذاكرة',kind:'puzzle',image:'assets/game-cards-v27/memory.svg',hint:'نفس الأزواج للجميع، ولا تُكشف إلا البطاقات التي تقلبها.'},
 {id:'reaction',name:'سرعة الاستجابة',kind:'reaction',image:'assets/game-cards-v27/reaction.svg',hint:'انتظر الأخضر، ثم اضغط. عدة محاولات وترتيب نهائي.'},
 {id:'logic',name:'المنطق',kind:'quiz',image:'assets/game-cards-v27/logic.svg',hint:'أنماط وحساب واستنتاج، بنفس الأسئلة والوقت للجميع.'},
 {id:'puzzle',name:'ترتيب الأرقام',kind:'puzzle',image:'assets/game-cards-v27/puzzle.svg',hint:'حرّك الأرقام إلى الفراغ حتى تكتمل اللوحة.'},
]);
export const partyGame=id=>PARTY_GAMES.find(game=>game.id===(id==='paths'?'paths-online':id))||null;
// 32.1.0: every game has its own seat limit; turn games stay small enough to play.
// 33.0.0: every game takes the whole room (20). A table game seats `maxPlayers` per
// table, so a bigger room plays it on several tables at once.
export const tableSize=id=>partyGame(id)?.maxPlayers||PARTY_CAPACITY;
export const gameCapacity=()=>PARTY_CAPACITY;
/** How many tables (and how many on each) a game needs for this many players. */
export function tablesFor(id,players){const size=tableSize(id),count=Math.max(1,Math.ceil(Math.max(1,players)/size));return Array.from({length:count},(_,i)=>Math.floor(players/count)+(i<players%count?1:0));}
export function playersLabel(n){n=Number(n)||0;return n===1?'لاعب واحد':n===2?'لاعبان':n<=10?n+' لاعبين':n+' لاعبًا';}
export function limitingGame(){return null;}
export function capacityMessage(rows){const id=limitingGame(rows);return id?`«${partyGame(id).name}» حدها ${playersLabel(gameCapacity(id))}؛ عدد الغرفة الحالي أكبر`:'الغرفة ممتلئة';}
export function normalizePlaylist(value){
 if(!Array.isArray(value)||value.length<1||value.length>20)throw Error('اختر من لعبة إلى 20 لعبة في القائمة');
 return value.map(row=>{const requested=typeof row==='string'?row:row?.game,game=requested==='paths'?'paths-online':requested;if(!partyGame(game))throw Error('لعبة غير معروفة');const difficulty=row?.difficulty??2,duration=row?.duration??180;if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!Number.isInteger(duration)||duration<60||duration>900)throw Error('اختر صعوبة من 1 إلى 5 ومدة من دقيقة إلى 15 دقيقة');const worldId=row?.worldId??'classic';if(!['classic','neon','forest','crystals','volcano','ruins','storm'].includes(worldId))throw Error('خريطة غير معروفة');const extra={};if(game==='memory'){if(row.memoryTheme!==undefined){if(!['classic','wildlife','space','vehicles','ocean'].includes(row.memoryTheme))throw Error('مجموعة صور غير معروفة');extra.memoryTheme=row.memoryTheme;}if(row.memoryMode!==undefined){if(!['pairs','sequence'].includes(row.memoryMode))throw Error('نمط ذاكرة غير معروف');extra.memoryMode=row.memoryMode;}}return{game,difficulty,duration,worldId,...extra};});
}

export const playlistCapacity=()=>PARTY_CAPACITY;
