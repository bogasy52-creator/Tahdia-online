const rows=(...items)=>items.map(([id,label])=>Object.freeze({id,label}));
export const PARTY_MODES=Object.freeze({
 quiz:rows(['free','كل لاعب لحاله'],['teams','فريقان']),
 snakes:rows(['classic','الكلاسيكي'],['adventure','المطوّر'],['strategy','تكتيك'],['portals','بوابات الزمن'],['choice','مسار القرار'],['clash','صراع القمم']),
 jackaroo:rows(['classic','الكلاسيكي'],['quick','سريع · أول حجر']),
 zahra:rows(['classic','الكلاسيكي · ستة لاعبين'],['quick','سريع · أول حجر']),
 ludo:rows(['ludo','الكلاسيكي'],['ludo-quick','سريع · أول حجر']),
 chaos:rows(['classic','كلاسيكي'],['stack','سحب متراكم'],['quick','جولة سريعة']),
 pegs:rows(['classic','24 قطعة · 6 ألوان'],['large','48 قطعة · 8 ألوان'],['teams','فرق'],['race','سباق الذاكرة'],['race-large','السباق الكبير'],['bluff','خدعة الألوان'],['vault','خزنة الألوان']),
 tanks:rows(['ffa','الكل ضد الكل'],['teams','فريقان']),
 hockey:rows(['classic','أول 5 أهداف'],['quick','أول 3 أهداف'],['long','أول 7 أهداف']),
 serpent:rows(['timed','سباق النقاط'],['survival','البقاء']),
 memory:rows(['pairs','سباق الأزواج'],['sequence','تذكّر الترتيب']),
 picture:rows(['3','صورة 3 × 3'],['4','صورة 4 × 4'],['5','صورة 5 × 5']),
 jewels:rows(['classic','سباق الجواهر · لوحتان متساويتان']),
 logic:rows(['classic','أنماط وحساب واستنتاج']),bridge:rows(['classic','نفس الجسر للجميع']),ten:rows(['classic','خمس جولات إقصاء']),wordbomb:rows(['classic','صيد الكلمات']),focus:rows(['classic','تحديات تركيز متنوعة']),cipher:rows(['classic','آخر لاعب']),
 dice:rows(['classic','ارمِ أو ثبّت']),billiards:rows(['classic','كرات 8']),carrom:rows(['classic','مواجهة الملكة']),sudoku:rows(['classic','حل اللوحة']),
 'paths-online':rows(['classic','توصيل الأرقام']),puzzle:rows(['classic','ترتيب الأرقام'])
});
export const partyModes=game=>PARTY_MODES[game]||[];
export function partyMode(game,settings={}){
 const mode=settings.mode??(game==='memory'?settings.memoryMode:undefined)??(game==='picture'?String((settings.difficulty??2)<=2?3:settings.difficulty===3?4:5):undefined)??partyModes(game)[0]?.id;
 if(!partyModes(game).some(row=>row.id===mode))throw Error('طور اللعبة غير معروف');return mode;
}
export const partyModeLabel=(game,settings)=>partyModes(game).find(row=>row.id===partyMode(game,settings))?.label||'';
