// variable-typographic-ascii.ts
import { prepareWithSegments } from "./pretext.js";
var COLS = 50;
var ROWS = 28;
var FONT_SIZE = 13;
var LINE_HEIGHT = 15;
var TARGET_ROW_W = 400;
var PROP_FAMILY = 'Georgia, Palatino, "Times New Roman", serif';
var CANVAS_W = 200;
var CANVAS_H = 120;
var PARTICLE_N = 100;
var SPRITE_R = 14;
var CHARSET = " .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var WEIGHTS = [300, 500, 800];
var STYLES = ["normal", "italic"];
var bCvs = document.createElement("canvas");
bCvs.width = bCvs.height = 28;
var bCtx = bCvs.getContext("2d", { willReadFrequently: true });
function estimateBrightness(ch, font) {
  const s = 28;
  bCtx.clearRect(0, 0, s, s);
  bCtx.font = font;
  bCtx.fillStyle = "#fff";
  bCtx.textBaseline = "middle";
  bCtx.fillText(ch, 1, s / 2);
  const d = bCtx.getImageData(0, 0, s, s).data;
  let sum = 0;
  for (let i = 3;i < d.length; i += 4)
    sum += d[i];
  return sum / (255 * s * s);
}
function measureWidth(ch, font) {
  const p = prepareWithSegments(ch, font);
  return p.widths.length > 0 ? p.widths[0] : 0;
}
var t0build = performance.now();
var palette = [];
for (const style of STYLES) {
  for (const weight of WEIGHTS) {
    const font = `${style === "italic" ? "italic " : ""}${weight} ${FONT_SIZE}px ${PROP_FAMILY}`;
    for (const ch of CHARSET) {
      if (ch === " ")
        continue;
      const width = measureWidth(ch, font);
      if (width <= 0)
        continue;
      const brightness = estimateBrightness(ch, font);
      palette.push({ char: ch, weight, style, font, width, brightness });
    }
  }
}
var maxB = Math.max(...palette.map((p) => p.brightness));
if (maxB > 0)
  for (const p of palette)
    p.brightness /= maxB;
palette.sort((a, b) => a.brightness - b.brightness);
var buildMs = (performance.now() - t0build).toFixed(0);
var targetCellW = TARGET_ROW_W / COLS;
var spaceW = FONT_SIZE * 0.27;
function findBest(targetB) {
  let lo = 0, hi = palette.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (palette[mid].brightness < targetB)
      lo = mid + 1;
    else
      hi = mid;
  }
  let bestScore = Infinity, best = palette[lo];
  const s = Math.max(0, lo - 15), e = Math.min(palette.length, lo + 15);
  for (let i = s;i < e; i++) {
    const p = palette[i];
    const bErr = Math.abs(p.brightness - targetB) * 2.5;
    const wErr = Math.abs(p.width - targetCellW) / targetCellW;
    const score = bErr + wErr;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
var MONO_RAMP = " .`-_:,;^=+/|)\\!?0oOQ#%@";
var particles = [];
for (let i = 0;i < PARTICLE_N; i++) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * 40 + 20;
  particles.push({
    x: CANVAS_W / 2 + Math.cos(angle) * r,
    y: CANVAS_H / 2 + Math.sin(angle) * r,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8
  });
}
var sCvs = document.createElement("canvas");
sCvs.width = CANVAS_W;
sCvs.height = CANVAS_H;
var sCtx = sCvs.getContext("2d", { willReadFrequently: true });
var spriteCvs = document.createElement("canvas");
var sr = SPRITE_R;
spriteCvs.width = spriteCvs.height = sr * 2;
var sprCtx = spriteCvs.getContext("2d");
var grad = sprCtx.createRadialGradient(sr, sr, 0, sr, sr, sr);
grad.addColorStop(0, "rgba(255,255,255,0.45)");
grad.addColorStop(0.35, "rgba(255,255,255,0.15)");
grad.addColorStop(1, "rgba(255,255,255,0)");
sprCtx.fillStyle = grad;
sprCtx.fillRect(0, 0, sr * 2, sr * 2);
var propBox = document.getElementById("prop-box");
var monoBox = document.getElementById("mono-box");
var statsEl = document.getElementById("stats");
var propRows = [];
var monoRows = [];
for (let r = 0;r < ROWS; r++) {
  const pd = document.createElement("div");
  pd.className = "art-row";
  pd.style.height = pd.style.lineHeight = LINE_HEIGHT + "px";
  propBox.appendChild(pd);
  propRows.push(pd);
  const md = document.createElement("div");
  md.className = "art-row";
  md.style.height = md.style.lineHeight = LINE_HEIGHT + "px";
  monoBox.appendChild(md);
  monoRows.push(md);
}
function esc(c) {
  if (c === "<")
    return "&lt;";
  if (c === ">")
    return "&gt;";
  if (c === "&")
    return "&amp;";
  if (c === '"')
    return "&quot;";
  return c;
}
function wCls(w, s) {
  const wc = w === 300 ? "w3" : w === 500 ? "w5" : "w8";
  return s === "italic" ? wc + " it" : wc;
}
var fc = 0;
var lastFps = 0;
var dispFps = 0;
function render(now) {
  const a1x = Math.cos(now * 0.0007) * CANVAS_W * 0.25 + CANVAS_W / 2;
  const a1y = Math.sin(now * 0.0011) * CANVAS_H * 0.3 + CANVAS_H / 2;
  const a2x = Math.cos(now * 0.0013 + Math.PI) * CANVAS_W * 0.2 + CANVAS_W / 2;
  const a2y = Math.sin(now * 0.0009 + Math.PI) * CANVAS_H * 0.25 + CANVAS_H / 2;
  for (const p of particles) {
    const d1x = a1x - p.x, d1y = a1y - p.y;
    const d2x = a2x - p.x, d2y = a2y - p.y;
    const dist1 = d1x * d1x + d1y * d1y;
    const dist2 = d2x * d2x + d2y * d2y;
    const ax = dist1 < dist2 ? d1x : d2x;
    const ay = dist1 < dist2 ? d1y : d2y;
    const dist = Math.sqrt(Math.min(dist1, dist2)) + 1;
    p.vx += ax / dist * 0.12;
    p.vy += ay / dist * 0.12;
    p.vx += (Math.random() - 0.5) * 0.25;
    p.vy += (Math.random() - 0.5) * 0.25;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -sr)
      p.x += CANVAS_W + sr * 2;
    if (p.x > CANVAS_W + sr)
      p.x -= CANVAS_W + sr * 2;
    if (p.y < -sr)
      p.y += CANVAS_H + sr * 2;
    if (p.y > CANVAS_H + sr)
      p.y -= CANVAS_H + sr * 2;
  }
  sCtx.fillStyle = "rgba(0,0,0,0.18)";
  sCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  sCtx.globalCompositeOperation = "lighter";
  for (const p of particles)
    sCtx.drawImage(spriteCvs, p.x - sr, p.y - sr);
  sCtx.globalCompositeOperation = "source-over";
  const imgData = sCtx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
  function sample(c, r) {
    const cx = Math.min(CANVAS_W - 1, c / COLS * CANVAS_W | 0);
    const cy = Math.min(CANVAS_H - 1, r / ROWS * CANVAS_H | 0);
    const i = (cy * CANVAS_W + cx) * 4;
    return Math.min(1, (imgData[i] + imgData[i + 1] + imgData[i + 2]) / (3 * 255));
  }
  const rowWidths = [];
  for (let r = 0;r < ROWS; r++) {
    let html = "", tw = 0;
    for (let c = 0;c < COLS; c++) {
      const b = sample(c, r);
      if (b < 0.03) {
        html += " ";
        tw += spaceW;
      } else {
        const m = findBest(b);
        const ai = Math.max(1, Math.min(10, Math.round(b * 10)));
        html += `<span class="${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`;
        tw += m.width;
      }
    }
    propRows[r].innerHTML = html;
    rowWidths.push(tw);
  }
  const maxW = Math.max(...rowWidths);
  for (let r = 0;r < ROWS; r++) {
    propRows[r].style.paddingLeft = (maxW - rowWidths[r]) / 2 + "px";
  }
  for (let r = 0;r < ROWS; r++) {
    let text = "";
    for (let c = 0;c < COLS; c++) {
      const b = sample(c, r);
      text += MONO_RAMP[Math.min(MONO_RAMP.length - 1, b * MONO_RAMP.length | 0)];
    }
    monoRows[r].textContent = text;
  }
  fc++;
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000));
    fc = 0;
    lastFps = now;
    statsEl.textContent = `${COLS}×${ROWS} grid | ${palette.length} character variants | ${dispFps} fps | palette built in ${buildMs}ms`;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
