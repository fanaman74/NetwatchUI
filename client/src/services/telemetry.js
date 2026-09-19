// NetWatch Real-Time Telemetry Client & WebSocket Service

class TelemetryService {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.latestData = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.init();
  }

  init() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl;
    if (window.location.port === '5173') {
      // Local Vite dev server connecting to backend on 3030
      wsUrl = `${protocol}//${window.location.hostname}:3030`;
    } else {
      // Production deployment (Railway, Docker, Cloud) on same host
      wsUrl = `${protocol}//${window.location.host}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('📡 Connected to NetWatch telemetry stream');
        const savedNic = localStorage.getItem('nw_selected_nic');
        if (savedNic && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'SET_SELECTED_INTERFACE', iface: savedNic }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.latestData = data;
          this.notify(data);
        } catch (err) {
          console.error('Error parsing telemetry frame:', err);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('Telemetry stream closed. Reconnecting in 2s...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error, will retry...', err);
        this.ws.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init();
    }, 2000);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.latestData) {
      callback(this.latestData);
    }
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    for (const sub of this.subscribers) {
      try {
        sub(data);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    }
  }

  // REST API Methods

  async setMode(mode) {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return res.json();
  }

  async togglePause() {
    const res = await fetch('/api/pause', { method: 'POST' });
    return res.json();
  }

  async remediate(actionId) {
    const res = await fetch('/api/diagnose/remediate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId })
    });
    return res.json();
  }

  async promoteEgress(process, pattern, ruleType = 'sni', label = 'User Promoted') {
    const res = await fetch('/api/egress/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process, pattern, ruleType, label })
    });
    return res.json();
  }

  async toggleStrictEgress(enabled) {
    const res = await fetch('/api/egress/strict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    return res.json();
  }

  async setRecorderState(state) {
    const res = await fetch('/api/recorder/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
    return res.json();
  }

  async setSelectedInterface(iface) {
    localStorage.setItem('nw_selected_nic', iface);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'SET_SELECTED_INTERFACE', iface }));
    }
    try {
      const res = await fetch('/api/interfaces/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iface })
      });
      return res.json();
    } catch {
      // ignore
    }
  }

  downloadPcap() {
    window.location.href = '/api/export/pcap';
  }

  async getReportMarkdown() {
    const res = await fetch('/api/export/report');
    return res.text();
  }
}

export const telemetry = new TelemetryService();
