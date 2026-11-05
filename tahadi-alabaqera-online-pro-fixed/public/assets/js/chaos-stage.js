/* Mirage Circuit — the road and runners share one camera in track coordinates. */
(() => {
  'use strict';

  const near = -3;
  const horizon = 72;
  const sight = 38;
  const accent = '#83f7df';
  const skyCache = new WeakMap();
  const bend = row => .16 * Math.sin(row / 15) + .065 * Math.sin(row / 5.5);

  function projection(width, height, camera) {
    const road = Math.min(width * .45, height * .78);
    const center = bend(camera);
    return (row, lane = 0) => {
      const distance = Math.max(near, row - camera);
      const scale = 9 / (9 + distance);
      const half = road * scale;
      return {
        x: width * (.5 + (bend(row) - center) * (1 - scale * .35)) + lane * half,
        y: height * (.245 + .56 * scale),
        half,
        scale,
      };
    };
  }

  function shape(ctx, points, fill, stroke, width = 1) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  function gradient(ctx, y1, y2, stops) {
    const color = ctx.createLinearGradient(0, y1, 0, y2);
    stops.forEach(([at, tint]) => color.addColorStop(at, tint));
    return color;
  }

  function sky(ctx, w, h) {
    let cache = skyCache.get(ctx);
    if (!cache || cache.width !== w || cache.height !== h) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(w);
      canvas.height = Math.ceil(h);
      const s = canvas.getContext('2d');
      s.fillStyle = gradient(s, 0, h * .42, [
        [0, '#0b152c'], [.36, '#2d2949'], [.74, '#805364'], [1, '#f5aa81'],
      ]);
      s.fillRect(0, 0, w, h);
      const sunX = w * .68, sunY = h * .235, radius = Math.min(w, h) * .103;
      const halo = s.createRadialGradient(sunX, sunY, radius * .6, sunX, sunY, radius * 3.2);
      halo.addColorStop(0, '#ffbe8b9c');
      halo.addColorStop(1, '#ff956800');
      s.fillStyle = halo;
      s.fillRect(0, 0, w, h * .48);
      ellipse(s, sunX, sunY, radius, radius, gradient(s, sunY - radius, sunY + radius, [[0, '#fff6ce'], [1, '#ff9d73']]));
      for (let i = 0; i < 27; i++) {
        const x = ((i * 43 + 31) % 173) / 173 * w;
        const y = ((i * 31 + 19) % 101) / 101 * h * .19;
        s.fillStyle = i % 3 ? '#e0e9ff63' : '#ffe7baaa';
        s.fillRect(x, y, i % 4 ? 1 : 1.5, 1.25);
      }
      for (let layer = 0; layer < 3; layer++) {
        const ridge = Array.from({ length: 24 }, (_, i) => [
          i * w / 23,
          h * (.29 + layer * .024 - Math.abs(Math.sin(i * .48 + layer * 2.7)) * (.049 - layer * .011) - ((i * 19) % 13) * .0016),
        ]);
        shape(s, [...ridge, [w, h * .48], [0, h * .48]], ['#5d475f', '#38384e', '#222b43'][layer]);
      }
      for (let i = 0; i < 44; i++) {
        const x = w * i / 44, bw = w * (.012 + (i % 4) * .0025);
        const y = h * (.34 - ((i * 19 + 6) % 23) * .0025);
        s.fillStyle = i % 3 ? '#19253b' : '#253048';
        s.fillRect(x, y, bw, h * .38 - y);
        if (i % 4 === 0) {
          line(s, x + bw * .55, y - h * .016, x + bw * .55, y, '#364c5e', 1);
          s.fillStyle = '#ffb38e';
          s.fillRect(x + bw * .55, y - h * .016, 1.5, 1.5);
        }
        for (let fy = y + 5; fy < h * .349; fy += 6) {
          s.fillStyle = i % 3 === 0 ? '#ffc788a6' : '#81d9d17a';
          s.fillRect(x + bw * .25, fy, Math.max(1, bw * .12), 1.3);
          s.fillRect(x + bw * .63, fy, Math.max(1, bw * .12), 1.3);
        }
      }
      s.fillStyle = gradient(s, h * .345, h, [[0, '#253148'], [.24, '#182335'], [1, '#080f20']]);
      s.fillRect(0, h * .345, w, h * .655);
      for (let i = 1; i <= 14; i++) {
        const y = h * (.35 + i * i * .0034);
        line(s, 0, y, w, y, i % 3 ? '#6a91a619' : '#83bdb82c', 1);
      }
      cache = { canvas, width: w, height: h };
      skyCache.set(ctx, cache);
    }
    ctx.drawImage(cache.canvas, 0, 0, w, h);
  }

  function ribbon(ctx, point, from, to, left, right, fill) {
    const a = point(from, left), b = point(from, right);
    const c = point(to, right), d = point(to, left);
    shape(ctx, [[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]], fill);
  }

  function road(ctx, point, camera, lane, zones) {
    const from = camera + near, to = camera + horizon;
    const steps = [from];
    for (let row = Math.ceil(from); row < to; row++) {
      if (row > from) steps.push(row);
    }
    steps.push(to);
    const edges = offset => steps.map(row => {
      const p = point(row, offset);
      return [p.x, p.y];
    });
    const strip = (left, right, fill) => shape(ctx, [...edges(left), ...edges(right).reverse()], fill);
    strip(-1.18, 1.18, '#0e1728');
    strip(-1.07, 1.07, '#34435b');
    strip(-1, 1, gradient(ctx, point(to).y, point(from).y, [[0, '#3d4158'], [.45, '#282f46'], [1, '#151e30']]));
    const laneCenter = (lane - 1) * 2 / 3;
    strip(laneCenter - .31, laneCenter + .31, '#83f7df0e');
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1], b = steps[i], row = Math.floor(a + .001);
      const danger = zones.some(([start, end]) => row >= start && row <= end);
      if (danger) ribbon(ctx, point, a, b, -1, 1, row % 2 ? '#fd846431' : '#fd846418');
      if (row % 2 === 0) {
        for (const side of [-1, 1]) {
          ribbon(ctx, point, a, b, side * .996, side * 1.064, danger ? '#ff9779' : '#74e3d4');
          ribbon(ctx, point, a, a + (b - a) * .62, side * .321, side * .339, '#c1e8e99c');
        }
      }
      if (row % 5 === 0) ribbon(ctx, point, a, a + (b - a) * .047, -1, 1, '#a9d6e135');
    }
  }

  function pylon(ctx, p, side, row) {
    const { x, y, scale, half } = p, height = half * .49;
    const tip = x - side * half * .13;
    line(ctx, x, y, tip, y - height, '#364c63', Math.max(2, 7 * scale));
    line(ctx, x, y, tip, y - height, '#a6cbd4', Math.max(.7, 1.1 * scale));
    line(ctx, tip, y - height, tip - side * half * .20, y - height, row % 12 ? '#8affea' : '#ffc08d', 3.2 * scale);
    const lamp = tip - side * half * .11;
    ellipse(ctx, lamp, y - height, half * .15, half * .039, '#9fffe727');
  }

  function arch(ctx, point, row, finish) {
    const l = point(row, -1.035), r = point(row, 1.035);
    const { y, half, scale } = l, up = half * .81, thick = Math.max(2, half * .047);
    const rail = finish ? '#fbd28e' : accent;
    if (finish) {
      for (let col = 0; col < 18; col++) {
        for (let stripe = 0; stripe < 2; stripe++) {
          const a = -1 + col / 9;
          ribbon(ctx, point, row - .36 + stripe * .36, row + stripe * .36, a, a + 1 / 9, (col + stripe) % 2 ? '#edf9ff' : '#111726');
        }
      }
    } else ribbon(ctx, point, row - .12, row + .12, -1, 1, rail);
    for (const x of [l.x, r.x]) {
      line(ctx, x, y, x, y - up, '#172437', thick * 1.8);
      line(ctx, x, y, x, y - up, rail, thick * .21);
    }
    const top = y - up, inset = thick * 1.25;
    shape(ctx, [[l.x - inset, top - thick], [r.x + inset, top - thick], [r.x - inset, top + thick * 2.1], [l.x + inset, top + thick * 2.1]], '#18273b', rail, Math.max(1, scale * 1.5));
    const font = Math.min(23, thick * 1.62);
    if (font >= 6) {
      ctx.font = '800 ' + font + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rail;
      ctx.fillText(finish ? 'FINISH / 98' : 'MIRAGE / 98', (l.x + r.x) / 2, top + thick * .55);
    }
  }

  function drawItem(ctx, p, it, open, ghost) {
    const { x, y, half, scale } = p, width = half * .51, height = width * .57, top = y - height;
    const l = x - width / 2, r = x + width / 2;
    ctx.save();
    if (ghost) {
      ctx.globalAlpha = .53;
      ctx.setLineDash([4 * scale, 3 * scale]);
    }
    ellipse(ctx, x, y, width * .56, width * .12, '#080f1cbf');
    switch (it.kind) {
      case 'wall': {
        const depth = width * .12;
        shape(ctx, [[l, top], [l + depth, top - depth], [r + depth, top - depth], [r, top]], '#ffa176');
        shape(ctx, [[r, top], [r + depth, top - depth], [r + depth, y - depth], [r, y]], '#a94945');
        shape(ctx, [[l, top], [r, top], [r, y], [l, y]], '#d96759', '#ffba96', 1.2 * scale);
        for (let k = 0; k < 3; k++) {
          const x0 = l + width * (.12 + k * .26);
          shape(ctx, [[x0, y - height * .25], [x0 + width * .12, top + height * .25], [x0 + width * .21, top + height * .25], [x0 + width * .09, y - height * .25]], '#452c41');
        }
        break;
      }
      case 'gate': {
        const color = open ? accent : '#ff826e';
        for (const px of [l, r]) {
          line(ctx, px, y, px, top - height * .55, '#1d3447', width * .16);
          line(ctx, px, y, px, top - height * .55, color, width * .035);
        }
        line(ctx, l, top - height * .55, r, top - height * .55, color, width * .071);
        if (!open) {
          shape(ctx, [[l, top], [r, top], [r, y], [l, y]], '#ff5e562e');
          line(ctx, l, top + height * .16, r, top + height * .16, '#ffad98', width * .046);
          line(ctx, l, top + height * .58, r, top + height * .58, color, width * .046);
        }
        break;
      }
      case 'box': {
        const cy = y - height * .78, d = width * .34;
        ellipse(ctx, x, y, d * 1.1, d * .25, '#ffd68d2c', '#fbd28e');
        shape(ctx, [[x, cy - d], [x + d, cy], [x, cy + d], [x - d, cy]], '#ffcb74', '#fff0bb', 1.5 * scale);
        shape(ctx, [[x, cy - d], [x + d, cy], [x, cy + d]], '#b97140');
        shape(ctx, [[x, cy - d * .49], [x + d * .28, cy], [x, cy + d * .49], [x - d * .28, cy]], '#fff6d8');
        break;
      }
      case 'pad':
        for (const dy of [-height * .25, 0, height * .25]) {
          shape(ctx, [[l, y + dy], [x, y + dy - height * .4], [r, y + dy], [x, y + dy - height * .17]], accent);
        }
        break;
      case 'spring':
        shape(ctx, [[l, y - height * .16], [x, y - height * .48], [r, y - height * .16], [x, y + height * .15]], '#995b53', '#ffc795');
        for (let i = 0; i < 3; i++) {
          line(ctx, x - width * .22, y - height * (.3 + i * .17), x + width * .22, y - height * (.42 + i * .17), '#e7dbe9', width * .051);
        }
        line(ctx, x - width * .29, top, x + width * .29, top, '#ffb37e', width * .125);
        break;
      case 'mud':
      case 'sticky': {
        const color = it.kind === 'mud' ? '#a77a66' : '#8bd97f';
        ellipse(ctx, x, y, width * .53, height * .3, it.kind === 'mud' ? '#503a40' : '#326951', color);
        line(ctx, x - width * .31, y, x - width * .10, y - height * .13, color, 2 * scale);
        line(ctx, x + width * .06, y + height * .11, x + width * .3, y + height * .03, color, 2 * scale);
        break;
      }
    }
    ctx.restore();
  }

  function paint(ctx, size, point, camera, lane, race, track, engine, time) {
    sky(ctx, size.w, size.h);
    road(ctx, point, camera, lane, engine.CHAOS_ZONES);
    const wave = engine.raceWave(race, time);
    const nextWave = race.startAt + (wave + 1) * engine.CHAOS_EVERY;
    const warning = time >= race.startAt && nextWave - time <= engine.CHAOS_WARN;
    const last = Math.min(engine.RACE_ROWS + 5, Math.floor(camera + sight));
    const first = Math.max(-3, Math.ceil(camera + near));
    for (let row = last; row >= first; row--) {
      if (row % 6 === 3) {
        for (const side of [-1, 1]) pylon(ctx, point(row, side * 1.27), side, row);
      }
      if (row === 0 || row === engine.RACE_ROWS) arch(ctx, point, row, row !== 0);
      if (row <= 0 || row >= engine.RACE_ROWS) continue;
      const draw = (it, ghost) => drawItem(ctx, point(row, (it.lane - 1) * 2 / 3), it, it.kind === 'gate' && engine.gateOpen(race, it, time), ghost);
      if (warning) {
        for (const it of engine.raceItems(track, race, row, nextWave)) {
          if (it.wave === wave + 1) draw(it, true);
        }
      }
      for (const it of engine.raceItems(track, race, row, time)) draw(it, false);
    }
  }

  function podiumPlaces(match) {
    return match.players.flatMap(player => {
      const runner = match.race.runners[player.slot];
      return runner?.done != null && runner.place > 0
        ? [{ player, place: runner.place, seconds: (runner.done - match.race.startAt) / 1000 }]
        : [];
    }).sort((a, b) => a.place - b.place).slice(0, 3);
  }

  globalThis.BS_RACE_STAGE = Object.freeze({ projection, paint, podiumPlaces });
})();
