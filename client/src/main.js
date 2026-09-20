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
import { UnifiTab } from './components/Tabs/UnifiTab.js';
import { DenseView } from './components/Views/DenseView.js';
import { LiteView } from './components/Views/LiteView.js';
import { showHelpModal } from './components/Modals/HelpModal.js';
import { DoctorScreen } from './components/DoctorScreen.js';
import { visitorNicScanner } from './services/visitorNicScanner.js';

const THEMES = ['dark', 'dracula', 'nord', 'ocean', 'solarized', 'sky', 'paper', 'terminal'];

class NetWatchApp {
  constructor() {
    this.currentView = 'full'; // 'full' | 'dense' | 'lite'
    this.activeTabId = 1; // 1 to 10 (0 is 10)
    this.currentTheme = localStorage.getItem('nw_theme') || 'dark';
    this.activeTabComponent = null;
    this.viewComponent = null;
    this.latestData = null;

    // Proactively scan visitor PC NICs on every page load
    visitorNicScanner.scan().catch(() => {});

    this.applyTheme(this.currentTheme);
    this.initDOM();
    this.initTabComponents();
    this.bindKeyboardShortcuts();
    this.initTouchGestures();
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
        <div class="nw-header-left">
          <div class="nw-brand">
            <div class="nw-logo">
              <span class="nw-logo-icon">🛡️</span>
              <span class="nw-logo-text">NETWATCH</span>
            </div>
            <span class="nw-version-tag">v0.30</span>
          </div>

          <div class="nw-header-separator"></div>

          <div id="mode-pill" class="nw-status-pill live">
            <span class="nw-status-dot"></span>
            <span id="mode-label" class="nw-status-text">LIVE HOST</span>
          </div>

          <!-- NIC Selector (Visible when > 1 interface exists) -->
          <div id="nic-selector-container" class="nw-nic-container" style="display: none;">
            <span class="nw-nic-icon">🔌</span>
            <span class="nw-nic-prefix">NIC:</span>
            <select id="nic-select" class="nw-header-select nw-nic-select" title="Select Network Card to monitor">
            </select>
          </div>
        </div>

        <div class="nw-header-right">
          <!-- Live / Demo Switcher -->
          <button id="toggle-mode-btn" class="nw-header-btn nw-mode-btn" title="Toggle Live Host vs Scenario Replay [D]">
            <span class="nw-btn-icon">🔄</span>
            <span class="nw-btn-text">Demo Scenario</span>
            <kbd class="nw-kbd">D</kbd>
          </button>

          <!-- View Mode Selector (Segmented Control) -->
          <div class="nw-segmented-control" role="radiogroup" aria-label="Layout View">
            <button class="nw-segment-btn active" id="view-btn-full" data-view="full" title="Full 10-Tab View [V]">
              <span>Full</span>
              <kbd class="nw-kbd">V</kbd>
            </button>
            <button class="nw-segment-btn" id="view-btn-dense" data-view="dense" title="Dense 4-Box Layout">
              <span>Dense</span>
            </button>
            <button class="nw-segment-btn" id="view-btn-lite" data-view="lite" title="Lite Terminal Layout">
              <span>Lite</span>
            </button>
          </div>

          <!-- Theme Picker -->
          <div class="nw-theme-wrapper" title="Switch Theme [T]">
            <span class="nw-theme-icon">🎨</span>
            <select id="theme-select" class="nw-header-select nw-theme-select">
              <option value="dark">Dark</option>
              <option value="dracula">Dracula</option>
              <option value="nord">Nord</option>
              <option value="ocean">Ocean</option>
              <option value="solarized">Solarized</option>
              <option value="sky">Sky</option>
              <option value="paper">Paper</option>
              <option value="terminal">Terminal</option>
            </select>
          </div>

          <!-- Pause / Resume -->
          <button id="pause-btn" class="nw-header-btn nw-pause-btn" title="Pause / Resume Live Telemetry [P]">
            <span class="nw-btn-icon">⏸️</span>
            <span class="nw-btn-text">Pause</span>
            <kbd class="nw-kbd">P</kbd>
          </button>

          <!-- Doctor Pre-flight Button -->
          <button id="doctor-btn" class="nw-header-btn nw-doctor-btn" title="Run NetWatch Doctor Capability Check">
            <span class="nw-btn-icon">🩺</span>
            <span class="nw-btn-text">Doctor</span>
          </button>

          <!-- Help Keybindings Button -->
          <button id="help-btn" class="nw-header-btn nw-help-btn" title="Help & Keybindings [?]">
            <span class="nw-btn-icon">❓</span>
            <kbd class="nw-kbd">?</kbd>
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
        <button class="nw-tab" data-tab="11">
          <span class="nw-key-badge">U</span> UniFi
        </button>
      </nav>

      <!-- Main Workspace -->
      <main class="nw-main" id="main-content"></main>

      <!-- Footer -->
      <footer class="nw-footer">
        <div class="nw-footer-hints">
          ${(() => {
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isMac = !isIOS && /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua);
            if (isIOS) {
              return `<span>📱 Touch / Swipe Navigation</span> <span>[Live / Demo]</span> <span>[Theme]</span> <span>[?] Help</span>`;
            } else if (isMac) {
              return `<span>[⌘1-0] Tabs</span> <span>[U] UniFi</span> <span>[V] View</span> <span>[T] Theme</span> <span>[D] Live/Demo</span> <span>[Space] Pause</span> <span>[⌘/] Filter</span> <span>[?] Help</span>`;
            }
            return `<span>[1-0] Tabs</span> <span>[U] UniFi</span> <span>[V] Cycle View</span> <span>[T] Theme</span> <span>[D] Live/Demo</span> <span>[P] Pause</span> <span>[/] Filter</span> <span>[?] Help</span>`;
          })()}
        </div>
        <div id="footer-status" style="display: flex; gap: 14px; align-items: center;">
          <span id="ws-status" style="color: var(--status-good);">● Connected</span>
          <span id="footer-time">00:00:00</span>
        </div>
      </footer>
    `;

    // Bind header controls
    const nicSelect = document.querySelector('#nic-select');
    if (nicSelect) {
      nicSelect.addEventListener('change', async (e) => {
        const newNic = e.target.value;
        visitorNicScanner.setActiveNic(newNic);
        await telemetry.setSelectedInterface(newNic);
      });
    }

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
      const isCurrent = parseInt(tab.getAttribute('data-tab'), 10) === tabId;
      tab.classList.toggle('active', isCurrent);
      if (isCurrent) {
        tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
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
      case 11: this.activeTabComponent = new UnifiTab(main); break;
    }

    if (this.latestData && this.activeTabComponent) {
      this.activeTabComponent.update(this.latestData);
    }
  }

  initTabComponents() {
    this.switchTab(1);
  }

  initTouchGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && this.currentView === 'full') {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const elapsed = Date.now() - touchStartTime;

        // Don't trigger swipe if touch originated in form elements, canvas, tables, or modals
        const target = e.target;
        if (target && target.closest('input, select, textarea, canvas, .nw-table-container, .nw-modal, .nw-doctor-card')) {
          return;
        }

        // Clean horizontal flick (> 55px horizontal, < 45px vertical, < 350ms duration)
        if (Math.abs(deltaX) > 55 && Math.abs(deltaY) < 45 && elapsed < 350) {
          if (deltaX < 0 && this.activeTabId < 10) {
            this.switchTab(this.activeTabId + 1);
          } else if (deltaX > 0 && this.activeTabId > 1) {
            this.switchTab(this.activeTabId - 1);
          }
        }
      }
    }, { passive: true });
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

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // macOS Command & Windows Ctrl search shortcut: ⌘K or ⌘/
      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K' || e.key === '/')) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        }
        return;
      }

      // macOS ⌘1-9 & Ctrl+1-9 tab switching
      if (isCmdOrCtrl && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        this.switchTab(parseInt(e.key, 10));
        return;
      }
      if (isCmdOrCtrl && e.key === '0') {
        e.preventDefault();
        this.switchTab(10);
        return;
      }

      // macOS ⌘D / Ctrl+D toggle live/demo mode
      if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const toggleBtn = document.querySelector('#toggle-mode-btn');
        if (toggleBtn) toggleBtn.click();
        return;
      }

      // macOS ⌘E / Ctrl+E export pcap
      if (isCmdOrCtrl && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        telemetry.downloadPcap();
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
      } else if (e.key === 'u' || e.key === 'U') {
        this.switchTab(11);
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
    // Multi-NIC selector in header (Visitor PC Adapters + Cloud Host Interfaces)
    const serverIfaces = data.interfaces || [];
    const visitorAdapters = visitorNicScanner.cachedResult?.adapters || [];
    const nicContainer = document.querySelector('#nic-selector-container');
    const nicSelect = document.querySelector('#nic-select');

    const allOptions = [];
    for (const va of visitorAdapters) {
      allOptions.push({
        id: va.name,
        label: `💻 Client: ${va.name} (${va.ipv4 !== '-' ? va.ipv4 : 'No IP'})`,
        isVisitor: true
      });
    }
    for (const si of serverIfaces) {
      if (!allOptions.some(o => o.id === si.name)) {
        const typeIcon = si.type === 'Wi-Fi' ? '📶' : (si.type === 'Loopback' ? '🔄' : '🔌');
        const shortIp = si.ipv4 ? si.ipv4.split('/')[0] : 'No IP';
        allOptions.push({
          id: si.name,
          label: `☁️ Host: ${typeIcon} ${si.name} (${shortIp})`,
          isVisitor: false
        });
      }
    }

    if (nicContainer && nicSelect) {
      if (allOptions.length > 1) {
        nicContainer.style.display = 'flex';
        const optKeys = allOptions.map(o => o.id).join('|');
        if (nicSelect.dataset.keys !== optKeys) {
          nicSelect.dataset.keys = optKeys;
          const currentVal = nicSelect.value;
          nicSelect.innerHTML = allOptions.map(o => `<option value="${o.id}" style="background-color: #161b22; color: #f0f6fc;">${o.label}</option>`).join('');
          const activeVisitor = visitorNicScanner.getActiveNicName();
          if (activeVisitor && allOptions.some(o => o.id === activeVisitor)) {
            nicSelect.value = activeVisitor;
          } else if (currentVal && allOptions.some(o => o.id === currentVal)) {
            nicSelect.value = currentVal;
          }
        }
        const activeVisitor = visitorNicScanner.getActiveNicName();
        if (activeVisitor && nicSelect.value !== activeVisitor && allOptions.some(o => o.id === activeVisitor)) {
          nicSelect.value = activeVisitor;
        } else if (data.selectedInterface && nicSelect.value !== data.selectedInterface && allOptions.some(o => o.id === data.selectedInterface)) {
          nicSelect.value = data.selectedInterface;
        }
      } else {
        nicContainer.style.display = 'none';
      }
    }

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
        modePill.className = 'nw-status-pill live';
        modeLabel.textContent = 'LIVE HOST';
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="nw-btn-icon">🔄</span><span class="nw-btn-text">Demo Scenario</span><kbd class="nw-kbd">D</kbd>';
        toggleBtn.title = 'Switch to Demo Scenario [D]';
      }
    } else {
      if (modePill) {
        modePill.className = 'nw-status-pill demo';
        modeLabel.textContent = 'DEMO SCENARIO';
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="nw-btn-icon">⚡</span><span class="nw-btn-text">Live Host</span><kbd class="nw-kbd">D</kbd>';
        toggleBtn.title = 'Switch to Live Host [D]';
      }
    }

    if (pauseBtn) {
      if (data.isPaused) {
        pauseBtn.innerHTML = '<span class="nw-btn-icon">▶️</span><span class="nw-btn-text">Resume</span><kbd class="nw-kbd">P</kbd>';
        pauseBtn.classList.add('paused');
        pauseBtn.title = 'Resume Telemetry [P]';
      } else {
        pauseBtn.innerHTML = '<span class="nw-btn-icon">⏸️</span><span class="nw-btn-text">Pause</span><kbd class="nw-kbd">P</kbd>';
        pauseBtn.classList.remove('paused');
        pauseBtn.title = 'Pause Telemetry [P]';
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
