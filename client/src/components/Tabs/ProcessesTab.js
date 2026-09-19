// NetWatch Processes Tab (Tab 8) - Bandwidth Per Process

export class ProcessesTab {
  constructor(container) {
    this.container = container;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <div class="nw-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nw-panel-title">⚙️ Process Network Attribution & Bandwidth</span>
            <span class="nw-chip established">Per-Process I/O</span>
          </div>
        </div>

        <div class="nw-table-container">
          <table class="nw-table">
            <thead>
              <tr>
                <th>Process Name</th>
                <th>PID</th>
                <th>Active Sockets</th>
                <th>Download Rate (RX)</th>
                <th>Upload Rate (TX)</th>
                <th>Total Transferred</th>
              </tr>
            </thead>
            <tbody id="processes-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  }

  update(data) {
    if (!data || !data.processes) return;
    const tbody = this.container.querySelector('#processes-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.processes.map(p => `
      <tr>
        <td><strong style="color: var(--brand);">${p.name}</strong></td>
        <td style="color: var(--text-muted);">${p.pid}</td>
        <td><span class="nw-key-badge">${p.sockets} sockets</span></td>
        <td style="color: var(--rx-rate); font-weight: 600;">▲ ${this.formatSpeed(p.rxRate)}</td>
        <td style="color: var(--tx-rate); font-weight: 600;">▼ ${this.formatSpeed(p.txRate)}</td>
        <td>${this.formatBytes(p.totalBytes)}</td>
      </tr>
    `).join('');
  }

  formatSpeed(bps) {
    if (!bps) return '0 B/s';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
    return bps + ' B/s';
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
