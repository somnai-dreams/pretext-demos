// shrinkwrap-showdown.ts
import { prepareWithSegments, walkLineRanges } from "./pretext.js";
var FONT = '15px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
var LINE_HEIGHT = 20;
var PADDING_H = 12;
var BUBBLE_MAX_RATIO = 0.8;
var messages = [
  { text: "Hey, did you see the new pretext library?", sent: false },
  { text: "Yeah! It measures text without the DOM. Pure JavaScript arithmetic.", sent: true },
  { text: "The shrinkwrap feature is wild — it finds the exact minimum width for multiline text. CSS can't do that.", sent: false },
  { text: "성능 최적화가 정말 많이 되었더라고요 \uD83C\uDF89", sent: true },
  { text: "Wait, so it handles CJK and emoji too?", sent: false },
  { text: "Everything. Mixed bidi, grapheme clusters, the works. Try resizing.", sent: true },
  { text: "ok this is genuinely impressive", sent: false },
  { text: "The best part: zero layout reflow. You could shrinkwrap 10,000 bubbles and the browser wouldn't even blink.", sent: true },
  { text: "Shut up and take my money \uD83D\uDCB8", sent: false }
];
var chatCss = document.getElementById("chat-css");
var chatPretext = document.getElementById("chat-pretext");
var wasteCssEl = document.getElementById("waste-css");
var wastePretextEl = document.getElementById("waste-pretext");
var slider = document.getElementById("slider");
var valLabel = document.getElementById("val");
var bubbles = [];
for (let i = 0;i < messages.length; i++) {
  const m = messages[i];
  const prepared = prepareWithSegments(m.text, FONT);
  const cssBubble = document.createElement("div");
  cssBubble.className = `msg ${m.sent ? "sent" : "recv"}`;
  cssBubble.style.font = FONT;
  cssBubble.style.lineHeight = `${LINE_HEIGHT}px`;
  cssBubble.style.position = "relative";
  cssBubble.textContent = m.text;
  const wasteStripe = document.createElement("div");
  wasteStripe.className = "waste";
  cssBubble.appendChild(wasteStripe);
  chatCss.appendChild(cssBubble);
  const pretextBubble = document.createElement("div");
  pretextBubble.className = `msg ${m.sent ? "sent" : "recv"}`;
  pretextBubble.style.font = FONT;
  pretextBubble.style.lineHeight = `${LINE_HEIGHT}px`;
  pretextBubble.textContent = m.text;
  chatPretext.appendChild(pretextBubble);
  bubbles.push({ prepared, cssBubble, pretextBubble, cssWasteEl: wasteStripe });
}
function shrinkwrap(prepared, maxWidth) {
  let targetLineCount = 0;
  let widestLine = 0;
  walkLineRanges(prepared, maxWidth, (line) => {
    targetLineCount++;
    if (line.width > widestLine)
      widestLine = line.width;
  });
  if (targetLineCount <= 1)
    return { width: Math.ceil(widestLine), lineCount: targetLineCount };
  let lo = 1;
  let hi = Math.ceil(widestLine);
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    let count = 0;
    walkLineRanges(prepared, mid, () => {
      count++;
    });
    if (count <= targetLineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return { width: lo, lineCount: targetLineCount };
}
function updateBubbles(chatWidth) {
  const maxBubbleWidth = Math.floor(chatWidth * BUBBLE_MAX_RATIO);
  const contentMaxWidth = maxBubbleWidth - PADDING_H * 2;
  let totalCssWaste = 0;
  let totalPretextWaste = 0;
  for (let i = 0;i < bubbles.length; i++) {
    const b = bubbles[i];
    b.cssBubble.style.maxWidth = maxBubbleWidth + "px";
    b.cssBubble.style.width = "fit-content";
    const cssActualWidth = b.cssBubble.offsetWidth;
    let cssWidest = 0;
    walkLineRanges(b.prepared, contentMaxWidth, (line) => {
      if (line.width > cssWidest)
        cssWidest = line.width;
    });
    const cssContentWidth = Math.min(contentMaxWidth, Math.ceil(cssWidest));
    const { width: shrinkWidth } = shrinkwrap(b.prepared, contentMaxWidth);
    const pretextBubbleWidth = Math.min(maxBubbleWidth, shrinkWidth + PADDING_H * 2);
    b.pretextBubble.style.maxWidth = maxBubbleWidth + "px";
    b.pretextBubble.style.width = pretextBubbleWidth + "px";
    const cssWaste = Math.max(0, cssContentWidth - shrinkWidth);
    totalCssWaste += cssWaste;
    const wastePixels = cssWaste;
    if (wastePixels > 2) {
      b.cssWasteEl.style.width = wastePixels + "px";
      b.cssWasteEl.style.display = "block";
    } else {
      b.cssWasteEl.style.display = "none";
    }
    totalPretextWaste += 0;
  }
  wasteCssEl.textContent = `${totalCssWaste}px wasted`;
  wastePretextEl.textContent = "0px wasted";
}
function setWidth(w) {
  const colsEl = document.getElementById("columns");
  slider.value = String(w);
  valLabel.textContent = w + "px";
  updateBubbles(w);
}
slider.addEventListener("input", () => {
  setWidth(parseInt(slider.value));
});
window.addEventListener("resize", () => {
  setWidth(parseInt(slider.value));
});
var autoAnimate = true;
var autoRaf = null;
function animateSlider(now) {
  if (!autoAnimate)
    return;
  const min = parseInt(slider.min);
  const max = parseInt(slider.max);
  const range = max - min;
  const w = Math.round(min + range * (0.5 + 0.5 * Math.sin(now / 2500)));
  setWidth(w);
  autoRaf = requestAnimationFrame(animateSlider);
}
autoRaf = requestAnimationFrame(animateSlider);
slider.addEventListener("pointerdown", () => {
  autoAnimate = false;
  if (autoRaf != null)
    cancelAnimationFrame(autoRaf);
});
setWidth(340);
