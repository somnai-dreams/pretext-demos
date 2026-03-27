// the-editorial-engine.ts
import {
  layout,
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  walkLineRanges
} from "./pretext.js";
var BODY_FONT = '18px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var BODY_LINE_HEIGHT = 30;
var HEADLINE_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var HEADLINE_TEXT = "THE FUTURE OF TEXT LAYOUT IS NOT CSS";
var GUTTER = 48;
var COL_GAP = 40;
var STATS_BAR_HEIGHT = 42;
var DROP_CAP_LINES = 3;
var MIN_SLOT_WIDTH = 50;
function carveTextLineSlots(base, blocked) {
  let slots = [base];
  for (let bi = 0;bi < blocked.length; bi++) {
    const iv = blocked[bi];
    const next = [];
    for (let si = 0;si < slots.length; si++) {
      const s = slots[si];
      if (iv.right <= s.left || iv.left >= s.right) {
        next.push(s);
        continue;
      }
      if (iv.left > s.left)
        next.push({ left: s.left, right: iv.left });
      if (iv.right < s.right)
        next.push({ left: iv.right, right: s.right });
    }
    slots = next;
  }
  return slots.filter((s) => s.right - s.left >= MIN_SLOT_WIDTH);
}
function circleIntervalForBand(cx, cy, r, bandTop, bandBottom, hPad, vPad) {
  const top = bandTop - vPad;
  const bottom = bandBottom + vPad;
  if (top >= cy + r || bottom <= cy - r)
    return null;
  const minDy = cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom;
  if (minDy >= r)
    return null;
  const maxDx = Math.sqrt(r * r - minDy * minDy);
  return { left: cx - maxDx - hPad, right: cx + maxDx + hPad };
}
var BODY_TEXT = `The web renders text through a pipeline that was designed thirty years ago for static documents. A browser loads a font, shapes the text into glyphs, measures their combined width, determines where lines break, and positions each line vertically. Every step depends on the previous one. Every step requires the rendering engine to consult its internal layout tree — a structure so expensive to maintain that browsers guard access to it behind synchronous reflow barriers that can freeze the main thread for tens of milliseconds at a time.

For a paragraph in a blog post, this pipeline is invisible. The browser loads, lays out, and paints before the reader’s eye has traveled from the address bar to the first word. But the web is no longer a collection of static documents. It is a platform for applications, and those applications need to know about text in ways the original pipeline never anticipated.

A messaging application needs to know the exact height of every message bubble before rendering a virtualized list. A masonry layout needs the height of every card to position them without overlap. An editorial page needs text to flow around images, advertisements, and interactive elements. A responsive dashboard needs to resize and reflow text in real time as the user drags a panel divider.

Every one of these operations requires text measurement. And every text measurement on the web today requires a synchronous layout reflow. The cost is devastating. Measuring the height of a single text block forces the browser to recalculate the position of every element on the page. When you measure five hundred text blocks in sequence, you trigger five hundred full layout passes. This pattern, known as layout thrashing, is the single largest source of jank on the modern web.

Chrome DevTools will flag it with angry red bars. Lighthouse will dock your performance score. But the developer has no alternative — CSS provides no API for computing text height without rendering it. The information is locked behind the DOM, and the DOM makes you pay for every answer.

Developers have invented increasingly desperate workarounds. Estimated heights replace real measurements with guesses, causing content to visibly jump when the guess is wrong. ResizeObserver watches elements for size changes, but it fires asynchronously and always at least one frame too late. IntersectionObserver tracks visibility but says nothing about dimensions. Content-visibility allows the browser to skip rendering off-screen elements, but it breaks scroll position and accessibility. Each workaround addresses one symptom while introducing new problems.

The CSS Shapes specification, finalized in 2014, was supposed to bring magazine-style text wrap to the web. It allows text to flow around a defined shape — a circle, an ellipse, a polygon, even an image alpha channel. On paper, it was the answer. In practice, it is remarkably limited. CSS Shapes only works with floated elements. Text can only wrap on one side of the shape. The shape must be defined statically in CSS — you cannot animate it or change it dynamically without triggering a full layout reflow. And because it operates within the browser’s layout engine, you have no access to the resulting line geometry. You cannot determine where each line of text starts and ends, how many lines were generated, or what the total height of the shaped text block is.

The editorial layouts we see in print magazines — text flowing around photographs, pull quotes interrupting the column, multiple columns with seamless text handoff — have remained out of reach for the web. Not because they are conceptually difficult, but because the performance cost of implementing them with DOM measurement makes them impractical. A two-column editorial layout that reflows text around three obstacle shapes requires measuring and positioning hundreds of text lines. At thirty milliseconds per measurement, this would take seconds — an eternity for a render frame.

What if text measurement did not require the DOM at all? What if you could compute exactly where every line of text would break, exactly how wide each line would be, and exactly how tall the entire text block would be, using nothing but arithmetic?

This is the core insight of pretext. The browser’s canvas API includes a measureText method that returns the width of any string in any font without triggering a layout reflow. Canvas measurement uses the same font engine as DOM rendering — the results are identical. But because it operates outside the layout tree, it carries no reflow penalty.

Pretext exploits this asymmetry. When text first appears, pretext measures every word once via canvas and caches the widths. After this preparation phase, layout is pure arithmetic: walk the cached widths, track the running line width, insert line breaks when the width exceeds the maximum, and sum the line heights. No DOM. No reflow. No layout tree access.

The performance improvement is not incremental. Measuring five hundred text blocks with DOM methods costs fifteen to thirty milliseconds and triggers five hundred layout reflows. With pretext, the same operation costs 0.05 milliseconds and triggers zero reflows. This is a three hundred to six hundred times improvement. But even that number understates the impact, because pretext’s cost does not scale with page complexity — it is independent of how many other elements exist on the page.

With DOM-free text measurement, an entire class of previously impractical interfaces becomes trivial. Text can flow around arbitrary shapes, not because the browser’s layout engine supports it, but because you control the line widths directly. For each line of text, you compute which horizontal intervals are blocked by obstacles, subtract them from the available width, and pass the remaining width to the layout engine. The engine returns the text that fits, and you position the line at the correct offset.

This is exactly what CSS Shapes tried to accomplish, but with none of its limitations. Obstacles can be any shape — rectangles, circles, arbitrary polygons, even the alpha channel of an image. Text wraps on both sides simultaneously. Obstacles can move, animate, or be dragged by the user, and the text reflows instantly because the layout computation takes less than a millisecond.

Shrinkwrap is another capability that CSS cannot express. Given a block of multiline text, what is the narrowest width that preserves the current line count? CSS offers fit-content, which works for single lines but always leaves dead space for multiline text. Pretext solves this with a binary search over widths: narrow until the line count increases, then back off. The result is the tightest possible bounding box — perfect for chat message bubbles, image captions, and tooltip text.

Virtualized text rendering becomes exact rather than estimated. A virtual list needs to know the height of items before they enter the viewport, so it can position them correctly and calculate scroll extent. Without pretext, you must either render items off-screen to measure them (defeating the purpose of virtualization) or estimate heights and accept visual jumping when items enter the viewport with different heights than predicted. Pretext computes exact heights without creating any DOM elements, enabling perfect virtualization with zero visual artifacts.

Multi-column text flow with cursor handoff is perhaps the most striking capability. The left column consumes text until it reaches the bottom, then hands its cursor to the right column. The right column picks up exactly where the left column stopped, with no duplication, no gap, and perfect line breaking at the column boundary. This is how newspapers and magazines work on paper, but it has never been achievable on the web without extreme hacks involving multiple elements, hidden overflow, and JavaScript-managed content splitting.

Pretext makes it trivial. Call layoutNextLine in a loop for the first column, using the column width. When the column is full, take the returned cursor and start a new loop for the second column. The cursor carries the exact position in the prepared text — which segment, which grapheme within that segment. The second column continues seamlessly from the first.

Adaptive headline sizing is a detail that separates professional typography from amateur layout. The headline should be as large as possible without breaking any word across lines. This requires a binary search: try a font size, measure the text, check if any line breaks occur within a word, and adjust. With DOM measurement, each iteration costs a reflow. With pretext, each iteration is a microsecond of arithmetic.

Real-time text reflow around animated obstacles is the ultimate stress test. The demonstration you are reading right now renders text that flows around multiple moving objects simultaneously, every frame, at sixty frames per second. Each frame, the layout engine computes obstacle intersections for every line of text, determines the available horizontal slots, lays out each line at the correct width and position, and updates the DOM with the results. The total computation time is typically under half a millisecond.

The glowing orbs drifting across this page are not decorative — they are the demonstration. Each orb is a circular obstacle. For every line of text, the engine checks whether the line’s vertical band intersects each orb. If it does, it computes the blocked horizontal interval and subtracts it from the available width. The remaining width might be split into two or more segments — and the engine fills every viable slot, flowing text on both sides of the obstacle simultaneously. This is something CSS Shapes cannot do at all.

All of this runs without a single DOM measurement. The line positions, widths, and text contents are computed entirely in JavaScript using cached font metrics. The only DOM writes are setting the left, top, and textContent of each line element — the absolute minimum required to show text on screen. The browser never needs to compute layout because all positioning is explicit.

This performance characteristic has profound implications for the web platform. For thirty years, the browser has been the gatekeeper of text information. If you wanted to know anything about how text would render — its width, its height, where its lines break — you had to ask the browser, and the browser made you pay for the answer with a layout reflow. This created an artificial scarcity of text information that constrained what interfaces could do.

Pretext removes that constraint. Text information becomes abundant and cheap. You can ask how text would look at a thousand different widths in the time it used to take to ask about one. You can recompute text layout every frame, every drag event, every pixel of window resize, without any performance concern.

The implications extend beyond layout into composition. When you have instant text measurement, you can build compositing engines that combine text with graphics, animation, and interaction in ways that were previously reserved for game engines and native applications. Text becomes a first-class participant in the visual composition, not a static block that the rest of the interface must work around.

Imagine a data visualization where labels reflow around chart elements as the user zooms and pans. Imagine a collaborative document editor where text flows around embedded widgets, images, and annotations placed by other users, updating live as they move things around. Imagine a map application where place names wrap intelligently around geographic features rather than overlapping them. These are not hypothetical — they are engineering problems that become solvable when text measurement costs a microsecond instead of thirty milliseconds.

The open web deserves typography that matches its ambition. We build applications that rival native software in every dimension except text. Our animations are smooth, our interactions are responsive, our graphics are stunning — but our text sits in rigid boxes, unable to flow around obstacles, unable to adapt to dynamic layouts, unable to participate in the fluid compositions that define modern interface design.

This is what changes when text measurement becomes free. Not slightly better — categorically different. The interfaces that were too expensive to build become trivial. The layouts that existed only in print become interactive. The text that sat in boxes begins to flow.

The web has been waiting thirty years for this. A fifteen kilobyte library with zero dependencies delivers it. No browser API changes needed. No specification process. No multi-year standardization timeline. Just math, cached measurements, and the audacity to ask: what if we simply stopped asking the DOM?

Fifteen kilobytes. Zero dependencies. Zero DOM reads. And the text flows.`;
var PULLQUOTE_TEXTS = [
  "“The performance improvement is not incremental — it is categorical. 0.05ms versus 30ms. Zero reflows versus five hundred.”",
  "“Text becomes a first-class participant in the visual composition — not a static block, but a fluid material that adapts in real time.”"
];
var stage = document.getElementById("stage");
var orbDefs = [
  { fx: 0.52, fy: 0.22, r: 110, vx: 24, vy: 16, color: [196, 163, 90] },
  { fx: 0.18, fy: 0.48, r: 85, vx: -19, vy: 26, color: [100, 140, 255] },
  { fx: 0.74, fy: 0.58, r: 95, vx: 16, vy: -21, color: [232, 100, 130] },
  { fx: 0.38, fy: 0.72, r: 75, vx: -26, vy: -14, color: [80, 200, 140] },
  { fx: 0.86, fy: 0.18, r: 65, vx: -13, vy: 19, color: [150, 100, 220] }
];
function createOrbEl(c) {
  const el = document.createElement("div");
  el.className = "orb";
  el.style.background = `radial-gradient(circle at 35% 35%, rgba(${c[0]},${c[1]},${c[2]},0.35), rgba(${c[0]},${c[1]},${c[2]},0.12) 55%, transparent 72%)`;
  el.style.boxShadow = `0 0 60px 15px rgba(${c[0]},${c[1]},${c[2]},0.18), 0 0 120px 40px rgba(${c[0]},${c[1]},${c[2]},0.07)`;
  stage.appendChild(el);
  return el;
}
var W0 = window.innerWidth;
var H0 = window.innerHeight;
var orbs = orbDefs.map((d) => ({
  x: d.fx * W0,
  y: d.fy * H0,
  r: d.r,
  vx: d.vx,
  vy: d.vy,
  color: d.color,
  paused: false,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartOrbX: 0,
  dragStartOrbY: 0,
  el: createOrbEl(d.color)
}));
await document.fonts.ready;
var preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT);
var PQ_FONT = `italic 19px ${HEADLINE_FONT_FAMILY}`;
var PQ_LINE_HEIGHT = 27;
var preparedPQ = PULLQUOTE_TEXTS.map((t) => prepareWithSegments(t, PQ_FONT));
var DROP_CAP_SIZE = BODY_LINE_HEIGHT * DROP_CAP_LINES - 4;
var DROP_CAP_FONT = `700 ${DROP_CAP_SIZE}px ${HEADLINE_FONT_FAMILY}`;
var preparedDropCap = prepareWithSegments(BODY_TEXT[0], DROP_CAP_FONT);
var dropCapWidth = 0;
walkLineRanges(preparedDropCap, 9999, (line) => {
  dropCapWidth = line.width;
});
var DROP_CAP_TOTAL_W = Math.ceil(dropCapWidth) + 10;
var dropCapEl = document.createElement("div");
dropCapEl.className = "drop-cap";
dropCapEl.textContent = BODY_TEXT[0];
dropCapEl.style.font = DROP_CAP_FONT;
dropCapEl.style.lineHeight = DROP_CAP_SIZE + "px";
stage.appendChild(dropCapEl);
var linePool = [];
var headlinePool = [];
var pqLinePool = [];
var pqBoxPool = [];
function syncPool(pool, count, className) {
  while (pool.length < count) {
    const el = document.createElement("div");
    el.className = className;
    stage.appendChild(el);
    pool.push(el);
  }
  for (let i = 0;i < pool.length; i++) {
    pool[i].style.display = i < count ? "" : "none";
  }
}
var cachedHeadlineKey = "";
var cachedHeadlineFontSize = 24;
var cachedHeadlineLines = [];
function fitHeadline(maxWidth, maxHeight) {
  const key = `${maxWidth}:${maxHeight}`;
  if (key === cachedHeadlineKey)
    return { fontSize: cachedHeadlineFontSize, lines: cachedHeadlineLines };
  cachedHeadlineKey = key;
  let lo = 24, hi = 120, best = lo;
  let bestLines = [];
  while (lo <= hi) {
    const size = Math.floor((lo + hi) / 2);
    const font = `700 ${size}px ${HEADLINE_FONT_FAMILY}`;
    const lh = Math.round(size * 0.93);
    const prepared = prepareWithSegments(HEADLINE_TEXT, font);
    let breaksWord = false;
    let lineCount = 0;
    walkLineRanges(prepared, maxWidth, (line) => {
      lineCount++;
      if (line.end.graphemeIndex !== 0)
        breaksWord = true;
    });
    const totalH = lineCount * lh;
    if (!breaksWord && totalH <= maxHeight) {
      best = size;
      const result = layoutWithLines(prepared, maxWidth, lh);
      bestLines = result.lines.map((l, i) => ({ x: 0, y: i * lh, text: l.text, width: l.width }));
      lo = size + 1;
    } else {
      hi = size - 1;
    }
  }
  cachedHeadlineFontSize = best;
  cachedHeadlineLines = bestLines;
  return { fontSize: best, lines: bestLines };
}
function layoutColumn(prepared, startCursor, regionX, regionY, regionW, regionH, lineHeight, circleObs, rectObstacles) {
  let cursor = startCursor;
  let lineTop = regionY;
  const lines = [];
  let textExhausted = false;
  while (lineTop + lineHeight <= regionY + regionH && !textExhausted) {
    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;
    const blocked = [];
    for (let oi = 0;oi < circleObs.length; oi++) {
      const c = circleObs[oi];
      const iv = circleIntervalForBand(c.cx, c.cy, c.r, bandTop, bandBottom, c.hPad, c.vPad);
      if (iv !== null)
        blocked.push(iv);
    }
    for (let ri = 0;ri < rectObstacles.length; ri++) {
      const r = rectObstacles[ri];
      if (bandBottom <= r.y || bandTop >= r.y + r.h)
        continue;
      blocked.push({ left: r.x, right: r.x + r.w });
    }
    const slots = carveTextLineSlots({ left: regionX, right: regionX + regionW }, blocked);
    if (slots.length === 0) {
      lineTop += lineHeight;
      continue;
    }
    slots.sort((a, b) => a.left - b.left);
    for (let si = 0;si < slots.length; si++) {
      const slot = slots[si];
      const slotWidth = slot.right - slot.left;
      const line = layoutNextLine(prepared, cursor, slotWidth);
      if (line === null) {
        textExhausted = true;
        break;
      }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text, width: line.width });
      cursor = line.end;
    }
    lineTop += lineHeight;
  }
  return { lines, cursor };
}
var activeOrb = null;
var pointerX = -9999;
var pointerY = -9999;
function hitTestOrbs(px, py) {
  for (let i = orbs.length - 1;i >= 0; i--) {
    const o = orbs[i];
    const dx = px - o.x, dy = py - o.y;
    if (dx * dx + dy * dy <= o.r * o.r)
      return o;
  }
  return null;
}
stage.addEventListener("pointerdown", (e) => {
  const orb = hitTestOrbs(e.clientX, e.clientY);
  if (orb) {
    activeOrb = orb;
    orb.dragging = true;
    orb.dragStartX = e.clientX;
    orb.dragStartY = e.clientY;
    orb.dragStartOrbX = orb.x;
    orb.dragStartOrbY = orb.y;
    e.preventDefault();
  }
});
window.addEventListener("pointermove", (e) => {
  pointerX = e.clientX;
  pointerY = e.clientY;
  if (activeOrb) {
    activeOrb.x = activeOrb.dragStartOrbX + (e.clientX - activeOrb.dragStartX);
    activeOrb.y = activeOrb.dragStartOrbY + (e.clientY - activeOrb.dragStartY);
  }
});
window.addEventListener("pointerup", (e) => {
  if (activeOrb) {
    const dx = e.clientX - activeOrb.dragStartX;
    const dy = e.clientY - activeOrb.dragStartY;
    if (dx * dx + dy * dy < 16) {
      activeOrb.paused = !activeOrb.paused;
      activeOrb.el.classList.toggle("paused", activeOrb.paused);
    }
    activeOrb.dragging = false;
    activeOrb = null;
  }
});
var fpsTimestamps = [];
var fpsDisplay = 60;
function updateFPS(now) {
  fpsTimestamps.push(now);
  while (fpsTimestamps.length > 0 && fpsTimestamps[0] < now - 1000)
    fpsTimestamps.shift();
  fpsDisplay = fpsTimestamps.length;
}
var elSLines = document.getElementById("sLines");
var elSReflow = document.getElementById("sReflow");
var elSDom = document.getElementById("sDom");
var elSFps = document.getElementById("sFps");
var elSCols = document.getElementById("sCols");
var lastTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const pw = document.documentElement.clientWidth;
  const ph = document.documentElement.clientHeight;
  for (let i = 0;i < orbs.length; i++) {
    const o = orbs[i];
    if (o.paused || o.dragging)
      continue;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (o.x - o.r < 0) {
      o.x = o.r;
      o.vx = Math.abs(o.vx);
    }
    if (o.x + o.r > pw) {
      o.x = pw - o.r;
      o.vx = -Math.abs(o.vx);
    }
    if (o.y - o.r < GUTTER * 0.5) {
      o.y = o.r + GUTTER * 0.5;
      o.vy = Math.abs(o.vy);
    }
    if (o.y + o.r > ph - STATS_BAR_HEIGHT) {
      o.y = ph - STATS_BAR_HEIGHT - o.r;
      o.vy = -Math.abs(o.vy);
    }
  }
  for (let i = 0;i < orbs.length; i++) {
    const a = orbs[i];
    for (let j = i + 1;j < orbs.length; j++) {
      const b = orbs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.r + b.r + 20;
      if (dist < minDist && dist > 0.1) {
        const force = (minDist - dist) * 0.8;
        const nx = dx / dist;
        const ny = dy / dist;
        if (!a.paused && !a.dragging) {
          a.vx -= nx * force * dt;
          a.vy -= ny * force * dt;
        }
        if (!b.paused && !b.dragging) {
          b.vx += nx * force * dt;
          b.vy += ny * force * dt;
        }
      }
    }
  }
  const circleObs = [];
  for (let i = 0;i < orbs.length; i++) {
    const o = orbs[i];
    circleObs.push({ cx: o.x, cy: o.y, r: o.r, hPad: 14, vPad: 4 });
  }
  const t0 = performance.now();
  const headlineWidth = Math.min(pw - GUTTER * 2, 1000);
  const maxHeadlineH = Math.floor(ph * 0.35);
  const { fontSize: hlSize, lines: hlLines } = fitHeadline(headlineWidth, maxHeadlineH);
  const hlLineHeight = Math.round(hlSize * 0.93);
  const hlFont = `700 ${hlSize}px ${HEADLINE_FONT_FAMILY}`;
  const hlHeight = hlLines.length * hlLineHeight;
  syncPool(headlinePool, hlLines.length, "headline-line");
  for (let i = 0;i < hlLines.length; i++) {
    const el = headlinePool[i];
    const line = hlLines[i];
    el.textContent = line.text;
    el.style.left = GUTTER + "px";
    el.style.top = GUTTER + line.y + "px";
    el.style.font = hlFont;
    el.style.lineHeight = hlLineHeight + "px";
  }
  const bodyTop = GUTTER + hlHeight + 20;
  const bodyHeight = ph - bodyTop - STATS_BAR_HEIGHT - 8;
  const colCount = pw > 1000 ? 3 : pw > 640 ? 2 : 1;
  const totalGutter = GUTTER * 2 + COL_GAP * (colCount - 1);
  const maxContentW = Math.min(pw, 1500);
  const colWidth = Math.floor((maxContentW - totalGutter) / colCount);
  const contentLeft = Math.round((pw - (colCount * colWidth + (colCount - 1) * COL_GAP)) / 2);
  const col0X = contentLeft;
  const dropCapRect = { x: col0X - 2, y: bodyTop - 2, w: DROP_CAP_TOTAL_W, h: DROP_CAP_LINES * BODY_LINE_HEIGHT + 2 };
  dropCapEl.style.left = col0X + "px";
  dropCapEl.style.top = bodyTop + "px";
  const pqPlacements = [
    { colIdx: 0, yFrac: 0.48, wFrac: 0.52, side: "right" },
    { colIdx: Math.min(1, colCount - 1), yFrac: 0.32, wFrac: 0.5, side: "left" }
  ];
  const pqRects = [];
  for (let pi = 0;pi < pqPlacements.length; pi++) {
    const p = pqPlacements[pi];
    if (p.colIdx >= colCount)
      continue;
    const pqW = Math.round(colWidth * p.wFrac);
    const prepared = preparedPQ[pi];
    const result = layout(prepared, pqW - 20, PQ_LINE_HEIGHT);
    const pqH = result.height + 16;
    const colX = contentLeft + p.colIdx * (colWidth + COL_GAP);
    const pqX = p.side === "right" ? colX + colWidth - pqW : colX;
    const pqY = Math.round(bodyTop + bodyHeight * p.yFrac);
    const pqLayoutLines = layoutWithLines(prepared, pqW - 20, PQ_LINE_HEIGHT);
    const pqPosLines = pqLayoutLines.lines.map((l, i) => ({
      x: pqX + 20,
      y: pqY + 8 + i * PQ_LINE_HEIGHT,
      text: l.text,
      width: l.width
    }));
    pqRects.push({ x: pqX, y: pqY, w: pqW, h: pqH, lines: pqPosLines, colIdx: p.colIdx });
  }
  const allBodyLines = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 1 };
  for (let col = 0;col < colCount; col++) {
    const colX = contentLeft + col * (colWidth + COL_GAP);
    const rects = [];
    if (col === 0)
      rects.push(dropCapRect);
    for (let pi = 0;pi < pqRects.length; pi++) {
      if (pqRects[pi].colIdx === col) {
        const pq = pqRects[pi];
        rects.push({ x: pq.x, y: pq.y, w: pq.w, h: pq.h });
      }
    }
    const result = layoutColumn(preparedBody, cursor, colX, bodyTop, colWidth, bodyHeight, BODY_LINE_HEIGHT, circleObs, rects);
    allBodyLines.push(...result.lines);
    cursor = result.cursor;
  }
  const reflowTime = performance.now() - t0;
  syncPool(linePool, allBodyLines.length, "line");
  for (let i = 0;i < allBodyLines.length; i++) {
    const el = linePool[i];
    const line = allBodyLines[i];
    el.textContent = line.text;
    el.style.left = line.x + "px";
    el.style.top = line.y + "px";
    el.style.font = BODY_FONT;
    el.style.lineHeight = BODY_LINE_HEIGHT + "px";
  }
  let totalPQLines = 0;
  for (let pi = 0;pi < pqRects.length; pi++)
    totalPQLines += pqRects[pi].lines.length;
  syncPool(pqBoxPool, pqRects.length, "pullquote-box");
  syncPool(pqLinePool, totalPQLines, "pullquote-line");
  let pqLineIdx = 0;
  for (let pi = 0;pi < pqRects.length; pi++) {
    const pq = pqRects[pi];
    const boxEl = pqBoxPool[pi];
    boxEl.style.left = pq.x + "px";
    boxEl.style.top = pq.y + "px";
    boxEl.style.width = pq.w + "px";
    boxEl.style.height = pq.h + "px";
    for (let li = 0;li < pq.lines.length; li++) {
      const el = pqLinePool[pqLineIdx];
      const line = pq.lines[li];
      el.textContent = line.text;
      el.style.left = line.x + "px";
      el.style.top = line.y + "px";
      el.style.font = PQ_FONT;
      el.style.lineHeight = PQ_LINE_HEIGHT + "px";
      pqLineIdx++;
    }
  }
  for (let i = 0;i < orbs.length; i++) {
    const o = orbs[i];
    o.el.style.left = o.x - o.r + "px";
    o.el.style.top = o.y - o.r + "px";
    o.el.style.width = o.r * 2 + "px";
    o.el.style.height = o.r * 2 + "px";
  }
  const hovered = hitTestOrbs(pointerX, pointerY);
  document.body.style.cursor = activeOrb ? "grabbing" : hovered ? "grab" : "";
  updateFPS(now);
  elSLines.textContent = String(allBodyLines.length);
  elSReflow.textContent = reflowTime.toFixed(1) + "ms";
  elSDom.textContent = "0";
  elSFps.textContent = String(fpsDisplay);
  elSCols.textContent = String(colCount);
}
lastTime = performance.now();
requestAnimationFrame(animate);
