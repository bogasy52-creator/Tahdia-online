/* شارات SVG أصلية لعناصر المتجر — بديل الإيموجي بعمل فني متجهي خفيف الحجم بدون صور خارجية. */
(function (global) {
  'use strict';

  // كل علامة (mark) عبارة عن محتوى SVG داخلي بمقاس viewBox 0 0 64 64، مركّب من أشكال بسيطة
  // (خطوط ودوائر ومضلعات) بدل الاعتماد على خط إيموجي — نتيجة موحّدة الأسلوب عبر كل الفئات.
  const S = 'stroke="url(#gStroke)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="url(#gFill)"';
  const SF = 'fill="url(#gFill)" stroke="url(#gStroke)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';

  const MARKS = {
    // ---- شخصيات ----
    brain: `<path ${S} d="M24 20c-5 0-8 4-8 8 0-1-4 1-4 6s4 6 4 6c0 4 3 7 7 7M40 20c5 0 8 4 8 8 0-1 4 1 4 6s-4 6-4 6c0 4-3 7-7 7"/><path ${S} d="M24 20c0-4 3-7 8-7s8 3 8 7v20c0 4-3 7-8 7s-8-3-8-7"/><circle cx="26" cy="26" r="1.6" fill="url(#gFill)"/><circle cx="38" cy="32" r="1.6" fill="url(#gFill)"/><circle cx="27" cy="38" r="1.6" fill="url(#gFill)"/>`,
    saturn: `<circle cx="32" cy="32" r="10" ${S}/><ellipse cx="32" cy="32" rx="19" ry="6.2" ${S} transform="rotate(-18 32 32)"/><circle cx="27" cy="28" r="1.6" ${F}/>`,
    wing: `<path ${S} d="M32 44V20"/><path ${S} d="M32 24c-6-6-14-8-20-6 3 7 9 12 16 13"/><path ${S} d="M32 24c6-6 14-8 20-6-3 7-9 12-16 13"/><path ${S} d="M32 32c-5-4-11-5-16-4 2 5 7 9 13 10"/><path ${S} d="M32 32c5-4 11-5 16-4-2 5-7 9-13 10"/>`,
    terminal: `<rect x="14" y="16" width="36" height="32" rx="6" ${S}/><path ${S} d="M21 27l7 6-7 6"/><path ${S} d="M33 39h10"/>`,
    knight: `<path ${S} d="M22 46V33c0-8 4-13 8-16 3-2 3-5 1-7-2 1-4 3-4 5-3-1-5 0-6 2l4 2-5 3v3l-6 3v5l4 2v11z"/><circle cx="35" cy="17" r="1.6" ${F}/>`,
    crown: `<path ${S} d="M16 42l3-18 9 9 4-14 4 14 9-9 3 18z"/><path ${S} d="M16 42h32"/><circle cx="32" cy="14" r="2" ${F}/><circle cx="18" cy="24" r="1.6" ${F}/><circle cx="46" cy="24" r="1.6" ${F}/>`,
    dune: `<path ${S} d="M10 40c6-8 12-8 18 0s12 8 18 0s8-6 8-6"/><path ${S} d="M10 48c6-6 12-6 18 0s12 6 18 0"/><circle cx="46" cy="16" r="6" ${S}/>`,
    circuitEye: `<polygon points="32,10 50,21 50,43 32,54 14,43 14,21" ${S}/><circle cx="32" cy="32" r="7" ${S}/><circle cx="32" cy="32" r="2" ${F}/><path ${S} d="M32 10v8M32 46v8M14 21l7 4M50 21l-7 4M14 43l7-4M50 43l-7-4"/>`,
    crescent: `<path ${S} d="M38 14a18 18 0 1 0 0 36 14 14 0 0 1 0-36z"/><circle cx="44" cy="16" r="1.4" ${F}/><circle cx="49" cy="24" r="1" ${F}/>`,
    flame: `<path ${S} d="M32 12c6 8 10 12 10 20a10 10 0 0 1-20 0c0-4 2-6 4-8-1 4 1 6 3 6 3 0 3-3 2-6-1-3-1-8 1-12z"/>`,
    gem: `<polygon points="32,10 46,22 40,50 24,50 18,22" ${S}/><path ${S} d="M18 22h28M24 50l8-28 8 28M32 10l-8 12M32 10l8 12"/>`,
    doubleCrown: `<path ${S} d="M13 40l3-16 8 8 8-16 8 16 8-8 3 16z"/><path ${S} d="M13 40h38"/><circle cx="32" cy="12" r="2.4" ${F}/><path ${S} d="M24 46h16"/>`,

    // ---- إطارات (خواتم بأنماط مختلفة) ----
    ringPlain: `<circle cx="32" cy="32" r="21" ${S}/>`,
    ringNeon: `<circle cx="32" cy="32" r="21" ${S}/><circle cx="32" cy="32" r="15" stroke="url(#gStroke)" stroke-width="1.2" fill="none" opacity=".55"/>`,
    ringGold: `<circle cx="32" cy="32" r="21" ${S}/><circle cx="32" cy="10" r="2" ${F}/><circle cx="32" cy="54" r="2" ${F}/><circle cx="10" cy="32" r="2" ${F}/><circle cx="54" cy="32" r="2" ${F}/>`,
    ringLeaf: `<circle cx="32" cy="32" r="21" ${S}/><path ${S} d="M20 18c4 3 4 9 0 12M44 18c-4 3-4 9 0 12M20 46c4-3 4-9 0-12M44 46c-4-3-4-9 0-12" opacity=".85"/>`,
    ringRoyal: `<circle cx="32" cy="32" r="19" ${S}/><path ${S} d="M22 13l3 6 7-4-2 8 8-2-4 7 6 3-6 3 4 7-8-2 2 8-7-4-3 6-3-6-7 4 2-8-8 2 4-7-6-3 6-3-4-7 8 2-2-8 7 4z" opacity=".5"/>`,
    ringFlame: `<circle cx="32" cy="32" r="21" ${S}/><path ${S} d="M14 32c2-4 2-8 0-12M50 32c-2-4-2-8 0-12M14 32c2 4 2 8 0 12M50 32c-2 4-2 8 0 12" opacity=".8"/>`,
    ringIce: `<circle cx="32" cy="32" r="21" ${S}/><path ${S} d="M32 11v10M32 43v10M11 32h10M43 32h10M18 18l7 7M46 46l-7-7M46 18l-7 7M18 46l7-7" opacity=".7"/>`,
    ringCosmic: `<circle cx="32" cy="32" r="21" ${S}/><circle cx="32" cy="32" r="26" stroke="url(#gStroke)" stroke-width="1" fill="none" stroke-dasharray="2 5" opacity=".7"/>`,

    // ---- طاولات (لوحة بنقشة) ----
    tableGrid: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M9 26h46M9 38h46M26 9v46M38 9v46" opacity=".55"/>`,
    tableWave: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M12 24c5-4 9-4 14 0s9 4 14 0 9-4 14 0M12 40c5-4 9-4 14 0s9 4 14 0 9-4 14 0" opacity=".7"/>`,
    tableLeaf: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M20 46c0-14 6-22 12-28 6 6 12 14 12 28" opacity=".7"/>`,
    tableRoyal: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M20 40l3-12 9 9 3-14 3 14 9-9 3 12" opacity=".8"/>`,
    tableCyber: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M16 20h10v10H16zM38 20h10v10H38zM16 34h10v10H16zM38 34h10v10H38z" opacity=".6"/>`,
    tableDune: `<rect x="9" y="9" width="46" height="46" rx="10" ${S}/><path ${S} d="M12 36c6-6 10-6 16 0s10 6 16 0" opacity=".75"/><circle cx="42" cy="20" r="5" ${S}/>`,

    // ---- الدخول (بوابات) ----
    portalFocus: `<circle cx="32" cy="32" r="20" ${S}/><text x="32" y="38" text-anchor="middle" font-size="15" font-weight="900" fill="url(#gFill)" font-family="inherit">3·2·1</text>`,
    portalBolt: `<circle cx="32" cy="32" r="20" ${S}/><path d="M35 14l-11 20h8l-4 16 15-22h-9z" ${SF}/>`,
    portalRoyal: `<circle cx="32" cy="34" r="17" ${S}/><path d="M18 20l4-8 10 7 0-11 0 11 10-7 4 8" ${SF}/>`,
    portalSwirl: `<circle cx="32" cy="32" r="20" ${S}/><path ${S} d="M32 20a12 12 0 1 1-8 4"/><circle cx="24" cy="24" r="1.6" ${F}/>`,
    portalPhoenix: `<circle cx="32" cy="32" r="20" ${S}/><path d="M32 18c5 6 8 10 8 16a8 8 0 0 1-16 0c0-3 1.5-5 3-6-.5 3 .8 5 2.4 5 2.2 0 2.2-2.2 1.6-4.6-.6-2.4-.6-6.4 1-10.4z" ${SF}/>`,
    portalGalaxy: `<circle cx="32" cy="32" r="20" ${S}/><circle cx="32" cy="32" r="10" stroke="url(#gStroke)" stroke-width="1.4" fill="none" stroke-dasharray="1 4"/><circle cx="20" cy="22" r="1.2" ${F}/><circle cx="45" cy="26" r="1" ${F}/><circle cx="24" cy="46" r="1.4" ${F}/>`,

    // ---- احتفالات الفوز ----
    trophyCrown: `<path ${S} d="M22 44l-2-18h24l-2 18z"/><path ${S} d="M20 44h24"/><circle cx="32" cy="20" r="2" ${F}/><circle cx="24" cy="28" r="1.4" ${F}/><circle cx="40" cy="28" r="1.4" ${F}/>`,
    confetti: `<circle cx="32" cy="32" r="4" ${F}/><rect x="14" y="14" width="6" height="6" ${F} transform="rotate(20 17 17)"/><rect x="44" y="16" width="5" height="5" ${F} transform="rotate(-15 46 18)"/><rect x="16" y="42" width="5" height="5" ${F} transform="rotate(10 18 44)"/><rect x="44" y="42" width="6" height="6" ${F} transform="rotate(30 47 45)"/><circle cx="32" cy="14" r="2" ${F}/><circle cx="14" cy="32" r="2" ${F}/><circle cx="50" cy="32" r="2" ${F}/>`,
    trophyBolt: `<path ${S} d="M22 44l-2-18h24l-2 18z"/><path ${S} d="M20 44h24"/><path d="M35 16l-9 13h6l-3 10 11-15h-7z" ${SF}/>`,
    firework: `<circle cx="32" cy="32" r="3" ${F}/><path ${S} d="M32 14v10M32 40v10M14 32h10M40 32h10M20 20l7 7M37 37l7 7M44 20l-7 7M27 37l-7 7"/>`,
    phoenixWings: `<path ${S} d="M32 46V22"/><path ${S} d="M32 26c-7-7-16-9-23-7 3 8 10 14 18 15"/><path ${S} d="M32 26c7-7 16-9 23-7-3 8-10 14-18 15"/><path d="M32 16c2-3 2-5 0-8-2 3-2 5 0 8z" ${SF}/>`,
    galaxyTrophy: `<circle cx="32" cy="32" r="16" ${S}/><circle cx="32" cy="32" r="16" stroke="url(#gStroke)" stroke-width="1" fill="none" stroke-dasharray="1 4"/><circle cx="24" cy="24" r="1.6" ${F}/><circle cx="41" cy="27" r="1.2" ${F}/><circle cx="30" cy="42" r="1.4" ${F}/>`,

    // ---- الصوتيات ----
    speakerClassic: `<path ${S} d="M16 26h8l12-9v30l-12-9h-8z"/><path ${S} d="M40 24a10 10 0 0 1 0 16"/>`,
    speakerArcade: `<path ${S} d="M16 26h8l12-9v30l-12-9h-8z"/><path ${S} d="M40 21c3 3 4 15 0 22M45 18c5 4 6 20 0 28" opacity=".8"/>`,
    speakerRoyal: `<path ${S} d="M16 26h8l12-9v30l-12-9h-8z"/><path ${S} d="M40 24a10 10 0 0 1 0 16"/><circle cx="46" cy="18" r="2" ${F}/>`,
    speakerCyber: `<path ${S} d="M16 26h8l12-9v30l-12-9h-8z"/><path ${S} d="M40 20h9v8h-9zM40 36h9v8h-9z" opacity=".7"/>`,
    speakerCalm: `<path ${S} d="M16 26h8l12-9v30l-12-9h-8z"/><path ${S} d="M40 26c3 2 3 10 0 12" opacity=".7"/>`,
  };

  const ITEM_MARKS = {
    'avatar-nova': 'brain', 'avatar-orbit': 'saturn', 'avatar-falcon': 'wing', 'avatar-coder': 'terminal',
    'avatar-knight': 'knight', 'avatar-queen': 'crown', 'avatar-desert': 'dune', 'avatar-cyber': 'circuitEye',
    'avatar-lunar': 'crescent', 'avatar-phoenix': 'flame', 'avatar-titan': 'gem', 'avatar-genius': 'doubleCrown',
    'frame-classic': 'ringPlain', 'frame-neon': 'ringNeon', 'frame-gold': 'ringGold', 'frame-emerald': 'ringLeaf',
    'frame-royal': 'ringRoyal', 'frame-flame': 'ringFlame', 'frame-ice': 'ringIce', 'frame-cosmic': 'ringCosmic',
    'table-midnight': 'tableGrid', 'table-ivory': 'tableWave', 'table-jungle': 'tableLeaf', 'table-royal': 'tableRoyal',
    'table-cyber': 'tableCyber', 'table-desert': 'tableDune',
    'entrance-focus': 'portalFocus', 'entrance-lightning': 'portalBolt', 'entrance-royal': 'portalRoyal',
    'entrance-portal': 'portalSwirl', 'entrance-phoenix': 'portalPhoenix', 'entrance-galaxy': 'portalGalaxy',
    'victory-crown': 'trophyCrown', 'victory-confetti': 'confetti', 'victory-lightning': 'trophyBolt',
    'victory-firework': 'firework', 'victory-phoenix': 'phoenixWings', 'victory-galaxy': 'galaxyTrophy',
    'sound-classic': 'speakerClassic', 'sound-arcade': 'speakerArcade', 'sound-royal': 'speakerRoyal',
    'sound-cyber': 'speakerCyber', 'sound-calm': 'speakerCalm',
  };

  // شكل الشارة الخارجية يختلف حسب الفئة كي يُقرأ نوع العنصر من الشكل قبل قراءة الاسم.
  const BADGE_SHAPE = {
    avatar: `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
    frame: `<circle cx="32" cy="32" r="29" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
    table: `<rect x="4" y="4" width="56" height="56" rx="16" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
    entrance: `<circle cx="32" cy="32" r="29" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
    victory: `<path d="M32 4l26 10v18c0 16-11 24-26 28-15-4-26-12-26-28V14z" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
    sound: `<rect x="4" y="4" width="56" height="56" rx="24" fill="url(#gBg)" stroke="url(#gStroke)" stroke-width="2"/>`,
  };

  const RARITY_DECOR = {
    legendary: (uid) => `<circle cx="32" cy="32" r="30" fill="none" stroke="url(#gRare-${uid})" stroke-width="1.4" stroke-dasharray="3 3" opacity=".85"/>`,
    epic: (uid) => `<circle cx="32" cy="32" r="30" fill="none" stroke="url(#gRare-${uid})" stroke-width="1" stroke-dasharray="1 5" opacity=".6"/>`,
  };

  let uidSeed = 0;
  function render(entry, opts = {}) {
    if (!entry) return '';
    const large = Boolean(opts.large);
    const uid = `${entry.id}-${uidSeed++}`;
    const colors = Array.isArray(entry.colors) && entry.colors.length >= 2 ? entry.colors : ['#8b5cf6', '#22d3ee'];
    const markId = ITEM_MARKS[entry.id] || 'brain';
    const mark = MARKS[markId] || '';
    const badge = BADGE_SHAPE[entry.category] || BADGE_SHAPE.avatar;
    const decor = RARITY_DECOR[entry.rarity] ? RARITY_DECOR[entry.rarity](uid) : '';
    return `<span class="cosmetic-glyph svg-glyph ${large ? 'large' : ''} cat-${entry.category} rarity-${entry.rarity}" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img" focusable="false">
        <defs>
          <linearGradient id="gBg-${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${colors[0]}" stop-opacity=".28"/>
            <stop offset="1" stop-color="${colors[1]}" stop-opacity=".1"/>
          </linearGradient>
          <linearGradient id="gStroke-${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${colors[0]}"/>
            <stop offset="1" stop-color="${colors[1]}"/>
          </linearGradient>
          <linearGradient id="gFill-${uid}" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="${colors[0]}"/>
            <stop offset="1" stop-color="${colors[1]}"/>
          </linearGradient>
          <linearGradient id="gRare-${uid}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${colors[1]}"/>
            <stop offset="1" stop-color="${colors[0]}"/>
          </linearGradient>
        </defs>
        <g>${badge.replace(/url\(#gBg\)/g, `url(#gBg-${uid})`).replace(/url\(#gStroke\)/g, `url(#gStroke-${uid})`)}</g>
        ${decor}
        <g>${mark.replace(/url\(#gStroke\)/g, `url(#gStroke-${uid})`).replace(/url\(#gFill\)/g, `url(#gFill-${uid})`)}</g>
      </svg>
    </span>`;
  }

  global.TAHADI_ICONS = Object.freeze({ render, marks: Object.keys(MARKS), itemMarks: ITEM_MARKS });
})(window);
