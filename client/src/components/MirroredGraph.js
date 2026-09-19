// NetWatch Signature Mirrored Throughput Graph
// Download grows upward, Upload grows downward from the central axis.

export class MirroredGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = []; // array of { time, rx, tx }
    this.maxPoints = 60;
    this.peakRx = 0;
    this.peakTx = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.render();
  }

  update(history) {
    if (history && history.length > 0) {
      this.history = history;
    }
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const midY = h / 2;
    const data = this.history;

    if (data.length < 2) {
      // Draw empty guide line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();
      return;
    }

    // Find current scale maximum
    let maxRx = 100000; // minimum 100 KB/s scale
    let maxTx = 50000;

    for (const pt of data) {
      if (pt.rx > maxRx) maxRx = pt.rx;
      if (pt.tx > maxTx) maxTx = pt.tx;
    }

    this.peakRx = Math.max(this.peakRx, maxRx);
    this.peakTx = Math.max(this.peakTx, maxTx);

    // Get theme colors from computed styles
    const style = getComputedStyle(document.body);
    const rxColor = style.getPropertyValue('--rx-rate').trim() || '#3fb950';
    const txColor = style.getPropertyValue('--tx-rate').trim() || '#58a6ff';
    const borderColor = style.getPropertyValue('--border-subtle').trim() || 'rgba(255,255,255,0.1)';
    const textMuted = style.getPropertyValue('--text-muted').trim() || '#8b949e';

    // 1. Draw background grid and central baseline
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;

    // Zero axis
    ctx.beginPath();
    ctx.moveTo(40, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    // Upper and lower scale lines
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(40, midY * 0.3);
    ctx.lineTo(w, midY * 0.3);
    ctx.moveTo(40, midY + midY * 0.7);
    ctx.lineTo(w, midY + midY * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scale text
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(`▲ ${this.formatBytes(maxRx)}/s`, 36, 14);
    ctx.fillText(`▼ ${this.formatBytes(maxTx)}/s`, 36, h - 6);
    ctx.fillText('0 B/s', 36, midY + 3);

    const stepX = (w - 50) / Math.max(data.length - 1, 1);
    const startX = 50;

    // 2. Draw Download (RX) growing UP from midY
    ctx.beginPath();
    ctx.moveTo(startX, midY);

    for (let i = 0; i < data.length; i++) {
      const x = startX + i * stepX;
      const normalized = Math.min(data[i].rx / maxRx, 1.0);
      const y = midY - (normalized * (midY - 15));
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineTo(startX + (data.length - 1) * stepX, midY);
    ctx.closePath();

    // Fill gradient for RX
    const rxGrad = ctx.createLinearGradient(0, 0, 0, midY);
    rxGrad.addColorStop(0, this.hexToRgba(rxColor, 0.45));
    rxGrad.addColorStop(1, this.hexToRgba(rxColor, 0.02));
    ctx.fillStyle = rxGrad;
    ctx.fill();

    // Stroke top RX line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * stepX;
      const normalized = Math.min(data[i].rx / maxRx, 1.0);
      const y = midY - (normalized * (midY - 15));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rxColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Draw Upload (TX) growing DOWN from midY
    ctx.beginPath();
    ctx.moveTo(startX, midY);

    for (let i = 0; i < data.length; i++) {
      const x = startX + i * stepX;
      const normalized = Math.min(data[i].tx / maxTx, 1.0);
      const y = midY + (normalized * (midY - 15));
      ctx.lineTo(x, y);
    }

    ctx.lineTo(startX + (data.length - 1) * stepX, midY);
    ctx.closePath();

    // Fill gradient for TX
    const txGrad = ctx.createLinearGradient(0, midY, 0, h);
    txGrad.addColorStop(0, this.hexToRgba(txColor, 0.02));
    txGrad.addColorStop(1, this.hexToRgba(txColor, 0.45));
    ctx.fillStyle = txGrad;
    ctx.fill();

    // Stroke bottom TX line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * stepX;
      const normalized = Math.min(data[i].tx / maxTx, 1.0);
      const y = midY + (normalized * (midY - 15));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = txColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw current endpoint indicator dots
    const lastX = startX + (data.length - 1) * stepX;
    const lastRxY = midY - (Math.min(data[data.length - 1].rx / maxRx, 1.0) * (midY - 15));
    const lastTxY = midY + (Math.min(data[data.length - 1].tx / maxTx, 1.0) * (midY - 15));

    ctx.fillStyle = rxColor;
    ctx.beginPath();
    ctx.arc(lastX, lastRxY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = txColor;
    ctx.beginPath();
    ctx.arc(lastX, lastTxY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }

  hexToRgba(colorStr, alpha) {
    if (colorStr.startsWith('#')) {
      const hex = colorStr.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return colorStr;
  }
}
