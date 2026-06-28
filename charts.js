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

  // first/last week labels
  ctx.fillStyle = textColor;
  if (points[0].label) ctx.fillText(points[0].label, dx(points[0].x) - 6, cssH - 8);
  const last = points[points.length - 1];
  if (last.label) {
    const tw = ctx.measureText(last.label).width;
    ctx.fillText(last.label, Math.min(dx(last.x) - tw / 2, cssW - padR - tw), cssH - 8);
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
