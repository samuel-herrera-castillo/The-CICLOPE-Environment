import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { useCollabStore } from "../../stores/collabStore";
import { useToast } from "../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

const PRESENCE_COLORS = ["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#FF9800","#F44336","#00BCD4","#607D8B"];

export function JoinSession({ open, onClose }: Props) {
  const [otp, setOtp] = useState<string[]>(Array(8).fill(""));
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2196F3");
  const [state, setState] = useState<"idle"|"searching"|"connecting"|"downloading"|"connected"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement|null)[]>([]);
  const joinSession = useCollabStore((s) => s.joinSession);
  const { toast } = useToast();

  useEffect(() => { if (open) setTimeout(() => inputRefs.current[0]?.focus(), 100); }, [open]);

  if (!open) return null;

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").split("");
      setOtp((prev) => { const next = [...prev]; chars.forEach((c,i) => { if(i<8) next[i]=c; }); return next; });
      inputRefs.current[Math.min(chars.length, 7)]?.focus();
      return;
    }
    setOtp((prev) => { const next = [...prev]; next[index] = value.toUpperCase(); return next; });
    if (value && index < 7) inputRefs.current[index+1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputRefs.current[index-1]?.focus();
  };

  const code = "KDCM-" + otp.join("");
  const isValid = otp.every(c => c) && name.trim().length > 0;

  const handleJoin = async () => {
    if (!isValid) return;
    setState("searching");
    setErrorMsg("");
    try {
      // Simulate connection steps
      await new Promise(r => setTimeout(r, 800));
      setState("connecting");
      await new Promise(r => setTimeout(r, 1200));
      setState("downloading");
      await new Promise(r => setTimeout(r, 1500));
      await joinSession(code, name.trim(), color);
      setState("connected");
      toast.success("Connected!", `Joined session ${code}`);
      setTimeout(() => { onClose(); setState("idle"); }, 1000);
    } catch(e:any) {
      setState("error");
      setErrorMsg(e.message || "Could not connect. Verify room code.");
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: "#0F172A", border: "1px solid #2D3F55" }}
        onClick={e => e.stopPropagation()}>

        {/* Connecting states */}
        {state !== "idle" && state !== "error" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 size={40} className="animate-spin" style={{color:"#9b59b6"}}/>
            <div className="text-center">
              {state === "searching" && <p className="text-sm text-white">Searching for session {code}...</p>}
              {state === "connecting" && <>
                <p className="text-sm text-white">Connecting to host...</p>
                <div className="mt-3 h-1.5 w-48 rounded-full bg-gray-700"><div className="h-full rounded-full animate-pulse" style={{width:"40%",backgroundColor:"#9b59b6"}}/></div>
              </>}
              {state === "downloading" && <>
                <p className="text-sm text-white">Downloading project state...</p>
                <p className="text-[10px] text-gray-400 mt-1">Chunk 1 of 3 · Verifying SHA-256</p>
                <div className="mt-3 h-1.5 w-48 rounded-full bg-gray-700"><div className="h-full rounded-full animate-pulse" style={{width:"75%",backgroundColor:"#9b59b6"}}/></div>
              </>}
              {state === "connected" && <div className="text-center"><p className="text-lg text-green-400">✅ Connected!</p><p className="text-xs text-gray-400 mt-1">Synchronized with project</p></div>}
            </div>
            <button onClick={() => { setState("idle"); onClose(); }} className="text-xs text-gray-500 underline">Cancel</button>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <span className="text-4xl">❌</span>
            <p className="text-sm text-red-400">{errorMsg || "Connection failed"}</p>
            <button onClick={() => setState("idle")} className="rounded-md bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/20">Try again</button>
          </div>
        )}

        {/* Idle form */}
        {state === "idle" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">🤝 Join Collaborative Session</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Enter the 8-character room code</p>
              </div>
              <button onClick={onClose} className="rounded p-1 hover:bg-white/10"><X size={16} color="#94A3B8"/></button>
            </div>

            {/* OTP boxes */}
            <div className="mb-5">
              <p className="text-[10px] font-medium text-gray-500 uppercase mb-2 tracking-wider">Room Code</p>
              <div className="flex gap-1.5 items-center">
                {otp.slice(0,4).map((char, i) => (
                  <input key={i} ref={el => {inputRefs.current[i]=el;}}
                    value={char} onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    maxLength={i===0?8:1}
                    className="w-11 h-13 text-center text-xl font-mono font-bold rounded-md border uppercase outline-none"
                    style={{borderColor: char?"#9b59b6":"#2D3F55",backgroundColor:"#1E2A3A",color:char?"#F1D7FF":"#64748B"}}/>
                ))}
                <span className="text-gray-600 font-bold">-</span>
                {otp.slice(4).map((char, i) => (
                  <input key={i+4} ref={el => {inputRefs.current[i+4]=el;}}
                    value={char} onChange={e => handleOtpChange(i+4, e.target.value)}
                    onKeyDown={e => handleKeyDown(i+4, e)}
                    maxLength={1}
                    className="w-11 h-13 text-center text-xl font-mono font-bold rounded-md border uppercase outline-none"
                    style={{borderColor: char?"#9b59b6":"#2D3F55",backgroundColor:"#1E2A3A",color:char?"#F1D7FF":"#64748B"}}/>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-[10px] text-gray-500 mb-1.5">Your Name in this Session</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="How others will see you"
                className="w-full rounded-md border px-3 py-2.5 text-sm outline-none text-white"
                style={{borderColor:"#2D3F55",backgroundColor:"#1E2A3A"}}/>
            </div>

            {/* Color */}
            <div className="mb-5">
              <label className="block text-[10px] text-gray-500 mb-1.5">Presence Color</label>
              <div className="flex gap-2">
                {PRESENCE_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{backgroundColor:c, borderColor:color===c?"white":"transparent"}}/>
                ))}
              </div>
            </div>

            {/* Connect */}
            <button onClick={handleJoin} disabled={!isValid}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-30 min-touch"
              style={{backgroundColor: isValid?"#9b59b6":"#334155"}}>
              ▶ Connect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default JoinSession;
