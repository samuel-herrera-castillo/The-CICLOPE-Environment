import { useState, useEffect, useRef } from "react";
import { Copy, X, Check, Wifi, Minimize2, QrCode, Share2, Users } from "lucide-react";
import { useCollabStore, type Collaborator } from "../../stores/collabStore";
import { useToast } from "../../stores/toastStore";
import * as QRCodeLib from "qrcode";
// @ts-ignore — qrcode types not available

interface Props { open: boolean; onClose: () => void; }

export function CollabRoom({ open, onClose }: Props) {
  const session = useCollabStore((s) => s.session);
  const isHost = useCollabStore((s) => s.isHost);
  const endSession = useCollabStore((s) => s.endSession);
  const removeParticipant = useCollabStore((s) => s.removeParticipant);
  const updateParticipant = useCollabStore((s) => s.updateParticipant);
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [duration, setDuration] = useState("");

  const participants: Collaborator[] = session?.participants ?? [];
  const code = session?.code || "";

  // Update duration timer
  useEffect(() => {
    if (!session) return;
    const update = () => {
      const start = new Date(session.startedAt).getTime();
      const diff = Date.now() - start;
      const h = Math.floor(diff/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      setDuration(h>0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [session?.startedAt]);

  // Generate QR code
  useEffect(() => {
    if (showQR && canvasRef.current && code) {
      QRCodeLib.toCanvas(canvasRef.current, `kdcm://sala/${code}`, { width: 200, margin: 1 })
        .catch(() => {});
    }
  }, [showQR, code]);

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleEnd = () => {
    if (!confirm(`Terminate the collaborative session for all ${participants.length} participants?`)) return;
    endSession();
    onClose();
    toast.success("Session ended", "Collaborative session terminated");
  };

  const handleRoleChange = (pId: string, role: Collaborator["role"]) => updateParticipant(pId, { role });
  const handleToggleMute = (pId: string, muted: boolean) => updateParticipant(pId, { muted });
  const handleExpel = (pId: string, name: string) => {
    if (confirm(`Expel ${name} from the session?`)) {
      removeParticipant(pId);
      toast.info("Participant removed", `${name} has been removed from the session`);
    }
  };

  const joinLink = `kdcm://sala/${code}`;

  if (!open) return null;
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-[640px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#0F172A", border: "1px solid #2D3F55", color: "#E2E8F0" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#2D3F55", backgroundColor: "#1E2A3A" }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🤝</span>
            <div>
              <h2 className="text-sm font-semibold text-white">Collaborative Session Active</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full animate-pulse bg-green-500" />
                <span className="text-[10px] text-green-400">{participants.length} connected</span>
                <span className="text-[10px] text-gray-500">· Active for {duration}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" title="Minimize"><Minimize2 size={16} color="#94A3B8"/></button>
        </div>

        {/* Room code */}
        <div className="px-5 py-6 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Room Code</p>
          <div className="inline-block rounded-lg px-8 py-4 mb-3" style={{ backgroundColor: "#1E2A3A" }}>
            <span className="text-2xl font-mono font-bold tracking-wider" style={{ color: "#F1D7FF" }}>{code}</span>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/20 min-touch">
              {copied ? <Check size={13} color="#4CAF50"/> : <Copy size={13}/>}
              {copied ? "Copied!" : "Copy code"}
            </button>
            <button onClick={() => setShowQR(!showQR)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20 min-touch">
              <QrCode size={13}/> QR
            </button>
            <button onClick={() => setShowShare(!showShare)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20 min-touch">
              <Share2 size={13}/> Share
            </button>
          </div>

          {/* QR Code */}
          {showQR && (
            <div className="mt-4 p-3 inline-block rounded-lg" style={{ backgroundColor: "white" }}>
              <canvas ref={canvasRef} />
              <p className="text-[10px] text-gray-400 mt-2">Scan with KDCM mobile</p>
            </div>
          )}

          {/* Share dropdown */}
          {showShare && (
            <div className="mt-2 space-y-1">
              <button onClick={() => { navigator.clipboard.writeText(joinLink); toast.info("Link copied", joinLink); }}
                className="block w-full rounded px-3 py-1.5 text-xs text-left hover:bg-white/10">📋 Copy kdcm:// link</button>
              <a href={`mailto:?subject=KDCM Session&body=Join my KDCM session with code: ${code} or link: ${encodeURIComponent(joinLink)}`}
                className="block w-full rounded px-3 py-1.5 text-xs text-left hover:bg-white/10">📧 Share via email</a>
            </div>
          )}
        </div>

        {/* Connection quality */}
        <div className="border-t px-5 py-2.5 flex items-center gap-2" style={{ borderColor: "#2D3F55", backgroundColor: "#1E2A3A" }}>
          <Wifi size={13} color={
            session.quality === "excellent" ? "#4CAF50" :
            session.quality === "good" ? "#FFC107" :
            session.quality === "fair" ? "#FF9800" : "#F44336"
          } />
          <span className="text-[10px]" style={{ color:
            session.quality === "excellent" ? "#4CAF50" :
            session.quality === "good" ? "#FFC107" :
            session.quality === "fair" ? "#FF9800" : "#F44336"
          }}>{session.quality.charAt(0).toUpperCase()+session.quality.slice(1)} connection</span>
          <span className="text-[9px] text-gray-600 ml-2">Latency: {session.latency}ms</span>
          <div className="flex-1"/>
          <span className="text-[9px] text-gray-600">P2P · AES-256 encrypted</span>
        </div>

        {/* Participants */}
        <div className="border-t px-5 py-3" style={{ borderColor: "#2D3F55", maxHeight: "240px", overflowY: "auto" }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{participants.length} Participants</p>
          {participants.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 opacity-50">
              <Users size={24} color="#666" />
              <p className="text-xs text-gray-600">Waiting for participants...</p>
              <p className="text-[10px] text-gray-600">Share the room code: <code className="text-[#F1D7FF]">{code}</code></p>
            </div>
          ) : (
            <div className="space-y-1">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 py-2 px-2 rounded hover:bg-white/5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: p.color }}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-white truncate">{p.name}</p>
                      {p.role === "admin" && <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/30 text-purple-300">Admin</span>}
                      {p.role === "readonly" && <span className="text-[8px] px-1 py-0.5 rounded bg-gray-500/30 text-gray-400">Read</span>}
                      {p.muted && <span className="text-[8px] opacity-50">🔕</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] text-gray-500">Latency: {p.latency || "?"}ms</p>
                      {p.currentDoc && <p className="text-[9px] text-gray-600">· 📄 {p.currentDoc}</p>}
                    </div>
                  </div>
                  <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.online ? "#4CAF50" : "#9E9E9E" }} />
                  {isHost && p.id !== "me" && (
                    <div className="flex gap-0.5">
                      <button onClick={() => handleRoleChange(p.id, p.role==="collaborator"?"readonly":"collaborator")}
                        className="rounded p-1 hover:bg-white/10 text-[9px] text-gray-400" title="Toggle role">
                        {p.role==="readonly"?"🔒":"🔓"}
                      </button>
                      <button onClick={() => handleToggleMute(p.id, !p.muted)}
                        className="rounded p-1 hover:bg-white/10 text-[9px] text-gray-400" title={p.muted?"Unmute":"Mute"}>
                        {p.muted?"🔕":"🔔"}
                      </button>
                      <button onClick={() => handleExpel(p.id, p.name)}
                        className="rounded p-1 hover:bg-red-500/20 text-[9px] text-gray-400" title="Remove">
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center gap-2" style={{ borderColor: "#2D3F55" }}>
          {isHost ? (
            <button onClick={handleEnd}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium text-white hover:opacity-80 min-touch"
              style={{ backgroundColor: "#C42B1C" }}>
              <X size={12} /> End Session
            </button>
          ) : (
            <button onClick={() => { endSession(); onClose(); }}
              className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium text-white hover:opacity-80 min-touch"
              style={{ backgroundColor: "#C42B1C" }}>
              <X size={12} /> Leave Session
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose}
            className="rounded-lg border px-4 py-2 text-xs text-gray-400 hover:bg-white/5 min-touch"
            style={{ borderColor: "#2D3F55" }}>Minimize</button>
        </div>
      </div>
    </div>
  );
}

export default CollabRoom;
