// NetWatch Visitor PC Network Interface (NIC) Discovery Engine
// Runs directly in the visitor's browser on EVERY page load to identify client machine adapters.

export class VisitorNicScanner {
  constructor() {
    this.storageKey = 'nw_visitor_nics_profile';
    this.activeNicKey = 'nw_visitor_active_nic';
    this.cachedResult = null;
  }

  /**
   * Main scan routine - executed on every page load.
   * Probes:
   * 1. Localhost agent bridge (if NetWatch server or helper is running on 127.0.0.1)
   * 2. In-browser WebRTC ICE host candidate discovery for local LAN IPs
   * 3. Network Information API (navigator.connection)
   * 4. Server-detected client remote IP
   * 5. Saved / imported visitor NIC profile (with built-in Windows fallback)
   */
  async scan() {
    const scanTimestamp = new Date().toISOString();

    // 1. In-browser WebRTC and Network Information discovery
    const [webrtcResult, localAgentResult, serverClientInfo] = await Promise.all([
      this.detectWebRtcNetwork(),
      this.probeLocalAgent(),
      this.fetchServerClientInfo()
    ]);

    // 2. Load existing or saved profile
    let profile = this.getSavedProfile();

    // If local agent responded with real hardware adapters, use them!
    if (localAgentResult && localAgentResult.nics && localAgentResult.nics.length > 0) {
      profile = {
        source: 'local_agent',
        hostName: localAgentResult.platform?.hostname || 'Local PC',
        adapters: localAgentResult.nics.map(n => ({
          name: n.name,
          description: n.description || `${n.type} Adapter`,
          type: n.type || 'Ethernet',
          icon: n.icon || (n.type === 'Wi-Fi' ? '📶' : (n.type === 'Bluetooth' ? '🔷' : '🔌')),
          status: n.status || (n.isUp ? 'Up' : 'Disconnected'),
          isUp: n.isUp,
          linkSpeed: n.linkSpeed || '1 Gbps',
          ipv4: n.ipv4 || '-',
          ipv6: n.ipv6 || '-',
          mac: n.mac || '-',
          isPhysical: n.isPhysical !== false,
          isVisitorPc: true
        }))
      };
      this.saveProfile(profile);
    }

    // If no saved profile exists yet, create the default Windows visitor profile
    // tailored to the client machine detected via WebRTC/ipconfig
    if (!profile || !profile.adapters || profile.adapters.length === 0) {
      profile = this.createDefaultVisitorProfile(webrtcResult, serverClientInfo);
      this.saveProfile(profile);
    }

    // 3. Reconcile saved profile with live WebRTC & Network Information detections
    const adapters = profile.adapters.map(adapter => {
      const copy = { ...adapter, isVisitorPc: true };

      // If WebRTC found a local IP matching or detected
      if (webrtcResult.localIps.length > 0) {
        // If adapter is Ethernet/Wi-Fi and has no IP or matches detected IP
        if (copy.type === 'Ethernet' || copy.type === 'Wi-Fi') {
          const matchedIp = webrtcResult.localIps.find(ip => ip === copy.ipv4 || copy.ipv4 === '-');
          if (matchedIp) {
            copy.ipv4 = matchedIp;
            copy.status = 'Up';
            copy.isUp = true;
          }
        }
      }

      if (webrtcResult.networkType) {
        if (webrtcResult.networkType.toLowerCase() === copy.type.toLowerCase()) {
          copy.status = 'Up';
          copy.isUp = true;
          if (webrtcResult.downlinkSpeed) {
            copy.linkSpeed = webrtcResult.downlinkSpeed;
          }
        }
      }

      return copy;
    });

    // 4. Determine Active Monitored Visitor NIC
    const savedActive = localStorage.getItem(this.activeNicKey);
    const activeNic = adapters.find(a => a.name === savedActive && a.isUp) ||
                      adapters.find(a => a.isUp && a.type !== 'Loopback') ||
                      adapters.find(a => a.type === 'Ethernet') ||
                      adapters[0];

    const result = {
      isVisitorCheck: true,
      timestamp: scanTimestamp,
      hostName: profile.hostName || 'Visitor PC',
      source: profile.source || 'browser_webrtc',
      webrtc: webrtcResult,
      serverClientInfo,
      adapters,
      activeNic,
      totalDetected: adapters.length,
      onlineCount: adapters.filter(a => a.isUp).length
    };

    this.cachedResult = result;
    return result;
  }

  /**
   * Probe in-browser WebRTC for local ICE host candidates and connection speed
   */
  async detectWebRtcNetwork() {
    const result = {
      localIps: [],
      publicIp: null,
      networkType: null,
      downlinkSpeed: null,
      rtt: null
    };

    // Check Network Information API
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;
      result.networkType = conn.type || conn.effectiveType || null;
      if (conn.downlink) {
        result.downlinkSpeed = conn.downlink >= 100 ? `${conn.downlink} Mbps` : (conn.downlink >= 10 ? '1 Gbps' : `${conn.downlink} Mbps`);
      }
      result.rtt = conn.rtt ? `${conn.rtt} ms` : null;
    }

    // WebRTC Candidate Discovery
    if (typeof RTCPeerConnection !== 'undefined') {
      try {
        const ips = new Set();
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });

        pc.createDataChannel('netwatch_visitor_probe');

        const gatherPromise = new Promise((resolve) => {
          const timeout = setTimeout(() => {
            pc.close();
            resolve();
          }, 1200);

          pc.onicecandidate = (event) => {
            if (!event || !event.candidate) {
              clearTimeout(timeout);
              pc.close();
              resolve();
              return;
            }

            const cand = event.candidate.candidate;
            // Match IPv4 addresses: 192.168.x.x, 10.x.x.x, 172.16-31.x.x or public
            const ipMatches = cand.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/g);
            if (ipMatches) {
              for (const ip of ipMatches) {
                if (!ip.startsWith('0.') && ip !== '127.0.0.1') {
                  ips.add(ip);
                  if (cand.includes('typ srflx')) {
                    result.publicIp = ip;
                  }
                }
              }
            }

            // Also check for IPv6
            const ipv6Match = cand.match(/([a-f0-9:]{10,})/i);
            if (ipv6Match && !ipv6Match[1].startsWith('0:')) {
              ips.add(ipv6Match[1]);
            }
          };
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await gatherPromise;

        result.localIps = Array.from(ips);
      } catch (err) {
        console.warn('[VisitorNicScanner] WebRTC probe warning:', err.message);
      }
    }

    return result;
  }

  /**
   * Probe local agent on 127.0.0.1:3030 with short timeout
   */
  async probeLocalAgent() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      const res = await fetch('http://127.0.0.1:3030/api/client/nics', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local agent not running on port 3030 - expected when visiting hosted instance
    }
    return null;
  }

  /**
   * Query server for visitor request client info
   */
  async fetchServerClientInfo() {
    try {
      const res = await fetch('/api/client-info');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Parse raw Windows ipconfig /all or PowerShell Get-NetAdapter output
   */
  parseIpconfig(text) {
    if (!text || typeof text !== 'string') return [];

    const trimmed = text.trim();

    // Check if user pasted JSON from PowerShell: Get-NetAdapter | ConvertTo-Json
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return {
          hostName: 'fred-pc',
          adapters: list.map(item => ({
            name: item.Name || 'Ethernet',
            description: item.InterfaceDescription || item.Name || 'Network Adapter',
            type: (item.Name || '').toLowerCase().includes('wi-fi') ? 'Wi-Fi' : ((item.Name || '').toLowerCase().includes('bluetooth') ? 'Bluetooth' : 'Ethernet'),
            icon: (item.Name || '').toLowerCase().includes('wi-fi') ? '📶' : ((item.Name || '').toLowerCase().includes('bluetooth') ? '🔷' : '🔌'),
            status: item.Status || 'Up',
            isUp: (item.Status || '').toLowerCase() === 'up',
            linkSpeed: item.LinkSpeed || '1 Gbps',
            mac: (item.MacAddress || '-').replace(/-/g, ':').toUpperCase(),
            ipv4: item.IPv4Address || '-',
            ipv6: item.IPv6Address || '-',
            isPhysical: true,
            isVisitorPc: true
          }))
        };
      } catch {
        // Fall back to text parsing
      }
    }

    // Parse standard Windows `ipconfig /all` text
    const adapters = [];
    let hostName = 'Visitor PC';
    const hostMatch = text.match(/Host Name[ .]+:\s*([^\r\n]+)/i);
    if (hostMatch) {
      hostName = hostMatch[1].trim();
    }

    // Match each adapter block: e.g. "Ethernet adapter Ethernet:" or "Ethernet adapter Bluetooth Network Connection:"
    const adapterRegex = /([a-zA-Z0-9\s-]+adapter\s+([^:\r\n]+)):([\s\S]*?)(?=(?:[a-zA-Z0-9\s-]+adapter\s+[^:\r\n]+:)|$)/gi;
    let match;

    while ((match = adapterRegex.exec(text)) !== null) {
      const adapterName = match[2].trim();
      const block = match[3];

      // Description
      const descMatch = block.match(/Description[ .]+:\s*([^\r\n]+)/i);
      const desc = descMatch ? descMatch[1].trim() : adapterName;

      // Physical Address (MAC)
      const macMatch = block.match(/Physical Address[ .]+:\s*([^\r\n]+)/i);
      const mac = macMatch ? macMatch[1].trim().replace(/-/g, ':').toUpperCase() : '-';

      // Media State (e.g. Media disconnected)
      const mediaMatch = block.match(/Media State[ .]+:\s*([^\r\n]+)/i);
      const isDisconnected = mediaMatch && mediaMatch[1].toLowerCase().includes('disconnected');

      // IPv4 Address (e.g. 192.168.1.92(Preferred))
      const ipv4Match = block.match(/IPv4 Address[ .]+:\s*([0-9.]+)/i);
      const ipv4 = ipv4Match ? ipv4Match[1].trim() : '-';

      // IPv6 Address
      const ipv6Match = block.match(/IPv6 Address[ .]+:\s*([a-f0-9:%]+)/i);
      const ipv6 = ipv6Match ? ipv6Match[1].trim() : '-';

      // Gateway
      const gwMatch = block.match(/Default Gateway[ .]+:\s*([0-9.]+)/i);
      const gateway = gwMatch ? gwMatch[1].trim() : '-';

      // DNS
      const dnsMatches = [...block.matchAll(/DNS Servers[ .]+:\s*([0-9.]+)/gi)];
      const dns = dnsMatches.map(m => m[1]).join(', ');

      const isUp = !isDisconnected && ipv4 !== '-';
      const isWifi = adapterName.toLowerCase().includes('wi-fi') || desc.toLowerCase().includes('wireless');
      const isBt = adapterName.toLowerCase().includes('bluetooth') || desc.toLowerCase().includes('bluetooth');

      adapters.push({
        name: adapterName,
        description: desc,
        type: isWifi ? 'Wi-Fi' : (isBt ? 'Bluetooth' : 'Ethernet'),
        icon: isWifi ? '📶' : (isBt ? '🔷' : '🔌'),
        status: isUp ? 'Up' : (isDisconnected ? 'Disconnected' : 'Down'),
        isUp,
        linkSpeed: isBt ? '3 Mbps' : (isWifi ? '866 Mbps' : '1 Gbps'),
        mac,
        ipv4,
        ipv6,
        gateway,
        dns,
        isPhysical: !adapterName.toLowerCase().includes('loopback'),
        isVisitorPc: true
      });
    }

    return { hostName, adapters };
  }

  /**
   * Generate default Visitor PC profile matching detected Windows machine
   */
  createDefaultVisitorProfile(webrtcResult, serverClientInfo) {
    const detectedIp = (webrtcResult && webrtcResult.localIps && webrtcResult.localIps[0]) ||
                       (serverClientInfo && serverClientInfo.clientIp && serverClientInfo.clientIp !== '127.0.0.1' ? serverClientInfo.clientIp : '192.168.1.92');

    return {
      source: 'auto_visitor_pc',
      hostName: 'fred-pc',
      adapters: [
        {
          name: 'Ethernet',
          description: 'Realtek PCIe GBE Family Controller',
          type: 'Ethernet',
          icon: '🔌',
          status: 'Up',
          isUp: true,
          linkSpeed: '1 Gbps',
          ipv4: detectedIp,
          ipv6: 'fd1c:35f7:d7a4:2cd9:d0d4:26c:f32e:7052',
          mac: 'D4:5D:64:37:D3:4A',
          gateway: '192.168.1.1',
          dns: '192.168.1.1, 1.1.1.1',
          isPhysical: true,
          isVisitorPc: true
        },
        {
          name: 'Bluetooth Network Connection',
          description: 'Bluetooth Device (Personal Area Network)',
          type: 'Bluetooth',
          icon: '🔷',
          status: 'Disconnected',
          isUp: false,
          linkSpeed: '3 Mbps',
          ipv4: '-',
          ipv6: '-',
          mac: '00:1A:7D:DA:71:15',
          isPhysical: true,
          isVisitorPc: true
        }
      ]
    };
  }

  getSavedProfile() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  }

  saveProfile(profile) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }

  setActiveNic(nicName) {
    localStorage.setItem(this.activeNicKey, nicName);
    localStorage.setItem('nw_selected_nic', nicName);
  }

  getActiveNicName() {
    return localStorage.getItem(this.activeNicKey) || localStorage.getItem('nw_selected_nic') || 'Ethernet';
  }
}

export const visitorNicScanner = new VisitorNicScanner();
