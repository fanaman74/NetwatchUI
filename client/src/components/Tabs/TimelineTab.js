// NetWatch Timeline Tab (Tab 7) - TCP States & Incident Alert Timeline

export class TimelineTab {
  constructor(container) {
    this.container = container;
    this.severityFilter = 'ALL';
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <div class="nw-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nw-panel-title">⏳ Connection & Threat Incident Timeline</span>
            <span class="nw-chip established">Chronological Log</span>
          </div>

          <div id="timeline-filters" style="display: flex; gap: 6px;">
            <button class="nw-btn active" data-filter="ALL">ALL</button>
            <button class="nw-btn" data-filter="critical">CRITICAL</button>
            <button class="nw-btn" data-filter="warning">WARNING</button>
          </div>
        </div>

        <div id="timeline-list" style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;"></div>
      </div>
    `;

    const btns = this.container.querySelectorAll('#timeline-filters button');
    btns.forEach(b => {
      b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.severityFilter = b.getAttribute('data-filter');
        this.renderEvents(this.lastAlerts || []);
      });
    });
  }

  update(data) {
    if (!data || !data.threats) return;
    this.lastAlerts = data.threats.alerts || [];
    this.renderEvents(this.lastAlerts);
  }

  renderEvents(alerts) {
    const list = this.container.querySelector('#timeline-list');
    if (!list) return;

    let filtered = alerts;
    if (this.severityFilter !== 'ALL') {
      filtered = alerts.filter(a => a.severity === this.severityFilter);
    }

    if (filtered.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">No timeline events recorded.</div>';
      return;
    }

    list.innerHTML = filtered.map(a => {
      const isCrit = a.severity === 'critical';
      return `
        <div style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-left: 4px solid ${isCrit ? 'var(--status-error)' : 'var(--status-warn)'}; border-radius: 4px; padding: 10px 14px; display: flex; align-items: flex-start; justify-content: space-between;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="nw-deviation-tag ${isCrit ? 'error' : 'warn'}">${a.category}</span>
              <strong style="font-size: 13px;">${a.message}</strong>
            </div>
            <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">${a.detail}</p>
          </div>
          <span style="color: var(--text-muted); font-size: 11px; white-space: nowrap;">${a.timeFormatted || 'recent'}</span>
        </div>
      `;
    }).join('');
  }
}
