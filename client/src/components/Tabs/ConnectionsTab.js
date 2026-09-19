// NetWatch Connections Tab (Tab 2)

export class ConnectionsTab {
  constructor(container) {
    this.container = container;
    this.stateFilter = 'ALL';
    this.groupBy = 'NONE';
    this.searchQuery = '';
    this.selectedConnectionId = null;
    this.lastConnections = [];

    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <!-- Controls & Filter Toolbar -->
        <div class="nw-panel-header" style="flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nw-panel-title">🌐 Active Socket Connections</span>
            <span id="conn-count-badge" class="nw-chip established">0 Active</span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Search Filter -->
            <div style="display: flex; align-items: center; position: relative;">
              <input type="text" id="conn-search-input" class="nw-select" placeholder="Filter process/host ( / )" style="width: 200px;" />
              <span class="nw-key-badge" style="position: absolute; right: 6px;">/</span>
            </div>

            <!-- State Filter Chips -->
            <div id="state-filter-chips" style="display: flex; gap: 4px;">
              <button class="nw-btn active" data-state="ALL">ALL</button>
              <button class="nw-btn" data-state="ESTABLISHED">ESTABLISHED</button>
              <button class="nw-btn" data-state="LISTEN">LISTEN</button>
              <button class="nw-btn" data-state="TIME_WAIT">TIME_WAIT</button>
            </div>

            <!-- Grouping Selector -->
            <select id="conn-group-select" class="nw-select">
              <option value="NONE">Group: None</option>
              <option value="PROCESS">Group: Process</option>
              <option value="HOST">Group: Host</option>
            </select>
          </div>
        </div>

        <!-- Selected Connection Hoisted Details (like NetWatch Dense/Conns) -->
        <div id="hoisted-socket-box" style="display: none; background: rgba(0,210,255,0.06); border: 1px solid var(--brand); border-radius: 4px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px;"></div>

        <!-- Sockets Table -->
        <div class="nw-table-container">
          <table class="nw-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>PID</th>
                <th>Proto</th>
                <th>Local Address</th>
                <th>Remote Endpoint</th>
                <th>ASN / Geo</th>
                <th>State</th>
                <th>RTT</th>
                <th>Retrans</th>
                <th>cwnd</th>
                <th>RX / TX Rate</th>
              </tr>
            </thead>
            <tbody id="connections-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    // Bind event listeners
    const searchInput = this.container.querySelector('#conn-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTable();
    });

    const filterChips = this.container.querySelectorAll('#state-filter-chips button');
    filterChips.forEach(btn => {
      btn.addEventListener('click', () => {
        filterChips.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.stateFilter = btn.getAttribute('data-state');
        this.renderTable();
      });
    });

    const groupSelect = this.container.querySelector('#conn-group-select');
    groupSelect.addEventListener('change', (e) => {
      this.groupBy = e.target.value;
      this.renderTable();
    });
  }

  update(data) {
    if (!data || !data.connections) return;
    this.lastConnections = data.connections;

    // Default select first connection if none selected
    if (!this.selectedConnectionId && this.lastConnections.length > 0) {
      this.selectedConnectionId = this.lastConnections[0].id;
    }

    this.renderTable();
  }

  renderTable() {
    const tbody = this.container.querySelector('#connections-tbody');
    const badge = this.container.querySelector('#conn-count-badge');
    if (!tbody) return;

    let list = this.lastConnections;

    // 1. Filter by State
    if (this.stateFilter !== 'ALL') {
      list = list.filter(c => c.state === this.stateFilter);
    }

    // 2. Filter by search query
    if (this.searchQuery) {
      list = list.filter(c =>
        c.process.toLowerCase().includes(this.searchQuery) ||
        c.remoteHost.toLowerCase().includes(this.searchQuery) ||
        c.remoteIp.toLowerCase().includes(this.searchQuery) ||
        String(c.pid).includes(this.searchQuery)
      );
    }

    if (badge) badge.textContent = `${list.length} Sockets`;

    // Render hoisted box for selected connection
    const selectedConn = this.lastConnections.find(c => c.id === this.selectedConnectionId);
    this.renderHoistedDetails(selectedConn);

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 20px;">No sockets match current filter.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(c => {
      const isSelected = c.id === this.selectedConnectionId;
      return `
        <tr class="${isSelected ? 'selected' : ''}" data-conn-id="${c.id}">
          <td><strong style="color: var(--brand);">${c.process}</strong></td>
          <td style="color: var(--text-muted);">${c.pid}</td>
          <td><span style="color: ${c.proto === 'UDP' ? 'var(--proto-udp)' : 'var(--text-primary)'};">${c.proto}</span></td>
          <td>${c.localIp}:${c.localPort}</td>
          <td>${c.flag || '🌐'} <strong>${c.remoteHost}</strong>:${c.remotePort}</td>
          <td style="font-size: 11px; color: var(--text-muted);">${c.asn || '-'}</td>
          <td><span class="nw-chip ${c.state.toLowerCase()}">${c.state}</span></td>
          <td style="color: ${c.rtt > 50 ? 'var(--status-error)' : 'var(--status-good)'}; font-weight: 600;">
            ${c.rtt ? c.rtt.toFixed(1) + ' ms' : '-'}
          </td>
          <td style="color: ${c.retrans > 0 ? 'var(--status-error)' : 'var(--text-muted)'};">${c.retrans || 0}</td>
          <td>${c.cwnd || '-'}</td>
          <td>▲ ${this.formatSpeed(c.rxRate)} · ▼ ${this.formatSpeed(c.txRate)}</td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to rows
    tbody.querySelectorAll('tr[data-conn-id]').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedConnectionId = parseInt(row.getAttribute('data-conn-id'), 10);
        this.renderTable();
      });
    });
  }

  renderHoistedDetails(conn) {
    const box = this.container.querySelector('#hoisted-socket-box');
    if (!box) return;

    if (!conn) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'block';
    box.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <div>
          <span style="color: var(--key-hint); font-size: 10px; text-transform: uppercase;">SELECTED SOCKET INSPECTION</span>
          <h4 style="color: var(--text-primary); font-size: 14px; margin-top: 2px;">
            ${conn.flag} ${conn.process} (PID ${conn.pid}) ➔ ${conn.remoteHost}:${conn.remotePort} (${conn.remoteIp})
          </h4>
        </div>
        <span class="nw-chip ${conn.state.toLowerCase()}">${conn.state}</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 8px;">
        <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
          <span style="color: var(--text-muted); font-size: 10px;">TCP CWND / SSTHRESH</span>
          <div><strong>${conn.cwnd || 10} pkts</strong> / ${conn.ssthresh || '65535'}</div>
        </div>
        <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
          <span style="color: var(--text-muted); font-size: 10px;">RWND / MSS</span>
          <div><strong>${conn.rwnd || 131072} B</strong> / ${conn.mss || 1460} B</div>
        </div>
        <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
          <span style="color: var(--text-muted); font-size: 10px;">SMOOTHED RTT / VAR</span>
          <div style="color: ${conn.rtt > 50 ? 'var(--status-error)' : 'var(--status-good)'};">
            <strong>${conn.rtt ? conn.rtt.toFixed(1) : '-'} ms</strong> (±${conn.rttvar || 1.0}ms)
          </div>
        </div>
        <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
          <span style="color: var(--text-muted); font-size: 10px;">RETRANSMISSIONS</span>
          <div style="color: ${conn.retrans > 0 ? 'var(--status-error)' : 'var(--status-good)'};">
            <strong>${conn.retrans || 0} segments</strong>
          </div>
        </div>
        <div style="background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;">
          <span style="color: var(--text-muted); font-size: 10px;">AUTONOMOUS SYSTEM</span>
          <div><strong>${conn.asn || 'AS-TRANSIT'}</strong></div>
        </div>
      </div>
    `;
  }

  formatSpeed(bps) {
    if (!bps) return '0 B/s';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
    return bps + ' B/s';
  }
}
