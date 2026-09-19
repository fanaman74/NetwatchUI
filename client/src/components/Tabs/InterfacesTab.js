// NetWatch Interfaces Tab (Tab 3)
import { telemetry } from '../../services/telemetry.js';

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

    this.container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-nic-select]');
      if (btn) {
        const nicName = btn.getAttribute('data-nic-select');
        if (nicName) {
          await telemetry.setSelectedInterface(nicName);
        }
      }
    });
  }

  update(data) {
    if (!data || !data.interfaces) return;
    const grid = this.container.querySelector('#interfaces-grid');
    if (!grid) return;

    const ifaces = data.interfaces;
    const selectedIface = data.selectedInterface || (ifaces.find(i => i.selected)?.name) || ifaces[0]?.name;

    // Multi-NIC Quick Selector Banner
    let bannerHtml = '';
    if (ifaces.length > 1) {
      bannerHtml = `
        <div style="grid-column: 1 / -1; background: rgba(0, 210, 255, 0.06); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⚡</span>
            <div>
              <strong style="color: var(--text-primary); font-size: 13px;">Multiple Network Interfaces Detected (${ifaces.length})</strong>
              <div style="color: var(--text-muted); font-size: 11px;">Active Monitored Card: <strong style="color: var(--brand);">${selectedIface}</strong> — select a card below to switch:</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${ifaces.map(i => {
              const isSel = i.name === selectedIface;
              const typeIcon = i.type === 'Wi-Fi' ? '📶' : (i.type === 'Loopback' ? '🔄' : '🔌');
              return `
                <button 
                  class="nw-btn ${isSel ? 'active' : ''}" 
                  data-nic-select="${i.name}"
                  style="padding: 4px 10px; font-size: 11px; font-weight: 700; ${isSel ? 'background: var(--brand); color: #000; border-color: var(--brand); box-shadow: 0 0 8px rgba(0, 210, 255, 0.3);' : 'background: var(--bg-panel-solid); border: 1px solid var(--border-color);'}"
                  title="Switch NetWatch to monitor ${i.name}"
                >
                  ${typeIcon} ${i.name} ${isSel ? '✓' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    grid.innerHTML = bannerHtml + ifaces.map(iface => {
      const isSelected = iface.name === selectedIface;
      const hasErrors = iface.rxErrors > 0 || iface.txErrors > 0 || iface.rxDrops > 0;
      return `
        <div class="nw-panel" style="background: ${isSelected ? 'rgba(0, 255, 150, 0.03)' : 'var(--bg-panel-solid)'}; border: ${isSelected ? '2px solid var(--brand)' : (hasErrors ? '1px solid var(--status-warn)' : '1px solid var(--border-color)')}; box-shadow: ${isSelected ? '0 0 12px rgba(0, 210, 255, 0.15)' : 'none'}; position: relative; transition: all 0.2s ease;">
          <div class="nw-panel-header" style="margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: ${isSelected ? 'var(--brand)' : 'var(--text-primary)'}; font-size: 14px;">${iface.name}</strong>
              <span class="nw-key-badge">${iface.type}</span>
              ${isSelected ? `<span class="nw-chip" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; font-size: 10px; font-weight: 800;">★ ACTIVE CARD</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="nw-chip established">${iface.status}</span>
              ${!isSelected ? `
                <button 
                  class="nw-btn" 
                  data-nic-select="${iface.name}"
                  style="padding: 2px 8px; font-size: 10px; font-weight: 700; background: var(--bg-canvas); border: 1px solid var(--border-color); cursor: pointer;"
                  title="Select ${iface.name} as active network card"
                >
                  Use This Card
                </button>
              ` : ''}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv4 Address:</span>
              <strong style="color: var(--text-primary);">${iface.ipv4}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv6 Address:</span>
              <span style="color: var(--text-secondary); font-size: 11px;">${iface.ipv6 || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">MAC Address:</span>
              <span>${iface.mac || '-'}</span>
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
                RX/TX Errors: ${iface.rxErrors || 0} / ${iface.txErrors || 0}
              </span>
              <span style="color: ${iface.rxDrops > 0 ? 'var(--status-warn)' : 'var(--text-muted)'};">
                RX/TX Drops: ${iface.rxDrops || 0} / ${iface.txDrops || 0}
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
