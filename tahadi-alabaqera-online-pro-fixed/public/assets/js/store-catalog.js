/* Offline cosmetic catalog. IDs are permanent because saved profiles reference them. */
(function () {
  const categoryCounts = new Map();
  const categoryCodes = { avatar: 'AV', frame: 'FR', table: 'TB', entrance: 'EN', victory: 'VX', sound: 'AU' };
  const item = (id, category, name, price, rarity, level, _legacyPreview, extra = {}) => {
    const index = (categoryCounts.get(category) || 0) + 1;
    categoryCounts.set(category, index);
    const slug = String(id).split('-').slice(1).join('').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const preview = category === 'avatar' ? (slug.slice(0, 2) || `A${index}`) : `${categoryCodes[category] || 'IT'}${index}`;
    return Object.freeze({ id, category, name, price, rarity, level, preview, ...extra });
  };

  const catalog = [
    item('avatar-nova', 'avatar', 'نوفا', 0, 'free', 1, '🧠', { colors: ['#8b5cf6', '#22d3ee'] }),
    item('avatar-orbit', 'avatar', 'أوربت', 180, 'common', 1, '🪐', { colors: ['#6366f1', '#d946ef'] }),
    item('avatar-falcon', 'avatar', 'الصقر', 240, 'common', 2, '🦅', { colors: ['#0ea5e9', '#f8fafc'] }),
    item('avatar-coder', 'avatar', 'المبرمج', 260, 'rare', 3, '⌘', { colors: ['#22d3ee', '#0f172a'] }),
    item('avatar-knight', 'avatar', 'الفارس', 320, 'rare', 4, '♞', { colors: ['#94a3b8', '#334155'] }),
    item('avatar-queen', 'avatar', 'الملكة', 360, 'rare', 5, '♛', { colors: ['#f0b94a', '#7c3aed'] }),
    item('avatar-desert', 'avatar', 'رحّالة الصحراء', 400, 'epic', 6, '🏜️', { colors: ['#f59e0b', '#92400e'] }),
    item('avatar-cyber', 'avatar', 'سايبر', 440, 'epic', 7, '◉', { colors: ['#22d3ee', '#ec4899'] }),
    item('avatar-lunar', 'avatar', 'القمر', 480, 'epic', 8, '☾', { colors: ['#c4b5fd', '#312e81'] }),
    item('avatar-phoenix', 'avatar', 'العنقاء', 540, 'legendary', 10, '🔥', { colors: ['#fb7185', '#f59e0b'] }),
    item('avatar-titan', 'avatar', 'تايتن', 650, 'legendary', 12, '◆', { colors: ['#a78bfa', '#111827'] }),
    item('avatar-genius', 'avatar', 'سيد التحدي', 900, 'legendary', 15, '👑', { colors: ['#fde68a', '#7c2d12'] }),
    item('avatar-rashid', 'avatar', 'راشد التكتيكي', 720, 'legendary', 9, '♟', { colors: ['#67e8f9', '#172554'], interactive: true, image: 'assets/img/heroes/rashid.png', personality: { id: 'tactician', title: 'المخطط الهادئ', greeting: 'نقرأ الجولة قبل أن تبدأ.', correct: 'حركة محسوبة يا بطل.', wrong: 'معلومة جديدة، والخطة مستمرة.', win: 'الخطة اكتملت بإتقان!', streak: 'خطوة بخطوة نحصد الجولات.', timeout: 'لا داعي للعجلة، فكّر جيدًا.', voice: { pitch: .88, rate: .92, gender: 'male' } } }),
    item('avatar-lama', 'avatar', 'لمى البرق', 760, 'legendary', 10, 'ϟ', { colors: ['#fde047', '#db2777'], interactive: true, image: 'assets/img/heroes/lama.png', personality: { id: 'spark', title: 'سريعة البديهة', greeting: 'جاهز؟ نخطف الجولة!', correct: 'برق! هذه هي الإجابة.', wrong: 'ولا يهمك، التالية لنا.', win: 'انتصار بسرعة البرق!', streak: 'سلسلة برق ولا أروع!', timeout: 'الوقت يجري… احسم بسرعة.', voice: { pitch: 1.15, rate: 1.12, gender: 'female' } } }),
    item('avatar-shaheen', 'avatar', 'شاهين الحارس', 820, 'legendary', 12, '◈', { colors: ['#fb923c', '#0f172a'], interactive: true, image: 'assets/img/heroes/shaheen.png', personality: { id: 'guardian', title: 'ثابت تحت الضغط', greeting: 'ثبات وتركيز حتى النهاية.', correct: 'ممتاز، حافظ على هذا النسق.', wrong: 'اهدأ… ما زالت المباراة بيدك.', win: 'حُسمت بثبات الأبطال.', streak: 'دفاع صلب وتقدّم ثابت.', timeout: 'خذ نفسًا، ما زال الوقت يكفي.', voice: { pitch: .9, rate: .9, gender: 'male' } } }),
    item('avatar-noura', 'avatar', 'نورا النخبة', 880, 'legendary', 14, '✧', { colors: ['#c4b5fd', '#0e7490'], interactive: true, image: 'assets/img/heroes/noura.png', personality: { id: 'oracle', title: 'قارئة الاحتمالات', greeting: 'كل احتمال يقودنا للفوز.', correct: 'توقّع دقيق وقرار أجمل.', wrong: 'غيّر الزاوية وستظهر الإجابة.', win: 'كما توقعت… فوز مستحق!', streak: 'كأنك تقرأ الأسئلة قبل ظهورها!', timeout: 'استشعري الإجابة… الوقت يقترب.', voice: { pitch: 1.05, rate: .95, gender: 'female' } } }),
    item('avatar-bandar', 'avatar', 'بندر السريع', 340, 'rare', 4, '➳', { colors: ['#38bdf8', '#0f172a'], interactive: true, image: 'assets/img/heroes/bandar.png', personality: { id: 'sprinter', title: 'يركض نحو كل إجابة', greeting: 'جاهز للانطلاق من الصفارة!', correct: 'سبقتهم بالكامل!', wrong: 'زلة بسيطة، نلحق الجولة الجاية.', win: 'وصلنا الخط قبل الجميع!', streak: 'سرعة وثبات… سلسلة ما تنكسر.', timeout: 'ثوانٍ تفصلنا، يلا نحسمها.', voice: { pitch: 1.08, rate: 1.15, gender: 'male' } } }),
    item('avatar-reem', 'avatar', 'ريم الذكية', 380, 'rare', 5, '❉', { colors: ['#f472b6', '#312e81'], interactive: true, image: 'assets/img/heroes/reem.png', personality: { id: 'clever', title: 'ترى الحل من زاوية غريبة', greeting: 'هاتوا أصعب سؤال عندكم.', correct: 'بالضبط كذا قلت لكم!', wrong: 'حيلة لطيفة، بس ما نفعت هالمرة.', win: 'الذكاء انتصر أخيرًا.', streak: 'فكرة وراء فكرة… ما تنقطع.', timeout: 'خلوني أفكر بصوت عالٍ.', voice: { pitch: 1.12, rate: 1.02, gender: 'female' } } }),
    item('avatar-joud', 'avatar', 'جود الحالمة', 480, 'epic', 7, '❋', { colors: ['#a5b4fc', '#1e1b4b'], interactive: true, image: 'assets/img/heroes/joud.png', personality: { id: 'dreamer', title: 'تحلم بالفوز وتخطط له', greeting: 'كل سؤال طريق نحو الحلم.', correct: 'كأن الإجابة كانت تنتظرك.', wrong: 'ولا يهمك، الحلم ما زال قريب.', win: 'الحلم تحقق أمام أعيننا.', streak: 'تتوالى الإجابات كسحابة أحلام.', timeout: 'خذ لحظة… الوقت يمهلك قليلًا.', voice: { pitch: 1.02, rate: .85, gender: 'female' } } }),
    item('avatar-faris', 'avatar', 'فارس الميدان', 520, 'epic', 8, '⚑', { colors: ['#f97316', '#7c2d12'], interactive: true, image: 'assets/img/heroes/faris.png', personality: { id: 'warrior', title: 'يخوض كل جولة كأنها الأخيرة', greeting: 'الميدان لي، تفضلوا.', correct: 'ضربة موفقة يا أبطال!', wrong: 'جولة خاسرة، بس الحرب طويلة.', win: 'انتصار يليق بفارس!', streak: 'سلسلة انتصارات متتالية!', timeout: 'الوقت يضغط… اثبت الآن.', voice: { pitch: .92, rate: 1.06, gender: 'male' } } }),
    item('avatar-khaled', 'avatar', 'خالد الأسطورة', 860, 'legendary', 13, '♔', { colors: ['#facc15', '#1e293b'], interactive: true, image: 'assets/img/heroes/khaled.png', personality: { id: 'legend', title: 'خبرة سنوات في كل إجابة', greeting: 'شرّفتوني بمنافستي.', correct: 'هذا مستوى الأساطير.', wrong: 'حتى الأساطير تخطئ أحيانًا.', win: 'أسطورة أخرى تُكتب اليوم.', streak: 'سلسلة تليق باسمي.', timeout: 'الحكمة تحتاج لحظة صمت.', voice: { pitch: .8, rate: .88, gender: 'male' } } }),
    item('avatar-leen', 'avatar', 'لين النجمة', 900, 'legendary', 15, '☆', { colors: ['#fde68a', '#db2777'], interactive: true, image: 'assets/img/heroes/leen.png', personality: { id: 'star', title: 'تضيء كل جولة بحضورها', greeting: 'أنا هنا، فلتبدأ الإضاءة!', correct: 'تألقتِ يا بطلة!', wrong: 'حتى النجوم تخفت أحيانًا.', win: 'نجمة الجولة بلا منازع!', streak: 'توهج مستمر… سلسلة من نور.', timeout: 'لحظة تركيز قبل التألق.', voice: { pitch: 1.18, rate: 1.08, gender: 'female' } } }),

    item('frame-classic', 'frame', 'الإطار الكلاسيكي', 0, 'free', 1, '◯', { colors: ['#64748b', '#cbd5e1'] }),
    item('frame-neon', 'frame', 'نيون', 160, 'common', 1, '◎', { colors: ['#22d3ee', '#8b5cf6'] }),
    item('frame-gold', 'frame', 'الذهبي', 240, 'rare', 3, '✦', { colors: ['#f0b94a', '#fff7cc'] }),
    item('frame-emerald', 'frame', 'الزمرد', 280, 'rare', 4, '◇', { colors: ['#34d399', '#064e3b'] }),
    item('frame-royal', 'frame', 'الملكي', 360, 'epic', 6, '♕', { colors: ['#a78bfa', '#f0b94a'] }),
    item('frame-flame', 'frame', 'اللهب', 430, 'epic', 8, '♨', { colors: ['#fb7185', '#f59e0b'] }),
    item('frame-ice', 'frame', 'الجليدي', 430, 'epic', 8, '❄', { colors: ['#bae6fd', '#0284c7'] }),
    item('frame-cosmic', 'frame', 'المجرة', 620, 'legendary', 12, '✺', { colors: ['#d946ef', '#312e81'] }),
    item('frame-eclipse', 'frame', 'كسوف الأساطير', 780, 'legendary', 14, '◉', { colors: ['#fbbf24', '#1e1b4b'], interactive: true }),

    item('table-midnight', 'table', 'منتصف الليل', 0, 'free', 1, '▦', { colors: ['#111827', '#312e81'] }),
    item('table-ivory', 'table', 'العاج', 260, 'common', 2, '▦', { colors: ['#fff7ed', '#c9a86a'] }),
    item('table-jungle', 'table', 'الغابة', 340, 'rare', 4, '▦', { colors: ['#064e3b', '#84cc16'] }),
    item('table-royal', 'table', 'الطاولة الملكية', 520, 'epic', 7, '▦', { colors: ['#3b0764', '#f0b94a'] }),
    item('table-cyber', 'table', 'شبكة سايبر', 580, 'epic', 9, '▦', { colors: ['#071426', '#22d3ee'] }),
    item('table-desert', 'table', 'ليالي الصحراء', 700, 'legendary', 12, '▦', { colors: ['#431407', '#fbbf24'] }),
    item('table-aurora', 'table', 'عرش الشفق', 840, 'legendary', 14, '▦', { colors: ['#0f766e', '#6d28d9'], interactive: true }),

    item('entrance-focus', 'entrance', 'تركيز', 0, 'free', 1, '3·2·1', { colors: ['#64748b', '#111827'] }),
    item('entrance-lightning', 'entrance', 'صاعقة', 220, 'common', 2, '⚡', { colors: ['#22d3ee', '#fde047'] }),
    item('entrance-royal', 'entrance', 'الموكب الملكي', 360, 'rare', 5, '♛', { colors: ['#f0b94a', '#7c3aed'] }),
    item('entrance-portal', 'entrance', 'البوابة', 440, 'epic', 7, '◉', { colors: ['#a78bfa', '#22d3ee'] }),
    item('entrance-phoenix', 'entrance', 'نهضة العنقاء', 580, 'epic', 10, '🔥', { colors: ['#f97316', '#e11d48'] }),
    item('entrance-galaxy', 'entrance', 'عبور المجرة', 760, 'legendary', 14, '✺', { colors: ['#d946ef', '#1e1b4b'] }),
    item('entrance-throne', 'entrance', 'بوابة العرش', 880, 'legendary', 15, '♜', { colors: ['#facc15', '#4c1d95'], interactive: true }),

    item('victory-crown', 'victory', 'التاج', 0, 'free', 1, '👑', { colors: ['#f0b94a', '#fff7cc'] }),
    item('victory-confetti', 'victory', 'مطر القصاصات', 200, 'common', 2, '🎉', { colors: ['#22d3ee', '#ec4899'] }),
    item('victory-lightning', 'victory', 'بطل الصاعقة', 320, 'rare', 4, '⚡', { colors: ['#38bdf8', '#fde047'] }),
    item('victory-firework', 'victory', 'الألعاب النارية', 420, 'epic', 7, '🎆', { colors: ['#f472b6', '#facc15'] }),
    item('victory-phoenix', 'victory', 'انتصار العنقاء', 600, 'epic', 10, '🪽', { colors: ['#fb7185', '#f97316'] }),
    item('victory-galaxy', 'victory', 'سيد المجرة', 800, 'legendary', 15, '🌌', { colors: ['#c084fc', '#172554'] }),
    item('victory-legend', 'victory', 'ختم الأسطورة', 920, 'legendary', 16, '✦', { colors: ['#fef3c7', '#be123c'], interactive: true }),

    item('sound-classic', 'sound', 'الصوت الكلاسيكي', 0, 'free', 1, '◖', { colors: ['#64748b', '#e2e8f0'], sound: 'classic', phrases: ['جاهز للتحدي!', 'أحسنت يا بطل', 'جولة جميلة', 'بالتوفيق للجميع'] }),
    item('sound-arcade', 'sound', 'أركيد', 180, 'common', 2, '♪', { colors: ['#22d3ee', '#ec4899'], sound: 'arcade', phrases: ['لنرفع المستوى!', 'كومبو رائع!', 'اقتربنا من الفوز', 'جولة ثانية؟'] }),
    item('sound-royal', 'sound', 'ملكي', 300, 'rare', 5, '♬', { colors: ['#f0b94a', '#7c3aed'], sound: 'royal', phrases: ['حياكم في التحدي', 'إجابة تليق بالأبطال', 'منافسة راقية', 'النصر للأفضل'] }),
    item('sound-cyber', 'sound', 'سايبر', 420, 'epic', 8, '⌁', { colors: ['#34d399', '#0f172a'], sound: 'cyber', phrases: ['تم تفعيل وضع التركيز', 'إجابة مؤكدة', 'نعيد الحساب', 'المهمة اكتملت'] }),
    item('sound-calm', 'sound', 'هادئ', 380, 'epic', 8, '♫', { colors: ['#93c5fd', '#312e81'], sound: 'calm', phrases: ['خذ وقتك وفكّر', 'ممتاز، استمر', 'لا بأس، حاول مجددًا', 'استمتع بالجولة'] }),
    item('sound-stadium', 'sound', 'هتاف المدرج', 560, 'epic', 10, '≋', { colors: ['#4ade80', '#facc15'], sound: 'arcade', phrases: ['الجمهور معك!', 'يا سلام عليك!', 'الحسم قريب!', 'جولة نار!'], interactive: true }),
    item('sound-oracle', 'sound', 'صدى العرّافة', 740, 'legendary', 13, '◌', { colors: ['#c084fc', '#22d3ee'], sound: 'calm', phrases: ['الإجابة أمامك', 'حدسك في مكانه', 'أعد قراءة الإشارة', 'المصير يبتسم لك'], interactive: true }),
  ];

  window.TAHADI_STORE_CATALOG = Object.freeze(catalog);
  window.TAHADI_STORE_BY_ID = new Map(catalog.map((entry) => [entry.id, entry]));
})();
