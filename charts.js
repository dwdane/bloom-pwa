// charts.js
// A small dependency-free line chart on a canvas, mirroring the calm, positive
// look of the native app: a soft filled area under a smooth line, light guide
// lines, no clinical precision. Used for weight and bump trends.

// points: [{ x: number, y: number, label?: string }], oldest first.
// Draws into an existing <canvas>. opts: { formatValue, accent }
function drawLineChart(canvas, points, opts = {}) {
  const formatValue = opts.formatValue || ((v) => String(Math.round(v)));
  const accent = opts.accent || '#b5739d';
  const gridColor = 'rgba(150,140,150,0.25)';
  const textColor = getComputedStyle(canvas).color || '#766c7b';

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 180;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  if (points.length < 2) return;

  const padL = 42, padR = 12, padT = 14, padB = 26;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = Math.abs(maxY - minY);
  const pad = range < 0.001 ? Math.abs(maxY) * 0.1 + 1 : range * 0.2;
  minY -= pad;
  maxY += pad;

  const dx = (x) =>
    padL + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * w;
  const dy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * h;

  // guide lines + value labels
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const value = minY + (maxY - minY) * (i / 2);
    const y = dy(value);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
    ctx.fillText(formatValue(value), 4, y - 3);
  }

  // filled area
  ctx.beginPath();
  ctx.moveTo(dx(points[0].x), padT + h);
  points.forEach((p) => ctx.lineTo(dx(p.x), dy(p.y)));
  ctx.lineTo(dx(points[points.length - 1].x), padT + h);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(accent, 0.12);
  ctx.fill();

  // line
  ctx.beginPath();
  points.forEach((p, i) => {
    const X = dx(p.x), Y = dy(p.y);
    if (i === 0) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
  });
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // dots
  ctx.fillStyle = accent;
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(dx(p.x), dy(p.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // x-axis week labels: show up to ~5 evenly spaced, avoiding clutter
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  const labeled = points.filter((p) => p.label);
  if (labeled.length) {
    const maxLabels = 5;
    const stride = Math.max(1, Math.ceil(points.length / maxLabels));
    const shown = [];
    for (let i = 0; i < points.length; i += stride) shown.push(i);
    const lastIdx = points.length - 1;
    if (shown[shown.length - 1] !== lastIdx) shown.push(lastIdx);
    for (const i of shown) {
      const p = points[i];
      if (!p.label) continue;
      let x = dx(p.x);
      x = Math.max(padL + 10, Math.min(x, cssW - padR - 10));
      ctx.fillText(p.label, x, cssH - 8);
    }
  }
  ctx.textAlign = 'left';
}

// Stacked bar chart for feelings/symptoms over time. groups: ordered array of
// { label, segments: [{ value, color }] }. Renders a small legend-free stack
// per group (e.g. one bar per week), good moments at the base so the positive
// part reads first.
function drawStackedBars(canvas, groups, opts = {}) {
  const textColor = getComputedStyle(canvas).color || '#766c7b';
  const gridColor = 'rgba(150,140,150,0.25)';

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 180;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);
  if (!groups.length) return;

  const padL = 26, padR = 12, padT = 12, padB = 24;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  const totals = groups.map((g) =>
    g.segments.reduce((s, seg) => s + seg.value, 0)
  );
  const maxTotal = Math.max(1, ...totals);

  // horizontal guide lines at integer-ish steps
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  const steps = Math.min(maxTotal, 4);
  for (let i = 0; i <= steps; i++) {
    const value = Math.round((maxTotal * i) / steps);
    const y = padT + h - (value / maxTotal) * h;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
    ctx.fillText(String(value), 4, y + 3);
  }

  const slot = w / groups.length;
  const barW = Math.min(28, slot * 0.6);
  ctx.textAlign = 'center';
  groups.forEach((g, i) => {
    const cx = padL + slot * i + slot / 2;
    let y = padT + h;
    for (const seg of g.segments) {
      if (seg.value <= 0) continue;
      const segH = (seg.value / maxTotal) * h;
      ctx.fillStyle = seg.color;
      ctx.fillRect(cx - barW / 2, y - segH, barW, segH);
      y -= segH;
    }
    ctx.fillStyle = textColor;
    if (g.label) ctx.fillText(g.label, cx, cssH - 8);
  });
  ctx.textAlign = 'left';
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// drawContractionTimeline(canvas, events, opts)
// Renders a horizontal labor timeline: each contraction is a solid colored block
// and the rests between them are light gaps, so the rhythm is visible at a glance.
// events: array of { startedAt, endedAt } in ms, any order. Shows the most recent
// window (default last 60 min, or all events if they span less).
function drawContractionTimeline(canvas, events, opts = {}) {
  const accent = opts.accent || '#b5739d';
  const restColor = opts.restColor || 'rgba(181,115,157,0.14)';
  const textColor = opts.textColor || '#9a8aa0';
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 84;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const valid = (events || [])
    .filter((e) => e.startedAt && e.endedAt)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (valid.length === 0) return;

  const now = Date.now();
  const windowMs = opts.windowMs || 3600000;
  const earliest = Math.min(valid[0].startedAt, now - windowMs);
  const start = Math.max(earliest, valid[0].startedAt - 60000);
  const end = now;
  const span = Math.max(end - start, 60000);

  const padX = 8;
  const trackW = cssW - padX * 2;
  const trackY = 14;
  const trackH = cssH - 38;
  const xOf = (t) => padX + ((t - start) / span) * trackW;

  // rest baseline
  ctx.fillStyle = restColor;
  roundRectPath(ctx, padX, trackY, trackW, trackH, 8);
  ctx.fill();

  // contraction blocks
  ctx.fillStyle = accent;
  for (const e of valid) {
    const x0 = xOf(e.startedAt);
    const x1 = Math.max(xOf(e.endedAt), x0 + 2);
    roundRectPath(ctx, x0, trackY, x1 - x0, trackH, 3);
    ctx.fill();
  }

  // time ticks (start and now)
  ctx.fillStyle = textColor;
  ctx.font = '11px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), padX, cssH - 8);
  ctx.textAlign = 'right';
  ctx.fillText('now', cssW - padX, cssH - 8);
  ctx.textAlign = 'left';
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
