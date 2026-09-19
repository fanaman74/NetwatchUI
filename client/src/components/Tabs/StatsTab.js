// NetWatch Stats Tab (Tab 5) - Protocol Distribution & Handshake Latency Histogram

export class StatsTab {
  constructor(container) {
    this.container = container;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <!-- Protocol Breakdown -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <span class="nw-panel-title">📊 Protocol Distribution</span>
            <span style="font-size: 11px; color: var(--text-muted);">L4 / L7 Traffic Breakdown</span>
          </div>
          <div id="protocol-bars" style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;"></div>
        </div>

        <!-- Handshake Timing Latency Histogram -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <span class="nw-panel-title">⏱️ TCP / TLS Handshake RTT Histogram</span>
            <span style="font-size: 11px; color: var(--text-muted);">SYN-ACK & TLS Latency</span>
          </div>
          <div id="handshake-histogram" style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;"></div>
        </div>

        <!-- Packet Size Distribution -->
        <div class="nw-panel" style="grid-column: 1 / span 2;">
          <div class="nw-panel-header">
            <span class="nw-panel-title">📦 Packet Size Distribution</span>
            <span style="font-size: 11px; color: var(--text-muted);">MTU & Segment Size Profiling</span>
          </div>
          <div id="packet-size-bars" style="display: flex; gap: 20px; align-items: flex-end; height: 160px; padding: 20px 10px 10px;"></div>
        </div>
      </div>
    `;
  }

  update(data) {
    if (!data || !data.stats) return;
    const stats = data.stats;

    // 1. Protocol Bars
    const protoContainer = this.container.querySelector('#protocol-bars');
    if (protoContainer && stats.protocols) {
      protoContainer.innerHTML = stats.protocols.map(p => `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <strong style="color: var(--brand);">${p.name}</strong>
            <span>${p.count} frames (${p.pct}%) · ${this.formatBytes(p.bytes)}</span>
          </div>
          <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
            <div style="width: ${p.pct}%; height: 100%; background: var(--brand); border-radius: 4px;"></div>
          </div>
        </div>
      `).join('');
    }

    // 2. Handshake Latency Histogram
    const histoContainer = this.container.querySelector('#handshake-histogram');
    if (histoContainer && stats.handshakeHistogram) {
      const maxCount = Math.max(...stats.handshakeHistogram.map(h => h.count), 1);
      histoContainer.innerHTML = stats.handshakeHistogram.map(h => {
        const pct = (h.count / maxCount) * 100;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
              <span style="font-family: var(--font-mono);">${h.range}</span>
              <strong>${h.count} samples</strong>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: var(--rx-rate); border-radius: 3px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Packet Size Distribution
    const sizeContainer = this.container.querySelector('#packet-size-bars');
    if (sizeContainer && stats.packetSizeDistribution) {
      const maxSize = Math.max(...stats.packetSizeDistribution.map(s => s.count), 1);
      sizeContainer.innerHTML = stats.packetSizeDistribution.map(s => {
        const heightPct = Math.max(10, (s.count / maxSize) * 100);
        return `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
            <span style="font-size: 11px; color: var(--text-primary); font-weight: 600; margin-bottom: 6px;">${s.count}</span>
            <div style="width: 100%; height: ${heightPct}%; background: linear-gradient(to top, var(--tx-rate), var(--brand)); border-radius: 4px 4px 0 0;"></div>
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">${s.range}</span>
          </div>
        `;
      }).join('');
    }
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
