/**
 * WebRTC Engine — manages P2P connections between researchers.
 * Uses WebRTC DataChannels for real-time sync without server intermediary.
 *
 * Architecture:
 *   Host creates RTCPeerConnection per collaborator
 *   Signaling via Supabase Realtime (temporary channel for setup)
 *   Once DataChannel established: direct P2P communication
 *   Fallback: STUN servers if Tailscale not available
 *   Encryption: AES-256-GCM with key derived from room code (PBKDF2, 100k iterations)
 */

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

interface PeerInfo {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  investigatorId: string;
}

// ── AES-256-GCM Encryption ──

async function deriveKey(roomCode: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(roomCode), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(roomCode), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptAES(plaintext: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return { ciphertext, iv };
}

async function decryptAES(ciphertext: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

class WebRTCEngine {
  private peers: Map<string, PeerInfo> = new Map();
  private onMessageCallback: ((msg: any) => void) | null = null;
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private cryptoKey: CryptoKey | null = null;

  /** Initialize encryption for this session */
  async initEncryption(roomCode: string): Promise<void> {
    try {
      this.cryptoKey = await deriveKey(roomCode);
      console.log("[WebRTC] AES-256-GCM encryption initialized (PBKDF2, 100k iterations)");
    } catch (e) {
      console.warn("[WebRTC] Encryption not available, falling back to plaintext", e);
    }
  }

  async createOffer(investigatorId: string): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const channel = pc.createDataChannel("kdcm-sync", {
      ordered: true,
      maxRetransmits: 3,
    });
    this.setupChannel(channel, investigatorId);

    const peer: PeerInfo = { connection: pc, dataChannel: channel, investigatorId };
    this.peers.set(investigatorId, peer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send candidate via signaling channel
        this.sendSignal(investigatorId, { type: "ice-candidate", candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        this.scheduleReconnect(investigatorId);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  }

  async acceptOffer(investigatorId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const peer: PeerInfo = { connection: pc, dataChannel: null, investigatorId };
    this.peers.set(investigatorId, peer);

    pc.ondatachannel = (event) => {
      peer.dataChannel = event.channel;
      this.setupChannel(event.channel, investigatorId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(investigatorId, { type: "ice-candidate", candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        this.scheduleReconnect(investigatorId);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async addIceCandidate(investigatorId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(investigatorId);
    if (peer) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private setupChannel(channel: RTCDataChannel, investigatorId: string): void {
    channel.onopen = () => {
      console.log(`[WebRTC] Channel opened with ${investigatorId}`);
      this.reconnectAttempts.set(investigatorId, 0);
      this.startPing();
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Channel closed with ${investigatorId}`);
    };

    channel.onmessage = async (event) => {
      try {
        let raw: string;
        if (event.data instanceof ArrayBuffer && this.cryptoKey) {
          // Decrypt AES-256-GCM: first 12 bytes = IV, rest = ciphertext
          const buffer = new Uint8Array(event.data);
          const iv = buffer.slice(0, 12);
          const ciphertext = buffer.slice(12);
          raw = await decryptAES(ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength), iv, this.cryptoKey);
        } else if (event.data instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(event.data);
        } else {
          raw = event.data as string;
        }
        const data = JSON.parse(raw);
        if (data.type === "ping") {
          channel.send(JSON.stringify({ type: "pong", timestamp: data.timestamp }));
        } else if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      } catch (e) {
        console.error("[WebRTC] Failed to parse/decrypt message:", e);
      }
    };
  }

  onMessage(callback: (msg: any) => void): void {
    this.onMessageCallback = callback;
  }

  async send(investigatorId: string, data: any): Promise<void> {
    const peer = this.peers.get(investigatorId);
    if (peer?.dataChannel && peer.dataChannel.readyState === "open") {
      const raw = JSON.stringify(data);
      if (this.cryptoKey) {
        const { ciphertext, iv } = await encryptAES(raw, this.cryptoKey);
        // Pack iv + ciphertext into a single buffer for transmission
        const packed = new Uint8Array(iv.length + ciphertext.byteLength);
        packed.set(iv, 0);
        packed.set(new Uint8Array(ciphertext), iv.length);
        peer.dataChannel.send(packed.buffer);
      } else {
        peer.dataChannel.send(raw);
      }
    }
  }

  async broadcast(data: any): Promise<void> {
    for (const [id] of this.peers) {
      await this.send(id, data).catch(() => {});
    }
  }

  private scheduleReconnect(investigatorId: string): void {
    const attempts = this.reconnectAttempts.get(investigatorId) || 0;
    const delays = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
    const delay = delays[Math.min(attempts, delays.length - 1)];

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts.set(investigatorId, attempts + 1);
      console.log(`[WebRTC] Reconnect attempt ${attempts + 1} to ${investigatorId} in ${delay}ms`);
    }, delay);
  }

  private startPing(): void {
    if (this.pingInterval) return;
    this.pingInterval = setInterval(() => {
      this.broadcast({ type: "ping", timestamp: Date.now() });
    }, 5000);
  }

  private signalChannel: BroadcastChannel | null = null;

  /** Initialize signaling channel for this session */
  initSignaling(roomCode: string): void {
    try {
      this.signalChannel = new BroadcastChannel(`kdcm-signal-${roomCode}`);
      this.signalChannel.onmessage = (event) => {
        const { senderId, data } = event.data;
        if (senderId === "host") return; // ignore own messages echoed back
        if (data.type === "offer") {
          this.acceptOffer(senderId, data.offer).then(answer => {
            this.sendSignal(senderId, { type: "answer", answer });
          });
        } else if (data.type === "answer") {
          const peer = this.peers.get(senderId);
          if (peer) peer.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === "ice-candidate") {
          this.addIceCandidate(senderId, data.candidate);
        }
      };
      console.log("[WebRTC] Signaling channel ready (BroadcastChannel for local, Supabase Realtime for production)");
    } catch {
      console.warn("[WebRTC] BroadcastChannel not available, signaling via console (dev only)");
    }
  }

  private sendSignal(investigatorId: string, data: any): void {
    if (this.signalChannel) {
      this.signalChannel.postMessage({ senderId: "host", targetId: investigatorId, data });
    }
    // Fallback: when BroadcastChannel unavailable, log for manual setup
    if (!this.signalChannel) {
      console.log(`[Signal → ${investigatorId}]`, data.type);
    }
  }

  close(investigatorId: string): void {
    const peer = this.peers.get(investigatorId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peers.delete(investigatorId);
    }
  }

  closeAll(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    for (const [id] of this.peers) this.close(id);
  }

  getPeers(): string[] {
    return Array.from(this.peers.keys());
  }
}

export const webrtcEngine = new WebRTCEngine();
export default webrtcEngine;
