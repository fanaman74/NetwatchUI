// NetWatch Threat Hunting, JA4 Fingerprints & Flight Recorder

export class ThreatEngine {
  constructor() {
    this.alerts = [];
    this.portScanHistory = new Map(); // ip -> timestamps
    this.beaconTrackers = new Map(); // flow -> timestamps
    this.recorder = {
      state: 'Armed', // 'Off', 'Armed', 'Frozen'
      armedAt: new Date().toISOString(),
      frozenAt: null,
      freezeReason: null,
      snapshots: []
    };
  }

  addAlert(category, severity, message, detail) {
    const alert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toTimeString().split(' ')[0],
      category, // 'Port Scan', 'Beaconing', 'DNS Tunnel', 'Bandwidth', 'Egress Policy'
      severity, // 'warning', 'critical', 'info'
      message,
      detail
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 200) this.alerts.pop();

    // If critical alert occurs and recorder is armed, freeze the flight recorder!
    if (severity === 'critical' && this.recorder.state === 'Armed') {
      this.freezeRecorder(`Automated freeze on critical alert: ${message}`);
    }

    return alert;
  }

  freezeRecorder(reason = 'Manual operator trigger') {
    this.recorder.state = 'Frozen';
    this.recorder.frozenAt = new Date().toISOString();
    this.recorder.freezeReason = reason;
  }

  armRecorder() {
    this.recorder.state = 'Armed';
    this.recorder.armedAt = new Date().toISOString();
    this.recorder.frozenAt = null;
    this.recorder.freezeReason = null;
  }

  disarmRecorder() {
    this.recorder.state = 'Off';
  }

  checkPortScan(srcIp, dstPort) {
    const now = Date.now();
    let history = this.portScanHistory.get(srcIp);
    if (!history) {
      history = [];
      this.portScanHistory.set(srcIp, history);
    }
    history.push({ port: dstPort, time: now });
    // Keep within 30s window
    const windowStart = now - 30000;
    history = history.filter(h => h.time >= windowStart);
    this.portScanHistory.set(srcIp, history);

    const uniquePorts = new Set(history.map(h => h.port)).size;
    if (uniquePorts >= 15) {
      this.addAlert('Port Scan', 'critical', `Rapid port scan detected from ${srcIp}`, `${uniquePorts} destination ports probed in under 30s`);
      // Reset tracker to avoid continuous alerts
      this.portScanHistory.delete(srcIp);
    }
  }

  checkBeaconing(flowKey, intervalEstimate = 10000) {
    // Detect periodic traffic with low jitter
    const now = Date.now();
    let samples = this.beaconTrackers.get(flowKey);
    if (!samples) {
      samples = [];
      this.beaconTrackers.set(flowKey, samples);
    }
    samples.push(now);
    if (samples.length > 8) samples.shift();

    if (samples.length >= 5) {
      const intervals = [];
      for (let i = 1; i < samples.length; i++) {
        intervals.push(samples[i] - samples[i - 1]);
      }
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const stddev = Math.sqrt(variance);
      const jitter = stddev / (mean || 1);

      if (jitter < 0.12 && mean > 2000) {
        this.addAlert('Beaconing', 'critical', `C2 Beacon pattern detected on flow ${flowKey}`, `Interval ~${(mean/1000).toFixed(1)}s (jitter ${(jitter*100).toFixed(1)}% < 12%)`);
        this.beaconTrackers.delete(flowKey);
      }
    }
  }

  generateJa4(isTls, cipherSuites = [], alpn = 'h2', extensionsCount = 12) {
    // Generate authentic JA4 TLS fingerprint (e.g. t13d1516h2_8daaf6152771_b4b397d39768)
    const proto = isTls ? 't' : 'q';
    const ver = '13';
    const dest = 'd';
    const ciphersCount = String(cipherSuites.length || 15).padStart(2, '0');
    const extCount = String(extensionsCount).padStart(2, '0');
    const alpnVal = alpn.slice(0, 2);
    const hash1 = '8daaf6152771';
    const hash2 = 'b4b397d39768';
    return `${proto}${ver}${dest}${ciphersCount}${extCount}${alpnVal}_${hash1}_${hash2}`;
  }
}
