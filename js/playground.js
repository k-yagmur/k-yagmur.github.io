// ============================================================
//  NEURAL SANDBOX — a real 2→24→24→1 MLP trained live in the
//  browser (hand-rolled Adam). Click/drag to add data, watch
//  the decision boundary learn in real time.
// ============================================================

const H = 24;                       // hidden width
const LIM = 1.15;                   // data space [-LIM, LIM]
const GW = 148, GH = 92;            // boundary grid res
const COL_A = [204, 255, 46];       // lime  (class 0)
const COL_B = [138, 92, 255];       // violet(class 1)

export function initLab() {
  const cv = document.getElementById('labCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const stage = cv.parentElement;

  // ---------- network state ---------------------------------
  const W1 = new Float32Array(H * 2), b1 = new Float32Array(H);
  const W2 = new Float32Array(H * H), b2 = new Float32Array(H);
  const W3 = new Float32Array(H), b3 = new Float32Array(1);
  const gW1 = new Float32Array(H * 2), gb1 = new Float32Array(H);
  const gW2 = new Float32Array(H * H), gb2 = new Float32Array(H);
  const gW3 = new Float32Array(H), gb3 = new Float32Array(1);
  const mW1 = new Float32Array(H * 2), vW1 = new Float32Array(H * 2);
  const mb1 = new Float32Array(H), vb1 = new Float32Array(H);
  const mW2 = new Float32Array(H * H), vW2 = new Float32Array(H * H);
  const mb2 = new Float32Array(H), vb2 = new Float32Array(H);
  const mW3 = new Float32Array(H), vW3 = new Float32Array(H);
  const mb3 = new Float32Array(1), vb3 = new Float32Array(1);
  const z1 = new Float32Array(H), a1 = new Float32Array(H);
  const z2 = new Float32Array(H), a2 = new Float32Array(H);
  const dz2 = new Float32Array(H), dz1 = new Float32Array(H);

  function resetNet() {
    const rs = (arr, fan) => { for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() * 2 - 1) * Math.sqrt(2 / fan); };
    rs(W1, 2); rs(W2, H); rs(W3, H);
    b1.fill(0); b2.fill(0); b3.fill(0);
    for (const a of [mW1, vW1, mb1, vb1, mW2, vW2, mb2, vb2, mW3, vW3, mb3, vb3]) a.fill(0);
    step = 0; epoch = 0;
  }
  let step = 0, epoch = 0;

  function forward(x, y, keepActs) {
    for (let j = 0; j < H; j++) {
      const s = x * W1[j * 2] + y * W1[j * 2 + 1] + b1[j];
      z1[j] = s; a1[j] = Math.tanh(s);
    }
    for (let j = 0; j < H; j++) {
      let s = b2[j];
      for (let k = 0; k < H; k++) s += a1[k] * W2[j * H + k];
      z2[j] = s; a2[j] = Math.tanh(s);
    }
    let s = b3[0];
    for (let k = 0; k < H; k++) s += a2[k] * W3[k];
    return 1 / (1 + Math.exp(-s));
  }

  const B1 = 0.9, B2 = 0.999, EPS = 1e-8, LR = 0.022;
  function adam(p, g, m, v, i, t) {
    m[i] = B1 * m[i] + (1 - B1) * g[i];
    v[i] = B2 * v[i] + (1 - B2) * g[i] * g[i];
    p[i] -= LR * (m[i] / (1 - Math.pow(B1, t))) / (Math.sqrt(v[i] / (1 - Math.pow(B2, t))) + EPS);
  }

  function trainStep() {
    gW1.fill(0); gb1.fill(0); gW2.fill(0); gb2.fill(0); gW3.fill(0); gb3.fill(0);
    let loss = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = forward(pts[i].x, pts[i].y, true);
      const t = pts[i].c;
      loss += -(t * Math.log(p + 1e-9) + (1 - t) * Math.log(1 - p + 1e-9));
      const dz3 = (p - t) / n;
      for (let k = 0; k < H; k++) { gW3[k] += dz3 * a2[k]; dz2[k] = dz3 * W3[k] * (1 - a2[k] * a2[k]); }
      gb3[0] += dz3;
      for (let j = 0; j < H; j++) {
        const g = dz2[j];
        gb2[j] += g;
        for (let k = 0; k < H; k++) gW2[j * H + k] += g * a1[k];
        dz1[j] = 0;
      }
      for (let k = 0; k < H; k++) for (let j = 0; j < H; j++) dz1[k] += dz2[j] * W2[j * H + k];
      for (let k = 0; k < H; k++) {
        const g = dz1[k] * (1 - a1[k] * a1[k]);
        gb1[k] += g;
        gW1[k * 2] += g * pts[i].x; gW1[k * 2 + 1] += g * pts[i].y;
      }
    }
    step++;
    for (let i = 0; i < W1.length; i++) adam(W1, gW1, mW1, vW1, i, step);
    for (let i = 0; i < b1.length; i++) adam(b1, gb1, mb1, vb1, i, step);
    for (let i = 0; i < W2.length; i++) adam(W2, gW2, mW2, vW2, i, step);
    for (let i = 0; i < b2.length; i++) adam(b2, gb2, mb2, vb2, i, step);
    for (let i = 0; i < W3.length; i++) adam(W3, gW3, mW3, vW3, i, step);
    adam(b3, gb3, mb3, vb3, 0, step);
    epoch++;
    return loss / n;
  }

  // ---------- data ------------------------------------------
  let pts = [];
  const PRESETS = {
    spiral() {
      const p = [];
      for (let i = 0; i < 90; i++) {
        const r = i / 90, t = 1.75 * r * Math.PI * 2 + 0.4;
        for (const c of [0, 1]) {
          const a = t + c * Math.PI;
          p.push({ x: (r * 0.92) * Math.sin(a) + (Math.random() - .5) * .09, y: (r * 0.92) * Math.cos(a) + (Math.random() - .5) * .09, c });
        }
      }
      return p;
    },
    xor() {
      const p = [];
      for (let i = 0; i < 40; i++) for (const [qx, qy, c] of [[-.55, -.55, 0], [.55, .55, 0], [-.55, .55, 1], [.55, -.55, 1]])
        p.push({ x: qx + (Math.random() - .5) * .42, y: qy + (Math.random() - .5) * .42, c });
      return p;
    },
    rings() {
      const p = [];
      for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, r = Math.random() * .3; p.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, c: 0 }); }
      for (let i = 0; i < 110; i++) { const a = Math.random() * 6.28, r = .68 + Math.random() * .3; p.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, c: 1 }); }
      return p;
    },
    moons() {
      const p = [];
      for (let i = 0; i < 80; i++) { const a = Math.PI * i / 80; p.push({ x: Math.cos(a) * .8 - .4 + (Math.random() - .5) * .12, y: Math.sin(a) * .55 - .1 + (Math.random() - .5) * .12, c: 0 }); }
      for (let i = 0; i < 80; i++) { const a = Math.PI * i / 80; p.push({ x: .4 - Math.cos(a) * .8 + (Math.random() - .5) * .12, y: .25 - Math.sin(a) * .55 + (Math.random() - .5) * .12, c: 1 }); }
      return p;
    },
  };

  // ---------- boundary grid ---------------------------------
  const off = document.createElement('canvas');
  off.width = GW; off.height = GH;
  const offCtx = off.getContext('2d');
  const img = offCtx.createImageData(GW, GH);
  let boundaryDirty = true;

  function computeBoundary() {
    const d = img.data;
    for (let gy = 0; gy < GH; gy++) {
      const y = (0.5 - gy / (GH - 1)) * 2 * LIM;
      for (let gx = 0; gx < GW; gx++) {
        const x = (gx / (GW - 1) - 0.5) * 2 * LIM;
        const p = forward(x, y, false);
        const edge = Math.abs(p - 0.5);                       // 0 at boundary
        const glow = Math.max(0, 1 - edge * 9);               // bright contour
        const sat = 0.16 + Math.min(1, edge * 2.4) * 0.62;    // confidence → alpha
        const i4 = (gy * GW + gx) * 4;
        d[i4]     = COL_A[0] + (COL_B[0] - COL_A[0]) * p + glow * 90;
        d[i4 + 1] = COL_A[1] + (COL_B[1] - COL_A[1]) * p + glow * 90;
        d[i4 + 2] = COL_A[2] + (COL_B[2] - COL_A[2]) * p + glow * 90;
        d[i4 + 3] = sat * 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
  }

  // ---------- render ----------------------------------------
  let W = 0, Hh = 0, dpr = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = Math.max(4, r.width); Hh = Math.max(4, r.height);
    cv.width = W * dpr; cv.height = Hh * dpr;
    boundaryDirty = true;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const X = v => (v / (2 * LIM) + 0.5) * W;
  const Y = v => (0.5 - v / (2 * LIM)) * Hh;

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    ctx.fillStyle = '#090910'; ctx.fillRect(0, 0, W, Hh);

    if (boundaryDirty || training) { computeBoundary(); boundaryDirty = false; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, Hh);

    // faint grid
    ctx.strokeStyle = 'rgba(236,238,242,.05)'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(W * i / 8, 0); ctx.lineTo(W * i / 8, Hh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Hh * i / 8); ctx.lineTo(W, Hh * i / 8); ctx.stroke();
    }

    // points
    for (const p of pts) {
      const x = X(p.x), y = Y(p.y);
      const col = p.c === 0 ? COL_A : COL_B;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},.28)`;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    }
  }

  // ---------- HUD -------------------------------------------
  const elE = document.getElementById('labEpoch'), elL = document.getElementById('labLoss'),
        elA = document.getElementById('labAcc'), cvC = document.getElementById('labCurve');
  const cctx = cvC && cvC.getContext('2d');
  const hist = [];
  let hudT = 0;

  function hud(loss) {
    elE.textContent = epoch;
    if (loss == null) { elL.textContent = elA.textContent = '—'; cctx?.clearRect(0, 0, 120, 26); }
    if (loss != null) {
      elL.textContent = loss.toFixed(4);
      let ok = 0; for (const p of pts) if ((forward(p.x, p.y, false) > 0.5) === !!p.c) ok++;
      elA.textContent = pts.length ? (ok / pts.length * 100).toFixed(1) + '%' : '—';
      hist.push(loss); if (hist.length > 120) hist.shift();
      if (cctx) {
        cctx.clearRect(0, 0, 120, 26);
        const mx = Math.max(...hist, 0.05);
        cctx.strokeStyle = '#ccff2e'; cctx.lineWidth = 1; cctx.beginPath();
        hist.forEach((l, i) => { const x = i / 119 * 118 + 1, y = 24 - (l / mx) * 21; i ? cctx.lineTo(x, y) : cctx.moveTo(x, y); });
        cctx.stroke();
      }
    }
  }

  // ---------- loop ------------------------------------------
  let training = true, inView = false, loss = null;
  function loop(t) {
    requestAnimationFrame(loop);
    if (!inView || document.hidden) return;
    const both = pts.some(p => p.c === 0) && pts.some(p => p.c === 1);
    if (training && both && pts.length >= 6) {
      for (let i = 0; i < 4; i++) loss = trainStep();
    }
    draw();
    if (t - hudT > 140) { hudT = t; hud(loss); }
  }
  new IntersectionObserver(e => inView = e[0].isIntersecting, { threshold: 0.05 }).observe(stage);
  requestAnimationFrame(loop);

  // ---------- input ------------------------------------------
  let cls = 0, paintClass = 0, down = false, last = null;
  const toData = e => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * 2 * LIM, y: (0.5 - (e.clientY - r.top) / r.height) * 2 * LIM };
  };
  const addPt = (x, y, c) => {
    if (Math.abs(x) > LIM || Math.abs(y) > LIM) return;
    pts.push({ x, y, c });
    if (pts.length > 900) pts.shift();
  };
  cv.addEventListener('pointerdown', e => {
    down = true; cv.setPointerCapture(e.pointerId);
    const { x, y } = toData(e);
    paintClass = e.button === 2 ? 1 : cls;
    addPt(x, y, paintClass); last = { x, y };
  });
  cv.addEventListener('pointermove', e => {
    if (!down) return;
    const { x, y } = toData(e);
    if (!last || Math.hypot(x - last.x, y - last.y) > 0.055) { addPt(x, y, paintClass); last = { x, y }; }
  });
  addEventListener('pointerup', () => { down = false; last = null; });
  cv.addEventListener('pointercancel', () => { down = false; last = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- controls ---------------------------------------
  document.querySelectorAll('#classSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#classSeg .seg-btn').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); cls = +b.dataset.cls;
  }));
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    pts = PRESETS[b.dataset.preset](); resetNet(); loss = null; hist.length = 0; boundaryDirty = true;
    if (!training) toggleTrain();
  }));
  const tBtn = document.getElementById('labToggle');
  function toggleTrain() { training = !training; tBtn.innerHTML = training ? '⏸ PAUSE' : '▶ TRAIN'; }
  tBtn.addEventListener('click', toggleTrain);
  document.getElementById('labClear').addEventListener('click', () => { pts = []; resetNet(); loss = null; hist.length = 0; boundaryDirty = true; hud(null); });

  // boot with a spiral already mid-training
  pts = PRESETS.spiral();
  resetNet();
  for (let i = 0; i < 300; i++) loss = trainStep();
  boundaryDirty = true;
}
