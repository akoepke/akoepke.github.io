// ========== Interactive Teaser ==========
(function() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('teaser-svg');
  const tooltip = document.getElementById('teaser-tooltip');
  const tooltipImg = document.getElementById('tooltip-img');
  const tooltipText = document.getElementById('tooltip-text');

  const data = TEASER_DATA;
  const scales = data.scales;

  const QI = {x: 210, y: 195};
  const QT = {x: 730, y: 195};
  const queryImg = './images/query_0036/query.jpg';
  const queryText = '2004 Volvo S80 S Automatic 2.4 Rear Taken in Warwick';

  const imgBlobPath = 'M95,100 C60,60 110,30 200,45 C290,25 340,55 350,100 C370,160 355,260 330,310 C305,355 250,370 190,360 C130,350 80,310 70,260 C55,210 65,150 95,100 Z';
  const txtBlobPath = 'M575,90 C560,50 620,30 710,40 C800,30 850,65 860,110 C875,170 860,270 835,315 C810,360 755,375 700,365 C640,355 590,315 580,265 C565,210 560,140 575,90 Z';

  const COLOR_MATCH = '#34a853';
  const COLOR_GREY = '#8899aa';

  // NN palettes: DINO gets "warm" hues and LLM gets "cool" hues so that
  // within each scale the DINO rank-1 and LLM rank-1 are maximally different.
  // Inside each palette, entries sit at well-separated hue angles so that
  // consecutive rank-1 items across scales never look alike. Blues close to
  // the query (#4285f4) and greens close to the mutual-match color are avoided.
  const DINO_PALETTE = [
    '#d62728', // strong red
    '#ff7f0e', // orange
    '#bcbd22', // olive-yellow
    '#8c564b', // brown
    '#e377c2', // pink
    '#7f0000', // dark maroon
  ];
  const LLM_PALETTE = [
    '#9467bd', // purple
    '#17becf', // teal-cyan
    '#f781bf', // light magenta
    '#4a148c', // dark indigo
    '#00695c', // dark teal
    '#01579b', // deep blue (only used if palette cycles past 5)
  ];

  // Pre-assign unique color per rank-1 NN item.
  // The first time an ID appears as rank-1, its role (DINO vs LLM) decides
  // which palette it draws from. The same ID keeps its color across scales,
  // so persistent NNs stay consistent.
  const nnColorMap = {};
  let dinoIdx = 0, llmIdx = 0;
  for (let si = 0; si < scales.length; si++) {
    const sd = data.scaleData[scales[si]];
    const mutualIds = new Set();
    for (const d of sd.dino) { if (d.mutual) mutualIds.add(d.id); }
    const isScale0 = si === 0;
    const d1 = sd.dino[0];
    if (!(isScale0 && mutualIds.has(d1.id)) && !nnColorMap[d1.id]) {
      nnColorMap[d1.id] = DINO_PALETTE[dinoIdx++ % DINO_PALETTE.length];
    }
    const l1 = sd.llm[0];
    if (!(isScale0 && mutualIds.has(l1.id)) && !nnColorMap[l1.id]) {
      nnColorMap[l1.id] = LLM_PALETTE[llmIdx++ % LLM_PALETTE.length];
    }
  }

  // Deterministic angle per item ID
  function hashVal(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    return ((h & 0x7fffffff) % 1000) / 1000;
  }

  // Use golden angle to spread items evenly, seeded by hash
  const goldenAngle = 2.399963; // radians (~137.508°)
  let angleCounter = 0;
  const itemAngleMap = {}; // id+suffix -> angle
  // Persistent positions: once an item's (di, dt) is computed, it stays fixed
  // across scale changes so the same sample never appears to move.
  const itemPosMap = {}; // id -> {di, dt, type}

  function getAngle(id) {
    if (!itemAngleMap[id]) {
      // Start from hash-based offset, then increment by golden angle
      const base = hashVal(id) * Math.PI * 2;
      itemAngleMap[id] = base + angleCounter * goldenAngle;
      angleCounter++;
    }
    return itemAngleMap[id];
  }

  function dist(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }

  // Each scale gets a band: scale 0 = 125-150px, scale 5 = 25-50px from query.
  // Rank 1 = inner edge (closest), rank 10 = outer edge.
  // Add per-item jitter within the band so items don't form perfect circles.
  const BAND_W = 22, BAND_START = 145;
  function bandDist(si, rank, id) {
    const outer = BAND_START - si * BAND_W;
    const inner = outer - BAND_W;
    const h = hashVal(id + '_jitter');
    if (rank === 1) {
      return inner + h * 2; // rank 1: right at inner edge (0-2px)
    }
    // Other ranks: spread across outer 75% of band (inner 25% reserved for rank 1)
    return inner + BAND_W * 0.25 + h * BAND_W * 0.75;
  }

  // Place a dot at (angle, distance) from center.
  // If the point falls outside the blob ellipse, reduce distance to stay inside.
  function place(cx, cy, angle, distance, rx, ry) {
    rx = rx || 130; ry = ry || 150;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const maxR = (rx * ry) / Math.sqrt((ry * cosA) ** 2 + (rx * sinA) ** 2);
    const d = Math.min(distance, maxR - 10);
    return {x: cx + cosA * d, y: cy + sinA * d};
  }

  // Filler dots
  function seededRand(seed) {
    let s = seed;
    return function() { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
  const fillerImgDots = [], fillerTxtDots = [];
  const rngFI = seededRand(123), rngFT = seededRand(456);
  for (let i = 0; i < 300; i++) {
    const ix = 75 + rngFI() * 270, iy = 50 + rngFI() * 300;
    if (Math.sqrt(((ix-210)/120)**2 + ((iy-195)/140)**2) < 0.88)
      fillerImgDots.push({x: ix, y: iy, distQ: dist({x:ix,y:iy}, QI), scale: Math.min(5, Math.floor(fillerImgDots.length / 8))});
    const tx = 600 + rngFT() * 260, ty = 50 + rngFT() * 300;
    if (Math.sqrt(((tx-730)/120)**2 + ((ty-195)/140)**2) < 0.88)
      fillerTxtDots.push({x: tx, y: ty, distQ: dist({x:tx,y:ty}, QT), scale: Math.min(5, Math.floor(fillerTxtDots.length / 8))});
  }

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  let hoverEls = [];
  function clearHover() { hoverEls.forEach(e => e.remove()); hoverEls = []; }

  function wrapText(text, maxChars) {
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      if (line.length + w.length + 1 > maxChars && line) { lines.push(line); line = w; }
      else { line = line ? line + ' ' + w : w; }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Rectangle overlap test with a small padding.
  function rectsOverlap(a, b, pad = 4) {
    return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x ||
             a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
  }

  // Build a caption-popup rect (w,h,bx,by) given centre + queryY, without drawing.
  // Tries the preferred above/below position first, then the other side, then
  // picks a non-overlapping nudge if `avoid` rects are provided.
  function captionRect(cx, cy, text, queryY, avoid = []) {
    const lines = wrapText(text, 38);
    const lh = 18, pad = 10, w = 280, h = lines.length * lh + pad * 2;
    const bx0 = Math.max(5, Math.min(955 - w, cx - w / 2));
    const showBelow = cy >= queryY;
    const byBelow = Math.min(480 - h, cy + 14);
    const byAbove = Math.max(5, cy - h - 14);
    // Candidate vertical positions, in preference order.
    const yCandidates = showBelow ? [byBelow, byAbove] : [byAbove, byBelow];
    // Candidate horizontal nudges around the base x.
    const xCandidates = [bx0,
      Math.max(5, Math.min(955 - w, bx0 - (w + 14))),
      Math.max(5, Math.min(955 - w, bx0 + (w + 14))),
      Math.max(5, Math.min(955 - w, bx0 - 40)),
      Math.max(5, Math.min(955 - w, bx0 + 40))];
    for (const by of yCandidates) {
      for (const bx of xCandidates) {
        const r = {x: bx, y: by, w, h, lines, lh, pad, showBelow};
        if (!avoid.some(a => rectsOverlap(r, a))) return r;
      }
    }
    return {x: bx0, y: yCandidates[0], w, h, lines, lh, pad, showBelow};
  }

  function drawCaptionAt(rect) {
    const g = el('g', {'pointer-events': 'none'});
    g.appendChild(el('rect', {x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: '4',
      fill: 'var(--bulma-background)', stroke: 'var(--bulma-border)', 'stroke-width': '1'}));
    rect.lines.forEach((ln, i) => {
      const t = el('text', {x: rect.x + rect.w/2, y: rect.y + rect.pad + (i+1) * rect.lh - 3,
        'text-anchor': 'middle', 'font-family': 'Noto Sans, sans-serif', 'font-size': '14', fill: 'var(--bulma-text)'});
      t.textContent = ln; g.appendChild(t);
    });
    return g;
  }

  // Show caption above or below the dot, choosing whichever side doesn't cover the query
  function makeCaptionPopup(cx, cy, text, queryY) {
    return drawCaptionAt(captionRect(cx, cy, text, queryY));
  }

  // Build an image-popup rect given centre, trying alternative positions to avoid overlap.
  function imageRect(cx, cy, avoid = []) {
    const w = 100, h = 75;
    const baseX = (cx < QI.x) ? Math.max(5, cx - w - 14) : Math.min(430, cx + 14);
    const altX  = (cx < QI.x) ? Math.min(430, cx + 14) : Math.max(5, cx - w - 14);
    const baseY = Math.max(5, Math.min(380, cy - h/2));
    // Candidate positions: preferred side, then the opposite side, then vertical nudges.
    const yCandidates = [baseY,
      Math.max(5, Math.min(380, baseY - (h + 14))),
      Math.max(5, Math.min(380, baseY + (h + 14))),
      Math.max(5, Math.min(380, baseY - 40)),
      Math.max(5, Math.min(380, baseY + 40))];
    for (const x of [baseX, altX]) {
      for (const y of yCandidates) {
        const r = {x, y, w, h};
        if (!avoid.some(a => rectsOverlap(r, a))) return r;
      }
    }
    return {x: baseX, y: baseY, w, h};
  }

  function drawImageAt(rect, imgSrc) {
    const g = el('g', {'pointer-events': 'none'});
    const cid = 'hc-' + Date.now() + '-' + Math.floor(Math.random()*10000);
    const df = el('defs'), cp = el('clipPath', {id: cid});
    cp.appendChild(el('rect', {x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: '4'}));
    df.appendChild(cp); g.appendChild(df);
    g.appendChild(el('rect', {x: rect.x-1, y: rect.y-1, width: rect.w+2, height: rect.h+2, rx: '5',
      fill: 'var(--bulma-background)', stroke: 'var(--bulma-border)', 'stroke-width': '1'}));
    g.appendChild(el('image', {href: imgSrc, x: rect.x, y: rect.y, width: rect.w, height: rect.h,
      'clip-path': `url(#${cid})`, preserveAspectRatio: 'xMidYMid meet'}));
    return g;
  }

  function makeImagePopup(cx, cy, imgSrc) {
    return drawImageAt(imageRect(cx, cy), imgSrc);
  }

  // ============ Precompute and cache positions ============
  // Walk all scales 0..N in order. Each ID gets its position fixed the first
  // time it appears (at its most sparse scale), so a persistent sample always
  // renders at the same screen position regardless of which scale is shown.
  let posComputed = false;
  function precomputePositions() {
    if (posComputed) return;
    posComputed = true;
    const seen = new Set();
    for (let si = 0; si < scales.length; si++) {
      const sd = data.scaleData[scales[si]];
      const mutualIds = new Set();
      for (const d of sd.dino) { if (d.mutual) mutualIds.add(d.id); }
      const llmRankOf = {};
      for (const l of sd.llm) { if (mutualIds.has(l.id)) llmRankOf[l.id] = l.rank; }

      for (const d of sd.dino) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);

        const nearAngle = getAngle(d.id);
        const farAngle = getAngle(d.id + '_far');
        const farDist = 100 + hashVal(d.id + '_far') * 60;

        const imgD = bandDist(si, d.rank, d.id);
        const di = place(QI.x, QI.y, nearAngle, imgD);

        let dt, type = 'dino';
        if (d.mutual) {
          const txtD = bandDist(si, llmRankOf[d.id] || d.rank, d.id + '_t');
          const txtAngle = getAngle(d.id + '_txt');
          dt = place(QT.x, QT.y, txtAngle, txtD, 130, 150);
          type = 'both';
        } else {
          dt = place(QT.x, QT.y, farAngle, farDist, 130, 150);
        }
        itemPosMap[d.id] = {di, dt, type};
      }

      for (const l of sd.llm) {
        if (mutualIds.has(l.id)) continue;
        if (seen.has(l.id)) continue;
        seen.add(l.id);

        const nearAngle = getAngle(l.id);
        const farAngle = getAngle(l.id + '_far');
        const farDist = 100 + hashVal(l.id + '_far') * 60;

        const txtD = bandDist(si, l.rank, l.id);
        const dt = place(QT.x, QT.y, nearAngle, txtD, 130, 150);
        const di = place(QI.x, QI.y, farAngle, farDist);
        itemPosMap[l.id] = {di, dt, type: 'llm'};
      }
    }
  }

  // ============ Build items for a scale ============
  // Items get positions computed fresh each time based on their rank AT THIS SCALE.
  // Items from previous scales that reappear get their NEW rank at this scale.
  // Items from previous scales that DON'T reappear keep their old-scale band position.
  function getItems(scaleIdx) {
    // Precompute positions once: walk scales 0..N in order so every ID's
    // position is locked at the FIRST scale where it appears. itemPosMap is a
    // persistent cache, so later calls just reuse whatever is already there.
    precomputePositions();

    const items = [];
    const seenIds = new Set();

    // Process current scale first (gets correct rank / isCurrent), then walk
    // backwards through earlier scales. Positions are always pulled from the
    // cache so the same sample stays at the same (x, y) across scale changes.
    for (let si = scaleIdx; si >= 0; si--) {
      const sd = data.scaleData[scales[si]];
      const mutualIds = new Set();
      for (const d of sd.dino) { if (d.mutual) mutualIds.add(d.id); }
      const llmRankOf = {};
      for (const l of sd.llm) { if (mutualIds.has(l.id)) llmRankOf[l.id] = l.rank; }

      for (const d of sd.dino) {
        if (seenIds.has(d.id)) continue;
        seenIds.add(d.id);

        const cached = itemPosMap[d.id];
        const di = cached.di, dt = cached.dt, type = cached.type;

        items.push({...d, type, isCurrent: si === scaleIdx,
          dinoRank: d.rank, llmRank: llmRankOf[d.id] || 99, di, dt});
      }

      for (const l of sd.llm) {
        if (mutualIds.has(l.id)) continue;
        if (seenIds.has(l.id)) continue;
        seenIds.add(l.id);

        const cached = itemPosMap[l.id];
        const di = cached.di, dt = cached.dt;

        items.push({...l, type: 'llm', isCurrent: si === scaleIdx,
          dinoRank: 99, llmRank: l.rank, di, dt});
      }
    }

    // Special: move the 1M DINO rank-1 text dot near the text query
    if (scaleIdx === 5) {
      const dino1 = items.find(i => i.type === 'dino' && i.rank === 1 && i.isCurrent);
      if (dino1) dino1.dt = {x: QT.x + 15, y: QT.y + 40};
    }

    return items;
  }

  // ============ Render ============
  function render(scaleIdx) {
    svg.innerHTML = '';
    const scaleKey = scales[scaleIdx];
    const sd = data.scaleData[scaleKey];
    const items = getItems(scaleIdx);

    const dinoNN1 = items.find(i => i.isCurrent && (i.type === 'dino' || i.type === 'both') && i.dinoRank === 1);
    const llmNN1 = items.find(i => i.isCurrent && (i.type === 'llm' || i.type === 'both') && i.llmRank === 1);
    const dinoNNdist = dinoNN1 ? dist(dinoNN1.di, QI) : 999;
    const llmNNdist = llmNN1 ? dist(llmNN1.dt, QT) : 999;

    // Blobs
    svg.appendChild(el('path', {d: imgBlobPath, fill: 'var(--blob-fill)', opacity: '0.6'}));
    svg.appendChild(el('path', {d: txtBlobPath, fill: 'var(--blob-fill)', opacity: '0.6'}));

    // Labels
    const lbl = (x, y, txt) => {
      const t = el('text', {x, y, 'text-anchor': 'middle', 'font-family': 'Google Sans, Noto Sans, sans-serif',
        'font-size': '20', 'font-weight': '700', fill: 'var(--bulma-text-strong)'});
      t.textContent = txt; return t;
    };
    svg.appendChild(lbl(220, 22, 'Image Space'));
    svg.appendChild(lbl(740, 22, 'Text Space'));

    // Filler dots
    const fg = el('g');
    fillerImgDots.forEach(d => {
      if (d.scale <= scaleIdx && d.distQ > dinoNNdist + 8)
        fg.appendChild(el('circle', {cx: d.x, cy: d.y, r: '3', fill: '#aabbcc', opacity: '0.25'}));
    });
    fillerTxtDots.forEach(d => {
      if (d.scale <= scaleIdx && d.distQ > llmNNdist + 8)
        fg.appendChild(el('circle', {cx: d.x, cy: d.y, r: '3', fill: '#aabbcc', opacity: '0.25'}));
    });
    svg.appendChild(fg);

    // Query-to-query line
    const qmx = (QI.x + QT.x) / 2, qmy = QI.y - 35;
    svg.appendChild(el('path', {
      d: `M${QI.x},${QI.y} Q${qmx},${qmy} ${QT.x},${QT.y}`,
      stroke: '#4285f4', 'stroke-width': '1.5', fill: 'none', 'stroke-dasharray': '3,4', opacity: '0.4'
    }));

    // NN connection lines
    if (dinoNN1) svg.appendChild(el('line', {
      x1: QI.x, y1: QI.y, x2: dinoNN1.di.x, y2: dinoNN1.di.y,
      stroke: '#4285f4', 'stroke-width': '2.5', 'stroke-dasharray': '6,4', opacity: '0.6'
    }));
    if (llmNN1) svg.appendChild(el('line', {
      x1: QT.x, y1: QT.y, x2: llmNN1.dt.x, y2: llmNN1.dt.y,
      stroke: '#4285f4', 'stroke-width': '2.5', 'stroke-dasharray': '6,4', opacity: '0.6'
    }));

    // Hit areas are collected and appended AFTER query dots so they sit on top
    // in z-order. This matters at the densest scales where rank-1 NN dots sit
    // right next to the query dot and the query dot would otherwise eat clicks.
    const hitAreas = [];

    // Items
    for (const item of items) {
      const isBoth = item.type === 'both';
      const isR1D = item.isCurrent && ((item.type === 'dino' && item.rank === 1) || (isBoth && item.dinoRank === 1));
      const isR1L = item.isCurrent && ((item.type === 'llm' && item.rank === 1) || (isBoth && item.llmRank === 1));
      const isNN = isR1D || isR1L;

      let itemColor = COLOR_GREY;
      if (isBoth && (item.dinoRank === 1 || item.llmRank === 1) && scaleIdx === 0) itemColor = COLOR_MATCH;
      else if (isNN) itemColor = nnColorMap[item.id] || COLOR_GREY;

      const sz = isNN ? 9 : 5;
      const opac = isNN ? '1' : '0.45';

      // Image dot (visible)
      const imgDot = el('circle', {cx: item.di.x, cy: item.di.y, r: sz,
        fill: itemColor, stroke: isNN ? 'white' : 'none', 'stroke-width': isNN ? '2.5' : '0',
        opacity: opac, 'pointer-events': 'none'});
      svg.appendChild(imgDot);
      if (isR1D) {
        svg.appendChild(el('circle', {cx: item.di.x, cy: item.di.y, r: '14', fill: 'none', stroke: '#4285f4', 'stroke-width': '2.5', 'pointer-events': 'none'}));
        const t = el('text', {x: item.di.x, y: item.di.y + 24, 'text-anchor': 'middle',
          'font-family': 'Noto Sans, sans-serif', 'font-size': '13', 'font-weight': '700', fill: '#4285f4', 'pointer-events': 'none'});
        t.textContent = 'NN'; svg.appendChild(t);
      }

      // Text dot (visible)
      const txtDot = el('circle', {cx: item.dt.x, cy: item.dt.y, r: sz,
        fill: itemColor, stroke: isNN ? 'white' : 'none', 'stroke-width': isNN ? '2.5' : '0',
        opacity: opac, 'pointer-events': 'none'});
      svg.appendChild(txtDot);
      if (isR1L) {
        svg.appendChild(el('circle', {cx: item.dt.x, cy: item.dt.y, r: '14', fill: 'none', stroke: '#4285f4', 'stroke-width': '2.5', 'pointer-events': 'none'}));
        const t = el('text', {x: item.dt.x, y: item.dt.y + 24, 'text-anchor': 'middle',
          'font-family': 'Noto Sans, sans-serif', 'font-size': '13', 'font-weight': '700', fill: '#4285f4', 'pointer-events': 'none'});
        t.textContent = 'NN'; svg.appendChild(t);
      }

      // Hover
      function onHover(e) {
        clearHover();
        const lc = item.mutual ? '#34a853' : '#888';
        const mx = (item.di.x + item.dt.x) / 2, my = Math.min(item.di.y, item.dt.y) - 30;
        const link = el('path', {d: `M${item.di.x},${item.di.y} Q${mx},${my} ${item.dt.x},${item.dt.y}`,
          stroke: lc, 'stroke-width': item.mutual ? '2.5' : '1.5', fill: 'none',
          'stroke-dasharray': item.mutual ? '6,4' : '4,3', opacity: '0.7'});
        svg.appendChild(link); hoverEls.push(link);
        // Query popups get FIXED positions next to their dots.
        const qImgR = imageRect(QI.x, QI.y);
        const qCapR = captionRect(QT.x, QT.y, queryText, QT.y);
        // Item popups then dynamically nudge to avoid overlap with the fixed query popups.
        const avoid = [qImgR, qCapR];
        let itemImgR = null, itemCapR = null;
        if (item.img) { itemImgR = imageRect(item.di.x, item.di.y, avoid); avoid.push(itemImgR); }
        if (item.caption) { itemCapR = captionRect(item.dt.x, item.dt.y, item.caption, QT.y, avoid); }
        // Draw.
        const gQI = drawImageAt(qImgR, queryImg); svg.appendChild(gQI); hoverEls.push(gQI);
        const gQT = drawCaptionAt(qCapR); svg.appendChild(gQT); hoverEls.push(gQT);
        if (itemImgR) { const g = drawImageAt(itemImgR, item.img); svg.appendChild(g); hoverEls.push(g); }
        if (itemCapR) { const g = drawCaptionAt(itemCapR); svg.appendChild(g); hoverEls.push(g); }
        [imgDot, txtDot].forEach(d => {
          const hl = el('circle', {cx: d.getAttribute('cx'), cy: d.getAttribute('cy'), r: '13',
            fill: 'none', stroke: '#888', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', opacity: '0.6', 'pointer-events': 'none'});
          svg.appendChild(hl); hoverEls.push(hl);
        });
      }
      // Large invisible hit areas for stickier hover (harder to lose the dot on jitter).
      // NN dots get bigger hit areas so you can grab them easily at dense scales where
      // they sit right next to the query dot.
      const hitR = isNN ? 18 : 10;
      const imgHit = el('circle', {cx: item.di.x, cy: item.di.y, r: hitR,
        fill: 'transparent', style: 'cursor:pointer'});
      const txtHit = el('circle', {cx: item.dt.x, cy: item.dt.y, r: hitR,
        fill: 'transparent', style: 'cursor:pointer'});
      imgHit.addEventListener('mouseenter', onHover);
      imgHit.addEventListener('mouseleave', clearHover);
      txtHit.addEventListener('mouseenter', onHover);
      txtHit.addEventListener('mouseleave', clearHover);
      // NN hit areas get appended LAST (bottom of list, top of z-order) so they
      // beat non-NN item hit areas and the query dots.
      if (isNN) { hitAreas.push(imgHit); hitAreas.push(txtHit); }
      else { hitAreas.unshift(imgHit); hitAreas.unshift(txtHit); }
    }

    // Query dots (visible only; hit circles added below on top of item hit areas)
    const qImgDot = el('circle', {cx: QI.x, cy: QI.y, r: '11', fill: '#4285f4', stroke: 'white', 'stroke-width': '2.5', 'pointer-events': 'none'});
    svg.appendChild(qImgDot);
    const qIL = el('text', {x: QI.x, y: QI.y - 18, 'text-anchor': 'middle', 'font-family': 'Noto Sans, sans-serif', 'font-size': '14', 'font-weight': '700', fill: '#4285f4', 'pointer-events': 'none'});
    qIL.textContent = 'query'; svg.appendChild(qIL);
    const qTxtDot = el('circle', {cx: QT.x, cy: QT.y, r: '11', fill: '#4285f4', stroke: 'white', 'stroke-width': '2.5', 'pointer-events': 'none'});
    svg.appendChild(qTxtDot);
    const qTL = el('text', {x: QT.x, y: QT.y - 18, 'text-anchor': 'middle', 'font-family': 'Noto Sans, sans-serif', 'font-size': '14', 'font-weight': '700', fill: '#4285f4', 'pointer-events': 'none'});
    qTL.textContent = 'query'; svg.appendChild(qTL);

    function onQHover(e) {
      clearHover();
      const mx = (QI.x + QT.x) / 2, my = QI.y - 40;
      const link = el('path', {d: `M${QI.x},${QI.y} Q${mx},${my} ${QT.x},${QT.y}`, stroke: '#888', 'stroke-width': '1.5', fill: 'none', 'stroke-dasharray': '4,3', opacity: '0.7'});
      svg.appendChild(link); hoverEls.push(link);
      const gI = makeImagePopup(QI.x, QI.y, queryImg); svg.appendChild(gI); hoverEls.push(gI);
      const gT = makeCaptionPopup(QT.x, QT.y, queryText, QT.y); svg.appendChild(gT); hoverEls.push(gT);
    }
    // Query hit circles — small so they don't eat NN hit areas that sit right next
    // to them at dense scales.
    const qImgHit = el('circle', {cx: QI.x, cy: QI.y, r: '11', fill: 'transparent', style: 'cursor:pointer'});
    const qTxtHit = el('circle', {cx: QT.x, cy: QT.y, r: '11', fill: 'transparent', style: 'cursor:pointer'});
    qImgHit.addEventListener('mouseenter', onQHover); qImgHit.addEventListener('mouseleave', clearHover);
    qTxtHit.addEventListener('mouseenter', onQHover); qTxtHit.addEventListener('mouseleave', clearHover);

    // Append all item hit areas LAST so they sit on top of the query dots in z-order.
    // Non-NN hit areas go down first, then the query hit circles, then the NN hit areas
    // on top — that way NN items win the overlap with the query dot at dense scales.
    let firstNNIdx = 0;
    while (firstNNIdx < hitAreas.length && hitAreas[firstNNIdx].getAttribute('r') !== '18') firstNNIdx++;
    for (let i = 0; i < firstNNIdx; i++) svg.appendChild(hitAreas[i]);
    svg.appendChild(qImgHit); svg.appendChild(qTxtHit);
    for (let i = firstNNIdx; i < hitAreas.length; i++) svg.appendChild(hitAreas[i]);

    // Match label (inside SVG, right below blobs)
    const r1match = sd.dino[0] && sd.llm[0] && sd.dino[0].id === sd.llm[0].id;
    const ml = el('text', {x: 480, y: 400, 'text-anchor': 'middle',
      'font-family': 'Google Sans, Noto Sans, sans-serif', 'font-size': '22', 'font-weight': '700',
      fill: r1match ? '#34a853' : '#d93025'});
    ml.textContent = r1match
      ? '\u2713   The NNs in text and image space are consistent'
      : '\u2717   The NNs in text and image space are not consistent';
    svg.appendChild(ml);
  }

  // Slider
  const scaleLabels = ['1,024', '10K', '50K', '100K', '500K', '1M'];
  const slider = document.getElementById('gallery-slider');
  const sizeLabel = document.getElementById('gallery-size-label');

  slider.addEventListener('input', function() {
    const si = parseInt(this.value);
    sizeLabel.textContent = scaleLabels[si];
    render(si);
  });

  render(0);
})();
