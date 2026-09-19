# ⚡ NetWatch Web — Real-Time Network & Egress Telemetry Platform

A fullstack web application conversion of the [NetWatch Rust network monitor](https://github.com/matthart1983/netwatch). Features sub-second telemetry, live host OS socket attribution, an egress policy linter, deep packet inspection, TLS 1.3 JA4 fingerprinting, an automated diagnostic baseline engine, and an interactive Pre-Flight Doctor screen.

![NetWatch Banner](https://img.shields.io/badge/NetWatch-v0.30.0-58a6ff?style=flat-square)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-3fb950?style=flat-square)
![Deployment](https://img.shields.io/badge/deploy-Railway%20%7C%20Docker-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## 🌟 Key Features

### 1. Dual Operational Engines
- **🌐 Live Host Mode (Default)**: Connects directly to the host operating system's networking stack, discovering active network interfaces, parsing established/listening sockets via OS APIs (`netstat`, `ss`, PowerShell), tracking TCP RTT/retransmissions, and attributing sockets to host processes (`node`, `chrome`, `curl`, etc.).
- **🧪 NetWatch 0.30 Scenario Engine**: Built-in 4-stage scripted incident reproducing the upstream NetWatch 0.30 incident arc (*baseline &rarr; degraded DNS / high RTT &rarr; critical packet loss & egress drift &rarr; recovery*).

### 2. Pre-Flight System Doctor
- Automatically runs pre-flight capability checks on startup.
- Verifies browser capabilities (WebSocket, Canvas 2D acceleration).
- Probes server capabilities: Node.js runtime, Express/WS gateway, network adapters, OS socket attribution, DNS/ICMP latency probes, packet engine, diagnostic baseline engine, and Npcap/libpcap driver status.
- Provides direct download links and copyable terminal commands (`winget`, `scoop`, `choco`) with 1-click bypass to enter the dashboard.

### 3. Comprehensive 10-Tab Telemetry Suite
1. **Overview**: Real-time bandwidth gauge, interface stats, latency trends, active socket counters.
2. **Connections**: Interactive socket table with filtering, search, country flags, ASN details, TCP socket metrics (RTT, cwnd, rttvar, rwnd), and process attribution.
3. **Packets & PCAP**: Live deep packet inspection stream, TLS 1.3 SNI decode, JA4 hash calculation, and **1-click binary `.pcap` export** compatible with Wireshark.
4. **Diagnostics**: Automated baseline deviation engine with z-score anomaly detection and 1-click remediation actions.
5. **Egress Linter**: Destination drift detector with 1-click policy promotion for trusted processes and domains.
6. **Threats & Security**: Port scan detector, C2 beacon analysis, JA4 fingerprint tracker, and an immutable forensic flight recorder.
7. **DNS Monitor**: Query latency tracker and resolver health metrics.
8. **Topology**: Interactive SVG network flow diagram connecting host processes, local adapters, routers, and external cloud ASNs.
9. **Settings**: Polling interval adjustments, strict egress toggles, and notification settings.
10. **Help & Manual**: Keyboard shortcuts cheatsheet (`1`-`9`, `F`, `D`, `L`, `Space`, `M`) and architecture guide.

### 4. 3 View Modes & 8 Curated Themes
- **Full View**: Comprehensive multi-card dashboard with charts, stats, and real-time graphs.
- **Dense View (`D`)**: Compact terminal-style layout maximizing data density.
- **Lite View (`L`)**: Clean minimalist executive overview.
- **8 Themes**: Cyberpunk Midnight (Default), Tokyo Night, Gruvbox Dark, Solarized Dark, Nord Aurora, Monokai Pro, Synthwave 84, and High-Contrast Matrix.

### 5. Native macOS & Apple iOS Support
- **🍎 macOS Desktop & WebKit**:
  - Full Command (`⌘`) keybindings: `⌘1`–`⌘0` (tabs), `⌘K` / `⌘/` (search), `⌘D` (live/demo), `Space` / `⌘P` (pause), `⌘E` (pcap export).
  - Trackpad swipe containment (`overscroll-behavior-x: contain`) to prevent accidental Safari history navigation.
  - Native hardware port detection via `networksetup -listallhardwareports` (Wi-Fi, Ethernet, Thunderbolt).
  - Native macOS socket telemetry via `lsof` and `netstat -an -p tcp`.
  - Built-in `/usr/lib/libpcap.dylib` kernel BPF driver support with Homebrew recommendations.
- **📱 Apple iOS & iPadOS (Mobile Safari)**:
  - **PWA Ready**: Add to Home Screen via Safari for standalone, fullscreen experience with custom high-res Apple Touch icons (`manifest.json`).
  - **Notch & Dynamic Island Awareness**: Integrated CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
  - **Dynamic Viewport Height (`100dvh`)**: Eliminates iOS Safari address bar jumps and toolbar clipping.
  - **Touch Gestures**: Horizontal swipe navigation across all 10 tabs with auto-centering tab bar.
  - **Retina HiDPI Canvas**: Crystal-clear mirrored graph rendering at native device pixel ratio (`2x`/`3x`).
  - **Apple HIG Touch Targets**: Touch target heights &ge; 40-44px for effortless thumb tapping.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- Git

### 1. Install & Run Dev Server
```bash
# Clone the repository
git clone https://github.com/<your-username>/netwatch-web.git
cd netwatch-web

# Start both backend (port 3030) and frontend (port 5173 with HMR)
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚂 Railway Cloud Deployment

NetWatch is pre-configured for **Railway** as a unified single-port service (serving Express REST API, real-time WebSocket stream, and the compiled Vite single-page application on `$PORT`).

### Option A: Deploy via GitHub (Recommended)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: initial NetWatch web application"
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git branch -M main
   git push -u origin main
   ```

2. Open [Railway Dashboard](https://railway.app/).
3. Click **"+ New Project"** &rarr; **"Deploy from GitHub repo"**.
4. Select your NetWatch repository.
5. Railway automatically detects `railway.json` and `nixpacks.toml`:
   - Runs `npm run build` to compile the Vite frontend into `client/dist`.
   - Starts `npm start` (`node server/index.js`).
   - Automatically provisions public HTTPS & WSS domains.
6. Under your Railway service **Settings** &rarr; **Networking**, click **"Generate Domain"** (e.g. `https://netwatch-production.up.railway.app`).
7. Open the domain to view your live NetWatch deployment!

### Option B: Deploy via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway init

# Deploy
railway up
```

---

## 🐳 Docker Deployment

You can build and run NetWatch as a standalone container:

```bash
# Build the Docker image
docker build -t netwatch-web .

# Run container on port 3030
docker run -d -p 3030:3030 --name netwatch netwatch-web
```
Access the application at [http://localhost:3030](http://localhost:3030).

---

## 📁 Repository Structure

```
netwatch-web/
├── client/                     # Vite Single Page Application (Frontend)
│   ├── src/
│   │   ├── components/         # DoctorScreen, DenseView, LiteView, Tabs
│   │   ├── services/           # Telemetry WebSocket client & REST APIs
│   │   ├── styles/             # Modular CSS, themes, and animations
│   │   └── main.js             # Client entrypoint & router
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js Telemetry Server (Backend)
│   ├── collectors/
│   │   ├── system.js           # Live OS socket & interface collector
│   │   ├── scenario.js         # NetWatch 0.30 scripted demo scenario
│   │   ├── diagnose.js         # Anomaly detector & cause ranking
│   │   ├── egress.js           # Destination drift & policy promoter
│   │   ├── threats.js          # Security alerts & forensic recorder
│   │   └── pcap.js             # Binary libpcap 2.4 generator
│   ├── index.js                # Express REST API, WebSockets & static server
│   └── package.json
├── Dockerfile                  # Multi-stage container build
├── railway.json                # Railway deployment schema
├── nixpacks.toml               # Nixpacks build pipeline definition
├── package.json                # Root orchestration & scripts
├── start.js                    # Dual-service local development runner
└── README.md
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` – `9` | Quick switch between tabs (Overview, Connections, Packets, etc.) |
| `F` | Switch to **Full View** mode |
| `D` | Switch to **Dense View** mode |
| `L` | Switch to **Lite View** mode |
| `Space` | Pause / resume real-time telemetry stream |
| `M` | Toggle between **Live Host** and **NetWatch 0.30 Scenario** |
| `Esc` | Close modals and overlays |

---

## 📄 License

MIT License &copy; 2026 NetWatch Contributors.
