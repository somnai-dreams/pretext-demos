// demo-149.ts
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
var SCALE = 3;
var cvs;
var ctx;
var U_STEPS = 40;
var V_STEPS = 20;
var MAJOR_R = 0.38;
var MINOR_R = 0.16;
var TWO_PI = Math.PI * 2;
var baseVerts = [];
for (let i = 0;i < U_STEPS; i++) {
  const row = [];
  const u = i / U_STEPS * TWO_PI;
  const cu = Math.cos(u), su = Math.sin(u);
  for (let j = 0;j < V_STEPS; j++) {
    const v = j / V_STEPS * TWO_PI;
    const cv = Math.cos(v), sv = Math.sin(v);
    row.push({ x: (MAJOR_R + MINOR_R * cv) * cu, y: (MAJOR_R + MINOR_R * cv) * su, z: MINOR_R * sv });
  }
  baseVerts.push(row);
}
function rotY(p, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return { x: p.x * ca + p.z * sa, y: p.y, z: -p.x * sa + p.z * ca };
}
function rotX(p, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  return { x: p.x, y: p.y * ca - p.z * sa, z: p.y * sa + p.z * ca };
}
function drawTorus(t) {
  const cw = COLS * SCALE, ch = ROWS * SCALE;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  const ay = t * 0.5, ax = t * 0.3 + Math.sin(t * 0.1) * 0.4;
  const fov = Math.min(cw, ch) * 1.1;
  const camDist = 1.2;
  const proj = [];
  for (let i = 0;i < U_STEPS; i++) {
    const row = [];
    for (let j = 0;j < V_STEPS; j++) {
      let p = baseVerts[i][j];
      p = rotY(p, ay);
      p = rotX(p, ax);
      const d = p.z + camDist;
      row.push({ x: cw / 2 + p.x * fov / d, y: ch / 2 + p.y * fov / d * aspect, z: p.z });
    }
    proj.push(row);
  }
  const layers = [
    { width: 5, alpha: 0.06 },
    { width: 3, alpha: 0.12 },
    { width: 1.5, alpha: 0.5 }
  ];
  for (const layer of layers) {
    ctx.lineWidth = layer.width;
    for (let i = 0;i < U_STEPS; i++) {
      const ni = (i + 1) % U_STEPS;
      for (let j = 0;j < V_STEPS; j++) {
        const nj = (j + 1) % V_STEPS;
        const p = proj[i][j];
        const ph = proj[ni][j];
        const depthH = 1 - (p.z + ph.z) * 0.5 * 1.2;
        const bH = Math.max(0.05, Math.min(1, depthH * 0.7 + 0.3)) * layer.alpha;
        ctx.strokeStyle = `rgba(255,255,255,${bH.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(ph.x, ph.y);
        ctx.stroke();
        const pv = proj[i][nj];
        const depthV = 1 - (p.z + pv.z) * 0.5 * 1.2;
        const bV = Math.max(0.05, Math.min(1, depthV * 0.7 + 0.3)) * layer.alpha;
        ctx.strokeStyle = `rgba(255,255,255,${bV.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(pv.x, pv.y);
        ctx.stroke();
      }
    }
  }
}
function initGrid() {
  COLS = Math.min(MAX_COLS, Math.floor(window.innerWidth / avgCharW));
  ROWS = Math.min(MAX_ROWS, Math.floor(window.innerHeight / LINE_HEIGHT));
  cvs = document.createElement("canvas");
  cvs.width = COLS * SCALE;
  cvs.height = ROWS * SCALE;
  ctx = cvs.getContext("2d", { willReadFrequently: true });
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
function sampleCell(imgData, c, r, cw) {
  let sum = 0;
  const x0 = c * SCALE, y0 = r * SCALE;
  for (let dy = 0;dy < SCALE; dy++) {
    for (let dx = 0;dx < SCALE; dx++) {
      sum += imgData[((y0 + dy) * cw + (x0 + dx)) * 4];
    }
  }
  return sum / (SCALE * SCALE * 255);
}
var fc = 0;
var lastFps = 0;
var dispFps = 0;
function render(now) {
  const t = now / 1000;
  const cw = COLS * SCALE;
  drawTorus(t);
  const imgData = ctx.getImageData(0, 0, cw, ROWS * SCALE).data;
  const tcw = window.innerWidth / COLS;
  const rowWidths = [];
  for (let r = 0;r < ROWS; r++) {
    let html = "", tw = 0;
    for (let c = 0;c < COLS; c++) {
      const b = sampleCell(imgData, c, r, cw);
      if (b < 0.02) {
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
    statsEl.textContent = `${COLS}×${ROWS} | ${palette.length} variants | ${U_STEPS}×${V_STEPS} torus | ${dispFps} fps`;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
