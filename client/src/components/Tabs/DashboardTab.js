// NetWatch Dashboard Tab (Tab 1)
import { MirroredGraph } from '../MirroredGraph.js';

export class DashboardTab {
  constructor(container) {
    this.container = container;
    this.graph = null;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <!-- KPI Hero Strip -->
      <div class="nw-kpi-strip" id="kpi-strip"></div>

      <!-- Mirrored Throughput Panel -->
      <div class="nw-panel" style="margin-top: 14px;">
        <div class="nw-panel-header">
          <div class="nw-panel-title">
            <span>⚡ Real-Time Throughput</span>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 400;">(Mirrored Braille Canvas: Download ▲ / Upload ▼)</span>
          </div>
          <div class="nw-chart-legend">
            <div class="nw-legend-item">
              <div class="nw-legend-color rx"></div>
              <span>RX Download</span>
              <strong id="rx-rate-badge" style="color: var(--rx-rate); margin-left: 4px;">0 B/s</strong>
            </div>
            <div class="nw-legend-item">
              <div class="nw-legend-color tx"></div>
              <span>TX Upload</span>
              <strong id="tx-rate-badge" style="color: var(--tx-rate); margin-left: 4px;">0 B/s</strong>
            </div>
          </div>
        </div>
        <div class="nw-throughput-canvas-container">
          <canvas class="nw-mirrored-canvas" id="throughput-canvas"></canvas>
        </div>
      </div>

      <!-- Mid Section: Link Info & Top Talkers -->
      <div style="display: grid; grid-template-columns: 320px 1fr; gap: 14px; margin-top: 14px;">
        <!-- Active Link Card -->
        <div class="nw-panel" id="active-link-card">
          <div class="nw-panel-header">
            <div class="nw-panel-title">📡 Active Link</div>
            <span class="nw-chip established">ONLINE</span>
          </div>
          <div id="link-details" style="font-size: 12px; display: flex; flex-direction: column; gap: 8px;"></div>
        </div>

        <!-- Top Talkers Table -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <div class="nw-panel-title">🔥 Top Connection Talkers</div>
            <span style="font-size: 11px; color: var(--text-muted);">Active Sockets</span>
          </div>
          <div class="nw-table-container" style="max-height: 220px;">
            <table class="nw-table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>PID</th>
                  <th>Remote Host</th>
                  <th>State</th>
                  <th>RTT</th>
                  <th>RX Rate</th>
                  <th>TX Rate</th>
                </tr>
              </thead>
              <tbody id="top-talkers-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Incident Alerts Ticker -->
      <div class="nw-panel" style="margin-top: 14px;">
        <div class="nw-panel-header">
          <div class="nw-panel-title">🚨 Recent Threat & Telemetry Events</div>
          <span style="font-size: 11px; color: var(--text-muted);">Flight Recorder Armed</span>
        </div>
        <div id="alert-ticker" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;"></div>
      </div>
    `;

    const canvas = this.container.querySelector('#throughput-canvas');
    this.graph = new MirroredGraph(canvas);
  }

  update(data) {
    if (!data) return;

    // 1. Update KPI hero strip
    const kpiStrip = this.container.querySelector('#kpi-strip');
    if (kpiStrip && data.kpis) {
      let html = '';
      for (const [key, kpi] of Object.entries(data.kpis)) {
        const valClass = kpi.status === 'error' ? 'status-error' : (kpi.status === 'warn' ? 'status-warn' : 'status-good');
        const devClass = kpi.status === 'error' ? 'error' : (kpi.status === 'warn' ? 'warn' : 'good');

        html += `
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">${kpi.label}</span>
              <span class="nw-kpi-subject">${kpi.subject}</span>
            </div>
            <div class="nw-kpi-body">
              <div class="nw-kpi-value ${valClass}">
                ${typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value}
                <span class="nw-kpi-unit">${kpi.unit}</span>
              </div>
              <span class="nw-deviation-tag ${devClass}">${kpi.deviation}</span>
            </div>
            <div class="nw-kpi-footer">
              <span>base ${kpi.baseline} · σ ${kpi.sigma}</span>
              ${kpi.since ? `<span style="color: var(--status-error);">since ${kpi.since}</span>` : '<span>nominal</span>'}
            </div>
          </div>
        `;
      }
      kpiStrip.innerHTML = html;
    }

    // 2. Update Throughput graph
    if (this.graph && data.throughput) {
      this.graph.update(data.throughput.history);
      const rxBadge = this.container.querySelector('#rx-rate-badge');
      const txBadge = this.container.querySelector('#tx-rate-badge');
      if (rxBadge) rxBadge.textContent = this.formatSpeed(data.throughput.rx);
      if (txBadge) txBadge.textContent = this.formatSpeed(data.throughput.tx);
    }

    // 3. Update Link Info
    const linkDetails = this.container.querySelector('#link-details');
    if (linkDetails && data.interfaces && data.interfaces[0]) {
      const iface = data.interfaces[0];
      linkDetails.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Interface:</span>
          <strong>${iface.name} (${iface.type})</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">IPv4 Address:</span>
          <span style="color: var(--brand);">${iface.ipv4}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">MAC / MTU:</span>
          <span>${iface.mac} · MTU ${iface.mtu}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Transferred:</span>
          <span>▲ ${this.formatBytes(iface.rxBytes)} · ▼ ${this.formatBytes(iface.txBytes)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Drops / Errors:</span>
          <span style="color: ${iface.rxErrors > 0 ? 'var(--status-error)' : 'var(--status-good)'};">
            ${iface.rxErrors} err · ${iface.rxDrops} drop
          </span>
        </div>
      `;
    }

    // 4. Update Top Talkers
    const talkersTbody = this.container.querySelector('#top-talkers-tbody');
    if (talkersTbody && data.connections) {
      const topConns = data.connections.slice(0, 5);
      talkersTbody.innerHTML = topConns.map(c => `
        <tr>
          <td><strong style="color: var(--brand);">${c.process}</strong></td>
          <td style="color: var(--text-muted);">${c.pid}</td>
          <td>${c.flag || ''} ${c.remoteHost}:${c.remotePort}</td>
          <td><span class="nw-chip ${c.state.toLowerCase()}">${c.state}</span></td>
          <td style="color: ${c.rtt > 50 ? 'var(--status-error)' : 'var(--text-primary)'};">${c.rtt.toFixed(1)} ms</td>
          <td style="color: var(--rx-rate);">${this.formatSpeed(c.rxRate)}</td>
          <td style="color: var(--tx-rate);">${this.formatSpeed(c.txRate)}</td>
        </tr>
      `).join('');
    }

    // 5. Update Alert Ticker
    const alertTicker = this.container.querySelector('#alert-ticker');
    if (alertTicker && data.threats && data.threats.alerts) {
      const alerts = data.threats.alerts.slice(0, 3);
      if (alerts.length === 0) {
        alertTicker.innerHTML = '<span style="color: var(--status-good);">No active alerts. Network traffic nominal.</span>';
      } else {
        alertTicker.innerHTML = alerts.map(a => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 3px solid ${a.severity === 'critical' ? 'var(--status-error)' : 'var(--status-warn)'};">
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="nw-deviation-tag ${a.severity === 'critical' ? 'error' : 'warn'}">${a.category}</span>
              <strong>${a.message}</strong>
              <span style="color: var(--text-muted); font-size: 11px;">${a.detail}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 11px;">${a.timeFormatted || 'recent'}</span>
          </div>
        `).join('');
      }
    }
  }

  formatSpeed(bps) {
    if (!bps) return '0 B/s';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
    return bps + ' B/s';
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
