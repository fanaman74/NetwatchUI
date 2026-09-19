// NetWatch Egress Tab (Tab 0) - Outbound Drift Detection & Policy Promotion
import { telemetry } from '../../services/telemetry.js';

export class EgressTab {
  constructor(container) {
    this.container = container;
    this.lastEgress = null;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <div class="nw-panel-header" style="flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nw-panel-title">🛡️ Egress Policy & Drift Detection</span>
            <span id="drift-count-badge" class="nw-chip close_wait">0 Drift</span>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <!-- Strict Mode Toggle -->
            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="strict-mode-toggle" />
              <span>Strict Mode (Enforce Zero-Drift)</span>
            </label>

            <!-- Promoted Rules Counter -->
            <span id="promoted-count-badge" class="nw-key-badge">0 Promoted Rules</span>
          </div>
        </div>

        <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
          Monitors external destinations reached per process. New or unpromoted destinations trigger <code>drift</code> alerts.
          Press <strong>Promote</strong> on any destination to bless it into policy.
        </div>

        <!-- Egress Destinations Table -->
        <div class="nw-table-container">
          <table class="nw-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Destination Endpoint</th>
                <th>Autonomous System</th>
                <th>Geo</th>
                <th>Transferred (RX/TX)</th>
                <th>Verdict</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="egress-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    const strictToggle = this.container.querySelector('#strict-mode-toggle');
    strictToggle.addEventListener('change', async (e) => {
      await telemetry.toggleStrictEgress(e.target.checked);
    });
  }

  update(data) {
    if (!data || !data.egress) return;
    this.lastEgress = data.egress;

    const tbody = this.container.querySelector('#egress-tbody');
    const driftBadge = this.container.querySelector('#drift-count-badge');
    const promotedBadge = this.container.querySelector('#promoted-count-badge');
    const strictToggle = this.container.querySelector('#strict-mode-toggle');

    if (strictToggle && strictToggle.checked !== !!data.egress.strictMode) {
      strictToggle.checked = !!data.egress.strictMode;
    }

    if (driftBadge) {
      driftBadge.textContent = `${data.egress.driftCount} Drift Detected`;
      driftBadge.className = data.egress.driftCount > 0 ? 'nw-chip close_wait' : 'nw-chip established';
    }

    if (promotedBadge) {
      promotedBadge.textContent = `${data.egress.promotedCount} Active Rules`;
    }

    if (!tbody || !data.egress.items) return;

    tbody.innerHTML = data.egress.items.map(item => {
      const isPromoted = item.verdict === 'sni' || item.verdict === 'ip' || item.verdict === 'asn';
      return `
        <tr style="${item.isDrift ? 'background: rgba(248, 81, 73, 0.06);' : ''}">
          <td><strong style="color: var(--brand);">${item.process}</strong></td>
          <td><strong>${item.host}</strong>:${item.port}</td>
          <td style="font-size: 11px; color: var(--text-muted);">${item.asn}</td>
          <td>${item.country}</td>
          <td>▲ ${this.formatBytes(item.bytesIn)} · ▼ ${this.formatBytes(item.bytesOut)}</td>
          <td>
            <span class="nw-verdict ${item.verdict.replace(' ', '-')}">
              ${item.verdict.toUpperCase()}
            </span>
          </td>
          <td>
            ${!isPromoted ? `
              <button class="nw-btn" data-promote-proc="${item.process}" data-promote-pattern="${item.host}" style="padding: 2px 8px; font-size: 11px;">
                ➕ Promote to Rule
              </button>
            ` : `
              <span style="color: var(--status-good); font-size: 11px;">✓ Policy Verified</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    // Bind promote buttons
    tbody.querySelectorAll('button[data-promote-proc]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const proc = btn.getAttribute('data-promote-proc');
        const pattern = btn.getAttribute('data-promote-pattern');
        btn.disabled = true;
        btn.textContent = 'Promoted!';
        await telemetry.promoteEgress(proc, pattern, 'sni', 'Operator Promoted');
      });
    });
  }

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
