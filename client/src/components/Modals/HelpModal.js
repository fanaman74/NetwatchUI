// NetWatch Help & Keybindings Cheat-Sheet Modal

export function showHelpModal() {
  const existing = document.querySelector('.nw-modal-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'nw-modal-overlay';
  modal.innerHTML = `
    <div class="nw-modal" style="max-width: 650px;">
      <div class="nw-modal-header">
        <span class="nw-panel-title">⌨️ NetWatch Keyboard Shortcuts & Navigation</span>
        <button class="nw-btn" id="close-help-btn">✖ Close [Esc]</button>
      </div>
      <div class="nw-modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px;">
        <div>
          <h4 style="color: var(--brand); margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">Tab Navigation</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div><span class="nw-key-badge">1</span> <strong>Dashboard</strong>: Mirrored graph, KPIs</div>
            <div><span class="nw-key-badge">2</span> <strong>Connections</strong>: Live socket table</div>
            <div><span class="nw-key-badge">3</span> <strong>Interfaces</strong>: NIC rates, drops</div>
            <div><span class="nw-key-badge">4</span> <strong>Packets</strong>: L7 decode, Hex Dump</div>
            <div><span class="nw-key-badge">5</span> <strong>Stats</strong>: Protocol & handshake histogram</div>
            <div><span class="nw-key-badge">6</span> <strong>Topology</strong>: Nodes & Traceroute hops</div>
            <div><span class="nw-key-badge">7</span> <strong>Timeline</strong>: State waterfall & events</div>
            <div><span class="nw-key-badge">8</span> <strong>Processes</strong>: Bandwidth attribution</div>
            <div><span class="nw-key-badge">9</span> <strong>Diagnose</strong>: Issues & ranked fixes</div>
            <div><span class="nw-key-badge">0</span> <strong>Egress</strong>: Drift detection & rules</div>
          </div>
        </div>

        <div>
          <h4 style="color: var(--brand); margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">Controls & Views</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div><span class="nw-key-badge">V</span> Cycle Views: <strong>Full / Dense / Lite</strong></div>
            <div><span class="nw-key-badge">1-4</span> Zoom box in <strong>Dense View</strong></div>
            <div><span class="nw-key-badge">T</span> Switch Theme (8 official palettes)</div>
            <div><span class="nw-key-badge">D</span> Toggle <strong>Live Host vs Demo Scenario</strong></div>
            <div><span class="nw-key-badge">P</span> / <span class="nw-key-badge">Space</span> Pause / Resume stream</div>
            <div><span class="nw-key-badge">/</span> Focus Search / Display Filter</div>
            <div><span class="nw-key-badge">E</span> Export PCAP capture binary</div>
            <div><span class="nw-key-badge">?</span> Toggle this Help Cheat-Sheet</div>
          </div>
        </div>
      </div>
      <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>Tip: Every NetWatch terminal command and keybind works in the web app.</span>
        <span>Esc closes modal</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-help-btn').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      window.removeEventListener('keydown', onKey);
    }
  };
  window.addEventListener('keydown', onKey);
}
