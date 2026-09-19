// NetWatch 0.30 Official Scenario & High-Fidelity Simulation Driver
import { DiagnoseEngine } from './diagnose.js';
import { ThreatEngine } from './threats.js';
import { EgressEngine } from './egress.js';

export class ScenarioDriver {
  constructor() {
    this.diagnoseEngine = new DiagnoseEngine();
    this.threatEngine = new ThreatEngine();
    this.egressEngine = new EgressEngine();

    this.scenarioStartSec = 236;
    this.scenarioEndSec = 560;
    this.currentSec = 236;
    this.speed = 1;
    this.simulatedPackets = [];
    this.throughputHistory = [];
    this.maxHistory = 60;

    // Seed mock alerts
    this.threatEngine.addAlert('Port Scan', 'warning', 'Reconnaissance sweep detected from 198.51.100.42', '14 TCP SYN probes across ports 21-445');
    this.threatEngine.addAlert('DNS Tunnel', 'warning', 'High entropy subdomain burst on exfil.darkmatter.sec', '62 queries in 60s, mean length 74 bytes');

    this.initConnections();
  }

  initConnections() {
    this.connections = [
      {
        id: 101,
        proto: 'TCP',
        process: 'ncat',
        pid: 4912,
        localIp: '10.88.0.2',
        localPort: 52344,
        remoteIp: '10.88.0.3',
        remotePort: 9000,
        remoteHost: 'storage.lan',
        state: 'ESTABLISHED',
        rtt: 184.0,
        rttvar: 41.0,
        retrans: 12,
        cwnd: 64,
        ssthresh: 65535,
        rwnd: 262144,
        mss: 1448,
        country: 'LAN',
        flag: '🏠',
        asn: 'AS-PRIVATE',
        rxRate: 2400000,
        txRate: 1800000,
        bookmarked: false
      },
      {
        id: 102,
        proto: 'TCP',
        process: 'curl',
        pid: 8124,
        localIp: '192.168.8.150',
        localPort: 59312,
        remoteIp: '93.184.216.34',
        remotePort: 443,
        remoteHost: 'example.com',
        state: 'ESTABLISHED',
        rtt: 13.4,
        rttvar: 2.1,
        retrans: 0,
        cwnd: 10,
        ssthresh: 65535,
        rwnd: 131072,
        mss: 1460,
        country: 'US',
        flag: '🇺🇸',
        asn: 'AS15133 EDGECAST',
        rxRate: 640000,
        txRate: 128000,
        bookmarked: true
      },
      {
        id: 103,
        proto: 'TCP',
        process: 'chrome.exe',
        pid: 14820,
        localIp: '192.168.8.150',
        localPort: 54118,
        remoteIp: '142.250.190.46',
        remotePort: 443,
        remoteHost: 'clients2.google.com',
        state: 'ESTABLISHED',
        rtt: 18.2,
        rttvar: 3.5,
        retrans: 1,
        cwnd: 20,
        ssthresh: 32000,
        rwnd: 262144,
        mss: 1460,
        country: 'US',
        flag: '🇺🇸',
        asn: 'AS15169 GOOGLE',
        rxRate: 1450000,
        txRate: 320000,
        bookmarked: false
      },
      {
        id: 104,
        proto: 'TCP',
        process: 'code.exe',
        pid: 9230,
        localIp: '192.168.8.150',
        localPort: 51240,
        remoteIp: '140.82.121.4',
        remotePort: 443,
        remoteHost: 'api.github.com',
        state: 'ESTABLISHED',
        rtt: 24.8,
        rttvar: 4.0,
        retrans: 0,
        cwnd: 14,
        ssthresh: 65535,
        rwnd: 131072,
        mss: 1460,
        country: 'US',
        flag: '🇺🇸',
        asn: 'AS36459 GITHUB',
        rxRate: 210000,
        txRate: 45000,
        bookmarked: false
      },
      {
        id: 105,
        proto: 'UDP',
        process: 'system',
        pid: 4,
        localIp: '192.168.8.150',
        localPort: 5353,
        remoteIp: '224.0.0.251',
        remotePort: 5353,
        remoteHost: 'mdns.mcast.net',
        state: 'ESTABLISHED',
        rtt: 1.1,
        rttvar: 0.2,
        retrans: 0,
        cwnd: 0,
        ssthresh: 0,
        rwnd: 65535,
        mss: 1472,
        country: 'LOCAL',
        flag: '🌐',
        asn: 'AS-MULTICAST',
        rxRate: 48000,
        txRate: 12000,
        bookmarked: false
      },
      {
        id: 106,
        proto: 'TCP',
        process: 'c2_agent',
        pid: 6660,
        localIp: '192.168.8.150',
        localPort: 48992,
        remoteIp: '185.220.101.5',
        remotePort: 8443,
        remoteHost: 'telemetry-cdn.darksec.ru',
        state: 'ESTABLISHED',
        rtt: 86.4,
        rttvar: 1.2,
        retrans: 0,
        cwnd: 8,
        ssthresh: 65535,
        rwnd: 65535,
        mss: 1460,
        country: 'RU',
        flag: '🇷🇺',
        asn: 'AS208298 TOR-EXIT',
        rxRate: 8500,
        txRate: 3200,
        bookmarked: false
      },
      {
        id: 107,
        proto: 'TCP',
        process: 'node.exe',
        pid: 11024,
        localIp: '127.0.0.1',
        localPort: 3030,
        remoteIp: '0.0.0.0',
        remotePort: 0,
        remoteHost: 'localhost',
        state: 'LISTEN',
        rtt: 0.1,
        rttvar: 0.0,
        retrans: 0,
        cwnd: 0,
        ssthresh: 0,
        rwnd: 0,
        mss: 0,
        country: 'LOCAL',
        flag: '💻',
        asn: 'AS-LOOPBACK',
        rxRate: 0,
        txRate: 0,
        bookmarked: false
      }
    ];

    // Seed egress engine with these
    for (const c of this.connections) {
      this.egressEngine.recordConnection(c);
    }
  }

  tick() {
    this.currentSec += this.speed;
    if (this.currentSec > this.scenarioEndSec) {
      this.currentSec = this.scenarioEndSec;
    }

    // Format scenario timestamp: baseline started at 06:44:00, now is 06:44:00 + currentSec
    const startMs = new Date('2026-09-03T06:44:00Z').getTime();
    const currentMs = startMs + this.currentSec * 1000;
    const timeStr = new Date(currentMs).toISOString().substring(11, 19);

    // Scenario conditions:
    // Degraded resolver: 40ms after t >= 250s unless remediation applied!
    const isResolverDegraded = this.currentSec >= 250;
    const dnsRtt = isResolverDegraded ? 40.2 : 1.2;
    const gatewayRtt = 0.9 + Math.random() * 0.2;
    const pathRtt = this.currentSec >= 240 ? 53.6 : 13.4;

    // Bufferbloated socket
    const socketBloat = {
      process: 'ncat',
      remote: '10.88.0.3:9000',
      rtt: 184.0 + Math.sin(this.currentSec) * 10,
      retrans: 12
    };

    // Run diagnosis evaluation
    const diagSnapshot = this.diagnoseEngine.evaluate({
      dnsRtt,
      gatewayRtt,
      pathRtt,
      socketBloat,
      isDemo: true,
      scenarioTime: timeStr
    });

    // Generate synthetic packets
    this.generatePackets();

    // Calculate throughput totals
    const rxThroughput = this.connections.reduce((acc, c) => acc + c.rxRate, 0) + Math.floor(Math.random() * 200000);
    const txThroughput = this.connections.reduce((acc, c) => acc + c.txRate, 0) + Math.floor(Math.random() * 80000);

    this.throughputHistory.push({
      time: timeStr,
      rx: rxThroughput,
      tx: txThroughput
    });
    if (this.throughputHistory.length > this.maxHistory) {
      this.throughputHistory.shift();
    }

    // Dynamic latency KPI data
    const kpis = {
      dns: {
        label: 'DNS',
        subject: this.diagnoseEngine.remediationState.applied ? '192.168.8.1' : '169.254.1.1',
        value: this.diagnoseEngine.remediationState.applied ? 1.4 : dnsRtt,
        unit: 'ms',
        baseline: '1.2 ms',
        sigma: '0.4 ms',
        deviation: isResolverDegraded && !this.diagnoseEngine.remediationState.applied ? '33× base · 97.5σ' : 'nominal',
        status: isResolverDegraded && !this.diagnoseEngine.remediationState.applied ? 'error' : 'good',
        since: isResolverDegraded && !this.diagnoseEngine.remediationState.applied ? '06:48:10' : null,
        history: this.generateSparkline(isResolverDegraded && !this.diagnoseEngine.remediationState.applied ? 40 : 1.4, 20)
      },
      gateway: {
        label: 'Gateway',
        subject: '192.168.8.1',
        value: gatewayRtt,
        unit: 'ms',
        baseline: '0.9 ms',
        sigma: '0.2 ms',
        deviation: 'nominal',
        status: 'good',
        since: null,
        history: this.generateSparkline(gatewayRtt, 20)
      },
      cloudflare: {
        label: 'Cloudflare',
        subject: '1.1.1.1',
        value: pathRtt,
        unit: 'ms',
        baseline: '12.0 ms',
        sigma: '1.8 ms',
        deviation: this.currentSec >= 240 ? '+40ms AS7545' : 'nominal',
        status: this.currentSec >= 240 ? 'warn' : 'good',
        since: this.currentSec >= 240 ? '06:44:02' : null,
        history: this.generateSparkline(pathRtt, 20)
      },
      google: {
        label: 'Google',
        subject: '8.8.8.8',
        value: 14.8 + Math.random() * 1.5,
        unit: 'ms',
        baseline: '14.5 ms',
        sigma: '2.1 ms',
        deviation: 'nominal',
        status: 'good',
        since: null,
        history: this.generateSparkline(14.8, 20)
      },
      loss: {
        label: 'Loss',
        subject: 'Local NIC',
        value: 0.0,
        unit: '%',
        baseline: '0.0 %',
        sigma: '0.0 %',
        deviation: 'nominal',
        status: 'good',
        since: null,
        history: new Array(20).fill(0)
      }
    };

    // Interfaces snapshot
    const interfaces = [
      {
        name: 'eth0',
        type: 'Ethernet',
        mac: '52:54:00:12:34:56',
        ipv4: '192.168.8.150/24',
        ipv6: 'fe80::5054:ff:fe12:3456/64',
        mtu: 1500,
        status: 'UP',
        rxRate: rxThroughput,
        txRate: txThroughput,
        rxBytes: 84210992,
        txBytes: 31204918,
        rxErrors: 0,
        txErrors: 0,
        rxDrops: 0,
        txDrops: 0,
        sparkline: this.throughputHistory.map(h => h.rx)
      },
      {
        name: 'wlan0',
        type: 'Wi-Fi',
        mac: 'b4:96:91:8a:32:10',
        ipv4: '10.0.0.45/24',
        ipv6: 'fe80::b696:91ff:fe8a:3210/64',
        mtu: 1500,
        status: 'UP',
        rxRate: 48000,
        txRate: 12000,
        rxBytes: 1240500,
        txBytes: 340000,
        rxErrors: 2,
        txErrors: 0,
        rxDrops: 5,
        txDrops: 0,
        sparkline: this.generateSparkline(48000, 20)
      },
      {
        name: 'lo',
        type: 'Loopback',
        mac: '00:00:00:00:00:00',
        ipv4: '127.0.0.1/8',
        ipv6: '::1/128',
        mtu: 65536,
        status: 'UP',
        rxRate: 120000,
        txRate: 120000,
        rxBytes: 4209100,
        txBytes: 4209100,
        rxErrors: 0,
        txErrors: 0,
        rxDrops: 0,
        txDrops: 0,
        sparkline: this.generateSparkline(120000, 20)
      }
    ];

    // Topology hop data
    const topology = {
      localHost: { ip: '192.168.8.150', name: 'localhost.node' },
      gateway: { ip: '192.168.8.1', rtt: gatewayRtt, status: 'ONLINE' },
      dns: {
        ip: this.diagnoseEngine.remediationState.applied ? '192.168.8.1' : '169.254.1.1',
        rtt: this.diagnoseEngine.remediationState.applied ? 1.4 : dnsRtt,
        status: isResolverDegraded && !this.diagnoseEngine.remediationState.applied ? 'DEGRADED' : 'HEALTHY'
      },
      hops: [
        { hop: 1, ip: '192.168.8.1', asn: '-', rtt: 0.9, loss: 0 },
        { hop: 2, ip: '100.64.0.1', asn: 'AS7545', rtt: 8.1, loss: 0 },
        {
          hop: 3,
          ip: this.currentSec >= 240 ? '203.0.113.44' : '203.0.113.9',
          asn: 'AS7545',
          rtt: this.currentSec >= 240 ? 52.0 : 12.0,
          loss: 0,
          note: this.currentSec >= 240 ? 'Rerouted +40ms' : 'Direct'
        },
        { hop: 4, ip: '1.1.1.1', asn: 'AS13335', rtt: pathRtt, loss: 0 }
      ]
    };

    // Protocol breakdown stats
    const stats = {
      protocols: [
        { name: 'TLS 1.3', count: 1842, bytes: 48201000, pct: 58.2 },
        { name: 'TCP (Plain)', count: 914, bytes: 21340000, pct: 25.8 },
        { name: 'DNS', count: 482, bytes: 3840000, pct: 4.6 },
        { name: 'QUIC / HTTP3', count: 260, bytes: 7120000, pct: 8.6 },
        { name: 'UDP / Other', count: 115, bytes: 2340000, pct: 2.8 }
      ],
      handshakeHistogram: [
        { range: '< 5ms', count: 142 },
        { range: '5-15ms', count: 320 },
        { range: '15-30ms', count: 184 },
        { range: '30-50ms', count: 68 },
        { range: '50-100ms', count: 24 },
        { range: '> 100ms', count: 12 }
      ],
      packetSizeDistribution: [
        { range: '64-128 B', count: 420 },
        { range: '128-512 B', count: 810 },
        { range: '512-1024 B', count: 640 },
        { range: '1024-1500 B', count: 2400 }
      ]
    };

    // Processes breakdown
    const processes = [
      { name: 'ncat', pid: 4912, rxRate: 2400000, txRate: 1800000, totalBytes: 42100000, sockets: 1 },
      { name: 'chrome.exe', pid: 14820, rxRate: 1450000, txRate: 320000, totalBytes: 28400000, sockets: 8 },
      { name: 'curl', pid: 8124, rxRate: 640000, txRate: 128000, totalBytes: 6400000, sockets: 1 },
      { name: 'code.exe', pid: 9230, rxRate: 210000, txRate: 45000, totalBytes: 4120000, sockets: 4 },
      { name: 'system', pid: 4, rxRate: 48000, txRate: 12000, totalBytes: 980000, sockets: 2 },
      { name: 'c2_agent', pid: 6660, rxRate: 8500, txRate: 3200, totalBytes: 145000, sockets: 1 }
    ];

    return {
      mode: 'demo',
      time: timeStr,
      scenarioSecond: this.currentSec,
      scenarioTotal: this.scenarioEndSec,
      banner: 'DEMO SCENARIO: NetWatch 0.30 Diagnostic Arc (Simulated Replay)',
      kpis,
      throughput: {
        rx: rxThroughput,
        tx: txThroughput,
        history: this.throughputHistory
      },
      connections: this.connections,
      interfaces,
      packets: this.simulatedPackets.slice(-50),
      stats,
      topology,
      processes,
      diagnose: diagSnapshot,
      egress: this.egressEngine.getSnapshot(),
      threats: {
        alerts: this.threatEngine.alerts,
        recorder: this.threatEngine.recorder
      }
    };
  }

  generatePackets() {
    const protoChoices = ['TLS 1.3', 'DNS', 'HTTP', 'TCP', 'QUIC'];
    const proto = protoChoices[Math.floor(Math.random() * protoChoices.length)];

    const packet = {
      id: Math.floor(Math.random() * 1000000),
      timestamp: Date.now(),
      time: new Date().toISOString().substring(11, 23),
      protocol: proto,
      srcIp: '192.168.8.150',
      srcPort: 50000 + Math.floor(Math.random() * 10000),
      dstIp: proto === 'DNS' ? '169.254.1.1' : '93.184.216.34',
      dstPort: proto === 'DNS' ? 53 : 443,
      length: 64 + Math.floor(Math.random() * 1400),
      ja4: proto === 'TLS 1.3' ? this.threatEngine.generateJa4(true) : null,
      sni: proto === 'TLS 1.3' ? 'example.com' : null,
      info: this.getPacketInfo(proto),
      rawPayload: '4500003c1a2b400040062f3ac0a808965db8d822c35001bb000003e8000003e95018fa0012340000160303002f0100002b0303'
    };

    this.simulatedPackets.push(packet);
    if (this.simulatedPackets.length > 200) {
      this.simulatedPackets.shift();
    }
  }

  getPacketInfo(proto) {
    if (proto === 'TLS 1.3') return 'Client Hello (SNI=example.com, Cipher=TLS_AES_256_GCM_SHA384)';
    if (proto === 'DNS') return 'Standard query 0x1a4b A example.com';
    if (proto === 'HTTP') return 'GET /api/v1/telemetry HTTP/1.1 (200 OK)';
    if (proto === 'QUIC') return 'Initial Packet, DCID=a4b1c2d3, Token Length=0';
    return '[ACK] Seq=1420 Ack=810 Win=65535 Len=1448';
  }

  generateSparkline(center, count = 20) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(Math.max(0.1, center + (Math.random() - 0.5) * (center * 0.3)));
    }
    return list;
  }
}
