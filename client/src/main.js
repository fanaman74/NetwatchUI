// NetWatch Web Application - Main Orchestrator
import { telemetry } from './services/telemetry.js';
import { DashboardTab } from './components/Tabs/DashboardTab.js';
import { ConnectionsTab } from './components/Tabs/ConnectionsTab.js';
import { InterfacesTab } from './components/Tabs/InterfacesTab.js';
import { PacketsTab } from './components/Tabs/PacketsTab.js';
import { StatsTab } from './components/Tabs/StatsTab.js';
import { TopologyTab } from './components/Tabs/TopologyTab.js';
import { TimelineTab } from './components/Tabs/TimelineTab.js';
import { ProcessesTab } from './components/Tabs/ProcessesTab.js';
import { DiagnoseTab } from './components/Tabs/DiagnoseTab.js';
import { EgressTab } from './components/Tabs/EgressTab.js';
import { DenseView } from './components/Views/DenseView.js';
import { LiteView } from './components/Views/LiteView.js';
import { showHelpModal } from './components/Modals/HelpModal.js';
import { DoctorScreen } from './components/DoctorScreen.js';

const THEMES = ['dark', 'dracula', 'nord', 'ocean', 'solarized', 'sky', 'paper', 'terminal'];

class NetWatchApp {
  constructor() {
    this.currentView = 'full'; // 'full' | 'dense' | 'lite'
    this.activeTabId = 1; // 1 to 10 (0 is 10)
    this.currentTheme = localStorage.getItem('nw_theme') || 'dark';
    this.activeTabComponent = null;
    this.viewComponent = null;
    this.latestData = null;

    this.applyTheme(this.currentTheme);
    this.initDOM();
    this.initTabComponents();
    this.bindKeyboardShortcuts();
    this.connectTelemetry();

    // Run Pre-Flight System Check on startup unless skipped
    const skipDoctor = localStorage.getItem('nw_skip_doctor') === 'true';
    if (!skipDoctor) {
      this.openDoctorPreflight();
    }
  }

  openDoctorPreflight() {
    const doctor = new DoctorScreen(async (selectedMode) => {
      if (selectedMode) {
        await telemetry.setMode(selectedMode);
      }
    });
    doctor.runChecks();
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nw_theme', theme);

    const themeSelect = document.querySelector('#theme-select');
    if (themeSelect) themeSelect.value = theme;
  }

  cycleTheme() {
    const idx = THEMES.indexOf(this.currentTheme);
    const nextTheme = THEMES[(idx + 1) % THEMES.length];
    this.applyTheme(nextTheme);
  }

  initDOM() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <!-- Header -->
      <header class="nw-header">
        <div class="nw-brand">
          <div class="nw-logo">
            <span>🛡️ NETWATCH</span>
            <span class="nw-version">v0.30</span>
          </div>

          <div id="mode-pill" class="nw-banner-pill">
            <span class="nw-pulse-dot"></span>
            <span id="mode-label">LIVE HOST TELEMETRY</span>
          </div>
        </div>

        <div class="nw-header-controls">
          <!-- Live / Demo Switcher -->
          <button id="toggle-mode-btn" class="nw-btn" title="Toggle Live Host vs Scenario Replay [D]">
            🔄 Switch to Demo Scenario [D]
          </button>

          <!-- View Mode Selector -->
          <div style="display: flex; gap: 2px; background: var(--bg-panel-solid); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px;">
            <button class="nw-btn active" id="view-btn-full" data-view="full" title="Full 10-Tab View">Full [V]</button>
            <button class="nw-btn" id="view-btn-dense" data-view="dense" title="Dense 4-Box Layout">Dense</button>
            <button class="nw-btn" id="view-btn-lite" data-view="lite" title="Lite 80x24 Terminal">Lite</button>
          </div>

          <!-- Theme Picker -->
          <select id="theme-select" class="nw-select" title="Switch Theme [T]">
            <option value="dark">Theme: Dark</option>
            <option value="dracula">Theme: Dracula</option>
            <option value="nord">Theme: Nord</option>
            <option value="ocean">Theme: Ocean</option>
            <option value="solarized">Theme: Solarized</option>
            <option value="sky">Theme: Sky</option>
            <option value="paper">Theme: Paper (Light)</option>
            <option value="terminal">Theme: Terminal ANSI</option>
          </select>

          <!-- Pause / Resume -->
          <button id="pause-btn" class="nw-btn" title="Pause / Resume Live Telemetry [P]">
            ⏸️ Pause [P]
          </button>

          <!-- Doctor Pre-flight Button -->
          <button id="doctor-btn" class="nw-btn" title="Run NetWatch Doctor Capability Check">
            🩺 Doctor
          </button>

          <!-- Help Keybindings Button -->
          <button id="help-btn" class="nw-btn" title="Help & Keybindings [?]">
            ❓ [?]
          </button>
        </div>
      </header>

      <!-- Tab Bar (Only visible in Full view) -->
      <nav class="nw-tabs-bar" id="tabs-bar">
        <button class="nw-tab active" data-tab="1"><span class="nw-key-badge">1</span> Dashboard</button>
        <button class="nw-tab" data-tab="2"><span class="nw-key-badge">2</span> Connections</button>
        <button class="nw-tab" data-tab="3"><span class="nw-key-badge">3</span> Interfaces</button>
        <button class="nw-tab" data-tab="4"><span class="nw-key-badge">4</span> Packets</button>
        <button class="nw-tab" data-tab="5"><span class="nw-key-badge">5</span> Stats</button>
        <button class="nw-tab" data-tab="6"><span class="nw-key-badge">6</span> Topology</button>
        <button class="nw-tab" data-tab="7"><span class="nw-key-badge">7</span> Timeline</button>
        <button class="nw-tab" data-tab="8"><span class="nw-key-badge">8</span> Processes</button>
        <button class="nw-tab" data-tab="9">
          <span class="nw-key-badge">9</span> Diagnose
          <span id="tab-diagnose-badge" class="nw-badge-count" style="display: none;">1</span>
        </button>
        <button class="nw-tab" data-tab="10">
          <span class="nw-key-badge">0</span> Egress
          <span id="tab-egress-badge" class="nw-badge-count" style="display: none; background: var(--status-warn);">!</span>
        </button>
      </nav>

      <!-- Main Workspace -->
      <main class="nw-main" id="main-content"></main>

      <!-- Footer -->
      <footer class="nw-footer">
        <div class="nw-footer-hints">
          <span>[1-0] Tabs</span>
          <span>[V] Cycle View</span>
          <span>[T] Theme</span>
          <span>[D] Live/Demo</span>
          <span>[P] Pause</span>
          <span>[/] Filter</span>
          <span>[?] Help</span>
        </div>
        <div id="footer-status" style="display: flex; gap: 14px; align-items: center;">
          <span id="ws-status" style="color: var(--status-good);">● Connected</span>
          <span id="footer-time">00:00:00</span>
        </div>
      </footer>
    `;

    // Bind header controls
    document.querySelector('#theme-select').addEventListener('change', (e) => {
      this.applyTheme(e.target.value);
    });

    document.querySelector('#help-btn').addEventListener('click', () => {
      showHelpModal();
    });

    document.querySelector('#doctor-btn').addEventListener('click', () => {
      this.openDoctorPreflight();
    });

    document.querySelector('#toggle-mode-btn').addEventListener('click', async () => {
      const newMode = this.latestData && this.latestData.mode === 'live' ? 'demo' : 'live';
      await telemetry.setMode(newMode);
    });

    document.querySelector('#pause-btn').addEventListener('click', async () => {
      await telemetry.togglePause();
    });

    // View buttons
    document.querySelectorAll('button[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView(btn.getAttribute('data-view'));
      });
    });

    // Tab buttons
    document.querySelectorAll('.nw-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const id = parseInt(tab.getAttribute('data-tab'), 10);
        this.switchTab(id);
      });
    });
  }

  switchView(viewMode) {
    this.currentView = viewMode;
    const tabsBar = document.querySelector('#tabs-bar');
    const main = document.querySelector('#main-content');

    document.querySelectorAll('button[data-view]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-view') === viewMode);
    });

    if (viewMode === 'full') {
      tabsBar.style.display = 'flex';
      this.switchTab(this.activeTabId);
    } else if (viewMode === 'dense') {
      tabsBar.style.display = 'none';
      main.innerHTML = '';
      this.viewComponent = new DenseView(main);
      if (this.latestData) this.viewComponent.update(this.latestData);
    } else if (viewMode === 'lite') {
      tabsBar.style.display = 'none';
      main.innerHTML = '';
      this.viewComponent = new LiteView(main);
      if (this.latestData) this.viewComponent.update(this.latestData);
    }
  }

  cycleView() {
    if (this.currentView === 'full') this.switchView('dense');
    else if (this.currentView === 'dense') this.switchView('lite');
    else this.switchView('full');
  }

  switchTab(tabId) {
    this.activeTabId = tabId;
    const main = document.querySelector('#main-content');
    main.innerHTML = '';

    document.querySelectorAll('.nw-tab').forEach(tab => {
      tab.classList.toggle('active', parseInt(tab.getAttribute('data-tab'), 10) === tabId);
    });

    switch (tabId) {
      case 1: this.activeTabComponent = new DashboardTab(main); break;
      case 2: this.activeTabComponent = new ConnectionsTab(main); break;
      case 3: this.activeTabComponent = new InterfacesTab(main); break;
      case 4: this.activeTabComponent = new PacketsTab(main); break;
      case 5: this.activeTabComponent = new StatsTab(main); break;
      case 6: this.activeTabComponent = new TopologyTab(main); break;
      case 7: this.activeTabComponent = new TimelineTab(main); break;
      case 8: this.activeTabComponent = new ProcessesTab(main); break;
      case 9: this.activeTabComponent = new DiagnoseTab(main); break;
      case 10: this.activeTabComponent = new EgressTab(main); break;
    }

    if (this.latestData && this.activeTabComponent) {
      this.activeTabComponent.update(this.latestData);
    }
  }

  initTabComponents() {
    this.switchTab(1);
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing inside input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      if (e.key === '?') {
        showHelpModal();
      } else if (e.key === 'v' || e.key === 'V') {
        this.cycleView();
      } else if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === 'd' || e.key === 'D') {
        const toggleBtn = document.querySelector('#toggle-mode-btn');
        if (toggleBtn) toggleBtn.click();
      } else if (e.key === 'p' || e.key === 'P' || e.key === ' ') {
        e.preventDefault();
        const pauseBtn = document.querySelector('#pause-btn');
        if (pauseBtn) pauseBtn.click();
      } else if (e.key === 'e' || e.key === 'E') {
        telemetry.downloadPcap();
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) searchInput.focus();
      } else if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key, 10);
        if (this.currentView === 'dense') {
          if (num >= 1 && num <= 4 && this.viewComponent && this.viewComponent.toggleZoom) {
            this.viewComponent.toggleZoom(num);
          }
        } else {
          this.switchTab(num);
        }
      } else if (e.key === '0') {
        this.switchTab(10);
      }
    });
  }

  connectTelemetry() {
    telemetry.subscribe((data) => {
      this.latestData = data;
      this.updateHeaderAndStatus(data);

      if (this.currentView === 'full') {
        if (this.activeTabComponent) {
          this.activeTabComponent.update(data);
        }
      } else if (this.viewComponent) {
        this.viewComponent.update(data);
      }
    });
  }

  updateHeaderAndStatus(data) {
    // Mode pill
    const modePill = document.querySelector('#mode-pill');
    const modeLabel = document.querySelector('#mode-label');
    const toggleBtn = document.querySelector('#toggle-mode-btn');
    const pauseBtn = document.querySelector('#pause-btn');
    const footerTime = document.querySelector('#footer-time');
    const diagBadge = document.querySelector('#tab-diagnose-badge');
    const egressBadge = document.querySelector('#tab-egress-badge');

    if (data.mode === 'live') {
      if (modePill) {
        modePill.className = 'nw-banner-pill';
        modeLabel.textContent = 'LIVE HOST TELEMETRY';
      }
      if (toggleBtn) toggleBtn.innerHTML = '🔄 Switch to Demo Scenario [D]';
    } else {
      if (modePill) {
        modePill.className = 'nw-banner-pill demo';
        modeLabel.textContent = 'DEMO SCENARIO (NetWatch 0.30 Arc)';
      }
      if (toggleBtn) toggleBtn.innerHTML = '🔄 Switch to Live Host [D]';
    }

    if (pauseBtn) {
      if (data.isPaused) {
        pauseBtn.innerHTML = '▶️ Resume [P]';
        pauseBtn.classList.add('active');
      } else {
        pauseBtn.innerHTML = '⏸️ Pause [P]';
        pauseBtn.classList.remove('active');
      }
    }

    if (footerTime) footerTime.textContent = data.time || '00:00:00';

    // Diagnose badge
    if (diagBadge && data.diagnose && data.diagnose.activeIssues) {
      const count = data.diagnose.activeIssues.length;
      if (count > 0) {
        diagBadge.style.display = 'inline-block';
        diagBadge.textContent = count;
      } else {
        diagBadge.style.display = 'none';
      }
    }

    // Egress badge
    if (egressBadge && data.egress) {
      if (data.egress.driftCount > 0) {
        egressBadge.style.display = 'inline-block';
        egressBadge.textContent = data.egress.driftCount;
      } else {
        egressBadge.style.display = 'none';
      }
    }
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new NetWatchApp();
});
