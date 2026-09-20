// NetWatch Interfaces Tab (Tab 3)
// Displays both Visitor PC Network Adapters and Cloud Host / Gateway Interfaces
import { telemetry } from '../../services/telemetry.js';
import { visitorNicScanner } from '../../services/visitorNicScanner.js';

export class InterfacesTab {
  constructor(container) {
    this.container = container;
    this.visitorScan = null;
    this.renderInitial();
    this.loadVisitorNics();
  }

  async loadVisitorNics() {
    try {
      this.visitorScan = await visitorNicScanner.scan();
      this.renderVisitorSection();
    } catch {
      // ignore
    }
  }

  renderInitial() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Visitor PC Adapters Section -->
        <div class="nw-panel" id="visitor-nics-panel">
          <div class="nw-panel-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">💻</span>
              <div>
                <div class="nw-panel-title">Visitor PC Network Adapters (Client Machine)</div>
                <div style="font-size: 11px; color: var(--text-muted);" id="visitor-host-label">
                  Scanning client PC physical interfaces &amp; WebRTC host candidates...
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="nw-btn" id="interfaces-rescan-visitor-btn" style="padding: 3px 8px; font-size: 11px;">
                🔄 Refresh PC
              </button>
              <button class="nw-btn active" id="interfaces-import-ipconfig-btn" style="padding: 3px 8px; font-size: 11px; background: rgba(0, 210, 255, 0.15); border-color: var(--brand); color: var(--brand); font-weight: 700;">
                📋 Import ipconfig
              </button>
            </div>
          </div>
          <div id="visitor-interfaces-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-top: 10px;"></div>
        </div>

        <!-- Cloud Host / Gateway Interfaces Section -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">☁️</span>
              <div>
                <div class="nw-panel-title">Backend Host &amp; Cloud Gateway Interfaces</div>
                <div style="font-size: 11px; color: var(--text-muted);">Real-time Container / Server Stack Health</div>
              </div>
            </div>
          </div>
          <div id="interfaces-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-top: 10px;"></div>
        </div>
      </div>
    `;

    // Event listeners
    this.container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-nic-select]');
      if (btn) {
        const nicName = btn.getAttribute('data-nic-select');
        if (nicName) {
          await telemetry.setSelectedInterface(nicName);
        }
      }

      const visitorBtn = e.target.closest('[data-visitor-nic-select]');
      if (visitorBtn) {
        const nicName = visitorBtn.getAttribute('data-visitor-nic-select');
        if (nicName) {
          visitorNicScanner.setActiveNic(nicName);
          await telemetry.setSelectedInterface(nicName);
          await this.loadVisitorNics();
        }
      }
    });

    const rescanBtn = this.container.querySelector('#interfaces-rescan-visitor-btn');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', async () => {
        rescanBtn.textContent = '⏳ Scanning...';
        await this.loadVisitorNics();
        rescanBtn.textContent = '✓ Updated!';
        setTimeout(() => { rescanBtn.textContent = '🔄 Refresh PC'; }, 2000);
      });
    }

    const importBtn = this.container.querySelector('#interfaces-import-ipconfig-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.showImportModal();
      });
    }
  }

  renderVisitorSection() {
    if (!this.visitorScan) return;
    const grid = this.container.querySelector('#visitor-interfaces-grid');
    const label = this.container.querySelector('#visitor-host-label');
    if (!grid) return;

    const adapters = this.visitorScan.adapters || [];
    const activeNic = this.visitorScan.activeNic || adapters[0];

    if (label) {
      label.textContent = `Host: ${this.visitorScan.hostName || 'fred-pc'} · ${adapters.length} Physical & Virtual Adapter(s) · Active: ${activeNic?.name}`;
    }

    grid.innerHTML = adapters.map(nic => {
      const isSelected = nic.name === activeNic?.name;
      const isOnline = nic.isUp;
      return `
        <div class="nw-panel" style="background: ${isSelected ? 'rgba(0, 210, 255, 0.05)' : 'var(--bg-panel-solid)'}; border: ${isSelected ? '2px solid var(--brand)' : '1px solid var(--border-color)'}; box-shadow: ${isSelected ? '0 0 10px rgba(0, 210, 255, 0.2)' : 'none'};">
          <div class="nw-panel-header" style="margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">${nic.icon}</span>
              <div>
                <strong style="color: ${isSelected ? 'var(--brand)' : 'var(--text-primary)'}; font-size: 13px;">${nic.name}</strong>
                <div style="font-size: 10px; color: var(--text-muted);">${nic.description}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span class="nw-chip ${isOnline ? 'established' : 'time_wait'}" style="font-size: 9px;">${nic.status.toUpperCase()}</span>
              <span class="nw-key-badge" style="font-size: 9px;">${nic.linkSpeed}</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv4:</span>
              <strong style="color: ${nic.ipv4 !== '-' ? 'var(--brand)' : 'var(--text-muted)'}; font-family: var(--font-mono);">${nic.ipv4}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">MAC Address:</span>
              <span style="font-family: var(--font-mono);">${nic.mac}</span>
            </div>
            ${nic.gateway && nic.gateway !== '-' ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Gateway:</span>
                <span style="font-family: var(--font-mono); color: var(--text-secondary);">${nic.gateway}</span>
              </div>
            ` : ''}
            ${nic.dns ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">DNS:</span>
                <span style="font-family: var(--font-mono); color: var(--text-secondary);">${nic.dns}</span>
              </div>
            ` : ''}

            <button 
              class="nw-btn ${isSelected ? 'active' : ''}" 
              data-visitor-nic-select="${nic.name}"
              style="margin-top: 6px; width: 100%; padding: 3px 6px; font-size: 10px; font-weight: 700; text-align: center; ${isSelected ? 'background: var(--brand); color: #000; border-color: var(--brand);' : ''}"
            >
              ${isSelected ? '★ Active Monitored Visitor Card' : 'Select as Monitored Card'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  showImportModal() {
    const modal = document.createElement('div');
    modal.className = 'nw-modal-overlay';
    modal.innerHTML = `
      <div class="nw-modal" style="max-width: 680px;">
        <div class="nw-modal-header">
          <span class="nw-panel-title">📋 Import Visitor PC Network Cards (ipconfig /all)</span>
          <button class="nw-btn" id="close-modal-btn">✖ Close</button>
        </div>
        <div class="nw-modal-body" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
            Paste your Windows <code>ipconfig /all</code> or PowerShell <code>Get-NetAdapter | ConvertTo-Json</code> output below to update your visitor PC's physical adapters and IP details.
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10px; color: var(--brand); font-weight: 700;">Terminal Output:</span>
            <button class="nw-btn" id="load-sample-btn" style="font-size: 10px; padding: 2px 8px; background: rgba(0, 210, 255, 0.1); border-color: var(--brand);">
              ⚡ Insert fred-pc Sample
            </button>
          </div>

          <textarea id="modal-ipconfig-input" style="width: 100%; height: 160px; font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.4); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; resize: vertical;" placeholder="Paste 'ipconfig /all' output from PowerShell or Command Prompt here..."></textarea>

          <div id="modal-parse-status" style="font-size: 11px; color: var(--text-muted); min-height: 18px;"></div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
            <button class="nw-btn" id="modal-cancel-btn">Cancel</button>
            <button class="nw-btn active" id="modal-apply-btn" style="font-weight: 700; background: var(--brand); color: #000;">
              ✓ Parse &amp; Apply Adapters
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#close-modal-btn');
    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    const applyBtn = modal.querySelector('#modal-apply-btn');
    const sampleBtn = modal.querySelector('#load-sample-btn');
    const textarea = modal.querySelector('#modal-ipconfig-input');
    const statusDiv = modal.querySelector('#modal-parse-status');

    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    sampleBtn.addEventListener('click', () => {
      textarea.value = `Windows IP Configuration

   Host Name . . . . . . . . . : fred-pc
   Primary Dns Suffix . . . . . : 
   Node Type . . . . . . . . . : Hybrid
   IP Routing Enabled. . . . . : No
   WINS Proxy Enabled. . . . . : No

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix . : localdomain
   Description . . . . . . . . . . . : Realtek PCIe GBE Family Controller
   Physical Address. . . . . . . . . : D4-5D-64-37-D3-4A
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes
   IPv6 Address. . . . . . . . . . . : fd1c:35f7:d7a4:2cd9:d0d4:26c:f32e:7052(Preferred)
   IPv4 Address. . . . . . . . . . . : 192.168.1.92(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1
   DNS Servers . . . . . . . . . . . : 192.168.1.1
                                       1.1.1.1

Ethernet adapter Bluetooth Network Connection:

   Media State . . . . . . . . . . . : Media disconnected
   Connection-specific DNS Suffix . : 
   Description . . . . . . . . . . . : Bluetooth Device (Personal Area Network)
   Physical Address. . . . . . . . . : 00-1A-7D-DA-71-15
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes`;
      statusDiv.textContent = 'Sample loaded. Click "Parse & Apply Adapters".';
      statusDiv.style.color = 'var(--brand)';
    });

    applyBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        statusDiv.textContent = 'Please paste your ipconfig text first.';
        statusDiv.style.color = 'var(--status-warn)';
        return;
      }

      const parsed = visitorNicScanner.parseIpconfig(text);
      if (!parsed || !parsed.adapters || parsed.adapters.length === 0) {
        statusDiv.textContent = 'Could not find any adapters in pasted text. Verify formatting.';
        statusDiv.style.color = 'var(--status-warn)';
        return;
      }

      visitorNicScanner.saveProfile({
        source: 'user_imported',
        hostName: parsed.hostName || 'fred-pc',
        adapters: parsed.adapters
      });

      statusDiv.textContent = `✓ Successfully parsed ${parsed.adapters.length} adapter(s)!`;
      statusDiv.style.color = 'var(--status-good)';

      await this.loadVisitorNics();

      setTimeout(() => {
        closeModal();
      }, 700);
    });
  }

  update(data) {
    if (!data || !data.interfaces) return;
    const grid = this.container.querySelector('#interfaces-grid');
    if (!grid) return;

    const ifaces = data.interfaces;
    const selectedIface = data.selectedInterface || (ifaces.find(i => i.selected)?.name) || ifaces[0]?.name;

    // Multi-NIC Quick Selector Banner for Cloud Host
    let bannerHtml = '';
    if (ifaces.length > 1) {
      bannerHtml = `
        <div style="grid-column: 1 / -1; background: rgba(0, 210, 255, 0.06); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⚡</span>
            <div>
              <strong style="color: var(--text-primary); font-size: 13px;">Backend Server Network Interfaces (${ifaces.length})</strong>
              <div style="color: var(--text-muted); font-size: 11px;">Active Cloud Adapter: <strong style="color: var(--brand);">${selectedIface}</strong></div>
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
              ${isSelected ? `<span class="nw-chip" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; font-size: 10px; font-weight: 800;">★ ACTIVE HOST CARD</span>` : ''}
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
              <strong style="color: var(--text-primary); font-family: var(--font-mono);">${iface.ipv4}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">IPv6 Address:</span>
              <span style="color: var(--text-secondary); font-size: 11px; font-family: var(--font-mono);">${iface.ipv6 || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">MAC Address:</span>
              <span style="font-family: var(--font-mono);">${iface.mac || '-'}</span>
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
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
