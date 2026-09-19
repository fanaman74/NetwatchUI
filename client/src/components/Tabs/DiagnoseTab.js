// NetWatch Diagnose Tab (Tab 9) - Autonomous Diagnostics Engine & Verified Recovery
import { telemetry } from '../../services/telemetry.js';

export class DiagnoseTab {
  constructor(container) {
    this.container = container;
    this.lastDiagnose = null;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Engine Status Banner -->
        <div class="nw-panel" style="border-color: var(--brand);">
          <div class="nw-panel-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="nw-panel-title">🧠 NetWatch Diagnostic Engine</span>
              <span class="nw-key-badge">25 Catalogued Rules · 18 Active Detectors</span>
            </div>
            <button id="export-report-btn" class="nw-btn">
              📄 Export report.md
            </button>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary);">
            Evaluates live metrics against network-scoped learned baselines (1,800 sample requirement).
            Correlates failure modes across the suppression graph and tracks fixes through verified auto-close.
          </p>
        </div>

        <!-- Active Issues Section -->
        <div id="diagnose-issues-container"></div>

        <!-- Resolved Issues History -->
        <div class="nw-panel">
          <div class="nw-panel-header">
            <span class="nw-panel-title">✅ Resolved & Verified Issues History</span>
            <span id="resolved-count-badge" class="nw-chip established">0 Resolved</span>
          </div>
          <div id="resolved-issues-list" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;"></div>
        </div>
      </div>
    `;

    const exportBtn = this.container.querySelector('#export-report-btn');
    exportBtn.addEventListener('click', async () => {
      const md = await telemetry.getReportMarkdown();
      this.showReportModal(md);
    });
  }

  update(data) {
    if (!data || !data.diagnose) return;
    this.lastDiagnose = data.diagnose;

    const issuesContainer = this.container.querySelector('#diagnose-issues-container');
    const resolvedList = this.container.querySelector('#resolved-issues-list');
    const resolvedBadge = this.container.querySelector('#resolved-count-badge');

    const activeIssues = data.diagnose.activeIssues || [];
    const historyIssues = data.diagnose.historyIssues || [];

    if (resolvedBadge) resolvedBadge.textContent = `${historyIssues.length} Resolved`;

    // 1. Render Active Issues
    if (activeIssues.length === 0) {
      issuesContainer.innerHTML = `
        <div class="nw-panel" style="text-align: center; padding: 40px 20px; border-color: var(--status-good);">
          <div style="font-size: 36px; margin-bottom: 8px;">✨</div>
          <h3 style="color: var(--status-good); margin-bottom: 6px;">All Baselines Nominal</h3>
          <p style="color: var(--text-muted); font-size: 12px;">
            No anomalies detected. Latency, loss, and socket metrics are operating within learned standard deviations.
          </p>
        </div>
      `;
    } else {
      issuesContainer.innerHTML = activeIssues.map(issue => {
        const isVerifying = issue.status === 'verifying';
        const rem = data.diagnose.remediationState;

        return `
          <div class="nw-diagnose-card">
            <div class="nw-diagnose-header">
              <div class="nw-diagnose-title">
                <span>⚠️ [${issue.severity.toUpperCase()}] ${issue.title}</span>
                <span class="nw-deviation-tag error">${issue.ratioString}</span>
              </div>
              <span class="nw-key-badge">Since ${issue.since}</span>
            </div>

            <!-- Metric Comparison Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 12px;">
              <div>
                <span style="color: var(--text-muted); font-size: 10px;">SUBJECT</span>
                <div><code style="color: var(--brand);">${issue.subject}</code></div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 10px;">OBSERVED VALUE</span>
                <div style="color: var(--status-error); font-weight: 700;">${issue.observedValue}</div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 10px;">LEARNED BASELINE</span>
                <div>${issue.baselineValue}</div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 10px;">STATUS</span>
                <div>
                  <span class="nw-chip ${isVerifying ? 'time_wait' : 'close_wait'}">
                    ${isVerifying ? 'VERIFYING HOLD...' : 'OPEN'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Ranked Causes -->
            <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-top: 10px;">
              RANKED CANDIDATE ROOT CAUSES:
            </div>
            <div class="nw-causes-list">
              ${issue.rankedCauses.map(cause => `
                <div class="nw-cause-item">
                  <div class="nw-cause-header">
                    <strong>#${cause.rank}. ${cause.title}</strong>
                    <div>
                      <span style="color: var(--brand); font-weight: 700;">${cause.confidence}%</span>
                      <div class="nw-confidence-bar">
                        <div class="nw-confidence-fill" style="width: ${cause.confidence}%;"></div>
                      </div>
                    </div>
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    ${cause.evidence}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Guided Remediation Action -->
            ${issue.remediation ? `
              <div class="nw-remediation-box">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: var(--brand); font-size: 13px;">Recommended Fix:</strong>
                    <span>${issue.remediation.label}</span>
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                    ${issue.remediation.description} · <em>Condition: ${issue.remediation.verifyRule}</em>
                  </div>
                  ${isVerifying ? `
                    <div style="margin-top: 6px; color: var(--status-warn); font-size: 12px; font-weight: 600;">
                      ⏳ Verification in progress: holding for ${rem.verificationRemaining}s before auto-close...
                    </div>
                  ` : ''}
                </div>

                ${!isVerifying ? `
                  <button class="nw-btn active" data-action="${issue.remediation.actionId}" style="white-space: nowrap;">
                    ⚡ Apply Remediation
                  </button>
                ` : `
                  <button class="nw-btn" disabled style="opacity: 0.6;">
                    Holding Verification (${rem.verificationRemaining}s)
                  </button>
                `}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Bind remediation buttons
      issuesContainer.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const actionId = btn.getAttribute('data-action');
          btn.disabled = true;
          btn.textContent = 'Applying...';
          await telemetry.remediate(actionId);
        });
      });
    }

    // 2. Render Resolved Issues History
    if (resolvedList) {
      if (historyIssues.length === 0) {
        resolvedList.innerHTML = '<span style="color: var(--text-muted);">No issues resolved yet in this session.</span>';
      } else {
        resolvedList.innerHTML = historyIssues.map(h => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(63, 185, 80, 0.08); border-radius: 4px; border-left: 3px solid var(--status-good);">
            <div>
              <strong style="color: var(--status-good);">${h.title}</strong>
              <span style="color: var(--text-muted); margin-left: 8px;">(${h.subject})</span>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${h.closeReason || 'Verified resolved'}</div>
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">${h.closedAt ? h.closedAt.substring(11, 19) : 'closed'}</span>
          </div>
        `).join('');
      }
    }
  }

  showReportModal(mdContent) {
    const modal = document.createElement('div');
    modal.className = 'nw-modal-overlay';
    modal.innerHTML = `
      <div class="nw-modal">
        <div class="nw-modal-header">
          <span class="nw-panel-title">📄 NetWatch Diagnostic Report (report.md)</span>
          <button class="nw-btn" id="close-modal-btn">✖ Close</button>
        </div>
        <div class="nw-modal-body">
          <pre style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.3); padding: 14px; border-radius: 6px;">${mdContent}</pre>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
          <a href="/api/export/report" download="report.md" class="nw-btn active">💾 Download report.md</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
