// NetWatch UniFi Tab - Internal UniFi Network Monitor & Controller Integration
export class UnifiTab {
  constructor(container) {
    this.container = container;
    this.activeSubTab = 'clients'; // 'clients' | 'devices' | 'health'
    this.clientFilter = 'all'; // 'all' | 'wifi' | 'wired' | 'iot'
    this.clientSearch = '';
    this.status = null;
    this.health = null;
    this.devices = [];
    this.clients = [];
    this.networks = [];
    this.wlans = [];
    this.isSyncing = false;

    this.renderInitial();
    this.loadData();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <!-- UniFi Header Banner -->
        <div class="nw-panel-header nw-unifi-header" style="flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 20px;">🌐</span>
              <span class="nw-panel-title" style="font-size: 16px; font-weight: 700;">UniFi Network Controller</span>
            </div>
            <span id="unifi-status-pill" class="nw-status-pill live">● CONNECTED</span>
            <span id="unifi-controller-badge" class="nw-version-tag">UDM-Pro · UniFi OS 4.0.6</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button id="unifi-sync-btn" class="nw-header-btn" title="Refresh UniFi data">
              <span>🔄 Sync</span>
            </button>
            <button id="unifi-demo-btn" class="nw-header-btn" title="Load Demo Network">
              <span>🧪 Demo Lab</span>
            </button>
            <button id="unifi-config-btn" class="nw-header-btn active" title="Configure Controller URL & API Key" style="background: var(--brand); color: var(--text-inverse); font-weight: 700;">
              <span>⚙️ Configure API</span>
            </button>
          </div>
        </div>

        <!-- Live Connect Callout Banner -->
        <div id="unifi-connect-banner" class="nw-unifi-connect-banner" style="${localStorage.getItem('nw_unifi_configured') === 'true' ? 'display: none;' : 'display: flex;'} background: linear-gradient(90deg, rgba(0, 210, 255, 0.12), rgba(31, 111, 235, 0.12)); border: 1px solid var(--brand); border-radius: 8px; padding: 12px 16px; margin-top: 12px; margin-bottom: 6px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">🔑</span>
            <div>
              <div style="font-weight: 700; font-size: 13.5px; color: var(--brand);">Connect Your Live UniFi Network</div>
              <div style="font-size: 11.5px; color: var(--text-secondary);">Enter your UniFi Dream Machine, Cloud Key, or Controller IP &amp; API Key to access and monitor your internal switches, access points, and clients.</div>
            </div>
          </div>
          <button id="unifi-banner-add-api-btn" class="nw-btn active" style="font-size: 12px; font-weight: 700; padding: 7px 16px; box-shadow: 0 0 14px rgba(0, 210, 255, 0.35); cursor: pointer;">
            <span>➕ Add UniFi API Key</span>
          </button>
        </div>

        <!-- KPI Metric Strip -->
        <div class="nw-kpi-strip" id="unifi-kpi-strip" style="margin-top: 12px; margin-bottom: 16px;">
          <!-- 1. Gateway & WAN -->
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">GATEWAY & WAN</span>
              <span class="nw-chip established">Online</span>
            </div>
            <div class="nw-kpi-value" id="kpi-unifi-gateway" style="font-size: 16px;">UDM-Pro</div>
            <div class="nw-kpi-sub" id="kpi-unifi-wan">198.51.100.42 · 7.8ms ping</div>
          </div>

          <!-- 2. Devices -->
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">UNIFI HARDWARE</span>
              <span class="nw-chip listen" id="kpi-unifi-dev-chip">5 Adopted</span>
            </div>
            <div class="nw-kpi-value" id="kpi-unifi-dev-count">5</div>
            <div class="nw-kpi-sub">1 Gateway · 1 Switch · 3 APs</div>
          </div>

          <!-- 3. Connected Clients -->
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">ACTIVE CLIENTS</span>
              <span class="nw-chip syn_sent" id="kpi-unifi-cli-chip">27 Online</span>
            </div>
            <div class="nw-kpi-value" id="kpi-unifi-cli-count">27</div>
            <div class="nw-kpi-sub" id="kpi-unifi-cli-sub">19 Wireless · 8 Wired</div>
          </div>

          <!-- 4. Wi-Fi Experience -->
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">WIFI EXPERIENCE</span>
              <span class="nw-chip established">Excellent</span>
            </div>
            <div class="nw-kpi-value" id="kpi-unifi-wifi-exp" style="color: var(--status-good);">98%</div>
            <div class="nw-kpi-sub">Avg Signal: -51 dBm (Ch 1/6/36/69)</div>
          </div>

          <!-- 5. PoE Budget -->
          <div class="nw-kpi-card">
            <div class="nw-kpi-header">
              <span class="nw-kpi-title">POE POWER CONSUMPTION</span>
              <span class="nw-chip close_wait" id="kpi-unifi-poe-chip">17.1%</span>
            </div>
            <div class="nw-kpi-value" id="kpi-unifi-poe-val" style="font-size: 16px;">68.4W / 400W</div>
            <div class="nw-kpi-sub">7 Active PoE / PoE+ Devices</div>
          </div>
        </div>

        <!-- Sub Tabs Navigation -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div class="nw-segmented-control" role="tablist" style="height: 32px;">
            <button class="nw-segment-btn active" id="unifi-tab-btn-clients" data-subtab="clients">
              <span>📱 Connected Clients</span>
              <span id="unifi-subtab-cli-count" class="nw-badge-count" style="display: inline-block; margin-left: 4px;">27</span>
            </button>
            <button class="nw-segment-btn" id="unifi-tab-btn-devices" data-subtab="devices">
              <span>🎛️ Hardware Devices</span>
              <span id="unifi-subtab-dev-count" class="nw-badge-count" style="display: inline-block; margin-left: 4px;">5</span>
            </button>
            <button class="nw-segment-btn" id="unifi-tab-btn-health" data-subtab="health">
              <span>📡 Subnets, SSIDs &amp; Health</span>
              <span id="unifi-subtab-health-count" class="nw-badge-count" style="display: inline-block; margin-left: 4px;">-</span>
            </button>
          </div>

          <!-- Client Search & Filters (Visible when Clients tab active) -->
          <div id="unifi-client-controls" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 4px; background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 6px; padding: 0 8px; height: 30px;">
              <span style="font-size: 12px;">🔍</span>
              <input type="text" id="unifi-search-input" placeholder="Search clients by name, IP, MAC..." style="background: transparent; border: none; outline: none; color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; width: 190px;" />
            </div>

            <div style="display: flex; gap: 2px;">
              <button class="nw-header-btn active" data-filter="all" style="padding: 0 8px; font-size: 11px; height: 30px;">All</button>
              <button class="nw-header-btn" data-filter="wifi" style="padding: 0 8px; font-size: 11px; height: 30px;">📶 Wi-Fi</button>
              <button class="nw-header-btn" data-filter="wired" style="padding: 0 8px; font-size: 11px; height: 30px;">🔌 Wired</button>
            </div>
          </div>
        </div>

        <!-- Dynamic Content Body -->
        <div id="unifi-tab-body">
          <!-- Content loaded via updateViews() -->
        </div>
      </div>

      <!-- UniFi Controller Configuration Modal -->
      <div id="unifi-config-modal" class="nw-modal-overlay" style="display: none;">
        <div class="nw-modal" style="max-width: 520px; width: 92vw;">
          <div class="nw-modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🌐</span>
              <span class="nw-modal-title">Configure UniFi Controller API</span>
            </div>
            <button id="unifi-modal-close" class="nw-btn" style="padding: 2px 8px;">✕</button>
          </div>

          <div class="nw-modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Connect to your local <strong>UniFi Dream Machine (UDM)</strong>, <strong>UniFi Cloud Key</strong>, <strong>Cloud Gateway</strong>, or self-hosted UniFi Network Application. Requests are safely proxied via NetWatch's backend.
            </div>

            <!-- Current Persisted Status Badge -->
            <div id="cfg-unifi-current-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 11.5px; line-height: 1.4; background: rgba(63, 185, 80, 0.12); border: 1px solid rgba(63, 185, 80, 0.35); color: var(--status-good);">
            </div>

            <!-- Controller URL -->
            <div>
              <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                Controller URL or IP Address
              </label>
              <input type="text" id="cfg-unifi-url" class="nw-select" style="width: 100%; box-sizing: border-box; padding: 7px 10px;" placeholder="e.g. https://192.168.1.1" />
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                💡 For <strong>UniFi Dream Machine (UDM/UDR/Cloud Gateway)</strong>, use: <code id="quick-fill-udm" style="color: var(--brand); cursor: pointer; text-decoration: underline;">https://192.168.1.1</code> (standard HTTPS, no port needed).<br>
                For standalone software controllers, specify port <code>:8443</code>.
              </div>
            </div>

            <!-- Authentication Type Radio -->
            <div>
              <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                Authentication Method
              </label>
              <div style="display: flex; gap: 12px; font-size: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="unifi-auth-type" value="apiKey" checked />
                  <span><strong>UniFi API Key</strong> (UniFi OS 3.x/4.x)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="unifi-auth-type" value="credentials" />
                  <span>Local Admin Login</span>
                </label>
              </div>
            </div>

            <!-- API Key Input Group -->
            <div id="cfg-unifi-apikey-group">
              <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                UniFi API Key
              </label>
              <div style="position: relative;">
                <input type="password" id="cfg-unifi-apikey" class="nw-select" style="width: 100%; box-sizing: border-box; padding: 7px 10px; padding-right: 36px;" placeholder="Paste API Key generated in UniFi OS Settings" />
                <button type="button" id="cfg-unifi-toggle-key" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; font-size: 14px; opacity: 0.7;">👁️</button>
              </div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">
                Generated in UniFi OS: <strong>Control Plane &rarr; System &rarr; Integrations &rarr; API</strong>.
              </div>
            </div>

            <!-- Username / Password Input Group -->
            <div id="cfg-unifi-creds-group" style="display: none; flex-direction: column; gap: 10px;">
              <div>
                <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                  Local Username
                </label>
                <input type="text" id="cfg-unifi-username" class="nw-select" style="width: 100%; box-sizing: border-box; padding: 7px 10px;" placeholder="Local admin username" />
              </div>
              <div>
                <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                  Local Password
                </label>
                <input type="password" id="cfg-unifi-password" class="nw-select" style="width: 100%; box-sizing: border-box; padding: 7px 10px;" placeholder="Local admin password" />
              </div>
            </div>

            <!-- Site & SSL Options -->
            <div style="display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 120px;">
                <label style="display: block; font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                  Site Name
                </label>
                <input type="text" id="cfg-unifi-site" class="nw-select" value="default" style="width: 100%; box-sizing: border-box; padding: 6px 10px;" />
              </div>

              <div style="flex: 2; min-width: 200px; padding-bottom: 4px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="cfg-unifi-selfsigned" checked />
                  <span>Accept Self-Signed SSL (LAN Controllers)</span>
                </label>
              </div>
            </div>

            <!-- Test Connection Result Area -->
            <div id="cfg-unifi-test-result" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; line-height: 1.4;">
            </div>
          </div>

          <div class="nw-modal-footer" style="padding: 12px 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <button id="cfg-unifi-test-btn" class="nw-btn">
              <span>🔌 Test Connection</span>
            </button>

            <div style="display: flex; gap: 8px;">
              <button id="cfg-unifi-cancel-btn" class="nw-btn">Cancel</button>
              <button id="cfg-unifi-save-btn" class="nw-btn active">Save & Connect</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Sync Button
    const syncBtn = this.container.querySelector('#unifi-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.innerHTML = '<span>⏳ Syncing...</span>';
        await this.loadData();
        syncBtn.innerHTML = '<span>🔄 Sync</span>';
      });
    }

    // Demo / Live Toggle Button
    const demoBtn = this.container.querySelector('#unifi-demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', async () => {
        try {
          if (this.status && this.status.isDemo && this.status.hasSavedConfig) {
            demoBtn.innerHTML = '<span>⏳ Connecting Live...</span>';
            const res = await fetch('/api/unifi/reconnect', { method: 'POST' });
            if (res.ok) {
              await this.loadData();
            }
          } else {
            demoBtn.innerHTML = '<span>⏳ Loading Demo...</span>';
            const res = await fetch('/api/unifi/demo', { method: 'POST' });
            if (res.ok) {
              await this.loadData();
            }
          }
        } catch (err) {
          console.error('[UniFi] Demo/Live trigger error:', err);
        }
      });
    }

    // Subtab Buttons
    this.container.querySelectorAll('button[data-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        this.switchSubTab(sub);
      });
    });

    // Client Filter Buttons
    this.container.querySelectorAll('button[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('button[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.clientFilter = btn.getAttribute('data-filter');
        this.renderClientsView();
      });
    });

    // Client Search
    const searchInput = this.container.querySelector('#unifi-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.clientSearch = e.target.value.toLowerCase().trim();
        this.renderClientsView();
      });
    }

    // Modal Opening & Closing
    const bannerAddBtn = this.container.querySelector('#unifi-banner-add-api-btn');
    const configBtn = this.container.querySelector('#unifi-config-btn');
    const closeBtn = this.container.querySelector('#unifi-modal-close');
    const cancelBtn = this.container.querySelector('#cfg-unifi-cancel-btn');

    if (bannerAddBtn) bannerAddBtn.addEventListener('click', () => this.openConfigModal());
    if (configBtn) configBtn.addEventListener('click', () => this.openConfigModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeConfigModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeConfigModal());
    const modalElem = this.container.querySelector('#unifi-config-modal');
    if (modalElem) {
      modalElem.addEventListener('click', (e) => {
        if (e.target === modalElem) this.closeConfigModal();
      });
    }

    // Auth Type Radio Toggle
    const authRadios = this.container.querySelectorAll('input[name="unifi-auth-type"]');
    const apikeyGroup = this.container.querySelector('#cfg-unifi-apikey-group');
    const credsGroup = this.container.querySelector('#cfg-unifi-creds-group');

    authRadios.forEach(r => {
      r.addEventListener('change', () => {
        if (r.value === 'apiKey') {
          apikeyGroup.style.display = 'block';
          credsGroup.style.display = 'none';
        } else {
          apikeyGroup.style.display = 'none';
          credsGroup.style.display = 'flex';
        }
      });
    });

    // Toggle API Key visibility
    const toggleKeyBtn = this.container.querySelector('#cfg-unifi-toggle-key');
    const apiKeyInput = this.container.querySelector('#cfg-unifi-apikey');
    if (toggleKeyBtn && apiKeyInput) {
      toggleKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          toggleKeyBtn.textContent = '🔒';
        } else {
          apiKeyInput.type = 'password';
          toggleKeyBtn.textContent = '👁️';
        }
      });
    }

    // Quick fill UDM default URL
    const quickFillUdm = this.container.querySelector('#quick-fill-udm');
    if (quickFillUdm) {
      quickFillUdm.addEventListener('click', () => {
        const urlInput = this.container.querySelector('#cfg-unifi-url');
        if (urlInput) urlInput.value = 'https://192.168.1.1';
      });
    }

    // Test Connection Button
    const testBtn = this.container.querySelector('#cfg-unifi-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        await this.runConnectionTest();
      });
    }

    // Save & Connect Button
    const saveBtn = this.container.querySelector('#cfg-unifi-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await this.saveConfiguration();
      });
    }
  }

  sanitizeControllerUrl(raw) {
    if (!raw) return '';
    let url = String(raw).trim();
    // Remove all quotes anywhere
    url = url.replace(/["'`]/g, '').trim();

    // Remove duplicate schemes if pasted like https://"https://
    url = url.replace(/^(?:https?:\/*)+/i, (m) => m.toLowerCase().startsWith('http://') && !m.toLowerCase().includes('https') ? 'http://' : 'https://');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      url = parsed.origin;
    } catch {
      url = url.replace(/\/+$/, '');
    }
    return url;
  }

  async runConnectionTest() {
    const testBtn = this.container.querySelector('#cfg-unifi-test-btn');
    const resultBox = this.container.querySelector('#cfg-unifi-test-result');
    let url = this.sanitizeControllerUrl(this.container.querySelector('#cfg-unifi-url').value);
    this.container.querySelector('#cfg-unifi-url').value = url;

    const authType = this.container.querySelector('input[name="unifi-auth-type"]:checked').value;
    const apiKey = this.container.querySelector('#cfg-unifi-apikey').value.trim();
    const username = this.container.querySelector('#cfg-unifi-username').value.trim();
    const password = this.container.querySelector('#cfg-unifi-password').value;
    const site = this.container.querySelector('#cfg-unifi-site').value.trim() || 'default';
    const strictSsl = !this.container.querySelector('#cfg-unifi-selfsigned').checked;

    testBtn.innerHTML = '<span>⏳ Testing...</span>';
    testBtn.disabled = true;

    try {
      const res = await fetch('/api/unifi/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          controllerUrl: url,
          authType,
          apiKey,
          username,
          password,
          site,
          strictSsl
        })
      });
      const data = await res.json();

      resultBox.style.display = 'block';
      if (data.success) {
        if (data.resolvedUrl) {
          this.container.querySelector('#cfg-unifi-url').value = data.resolvedUrl;
        }
        resultBox.style.background = 'rgba(63, 185, 80, 0.15)';
        resultBox.style.border = '1px solid var(--status-good)';
        resultBox.style.color = 'var(--status-good)';
        resultBox.innerHTML = `✅ <strong>Success</strong>: ${data.message}`;
      } else {
        resultBox.style.background = 'rgba(248, 81, 73, 0.15)';
        resultBox.style.border = '1px solid var(--status-error)';
        resultBox.style.color = 'var(--status-error)';
        resultBox.innerHTML = `❌ <strong>Failed</strong>: ${data.error || 'Connection failed'}`;
      }
    } catch (err) {
      resultBox.style.display = 'block';
      resultBox.style.background = 'rgba(248, 81, 73, 0.15)';
      resultBox.style.border = '1px solid var(--status-error)';
      resultBox.style.color = 'var(--status-error)';
      const msg = err.message === 'Failed to fetch'
        ? 'Failed to connect to NetWatch backend. Please verify that the NetWatch server is running.'
        : err.message;
      resultBox.innerHTML = `❌ <strong>Error</strong>: ${msg}`;
    } finally {
      testBtn.innerHTML = '<span>🔌 Test Connection</span>';
      testBtn.disabled = false;
    }
  }

  async saveConfiguration() {
    const saveBtn = this.container.querySelector('#cfg-unifi-save-btn');
    const resultBox = this.container.querySelector('#cfg-unifi-test-result');
    let url = this.sanitizeControllerUrl(this.container.querySelector('#cfg-unifi-url').value);
    this.container.querySelector('#cfg-unifi-url').value = url;

    const authType = this.container.querySelector('input[name="unifi-auth-type"]:checked').value;
    const apiKey = this.container.querySelector('#cfg-unifi-apikey').value.trim();
    const username = this.container.querySelector('#cfg-unifi-username').value.trim();
    const password = this.container.querySelector('#cfg-unifi-password').value;
    const site = this.container.querySelector('#cfg-unifi-site').value.trim() || 'default';
    const strictSsl = !this.container.querySelector('#cfg-unifi-selfsigned').checked;

    saveBtn.innerHTML = '<span>⏳ Connecting...</span>';
    saveBtn.disabled = true;

    try {
      const res = await fetch('/api/unifi/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          controllerUrl: url,
          authType,
          apiKey,
          username,
          password,
          site,
          strictSsl
        })
      });
      const data = await res.json();

      if (data.success) {
        if (data.resolvedUrl) {
          this.container.querySelector('#cfg-unifi-url').value = data.resolvedUrl;
        }
        localStorage.setItem('nw_unifi_configured', 'true');
        const connectBanner = this.container.querySelector('#unifi-connect-banner');
        if (connectBanner) connectBanner.style.display = 'none';
        this.closeConfigModal();
        await this.loadData();
      } else {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(248, 81, 73, 0.15)';
        resultBox.style.border = '1px solid var(--status-error)';
        resultBox.style.color = 'var(--status-error)';
        resultBox.innerHTML = `❌ <strong>Failed to Connect</strong>: ${data.error || 'Authentication error'}`;
      }
    } catch (err) {
      resultBox.style.display = 'block';
      resultBox.style.background = 'rgba(248, 81, 73, 0.15)';
      resultBox.style.border = '1px solid var(--status-error)';
      resultBox.style.color = 'var(--status-error)';
      const msg = err.message === 'Failed to fetch'
        ? 'Failed to connect to NetWatch backend. Please verify that the NetWatch server is running.'
        : err.message;
      resultBox.innerHTML = `❌ <strong>Network Error</strong>: ${msg}`;
    } finally {
      saveBtn.innerHTML = 'Save & Connect';
      saveBtn.disabled = false;
    }
  }

  async openConfigModal() {
    const modal = this.container.querySelector('#unifi-config-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const resultBox = this.container.querySelector('#cfg-unifi-test-result');
    if (resultBox) resultBox.style.display = 'none';

    // Populate from active status immediately
    if (this.status) {
      this.populateModalFields(this.status);
    }

    // Then fetch persisted config from disk to ensure freshest values
    try {
      const res = await fetch('/api/unifi/config');
      if (res.ok) {
        const cfg = await res.json();
        this.populateModalFields(cfg);
      }
    } catch (err) {
      console.warn('[UniFi] Could not load persisted config in modal:', err.message);
    }
  }

  populateModalFields(cfg) {
    if (!cfg) return;
    const urlInput = this.container.querySelector('#cfg-unifi-url');
    const apiKeyInput = this.container.querySelector('#cfg-unifi-apikey');
    const usernameInput = this.container.querySelector('#cfg-unifi-username');
    const siteInput = this.container.querySelector('#cfg-unifi-site');
    const selfSignedCheck = this.container.querySelector('#cfg-unifi-selfsigned');
    const currentStatusBox = this.container.querySelector('#cfg-unifi-current-status');
    const apikeyGroup = this.container.querySelector('#cfg-unifi-apikey-group');
    const credsGroup = this.container.querySelector('#cfg-unifi-creds-group');

    if (urlInput && cfg.controllerUrl && !cfg.controllerUrl.includes('(Demo')) {
      urlInput.value = cfg.controllerUrl;
    }
    if (apiKeyInput && cfg.apiKey) {
      apiKeyInput.value = cfg.apiKey;
    }
    if (usernameInput && cfg.username) {
      usernameInput.value = cfg.username;
    }
    if (siteInput && cfg.site) {
      siteInput.value = cfg.site;
    }
    if (selfSignedCheck) {
      selfSignedCheck.checked = cfg.strictSsl === false;
    }

    const authType = cfg.authType || 'apiKey';
    const radio = this.container.querySelector(`input[name="unifi-auth-type"][value="${authType}"]`);
    if (radio) {
      radio.checked = true;
      if (apikeyGroup && credsGroup) {
        if (authType === 'apiKey') {
          apikeyGroup.style.display = 'block';
          credsGroup.style.display = 'none';
        } else {
          apikeyGroup.style.display = 'none';
          credsGroup.style.display = 'flex';
        }
      }
    }

    if (currentStatusBox) {
      const hasKey = !!cfg.apiKey;
      const hasCreds = !!(cfg.username && cfg.password);
      if (cfg.hasSavedConfig || hasKey || hasCreds) {
        currentStatusBox.style.display = 'block';
        const maskedKey = hasKey ? `${cfg.apiKey.slice(0, 6)}••••••••${cfg.apiKey.slice(-4)}` : '(configured)';
        currentStatusBox.innerHTML = `💾 <strong>Persisted Configuration Loaded</strong>: Controller: <code>${cfg.controllerUrl}</code> · Site: <code>${cfg.site || 'default'}</code> ${hasKey ? `· API Key: <code>${maskedKey}</code>` : `· User: <code>${cfg.username}</code>`}`;
      } else {
        currentStatusBox.style.display = 'none';
      }
    }
  }

  closeConfigModal() {
    const modal = this.container.querySelector('#unifi-config-modal');
    if (modal) {
      modal.style.display = 'none';
      const resultBox = this.container.querySelector('#cfg-unifi-test-result');
      if (resultBox) resultBox.style.display = 'none';
    }
  }

  switchSubTab(subTab) {
    this.activeSubTab = subTab;
    this.container.querySelectorAll('button[data-subtab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-subtab') === subTab);
    });

    const clientControls = this.container.querySelector('#unifi-client-controls');
    if (clientControls) {
      clientControls.style.display = subTab === 'clients' ? 'flex' : 'none';
    }

    this.renderSubTabContent();
  }

  async loadData() {
    this.isSyncing = true;
    try {
      const [statusRes, healthRes, devicesRes, clientsRes, networksRes, wlansRes] = await Promise.all([
        fetch('/api/unifi/status').then(r => r.json()).catch(() => null),
        fetch('/api/unifi/health').then(r => r.json()).catch(() => null),
        fetch('/api/unifi/devices').then(r => r.json()).catch(() => []),
        fetch('/api/unifi/clients').then(r => r.json()).catch(() => []),
        fetch('/api/unifi/networks').then(r => r.json()).catch(() => []),
        fetch('/api/unifi/wlans').then(r => r.json()).catch(() => [])
      ]);

      this.status = statusRes;
      this.health = healthRes;
      this.devices = devicesRes || [];
      this.clients = clientsRes || [];
      this.networks = networksRes || [];
      this.wlans = wlansRes || [];

      this.updateHeaderAndKPIs();
      this.renderSubTabContent();
    } catch (err) {
      console.error('[UniFi] Error loading data:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  updateHeaderAndKPIs() {
    const statusPill = this.container.querySelector('#unifi-status-pill');
    const controllerBadge = this.container.querySelector('#unifi-controller-badge');

    if (this.status && statusPill) {
      if (this.status.isDemo) {
        statusPill.className = 'nw-status-pill';
        statusPill.style.background = 'rgba(0, 210, 255, 0.12)';
        statusPill.style.color = 'var(--brand)';
        statusPill.textContent = '● DEMO LAB';
      } else if (this.status.connected) {
        statusPill.className = 'nw-status-pill live';
        statusPill.style.background = 'rgba(63, 185, 80, 0.15)';
        statusPill.style.color = 'var(--status-good)';
        statusPill.textContent = '● ONLINE';
      } else {
        statusPill.className = 'nw-status-pill';
        statusPill.style.background = 'rgba(255, 255, 255, 0.08)';
        statusPill.style.color = 'var(--text-muted)';
        statusPill.textContent = '○ NOT CONFIGURED';
      }
    }

    const connectBanner = this.container.querySelector('#unifi-connect-banner');
    if (connectBanner) {
      if (this.status && (this.status.hasSavedConfig || (!this.status.isDemo && this.status.connected))) {
        connectBanner.style.display = 'none';
        localStorage.setItem('nw_unifi_configured', 'true');
      } else {
        connectBanner.style.display = 'flex';
        localStorage.removeItem('nw_unifi_configured');
      }
    }

    const demoBtn = this.container.querySelector('#unifi-demo-btn');
    if (demoBtn && this.status) {
      if (this.status.isDemo && this.status.hasSavedConfig) {
        demoBtn.innerHTML = '<span>🌐 Switch to Live UDM</span>';
        demoBtn.title = 'Reconnect to your saved live UniFi Controller';
        demoBtn.style.background = 'rgba(63, 185, 80, 0.15)';
        demoBtn.style.color = 'var(--status-good)';
        demoBtn.style.borderColor = 'var(--status-good)';
      } else {
        demoBtn.innerHTML = '<span>🧪 Demo Lab</span>';
        demoBtn.title = 'Load Demo Network';
        demoBtn.style.background = '';
        demoBtn.style.color = '';
        demoBtn.style.borderColor = '';
      }
    }

    if (this.status && this.status.controllerInfo && controllerBadge) {
      const info = this.status.controllerInfo;
      controllerBadge.textContent = `${info.name} · ${info.version}`;
    }

    // KPIs
    const gatewayVal = this.container.querySelector('#kpi-unifi-gateway');
    const wanSub = this.container.querySelector('#kpi-unifi-wan');
    if (this.health && this.health.wan && gatewayVal) {
      gatewayVal.textContent = this.health.wan.gateway || 'UDM';
      wanSub.textContent = `${this.health.wan.ip || '-'} · ${this.health.wan.latencyMs || 8}ms ping`;
    }

    const devCount = this.container.querySelector('#kpi-unifi-dev-count');
    const devChip = this.container.querySelector('#kpi-unifi-dev-chip');
    const subtabDevCount = this.container.querySelector('#unifi-subtab-dev-count');
    if (devCount) devCount.textContent = this.devices.length;
    if (devChip) devChip.textContent = `${this.devices.length} Adopted`;
    if (subtabDevCount) subtabDevCount.textContent = this.devices.length;

    const cliCount = this.container.querySelector('#kpi-unifi-cli-count');
    const cliChip = this.container.querySelector('#kpi-unifi-cli-chip');
    const cliSub = this.container.querySelector('#kpi-unifi-cli-sub');
    const subtabCliCount = this.container.querySelector('#unifi-subtab-cli-count');

    const wifiClients = this.clients.filter(c => !c.is_wired).length;
    const wiredClients = this.clients.filter(c => c.is_wired).length;

    if (cliCount) cliCount.textContent = this.clients.length;
    if (cliChip) cliChip.textContent = `${this.clients.length} Online`;
    if (cliSub) cliSub.textContent = `${wifiClients} Wireless · ${wiredClients} Wired`;
    if (subtabCliCount) subtabCliCount.textContent = this.clients.length;

    // Subnets & SSIDs Subtab badge
    const subtabHealthCount = this.container.querySelector('#unifi-subtab-health-count');
    if (subtabHealthCount) {
      subtabHealthCount.textContent = `${this.networks.length} VLANs · ${this.wlans.length} SSIDs`;
    }

    // WiFi Experience
    const wifiExp = this.container.querySelector('#kpi-unifi-wifi-exp');
    if (this.health && this.health.wlan && wifiExp) {
      wifiExp.textContent = `${this.health.wlan.experienceScore || 98}%`;
    }

    // PoE Budget
    const poeVal = this.container.querySelector('#kpi-unifi-poe-val');
    const poeChip = this.container.querySelector('#kpi-unifi-poe-chip');
    if (this.health && this.health.poe && poeVal) {
      poeVal.textContent = `${this.health.poe.usedWatts}W / ${this.health.poe.totalBudgetWatts}W`;
      if (poeChip) poeChip.textContent = `${this.health.poe.percentUsed}%`;
    }
  }

  renderSubTabContent() {
    const body = this.container.querySelector('#unifi-tab-body');
    if (!body) return;

    if (this.activeSubTab === 'clients') {
      this.renderClientsView();
    } else if (this.activeSubTab === 'devices') {
      this.renderDevicesView();
    } else if (this.activeSubTab === 'health') {
      this.renderHealthView();
    }
  }

  renderClientsView() {
    const body = this.container.querySelector('#unifi-tab-body');
    if (!body) return;

    let filtered = [...this.clients];

    // Filter by type
    if (this.clientFilter === 'wifi') {
      filtered = filtered.filter(c => !c.is_wired);
    } else if (this.clientFilter === 'wired') {
      filtered = filtered.filter(c => c.is_wired);
    }

    // Search query
    if (this.clientSearch) {
      const q = this.clientSearch;
      filtered = filtered.filter(c =>
        (c.hostname && c.hostname.toLowerCase().includes(q)) ||
        (c.ip && c.ip.includes(q)) ||
        (c.mac && c.mac.toLowerCase().includes(q)) ||
        (c.vendor && c.vendor.toLowerCase().includes(q)) ||
        (c.essid && c.essid.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      body.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No UniFi clients found matching "<strong>${this.clientSearch || this.clientFilter}</strong>".
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="nw-table-container">
        <table class="nw-table">
          <thead>
            <tr>
              <th>Client Device</th>
              <th>IP &amp; MAC</th>
              <th>Vendor</th>
              <th>Uplink / Port</th>
              <th>Connection Details</th>
              <th>Signal</th>
              <th>Transfer (RX / TX)</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(c => {
              const icon = this._getDeviceIcon(c.hostname, c.vendor);
              const signalHtml = c.is_wired
                ? `<span class="nw-chip established" style="font-size: 10px;">🔌 Gigabit Wired</span>`
                : this._renderSignalMeter(c.signal || c.rssi || -50);

              const connectionHtml = c.is_wired
                ? `<span>${c.sw_name || 'Switch'} · Port ${c.sw_port || 1} (${c.port_speed || 1000}M)</span>`
                : `<span style="display: flex; align-items: center; gap: 4px;">
                     <span>${c.ap_name || 'Access Point'}</span>
                     <span class="nw-version-tag" style="font-size: 9px; padding: 1px 4px;">${c.radio || '5G'} Ch ${c.channel || 36}</span>
                   </span>`;

              const rxStr = this._formatBytes(c.rx_bytes || 1024000);
              const txStr = this._formatBytes(c.tx_bytes || 512000);

              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">${icon}</span>
                      <div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 12.5px;">${c.hostname || 'Unnamed Client'}</div>
                        <div style="font-size: 10.5px; color: var(--text-muted);">${c.essid || 'VLAN 1'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="font-family: var(--font-mono); font-size: 11.5px; color: var(--brand); font-weight: 600;">${c.ip || '-'}</div>
                    <div style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">${c.mac || '-'}</div>
                  </td>
                  <td style="font-size: 11.5px; color: var(--text-secondary);">${c.vendor || 'Unknown Vendor'}</td>
                  <td style="font-size: 11.5px;">${connectionHtml}</td>
                  <td>
                    <div style="font-size: 11px;">
                      ${c.is_wired ? 'Ethernet Cat6' : (c.wifi_standard ? `<strong>${c.wifi_standard}</strong> (${c.tx_rate || 866} Mbps)` : 'Wi-Fi')}
                    </div>
                  </td>
                  <td>${signalHtml}</td>
                  <td style="font-family: var(--font-mono); font-size: 11px;">
                    <span style="color: var(--rx-rate);">↓ ${rxStr}</span>
                    <span style="color: var(--text-muted); margin: 0 4px;">/</span>
                    <span style="color: var(--tx-rate);">↑ ${txStr}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderDevicesView() {
    const body = this.container.querySelector('#unifi-tab-body');
    if (!body) return;

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${this.devices.map(dev => {
          const typeIcon = dev.type === 'ugw' ? '🛡️' : (dev.type === 'usw' ? '🎛️' : '📡');
          const typeBadge = dev.type === 'ugw' ? 'Gateway' : (dev.type === 'usw' ? 'Switch' : 'Access Point');

          return `
            <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">${typeIcon}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${dev.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                      Model: <strong>${dev.model}</strong> · IP: <span style="color: var(--brand);">${dev.ip}</span> · MAC: ${dev.mac}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="nw-chip established" style="font-size: 10.5px;">● Online</span>
                  <span class="nw-version-tag">${typeBadge} · v${dev.version || '7.x'}</span>
                </div>
              </div>

              <!-- Metrics Row -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px; font-size: 11.5px;">
                <div style="background: var(--bg-app); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                  <div style="color: var(--text-muted); font-size: 10px;">CPU LOAD</div>
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${dev.cpu || 15}%</div>
                </div>
                <div style="background: var(--bg-app); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                  <div style="color: var(--text-muted); font-size: 10px;">MEMORY LOAD</div>
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${dev.mem || 45}%</div>
                </div>
                <div style="background: var(--bg-app); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                  <div style="color: var(--text-muted); font-size: 10px;">TEMPERATURE</div>
                  <div style="font-weight: 700; font-size: 14px; color: var(--status-good);">${dev.temperature || 42}°C</div>
                </div>
                ${dev.total_poe_power ? `
                  <div style="background: var(--bg-app); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-muted); font-size: 10px;">POE LOAD</div>
                    <div style="font-weight: 700; font-size: 14px; color: var(--status-warn);">${dev.used_poe_power}W / ${dev.total_poe_power}W</div>
                  </div>
                ` : ''}
                ${dev.connected_clients !== undefined ? `
                  <div style="background: var(--bg-app); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <div style="color: var(--text-muted); font-size: 10px;">CONNECTED CLIENTS</div>
                    <div style="font-weight: 700; font-size: 14px; color: var(--brand);">${dev.connected_clients} Clients</div>
                  </div>
                ` : ''}
              </div>

              <!-- Ports or Radios Matrix -->
              ${dev.ports ? this._renderPortsMatrix(dev.ports) : ''}
              ${dev.radios ? this._renderRadiosMatrix(dev.radios) : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderPortsMatrix(ports) {
    return `
      <div style="margin-top: 10px;">
        <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">ACTIVE PORT CONNECTIONS</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${ports.map(p => {
            const isUp = p.up;
            const isPoe = p.poe;
            return `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 68px; height: 50px; background: ${isUp ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${isUp ? 'rgba(0, 210, 255, 0.3)' : 'var(--border-subtle)'}; border-radius: 5px; padding: 2px 4px; box-sizing: border-box;" title="${p.name} · ${p.speed} Mbps ${isPoe ? `· ${p.poe_class || 'PoE'} (${p.poe_power}W)` : ''}">
                <div style="font-size: 9.5px; font-weight: 700; color: ${isUp ? 'var(--brand)' : 'var(--text-muted)'}; font-family: var(--font-mono);">
                  ${p.port_idx || p.name}
                </div>
                <div style="font-size: 8.5px; color: ${isUp ? 'var(--status-good)' : 'var(--text-muted)'}; font-family: var(--font-mono);">
                  ${isUp ? (p.speed >= 10000 ? '10G' : (p.speed >= 2500 ? '2.5G' : '1G')) : 'Down'}
                </div>
                ${isPoe ? `<div style="font-size: 8px; color: var(--status-warn); font-weight: 600;">⚡ ${p.poe_power}W</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  _renderRadiosMatrix(radios) {
    return `
      <div style="margin-top: 10px;">
        <div style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">WI-FI RADIOS &amp; CHANNEL UTILIZATION</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
          ${radios.map(r => `
            <div style="background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-weight: 700; color: var(--brand); font-size: 11px;">${r.band} Radio</span>
                <span class="nw-version-tag" style="font-size: 9px;">Ch ${r.channel} (${r.width}MHz)</span>
              </div>
              <div style="font-size: 10.5px; color: var(--text-muted); margin-bottom: 4px;">
                TX Power: ${r.tx_power} dBm · Channel Utilization: <strong style="color: var(--text-primary);">${r.utilization}%</strong>
              </div>
              <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                <div style="width: ${r.utilization}%; height: 100%; background: ${r.utilization > 50 ? 'var(--status-warn)' : 'var(--status-good)'};"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderHealthView() {
    const body = this.container.querySelector('#unifi-tab-body');
    if (!body || !this.health) return;

    const networks = this.networks || [];
    const wlans = this.wlans || [];

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Top Status Overview -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
          <!-- WAN Subsystem -->
          <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <div class="nw-panel-title" style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>🌐</span> WAN Uplink &amp; Internet Health
              </div>
              <span class="nw-chip established">Connected</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Gateway Router:</span>
                <span style="font-weight: 700; color: var(--text-primary);">${this.health.wan?.gateway || 'UniFi Gateway'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Public Uplink IP:</span>
                <span style="font-family: var(--font-mono); color: var(--brand);">${this.health.wan?.ip || '-'}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Ping Latency / Jitter:</span>
                <span style="color: var(--status-good); font-weight: 600;">${this.health.wan?.latencyMs || 7.5} ms (0.0% packet loss)</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                <span style="color: var(--text-muted);">Capacity Profile:</span>
                <span>↓ 940 Mbps / ↑ 915 Mbps (Gigabit Fiber)</span>
              </div>
            </div>
          </div>

          <!-- Wi-Fi Experience & Radio Metrics -->
          <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <div class="nw-panel-title" style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>📶</span> RF Health &amp; Experience
              </div>
              <span class="nw-chip established">${this.health.wlan?.experienceScore || 98}% Score</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">Active SSIDs:</span>
                <span style="font-weight: 700; color: var(--text-primary);">${wlans.length} Broadcast Networks</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">2.4 GHz Band Utilization:</span>
                <span style="font-family: var(--font-mono); color: var(--status-good); font-weight: 600;">${this.health.wlan?.channelUtilization24 || 14.5}% (Low)</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--text-muted);">5 GHz Band Utilization:</span>
                <span style="font-family: var(--font-mono); color: var(--status-good); font-weight: 600;">${this.health.wlan?.channelUtilization5 || 11.2}% (Low)</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                <span style="color: var(--text-muted);">6 GHz Band Utilization:</span>
                <span style="font-family: var(--font-mono); color: var(--brand); font-weight: 600;">${this.health.wlan?.channelUtilization6 || 4.8}% (Optimal)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Configured Subnets & VLANs -->
        <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🔌</span>
              <div>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">Configured Subnets &amp; VLANs</div>
                <div style="font-size: 11px; color: var(--text-muted);">All internal IP subnets, VLAN IDs, and DHCP pools configured on the gateway router</div>
              </div>
            </div>
            <span class="nw-version-tag" style="font-size: 11px;">${networks.length} Total Networks</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            ${networks.map(net => {
              const isWan = net.purpose === 'wan';
              const purposeBadge = isWan ? 'WAN Uplink' : (net.purpose === 'guest' ? 'Guest Network' : 'Corporate LAN');
              const purposeClass = isWan ? 'listen' : (net.purpose === 'guest' ? 'close_wait' : 'established');
              return `
                <div style="background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                      <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${net.name}</span>
                      <span class="nw-chip ${purposeClass}" style="font-size: 9.5px;">${purposeBadge}</span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                      <span class="nw-version-tag" style="background: rgba(0, 210, 255, 0.12); color: var(--brand); font-weight: 700;">
                        ${net.vlanLabel || (net.vlan ? `VLAN ${net.vlan}` : 'Untagged')}
                      </span>
                      ${net.subnet ? `
                        <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-primary);">
                          ${net.subnet}
                        </span>
                      ` : `
                        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
                          Dynamic ISP Gateway
                        </span>
                      `}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--text-secondary);">
                      ${net.gatewayIp ? `
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: var(--text-muted);">Gateway IP:</span>
                          <span style="font-family: var(--font-mono); color: var(--text-primary);">${net.gatewayIp}</span>
                        </div>
                      ` : ''}
                      <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">DHCP Range:</span>
                        <span style="font-family: var(--font-mono); color: ${net.dhcpEnabled ? 'var(--status-good)' : 'var(--text-muted)'};">
                          ${net.dhcpRange}
                        </span>
                      </div>
                      ${net.dnsServers && net.dnsServers.length > 0 ? `
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: var(--text-muted);">DNS Resolvers:</span>
                          <span style="font-family: var(--font-mono);">${net.dnsServers.join(', ')}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <div style="border-top: 1px solid var(--border-subtle); padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
                    <span>IGMP Snooping: <strong>${net.igmpSnooping ? 'Enabled' : 'Disabled'}</strong></span>
                    <span style="color: var(--status-good);">● Active</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Section: Configured Wireless SSIDs -->
        <div class="nw-panel" style="background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📡</span>
              <div>
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">Configured Wireless Networks (SSIDs)</div>
                <div style="font-size: 11px; color: var(--text-muted);">Wi-Fi SSIDs broadcasted across UniFi Access Points with security and VLAN mappings</div>
              </div>
            </div>
            <span class="nw-version-tag" style="font-size: 11px;">${wlans.length} Active SSIDs</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            ${wlans.map(w => {
              return `
                <div style="background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">📶</span>
                        <span style="font-weight: 700; font-size: 14px; color: var(--brand);">${w.name}</span>
                      </div>
                      ${w.hideSsid ? `
                        <span class="nw-chip close_wait" style="font-size: 9.5px;">🔒 Hidden</span>
                      ` : `
                        <span class="nw-chip established" style="font-size: 9.5px;">● Broadcast</span>
                      `}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--text-secondary); margin-top: 8px;">
                      <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Security Mode:</span>
                        <span class="nw-version-tag" style="font-size: 10px; color: var(--text-primary); font-weight: 600;">
                          ${w.security}
                        </span>
                      </div>
                      <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Network Mapping:</span>
                        <span style="font-weight: 600; color: var(--brand);">
                          ${w.networkName} (${w.vlanLabel || `VLAN ${w.vlan}`})
                        </span>
                      </div>
                      <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Subnet Range:</span>
                        <span style="font-family: var(--font-mono); font-size: 10.5px;">
                          ${w.subnet || '-'}
                        </span>
                      </div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="color: var(--text-muted);">Radio Bands:</span>
                        <div style="display: flex; gap: 4px;">
                          ${w.bands.map(b => `
                            <span class="nw-version-tag" style="font-size: 9px; padding: 1px 5px; background: rgba(255,255,255,0.06);">
                              ${b}
                            </span>
                          `).join('')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style="border-top: 1px solid var(--border-subtle); padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--text-muted);">
                    <span>Fast Roaming: <strong style="color: ${w.fastRoaming ? 'var(--status-good)' : 'var(--text-muted)'};">${w.fastRoaming ? '802.11r Enabled' : 'Disabled'}</strong></span>
                    <span>Client Isolation: <strong>${w.clientIsolation ? 'Enabled' : 'Off'}</strong></span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  _renderSignalMeter(rssi) {
    let color = 'var(--status-good)';
    let bars = 4;
    if (rssi < -75) {
      color = 'var(--status-error)';
      bars = 1;
    } else if (rssi < -65) {
      color = 'var(--status-warn)';
      bars = 2;
    } else if (rssi < -55) {
      color = 'var(--status-good)';
      bars = 3;
    }

    return `
      <div style="display: flex; align-items: center; gap: 6px;" title="${rssi} dBm">
        <div style="display: flex; align-items: flex-end; gap: 2px; height: 12px;">
          <div style="width: 3px; height: 3px; background: ${bars >= 1 ? color : 'rgba(255,255,255,0.1)'}; border-radius: 1px;"></div>
          <div style="width: 3px; height: 6px; background: ${bars >= 2 ? color : 'rgba(255,255,255,0.1)'}; border-radius: 1px;"></div>
          <div style="width: 3px; height: 9px; background: ${bars >= 3 ? color : 'rgba(255,255,255,0.1)'}; border-radius: 1px;"></div>
          <div style="width: 3px; height: 12px; background: ${bars >= 4 ? color : 'rgba(255,255,255,0.1)'}; border-radius: 1px;"></div>
        </div>
        <span style="font-family: var(--font-mono); font-size: 10.5px; color: ${color}; font-weight: 600;">${rssi} dBm</span>
      </div>
    `;
  }

  _getDeviceIcon(hostname, vendor) {
    const text = `${hostname || ''} ${vendor || ''}`.toLowerCase();
    if (text.includes('macbook') || text.includes('laptop') || text.includes('thinkpad')) return '💻';
    if (text.includes('iphone') || text.includes('pixel') || text.includes('phone') || text.includes('samsung')) return '📱';
    if (text.includes('ipad') || text.includes('tablet')) return '📋';
    if (text.includes('tv') || text.includes('oled') || text.includes('apple-tv') || text.includes('roku')) return '📺';
    if (text.includes('cam') || text.includes('doorbell') || text.includes('g5') || text.includes('g4')) return '📹';
    if (text.includes('sonos') || text.includes('speaker') || text.includes('homepod') || text.includes('audio')) return '🔊';
    if (text.includes('nas') || text.includes('synology') || text.includes('server')) return '🗄️';
    if (text.includes('hue') || text.includes('light') || text.includes('ecobee') || text.includes('thermostat')) return '💡';
    return '🔌';
  }

  _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  update(data) {
    // Called periodically by telemetry ticks if needed
    if (!this.isSyncing && (!this.clients || this.clients.length === 0)) {
      this.loadData();
    }
  }
}
