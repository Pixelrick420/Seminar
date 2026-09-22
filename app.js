(() => {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const m = document.createElement('style');
    m.textContent = '.iconbtn,.card,canvas{transition:none!important;animation:none!important}';
    document.head.appendChild(m);
  }

  const N = 512, HALF = N >> 1;
  const CV = { signal: document.getElementById('cv-signal'), transform: document.getElementById('cv-transform') };
  const savepct = document.getElementById('savepct');

  const state = {
    smooth: true,
    showOrig: true,
    showRecon: true,
    cutoff: 0.12,
    dispCut: 0.12,
  };

  const re = new Float64Array(N), im = new Float64Array(N);
  const mag = new Float64Array(N);
  const sre = new Float64Array(N), sim = new Float64Array(N);
  const disp = new Float64Array(N);

  function fft(r, i) {
    for (let x = 1, j = 0; x < N; x++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (x < j) {
        let t = r[x]; r[x] = r[j]; r[j] = t;
        t = i[x]; i[x] = i[j]; i[j] = t;
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let base = 0; base < N; base += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < half; j++) {
          const ur = r[base + j], ui = i[base + j];
          const vr = r[base + j + half] * cr - i[base + j + half] * ci;
          const vi = r[base + j + half] * ci + i[base + j + half] * cr;
          r[base + j] = ur + vr; i[base + j] = ui + vi;
          r[base + j + half] = ur - vr; i[base + j + half] = ui - vi;
          const nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = nr;
        }
      }
    }
  }

  const recon = new Float64Array(N);
  let peak = 1;

  function compute() {
    for (let k = 0; k < N; k++) { re[k] = disp[k]; im[k] = 0; }
    fft(re, im);
    peak = 0;
    for (let k = 0; k <= HALF; k++) {
      const m = Math.hypot(re[k], im[k]);
      mag[k] = m;
      if (m > peak) peak = m;
    }
    const cutAmp = state.dispCut * peak;
    let kept = 0;
    for (let k = 1; k <= HALF - 1; k++) if (mag[k] >= cutAmp) kept++;
    savepct.textContent = Math.round((1 - kept / HALF) * 100) + '%';
    for (let k = 0; k < N; k++) { sre[k] = re[k]; sim[k] = im[k]; }
    for (let k = 1; k < HALF; k++) {
      if (mag[k] < cutAmp) sre[k] = sre[N - k] = sim[k] = sim[N - k] = 0;
    }
    if (mag[HALF] < cutAmp) sre[HALF] = sim[HALF] = 0;
    for (let k = 0; k < N; k++) sim[k] = -sim[k];
    fft(sre, sim);
    for (let k = 0; k < N; k++) recon[k] = sre[k] / N;
  }

  (function sample() {
    const parts = [
      [3, 0.72, 0], [7, 0.5, 1.1], [11, 0.3, 0.4], [23, 0.16, 2.2],
    ];
    const phase = i => {
      let s = (i + 7) * 20240101 >>> 0;
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s / 4294967296) * Math.PI * 2;
    };
    for (let f = 31, i = 0; f <= 59; f += 4, i++) parts.push([f, 0.048, phase(i)]);
    for (let f = 65, i = 0; f <= 253; f += 2, i++) parts.push([f, 0.006, phase(i + 8)]);
    const fn = t => {
      let s = 0;
      for (let j = 0; j < parts.length; j++) {
        const f = parts[j][0], a = parts[j][1], p = parts[j][2];
        s += a * Math.sin(2 * Math.PI * f * t + p);
      }
      return s;
    };
    let peakV = 0;
    for (let k = 0; k < N; k++) {
      const v = fn(k / N);
      disp[k] = v;
      if (Math.abs(v) > peakV) peakV = Math.abs(v);
    }
    if (peakV > 0) for (let k = 0; k < N; k++) disp[k] /= peakV;
  })();

  const modeBtn = document.getElementById('modebtn');
  function setMode(m) {
    state.smooth = (m === 'smooth');
    modeBtn.classList.toggle('on', !state.smooth);
  }
  modeBtn.addEventListener('click', () => setMode(state.smooth ? 'points' : 'smooth'));

  const tglOrig = document.getElementById('tgl-orig');
  const tglRecon = document.getElementById('tgl-recon');
  tglOrig.addEventListener('click', () => {
    state.showOrig = !state.showOrig;
    tglOrig.classList.toggle('filled', state.showOrig);
  });
  tglRecon.addEventListener('click', () => {
    state.showRecon = !state.showRecon;
    tglRecon.classList.toggle('filled', state.showRecon);
  });

  const vslider = document.getElementById('vslider');
  const vsFill = document.getElementById('vsFill');
  const vsThumb = document.getElementById('vsThumb');

  function setCutoff(v) {
    state.cutoff = Math.min(1, Math.max(0, v));
    vslider.setAttribute('aria-valuenow', state.cutoff.toFixed(3));
  }
  function syncCutUI() {
    const pct = Math.round(state.dispCut * 100);
    vsFill.style.height = pct + '%';
    vsThumb.style.bottom = 'calc(' + pct + '% - 17px)';
  }

  function posToCut(clientY) {
    const r = vslider.getBoundingClientRect();
    const top = r.top + r.height * 0.08;
    const bottom = r.bottom - r.height * 0.08;
    const t = (bottom - clientY) / (bottom - top);
    return Math.min(1, Math.max(0, t));
  }
  let drag = false;
  vslider.addEventListener('pointerdown', e => { drag = true; vslider.setPointerCapture?.(e.pointerId); setCutoff(posToCut(e.clientY)); });
  vslider.addEventListener('pointermove', e => { if (drag) setCutoff(posToCut(e.clientY)); });
  ['pointerup', 'pointercancel'].forEach(ev => vslider.addEventListener(ev, () => { drag = false; }));

  vslider.addEventListener('keydown', e => {
    let d = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 0.02;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -0.02;
    else if (e.key === 'Home') { setCutoff(0); return; }
    else if (e.key === 'End') { setCutoff(1); return; }
    else return;
    e.preventDefault();
    setCutoff(state.cutoff + d);
  });

  const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const FONT_LABEL = '700 20px ' + FONT;
  const GRID = '#1c2330';
  const GRID_MINOR = 'rgba(130,150,185,0.07)';
  const GRID_MAJOR = 'rgba(160,180,210,0.18)';
  const GRID_STRONG = '#3a4658';
  const MUTED = '#93a3bd';

  function prep(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawSignal(cv) {
    const P = prep(cv);
    if (!P) return;
    const { ctx, w, h } = P;
    const mL = 44, mR = 28, mT = 20, mB = 40;
    const pw = w - mL - mR, ph = h - mT - mB;

    let lo = Infinity, hi = -Infinity;
    const scan = a => { for (let k = 0; k < N; k++) { const v = a[k]; if (v < lo) lo = v; if (v > hi) hi = v; } };
    scan(disp);
    scan(recon);
    if (lo > 0) lo = 0; if (hi < 0) hi = 0;
    const pad = (hi - lo) * 0.12 || 0.12;
    lo -= pad; hi += pad;

    const X = t => mL + t * pw;
    const Y = v => mT + (hi - v) / (hi - lo) * ph;

    const FINE_V = 10, FINE_H = 20, NTH = 5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = GRID_MINOR;
    for (let i = 1; i < FINE_V; i++) {
      if (i % NTH === 0) continue;
      const x = X(i / FINE_V);
      ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + ph); ctx.stroke();
    }
    for (let i = 1; i < FINE_H; i++) {
      if (i % NTH === 0) continue;
      const y = Y(lo + (hi - lo) * (i / FINE_H));
      ctx.beginPath(); ctx.moveTo(mL - 6, y); ctx.lineTo(mL + pw + 4, y); ctx.stroke();
    }
    ctx.strokeStyle = GRID_MAJOR;
    for (let i = 0; i <= FINE_V; i += NTH) {
      ctx.beginPath(); ctx.moveTo(X(i / FINE_V), mT); ctx.lineTo(X(i / FINE_V), mT + ph); ctx.stroke();
    }
    for (let i = 0; i <= FINE_H; i += NTH) {
      const y = Y(lo + (hi - lo) * (i / FINE_H));
      ctx.beginPath(); ctx.moveTo(mL - 6, y); ctx.lineTo(mL + pw + 4, y); ctx.stroke();
    }
    ctx.strokeStyle = GRID_STRONG; ctx.lineWidth = 1.4;
    const zeroY = Y(0);
    if (zeroY > mT && zeroY < mT + ph) {
      ctx.beginPath(); ctx.moveTo(mL, zeroY); ctx.lineTo(mL + pw, zeroY); ctx.stroke();
    }

    ctx.font = FONT_LABEL; ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(24, mT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('amplitude', 0, 0); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('time', mL + pw / 2, mT + ph + 16);

    if (state.smooth) {
      const draw = a => {
        ctx.beginPath();
        for (let k = 0; k < N; k++) { const x = X(k / N), y = Y(a[k]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = '#0a0f18';
        ctx.lineWidth = 7.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < N; k++) { const x = X(k / N), y = Y(a[k]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = a === disp ? '#3ec6ff' : '#7dff8f';
        ctx.lineWidth = 3.6; ctx.stroke();
      };
      if (state.showOrig) draw(disp);
      if (state.showRecon) draw(recon);
    } else {
      const step = 4;
      const pts = (a, color) => {
        ctx.fillStyle = color;
        for (let k = 0; k < N; k += step) {
          const x = X(k / N), y = Y(a[k]);
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#0a0f18'; ctx.lineWidth = 2; ctx.stroke();
        }
      };
      if (state.showOrig) pts(disp, '#3ec6ff');
      if (state.showRecon) pts(recon, '#7dff8f');
    }
  }

  function drawSpec(cv) {
    const P = prep(cv);
    if (!P) return;
    const { ctx, w, h } = P;
    const mL = 44, mR = 112, mT = 20, mB = 40;
    const pw = w - mL - mR, ph = h - mT - mB;
    const yMax = peak * 1.12;
    const X = k => mL + (k / HALF) * pw;
    const Y = v => mT + (1 - v / yMax) * ph;

    const cutY = Y(state.dispCut * peak);

    const FV = 20, FH = 20, NTH = 5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = GRID_MINOR;
    for (let i = 1; i < FV; i++) {
      if (i % NTH === 0) continue;
      const x = X((i * HALF) / FV);
      ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, mT + ph); ctx.stroke();
    }
    for (let i = 1; i < FH; i++) {
      if (i % NTH === 0) continue;
      const y = Y((i / FH) * yMax);
      ctx.beginPath(); ctx.moveTo(mL - 6, y); ctx.lineTo(mL + pw + 16, y); ctx.stroke();
    }
    ctx.strokeStyle = GRID_MAJOR;
    for (let i = 0; i <= FV; i += NTH) {
      ctx.beginPath(); ctx.moveTo(X((i * HALF) / FV), mT); ctx.lineTo(X((i * HALF) / FV), mT + ph); ctx.stroke();
    }
    for (let i = 0; i <= FH; i += NTH) {
      const y = Y((i / FH) * yMax);
      ctx.beginPath(); ctx.moveTo(mL - 6, y); ctx.lineTo(mL + pw + 16, y); ctx.stroke();
    }

    ctx.font = FONT_LABEL; ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(24, mT + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('magnitude', 0, 0); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('frequency', mL + pw / 2, mT + ph + 16);

    if (state.smooth) {
      const cutAmp = state.dispCut * peak;
      const bw = Math.max(1.6, pw / (HALF + 1) * 0.9);
      ctx.lineWidth = bw;
      ctx.lineCap = 'butt';
      for (let k = 0; k <= HALF; k++) {
        const m = mag[k];
        if (m < 1e-9) continue;
        const keep = k === 0 || m >= cutAmp;
        const x = X(k), y = Y(m);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, mT + ph);
        ctx.strokeStyle = keep ? '#3ec6ff' : '#5b6a80';
        ctx.stroke();
      }
    } else {
      const pr = 5;
      for (let k = 0; k <= HALF; k++) {
        const m = mag[k];
        if (m < 1e-9) continue;
        const keep = k === 0 || m >= state.dispCut * peak;
        ctx.beginPath(); ctx.arc(X(k), Y(m), pr, 0, Math.PI * 2);
        ctx.fillStyle = keep ? '#3ec6ff' : '#5b6a80';
        ctx.fill();
        ctx.beginPath(); ctx.arc(X(k), Y(m), pr + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#0a0f18'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    ctx.strokeStyle = '#7dff8f'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(mL - 4, cutY); ctx.lineTo(mL + pw + 12, cutY); ctx.stroke();

    ctx.beginPath(); ctx.arc(mL + pw + 12, cutY, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#7dff8f'; ctx.fill();
    ctx.strokeStyle = '#0a0f18'; ctx.lineWidth = 3; ctx.stroke();
  }

  function tick() {
    state.dispCut += (state.cutoff - state.dispCut) * 0.14;
    if (Math.abs(state.cutoff - state.dispCut) < 1e-5) state.dispCut = state.cutoff;

    compute();
    drawSignal(CV.signal);
    drawSpec(CV.transform);
    syncCutUI();
  }

  requestAnimationFrame(function loop() {
    tick();
    requestAnimationFrame(loop);
  });

  state.dispCut = state.cutoff;
  syncCutUI();
})();