// wireframe-torus — SDF raymarched torus with heatmap depth coloring
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
  bCtx.clearRect(0, 0, 28, 28); bCtx.font = font; bCtx.fillStyle = "#fff"; bCtx.textBaseline = "middle";
  bCtx.fillText(ch, 1, 14);
  var d = bCtx.getImageData(0, 0, 28, 28).data;
  var sum = 0; for (var i = 3; i < d.length; i += 4) sum += d[i];
  return sum / (255 * 784);
}

var palette = [];
for (var style of FONT_STYLES) {
  for (var weight of WEIGHTS) {
    var font = `${style === "italic" ? "italic " : ""}${weight} ${FONT_SIZE}px ${PROP_FAMILY}`;
    for (var ch of CHARSET) {
      if (ch === " ") continue;
      var p = prepareWithSegments(ch, font);
      var width = p.widths.length > 0 ? p.widths[0] : 0;
      if (width <= 0) continue;
      palette.push({ char: ch, weight, style, font, width, brightness: estimateBrightness(ch, font) });
    }
  }
}
var maxB = Math.max(...palette.map(function(p) { return p.brightness; }));
if (maxB > 0) for (var p of palette) p.brightness /= maxB;
palette.sort(function(a, b) { return a.brightness - b.brightness; });
var avgCharW = palette.reduce(function(s, p) { return s + p.width; }, 0) / palette.length;
var spaceW = FONT_SIZE * 0.27;

function findBest(targetB, targetW) {
  var lo = 0, hi = palette.length - 1;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (palette[mid].brightness < targetB) lo = mid + 1; else hi = mid; }
  var bestScore = Infinity, best = palette[lo];
  for (var i = Math.max(0, lo - 40); i < Math.min(palette.length, lo + 40); i++) {
    var p = palette[i]; var score = Math.abs(p.brightness - targetB) * 0.5 + Math.abs(p.width - targetW) / targetW * 4;
    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best;
}
function esc(c) { if (c === "&") return "&amp;"; if (c === "<") return "&lt;"; if (c === ">") return "&gt;"; return c; }
function wCls(w, s) { var wc = w === 300 ? "w3" : w === 500 ? "w5" : "w8"; return s === "italic" ? wc + " it" : wc; }

// === Grid ===
var MAX_COLS = 200, MAX_ROWS = 80;
var artEl = document.getElementById("art");
var statsEl = document.getElementById("stats");
var COLS = 0, ROWS = 0;
var rowEls = [];

// === Raymarched SDF Torus ===
var SCALE = 4;
var cvs, ctx, imgBuf;

var MAJOR_R = 0.42, MINOR_R = 0.14;
var CAM_DIST = 1.2;
var MAX_STEPS = 48, MAX_DIST = 5.0, SURF_DIST = 0.002;

// Light direction (normalized)
var lx = 0.3, ly = 0.5, lz = 0.8;
var ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
var LX = lx / ll, LY = ly / ll, LZ = lz / ll;

function sdTorus(px, py, pz) {
  var qx = Math.sqrt(px * px + pz * pz) - MAJOR_R;
  return Math.sqrt(qx * qx + py * py) - MINOR_R;
}

function rotPoint(x, y, z, cay, say, cax, sax) {
  var x2 = x * cay + z * say, z2 = -x * say + z * cay;
  var y2 = y * cax - z2 * sax, z3 = y * sax + z2 * cax;
  return [x2, y2, z3];
}

function drawTorus(t) {
  var cw = COLS * SCALE, ch = ROWS * SCALE;
  var data = imgBuf.data;
  var ay = t * 0.5 + 0.8, ax = t * 0.3 + 0.6 + Math.sin(t * 0.1) * 0.4;
  var cay = Math.cos(ay), say = Math.sin(ay);
  var cax = Math.cos(ax), sax = Math.sin(ax);

  var screenAspect = (cw * avgCharW) / (ch * LINE_HEIGHT);
  var ox = 0, oy = 0, oz = CAM_DIST;

  for (var py = 0; py < ch; py++) {
    for (var px = 0; px < cw; px++) {
      var rdx = (px / cw - 0.5) * screenAspect;
      var rdy = -(py / ch - 0.5);
      var rdz = -0.7;
      var rl = Math.sqrt(rdx * rdx + rdy * rdy + rdz * rdz);
      rdx /= rl; rdy /= rl; rdz /= rl;

      var dist = 0.0, hit = false;
      for (var s = 0; s < MAX_STEPS; s++) {
        var wx = ox + rdx * dist, wy = oy + rdy * dist, wz = oz + rdz * dist;
        var lp = rotPoint(wx, wy, wz, cay, -say, cax, -sax);
        var d = sdTorus(lp[0], lp[1], lp[2]);
        if (d < SURF_DIST) { hit = true; break; }
        dist += d;
        if (dist > MAX_DIST) break;
      }

      var idx = (py * cw + px) * 4;
      if (hit) {
        var hx = ox + rdx * dist, hy = oy + rdy * dist, hz = oz + rdz * dist;
        var lp0 = rotPoint(hx, hy, hz, cay, -say, cax, -sax);
        var e = 0.001;
        var nx = sdTorus(lp0[0] + e, lp0[1], lp0[2]) - sdTorus(lp0[0] - e, lp0[1], lp0[2]);
        var ny = sdTorus(lp0[0], lp0[1] + e, lp0[2]) - sdTorus(lp0[0], lp0[1] - e, lp0[2]);
        var nz = sdTorus(lp0[0], lp0[1], lp0[2] + e) - sdTorus(lp0[0], lp0[1], lp0[2] - e);
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        var wn = rotPoint(nx / nl, ny / nl, nz / nl, cay, say, cax, sax);
        var facing = Math.abs(wn[2]);
        var nearDist = CAM_DIST - (MAJOR_R + MINOR_R) - 0.1;
        var farDist = CAM_DIST + (MAJOR_R + MINOR_R) + 0.1;
        var depthT = Math.max(0, Math.min(1, (dist - nearDist) / (farDist - nearDist)));
        var t0 = Math.pow(depthT * 0.5 + (1 - facing) * 0.5, 0.7);
        var r2, g2, b2;
        if (t0 < 0.2) {
          var ss = t0 / 0.2;
          r2 = 255; g2 = 255 - ss * 40; b2 = 255 - ss * 220;
        } else if (t0 < 0.45) {
          var ss = (t0 - 0.2) / 0.25;
          r2 = 255; g2 = 215 - ss * 115; b2 = 35 - ss * 35;
        } else if (t0 < 0.7) {
          var ss = (t0 - 0.45) / 0.25;
          r2 = 255 - ss * 40; g2 = 100 - ss * 70; b2 = 0;
        } else {
          var ss = (t0 - 0.7) / 0.3;
          r2 = 215 - ss * 165; g2 = 30 - ss * 30; b2 = 0;
        }
        data[idx] = Math.round(r2); data[idx + 1] = Math.round(g2); data[idx + 2] = Math.round(b2); data[idx + 3] = 255;
      } else {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgBuf, 0, 0);
}

function initGrid() {
  COLS = Math.min(MAX_COLS, Math.floor(window.innerWidth / avgCharW));
  ROWS = Math.min(MAX_ROWS, Math.floor(window.innerHeight / LINE_HEIGHT));
  cvs = document.createElement("canvas");
  cvs.width = COLS * SCALE; cvs.height = ROWS * SCALE;
  ctx = cvs.getContext("2d", { willReadFrequently: true });
  imgBuf = ctx.createImageData(COLS * SCALE, ROWS * SCALE);
  artEl.innerHTML = ""; rowEls.length = 0;
  for (var r = 0; r < ROWS; r++) {
    var div = document.createElement("div"); div.className = "r";
    div.style.height = div.style.lineHeight = LINE_HEIGHT + "px";
    artEl.appendChild(div); rowEls.push(div);
  }
}

var resizeTimer = 0;
window.addEventListener("resize", function() { clearTimeout(resizeTimer); resizeTimer = setTimeout(initGrid, 150); });
initGrid();

function sampleCell(imgData, c, r, cw) {
  var sr = 0, sg = 0, sb = 0;
  var x0 = c * SCALE, y0 = r * SCALE;
  var n = SCALE * SCALE;
  for (var dy = 0; dy < SCALE; dy++) {
    for (var dx = 0; dx < SCALE; dx++) {
      var i = ((y0 + dy) * cw + (x0 + dx)) * 4;
      sr += imgData[i]; sg += imgData[i + 1]; sb += imgData[i + 2];
    }
  }
  sr /= n; sg /= n; sb /= n;
  var brightness = (sr * 0.299 + sg * 0.587 + sb * 0.114) / 255;
  return [Math.round(sr), Math.round(sg), Math.round(sb), brightness];
}

var fc = 0, lastFps = 0, dispFps = 0;

function render(now) {
  var t = now / 1000;
  var cw = COLS * SCALE;
  drawTorus(t);
  var imgData = ctx.getImageData(0, 0, cw, ROWS * SCALE).data;

  var tcw = window.innerWidth / COLS;
  for (var r = 0; r < ROWS; r++) {
    var html = "";
    for (var c = 0; c < COLS; c++) {
      var cell = sampleCell(imgData, c, r, cw);
      var cr = cell[0], cg = cell[1], cb = cell[2], b = cell[3];
      if (b < 0.01) {
        html += '<span style="display:inline-block;width:' + tcw.toFixed(2) + 'px"> </span>';
      } else {
        var m = findBest(b, tcw);
        html += '<span class="' + wCls(m.weight, m.style) + '" style="display:inline-block;width:' + tcw.toFixed(2) + 'px;text-align:center;color:rgb(' + cr + ',' + cg + ',' + cb + ')">' + esc(m.char) + '</span>';
      }
    }
    rowEls[r].innerHTML = html;
  }

  fc++;
  if (now - lastFps > 500) {
    dispFps = Math.round(fc / ((now - lastFps) / 1000)); fc = 0; lastFps = now;
    statsEl.textContent = COLS + "×" + ROWS + " | " + palette.length + " variants | SDF torus | " + dispFps + " fps";
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
