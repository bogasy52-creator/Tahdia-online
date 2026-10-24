// Tahdia 31.0.0 — subjects for the AI picture questions.
// Every answer is the plain name of the thing ("فهد", never "نقوش جلد الفهد").
// Wrong choices come from the same group so the close-up stays a real guess.
export const AI_CATEGORY_ID = 'aiPictures';
export const AI_CATEGORY = Object.freeze({ id: AI_CATEGORY_ID, name: 'صور الذكاء', icon: 'ai', desc: 'صور يولّدها الذكاء الاصطناعي: خمّن وش اللي في الصورة' });
export const AI_QUESTION = 'وش اللي في الصورة؟';
export const AI_CREDIT = 'صورة مولّدة بالذكاء الاصطناعي';

const S = (id, a, group, level, prompt) => Object.freeze({ id, a, group, level, prompt });
export const AI_SUBJECTS = Object.freeze([
  S('cheetah', 'فهد', 'animal', 1, 'a cheetah resting in golden savanna grass'),
  S('lion', 'أسد', 'animal', 1, 'a male lion with a full mane'),
  S('tiger', 'نمر', 'animal', 2, 'a bengal tiger walking through green leaves'),
  S('giraffe', 'زرافة', 'animal', 2, 'a giraffe eating leaves from an acacia tree'),
  S('zebra', 'حمار وحشي', 'animal', 2, 'a zebra standing in a dry field'),
  S('elephant', 'فيل', 'animal', 1, 'an african elephant with long tusks'),
  S('camel', 'جمل', 'animal', 1, 'a camel standing on desert sand dunes'),
  S('falcon', 'صقر', 'animal', 2, 'a saker falcon perched on a leather glove'),
  S('horse', 'حصان', 'animal', 1, 'an arabian horse with a flowing mane'),
  S('penguin', 'بطريق', 'animal', 1, 'an emperor penguin on ice'),
  S('octopus', 'أخطبوط', 'animal', 3, 'an orange octopus on a coral reef'),
  S('turtle', 'سلحفاة', 'animal', 2, 'a green sea turtle swimming in clear water'),
  S('butterfly', 'فراشة', 'animal', 2, 'a blue morpho butterfly on a flower'),
  S('peacock', 'طاووس', 'animal', 3, 'a peacock with its tail feathers fanned out'),
  S('dates', 'تمر', 'food', 1, 'a bowl of glossy medjool dates'),
  S('orange', 'برتقال', 'food', 1, 'fresh oranges, one cut in half'),
  S('strawberry', 'فراولة', 'food', 1, 'ripe strawberries with green leaves'),
  S('watermelon', 'بطيخ', 'food', 1, 'a watermelon slice with black seeds'),
  S('bread', 'خبز', 'food', 2, 'a round loaf of freshly baked bread'),
  S('honey', 'عسل', 'food', 3, 'honeycomb dripping with golden honey'),
  S('pomegranate', 'رمان', 'food', 2, 'an open pomegranate showing its red seeds'),
  S('lemon', 'ليمون', 'food', 2, 'yellow lemons with a cut lemon slice'),
  S('chocolate', 'شوكولاتة', 'food', 2, 'a broken bar of dark chocolate'),
  S('pineapple', 'أناناس', 'food', 2, 'a whole pineapple with its crown of leaves'),
  S('kiwi', 'كيوي', 'food', 3, 'kiwi fruit cut in half'),
  S('corn', 'ذرة', 'food', 3, 'a fresh corn cob with yellow kernels'),
  S('watch', 'ساعة', 'object', 2, 'an antique gold pocket watch'),
  S('key', 'مفتاح', 'object', 2, 'an old brass key on a wooden table'),
  S('lantern', 'فانوس', 'object', 2, 'a glowing arabic metal lantern'),
  S('umbrella', 'مظلة', 'object', 1, 'an open red umbrella'),
  S('glasses', 'نظارة', 'object', 2, 'a pair of round eyeglasses'),
  S('dallah', 'دلة', 'object', 3, 'a traditional brass arabic coffee pot (dallah)'),
  S('compass', 'بوصلة', 'object', 3, 'a brass navigation compass'),
  S('football', 'كرة قدم', 'object', 1, 'a classic football on green grass'),
  S('pen', 'قلم', 'object', 3, 'a fountain pen on paper'),
  S('oud', 'عود', 'object', 3, 'an arabic oud musical instrument'),
  S('desert', 'صحراء', 'nature', 1, 'golden desert sand dunes under a blue sky'),
  S('waterfall', 'شلال', 'nature', 1, 'a tall waterfall in a green forest'),
  S('volcano', 'بركان', 'nature', 2, 'an erupting volcano with glowing lava'),
  S('palm', 'نخلة', 'nature', 1, 'a date palm tree'),
  S('cactus', 'صبار', 'nature', 2, 'a green cactus with sharp spines'),
  S('coral', 'مرجان', 'nature', 3, 'colourful coral on a reef'),
  S('snowflake', 'ثلج', 'nature', 3, 'a single snowflake crystal'),
  S('sunflower', 'دوار الشمس', 'nature', 2, 'a sunflower in full bloom'),
  S('seashell', 'صدفة', 'nature', 3, 'a spiral seashell on wet sand'),
  S('airplane', 'طائرة', 'vehicle', 1, 'a passenger airplane flying in the sky'),
  S('dhow', 'سفينة', 'vehicle', 2, 'a traditional wooden sailing dhow on the sea'),
  S('train', 'قطار', 'vehicle', 1, 'a modern train on railway tracks'),
  S('bicycle', 'دراجة', 'vehicle', 2, 'a bicycle leaning against a wall'),
  S('balloon', 'منطاد', 'vehicle', 2, 'a colourful hot air balloon'),
  S('racecar', 'سيارة سباق', 'vehicle', 3, 'a red racing car on a track')
]);
const BY_ID = new Map(AI_SUBJECTS.map((s) => [s.id, s]));
export const aiSubject = (id) => BY_ID.get(String(id)) || null;

const ZOOM = { 1: [3.8, 2.5], 2: [4.6, 3], 3: [5.4, 3.5] };
// A small seeded shuffle so the same picture always offers the same choices.
function seeded(list, seed) {
  const out = [...list];let h = 2166136261;for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  for (let i = out.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1274126177);const j = (h >>> 0) % (i + 1);[out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function aiDistractors(subject) {
  const same = AI_SUBJECTS.filter((s) => s.group === subject.group && s.id !== subject.id).map((s) => s.a);
  return seeded([...new Set(same)], subject.id).slice(0, 3);
}
/** A quiz question for a generated picture; `at` versions the image URL. */
export function aiQuestion(subject, at) {
  const [zoom, hintZoom] = ZOOM[subject.level] || ZOOM[2];
  const src = '/api/quiz/ai/image/' + subject.id + '.webp?v=' + Number(at || 0).toString(36);
  return { id: 'ai-pic-' + subject.id, v: subject.level * 100, q: AI_QUESTION, a: subject.a, distractors: aiDistractors(subject), media: 'zoom', src, revealSrc: src, zoom, hintZoom, focusX: 50, focusY: 50, credit: AI_CREDIT, generated: true, kind: 'image_object', mediaFamily: 'ai:' + subject.id };
}
/** The category is offered once each difficulty has two pictures. */
export function aiCategory(questions) {
  const rows = Array.isArray(questions) ? questions.filter((q) => q && aiSubject(String(q.id).replace(/^ai-pic-/, ''))) : [];
  for (const v of [100, 200, 300]) if (rows.filter((q) => q.v === v).length < 2) return null;
  return { ...AI_CATEGORY, questions: rows };
}
