// NetWatch UniFi Controller Service
// Handles UniFi OS (UDM, Cloud Key, Cloud Gateway) and Standalone UniFi Network Application APIs
import https from 'https';
import http from 'http';
import { URL } from 'url';

export class UnifiService {
  constructor() {
    this.config = {
      controllerUrl: '',
      authType: 'apiKey', // 'apiKey' | 'credentials'
      apiKey: '',
      username: '',
      password: '',
      site: 'default',
      strictSsl: false
    };

    this.sessionCookie = null;
    this.isDemo = true; // Default to demo so UI is instantly rich and testable
    this.lastSync = new Date().toISOString();
    this.cachedData = null;
  }

  getStatus() {
    return {
      connected: this.isDemo || !!(this.config.controllerUrl && (this.config.apiKey || this.sessionCookie)),
      isDemo: this.isDemo,
      controllerUrl: this.config.controllerUrl || (this.isDemo ? 'https://192.168.1.1 (Demo Controller)' : ''),
      authType: this.config.authType,
      site: this.config.site,
      strictSsl: this.config.strictSsl,
      lastSync: this.lastSync,
      controllerInfo: this.getControllerInfo()
    };
  }

  getControllerInfo() {
    if (this.isDemo) {
      return {
        name: 'UDM-Pro-HomeLab',
        model: 'UniFi Dream Machine Pro',
        version: 'UniFi OS 4.0.6 · Network 8.6.9',
        ip: '192.168.1.1',
        wanIp: '198.51.100.42',
        isp: 'Fiber Gigabit (1000/1000)',
        uptime: '24d 18h 32m',
        cpuPercent: 19,
        memoryPercent: 54,
        temperatureC: 46
      };
    }

    if (this.cachedData && this.cachedData.sysinfo) {
      const s = this.cachedData.sysinfo;
      return {
        name: s.hostname || s.name || 'UniFi Gateway',
        model: s.model || 'UniFi Network Controller',
        version: s.version || 'v8.x',
        ip: this.config.controllerUrl,
        wanIp: s.wan_ip || '-',
        isp: s.isp_name || 'Active Uplink',
        uptime: s.uptime ? `${Math.floor(s.uptime / 86400)}d ${Math.floor((s.uptime % 86400) / 3600)}h` : 'Online',
        cpuPercent: s.cpu || 20,
        memoryPercent: s.mem || 50,
        temperatureC: s.temperature || 45
      };
    }

    return {
      name: 'UniFi Controller',
      model: 'UniFi OS',
      version: 'Connected',
      ip: this.config.controllerUrl,
      wanIp: '-',
      isp: 'Online',
      uptime: 'Active',
      cpuPercent: 15,
      memoryPercent: 45,
      temperatureC: 44
    };
  }

  enableDemoMode() {
    this.isDemo = true;
    this.lastSync = new Date().toISOString();
    return this.getStatus();
  }

  disconnect() {
    this.isDemo = false;
    this.sessionCookie = null;
    this.config.controllerUrl = '';
    this.config.apiKey = '';
    this.config.username = '';
    this.config.password = '';
    this.cachedData = null;
    return this.getStatus();
  }

  async testConnection(targetConfig) {
    const cfg = { ...this.config, ...targetConfig };
    if (!cfg.controllerUrl) {
      return { success: false, error: 'Controller URL is required (e.g. https://192.168.1.1)' };
    }

    try {
      const url = new URL(cfg.controllerUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { success: false, error: 'Invalid protocol. URL must start with http:// or https://' };
      }

      if (cfg.authType === 'apiKey') {
        if (!cfg.apiKey) {
          return { success: false, error: 'UniFi API Key is required' };
        }
        // Test API Key against UniFi OS endpoint
        const endpoints = [
          `/proxy/network/api/s/${cfg.site}/stat/sysinfo`,
          `/proxy/network/api/s/${cfg.site}/stat/health`,
          `/api/s/${cfg.site}/stat/sysinfo`
        ];

        let lastErr = null;
        for (const ep of endpoints) {
          try {
            const res = await this._rawRequest(cfg.controllerUrl, ep, {
              method: 'GET',
              headers: {
                'X-API-KEY': cfg.apiKey,
                'Accept': 'application/json'
              },
              strictSsl: cfg.strictSsl,
              timeout: 6000
            });

            if (res.status === 200) {
              return {
                success: true,
                message: 'Successfully connected and authenticated via UniFi API Key!',
                detectedEndpoint: ep,
                meta: res.data?.meta || {}
              };
            } else if (res.status === 401 || res.status === 403) {
              return { success: false, error: 'Authentication failed. Please verify your UniFi API Key permissions.' };
            }
          } catch (err) {
            lastErr = err;
          }
        }

        return {
          success: false,
          error: lastErr ? `Connection failed: ${lastErr.message}` : 'Could not reach UniFi API endpoints on this host.'
        };
      } else {
        // Username and password login test
        if (!cfg.username || !cfg.password) {
          return { success: false, error: 'Username and password are required' };
        }

        // Try UniFi OS auth login
        const loginEndpoints = [
          { path: '/api/auth/login', body: { username: cfg.username, password: cfg.password, token: '' } },
          { path: '/api/login', body: { username: cfg.username, password: cfg.password } }
        ];

        let lastErr = null;
        for (const target of loginEndpoints) {
          try {
            const res = await this._rawRequest(cfg.controllerUrl, target.path, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(target.body),
              strictSsl: cfg.strictSsl,
              timeout: 6000
            });

            if (res.status === 200) {
              const cookie = res.headers['set-cookie'];
              return {
                success: true,
                message: 'Successfully authenticated with UniFi controller credentials!',
                sessionCaptured: !!cookie
              };
            } else if (res.status === 401 || res.status === 403) {
              return { success: false, error: 'Invalid username or password on UniFi controller.' };
            }
          } catch (err) {
            lastErr = err;
          }
        }

        return {
          success: false,
          error: lastErr ? `Connection error: ${lastErr.message}` : 'Failed to authenticate with UniFi controller.'
        };
      }
    } catch (err) {
      return { success: false, error: `Invalid Controller URL: ${err.message}` };
    }
  }

  async configure(newConfig) {
    const test = await this.testConnection(newConfig);
    if (!test.success) {
      return test;
    }

    this.config = { ...this.config, ...newConfig };
    this.isDemo = false;

    // If credentials auth, perform actual login and store session cookie
    if (this.config.authType === 'credentials') {
      try {
        const loginRes = await this._rawRequest(this.config.controllerUrl, '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.config.username, password: this.config.password, token: '' }),
          strictSsl: this.config.strictSsl
        });
        if (loginRes.headers['set-cookie']) {
          this.sessionCookie = loginRes.headers['set-cookie'].join('; ');
        }
      } catch {
        // Fallback to legacy login
        try {
          const legacyRes = await this._rawRequest(this.config.controllerUrl, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: this.config.username, password: this.config.password }),
            strictSsl: this.config.strictSsl
          });
          if (legacyRes.headers['set-cookie']) {
            this.sessionCookie = legacyRes.headers['set-cookie'].join('; ');
          }
        } catch {
          // ignore
        }
      }
    }

    this.lastSync = new Date().toISOString();
    return { success: true, message: 'UniFi Controller connected successfully!' };
  }

  async getHealth() {
    if (this.isDemo) {
      return {
        overall: 'GOOD',
        wan: {
          status: 'CONNECTED',
          ip: '198.51.100.42',
          gateway: 'UDM-Pro',
          latencyMs: 7.8,
          packetLossPct: 0.0,
          downloadMbps: 940.2,
          uploadMbps: 915.6,
          uptimeSec: 2140320
        },
        lan: {
          status: 'GOOD',
          subnets: ['192.168.1.0/24 (Default)', '192.168.10.0/24 (IoT)', '192.168.20.0/24 (Guests)'],
          dhcpLeasesActive: 27
        },
        wlan: {
          status: 'GOOD',
          experienceScore: 98,
          channelUtilization24: 14.5,
          channelUtilization5: 11.2,
          channelUtilization6: 4.8,
          activeSsids: ['HomeLab-Net', 'HomeLab-IoT', 'HomeLab-Guest']
        },
        poe: {
          totalBudgetWatts: 400,
          usedWatts: 68.4,
          percentUsed: 17.1
        }
      };
    }

    // Live query
    try {
      const data = await this._apiGet(`/proxy/network/api/s/${this.config.site}/stat/health`) ||
                   await this._apiGet(`/api/s/${this.config.site}/stat/health`);
      return data || { overall: 'UNKNOWN' };
    } catch {
      return { overall: 'DEGRADED', error: 'Failed to fetch live health' };
    }
  }

  async getDevices() {
    if (this.isDemo) {
      return this._getDemoDevices();
    }

    try {
      const data = await this._apiGet(`/proxy/network/api/s/${this.config.site}/stat/device`) ||
                   await this._apiGet(`/api/s/${this.config.site}/stat/device`);
      if (Array.isArray(data)) {
        return data;
      }
      return data?.data || [];
    } catch (err) {
      console.warn('[UniFi] Error fetching live devices:', err.message);
      return [];
    }
  }

  async getClients() {
    if (this.isDemo) {
      return this._getDemoClients();
    }

    try {
      const data = await this._apiGet(`/proxy/network/api/s/${this.config.site}/stat/sta`) ||
                   await this._apiGet(`/api/s/${this.config.site}/stat/sta`);
      if (Array.isArray(data)) {
        return data;
      }
      return data?.data || [];
    } catch (err) {
      console.warn('[UniFi] Error fetching live clients:', err.message);
      return [];
    }
  }

  async _apiGet(path) {
    const headers = { Accept: 'application/json' };
    if (this.config.authType === 'apiKey' && this.config.apiKey) {
      headers['X-API-KEY'] = this.config.apiKey;
    }
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    const res = await this._rawRequest(this.config.controllerUrl, path, {
      method: 'GET',
      headers,
      strictSsl: this.config.strictSsl
    });

    return res.data;
  }

  _rawRequest(baseUrl, path, options = {}) {
    return new Promise((resolve, reject) => {
      const fullUrl = new URL(path, baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const reqOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 8000
      };

      if (isHttps) {
        reqOptions.agent = new https.Agent({
          rejectUnauthorized: options.strictSsl === true
        });
      }

      const req = transport.request(fullUrl, reqOptions, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request to UniFi controller timed out after ${reqOptions.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  _getDemoDevices() {
    return [
      {
        id: 'udm-pro-1',
        name: 'UniFi Dream Machine Pro',
        type: 'ugw',
        model: 'UDM-Pro',
        ip: '192.168.1.1',
        mac: 'e4:38:83:00:11:22',
        state: 1,
        status: 'online',
        uptime: 2140320,
        version: '4.0.6',
        cpu: 19.4,
        mem: 54.2,
        temperature: 46,
        ports: [
          { port_idx: 1, name: 'Port 1 (LAN)', speed: 1000, up: true, poe_mode: 'off' },
          { port_idx: 2, name: 'Port 2 (LAN)', speed: 1000, up: true, poe_mode: 'off' },
          { port_idx: 9, name: 'Port 9 (WAN 2.5G)', speed: 2500, up: true, ip: '198.51.100.42', poe_mode: 'off' },
          { port_idx: 10, name: 'Port 10 (LAN SFP+ 10G)', speed: 10000, up: true, poe_mode: 'off' }
        ],
        subsystems: {
          wan1: { ip: '198.51.100.42', latency: 7.8, download: '940.2 Mbps', upload: '915.6 Mbps' }
        }
      },
      {
        id: 'usw-ent-24',
        name: 'USW-Enterprise-24-PoE',
        type: 'usw',
        model: 'USW-Enterprise-24-PoE',
        ip: '192.168.1.2',
        mac: 'e4:38:83:1a:2b:3c',
        state: 1,
        status: 'online',
        uptime: 2140200,
        version: '7.0.50',
        cpu: 11.2,
        mem: 38.0,
        temperature: 41,
        total_poe_power: 400.0,
        used_poe_power: 68.4,
        ports_count: 24,
        ports: [
          { port_idx: 1, name: 'AP-Office', speed: 2500, up: true, poe: true, poe_power: 18.2, poe_class: 'PoE+' },
          { port_idx: 2, name: 'AP-LivingRoom', speed: 1000, up: true, poe: true, poe_power: 14.5, poe_class: 'PoE+' },
          { port_idx: 3, name: 'AP-Patio', speed: 1000, up: true, poe: true, poe_power: 9.8, poe_class: 'PoE' },
          { port_idx: 4, name: 'G5-Pro-Driveway', speed: 1000, up: true, poe: true, poe_power: 10.2, poe_class: 'PoE+' },
          { port_idx: 5, name: 'G4-Doorbell-PoE', speed: 1000, up: true, poe: true, poe_power: 6.5, poe_class: 'PoE' },
          { port_idx: 6, name: 'Synology-NAS-LAN1', speed: 2500, up: true, poe: false, poe_power: 0 },
          { port_idx: 7, name: 'Mac-Studio-10G', speed: 10000, up: true, poe: false, poe_power: 0 },
          { port_idx: 8, name: 'Gaming-PC-2.5G', speed: 2500, up: true, poe: false, poe_power: 0 },
          { port_idx: 9, name: 'Flex-Mini-Switch', speed: 1000, up: true, poe: true, poe_power: 4.2, poe_class: 'PoE' },
          { port_idx: 24, name: 'Uplink UDM-SE SFP+', speed: 10000, up: true, poe: false, poe_power: 0 }
        ]
      },
      {
        id: 'u6-ent-office',
        name: 'U6-Enterprise-Office',
        type: 'uap',
        model: 'U6-Enterprise',
        ip: '192.168.1.10',
        mac: 'e4:38:83:44:55:66',
        state: 1,
        status: 'online',
        uptime: 2139800,
        version: '6.6.65',
        cpu: 14.8,
        mem: 49.3,
        temperature: 44,
        connected_clients: 14,
        experience: 98,
        radios: [
          { band: '2.4GHz', channel: 1, width: 20, tx_power: 17, utilization: 14 },
          { band: '5GHz', channel: 36, width: 80, tx_power: 24, utilization: 11 },
          { band: '6GHz', channel: 69, width: 160, tx_power: 22, utilization: 4 }
        ]
      },
      {
        id: 'u6-pro-living',
        name: 'U6-Pro-LivingRoom',
        type: 'uap',
        model: 'U6-Pro',
        ip: '192.168.1.11',
        mac: 'e4:38:83:77:88:99',
        state: 1,
        status: 'online',
        uptime: 2139750,
        version: '6.6.65',
        cpu: 12.1,
        mem: 44.0,
        temperature: 42,
        connected_clients: 9,
        experience: 96,
        radios: [
          { band: '2.4GHz', channel: 6, width: 20, tx_power: 17, utilization: 16 },
          { band: '5GHz', channel: 149, width: 80, tx_power: 23, utilization: 12 }
        ]
      },
      {
        id: 'u6-mesh-patio',
        name: 'U6-Mesh-Patio',
        type: 'uap',
        model: 'U6-Mesh',
        ip: '192.168.1.12',
        mac: 'e4:38:83:aa:bb:cc',
        state: 1,
        status: 'online',
        uptime: 2139600,
        version: '6.6.65',
        cpu: 9.4,
        mem: 38.6,
        temperature: 39,
        connected_clients: 4,
        experience: 99,
        radios: [
          { band: '2.4GHz', channel: 11, width: 20, tx_power: 17, utilization: 9 },
          { band: '5GHz', channel: 100, width: 80, tx_power: 22, utilization: 6 }
        ]
      }
    ];
  }

  _getDemoClients() {
    return [
      {
        id: 'cli-1',
        hostname: 'MacBook-Pro-M3',
        ip: '192.168.1.45',
        mac: '3c:22:fb:11:22:33',
        vendor: 'Apple, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:44:55:66',
        ap_name: 'U6-Enterprise-Office',
        essid: 'HomeLab-Net',
        radio: '6GHz',
        channel: 69,
        rssi: -44,
        signal: -44,
        tx_rate: 2401,
        rx_rate: 2401,
        wifi_standard: 'Wi-Fi 6E',
        uptime: 43200,
        rx_bytes: 4210540000,
        tx_bytes: 845200000,
        experience: 99
      },
      {
        id: 'cli-2',
        hostname: 'iPhone-16-Pro',
        ip: '192.168.1.46',
        mac: 'a8:5c:2c:44:55:66',
        vendor: 'Apple, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:44:55:66',
        ap_name: 'U6-Enterprise-Office',
        essid: 'HomeLab-Net',
        radio: '6GHz',
        channel: 69,
        rssi: -48,
        signal: -48,
        tx_rate: 1920,
        rx_rate: 1920,
        wifi_standard: 'Wi-Fi 6E',
        uptime: 21600,
        rx_bytes: 1840000000,
        tx_bytes: 320000000,
        experience: 99
      },
      {
        id: 'cli-3',
        hostname: 'Mac-Studio-10G',
        ip: '192.168.1.100',
        mac: 'e0:d5:5e:aa:bb:cc',
        vendor: 'Apple, Inc.',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 7,
        port_speed: 10000,
        uptime: 184200,
        rx_bytes: 54200000000,
        tx_bytes: 38100000000,
        experience: 100
      },
      {
        id: 'cli-4',
        hostname: 'Synology-DS923-NAS',
        ip: '192.168.1.200',
        mac: '00:11:32:88:99:00',
        vendor: 'Synology Inc.',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 6,
        port_speed: 2500,
        uptime: 184200,
        rx_bytes: 92400000000,
        tx_bytes: 112000000000,
        experience: 100
      },
      {
        id: 'cli-5',
        hostname: 'Gaming-Rig-PC',
        ip: '192.168.1.105',
        mac: 'd8:5e:d3:12:34:56',
        vendor: 'ASUSTeK Computer',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 8,
        port_speed: 2500,
        uptime: 86400,
        rx_bytes: 18500000000,
        tx_bytes: 4200000000,
        experience: 100
      },
      {
        id: 'cli-6',
        hostname: 'Apple-TV-4K-LivingRoom',
        ip: '192.168.1.60',
        mac: 'ac:87:a3:77:88:99',
        vendor: 'Apple, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:77:88:99',
        ap_name: 'U6-Pro-LivingRoom',
        essid: 'HomeLab-Net',
        radio: '5GHz',
        channel: 149,
        rssi: -52,
        signal: -52,
        tx_rate: 866,
        rx_rate: 866,
        wifi_standard: 'Wi-Fi 6',
        uptime: 64200,
        rx_bytes: 14200000000,
        tx_bytes: 410000000,
        experience: 98
      },
      {
        id: 'cli-7',
        hostname: 'LG-OLED-G3-TV',
        ip: '192.168.10.82',
        mac: 'b8:85:84:aa:cc:dd',
        vendor: 'LG Electronics',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Flex-Mini',
        sw_port: 2,
        port_speed: 1000,
        uptime: 124200,
        rx_bytes: 8400000000,
        tx_bytes: 120000000,
        experience: 99
      },
      {
        id: 'cli-8',
        hostname: 'Sonos-Arc-Soundbar',
        ip: '192.168.10.90',
        mac: '48:a6:b8:33:44:55',
        vendor: 'Sonos, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:77:88:99',
        ap_name: 'U6-Pro-LivingRoom',
        essid: 'HomeLab-IoT',
        radio: '2.4GHz',
        channel: 6,
        rssi: -56,
        signal: -56,
        tx_rate: 144,
        rx_rate: 144,
        wifi_standard: 'Wi-Fi 4',
        uptime: 98400,
        rx_bytes: 2400000000,
        tx_bytes: 85000000,
        experience: 97
      },
      {
        id: 'cli-9',
        hostname: 'G5-Pro-Driveway-Cam',
        ip: '192.168.1.180',
        mac: 'e4:38:83:ff:ee:dd',
        vendor: 'Ubiquiti Inc.',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 4,
        port_speed: 1000,
        uptime: 2140000,
        rx_bytes: 420000000,
        tx_bytes: 48900000000,
        experience: 100
      },
      {
        id: 'cli-10',
        hostname: 'G4-Doorbell-Pro',
        ip: '192.168.1.181',
        mac: 'e4:38:83:cc:bb:aa',
        vendor: 'Ubiquiti Inc.',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 5,
        port_speed: 1000,
        uptime: 2140000,
        rx_bytes: 180000000,
        tx_bytes: 28400000000,
        experience: 100
      },
      {
        id: 'cli-11',
        hostname: 'iPad-Pro-13-M4',
        ip: '192.168.1.52',
        mac: '14:7d:da:99:88:77',
        vendor: 'Apple, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:44:55:66',
        ap_name: 'U6-Enterprise-Office',
        essid: 'HomeLab-Net',
        radio: '6GHz',
        channel: 69,
        rssi: -49,
        signal: -49,
        tx_rate: 2401,
        rx_rate: 2401,
        wifi_standard: 'Wi-Fi 6E',
        uptime: 14200,
        rx_bytes: 3820000000,
        tx_bytes: 450000000,
        experience: 99
      },
      {
        id: 'cli-12',
        hostname: 'Philips-Hue-Bridge',
        ip: '192.168.10.15',
        mac: '00:17:88:55:66:77',
        vendor: 'Signify Netherlands B.V.',
        is_wired: true,
        sw_mac: 'e4:38:83:1a:2b:3c',
        sw_name: 'USW-Enterprise-24-PoE',
        sw_port: 12,
        port_speed: 100,
        uptime: 2140000,
        rx_bytes: 84000000,
        tx_bytes: 92000000,
        experience: 100
      },
      {
        id: 'cli-13',
        hostname: 'Ecobee-Smart-Thermostat',
        ip: '192.168.10.22',
        mac: '44:61:32:11:22:33',
        vendor: 'Ecobee Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:77:88:99',
        ap_name: 'U6-Pro-LivingRoom',
        essid: 'HomeLab-IoT',
        radio: '2.4GHz',
        channel: 6,
        rssi: -62,
        signal: -62,
        tx_rate: 72,
        rx_rate: 72,
        wifi_standard: 'Wi-Fi 4',
        uptime: 432000,
        rx_bytes: 45000000,
        tx_bytes: 28000000,
        experience: 96
      },
      {
        id: 'cli-14',
        hostname: 'Patio-Sonos-Move',
        ip: '192.168.1.75',
        mac: '48:a6:b8:99:aa:bb',
        vendor: 'Sonos, Inc.',
        is_wired: false,
        ap_mac: 'e4:38:83:aa:bb:cc',
        ap_name: 'U6-Mesh-Patio',
        essid: 'HomeLab-Net',
        radio: '5GHz',
        channel: 100,
        rssi: -58,
        signal: -58,
        tx_rate: 433,
        rx_rate: 433,
        wifi_standard: 'Wi-Fi 5',
        uptime: 18200,
        rx_bytes: 1200000000,
        tx_bytes: 42000000,
        experience: 98
      }
    ];
  }
}

export const unifiService = new UnifiService();
