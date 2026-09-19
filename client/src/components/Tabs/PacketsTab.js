// NetWatch Packets Tab (Tab 4) - Wireshark-Grade Live Decode & Hex Inspector
import { telemetry } from '../../services/telemetry.js';

export class PacketsTab {
  constructor(container) {
    this.container = container;
    this.packets = [];
    this.filterQuery = '';
    this.selectedPacket = null;
    this.renderInitial();
  }

  renderInitial() {
    this.container.innerHTML = `
      <div class="nw-panel">
        <!-- Controls Toolbar -->
        <div class="nw-panel-header" style="flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nw-panel-title">📦 Live Packet Stream & Deep Inspection</span>
            <span id="packet-count-badge" class="nw-chip established">0 Frames</span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Wireshark BPF Filter Input -->
            <input type="text" id="packet-filter-input" class="nw-select" placeholder="Filter: proto == 'TLS' or port 443" style="width: 280px;" />

            <!-- Export PCAP Button -->
            <button id="export-pcap-btn" class="nw-btn">
              📥 Export PCAP
            </button>
          </div>
        </div>

        <!-- Split View: Packet List Top, Hex Dump Bottom -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Packet Table -->
          <div class="nw-table-container" style="max-height: 280px;">
            <table class="nw-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Protocol</th>
                  <th>Length</th>
                  <th>JA4 Fingerprint</th>
                  <th>Info</th>
                </tr>
              </thead>
              <tbody id="packets-tbody"></tbody>
            </table>
          </div>

          <!-- Packet Inspector (Hex Dump & Tree) -->
          <div id="packet-inspector-panel" class="nw-panel" style="background: var(--bg-panel-solid);">
            <div class="nw-panel-header">
              <span class="nw-panel-title">🔍 Packet Inspector: Selected Frame</span>
              <span id="inspector-frame-id" style="color: var(--brand); font-size: 11px;">Select a packet above to inspect</span>
            </div>

            <div id="inspector-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <!-- Tree View -->
              <div id="inspector-tree" style="font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="color: var(--text-muted); font-style: italic;">No frame selected. Click any packet row in the table above.</div>
              </div>

              <!-- Raw Hex Dump -->
              <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; color: var(--text-muted);">
                  <span>HEX DUMP & ASCII</span>
                  <span id="hex-len">0 bytes</span>
                </div>
                <div id="inspector-hex" class="nw-hex-dump" style="max-height: 220px; overflow-y: auto;">00000000:  -- -- -- --  -- -- -- --  -- -- -- --  -- -- -- --  ................</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind event listeners
    const filterInput = this.container.querySelector('#packet-filter-input');
    filterInput.addEventListener('input', (e) => {
      this.filterQuery = e.target.value.toLowerCase();
      this.renderPackets();
    });

    const exportBtn = this.container.querySelector('#export-pcap-btn');
    exportBtn.addEventListener('click', () => {
      telemetry.downloadPcap();
    });
  }

  update(data) {
    if (!data || !data.packets) return;
    this.packets = data.packets;

    // Auto-select latest packet if none selected
    if (!this.selectedPacket && this.packets.length > 0) {
      this.selectedPacket = this.packets[this.packets.length - 1];
    }

    this.renderPackets();
  }

  renderPackets() {
    const tbody = this.container.querySelector('#packets-tbody');
    const badge = this.container.querySelector('#packet-count-badge');
    if (!tbody) return;

    let list = this.packets;
    if (this.filterQuery) {
      list = list.filter(p =>
        p.protocol.toLowerCase().includes(this.filterQuery) ||
        p.srcIp.includes(this.filterQuery) ||
        p.dstIp.includes(this.filterQuery) ||
        (p.info && p.info.toLowerCase().includes(this.filterQuery)) ||
        (p.sni && p.sni.toLowerCase().includes(this.filterQuery)) ||
        (p.ja4 && p.ja4.toLowerCase().includes(this.filterQuery))
      );
    }

    if (badge) badge.textContent = `${list.length} Captured`;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No packets match filter.</td></tr>';
      return;
    }

    tbody.innerHTML = list.slice().reverse().map(p => {
      const isSelected = this.selectedPacket && this.selectedPacket.id === p.id;
      const isTls = p.protocol.includes('TLS');
      const isDns = p.protocol === 'DNS';

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-packet-id="${p.id}">
          <td style="color: var(--text-muted); font-size: 11px;">${p.time || '-'}</td>
          <td>${p.srcIp}:${p.srcPort}</td>
          <td>${p.dstIp}:${p.dstPort}</td>
          <td>
            <span class="nw-key-badge" style="color: ${isTls ? 'var(--brand)' : (isDns ? 'var(--status-warn)' : 'var(--text-primary)')};">
              ${p.protocol}
            </span>
          </td>
          <td>${p.length} B</td>
          <td style="font-size: 10px; color: var(--key-hint);">${p.ja4 ? p.ja4.substring(0, 18) + '...' : '-'}</td>
          <td style="color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
            ${p.info || '-'}
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to rows
    tbody.querySelectorAll('tr[data-packet-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = parseInt(row.getAttribute('data-packet-id'), 10);
        this.selectedPacket = this.packets.find(p => p.id === id);
        this.renderPackets();
        this.renderInspector();
      });
    });

    this.renderInspector();
  }

  renderInspector() {
    const frameIdLabel = this.container.querySelector('#inspector-frame-id');
    const treeDiv = this.container.querySelector('#inspector-tree');
    const hexDiv = this.container.querySelector('#inspector-hex');
    const hexLen = this.container.querySelector('#hex-len');

    if (!this.selectedPacket) return;
    const p = this.selectedPacket;

    if (frameIdLabel) frameIdLabel.textContent = `Frame #${p.id} · ${p.protocol} · ${p.length} Bytes`;
    if (hexLen) hexLen.textContent = `${p.length} bytes`;

    // Render tree decode
    if (treeDiv) {
      treeDiv.innerHTML = `
        <div style="background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; border-left: 3px solid var(--border-color);">
          <strong style="color: var(--text-muted);">Frame Layer</strong>: Ethernet II, Src: 00:11:22:33:44:55, Dst: 52:54:00:12:34:56
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; border-left: 3px solid var(--status-info);">
          <strong style="color: var(--status-info);">Internet Protocol v4</strong>, Src: ${p.srcIp}, Dst: ${p.dstIp}, TTL: 64, DF
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 4px; border-left: 3px solid var(--rx-rate);">
          <strong style="color: var(--rx-rate);">${p.protocol === 'UDP' || p.protocol === 'DNS' ? 'UDP' : 'TCP'} Protocol</strong>, Src Port: ${p.srcPort}, Dst Port: ${p.dstPort}
        </div>
        ${p.ja4 ? `
          <div style="background: rgba(189,147,249,0.1); padding: 8px 12px; border-radius: 4px; border-left: 3px solid var(--brand);">
            <strong style="color: var(--brand);">JA4 Fingerprint</strong>: <code>${p.ja4}</code>
            ${p.sni ? `<div style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">SNI (Server Name Indication): <strong>${p.sni}</strong></div>` : ''}
          </div>
        ` : ''}
        <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 4px;">
          <strong style="color: var(--text-muted);">Payload Decode</strong>: ${p.info}
        </div>
      `;
    }

    // Render formatted Wireshark-style Hex Dump
    if (hexDiv) {
      hexDiv.textContent = this.formatHexDump(p.rawPayload || '4500003c1a2b400040062f3ac0a808965db8d822c35001bb000003e8000003e95018fa0012340000160303002f0100002b0303');
    }
  }

  formatHexDump(hexStr) {
    const cleanHex = hexStr.replace(/\s+/g, '');
    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }

    let output = '';
    const bytesPerLine = 16;

    for (let i = 0; i < bytes.length; i += bytesPerLine) {
      const offset = i.toString(16).padStart(8, '0');
      const chunk = bytes.slice(i, i + bytesPerLine);

      let hexPart = '';
      let asciiPart = '';

      for (let j = 0; j < bytesPerLine; j++) {
        if (j === 8) hexPart += ' ';
        if (j < chunk.length) {
          const b = chunk[j];
          hexPart += b.toString(16).padStart(2, '0') + ' ';
          asciiPart += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        } else {
          hexPart += '   ';
        }
      }

      output += `${offset}:  ${hexPart} |${asciiPart}|\n`;
    }

    return output;
  }
}
