// NetWatch Lite View Mode (80x24 Compact Terminal View)

export class LiteView {
  constructor(container) {
    this.container = container;
    this.filterText = '';
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-lite-container">
        <!-- Terminal Header Banner -->
        <div style="border-bottom: 1px dashed var(--border-color); padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: var(--brand);">NETWATCH LITE v0.30</strong>
            <span style="color: var(--text-muted); margin-left: 8px;">(80x24 Terminal Mode)</span>
          </div>
          <input type="text" id="lite-filter" class="nw-select" placeholder="Filter: /" style="width: 140px; padding: 2px 6px; font-size: 11px;" />
        </div>

        <!-- Metric Rates -->
        <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px dashed var(--border-subtle);">
          <div>
            <span style="color: var(--text-muted);">Throughput:</span>
            <strong id="lite-rx" style="color: var(--rx-rate); margin-left: 6px;">▲ 0 B/s</strong>
            <strong id="lite-tx" style="color: var(--tx-rate); margin-left: 8px;">▼ 0 B/s</strong>
          </div>
          <div id="lite-reachability">
            <span style="color: var(--status-good);">GW: OK</span> ·
            <span id="lite-dns-status" style="color: var(--status-good);">DNS: OK</span> ·
            <span style="color: var(--status-good);">WAN: OK</span>
          </div>
        </div>

        <!-- Active Talkers -->
        <div style="margin-top: 6px;">
          <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 4px;">ACTIVE TALKERS:</div>
          <div id="lite-talkers-list" style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;"></div>
        </div>

        <!-- Terminal Footer -->
        <div style="margin-top: 10px; border-top: 1px dashed var(--border-subtle); padding-top: 6px; font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between;">
          <span>Keys: [V] Switch View · [1-0] Full Tabs · [P] Pause · [?] Help</span>
          <span>NetWatch Web</span>
        </div>
      </div>
    `;

    const filter = this.container.querySelector('#lite-filter');
    filter.addEventListener('input', (e) => {
      this.filterText = e.target.value.toLowerCase();
      this.renderTalkers(this.lastConns || []);
    });
  }

  update(data) {
    if (!data) return;

    // Rates
    const rx = this.container.querySelector('#lite-rx');
    const tx = this.container.querySelector('#lite-tx');
    if (rx && data.throughput) rx.textContent = `▲ ${this.formatSpeed(data.throughput.rx)}`;
    if (tx && data.throughput) tx.textContent = `▼ ${this.formatSpeed(data.throughput.tx)}`;

    // Reachability
    const dnsStatus = this.container.querySelector('#lite-dns-status');
    if (dnsStatus && data.kpis && data.kpis.dns) {
      if (data.kpis.dns.status === 'error') {
        dnsStatus.textContent = 'DNS: ERR (33×)';
        dnsStatus.style.color = 'var(--status-error)';
      } else {
        dnsStatus.textContent = 'DNS: OK';
        dnsStatus.style.color = 'var(--status-good)';
      }
    }

    this.lastConns = data.connections || [];
    this.renderTalkers(this.lastConns);
  }

  renderTalkers(conns) {
    const list = this.container.querySelector('#lite-talkers-list');
    if (!list) return;

    let filtered = conns;
    if (this.filterText) {
      filtered = filtered.filter(c => c.process.toLowerCase().includes(this.filterText) || c.remoteHost.toLowerCase().includes(this.filterText));
    }

    list.innerHTML = filtered.slice(0, 10).map(c => `
      <div style="display: flex; justify-content: space-between; padding: 3px 6px; background: rgba(255,255,255,0.02); border-radius: 2px;">
        <div>
          <strong style="color: var(--brand);">${c.process.padEnd(12)}</strong>
          <span>${c.remoteHost}:${c.remotePort}</span>
        </div>
        <div>
          <span style="color: var(--rx-rate); margin-right: 8px;">▲ ${this.formatSpeed(c.rxRate)}</span>
          <span style="color: ${c.rtt > 50 ? 'var(--status-error)' : 'var(--text-muted)'};">${c.rtt ? c.rtt.toFixed(0) + 'ms' : '-'}</span>
        </div>
      </div>
    `).join('');
  }

  formatSpeed(bps) {
    if (!bps) return '0 B/s';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
    return bps + ' B/s';
  }
}
