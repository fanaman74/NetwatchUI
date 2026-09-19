// NetWatch Egress Drift Detection & Policy Promotion Engine

export class EgressEngine {
  constructor() {
    this.strictMode = false;
    this.promotedRules = new Map(); // key: process:pattern -> rule
    this.destinations = new Map(); // key: process:dst -> record
    this.initDefaultRules();
  }

  initDefaultRules() {
    // Initial known policies
    this.promote('chrome.exe', '*.google.com', 'sni', 'Google Services');
    this.promote('chrome.exe', '*.cloudflare.com', 'sni', 'Cloudflare CDN');
    this.promote('code.exe', 'github.com', 'sni', 'GitHub API / Git');
    this.promote('curl', 'example.com', 'sni', 'Verified Test');
    this.promote('system', '192.168.*', 'ip', 'Local Gateway / Subnet');
  }

  promote(processName, pattern, ruleType = 'sni', label = 'Promoted Policy') {
    const key = `${processName.toLowerCase()}:${pattern.toLowerCase()}`;
    this.promotedRules.set(key, {
      id: `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      process: processName,
      pattern,
      ruleType, // 'sni', 'ip', 'asn'
      label,
      promotedAt: new Date().toISOString()
    });
  }

  unpromote(processName, pattern) {
    const key = `${processName.toLowerCase()}:${pattern.toLowerCase()}`;
    this.promotedRules.delete(key);
  }

  recordConnection(conn) {
    const processName = conn.process || 'unknown';
    const remoteHost = conn.remoteHost || conn.remoteIp || '0.0.0.0';
    const remoteIp = conn.remoteIp || '0.0.0.0';
    const remotePort = conn.remotePort || 80;
    const asn = conn.asn || 'AS-LOCAL';

    const key = `${processName.toLowerCase()}:${remoteHost.toLowerCase()}:${remotePort}`;
    let item = this.destinations.get(key);

    const verdict = this.evaluateVerdict(processName, remoteHost, remoteIp, asn);

    if (!item) {
      item = {
        key,
        process: processName,
        pid: conn.pid || 0,
        host: remoteHost,
        ip: remoteIp,
        port: remotePort,
        asn,
        country: conn.country || 'US',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        bytesOut: conn.bytesOut || 1024,
        bytesIn: conn.bytesIn || 4096,
        connectionsCount: 1,
        verdict,
        isDrift: verdict === 'drift' || verdict === 'no rule'
      };
      this.destinations.set(key, item);
    } else {
      item.lastSeen = new Date().toISOString();
      item.bytesOut += conn.bytesOut || 512;
      item.bytesIn += conn.bytesIn || 2048;
      item.connectionsCount++;
      item.verdict = verdict;
      item.isDrift = verdict === 'drift' || verdict === 'no rule';
    }

    return item;
  }

  evaluateVerdict(processName, host, ip, asn) {
    const proc = processName.toLowerCase();

    // Check SNI rules
    for (const [key, rule] of this.promotedRules.entries()) {
      if (rule.process.toLowerCase() === proc || rule.process === '*') {
        if (rule.ruleType === 'sni') {
          if (rule.pattern === '*' || host === rule.pattern || host.endsWith(rule.pattern.replace('*', ''))) {
            return 'sni';
          }
        } else if (rule.ruleType === 'ip') {
          if (ip.startsWith(rule.pattern.replace('*', ''))) {
            return 'ip';
          }
        } else if (rule.ruleType === 'asn') {
          if (asn.toLowerCase() === rule.pattern.toLowerCase()) {
            return 'asn';
          }
        }
      }
    }

    // If strict mode is enabled, unpromoted traffic is drift
    if (this.strictMode) {
      return 'drift';
    }

    // Default verdict for unpromoted traffic
    return 'no rule';
  }

  getSnapshot() {
    const items = Array.from(this.destinations.values());
    // Sort by volume descending
    items.sort((a, b) => (b.bytesOut + b.bytesIn) - (a.bytesOut + a.bytesIn));

    return {
      strictMode: this.strictMode,
      totalDestinations: items.length,
      driftCount: items.filter(i => i.isDrift).length,
      promotedCount: this.promotedRules.size,
      items: items.slice(0, 100),
      rules: Array.from(this.promotedRules.values())
    };
  }
}
