// calligram-engine.ts
import { prepareWithSegments, layoutWithLines } from "./pretext.js";
var canvas = document.getElementById("calligramCanvas");
var ctx = canvas.getContext("2d");
var input = document.getElementById("wordInput");
var FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
var charWidthCache = new Map;
function measureChar(ch, fontSize) {
  const key = `${ch}:${fontSize}`;
  const cached = charWidthCache.get(key);
  if (cached !== undefined)
    return cached;
  const fontStr = `${fontSize}px ${FONT_FAMILY}`;
  const prepared = prepareWithSegments(ch, fontStr);
  const result = layoutWithLines(prepared, 1e4, fontSize * 1.2);
  const width = result.lines.length > 0 ? result.lines[0].width : fontSize * 0.5;
  charWidthCache.set(key, width);
  return width;
}
function heartSDF(nx, ny) {
  const x = nx * 1.2;
  const y = -ny * 1.1 + 0.3;
  const d = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);
  const heartR = 0.5 + 0.15 * Math.cos(angle * 2) + 0.1 * Math.cos(angle) + 0.02 * Math.sin(angle * 3);
  return d - heartR;
}
function circleSDF(nx, ny) {
  return Math.sqrt(nx * nx + ny * ny) - 0.75;
}
function starSDF(nx, ny) {
  const angle = Math.atan2(ny, nx);
  const d = Math.sqrt(nx * nx + ny * ny);
  const points = 5;
  const innerR = 0.35;
  const outerR = 0.8;
  const a = (angle / Math.PI + 1) / 2 * points % 1;
  const r = a < 0.5 ? innerR + (outerR - innerR) * (1 - Math.abs(a - 0.25) * 4) : innerR + (outerR - innerR) * (1 - Math.abs(a - 0.75) * 4);
  return d - r;
}
function waveSDF(nx, ny) {
  const waveY = Math.sin(nx * 4) * 0.25;
  const thickness = 0.2 + Math.cos(nx * 2) * 0.05;
  return Math.abs(ny - waveY) - thickness;
}
function spiralSDF(nx, ny) {
  const d = Math.sqrt(nx * nx + ny * ny);
  const angle = Math.atan2(ny, nx);
  const spiralR = (angle / Math.PI + 1) / 2 * 0.6 + d * 0.15;
  const armDist = Math.abs((d - spiralR * 0.5) % 0.25 - 0.125);
  return d > 0.85 ? d - 0.85 : armDist - 0.06;
}
var SHAPES = {
  heart: heartSDF,
  circle: circleSDF,
  star: starSDF,
  wave: waveSDF,
  spiral: spiralSDF
};
var currentShape = "heart";
var currentWord = "heart";
var canvasSize = 400;
var charSize = 14;
var animChars = [];
var animT = 0;
function wordColor(word, charIdx, total) {
  const hue = (word.charCodeAt(0) * 37 + word.length * 73) % 360;
  const tVal = charIdx / Math.max(1, total - 1);
  const h = (hue + tVal * 60) % 360;
  const s = 60 + Math.sin(tVal * Math.PI) * 20;
  const l = 55 + Math.sin(tVal * Math.PI * 2) * 15;
  return `hsl(${h}, ${s}%, ${l}%)`;
}
function generateCalligram() {
  const dpr = devicePixelRatio;
  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;
  canvas.style.width = canvasSize + "px";
  canvas.style.height = canvasSize + "px";
  charWidthCache.clear();
  const word = currentWord.toLowerCase().replace(/[^a-z0-9]/g, "") || "text";
  const sdf = SHAPES[currentShape] ?? heartSDF;
  const fontSize = charSize;
  const charWidths = word.split("").map((ch) => measureChar(ch, fontSize));
  const positions = [];
  const lineHeight = fontSize * 1.3;
  const padding = canvasSize * 0.08;
  const drawArea = canvasSize - padding * 2;
  let charCounter = 0;
  for (let pixelY = padding;pixelY < canvasSize - padding; pixelY += lineHeight) {
    let pixelX = padding;
    while (pixelX < canvasSize - padding) {
      const nx = (pixelX - canvasSize / 2) / (drawArea / 2);
      const ny = (pixelY - canvasSize / 2) / (drawArea / 2);
      const dist = sdf(nx, ny);
      if (dist < -0.02) {
        const charIdx = charCounter % word.length;
        const ch = word[charIdx];
        const w = charWidths[charIdx];
        positions.push({
          ch,
          x: pixelX,
          y: pixelY,
          width: w,
          charIdx,
          dist: Math.abs(dist),
          globalIdx: charCounter
        });
        pixelX += w + fontSize * 0.05;
        charCounter++;
      } else if (dist < 0.05) {
        pixelX += fontSize * 0.3;
      } else {
        pixelX += fontSize * 0.5;
      }
    }
  }
  animChars = positions.map((p) => ({
    ...p,
    targetX: p.x,
    targetY: p.y,
    currentX: canvasSize / 2 + (Math.random() - 0.5) * canvasSize * 0.3,
    currentY: canvasSize / 2 + (Math.random() - 0.5) * canvasSize * 0.3,
    velX: 0,
    velY: 0,
    targetAlpha: 1,
    currentAlpha: 0,
    delay: p.globalIdx * 0.015 + Math.random() * 0.1
  }));
  animT = 0;
}
function renderFrame() {
  const dpr = devicePixelRatio;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const fontSize = charSize * dpr;
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  animT += 0.016;
  let allArrived = true;
  for (const ch of animChars) {
    const tVal = Math.max(0, animT - ch.delay);
    if (tVal <= 0) {
      allArrived = false;
      continue;
    }
    const springK = 0.08;
    const damping = 0.75;
    const forceX = (ch.targetX - ch.currentX) * springK;
    const forceY = (ch.targetY - ch.currentY) * springK;
    ch.velX = (ch.velX + forceX) * damping;
    ch.velY = (ch.velY + forceY) * damping;
    ch.currentX += ch.velX;
    ch.currentY += ch.velY;
    ch.currentAlpha += (ch.targetAlpha - ch.currentAlpha) * 0.08;
    const distToTarget = Math.abs(ch.currentX - ch.targetX) + Math.abs(ch.currentY - ch.targetY);
    if (distToTarget > 0.5)
      allArrived = false;
    const color = wordColor(currentWord, ch.charIdx, currentWord.length);
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(1, ch.currentAlpha);
    ctx.fillText(ch.ch, ch.currentX * dpr, ch.currentY * dpr);
  }
  ctx.globalAlpha = 1;
  if (allArrived && animChars.length > 0) {
    const pulse = (Math.sin(animT * 2) + 1) / 2;
    const glowAlpha = 0.02 + pulse * 0.02;
    const sdf = SHAPES[currentShape];
    const padding = canvasSize * 0.08;
    const drawArea = canvasSize - padding * 2;
    ctx.fillStyle = `rgba(100, 180, 255, ${glowAlpha})`;
    for (let y = 0;y < h; y += 4 * dpr) {
      for (let x = 0;x < w; x += 4 * dpr) {
        const nx = (x / dpr - canvasSize / 2) / (drawArea / 2);
        const ny = (y / dpr - canvasSize / 2) / (drawArea / 2);
        const dist = sdf(nx, ny);
        if (dist > -0.05 && dist < 0.02) {
          ctx.fillRect(x, y, 3 * dpr, 3 * dpr);
        }
      }
    }
  }
  requestAnimationFrame(renderFrame);
}
input.addEventListener("input", () => {
  currentWord = input.value || "text";
  generateCalligram();
});
document.querySelectorAll(".shape-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".shape-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentShape = btn.dataset.shape;
    generateCalligram();
  });
});
document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const el = btn;
    input.value = el.dataset.word;
    currentWord = el.dataset.word;
    currentShape = el.dataset.shape;
    document.querySelectorAll(".shape-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.shape === currentShape);
    });
    generateCalligram();
  });
});
document.getElementById("sizeSlider").addEventListener("input", (e) => {
  canvasSize = parseInt(e.target.value);
  document.getElementById("sizeVal").textContent = String(canvasSize);
  generateCalligram();
});
document.getElementById("densitySlider").addEventListener("input", (e) => {
  charSize = parseInt(e.target.value);
  document.getElementById("densityVal").textContent = charSize + "px";
  generateCalligram();
});
generateCalligram();
requestAnimationFrame(renderFrame);
