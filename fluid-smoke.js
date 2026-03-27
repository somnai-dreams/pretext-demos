// fluid-smoke.ts
import { prepareWithSegments } from "./pretext.js";
var FONT_SIZE = 14;
var LINE_HEIGHT = 17;
var PROP_FAMILY = 'Georgia, Palatino, "Times New Roman", serif';
var CHARSET = " .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var WEIGHTS = [300, 500, 800];
var FONT_STYLES = ["normal", "italic"];
var bCvs = document.createElement("canvas");
bCvs.width = bCvs.height = 28;
var bCtx = bCvs.getContext("2d", { willReadFrequently: true });
function estimateBrightness(ch, font) {
  bCtx.clearRect(0, 0, 28, 28);
  bCtx.font = font;
  bCtx.fillStyle = "#fff";
  bCtx.textBaseline = "middle";
  bCtx.fillText(ch, 1, 14);
  const d = bCtx.getImageData(0, 0, 28, 28).data;
  let sum = 0;
  for (let i = 3;i < d.length; i += 4)
    sum += d[i];
  return sum / (255 * 784);
}
var palette = [];
for (const style of FONT_STYLES) {
  for (const weight of WEIGHTS) {
    const font = `${style === "italic" ? "italic " : ""}${weight} ${FONT_SIZE}px ${PROP_FAMILY}`;
    for (const ch of CHARSET) {
      if (ch === " ")
        continue;
      const p = prepareWithSegments(ch, font);
      const width = p.widths.length > 0 ? p.widths[0] : 0;
      if (width <= 0)
        continue;
      palette.push({ char: ch, weight, style, font, width, brightness: estimateBrightness(ch, font) });
    }
  }
}
var maxB = Math.max(...palette.map((p) => p.brightness));
if (maxB > 0)
  for (const p of palette)
    p.brightness /= maxB;
palette.sort((a, b) => a.brightness - b.brightness);
var avgCharW = palette.reduce((s, p) => s + p.width, 0) / palette.length;
var aspect = avgCharW / LINE_HEIGHT;
var aspect2 = aspect * aspect;
var spaceW = FONT_SIZE * 0.27;
function findBest(targetB, targetW) {
  let lo = 0, hi = palette.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (palette[mid].brightness < targetB)
      lo = mid + 1;
    else
      hi = mid;
  }
  let bestScore = Infinity, best = palette[lo];
  for (let i = Math.max(0, lo - 15);i < Math.min(palette.length, lo + 15); i++) {
    const p = palette[i];
    const score = Math.abs(p.brightness - targetB) * 2.5 + Math.abs(p.width - targetW) / targetW;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
function esc(c) {
  if (c === "&")
    return "&amp;";
  if (c === "<")
    return "&lt;";
  if (c === ">")
    return "&gt;";
  return c;
}
function wCls(w, s) {
  const wc = w === 300 ? "w3" : w === 500 ? "w5" : "w8";
  return s === "italic" ? wc + " it" : wc;
}
var MAX_COLS = 200;
var MAX_ROWS = 80;
var artEl = document.getElementById("art");
var statsEl = document.getElementById("stats");
var COLS = 0;
var ROWS = 0;
var rowEls = [];
var density;
var tempDen;
var emitters = [
  { cx: 0.25, cy: 0.4, orbitR: 0.14, freq: 0.3, phase: 0, strength: 0.18 },
  { cx: 0.7, cy: 0.35, orbitR: 0.1, freq: 0.25, phase: 2.1, strength: 0.15 },
  { cx: 0.45, cy: 0.65, orbitR: 0.16, freq: 0.35, phase: 4.2, strength: 0.2 },
  { cx: 0.8, cy: 0.6, orbitR: 0.08, freq: 0.4, phase: 1, strength: 0.14 }
];
function getVel(c, r, t) {
  const nx = c / COLS, ny = r / ROWS;
  let vx = Math.sin(ny * 6.28 + t * 0.3) * 2 + Math.cos((nx + ny) * 12.5 + t * 0.55) * 0.7 + Math.sin(nx * 25 + ny * 18 + t * 0.8) * 0.25;
  let vy = Math.cos(nx * 5 + t * 0.4) * 1.5 + Math.sin((nx - ny) * 10 + t * 0.4) * 0.8 + Math.cos(nx * 18 - ny * 25 + t * 0.7) * 0.25;
  vy *= aspect;
  return [vx, vy];
}
function updateSim(t) {
  for (let r = 0;r < ROWS; r++) {
    for (let c = 0;c < COLS; c++) {
      const [vx, vy] = getVel(c, r, t);
      let sx = Math.max(0, Math.min(COLS - 1.001, c - vx));
      let sy = Math.max(0, Math.min(ROWS - 1.001, r - vy));
      const x0 = sx | 0, y0 = sy | 0;
      const x1 = Math.min(x0 + 1, COLS - 1), y1 = Math.min(y0 + 1, ROWS - 1);
      const fx = sx - x0, fy = sy - y0;
      tempDen[r * COLS + c] = density[y0 * COLS + x0] * (1 - fx) * (1 - fy) + density[y0 * COLS + x1] * fx * (1 - fy) + density[y1 * COLS + x0] * (1 - fx) * fy + density[y1 * COLS + x1] * fx * fy;
    }
  }
  [density, tempDen] = [tempDen, density];
  for (let r = 1;r < ROWS - 1; r++) {
    for (let c = 1;c < COLS - 1; c++) {
      const i = r * COLS + c;
      const avg = (density[i - 1] + density[i + 1] + (density[i - COLS] + density[i + COLS]) * aspect2) / (2 + 2 * aspect2);
      tempDen[i] = density[i] * 0.92 + avg * 0.08;
    }
  }
  [density, tempDen] = [tempDen, density];
  const spread = 4;
  for (const e of emitters) {
    const ex = (e.cx + Math.cos(t * e.freq + e.phase) * e.orbitR) * COLS;
    const ey = (e.cy + Math.sin(t * e.freq * 0.7 + e.phase) * e.orbitR * 0.8) * ROWS;
    const ec = ex | 0, er = ey | 0;
    for (let dr = -spread;dr <= spread; dr++) {
      for (let dc = -spread;dc <= spread; dc++) {
        const rr = er + dr, cc = ec + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
          const drScaled = dr / aspect;
          const dist = Math.sqrt(drScaled * drScaled + dc * dc);
          const s = Math.max(0, 1 - dist / (spread + 1));
          density[rr * COLS + cc] = Math.min(1, density[rr * COLS + cc] + s * e.strength);
        }
      }
    }
  }
  for (let i = 0;i < COLS * ROWS; i++)
    density[i] *= 0.984;
}
function initGrid() {
  COLS = Math.min(MAX_COLS, Math.floor(window.innerWidth / avgCharW));
  ROWS = Math.min(MAX_ROWS, Math.floor(window.innerHeight / LINE_HEIGHT));
  density = new Float32Array(COLS * ROWS);
  tempDen = new Float32Array(COLS * ROWS);
  artEl.innerHTML = "";
  rowEls.length = 0;
  for (let r = 0;r < ROWS; r++) {
    const div = document.createElement("div");
    div.className = "r";
    div.style.height = div.style.lineHeight = LINE_HEIGHT + "px";
    artEl.appendChild(div);
    rowEls.push(div);
  }
}
var resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(initGrid, 150);
});
initGrid();
var fc = 0;
var lastFps = 0;
var dispFps = 0;
var targetCellW = () => window.innerWidth / COLS;
function render(now) {
  const t = now / 1000;
  updateSim(t);
  const tcw = targetCellW();
  const rowWidths = [];
  for (let r = 0;r < ROWS; r++) {
    let html = "", tw = 0;
    for (let c = 0;c < COLS; c++) {
      const b = density[r * COLS + c];
      if (b < 0.025) {
        html += " ";
        tw += spaceW;
      } else {
        const m = findBest(b, tcw);
        const ai = Math.max(1, Math.min(10, Math.round(b * 10)));
        html += `<span class="${wCls(m.weight, m.style)} a${ai}">${esc(m.char)}</span>`;
        tw += m.width;
      }
    }
    rowEls[r].innerHTML = html;
    rowWidths.push(tw);
  }
  const maxW = Math.max(...rowWidths);
  const blockOffset = Math.max(0, (window.innerWidth - maxW) / 2);
  for (let r = 0;r < ROWS; r++)
    rowEls[r].style.paddingLeft = blockOffset + (maxW - rowWidths[r]) / 2 + "px";
  fc++;
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000));
    fc = 0;
    lastFps = now;
    statsEl.textContent = `${COLS}×${ROWS} | ${palette.length} variants | ${dispFps} fps`;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
