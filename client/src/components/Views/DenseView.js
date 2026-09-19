// NetWatch Dense View Mode (4-Quadrant Command Center Layout)
import { MirroredGraph } from '../MirroredGraph.js';

export class DenseView {
  constructor(container) {
    this.container = container;
    this.zoomedBox = null; // 1, 2, 3, 4 or null
    this.graph = null;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-dense-grid" id="dense-grid">
        <!-- Box 1: Mirrored Throughput Graph -->
        <div class="nw-dense-box" id="dense-box-1">
          <div class="nw-dense-box-header">
            <span class="nw-panel-title">1: Throughput (Mirrored Canvas)</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span id="dense-rx-tx-rates" style="font-size: 11px;">▲ 0 B/s · ▼ 0 B/s</span>
              <button class="nw-zoom-btn" data-zoom="1">Zoom [1]</button>
            </div>
          </div>
          <div style="flex: 1; position: relative;">
            <canvas id="dense-canvas" class="nw-mirrored-canvas" style="width: 100%; height: 100%;"></canvas>
          </div>
        </div>

        <!-- Box 2: Latency Budget & Link Status -->
        <div class="nw-dense-box" id="dense-box-2">
          <div class="nw-dense-box-header">
            <span class="nw-panel-title">2: Latency Budget & Link</span>
            <button class="nw-zoom-btn" data-zoom="2">Zoom [2]</button>
          </div>
          <div id="dense-latency-list" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; overflow-y: auto;"></div>
        </div>

        <!-- Box 3: Active Interfaces & Status -->
        <div class="nw-dense-box" id="dense-box-3">
          <div class="nw-dense-box-header">
            <span class="nw-panel-title">3: Network Interfaces</span>
            <button class="nw-zoom-btn" data-zoom="3">Zoom [3]</button>
          </div>
          <div id="dense-ifaces-list" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; overflow-y: auto;"></div>
        </div>

        <!-- Box 4: Connections & Hoisted TCP State -->
        <div class="nw-dense-box" id="dense-box-4">
          <div class="nw-dense-box-header">
            <span class="nw-panel-title">4: Connections (Hoisted Socket Detail)</span>
            <button class="nw-zoom-btn" data-zoom="4">Zoom [4]</button>
          </div>
          <!-- Hoisted kernel TCP stats -->
          <div id="dense-hoisted-tcp" style="background: rgba(0,210,255,0.06); border-bottom: 1px solid var(--border-color); padding: 6px 10px; font-size: 11px; margin-bottom: 6px;"></div>
          <!-- Mini table -->
          <div class="nw-table-container" style="flex: 1; overflow-y: auto;">
            <table class="nw-table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Remote Host</th>
                  <th>State</th>
                  <th>RTT</th>
                </tr>
              </thead>
              <tbody id="dense-conns-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector('#dense-canvas');
    this.graph = new MirroredGraph(canvas);

    // Bind zoom buttons
    this.container.querySelectorAll('button[data-zoom]').forEach(btn => {
      btn.addEventListener('click', () => {
        const boxId = parseInt(btn.getAttribute('data-zoom'), 10);
        this.toggleZoom(boxId);
      });
    });
  }

  toggleZoom(boxId) {
    const grid = this.container.querySelector('#dense-grid');
    const boxes = this.container.querySelectorAll('.nw-dense-box');

    if (this.zoomedBox === boxId) {
      // Unzoom
      this.zoomedBox = null;
      boxes.forEach(b => {
        b.classList.remove('zoomed');
        b.style.display = 'flex';
      });
    } else {
      // Zoom this box
      this.zoomedBox = boxId;
      boxes.forEach((b, idx) => {
        if (idx + 1 === boxId) {
          b.classList.add('zoomed');
          b.style.display = 'flex';
        } else {
          b.classList.remove('zoomed');
          b.style.display = 'none';
        }
      });
    }

    if (this.graph) {
      setTimeout(() => this.graph.resize(), 50);
    }
  }

  update(data) {
    if (!data) return;

    // 1. Throughput
    if (this.graph && data.throughput) {
      this.graph.update(data.throughput.history);
      const ratesLabel = this.container.querySelector('#dense-rx-tx-rates');
      if (ratesLabel) {
        ratesLabel.innerHTML = `<span style="color: var(--rx-rate);">▲ ${this.formatSpeed(data.throughput.rx)}</span> · <span style="color: var(--tx-rate);">▼ ${this.formatSpeed(data.throughput.tx)}</span>`;
      }
    }

    // 2. Latency Budget
    const latencyList = this.container.querySelector('#dense-latency-list');
    if (latencyList && data.kpis) {
      latencyList.innerHTML = Object.entries(data.kpis).map(([k, kpi]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
          <div>
            <strong>${kpi.label}</strong>
            <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">(${kpi.subject})</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: ${kpi.status === 'error' ? 'var(--status-error)' : (kpi.status === 'warn' ? 'var(--status-warn)' : 'var(--status-good)')};">
              ${typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value} ${kpi.unit}
            </strong>
            <span class="nw-deviation-tag ${kpi.status === 'error' ? 'error' : 'good'}">${kpi.deviation}</span>
          </div>
        </div>
      `).join('');
    }

    // 3. Interfaces
    const ifacesList = this.container.querySelector('#dense-ifaces-list');
    if (ifacesList && data.interfaces) {
      ifacesList.innerHTML = data.interfaces.map(i => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
          <div>
            <strong style="color: var(--brand);">${i.name}</strong>
            <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">${i.ipv4}</span>
          </div>
          <div style="font-size: 11px;">
            <span style="color: var(--rx-rate);">▲ ${this.formatSpeed(i.rxRate)}</span>
            <span style="color: var(--tx-rate); margin-left: 4px;">▼ ${this.formatSpeed(i.txRate)}</span>
          </div>
        </div>
      `).join('');
    }

    // 4. Connections & Hoisted Details
    const connsTbody = this.container.querySelector('#dense-conns-tbody');
    const hoistedBox = this.container.querySelector('#dense-hoisted-tcp');

    if (data.connections && data.connections[0] && hoistedBox) {
      const topConn = data.connections[0];
      hoistedBox.innerHTML = `
        <strong>${topConn.process} (PID ${topConn.pid}) ➔ ${topConn.remoteHost}:${topConn.remotePort}</strong>
        <div style="display: flex; gap: 10px; margin-top: 2px; color: var(--text-muted); font-size: 10px;">
          <span>cwnd: <strong style="color: var(--text-primary);">${topConn.cwnd || 10}</strong></span>
          <span>ssthresh: <strong style="color: var(--text-primary);">${topConn.ssthresh || '65535'}</strong></span>
          <span>rwnd: <strong style="color: var(--text-primary);">${topConn.rwnd || '131072'}</strong></span>
          <span>rtt: <strong style="color: var(--brand);">${topConn.rtt ? topConn.rtt.toFixed(1) : '-'}ms</strong></span>
        </div>
      `;
    }

    if (connsTbody && data.connections) {
      connsTbody.innerHTML = data.connections.slice(0, 10).map(c => `
        <tr>
          <td><strong style="color: var(--brand);">${c.process}</strong></td>
          <td>${c.flag || ''} ${c.remoteHost}</td>
          <td><span class="nw-chip ${c.state.toLowerCase()}">${c.state}</span></td>
          <td>${c.rtt ? c.rtt.toFixed(1) + 'ms' : '-'}</td>
        </tr>
      `).join('');
    }
  }

  formatSpeed(bps) {
    if (!bps) return '0 B/s';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
    return bps + ' B/s';
  }
}
