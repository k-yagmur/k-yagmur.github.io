// ============================================================
//  GENERATIVE CARD ART — each project gets a seeded live-drawn
//  "figure" visualizing the model behind it. No image assets.
// ============================================================

const ACID = '#ccff2e', VIOLET = '#8a5cff', CYAN = '#4fe0c0', INK = '#eceef2';

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s + 0x6D2B79F5) | 0, ((Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5) | 0) >>> 0) / 4294967296;
}
// cheap value-noise-ish field
const field = (x, y) =>
  Math.sin(x * 2.1 + Math.sin(y * 1.7)) * 0.6 +
  Math.sin(y * 1.3 + Math.sin(x * 0.9) * 2.0) * 0.4 +
  Math.sin((x + y) * 0.7) * 0.5;

function flow(ctx, w, h, R) {
  ctx.fillStyle = '#0a0a11'; ctx.fillRect(0, 0, w, h);
  const cols = [ACID, VIOLET, CYAN];
  for (let i = 0; i < 900; i++) {
    let x = R() * w, y = R() * h;
    ctx.strokeStyle = cols[(R() * 3) | 0];
    ctx.globalAlpha = 0.05 + R() * 0.22;
    ctx.lineWidth = 0.6 + R() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 46; s++) {
      const a = field(x / w * 3.2, y / h * 3.2) * Math.PI * 2;
      x += Math.cos(a) * 2.6; y += Math.sin(a) * 2.6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function tokens(ctx, w, h, R) {
  ctx.fillStyle = '#0a0a11'; ctx.fillRect(0, 0, w, h);
  const n = 26, cw = w / n, ch = h / n;
  // attention matrix
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = Math.exp(-Math.abs(i - j) * 0.32) * (0.35 + R() * 0.65) * (R() < 0.06 ? 1.9 : 1);
    if (v < 0.09) continue;
    ctx.globalAlpha = Math.min(v, 1) * 0.85;
    ctx.fillStyle = i === j ? ACID : (R() < 0.5 ? VIOLET : CYAN);
    const p = cw * 0.16;
    ctx.fillRect(j * cw + p / 2, i * ch + p / 2, cw - p, ch - p);
  }
  // token stream highlight
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 5; i++) {
    const y = R() * h;
    const g = ctx.createLinearGradient(0, y, w, y);
    g.addColorStop(0, 'rgba(204,255,46,0)'); g.addColorStop(0.5, 'rgba(204,255,46,.55)'); g.addColorStop(1, 'rgba(204,255,46,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y, w, 1.2);
  }
  ctx.globalAlpha = 1;
}

function scatter(ctx, w, h, R) {
  ctx.fillStyle = '#0a0a11'; ctx.fillRect(0, 0, w, h);
  const cols = [ACID, VIOLET, CYAN, INK];
  const cx = [], cy = [];
  for (let c = 0; c < 4; c++) { cx.push(w * (0.2 + R() * 0.6)); cy.push(h * (0.2 + R() * 0.6)); }
  // cluster halos
  for (let c = 0; c < 4; c++) {
    const g = ctx.createRadialGradient(cx[c], cy[c], 0, cx[c], cy[c], w * 0.3);
    g.addColorStop(0, cols[c] + '22'); g.addColorStop(1, cols[c] + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 2400; i++) {
    const c = (R() * 4) | 0;
    const x = cx[c] + (R() + R() - 1) * w * 0.16;
    const y = cy[c] + (R() + R() - 1) * h * 0.16;
    ctx.globalAlpha = 0.25 + R() * 0.6;
    ctx.fillStyle = cols[c];
    const s = R() < 0.04 ? 2.4 : 1.15;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function ridge(ctx, w, h, R) {
  ctx.fillStyle = '#0a0a11'; ctx.fillRect(0, 0, w, h);
  const cx = w * 0.5, cy = h * 0.52;
  for (let ring = 1; ring < 26; ring++) {
    ctx.beginPath();
    const rr = ring * (Math.min(w, h) / 34);
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const wob = field(Math.cos(a) * 1.4 + ring * 0.22, Math.sin(a) * 1.4) * rr * 0.34;
      const x = cx + Math.cos(a) * (rr + wob) * 1.25, y = cy + Math.sin(a) * (rr + wob) * 0.8;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hot = ring < 5;
    ctx.strokeStyle = hot ? ACID : (ring % 6 === 0 ? VIOLET : 'rgba(236,238,242,.5)');
    ctx.globalAlpha = hot ? 0.85 : Math.max(0.07, 0.5 - ring * 0.017);
    ctx.lineWidth = hot ? 1.4 : 0.7;
    ctx.stroke();
  }
  // global minima marker
  ctx.globalAlpha = 1; ctx.fillStyle = ACID;
  ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, 7); ctx.fill();
  ctx.strokeStyle = ACID; ctx.globalAlpha = .5;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}

function wave(ctx, w, h, R) {
  ctx.fillStyle = '#0a0a11'; ctx.fillRect(0, 0, w, h);
  const mid = h / 2, cols = [ACID, CYAN, VIOLET, 'rgba(236,238,242,.6)'];
  for (let l = 0; l < 14; l++) {
    const amp = (14 - l) * h * 0.011, fq = 0.008 + l * 0.0035, ph = R() * 7;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const env = Math.sin(x / w * Math.PI);
      const y = mid + Math.sin(x * fq + ph) * amp * env + Math.sin(x * fq * 3.7 + ph * 2) * amp * 0.25 * env;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = cols[l % 4];
    ctx.globalAlpha = l === 0 ? 0.95 : 0.14 + (14 - l) * 0.028;
    ctx.lineWidth = l === 0 ? 1.6 : 0.8;
    ctx.stroke();
  }
  // sample ticks
  ctx.globalAlpha = 0.5; ctx.fillStyle = ACID;
  for (let i = 0; i < 40; i++) ctx.fillRect(R() * w, mid - 3 + (R() - 0.5) * h * 0.6, 1.4, 1.4);
  ctx.globalAlpha = 1;
}

const DRAW = { flow, tokens, scatter, ridge, wave };

export function initArt() {
  const canvases = [...document.querySelectorAll('canvas[data-art]')];
  if (!canvases.length) return;

  function render() {
    for (const cv of canvases) {
      const box = cv.parentElement.getBoundingClientRect();
      if (box.width < 4) continue;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext('2d');
      ctx.save(); ctx.scale(dpr, dpr);
      DRAW[cv.dataset.art]?.(ctx, box.width, box.height, rng(0x9e37 + cv.dataset.art.length * 131 + W));
      ctx.restore();
    }
  }
  render();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 220); });
}
