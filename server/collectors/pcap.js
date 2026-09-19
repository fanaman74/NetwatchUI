// PCAP binary file generator (standard libpcap 2.4 format)
// Compatible with Wireshark, tcpdump, and NetWatch
export function generatePcapBinary(packets = []) {
  // Global header: 24 bytes
  // uint32 magic_number: 0xa1b2c3d4
  // uint16 version_major: 2
  // uint16 version_minor: 4
  // int32  thiszone: 0
  // uint32 sigfigs: 0
  // uint32 snaplen: 65535
  // uint32 network: 1 (LINKTYPE_ETHERNET)
  const globalHeader = Buffer.alloc(24);
  globalHeader.writeUInt32LE(0xa1b2c3d4, 0);
  globalHeader.writeUInt16LE(2, 4);
  globalHeader.writeUInt16LE(4, 6);
  globalHeader.writeInt32LE(0, 8);
  globalHeader.writeUInt32LE(0, 12);
  globalHeader.writeUInt32LE(65535, 16);
  globalHeader.writeUInt32LE(1, 20); // Ethernet

  const packetBuffers = [];

  for (const pkt of packets) {
    const rawPayload = pkt.rawPayload ? Buffer.from(pkt.rawPayload, 'hex') : createSyntheticEthernetFrame(pkt);
    const tsSec = Math.floor((pkt.timestamp || Date.now()) / 1000);
    const tsUsec = ((pkt.timestamp || Date.now()) % 1000) * 1000;

    // Packet header: 16 bytes
    // uint32 ts_sec
    // uint32 ts_usec
    // uint32 incl_len
    // uint32 orig_len
    const pktHeader = Buffer.alloc(16);
    pktHeader.writeUInt32LE(tsSec, 0);
    pktHeader.writeUInt32LE(tsUsec, 4);
    pktHeader.writeUInt32LE(rawPayload.length, 8);
    pktHeader.writeUInt32LE(rawPayload.length, 12);

    packetBuffers.push(pktHeader);
    packetBuffers.push(rawPayload);
  }

  return Buffer.concat([globalHeader, ...packetBuffers]);
}

function createSyntheticEthernetFrame(pkt) {
  // 14 bytes Ethernet + 20 bytes IP + 20 bytes TCP/UDP + sample data
  const frame = Buffer.alloc(64);
  // Dst MAC: 52:54:00:12:34:56
  frame.write('525400123456', 0, 6, 'hex');
  // Src MAC: 00:11:22:33:44:55
  frame.write('001122334455', 6, 6, 'hex');
  // EtherType: 0x0800 (IPv4)
  frame.writeUInt16BE(0x0800, 12);

  // IPv4 Header
  frame[14] = 0x45; // Version 4, IHL 5
  frame[15] = 0x00; // DSCP / ECN
  frame.writeUInt16BE(50, 16); // Total length
  frame.writeUInt16BE(0x1234, 18); // ID
  frame.writeUInt16BE(0x4000, 20); // DF
  frame[22] = 64; // TTL
  frame[23] = pkt.protocol === 'UDP' ? 17 : 6; // Protocol
  frame.writeUInt16BE(0, 24); // Checksum dummy

  // IP addresses
  parseIpv4(pkt.srcIp || '192.168.1.100').copy(frame, 26);
  parseIpv4(pkt.dstIp || '1.1.1.1').copy(frame, 30);

  // Transport Header
  const srcPort = pkt.srcPort || 54321;
  const dstPort = pkt.dstPort || 443;
  frame.writeUInt16BE(srcPort, 34);
  frame.writeUInt16BE(dstPort, 36);

  if (pkt.protocol === 'TCP') {
    frame.writeUInt32BE(1000, 38); // Seq
    frame.writeUInt32BE(1001, 42); // Ack
    frame[46] = 0x50; // Data offset 5
    frame[47] = 0x18; // Flags: PSH, ACK
    frame.writeUInt16BE(64240, 48); // Window
  }

  return frame;
}

function parseIpv4(ipStr) {
  const parts = ipStr.split('.').map(p => parseInt(p, 10) || 0);
  while (parts.length < 4) parts.push(0);
  return Buffer.from(parts.slice(0, 4));
}
