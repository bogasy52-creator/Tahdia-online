/* Offline cosmetic catalog. IDs are permanent because saved profiles reference them. */
(function () {
  const item = (id, category, name, price, rarity, level, preview, extra = {}) =>
    Object.freeze({ id, category, name, price, rarity, level, preview, ...extra });

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

    item('frame-classic', 'frame', 'الإطار الكلاسيكي', 0, 'free', 1, '◯', { colors: ['#64748b', '#cbd5e1'] }),
    item('frame-neon', 'frame', 'نيون', 160, 'common', 1, '◎', { colors: ['#22d3ee', '#8b5cf6'] }),
    item('frame-gold', 'frame', 'الذهبي', 240, 'rare', 3, '✦', { colors: ['#f0b94a', '#fff7cc'] }),
    item('frame-emerald', 'frame', 'الزمرد', 280, 'rare', 4, '◇', { colors: ['#34d399', '#064e3b'] }),
    item('frame-royal', 'frame', 'الملكي', 360, 'epic', 6, '♕', { colors: ['#a78bfa', '#f0b94a'] }),
    item('frame-flame', 'frame', 'اللهب', 430, 'epic', 8, '♨', { colors: ['#fb7185', '#f59e0b'] }),
    item('frame-ice', 'frame', 'الجليدي', 430, 'epic', 8, '❄', { colors: ['#bae6fd', '#0284c7'] }),
    item('frame-cosmic', 'frame', 'المجرة', 620, 'legendary', 12, '✺', { colors: ['#d946ef', '#312e81'] }),

    item('table-midnight', 'table', 'منتصف الليل', 0, 'free', 1, '▦', { colors: ['#111827', '#312e81'] }),
    item('table-ivory', 'table', 'العاج', 260, 'common', 2, '▦', { colors: ['#fff7ed', '#c9a86a'] }),
    item('table-jungle', 'table', 'الغابة', 340, 'rare', 4, '▦', { colors: ['#064e3b', '#84cc16'] }),
    item('table-royal', 'table', 'الطاولة الملكية', 520, 'epic', 7, '▦', { colors: ['#3b0764', '#f0b94a'] }),
    item('table-cyber', 'table', 'شبكة سايبر', 580, 'epic', 9, '▦', { colors: ['#071426', '#22d3ee'] }),
    item('table-desert', 'table', 'ليالي الصحراء', 700, 'legendary', 12, '▦', { colors: ['#431407', '#fbbf24'] }),

    item('entrance-focus', 'entrance', 'تركيز', 0, 'free', 1, '3·2·1', { colors: ['#64748b', '#111827'] }),
    item('entrance-lightning', 'entrance', 'صاعقة', 220, 'common', 2, '⚡', { colors: ['#22d3ee', '#fde047'] }),
    item('entrance-royal', 'entrance', 'الموكب الملكي', 360, 'rare', 5, '♛', { colors: ['#f0b94a', '#7c3aed'] }),
    item('entrance-portal', 'entrance', 'البوابة', 440, 'epic', 7, '◉', { colors: ['#a78bfa', '#22d3ee'] }),
    item('entrance-phoenix', 'entrance', 'نهضة العنقاء', 580, 'epic', 10, '🔥', { colors: ['#f97316', '#e11d48'] }),
    item('entrance-galaxy', 'entrance', 'عبور المجرة', 760, 'legendary', 14, '✺', { colors: ['#d946ef', '#1e1b4b'] }),

    item('victory-crown', 'victory', 'التاج', 0, 'free', 1, '👑', { colors: ['#f0b94a', '#fff7cc'] }),
    item('victory-confetti', 'victory', 'مطر القصاصات', 200, 'common', 2, '🎉', { colors: ['#22d3ee', '#ec4899'] }),
    item('victory-lightning', 'victory', 'بطل الصاعقة', 320, 'rare', 4, '⚡', { colors: ['#38bdf8', '#fde047'] }),
    item('victory-firework', 'victory', 'الألعاب النارية', 420, 'epic', 7, '🎆', { colors: ['#f472b6', '#facc15'] }),
    item('victory-phoenix', 'victory', 'انتصار العنقاء', 600, 'epic', 10, '🪽', { colors: ['#fb7185', '#f97316'] }),
    item('victory-galaxy', 'victory', 'سيد المجرة', 800, 'legendary', 15, '🌌', { colors: ['#c084fc', '#172554'] }),

    item('sound-classic', 'sound', 'الصوت الكلاسيكي', 0, 'free', 1, '◖', { colors: ['#64748b', '#e2e8f0'], sound: 'classic' }),
    item('sound-arcade', 'sound', 'أركيد', 180, 'common', 2, '♪', { colors: ['#22d3ee', '#ec4899'], sound: 'arcade' }),
    item('sound-royal', 'sound', 'ملكي', 300, 'rare', 5, '♬', { colors: ['#f0b94a', '#7c3aed'], sound: 'royal' }),
    item('sound-cyber', 'sound', 'سايبر', 420, 'epic', 8, '⌁', { colors: ['#34d399', '#0f172a'], sound: 'cyber' }),
    item('sound-calm', 'sound', 'هادئ', 380, 'epic', 8, '♫', { colors: ['#93c5fd', '#312e81'], sound: 'calm' }),
  ];

  window.TAHADI_STORE_CATALOG = Object.freeze(catalog);
  window.TAHADI_STORE_BY_ID = new Map(catalog.map((entry) => [entry.id, entry]));
})();
