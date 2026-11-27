import {quickRoomSeats} from './quick-room-options-v33-14-1.js';
import {partyMode} from './party-modes.js?v=33.19.0';
// 33.9.1: five seconds before the first game, the same as between games
export const PARTY_CAPACITY=20,PARTY_COUNTDOWN_MS=5000,PARTY_BREAK_MS=10000;
// 33.10.6: a list holds every game of the room (there are more than twenty now)
export const PLAYLIST_MAX=30;
export const PARTY_GAMES=Object.freeze([
// 33.10.6: in the order people look for them: questions, quick wits, table games, duels and
// arenas, then the puzzles
 {id:'quiz',name:'تحدي العباقرة',kind:'quiz',real:true,image:'assets/game-cards-v27/quiz.svg',hint:'نفس الأسئلة والوقت للجميع، مع الصور والصوت والذاكرة.'},
// 33.12.0: the two new games, each player on the same rounds
 {id:'blocks',name:'رص البلوكات',kind:'puzzle',real:true,image:'assets/brand/blocks-cover-v33-15.svg',hint:'نفس القطع للجميع ودقيقتين؛ أعلى نقاط يفوز.'},
 {id:'ten',name:'عشر ثواني',kind:'reaction',maxPlayers:8,real:true,linkOnly:true,image:'assets/brand/ten-cover-v33-12.svg',hint:'وقّف على عشر ثواني بالضبط بدون عدّاد؛ الأبعد يطلع كل جولة.'},
 {id:'logic',name:'المنطق',kind:'quiz',real:true,image:'assets/game-cards-v27/logic.svg',hint:'أنماط وحساب واستنتاج، بنفس الأسئلة والوقت للجميع.'},
 {id:'wordbomb',name:'صيد الكلمات',kind:'reaction',real:true,image:'assets/challenges/wordbomb.svg',hint:'شبكة حروف وكلمات مخفية؛ أول من يلقى الكلمة ياخذ نقاطها، حتى 20 لاعبًا.'},
 {id:'focus',name:'مواجهة التركيز',kind:'reaction',real:true,image:'assets/challenges/focus.svg',hint:'20 لاعبًا و14 تحدي تركيز متبدّل.'},
 {id:'cipher',name:'ساحة الشفرات',kind:'puzzle',real:true,image:'assets/challenges/cipher.svg',hint:'اختر أي خصم واكشف شفرته لإقصائه؛ الفوز لآخر لاعب.'},
 {id:'ludo',name:'لودو',kind:'board',maxPlayers:6,real:true,linkOnly:true,image:'assets/brand/ludo-cover-v33-15.webp',hint:'نفس قواعد لودو؛ اختر أربعة أو ستة لاعبين، ولكل لاعب لونه وبيته.'},
 {id:'jackaroo',name:'جاكارو',kind:'board',maxPlayers:6,real:true,image:'assets/arena/jackaroo-table-v17.webp',hint:'فريقان على الطاولة نفسها لأربعة أو ستة، وتكتمل المقاعد تلقائيًا.'},
 {id:'chaos',name:'أونو',kind:'board',maxPlayers:8,real:true,image:'assets/challenges/uno-table.svg',hint:'طابق اللون والرقم، اعكس الدور، ونادِ أونو. طاولات حتى 8 لاعبين.'},
 {id:'snakes',name:'الثعابين والسلالم',kind:'board',maxPlayers:10,real:true,image:'assets/brand/snakes-studio-v29-1.webp',hint:'اللوحة الكبيرة نفسها بثعابينها وسلالمها، عشرة في كل طاولة.'},
 {id:'dice',name:'تحدي النرد',kind:'board',real:true,maxPlayers:10,image:'assets/brand/dice-studio-v26.webp',hint:'ارمِ أو ثبّت رصيدك؛ الحظ والخطة يصنعان الفارق.'},
 {id:'pegs',name:'سر الألوان',kind:'board',maxPlayers:6,real:true,linkOnly:true,image:'assets/brand/pegs-cover-v33-10-3.webp',hint:'احفظ الألوان واقلب القطعة الصح، حتى ستة في كل طاولة.'},
 {id:'billiards',name:'بلياردو',kind:'board',maxPlayers:2,real:true,linkOnly:true,image:'assets/brand/billiards-cover-33-10-nov14.webp',hint:'كرات 8 بين اثنين؛ الغرفة تنقسم طاولات، اثنين في كل طاولة.'},
 {id:'carrom',name:'كيرم',kind:'board',maxPlayers:2,real:true,linkOnly:true,image:'assets/brand/carrom-cover-v33-9-6.webp',hint:'دخّل أقراصك والملكة قبل خصمك، اثنين في كل طاولة.'},
 {id:'hockey',name:'هوكي الهواء',kind:'arena',maxPlayers:2,real:true,linkOnly:true,image:'assets/brand/air-hockey-cover-v33-7.svg',hint:'مواجهة اثنين على طاولة الهوكي، أول من يسجل 5 أهداف يفوز.'},
 {id:'tanks',name:'معركة الدبابات',kind:'arena',maxPlayers:4,real:true,linkOnly:true,image:'assets/brand/tanks-arena-cover-nov14.webp',hint:'آخر دبابة في الساحة تفوز، أربعة في كل ساحة، والمقاعد الفاضية تكملها دبابات منافسة.'},
 {id:'tower',name:'برج التحديات',kind:'arena',maxPlayers:8,real:true,linkOnly:true,image:'assets/brand/tower-cover-v33-18.webp',hint:'سباق عقبات ثلاثي الأبعاد: أول واحد يوصل القمة يفوز، وتقدرون تتدافعون في الطريق.'},
 {id:'serpent',name:'حلبة الثعابين',kind:'arena',real:true,image:'assets/brand/sovereign-hero.webp',hint:'الجميع في الحلبة نفسها، بقواعد الرأس والذيل والقدرات.'},
 {id:'jewels',name:'ماستر الجواهر',kind:'puzzle',maxPlayers:2,real:true,linkOnly:true,image:'assets/brand/jewels-cover-v33-16.svg',hint:'بدّل الجواهر واصنع السلاسل؛ يتساوى الجميع في البداية والحركات.'},
 {id:'sudoku',name:'سودوكو',kind:'puzzle',real:true,image:'assets/game-cards-v27/sudoku.svg',hint:'نفس اللوحة للجميع، وخمس محاولات خطأ لكل لاعب.'},
 {id:'memory',name:'الذاكرة',kind:'puzzle',real:true,image:'assets/game-cards-v27/memory.svg',hint:'نفس الأزواج للجميع، ولا تُكشف إلا البطاقات التي تقلبها.'},
 {id:'picture',name:'سباق الصور',kind:'puzzle',real:true,image:'assets/ai-v19/garden.webp',hint:'ركّب الصورة قطعة قطعة قبل أصحابك.'},
 {id:'paths-online',name:'توصيل الأرقام',kind:'puzzle',real:true,image:'assets/game-cards-v27/paths-online.svg',hint:'صِل الأرقام المتطابقة على نفس اللوحة قبل أصحابك.'},
 {id:'puzzle',name:'ترتيب الأرقام',kind:'puzzle',real:true,image:'assets/game-cards-v27/puzzle.svg',hint:'حرّك الأرقام إلى الفراغ حتى تكتمل اللوحة.'},
]);
// 33.10.6: الزهرة made way for لودو; an old list that still names it plays لودو
const ALIAS={paths:'paths-online',reaction:'focus',zahra:'ludo'};
export const partyGame=id=>PARTY_GAMES.find(game=>game.id===(ALIAS[id]||id))||null;
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
 if(!Array.isArray(value)||value.length<1||value.length>PLAYLIST_MAX)throw Error('اختر من لعبة إلى '+PLAYLIST_MAX+' لعبة في القائمة');
 return value.map(row=>{const requested=typeof row==='string'?row:row?.game,game=ALIAS[requested]||requested;if(!partyGame(game))throw Error('لعبة غير معروفة');const difficulty=row?.difficulty??2,duration=row?.duration??180;if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!Number.isInteger(duration)||duration<60||duration>900)throw Error('اختر صعوبة من 1 إلى 5 ومدة من دقيقة إلى 15 دقيقة');const worldId=row?.worldId??'classic';if(!['classic','neon','forest','crystals','volcano','ruins','storm'].includes(worldId))throw Error('خريطة غير معروفة');const extra={};if(row?.seats!==undefined){const options=quickRoomSeats(game,partyMode(game,row),partyGame(game).maxPlayers||20);if(!Number.isInteger(row.seats)||!options.includes(row.seats))throw Error('عدد اللاعبين غير متاح لهذا الطور');extra.seats=row.seats;}if(row?.mode!==undefined){extra.mode=partyMode(game,requested==='zahra'?{...row,mode:row.mode==='quick'?'ludo-quick':row.mode==='classic'?'ludo':row.mode}:row);if(game==='memory')extra.memoryMode=extra.mode;}if(game==='quiz'&&row?.categories!==undefined){const ids=row.categories;if(!Array.isArray(ids)||ids.length>40||ids.some(id=>typeof id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{1,31}$/.test(id)))throw Error('أقسام الأسئلة غير صحيحة');const unique=[...new Set(ids)];if(unique.length)extra.categories=unique;}if(game==='memory'){if(row.memoryTheme!==undefined){if(!['classic','wildlife','space','vehicles','ocean'].includes(row.memoryTheme))throw Error('مجموعة صور غير معروفة');extra.memoryTheme=row.memoryTheme;}if(row.memoryMode!==undefined){if(!['pairs','sequence'].includes(row.memoryMode))throw Error('نمط ذاكرة غير معروف');extra.memoryMode=extra.mode??row.memoryMode;}}return{game,difficulty,duration,worldId,...extra};});
}

export const playlistCapacity=()=>PARTY_CAPACITY;
