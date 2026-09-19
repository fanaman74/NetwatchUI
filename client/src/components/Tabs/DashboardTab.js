// NetWatch Dashboard Tab (Tab 1)
import { MirroredGraph } from '../MirroredGraph.js';

export class DashboardTab {
  constructor(container) {
    this.container = container;
    this.graph = null;
    this.sortBy = 'bandwidth'; // 'bandwidth' | 'rtt' | 'retrans' | 'process'
    this.searchQuery = '';
    this.selectedConnectionId = null;
    this.cachedConnections = [];

    this.renderInitial();
    this.bindEvents();
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

      <!-- Mid Section: Active Link & Threat Events Grid -->
      <div style="display: grid; grid-template-columns: 360px 1fr; gap: 14px; margin-top: 14px;">
        <!-- Active Link Card -->
        <div class="nw-panel" id="active-link-card">
          <div class="nw-panel-header">
            <div class="nw-panel-title">📡 Active Link &amp; Interface</div>
            <span class="nw-chip established">ONLINE</span>
          </div>
          <div id="link-details" style="font-size: 12px; display: flex; flex-direction: column; gap: 8px;"></div>
        </div>

        <!-- Incident & Threat Events Ticker -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <div class="nw-panel-title">🚨 Recent Threat &amp; Telemetry Events</div>
            <span style="font-size: 11px; color: var(--text-muted);">Flight Recorder Armed</span>
          </div>
          <div id="alert-ticker" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; max-height: 140px; overflow-y: auto;"></div>
        </div>
      </div>

      <!-- 🔥 Top 15 Active Connections Section -->
      <div class="nw-panel" style="margin-top: 14px;" id="top-15-connections-section">
        <div class="nw-panel-header" style="flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="nw-panel-title" style="font-size: 15px;">
              <span>🔥 Top 15 Active Connections</span>
            </div>
            <span id="top15-count-badge" class="nw-chip established" style="font-size: 11px;">Top 15</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Filter Search -->
            <div style="position: relative; display: flex; align-items: center;">
              <input type="text" id="top15-search-input" class="nw-select" placeholder="Filter process / host..." style="width: 170px; height: 28px; font-size: 11px; padding: 2px 8px;" />
            </div>

            <!-- Sort By Buttons -->
            <div id="top15-sort-buttons" style="display: flex; gap: 4px;">
              <button class="nw-btn active" data-sort="bandwidth" style="padding: 3px 8px; font-size: 11px;">🔥 Bandwidth</button>
              <button class="nw-btn" data-sort="rtt" style="padding: 3px 8px; font-size: 11px;">⏱️ Latency</button>
              <button class="nw-btn" data-sort="retrans" style="padding: 3px 8px; font-size: 11px;">📦 Retrans</button>
              <button class="nw-btn" data-sort="process" style="padding: 3px 8px; font-size: 11px;">🔤 Process</button>
            </div>

            <!-- View All in Tab 2 Button -->
            <button id="top15-view-all-btn" class="nw-btn primary" style="padding: 4px 10px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <span>View All Sockets (Tab 2)</span>
              <span>➔</span>
            </button>
          </div>
        </div>

        <!-- Selected Connection Hoisted Details Inspector (toggleable on click) -->
        <div id="top15-hoisted-box" style="display: none; background: rgba(0, 210, 255, 0.07); border: 1px solid var(--brand); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px;"></div>

        <!-- Top 15 Sockets Table -->
        <div class="nw-table-container" style="max-height: 520px; overflow-y: auto;">
          <table class="nw-table">
            <thead style="position: sticky; top: 0; z-index: 2;">
              <tr>
                <th style="width: 44px; text-align: center;">#</th>
                <th>Process</th>
                <th>PID</th>
                <th>Proto / State</th>
                <th>Local Socket</th>
                <th>Remote Destination</th>
                <th>ASN / Organization</th>
                <th>RTT Latency</th>
                <th>RX Down</th>
                <th>TX Up</th>
                <th>Total Throughput</th>
              </tr>
            </thead>
            <tbody id="top15-tbody">
              <tr>
                <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px;">Waiting for connection telemetry stream...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: var(--text-muted);">
          <span>💡 Click any connection row to inspect deep TCP window &amp; congestion metrics.</span>
          <span id="top15-footer-summary">Ranked by combined upload + download speed</span>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector('#throughput-canvas');
    this.graph = new MirroredGraph(canvas);
  }

  bindEvents() {
    // Sort buttons
    const sortContainer = this.container.querySelector('#top15-sort-buttons');
    if (sortContainer) {
      sortContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-sort]');
        if (!btn) return;
        sortContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sortBy = btn.getAttribute('data-sort');
        this.renderTop15Table();
      });
    }

    // Search filter input
    const searchInput = this.container.querySelector('#top15-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderTop15Table();
      });
    }

    // View All button (navigates to Tab 2)
    const viewAllBtn = this.container.querySelector('#top15-view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        const tab2 = document.querySelector('.nw-tab[data-tab="2"]');
        if (tab2) tab2.click();
      });
    }

    // Row click for hoisted socket inspection
    const tbody = this.container.querySelector('#top15-tbody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-conn-id]');
        if (!row) return;
        const id = parseInt(row.getAttribute('data-conn-id'), 10);
        this.selectedConnectionId = this.selectedConnectionId === id ? null : id;
        this.renderTop15Table();
      });
    }
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
          <span style="color: var(--brand); font-weight:600;">${iface.ipv4}</span>
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

    // 4. Update Alert Ticker
    const alertTicker = this.container.querySelector('#alert-ticker');
    if (alertTicker && data.threats && data.threats.alerts) {
      const alerts = data.threats.alerts.slice(0, 4);
      if (alerts.length === 0) {
        alertTicker.innerHTML = '<span style="color: var(--status-good); padding: 8px 0;">No active alerts. Network traffic nominal.</span>';
      } else {
        alertTicker.innerHTML = alerts.map(a => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 3px solid ${a.severity === 'critical' ? 'var(--status-error)' : 'var(--status-warn)'};">
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

    // 5. Update Cached Connections & Re-render Top 15 Section
    if (data.connections) {
      this.cachedConnections = data.connections;
      this.renderTop15Table();
    }
  }

  renderTop15Table() {
    const tbody = this.container.querySelector('#top15-tbody');
    const hoistedBox = this.container.querySelector('#top15-hoisted-box');
    const countBadge = this.container.querySelector('#top15-count-badge');
    const footerSummary = this.container.querySelector('#top15-footer-summary');
    if (!tbody) return;

    let conns = [...this.cachedConnections];
    const totalCount = conns.length;

    // Filter by search query
    if (this.searchQuery) {
      const q = this.searchQuery;
      conns = conns.filter(c =>
        (c.process && c.process.toLowerCase().includes(q)) ||
        (c.remoteHost && c.remoteHost.toLowerCase().includes(q)) ||
        (c.remoteIp && c.remoteIp.toLowerCase().includes(q)) ||
        (c.localIp && c.localIp.toLowerCase().includes(q)) ||
        (c.asn && c.asn.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q))
      );
    }

    // Sort connections
    if (this.sortBy === 'bandwidth') {
      conns.sort((a, b) => ((b.rxRate || 0) + (b.txRate || 0)) - ((a.rxRate || 0) + (a.txRate || 0)));
      if (footerSummary) footerSummary.textContent = 'Ranked by combined bandwidth (RX + TX)';
    } else if (this.sortBy === 'rtt') {
      conns.sort((a, b) => (b.rtt || 0) - (a.rtt || 0));
      if (footerSummary) footerSummary.textContent = 'Ranked by latency RTT (Highest first)';
    } else if (this.sortBy === 'retrans') {
      conns.sort((a, b) => (b.retrans || 0) - (a.retrans || 0));
      if (footerSummary) footerSummary.textContent = 'Ranked by TCP retransmissions';
    } else if (this.sortBy === 'process') {
      conns.sort((a, b) => (a.process || '').localeCompare(b.process || ''));
      if (footerSummary) footerSummary.textContent = 'Alphabetical by process name';
    }

    // Take top 15
    const top15 = conns.slice(0, 15);

    if (countBadge) {
      countBadge.textContent = `Showing Top ${top15.length} of ${totalCount} Sockets`;
    }

    if (top15.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No connections found matching "<em>${this.searchQuery}</em>"
          </td>
        </tr>
      `;
      if (hoistedBox) hoistedBox.style.display = 'none';
      return;
    }

    // Calculate maximum rate among the 15 to scale mini progress bars
    const maxTotalRate = Math.max(1, ...top15.map(c => (c.rxRate || 0) + (c.txRate || 0)));

    // Render Hoisted Socket Details if selected
    const selectedConn = this.selectedConnectionId
      ? this.cachedConnections.find(c => c.id === this.selectedConnectionId)
      : null;

    if (hoistedBox) {
      if (selectedConn) {
        hoistedBox.style.display = 'block';
        hoistedBox.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--brand); font-size: 14px;">${selectedConn.process}</strong>
              <span style="color: var(--text-muted);">PID: ${selectedConn.pid}</span>
              <span class="nw-chip ${(selectedConn.state || '').toLowerCase()}">${selectedConn.state}</span>
              <span>${selectedConn.flag || ''} ${selectedConn.remoteHost}:${selectedConn.remotePort}</span>
            </div>
            <button class="nw-btn" id="close-hoisted-btn" style="padding: 2px 8px; font-size: 11px;">✕ Close</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; font-size: 11px; margin-top: 8px;">
            <div><span style="color: var(--text-muted);">Local Endpoint:</span> <br><code>${selectedConn.localIp}:${selectedConn.localPort}</code></div>
            <div><span style="color: var(--text-muted);">Remote ASN:</span> <br><code>${selectedConn.asn || 'N/A'}</code></div>
            <div><span style="color: var(--text-muted);">RTT / RTTvar:</span> <br><strong style="color: ${selectedConn.rtt > 50 ? 'var(--status-error)' : 'var(--status-good)'};">${selectedConn.rtt.toFixed(1)} ms</strong> (±${selectedConn.rttvar || 0}ms)</div>
            <div><span style="color: var(--text-muted);">CWND / Ssthresh:</span> <br><code>${selectedConn.cwnd || 10} / ${selectedConn.ssthresh || 65535}</code></div>
            <div><span style="color: var(--text-muted);">RWND / MSS:</span> <br><code>${selectedConn.rwnd || 131072} / ${selectedConn.mss || 1460}</code></div>
            <div><span style="color: var(--text-muted);">Retransmissions:</span> <br><strong style="color: ${selectedConn.retrans > 0 ? 'var(--status-error)' : 'var(--text-primary)'};">${selectedConn.retrans || 0} pkts</strong></div>
          </div>
        `;
        const closeBtn = hoistedBox.querySelector('#close-hoisted-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectedConnectionId = null;
            this.renderTop15Table();
          });
        }
      } else {
        hoistedBox.style.display = 'none';
      }
    }

    tbody.innerHTML = top15.map((c, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
      const totalRate = (c.rxRate || 0) + (c.txRate || 0);
      const barPct = Math.min(100, Math.max(4, Math.round((totalRate / maxTotalRate) * 100)));
      const isSelected = this.selectedConnectionId === c.id;

      let rttColor = 'var(--status-good)';
      if (c.rtt > 100) rttColor = 'var(--status-error)';
      else if (c.rtt > 40) rttColor = 'var(--status-warn)';

      return `
        <tr class="clickable-row ${isSelected ? 'selected' : ''}" data-conn-id="${c.id}" title="Click to view deep TCP window and connection metrics">
          <td style="text-align: center;">
            <span class="nw-rank-badge ${rankClass}">#${rank}</span>
          </td>
          <td>
            <strong style="color: var(--brand); font-family: var(--font-mono);">${c.process || 'unknown'}</strong>
          </td>
          <td style="color: var(--text-muted); font-family: var(--font-mono);">${c.pid || '-'}</td>
          <td>
            <span style="font-size: 10px; color: var(--text-muted); margin-right: 4px;">${c.proto || 'TCP'}</span>
            <span class="nw-chip ${(c.state || '').toLowerCase()}">${c.state || 'ESTABLISHED'}</span>
          </td>
          <td style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">
            ${c.localIp}:${c.localPort}
          </td>
          <td>
            <span>${c.flag || '🌐'}</span>
            <strong style="margin-left: 4px; color: var(--text-primary);">${c.remoteHost || c.remoteIp}</strong>
            <span style="color: var(--text-muted); font-size: 11px;">:${c.remotePort}</span>
          </td>
          <td style="color: var(--text-muted); font-size: 11px; max-width: 160px; overflow: hidden; text-overflow: ellipsis;" title="${c.asn || ''}">
            ${c.asn || '-'}
          </td>
          <td style="color: ${rttColor}; font-weight: 600; font-family: var(--font-mono);">
            ${c.rtt ? c.rtt.toFixed(1) + ' ms' : '-'}
            ${c.retrans > 0 ? `<span style="color: var(--status-error); font-size: 10px; margin-left: 4px;" title="${c.retrans} retransmissions">⚠️ (${c.retrans})</span>` : ''}
          </td>
          <td style="color: var(--rx-rate); font-family: var(--font-mono); font-weight: 500;">
            ${this.formatSpeed(c.rxRate)}
          </td>
          <td style="color: var(--tx-rate); font-family: var(--font-mono); font-weight: 500;">
            ${this.formatSpeed(c.txRate)}
          </td>
          <td style="white-space: nowrap;">
            <strong style="color: var(--text-primary); font-family: var(--font-mono);">${this.formatSpeed(totalRate)}</strong>
            <div class="nw-mini-bar-container">
              <div class="nw-mini-bar-fill" style="width: ${barPct}%;"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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
