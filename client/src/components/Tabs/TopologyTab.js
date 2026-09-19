// NetWatch Topology Tab (Tab 6) - Network Graph & Traceroute Hop Map

export class TopologyTab {
  constructor(container) {
    this.container = container;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Visual Node Topology Graph -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <span class="nw-panel-title">🗺️ Network Node Topology</span>
            <span style="font-size: 11px; color: var(--text-muted);">Host ➔ Gateway ➔ Resolver ➔ Autonomous Systems</span>
          </div>

          <div id="topology-nodes" style="display: flex; align-items: center; justify-content: space-around; padding: 25px 10px; background: rgba(0,0,0,0.2); border-radius: 8px; position: relative;"></div>
        </div>

        <!-- Traceroute Hop Path Table -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <span class="nw-panel-title">🧭 Traceroute Hop Breakdown (Path to 1.1.1.1)</span>
            <span style="font-size: 11px; color: var(--text-muted);">Hop-by-hop Latency & Transit Reroute Detection</span>
          </div>

          <div class="nw-table-container">
            <table class="nw-table">
              <thead>
                <tr>
                  <th>Hop #</th>
                  <th>IP Address</th>
                  <th>Autonomous System</th>
                  <th>Round Trip Time (p50)</th>
                  <th>Packet Loss</th>
                  <th>Path Verdict</th>
                </tr>
              </thead>
              <tbody id="hops-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  update(data) {
    if (!data || !data.topology) return;
    const topo = data.topology;

    // 1. Render Visual Nodes
    const nodesContainer = this.container.querySelector('#topology-nodes');
    if (nodesContainer) {
      nodesContainer.innerHTML = `
        <!-- Local Host -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; z-index: 2;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(0, 210, 255, 0.15); border: 2px solid var(--brand); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 0 15px var(--brand-glow);">
            💻
          </div>
          <strong style="margin-top: 8px; color: var(--brand);">${topo.localHost.name}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${topo.localHost.ip}</span>
        </div>

        <div style="flex: 1; height: 2px; background: var(--border-color); margin: 0 10px; position: relative;">
          <span style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--text-muted);">LAN</span>
        </div>

        <!-- Default Gateway -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; z-index: 2;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(63, 185, 80, 0.15); border: 2px solid var(--status-good); display: flex; align-items: center; justify-content: center; font-size: 24px;">
            📡
          </div>
          <strong style="margin-top: 8px;">Gateway</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${topo.gateway.ip} (${topo.gateway.rtt.toFixed(1)}ms)</span>
        </div>

        <div style="flex: 1; height: 2px; background: var(--border-color); margin: 0 10px; position: relative;">
          <span style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--text-muted);">ISP TRANSIT</span>
        </div>

        <!-- DNS Resolver -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; z-index: 2;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: ${topo.dns.status === 'DEGRADED' ? 'rgba(248, 81, 73, 0.18)' : 'rgba(63, 185, 80, 0.15)'}; border: 2px solid ${topo.dns.status === 'DEGRADED' ? 'var(--status-error)' : 'var(--status-good)'}; display: flex; align-items: center; justify-content: center; font-size: 24px;">
            🔍
          </div>
          <strong style="margin-top: 8px; color: ${topo.dns.status === 'DEGRADED' ? 'var(--status-error)' : 'var(--text-primary)'};">
            DNS Resolver ${topo.dns.status === 'DEGRADED' ? '(DEGRADED)' : ''}
          </strong>
          <span style="font-size: 11px; color: var(--text-muted);">${topo.dns.ip} (${topo.dns.rtt.toFixed(1)}ms)</span>
        </div>

        <div style="flex: 1; height: 2px; background: var(--border-color); margin: 0 10px; position: relative;">
          <span style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: var(--text-muted);">WAN / WAN</span>
        </div>

        <!-- Cloudflare / Target -->
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; z-index: 2;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(88, 166, 255, 0.15); border: 2px solid var(--status-info); display: flex; align-items: center; justify-content: center; font-size: 24px;">
            ☁️
          </div>
          <strong style="margin-top: 8px;">Cloudflare 1.1.1.1</strong>
          <span style="font-size: 11px; color: var(--text-muted);">AS13335 (Anycast)</span>
        </div>
      `;
    }

    // 2. Render Hop Table
    const hopsTbody = this.container.querySelector('#hops-tbody');
    if (hopsTbody && topo.hops) {
      hopsTbody.innerHTML = topo.hops.map(h => {
        const isRerouted = h.note && h.note.includes('Rerouted');
        return `
          <tr style="${isRerouted ? 'background: rgba(210, 153, 34, 0.08);' : ''}">
            <td><strong>#${h.hop}</strong></td>
            <td style="font-family: var(--font-mono); font-weight: 600;">${h.ip}</td>
            <td><span class="nw-key-badge">${h.asn}</span></td>
            <td style="color: ${h.rtt > 40 ? 'var(--status-warn)' : 'var(--text-primary)'}; font-weight: 600;">
              ${h.rtt.toFixed(1)} ms
            </td>
            <td>${h.loss}%</td>
            <td>
              ${isRerouted ? `
                <span class="nw-deviation-tag warn">⚠️ ${h.note}</span>
              ` : `
                <span class="nw-deviation-tag good">Optimal</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}
