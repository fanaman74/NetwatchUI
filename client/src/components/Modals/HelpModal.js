// NetWatch Help & Keybindings Cheat-Sheet Modal

export function showHelpModal() {
  const existing = document.querySelector('.nw-modal-overlay');
  if (existing) {
    existing.remove();
    return;
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = !isIOS && /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua);

  const modal = document.createElement('div');
  modal.className = 'nw-modal-overlay';
  modal.innerHTML = `
    <div class="nw-modal" style="max-width: 680px;">
      <div class="nw-modal-header">
        <span class="nw-panel-title">
          ${isIOS ? '📱 NetWatch iOS Mobile & Touch Guide' : (isMac ? '🍎 NetWatch macOS Keyboard & Trackpad Shortcuts' : '⌨️ NetWatch Keyboard Shortcuts & Navigation')}
        </span>
        <button class="nw-btn" id="close-help-btn">✖ Close [Esc]</button>
      </div>
      <div class="nw-modal-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px;">
        <div>
          <h4 style="color: var(--brand); margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">
            ${isIOS ? '📱 Touch & Navigation' : 'Tab Navigation'}
          </h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${isIOS ? `
              <div>👆 <strong>Horizontal Swipe</strong>: Swipe left/right across screen to switch tabs</div>
              <div>🎯 <strong>Tab Centering</strong>: Active tab automatically smooth-scrolls into view</div>
              <div>🔍 <strong>Socket Tap</strong>: Tap any row in Top 15 to open hoisted TCP Inspector</div>
              <div>📱 <strong>PWA Installation</strong>: Tap Safari Share ➔ "Add to Home Screen" for full-screen mode</div>
              <div>⚡ <strong>Safe Areas</strong>: Dynamic Island, notch, and Home indicator padding integrated</div>
            ` : `
              <div><span class="nw-key-badge">${isMac ? '⌘1' : '1'}</span> <strong>Dashboard</strong>: Mirrored graph, KPIs</div>
              <div><span class="nw-key-badge">${isMac ? '⌘2' : '2'}</span> <strong>Connections</strong>: Live socket table</div>
              <div><span class="nw-key-badge">${isMac ? '⌘3' : '3'}</span> <strong>Interfaces</strong>: NIC rates, drops</div>
              <div><span class="nw-key-badge">${isMac ? '⌘4' : '4'}</span> <strong>Packets</strong>: L7 decode, Hex Dump</div>
              <div><span class="nw-key-badge">${isMac ? '⌘5' : '5'}</span> <strong>Stats</strong>: Protocol & handshake histogram</div>
              <div><span class="nw-key-badge">${isMac ? '⌘6' : '6'}</span> <strong>Topology</strong>: Nodes & Traceroute hops</div>
              <div><span class="nw-key-badge">${isMac ? '⌘7' : '7'}</span> <strong>Timeline</strong>: State waterfall & events</div>
              <div><span class="nw-key-badge">${isMac ? '⌘8' : '8'}</span> <strong>Processes</strong>: Bandwidth attribution</div>
              <div><span class="nw-key-badge">${isMac ? '⌘9' : '9'}</span> <strong>Diagnose</strong>: Issues & ranked fixes</div>
              <div><span class="nw-key-badge">${isMac ? '⌘0' : '0'}</span> <strong>Egress</strong>: Drift detection & rules</div>
            `}
          </div>
        </div>

        <div>
          <h4 style="color: var(--brand); margin-bottom: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 4px;">
            ${isIOS ? '⚙️ Controls & Telemetry' : 'Controls & Views'}
          </h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div><span class="nw-key-badge">V</span> Cycle Views: <strong>Full / Dense / Lite</strong></div>
            <div><span class="nw-key-badge">T</span> Switch Theme (8 official palettes)</div>
            <div><span class="nw-key-badge">${isMac ? '⌘D' : 'D'}</span> Toggle <strong>Live Host vs Demo Scenario</strong></div>
            <div><span class="nw-key-badge">${isMac ? 'Space / ⌘P' : 'Space / P'}</span> Pause / Resume stream</div>
            <div><span class="nw-key-badge">${isMac ? '⌘/ / ⌘K' : '/'}</span> Focus Search / Display Filter</div>
            <div><span class="nw-key-badge">${isMac ? '⌘E' : 'E'}</span> Export PCAP capture binary</div>
            <div><span class="nw-key-badge">Esc</span> Close Modals / Inspectors</div>
            <div><span class="nw-key-badge">?</span> Toggle this Help Cheat-Sheet</div>
          </div>
        </div>
      </div>
      <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
        <span>${isIOS ? '📱 iOS WebKit & Safari Optimized' : (isMac ? '🍎 macOS Native Shortcuts & Trackpad Gestures Active' : 'Tip: NetWatch terminal commands and keybinds work in the web app.')}</span>
        <span>Esc or Tap Outside closes</span>
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
