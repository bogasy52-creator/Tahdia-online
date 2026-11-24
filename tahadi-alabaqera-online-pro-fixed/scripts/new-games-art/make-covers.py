"""Original cover art for «جسر الألوان» and «عشر ثواني» (33.12.0). Run: python3 scripts/new-games-art/make-covers.py"""
import math, random, pathlib
OUT = pathlib.Path(__file__).resolve().parents[2] / 'public' / 'assets' / 'brand'
rnd = random.Random(3312)

def stars(n, w, h, top=1.0):
    out = []
    for _ in range(n):
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h * top), rnd.choice([0.8, 1.1, 1.5, 2.1])
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#fff" opacity="{rnd.uniform(.35,.95):.2f}"/>')
    return ''.join(out)

def bridge():
    W, H = 1000, 600
    colours = ['#ff4d6d', '#3fa7ff', '#2fd6a1', '#ffc83d', '#b57cff', '#ff8a3d']
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
             '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b0a46"/><stop offset=".6" stop-color="#2c0f6b"/><stop offset="1" stop-color="#07021a"/></linearGradient>',
             '<radialGradient id="abyss" cx=".5" cy=".95" r=".7"><stop offset="0" stop-color="#7b3cff" stop-opacity=".55"/><stop offset="1" stop-color="#7b3cff" stop-opacity="0"/></radialGradient>',
             '<linearGradient id="rail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a10"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>',
             '<linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>',
             '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs>',
             f'<rect width="{W}" height="{H}" fill="url(#sky)"/>', stars(90, W, H, .55),
             f'<circle cx="820" cy="110" r="46" fill="#fff6d6"/><circle cx="840" cy="98" r="44" fill="#2a0f66"/>',
             f'<rect width="{W}" height="{H}" fill="url(#abyss)"/>']
    # the bridge in perspective: rows get smaller towards the far bank
    rows, near_y, far_y = 9, 585, 150
    near_half, far_half = 330, 70
    def at(t):  # t: 0 near .. 1 far
        y = near_y + (far_y - near_y) * (1 - (1 - t) ** 1.6)
        half = near_half + (far_half - near_half) * t
        return y, half
    for i in range(rows):
        t0, t1 = i / rows, (i + 1) / rows
        y0, h0 = at(t0); y1, h1 = at(t1)
        gap0 = (y0 - y1) * 0.12
        cols = 3
        cset = rnd.sample(colours, cols)
        safe = rnd.randrange(cols)
        for c in range(cols):
            ax0 = 500 - h0 + (2 * h0) * c / cols + 6 * (1 - t0); bx0 = 500 - h0 + (2 * h0) * (c + 1) / cols - 6 * (1 - t0)
            ax1 = 500 - h1 + (2 * h1) * c / cols + 6 * (1 - t1); bx1 = 500 - h1 + (2 * h1) * (c + 1) / cols - 6 * (1 - t1)
            ya, yb = y0 - gap0, y1 + gap0 * .4
            colour = cset[c]
            broken = (i in (1, 4) and c != safe and c == (safe + 1) % cols)
            if broken:
                parts.append(f'<path d="M{ax0:.0f} {ya:.0f}L{bx0:.0f} {ya:.0f}L{bx1:.0f} {yb:.0f}L{ax1:.0f} {yb:.0f}Z" fill="#05010f" stroke="{colour}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="6 5"/>')
                # falling shards
                for k in range(4):
                    sx, sy = (ax0 + bx0) / 2 + rnd.uniform(-30, 30), ya + 20 + k * 22
                    parts.append(f'<path d="M{sx:.0f} {sy:.0f}l{rnd.uniform(8,18):.0f} {rnd.uniform(4,10):.0f}l{rnd.uniform(-14,-4):.0f} {rnd.uniform(8,14):.0f}Z" fill="{colour}" opacity="{.7-k*.13:.2f}"/>')
                continue
            parts.append(f'<path d="M{ax0:.0f} {ya:.0f}L{bx0:.0f} {ya:.0f}L{bx1:.0f} {yb:.0f}L{ax1:.0f} {yb:.0f}Z" fill="{colour}" opacity=".92"/>')
            parts.append(f'<path d="M{ax0:.0f} {ya:.0f}L{bx0:.0f} {ya:.0f}L{bx1:.0f} {yb:.0f}L{ax1:.0f} {yb:.0f}Z" fill="url(#shine)"/>')
            parts.append(f'<path d="M{ax0:.0f} {ya:.0f}L{bx0:.0f} {ya:.0f}" stroke="#000" stroke-opacity=".35" stroke-width="3"/>')
            if i == 2 and c == safe:
                parts.append(f'<path d="M{ax0:.0f} {ya:.0f}L{bx0:.0f} {ya:.0f}L{bx1:.0f} {yb:.0f}L{ax1:.0f} {yb:.0f}Z" fill="#fff6c2" opacity=".55" filter="url(#glow)"/>')
    # golden rails
    yn, hn = at(0); yf, hf = at(1)
    for side in (-1, 1):
        parts.append(f'<path d="M{500 + side*(hn+12):.0f} {yn:.0f}L{500 + side*(hf+6):.0f} {yf:.0f}" stroke="url(#rail)" stroke-width="10" stroke-linecap="round"/>')
        for i in range(rows + 1):
            yy, hh = at(i / rows)
            parts.append(f'<path d="M{500 + side*(hh+12):.0f} {yy:.0f}v{-34*(1-i/rows)-10:.0f}" stroke="#ffd36b" stroke-width="{6*(1-i/rows)+2:.1f}" stroke-linecap="round"/>')
            parts.append(f'<circle cx="{500 + side*(hh+12):.0f}" cy="{yy-34*(1-i/rows)-10:.0f}" r="{5*(1-i/rows)+2:.1f}" fill="#fff3b0"/>')
    # far bank with a flag
    parts.append(f'<path d="M380 {far_y+4}Q500 {far_y-30} 620 {far_y+4}Z" fill="#3a1d8a"/>')
    parts.append(f'<path d="M500 {far_y-26}v-58" stroke="#ffe08a" stroke-width="5"/><path d="M500 {far_y-84}l46 14-46 14z" fill="#ffcc3e"/>')
    # pawns on the bridge
    for (x, y, col, r) in [(430, 470, '#ffcc3e', 26), (585, 395, '#3fa7ff', 21), (520, 312, '#ff4d6d', 16)]:
        parts.append(f'<ellipse cx="{x}" cy="{y+r*.9:.0f}" rx="{r*1.1:.0f}" ry="{r*.35:.0f}" fill="#000" opacity=".35"/>')
        parts.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" stroke="#fff" stroke-width="{r/6:.1f}"/>')
        parts.append(f'<circle cx="{x-r*.3:.0f}" cy="{y-r*.35:.0f}" r="{r*.32:.0f}" fill="#fff" opacity=".55"/>')
    parts.append('</svg>')
    (OUT / 'bridge-cover-v33-12.svg').write_text(''.join(parts))

def ten():
    W, H = 1000, 600
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         '<defs><radialGradient id="bg" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#3a1590"/><stop offset=".6" stop-color="#1c0848"/><stop offset="1" stop-color="#0a0322"/></radialGradient>',
         '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b0"/><stop offset=".45" stop-color="#ffcc3e"/><stop offset="1" stop-color="#b9770f"/></linearGradient>',
         '<radialGradient id="face" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#2b1366"/><stop offset="1" stop-color="#12052e"/></radialGradient>',
         '<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2fd6a1"/><stop offset=".5" stop-color="#3fa7ff"/><stop offset="1" stop-color="#b57cff"/></linearGradient>',
         '<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', stars(70, W, H)]
    cx, cy, R = 500, 330, 205
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R+40}" fill="#7b3cff" opacity=".35" filter="url(#soft)"/>')
    # crown and buttons of the stopwatch
    p.append(f'<rect x="{cx-34}" y="{cy-R-62}" width="68" height="40" rx="12" fill="url(#gold)"/><rect x="{cx-58}" y="{cy-R-82}" width="116" height="28" rx="12" fill="url(#gold)"/>')
    p.append(f'<rect x="{cx+R*.62:.0f}" y="{cy-R*.92:.0f}" width="54" height="30" rx="10" fill="url(#gold)" transform="rotate(42 {cx+R*.62+27:.0f} {cy-R*.92+15:.0f})"/>')
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R+18}" fill="url(#gold)"/><circle cx="{cx}" cy="{cy}" r="{R}" fill="url(#face)"/>')
    # the ring of progress: nine and a bit seconds of ten
    a0, a1 = -math.pi / 2, -math.pi / 2 + 2 * math.pi * 0.94
    r = R - 22
    x0, y0, x1, y1 = cx + r * math.cos(a0), cy + r * math.sin(a0), cx + r * math.cos(a1), cy + r * math.sin(a1)
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#ffffff14" stroke-width="18"/>')
    p.append(f'<path d="M{x0:.1f} {y0:.1f}A{r} {r} 0 1 1 {x1:.1f} {y1:.1f}" fill="none" stroke="url(#ring)" stroke-width="18" stroke-linecap="round"/>')
    for k in range(60):
        a = -math.pi / 2 + 2 * math.pi * k / 60; big = k % 5 == 0
        r1, r2 = R - 44, R - (60 if big else 52)
        p.append(f'<path d="M{cx + r1*math.cos(a):.1f} {cy + r1*math.sin(a):.1f}L{cx + r2*math.cos(a):.1f} {cy + r2*math.sin(a):.1f}" stroke="#fff" stroke-opacity="{.85 if big else .35}" stroke-width="{4 if big else 2}" stroke-linecap="round"/>')
    # the big 10 drawn from shapes (no font needed): a bar and a ring
    p.append(f'<rect x="{cx-92}" y="{cy-70}" width="34" height="140" rx="12" fill="url(#gold)"/><path d="M{cx-92} {cy-58}l-26 22" stroke="url(#gold)" stroke-width="22" stroke-linecap="round"/>')
    p.append(f'<ellipse cx="{cx+40}" cy="{cy}" rx="52" ry="72" fill="none" stroke="url(#gold)" stroke-width="32"/>')
    # a tapping finger on the button
    p.append(f'<g transform="translate(760 430) rotate(-28)"><rect x="-34" y="-10" width="68" height="150" rx="34" fill="#f2c9a0"/><rect x="-26" y="-2" width="52" height="38" rx="18" fill="#ffe5cc"/><path d="M-34 70h68" stroke="#d9a77c" stroke-width="4"/></g>')
    p.append(f'<circle cx="732" cy="392" r="18" fill="#fff" opacity=".85"/><circle cx="732" cy="392" r="34" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4"/><circle cx="732" cy="392" r="52" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3"/>')
    # sparks of the seconds
    for k in range(10):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(R + 40, R + 120)
        x, y = cx + d * math.cos(a), cy + d * math.sin(a) * .8
        if 0 < x < W and 30 < y < H - 20:
            p.append(f'<path d="M{x:.0f} {y-10:.0f}l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffe08a" opacity=".9"/>')
    p.append('</svg>')
    (OUT / 'ten-cover-v33-12.svg').write_text(''.join(p))

bridge(); ten()
print('covers ready')
