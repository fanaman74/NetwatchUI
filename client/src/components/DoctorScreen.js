// NetWatch Doctor & Online Pre-Flight System Check
// Verifies required host applications, drivers, collectors, and provides 1-click install links & commands

export class DoctorScreen {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.container = document.createElement('div');
    this.container.id = 'doctor-screen-overlay';
    this.container.className = 'nw-doctor-overlay';
    this.report = null;
    this.selectedMode = 'live';
  }

  async runChecks() {
    if (!document.getElementById('doctor-screen-overlay')) {
      document.body.appendChild(this.container);
    }
    this.renderInitial();

    // 1. Client-side Environment Checks (macOS, iOS, Windows, Linux detection)
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMac = !isIOS && /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua);
    const hasWs = typeof WebSocket !== 'undefined';
    const canvasTest = document.createElement('canvas');
    const hasCanvas = !!(canvasTest.getContext && canvasTest.getContext('2d'));
    const dpr = window.devicePixelRatio || 1;
    const screenRes = `${window.innerWidth}x${window.innerHeight}`;

    await this.wait(200);
    this.updateCheckItem('client-ws', hasWs ? 'pass' : 'fail', hasWs ? 'WebSocket API Supported' : 'WebSockets Unavailable in this browser');

    await this.wait(200);
    this.updateCheckItem('client-canvas', hasCanvas ? 'pass' : 'fail', hasCanvas ? `HTML5 Canvas 2D Accelerated (Retina ${dpr}x · ${screenRes})` : 'Canvas Unsupported');

    await this.wait(200);
    const platformLabel = isIOS ? 'Apple iOS (iPhone / iPad Mobile WebKit)' : (isMac ? 'Apple macOS (Desktop WebKit)' : `${navigator.platform || 'Desktop Browser'}`);
    const platformDetail = isIOS
      ? `Mobile touch gestures enabled · Safe area margins active · Retina HiDPI @ ${dpr}x.`
      : (isMac
        ? `Apple macOS environment · ⌘ Command shortcut mappings active · Retina display @ ${dpr}x.`
        : `Desktop client · Screen resolution ${screenRes} @ ${dpr}x.`);
    this.updateCheckItem('client-platform', 'pass', `${platformLabel} · ${platformDetail}`);

    // 2. Query Server Doctor API
    try {
      const res = await fetch('/api/doctor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.report = data;

      // Update system info banner
      const sysBanner = this.container.querySelector('#doctor-system-info');
      if (sysBanner) {
        const clientTag = isIOS ? '📱 Apple iOS (iPhone/iPad)' : (isMac ? '🍎 Apple macOS' : '💻 ' + (navigator.platform || 'Desktop'));
        sysBanner.innerHTML = `
          <span>Host: <strong>${data.platform.os} (${data.platform.arch})</strong></span> ·
          <span>Client: <strong>${clientTag}</strong></span> ·
          <span>Node: <strong>${data.platform.nodeVersion}</strong></span> ·
          <span>Memory: <strong>${data.platform.freeMemGb} GB free / ${data.platform.totalMemGb} GB</strong></span>
        `;
      }

      
      // 2b. Evaluate Host NICs as part of Initial Pre-Flight Checks
      const nicCap = data.capabilities.find(c => c.id === 'nic_discovery' || c.id === 'interface_discovery');
      const nics = (nicCap && nicCap.nics) || [];
      const hasNics = nics.length > 0;
      const selectedNic = localStorage.getItem('nw_selected_nic') || (nicCap ? nicCap.selectedNic : (nics[0]?.name || ''));

      if (hasNics) {
        const activeNic = nics.find(n => n.name === selectedNic) || nics[0];
        const statusText = nics.length === 1
          ? `1 Network Card detected: ${activeNic.name} (${activeNic.description || activeNic.type}) · IP: ${activeNic.ipv4} · Speed: ${activeNic.linkSpeed}`
          : `${nics.length} Network Cards detected · Active: ${activeNic.name} (${activeNic.ipv4}) · Speed: ${activeNic.linkSpeed}`;

        this.updateCheckItem('initial-nics', 'pass', statusText);

        const picker = this.container.querySelector('#initial-nics-picker');
        if (picker && nics.length > 1) {
          picker.style.display = 'flex';
          picker.style.flexWrap = 'wrap';
          picker.style.gap = '6px';
          picker.style.alignItems = 'center';
          picker.innerHTML = `
            <span style="font-size: 11px; font-weight: 700; color: var(--brand); margin-right: 4px;">Select Active NIC:</span>
            ${nics.map(n => {
              const isSel = n.name === selectedNic;
              return `<button class="nw-btn doctor-quick-nic-btn ${isSel ? 'active' : ''}" data-nic="${n.name}" style="padding: 3px 8px; font-size: 10px; ${isSel ? 'background: var(--brand); color: #000; font-weight: 700; border-color: var(--brand);' : ''}">
                ${n.icon || '🔌'} ${n.name} (${n.ipv4}) ${isSel ? '✓' : ''}
              </button>`;
            }).join('')}
          `;

          picker.querySelectorAll('.doctor-quick-nic-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              const chosen = btn.dataset.nic;
              localStorage.setItem('nw_selected_nic', chosen);
              fetch('/api/interfaces/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: chosen })
              }).catch(() => {});

              picker.querySelectorAll('.doctor-quick-nic-btn').forEach(b => {
                const isIt = b.dataset.nic === chosen;
                b.className = `nw-btn doctor-quick-nic-btn ${isIt ? 'active' : ''}`;
                b.style.background = isIt ? 'var(--brand)' : '';
                b.style.color = isIt ? '#000' : '';
                b.style.fontWeight = isIt ? '700' : 'normal';
                b.style.borderColor = isIt ? 'var(--brand)' : '';
                b.innerHTML = b.innerHTML.replace(' ✓', '') + (isIt ? ' ✓' : '');
              });
              const activeUpdated = nics.find(n => n.name === chosen) || activeNic;
              this.updateCheckItem('initial-nics', 'pass', `${nics.length} Network Cards detected · Active: ${activeUpdated.name} (${activeUpdated.ipv4}) · Speed: ${activeUpdated.linkSpeed}`);
            });
          });
        }
      } else {
        this.updateCheckItem('initial-nics', 'warn', 'No physical network interface detected.');
      }

      // Populate capabilities checklist with install options
      for (const cap of data.capabilities) {
        await this.wait(100);
        this.addCapabilityRow(cap);
      }

      // Populate companion tools
      if (data.companion_tools) {
        this.renderCompanionTools(data.companion_tools);
      }

      // Check overall status
      const statusBadge = this.container.querySelector('#doctor-overall-badge');
      const launchBtn = this.container.querySelector('#launch-app-btn');

      const hasDegraded = data.capabilities.some(c => c.state === 'degraded' || c.state === 'unavailable');
      const hasOptionalMissing = data.capabilities.some(c => c.state === 'optional_missing');

      if (!hasDegraded) {
        statusBadge.className = 'nw-chip established';
        statusBadge.textContent = hasOptionalMissing
          ? 'SYSTEM OPERATIONAL (OPTIONAL DRIVERS AVAILABLE TO INSTALL)'
          : 'SYSTEM READY: ALL CAPABILITIES VERIFIED';
        launchBtn.disabled = false;
        launchBtn.className = 'nw-btn active';
        launchBtn.innerHTML = '🚀 Launch NetWatch Console';
      } else {
        statusBadge.className = 'nw-chip close_wait';
        statusBadge.textContent = 'SYSTEM ATTENTION: SOME CHECKS NEED INSTALLATION';
        launchBtn.disabled = false;
        launchBtn.className = 'nw-btn';
        launchBtn.innerHTML = '⚠️ Proceed to Console (Degraded)';
      }
    } catch (err) {
      this.addCapabilityRow({
        id: 'server_err',
        name: 'NetWatch Server Connection',
        state: 'unavailable',
        detail: `Failed to connect to backend server: ${err.message}. Ensure backend is running on port 3030.`,
        install_info: {
          url: 'https://nodejs.org/en/download',
          label: 'Install Node.js',
          command: 'node start.js',
          instructions: 'Start the NetWatch server locally by running "node start.js" in the root directory.'
        }
      });
      const launchBtn = this.container.querySelector('#launch-app-btn');
      launchBtn.disabled = false;
      launchBtn.innerHTML = '⚠️ Launch with Demo Mode';
    }
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-doctor-card">
        <!-- Header -->
        <div class="nw-doctor-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 28px;">🩺</div>
            <div>
              <h2 style="font-family: var(--font-sans); font-size: 18px; color: var(--brand); letter-spacing: 0.5px;">
                NETWATCH DOCTOR & ONLINE PRE-FLIGHT VERIFICATION
              </h2>
              <div style="font-size: 11px; color: var(--text-muted);">
                Verifying host applications, OS socket attribution, packet drivers, and cloud telemetry
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="doctor-retest-btn" class="nw-btn" title="Re-test all system checks">🔄 Re-test</button>
            <span id="doctor-overall-badge" class="nw-chip time_wait">RUNNING PRE-FLIGHT CHECKS...</span>
          </div>
        </div>

        <!-- Host Info Bar -->
        <div id="doctor-system-info" style="font-size: 11px; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 8px 14px; border-radius: 4px; margin-bottom: 14px; border: 1px solid var(--border-subtle);">
          Connecting to NetWatch backend & querying system capabilities...
        </div>

        <!-- Checklist List -->
        <div id="doctor-checks-list" class="nw-doctor-list">
          <div class="nw-doctor-item" id="item-client-ws">
            <span class="nw-doctor-status checking">●</span>
            <div style="flex: 1;">
              <strong>Browser WebSocket Telemetry Gateway</strong>
              <div class="detail" style="font-size: 11px; color: var(--text-muted);">Checking client WebSocket connection...</div>
            </div>
          </div>

          <div class="nw-doctor-item" id="item-client-canvas">
            <span class="nw-doctor-status checking">●</span>
            <div style="flex: 1;">
              <strong>Client HTML5 Canvas 2D Hardware Acceleration</strong>
              <div class="detail" style="font-size: 11px; color: var(--text-muted);">Verifying 2D context for Mirrored Throughput rendering...</div>
            </div>
          </div>

                    <div class="nw-doctor-item" id="item-initial-nics">
            <span class="nw-doctor-status checking">●</span>
            <div style="flex: 1;">
              <strong>Network Interface Cards (NICs) & Physical Adapters</strong>
              <div class="detail" style="font-size: 11px; color: var(--text-muted);">Detecting host network adapters, physical NICs, and IP addresses...</div>
              <div id="initial-nics-picker" style="display: none; margin-top: 8px;"></div>
            </div>
          </div>

<div class="nw-doctor-item" id="item-client-platform">
            <span class="nw-doctor-status checking">●</span>
            <div style="flex: 1;">
              <strong>Client Platform &amp; Device Compatibility</strong>
              <div class="detail" style="font-size: 11px; color: var(--text-muted);">Detecting macOS / iOS WebKit engine, Retina HiDPI, and touch capabilities...</div>
            </div>
          </div>
        </div>

        <!-- Companion & Recommended Tools Section -->
        <div id="companion-tools-section" style="margin-top: 10px; display: none;">
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
            📦 Recommended Companion Applications
          </div>
          <div id="companion-tools-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"></div>
        </div>

        <!-- Mode Preference & Startup Choice -->
        <div style="background: rgba(0, 210, 255, 0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-size: 12px; color: var(--text-primary);">Startup Mode:</strong>
            <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">Choose telemetry data source:</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <label class="nw-btn active" id="mode-opt-live" style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="radio" name="doctor-mode" value="live" checked style="accent-color: var(--brand);" />
              <span>Real Live Host</span>
            </label>
            <label class="nw-btn" id="mode-opt-demo" style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="radio" name="doctor-mode" value="demo" style="accent-color: var(--brand);" />
              <span>NetWatch 0.30 Demo</span>
            </label>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="nw-doctor-footer">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); cursor: pointer;">
            <input type="checkbox" id="skip-preflight-checkbox" />
            <span>Skip pre-flight on next visit (re-open via 🩺 Doctor anytime)</span>
          </label>

          <div style="display: flex; gap: 10px;">
            <button id="view-raw-json-btn" class="nw-btn">
              📄 View Raw JSON
            </button>
            <button id="launch-app-btn" class="nw-btn" disabled style="min-width: 220px; justify-content: center; font-weight: 700;">
              Verifying Dependencies...
            </button>
          </div>
        </div>
      </div>
    `;

    // Re-test button
    this.container.querySelector('#doctor-retest-btn').addEventListener('click', () => {
      this.runChecks();
    });

    // Mode options
    const optLive = this.container.querySelector('#mode-opt-live');
    const optDemo = this.container.querySelector('#mode-opt-demo');
    const radioLive = optLive.querySelector('input');
    const radioDemo = optDemo.querySelector('input');

    radioLive.addEventListener('change', () => {
      this.selectedMode = 'live';
      optLive.classList.add('active');
      optDemo.classList.remove('active');
    });

    radioDemo.addEventListener('change', () => {
      this.selectedMode = 'demo';
      optDemo.classList.add('active');
      optLive.classList.remove('active');
    });

    // Launch button
    const launchBtn = this.container.querySelector('#launch-app-btn');
    launchBtn.addEventListener('click', () => {
      const skipCheckbox = this.container.querySelector('#skip-preflight-checkbox');
      if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem('nw_skip_doctor', 'true');
      }
      this.close();
    });

    // View JSON button
    const jsonBtn = this.container.querySelector('#view-raw-json-btn');
    jsonBtn.addEventListener('click', () => {
      this.showRawJsonModal(this.report || { status: 'loading' });
    });
  }

  updateCheckItem(id, status, detail) {
    const item = this.container.querySelector(`#item-${id}`);
    if (!item) return;

    const dot = item.querySelector('.nw-doctor-status');
    const detailDiv = item.querySelector('.detail');

    if (dot) {
      dot.className = `nw-doctor-status ${status}`;
      dot.textContent = status === 'pass' ? '✓' : '✖';
    }
    if (detailDiv) {
      detailDiv.textContent = detail;
    }
  }

  addCapabilityRow(cap) {
    const list = this.container.querySelector('#doctor-checks-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'nw-doctor-item';

    const isReady = cap.state === 'ready';
    const isOptional = cap.state === 'optional_missing';
    const isMissingOrDegraded = !isReady;

    let installBoxHtml = '';
    if (cap.install_info) {
      const info = cap.install_info;
      installBoxHtml = `
        <div class="nw-install-box ${cap.state === 'unavailable' ? 'critical' : ''}" style="${isReady ? 'display: none;' : 'display: flex;'}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: ${isReady ? 'var(--status-good)' : 'var(--status-warn)'};">
              ${isReady ? 'Installation Reference' : '⚠️ Installation & Setup Available'}
            </strong>
            <a href="${info.url}" target="_blank" rel="noopener" class="nw-btn active" style="text-decoration: none; padding: 3px 10px;">
              ${info.label} ↗
            </a>
          </div>

          <div style="font-size: 11px; color: var(--text-secondary); white-space: pre-line;">
            ${info.instructions}
          </div>

          ${info.command ? `
            <div class="nw-cmd-box">
              <code>${info.command}</code>
              <button class="nw-btn" style="padding: 2px 8px; font-size: 10px;" onclick="navigator.clipboard.writeText('${info.command.replace(/'/g, "\\'")}').then(() => { this.textContent = '✓ Copied!'; setTimeout(() => this.textContent = '📋 Copy', 2000); })">
                📋 Copy
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }

    let nicsHtml = '';
    if (cap.nics && cap.nics.length > 0) {
      const selectedNic = localStorage.getItem('nw_selected_nic') || cap.selectedNic || cap.nics[0].name;
      nicsHtml = `
        <div class="doctor-nics-deck" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <strong style="font-size: 11px; color: var(--brand); letter-spacing: 0.5px;">
              DETECTED NETWORK ADAPTERS &amp; HARDWARE NICS (${cap.nics.length})
            </strong>
            <span style="font-size: 10px; color: var(--text-muted);">Select active interface to monitor</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">
            ${cap.nics.map(nic => {
              const isSelected = nic.name === selectedNic;
              const isOnline = nic.isUp;
              return `
                <div class="doctor-nic-card ${isSelected ? 'selected' : ''}" style="background: rgba(255,255,255,0.03); border: 1px solid ${isSelected ? 'var(--brand)' : 'var(--border-subtle)'}; border-radius: 4px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 15px;">${nic.icon}</span>
                      <div>
                        <strong style="font-size: 12px; color: var(--text-primary);">${nic.name}</strong>
                        <div style="font-size: 10px; color: var(--text-muted);">${nic.description}</div>
                      </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                      <span class="nw-chip ${isOnline ? 'established' : 'time_wait'}" style="font-size: 9px; padding: 1px 6px;">${nic.status.toUpperCase()}</span>
                      <span class="nw-key-badge" style="font-size: 9px;">${nic.linkSpeed}</span>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); font-size: 10px; color: var(--text-secondary); margin-top: 4px; border-top: 1px solid var(--border-subtle); padding-top: 4px;">
                    <div>
                      <span style="color: var(--text-muted);">IP:</span> <span style="color: ${nic.ipv4 !== '-' ? 'var(--brand)' : 'var(--text-muted)'};">${nic.ipv4}</span>
                    </div>
                    <div>
                      <span style="color: var(--text-muted);">MAC:</span> <span>${nic.mac}</span>
                    </div>
                  </div>
                  <button class="nw-btn doctor-select-nic-btn ${isSelected ? 'active' : ''}" data-nic-name="${nic.name}" style="margin-top: 4px; width: 100%; padding: 3px 6px; font-size: 10px; font-weight: 600; text-align: center; ${isSelected ? 'background: var(--brand); color: #000; border-color: var(--brand);' : ''}">
                    ${isSelected ? '✓ Monitored Active NIC' : 'Select for Live Monitoring'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <span class="nw-doctor-status ${isReady ? 'pass' : (isOptional ? 'warn' : 'fail')}">
        ${isReady ? '✓' : (isOptional ? 'ℹ' : '✖')}
      </span>
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <strong>${cap.name}</strong>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${cap.install_info ? `
              <button class="nw-btn" style="padding: 1px 6px; font-size: 10px;" onclick="const b = this.closest('.nw-doctor-item').querySelector('.nw-install-box'); if (b) b.style.display = b.style.display === 'none' ? 'flex' : 'none';">
                ${isMissingOrDegraded ? 'Hide Install Options' : 'ℹ Install Info'}
              </button>
            ` : ''}
            <span class="nw-key-badge" style="font-size: 10px;">${cap.state.toUpperCase()}</span>
          </div>
        </div>
        <div class="detail" style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
          ${cap.detail}
        </div>
        ${nicsHtml}
        ${installBoxHtml}
      </div>
    `;

    // Bind NIC selection events
    row.querySelectorAll('.doctor-select-nic-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nicName = btn.getAttribute('data-nic-name');
        localStorage.setItem('nw_selected_nic', nicName);
        try {
          await fetch('/api/interfaces/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ iface: nicName })
          });
        } catch {
          // ignore
        }
        row.querySelectorAll('.doctor-nic-card').forEach(c => c.style.borderColor = 'var(--border-subtle)');
        btn.closest('.doctor-nic-card')?.style.setProperty('border-color', 'var(--brand)');
        row.querySelectorAll('.doctor-select-nic-btn').forEach(b => {
          const isThis = b.getAttribute('data-nic-name') === nicName;
          b.className = `nw-btn doctor-select-nic-btn ${isThis ? 'active' : ''}`;
          b.style.background = isThis ? 'var(--brand)' : '';
          b.style.color = isThis ? '#000' : '';
          b.style.borderColor = isThis ? 'var(--brand)' : '';
          b.textContent = isThis ? '✓ Monitored Active NIC' : 'Select for Live Monitoring';
        });
      });
    });

    list.appendChild(row);
  }

  renderCompanionTools(tools) {
    const section = this.container.querySelector('#companion-tools-section');
    const grid = this.container.querySelector('#companion-tools-grid');
    if (!section || !grid) return;

    section.style.display = 'block';
    grid.innerHTML = tools.map(t => `
      <div class="nw-companion-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--brand); font-size: 12px;">${t.name}</strong>
          <a href="${t.url}" target="_blank" rel="noopener" class="nw-btn" style="text-decoration: none; padding: 2px 8px; font-size: 10px;">
            Download ↗
          </a>
        </div>
        <span style="font-size: 11px; color: var(--text-muted);">${t.recommended_for}</span>
        <div class="nw-cmd-box" style="padding: 3px 8px;">
          <code style="font-size: 10px;">${t.command}</code>
          <button class="nw-btn" style="padding: 1px 6px; font-size: 9px;" onclick="navigator.clipboard.writeText('${t.command.replace(/'/g, "\\'")}').then(() => { this.textContent = '✓ Copied'; setTimeout(() => this.textContent = 'Copy', 2000); })">
            Copy
          </button>
        </div>
      </div>
    `).join('');
  }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  close() {
    this.container.classList.add('fade-out');
    setTimeout(() => {
      this.container.remove();
      if (this.onComplete) {
        this.onComplete(this.selectedMode);
      }
    }, 250);
  }

  showRawJsonModal(data) {
    const modal = document.createElement('div');
    modal.className = 'nw-modal-overlay';
    modal.innerHTML = `
      <div class="nw-modal" style="max-width: 720px;">
        <div class="nw-modal-header">
          <span class="nw-panel-title">📄 netwatch doctor --json Output</span>
          <button class="nw-btn" id="close-json-modal">✖ Close</button>
        </div>
        <div class="nw-modal-body">
          <pre style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 11px; background: rgba(0,0,0,0.35); padding: 14px; border-radius: 4px; max-height: 60vh; overflow-y: auto;">${JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#close-json-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
