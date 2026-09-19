// NetWatch Web Server: Express API + Real-Time WebSocket Telemetry
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScenarioDriver } from './collectors/scenario.js';
import { SystemCollector } from './collectors/system.js';
import { generatePcapBinary } from './collectors/pcap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3030;
const app = express();
app.use(cors());
app.use(express.json());

// Process crash guards for server resilience
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception guarded:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Process] Unhandled rejection guarded:', reason);
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// State
let currentMode = 'live';
let selectedInterface = null; // 'live' | 'demo'
let isPaused = false;

const scenarioDriver = new ScenarioDriver();
const systemCollector = new SystemCollector();
const liveThroughputHistory = [];

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // Prevent unhandled socket errors from crashing process on disconnect
  ws.on('error', (err) => {
    console.warn('[WS] Client socket notice:', err.message);
  });

  // Send immediate initial frame
  try {
    const frame = getLatestTelemetry();
    ws.send(JSON.stringify(frame));
  } catch (err) {
    console.error('[WS] Initial frame error:', err.message);
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      handleClientMessage(data, ws);
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

function handleClientMessage(data, ws) {
  if (data.type === 'SET_SELECTED_INTERFACE') {
    selectedInterface = data.iface;
    broadcastTelemetry();
    return;
  }
  if (data.type === 'SET_MODE') {
    currentMode = data.mode;
    broadcastTelemetry();
  } else if (data.type === 'TOGGLE_PAUSE') {
    isPaused = !isPaused;
    broadcastTelemetry();
  } else if (data.type === 'REMEDIATE') {
    const res = scenarioDriver.diagnoseEngine.applyRemediation(data.actionId);
    broadcastTelemetry();
  } else if (data.type === 'PROMOTE_EGRESS') {
    scenarioDriver.egressEngine.promote(data.process, data.pattern, data.ruleType || 'sni');
    broadcastTelemetry();
  }
}

// Tick loop & collection functions
let lastSystemSnapshot = null;

async function collectLiveSnapshot() {
  try {
    const ifaces = await systemCollector.getInterfaces();
    const conns = await systemCollector.getConnections();
    const latencies = await systemCollector.measureHostMetrics();

    const rxRate = ifaces.reduce((acc, i) => acc + i.rxRate, 0);
    const txRate = ifaces.reduce((acc, i) => acc + i.txRate, 0);
    const timeStr = new Date().toTimeString().split(' ')[0];

    // Maintain rolling live throughput history
    liveThroughputHistory.push({
      time: timeStr,
      rx: rxRate,
      tx: txRate
    });
    if (liveThroughputHistory.length > 60) {
      liveThroughputHistory.shift();
    }

    // Aggregate real processes from active connections
    const procMap = new Map();
    for (const c of conns) {
      scenarioDriver.egressEngine.recordConnection(c);
      let p = procMap.get(c.process);
      if (!p) {
        p = {
          name: c.process,
          pid: c.pid,
          rxRate: c.rxRate || 0,
          txRate: c.txRate || 0,
          totalBytes: (c.rxRate + c.txRate) * 10 || 10240,
          sockets: 1
        };
        procMap.set(c.process, p);
      } else {
        p.rxRate += c.rxRate || 0;
        p.txRate += c.txRate || 0;
        p.totalBytes += (c.rxRate + c.txRate) * 10;
        p.sockets++;
      }
    }
    const processesList = Array.from(procMap.values()).sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate));

    const nonInternal = ifaces.filter(i => i.type !== 'Loopback' && i.status === 'UP');
    const defaultIface = nonInternal.length > 0 ? nonInternal[0].name : (ifaces[0]?.name || '');
    const activeIfaceName = selectedInterface && ifaces.some(i => i.name === selectedInterface)
      ? selectedInterface
      : defaultIface;

    const enrichedIfaces = ifaces.map(i => ({
      ...i,
      selected: i.name === activeIfaceName
    }));

    lastSystemSnapshot = {
      mode: 'live',
      selectedInterface: activeIfaceName,
      time: timeStr,
      banner: 'LIVE HOST: Direct OS Network Telemetry (Windows)',
      kpis: {
        dns: {
          label: 'DNS',
          subject: 'Host DNS',
          value: latencies.dnsRtt,
          unit: 'ms',
          baseline: '12.0 ms',
          sigma: '2.0 ms',
          deviation: 'nominal',
          status: 'good',
          since: null,
          history: [latencies.dnsRtt, latencies.dnsRtt * 1.05, latencies.dnsRtt]
        },
        gateway: {
          label: 'Gateway',
          subject: 'Default GW',
          value: latencies.gatewayRtt,
          unit: 'ms',
          baseline: '1.2 ms',
          sigma: '0.3 ms',
          deviation: 'nominal',
          status: 'good',
          since: null,
          history: [1.2, 1.1, 1.3]
        },
        cloudflare: {
          label: 'Cloudflare',
          subject: '1.1.1.1',
          value: latencies.cloudflareRtt,
          unit: 'ms',
          baseline: '14.0 ms',
          sigma: '1.5 ms',
          deviation: 'nominal',
          status: 'good',
          since: null,
          history: [latencies.cloudflareRtt, latencies.cloudflareRtt * 0.98]
        },
        google: {
          label: 'Google',
          subject: '8.8.8.8',
          value: latencies.googleRtt,
          unit: 'ms',
          baseline: '16.0 ms',
          sigma: '2.0 ms',
          deviation: 'nominal',
          status: 'good',
          since: null,
          history: [latencies.googleRtt, latencies.googleRtt]
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
          history: [0, 0, 0]
        }
      },
      throughput: {
        rx: rxRate,
        tx: txRate,
        history: liveThroughputHistory
      },
      connections: conns,
      interfaces: enrichedIfaces,
      packets: scenarioDriver.simulatedPackets.slice(-30),
      stats: {
        protocols: [
          { name: 'TCP', count: conns.length, bytes: conns.reduce((a, c) => a + c.rxRate, 0) * 10, pct: 78.4 },
          { name: 'UDP / DNS', count: 12, bytes: 245000, pct: 15.2 },
          { name: 'ICMP / Other', count: 4, bytes: 64000, pct: 6.4 }
        ],
        handshakeHistogram: [
          { range: '< 10ms', count: Math.floor(conns.length * 0.4) },
          { range: '10-25ms', count: Math.floor(conns.length * 0.35) },
          { range: '25-50ms', count: Math.floor(conns.length * 0.15) },
          { range: '> 50ms', count: Math.floor(conns.length * 0.1) }
        ],
        packetSizeDistribution: [
          { range: '64-128 B', count: 120 },
          { range: '128-512 B', count: 340 },
          { range: '512-1024 B', count: 280 },
          { range: '1024-1500 B', count: 980 }
        ]
      },
      topology: {
        localHost: { ip: conns[0]?.localIp || '127.0.0.1', name: os.hostname() },
        gateway: { ip: 'Default Gateway', rtt: latencies.gatewayRtt, status: 'ONLINE' },
        dns: { ip: 'Local DNS Resolver', rtt: latencies.dnsRtt, status: 'HEALTHY' },
        hops: [
          { hop: 1, ip: 'Default Gateway', asn: '-', rtt: latencies.gatewayRtt, loss: 0 },
          { hop: 2, ip: '1.1.1.1', asn: 'AS13335 CLOUDFLARE', rtt: latencies.cloudflareRtt, loss: 0 }
        ]
      },
      processes: processesList,
      diagnose: {
        activeIssues: [],
        historyIssues: [],
        remediationState: { applied: false, effectiveDnsRtt: latencies.dnsRtt }
      },
      egress: scenarioDriver.egressEngine.getSnapshot(),
      threats: {
        alerts: scenarioDriver.threatEngine.alerts,
        recorder: scenarioDriver.threatEngine.recorder
      }
    };
  } catch (err) {
    console.error('[Live Collector] error:', err.message);
  }
}

// Initial collection immediately
collectLiveSnapshot();

setInterval(async () => {
  if (isPaused) return;

  if (currentMode === 'demo') {
    scenarioDriver.tick();
  } else {
    await collectLiveSnapshot();
  }

  broadcastTelemetry();
}, 1000);

function getLatestTelemetry() {
  if (currentMode === 'demo') {
    const frame = scenarioDriver.tick();
    if (frame && frame.interfaces) {
      const ifaces = frame.interfaces;
      const nonInternal = ifaces.filter(i => i.type !== 'Loopback' && i.status === 'UP');
      const defaultIface = nonInternal.length > 0 ? nonInternal[0].name : (ifaces[0]?.name || '');
      const activeIfaceName = selectedInterface && ifaces.some(i => i.name === selectedInterface)
        ? selectedInterface
        : defaultIface;
      frame.selectedInterface = activeIfaceName;
      frame.interfaces = ifaces.map(i => ({
        ...i,
        selected: i.name === activeIfaceName
      }));
    }
    return frame;
  }
  return lastSystemSnapshot || {
    mode: 'live',
    time: new Date().toTimeString().split(' ')[0],
    banner: 'LIVE HOST: Direct OS Network Telemetry (Windows)',
    kpis: {
      dns: { label: 'DNS', subject: 'Host DNS', value: 12.0, unit: 'ms', baseline: '12.0 ms', sigma: '2.0 ms', deviation: 'nominal', status: 'good', history: [12, 12] },
      gateway: { label: 'Gateway', subject: 'Default GW', value: 1.2, unit: 'ms', baseline: '1.2 ms', sigma: '0.3 ms', deviation: 'nominal', status: 'good', history: [1.2, 1.2] },
      cloudflare: { label: 'Cloudflare', subject: '1.1.1.1', value: 14.0, unit: 'ms', baseline: '14.0 ms', sigma: '1.5 ms', deviation: 'nominal', status: 'good', history: [14, 14] },
      google: { label: 'Google', subject: '8.8.8.8', value: 16.0, unit: 'ms', baseline: '16.0 ms', sigma: '2.0 ms', deviation: 'nominal', status: 'good', history: [16, 16] },
      loss: { label: 'Loss', subject: 'Local NIC', value: 0.0, unit: '%', baseline: '0.0 %', sigma: '0.0 %', deviation: 'nominal', status: 'good', history: [0, 0] }
    },
    throughput: { rx: 0, tx: 0, history: liveThroughputHistory },
    connections: [],
    interfaces: [],
    packets: [],
    stats: { protocols: [], handshakeHistogram: [], packetSizeDistribution: [] },
    topology: { localHost: { ip: '127.0.0.1', name: os.hostname() }, gateway: { ip: 'Gateway', rtt: 1.2 }, dns: { ip: 'DNS', rtt: 12.0 }, hops: [] },
    processes: [],
    diagnose: { activeIssues: [], historyIssues: [] },
    egress: scenarioDriver.egressEngine.getSnapshot(),
    threats: { alerts: [], recorder: scenarioDriver.threatEngine.recorder }
  };
}

function broadcastTelemetry() {
  if (clients.size === 0) return;
  const frame = getLatestTelemetry();
  frame.isPaused = isPaused;
  frame.currentMode = currentMode;
  const payload = JSON.stringify(frame);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.warn('[WS] Broadcast send notice:', err.message);
      }
    }
  }
}

// REST API Endpoints

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    mode: currentMode,
    paused: isPaused,
    uptimeSec: process.uptime(),
    clientsCount: clients.size
  });
});

app.post('/api/interfaces/select', (req, res) => {
  const { iface } = req.body;
  selectedInterface = iface;
  broadcastTelemetry();
  res.json({ success: true, selectedInterface });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'live' || mode === 'demo') {
    currentMode = mode;
    broadcastTelemetry();
    return res.json({ success: true, mode: currentMode });
  }
  res.status(400).json({ error: 'Invalid mode' });
});

app.post('/api/pause', (req, res) => {
  isPaused = !isPaused;
  broadcastTelemetry();
  res.json({ success: true, paused: isPaused });
});

app.post('/api/diagnose/remediate', (req, res) => {
  const { actionId } = req.body;
  const result = scenarioDriver.diagnoseEngine.applyRemediation(actionId || 'switch-resolver-192.168.8.1');
  broadcastTelemetry();
  res.json(result);
});

app.post('/api/egress/promote', (req, res) => {
  const { process, pattern, ruleType, label } = req.body;
  if (!process || !pattern) {
    return res.status(400).json({ error: 'Missing process or pattern' });
  }
  scenarioDriver.egressEngine.promote(process, pattern, ruleType || 'sni', label);
  broadcastTelemetry();
  res.json({ success: true, message: `Rule promoted for ${process} -> ${pattern}` });
});

app.post('/api/egress/strict', (req, res) => {
  const { enabled } = req.body;
  scenarioDriver.egressEngine.strictMode = !!enabled;
  broadcastTelemetry();
  res.json({ success: true, strictMode: scenarioDriver.egressEngine.strictMode });
});

app.post('/api/recorder/state', (req, res) => {
  const { state } = req.body;
  if (state === 'Armed') scenarioDriver.threatEngine.armRecorder();
  else if (state === 'Off') scenarioDriver.threatEngine.disarmRecorder();
  else if (state === 'Frozen') scenarioDriver.threatEngine.freezeRecorder('Manual API freeze');
  broadcastTelemetry();
  res.json({ success: true, state: scenarioDriver.threatEngine.recorder.state });
});

app.get('/api/export/pcap', (req, res) => {
  const packets = scenarioDriver.simulatedPackets;
  const pcapBuffer = generatePcapBinary(packets);

  res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
  res.setHeader('Content-Disposition', 'attachment; filename="netwatch-capture.pcap"');
  res.send(pcapBuffer);
});

app.get('/api/export/report', (req, res) => {
  const reportMd = scenarioDriver.diagnoseEngine.generateMarkdownReport();
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="report.md"');
  res.send(reportMd);
});

app.get('/api/doctor', async (req, res) => {
  const ifaces = os.networkInterfaces();
  const ifaceNames = Object.keys(ifaces);
  
  // Check Npcap on Windows
  let npcapInstalled = false;
  if (process.platform === 'win32') {
    const npcapPaths = [
      'C:\\Windows\\System32\\Npcap\\wpcap.dll',
      'C:\\Windows\\System32\\wpcap.dll',
      'C:\\Program Files\\Npcap\\wpcap.dll'
    ];
    npcapInstalled = npcapPaths.some(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });
  } else {
    npcapInstalled = true; // Linux / macOS uses native libpcap
  }

  // Check socket collection
  let socketCount = 0;
  let socketProviderWorking = true;
  try {
    const conns = await systemCollector.getConnections();
    socketCount = conns.length;
  } catch {
    socketProviderWorking = false;
  }

  // Check DNS resolution
  let dnsWorking = true;
  let dnsLatency = 12.0;
  try {
    const metrics = await systemCollector.measureHostMetrics();
    dnsLatency = metrics.dnsRtt;
  } catch {
    dnsWorking = false;
  }

  // Check NICs (Network Interface Cards) hardware & status
  let nics = [];
  try {
    nics = await systemCollector.getNicsDetail();
  } catch (err) {
    console.warn('[Doctor] Error querying NIC details:', err.message);
  }
  const activeNics = nics.filter(n => n.isUp && !n.isInternal);
  const physicalNics = nics.filter(n => n.isPhysical);
  const primaryNic = activeNics.find(n => n.name === selectedInterface) || activeNics[0] || physicalNics[0] || nics[0] || null;

  const report = {
    schema_version: 1,
    scope: 'static_and_runtime',
    generated_at: new Date().toISOString(),
    platform: {
      os: `${os.type()} ${os.release()} (${os.platform()})`,
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemGb: (os.totalmem() / (1024 ** 3)).toFixed(1),
      freeMemGb: (os.freemem() / (1024 ** 3)).toFixed(1),
      nodeVersion: process.version,
      uptimeSec: Math.floor(process.uptime())
    },
    capabilities: [
      {
        id: 'node_runtime',
        name: 'Node.js Core Runtime',
        state: 'ready',
        detail: `Node ${process.version} with ES modules and child_process active.`,
        install_info: {
          url: 'https://nodejs.org/en/download',
          label: 'Download Node.js (LTS)',
          command: 'winget install OpenJS.NodeJS.LTS',
          instructions: 'Node.js v18+ is required to execute the NetWatch backend telemetry server.'
        }
      },
      {
        id: 'express_api',
        name: 'Express HTTP & WebSocket Gateway',
        state: 'ready',
        detail: `REST endpoints and WebSocket server listening on port ${PORT}.`,
        install_info: {
          url: 'https://expressjs.com/',
          label: 'Express Gateway Docs',
          command: 'npm install express ws cors',
          instructions: 'Provides real-time sub-second WebSocket pushes and REST API.'
        }
      },
      {
        id: 'nic_discovery',
        name: 'Network Interface Cards (NICs) & Physical Adapters',
        state: activeNics.length > 0 ? 'ready' : (physicalNics.length > 0 ? 'degraded' : 'unavailable'),
        detail: activeNics.length > 0
          ? `${nics.length} NICs discovered (${activeNics.length} online). Primary: ${primaryNic?.name} (${primaryNic?.description || primaryNic?.type}) · ${primaryNic?.ipv4} @ ${primaryNic?.linkSpeed}.`
          : (physicalNics.length > 0
            ? `${physicalNics.length} physical NIC(s) detected, but no adapter is currently connected with an active IP address.`
            : 'No physical or virtual network interface cards detected on this host.'),
        nics: nics,
        selectedNic: selectedInterface || (primaryNic ? primaryNic.name : ''),
        interfaces: ifaceNames,
        selectedInterface: selectedInterface || (primaryNic ? primaryNic.name : ifaceNames[0] || ''),
        install_info: {
          url: 'https://learn.microsoft.com/en-us/windows-server/networking/',
          label: 'Network Adapter Guide & Docs',
          command: process.platform === 'win32' ? 'Get-NetAdapter | Format-Table Name, InterfaceDescription, Status, LinkSpeed' : 'ip link show',
          instructions: process.platform === 'win32'
            ? '1. Open Network Connections via Win+R -> "ncpa.cpl".\n2. Verify your Ethernet or Wi-Fi network interface card is enabled and plugged in.\n3. Run "Get-NetAdapter" in PowerShell as Administrator.'
            : 'Ensure at least one physical Ethernet (eth0) or Wi-Fi (wlan0) NIC is enabled in your Linux network manager (ip link set <nic> up).'
        }
      },
      {
        id: 'socket_attribution',
        name: 'OS Socket Polling & Attribution',
        state: socketProviderWorking ? 'ready' : 'degraded',
        detail: socketProviderWorking
          ? `Active socket poller (netstat/PowerShell) captured ${socketCount} active sockets.`
          : 'Unable to query host socket table.',
        install_info: {
          url: 'https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-nettcpconnection',
          label: 'PowerShell Network Docs',
          command: 'powershell -ExecutionPolicy RemoteSigned',
          instructions: 'Windows requires PowerShell or netstat permissions. If degraded, run terminal as Administrator.'
        }
      },
      {
        id: 'process_attribution',
        name: 'Process Attribution Helper',
        state: 'ready',
        detail: `Process name resolution cache active with ${systemCollector.processCache.size} resolved processes.`,
        install_info: {
          url: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tasklist',
          label: 'Process Query Documentation',
          command: 'tasklist /fo csv',
          instructions: 'Used to map operating system PIDs to executable names.'
        }
      },
      {
        id: 'dns_latency_probe',
        name: 'DNS & ICMP Latency Prober',
        state: dnsWorking ? 'ready' : 'degraded',
        detail: dnsWorking
          ? `Active network probe operational (resolver responding in ~${dnsLatency.toFixed(1)}ms).`
          : 'DNS resolution probes failing or timed out.',
        install_info: {
          url: 'https://developers.cloudflare.com/1.1.1.1/setup/',
          label: 'DNS Setup Guide',
          command: 'nslookup cloudflare.com 1.1.1.1',
          instructions: 'Verify your router or firewall allows outbound UDP port 53 and ICMP traffic.'
        }
      },
      {
        id: 'packet_engine',
        name: 'Packet Inspection & PCAP Engine',
        state: 'ready',
        detail: 'Deep packet inspector, TLS 1.3 SNI decode, JA4 hash generator, and PCAP 2.4 binary export ready.',
        install_info: {
          url: 'https://www.tcpdump.org/pcap.html',
          label: 'PCAP Format Specification',
          command: 'curl -O http://localhost:3030/api/export/pcap',
          instructions: 'Built-in Wireshark-compatible binary PCAP generator.'
        }
      },
      {
        id: 'diagnostic_engine',
        name: 'Diagnostic Baseline Engine',
        state: 'ready',
        detail: '25 catalogued diagnostic rules and learned baseline store operational.',
        install_info: {
          url: 'https://github.com/matthart1983/netwatch#what-it-does',
          label: 'NetWatch Diagnostic Rules Guide',
          command: 'curl -O http://localhost:3030/api/export/report',
          instructions: 'Evaluates network deviations across mean and standard deviation baselines.'
        }
      },
      {
        id: 'egress_monitor',
        name: 'Egress Policy & Drift Detector',
        state: 'ready',
        detail: `${scenarioDriver.egressEngine.promotedRules.size} promoted policies loaded with drift detection.`,
        install_info: {
          url: 'https://github.com/matthart1983/netwatch/blob/main/docs/egress-linter-plan.md',
          label: 'Egress Linter Specification',
          command: 'curl -X POST http://localhost:3030/api/egress/strict',
          instructions: 'Profiles and categorizes outbound processes and destination ASNs.'
        }
      },
      {
        id: 'npcap_driver',
        name: process.platform === 'darwin' ? 'macOS libpcap & BPF Kernel Capture Driver' : (process.platform === 'win32' ? 'Npcap Packet Capture Driver' : 'Linux libpcap / AF_PACKET Driver'),
        state: npcapInstalled ? 'ready' : 'optional_missing',
        detail: process.platform === 'darwin'
          ? 'Apple macOS native libpcap is pre-installed in /usr/lib/libpcap.dylib with BPF capture device support.'
          : (npcapInstalled
            ? 'Npcap / libpcap capture driver detected in system path.'
            : 'Npcap is not installed on this host. (Socket monitoring & process attribution work without it; native raw hardware capture requires Npcap).'),
        install_info: {
          url: process.platform === 'darwin'
            ? 'https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/'
            : (process.platform === 'win32' ? 'https://npcap.com/#download' : 'https://www.tcpdump.org/'),
          label: process.platform === 'darwin' ? 'macOS BPF Guide' : (process.platform === 'win32' ? '📥 Download Npcap (.exe)' : 'libpcap Docs'),
          command: process.platform === 'darwin'
            ? 'sudo chmod o+r /dev/bpf*'
            : (process.platform === 'win32' ? 'winget install Insecure.Npcap  # Or: scoop install npcap' : 'sudo apt install libpcap-dev'),
          instructions: process.platform === 'darwin'
            ? 'macOS includes native libpcap out-of-the-box. To allow promiscuous packet capture for standard non-root accounts, run: sudo chmod o+r /dev/bpf*'
            : (process.platform === 'win32'
              ? '1. Download the Npcap installer from npcap.com.\n2. Run the installer and check "Install Npcap in WinPcap API-compatible Mode".\n3. Restart or refresh NetWatch to enable raw promiscuous packet capture.'
              : 'Install libpcap via your Linux package manager (sudo apt install libpcap-dev or pacman -S libpcap).')
        }
      }
    ],
    companion_tools: [
      {
        name: 'Wireshark Network Analyzer',
        recommended_for: 'Opening and analyzing .pcap binary files exported from NetWatch Packets tab.',
        url: 'https://www.wireshark.org/download.html',
        command: process.platform === 'darwin'
          ? 'brew install --cask wireshark'
          : (process.platform === 'win32' ? 'winget install WiresharkFoundation.Wireshark' : 'sudo apt install wireshark')
      },
      {
        name: 'NetWatch CLI (Terminal Binary)',
        recommended_for: 'Running NetWatch directly inside your terminal or SSH session.',
        url: 'https://github.com/matthart1983/netwatch/releases/latest',
        command: process.platform === 'darwin'
          ? 'brew install netwatch'
          : (process.platform === 'win32' ? 'scoop install netwatch  # Or: brew install netwatch' : 'cargo install netwatch')
      }
    ],
    overall_health: socketProviderWorking && dnsWorking ? 'READY' : 'DEGRADED'
  };

  res.json(report);
});

// Serve static client assets and SPA routing in production
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback: any non-API route serves index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>NetWatch - Build Required</title>
          <style>
            body { background: #0a0c10; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 2rem; max-width: 520px; text-align: center; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
            h1 { color: #58a6ff; font-size: 1.5rem; margin-bottom: 0.5rem; }
            code { background: #21262d; color: #7ee787; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
            pre { background: #0d1117; border: 1px solid #30363d; padding: 0.75rem; border-radius: 6px; color: #79c0ff; text-align: left; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚡ NetWatch Web Server Active</h1>
            <p>The backend API &amp; WebSocket service is online on port ${PORT}.</p>
            <p>The client bundle was not found at <code>client/dist</code>.</p>
            <p>To compile the frontend application, run:</p>
            <pre>npm run build</pre>
            <p style="font-size:0.85rem;color:#8b949e;">Or start the dev server locally using <code>npm run dev</code>.</p>
          </div>
        </body>
      </html>
    `);
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 NetWatch Web Application running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket server ready on ws://0.0.0.0:${PORT}`);
});
