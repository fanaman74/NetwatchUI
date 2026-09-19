// NetWatch Interfaces Tab (Tab 3)

export class InterfacesTab {
  constructor(container) {
    this.container = container;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <div class="nw-panel-header">
          <div class="nw-panel-title">🔌 Network Interface Adapters</div>
          <span style="font-size: 11px; color: var(--text-muted);">Real-time Adapter Statistics & Health</span>
        </div>
        <div id="interfaces-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px;"></div>
      </div>
    `;
  }

  update(data) {
    if (!data || !data.interfaces) return;
    const grid = this.container.querySelector('#interfaces-grid');
    if (!grid) return;

    grid.innerHTML = data.interfaces.map(iface => {
      const hasErrors = iface.rxErrors > 0 || iface.txErrors > 0 || iface.rxDrops > 0;
      return `
        <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid ${hasErrors ? 'var(--status-warn)' : 'var(--border-color)'};">
          <div class="nw-panel-header" style="margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: var(--brand); font-size: 14px;">${iface.name}</strong>
              <span class="nw-key-badge">${iface.type}</span>
            </div>
            <span class="nw-chip established">${iface.status}</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv4 Address:</span>
              <strong style="color: var(--text-primary);">${iface.ipv4}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv6 Address:</span>
              <span style="color: var(--text-secondary); font-size: 11px;">${iface.ipv6}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">MAC Address:</span>
              <span>${iface.mac}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">MTU:</span>
              <span>${iface.mtu} bytes</span>
            </div>

            <!-- Rates -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 4px;">
              <div>
                <span style="color: var(--rx-rate); font-size: 10px; font-weight: 600;">▲ RX RATE</span>
                <div style="font-size: 16px; font-weight: 700; color: var(--rx-rate);">${this.formatSpeed(iface.rxRate)}</div>
                <span style="color: var(--text-muted); font-size: 10px;">Total: ${this.formatBytes(iface.rxBytes)}</span>
              </div>
              <div>
                <span style="color: var(--tx-rate); font-size: 10px; font-weight: 600;">▼ TX RATE</span>
                <div style="font-size: 16px; font-weight: 700; color: var(--tx-rate);">${this.formatSpeed(iface.txRate)}</div>
                <span style="color: var(--text-muted); font-size: 10px;">Total: ${this.formatBytes(iface.txBytes)}</span>
              </div>
            </div>

            <!-- Error & Drops -->
            <div style="display: flex; justify-content: space-between; font-size: 11px; padding-top: 6px; border-top: 1px solid var(--border-subtle);">
              <span style="color: ${iface.rxErrors > 0 ? 'var(--status-error)' : 'var(--text-muted)'};">
                RX/TX Errors: ${iface.rxErrors} / ${iface.txErrors}
              </span>
              <span style="color: ${iface.rxDrops > 0 ? 'var(--status-warn)' : 'var(--text-muted)'};">
                RX/TX Drops: ${iface.rxDrops} / ${iface.txDrops}
              </span>
            </div>
          </div>
        </div>
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
