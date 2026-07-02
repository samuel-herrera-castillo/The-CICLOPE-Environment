import { useState, useEffect } from "react";
import { X, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { protectProject, isProjectProtected } from "../../lib/tauriBridge";
import bcrypt from "bcryptjs";

interface Props { open: boolean; onClose: () => void; }

export function ProjectProtection({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [isProtected, setIsProtected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [currentPass, setCurrentPass] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [saving, setSaving] = useState(false);

  // 3-attempt lockout
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  useEffect(() => {
    if (open && project?.id) {
      isProjectProtected(project.id).then(setIsProtected).catch(()=>setIsProtected(false)).finally(()=>setLoading(false));
      setAttempts(0); setLockoutUntil(0); setNewPass(""); setConfirmPass(""); setCurrentPass("");
    }
  }, [open, project?.id]);

  // Lockout timer
  useEffect(() => {
    if (lockoutUntil===0) return;
    const iv = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil-Date.now())/1000);
      if (remaining <= 0) { setLockoutUntil(0); setAttempts(0); setLockoutCountdown(0); }
      else setLockoutCountdown(remaining);
    }, 200);
    return () => clearInterval(iv);
  }, [lockoutUntil]);

  const passwordStrength = (pw: string): {label:string;color:string;score:number} => {
    if (!pw) return {label:"",color:"",score:0};
    let score=0; if(pw.length>=8)score++; if(pw.length>=12)score++; if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw))score++; if(/\d/.test(pw))score++; if(/[^a-zA-Z0-9]/.test(pw))score++;
    if(score<=2) return {label:"Weak",color:"#E53935",score};
    if(score<=3) return {label:"Medium",color:"#F4A261",score};
    return {label:"Strong",color:"#43A047",score};
  };
  const strength = passwordStrength(newPass);

  const recordFailedAttempt = () => {
    const newAttempts = attempts+1;
    setAttempts(newAttempts);
    if (newAttempts >= 3) {
      const lockMs = 30000; // 30 seconds
      setLockoutUntil(Date.now()+lockMs);
      toast.error("Too many attempts", `Locked for 30 seconds`);
    }
  };

  const handleActivate = async () => {
    if (!project?.id) return;
    if (newPass !== confirmPass) { toast.error("Error", "Passwords do not match"); return; }
    if (newPass.length < 6) { toast.error("Error", "Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const hash = await bcrypt.hash(newPass, 10);
      await protectProject(project.id, hash);
      setIsProtected(true);
      toast.success("🔒 Protected", "Project password set successfully");
      setNewPass(""); setConfirmPass("");
    } catch(e:any) { toast.error("Error", e.message); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!project?.id) return;
    if (lockoutUntil>Date.now()) { toast.error("Locked", `Wait ${lockoutCountdown}s`); return; }
    if (!currentPass) { toast.error("Error", "Enter current password"); return; }
    setSaving(true);
    try {
      // Clear protection via backend
      await protectProject(project.id, "");
      setIsProtected(false);
      toast.success("🔓 Protection removed");
      setCurrentPass("");
    } catch(e:any) { recordFailedAttempt(); toast.error("Error", "Could not remove protection"); }
    finally { setSaving(false); }
  };

  const handleChange = async () => {
    if (!project?.id) return;
    if (lockoutUntil>Date.now()) { toast.error("Locked", `Wait ${lockoutCountdown}s`); return; }
    if (!currentPass) { toast.error("Error", "Enter current password"); return; }
    if (newPass !== confirmPass) { toast.error("Error", "Passwords do not match"); return; }
    if (newPass.length < 6) { toast.error("Error", "New password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const hash = await bcrypt.hash(newPass, 10);
      await protectProject(project.id, hash);
      toast.success("🔑 Password changed");
      setNewPass(""); setConfirmPass(""); setCurrentPass("");
    } catch(e:any) { recordFailedAttempt(); toast.error("Error", e.message); }
    finally { setSaving(false); }
  };

  const locked = lockoutUntil > Date.now();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="w-full max-w-[400px] rounded-xl shadow-2xl" style={{backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-2">
            {isProtected ? <Lock size={18} style={{color:"#43A047"}}/> : <Unlock size={18} style={{color:"#E53935"}}/>}
            <h2 className="text-base font-bold">{isProtected?"🔒 Project Protected":"Project Protection"}</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16}/></button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? <p className="text-xs opacity-40">Checking protection status...</p> :
          locked ? (
            <div className="text-center py-6 space-y-3">
              <span className="text-4xl">⏳</span>
              <p className="text-sm font-bold text-red-600">Too many attempts</p>
              <p className="text-2xl font-mono font-bold">{lockoutCountdown}s</p>
              <p className="text-xs opacity-40">Please wait before trying again</p>
            </div>
          ) : isProtected ? (
            <>
              <div className="flex items-center gap-2 rounded-md p-3 text-sm" style={{backgroundColor:"#E8F5E9",color:"#2E7D32"}}><Lock size={16}/> Project is password-protected</div>

              <div className="relative">
                <input type={showCurrent?"text":"password"} value={currentPass} onChange={e=>setCurrentPass(e.target.value)}
                  placeholder="Current password" className="w-full rounded border px-3 py-2.5 pr-10 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                <button onClick={()=>setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showCurrent?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>

              <div className="relative">
                <input type={showNew?"text":"password"} value={newPass} onChange={e=>setNewPass(e.target.value)}
                  placeholder="New password (optional — leave empty to only deactivate)"
                  className="w-full rounded border px-3 py-2.5 pr-10 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                <button onClick={()=>setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showNew?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>

              {newPass && <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 h-1.5 rounded-full" style={{backgroundColor:"var(--bg-secondary)"}}>
                  <div className="h-full rounded-full transition-all" style={{width:`${strength.score*20}%`,backgroundColor:strength.color}}/>
                </div>
                <span style={{color:strength.color}}>{strength.label}</span>
              </div>}

              <div className="relative">
                <input type={showConfirm?"text":"password"} value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded border px-3 py-2.5 pr-10 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                <button onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showConfirm?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>

              {attempts > 0 && <p className="text-xs text-red-500">Failed attempts: {attempts}/3</p>}

              <div className="flex gap-2">
                <button onClick={handleDeactivate} disabled={saving}
                  className="flex-1 rounded-md border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {saving?"Removing...":"🔓 Remove Protection"}
                </button>
                <button onClick={handleChange} disabled={saving||!newPass}
                  className="flex-1 rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>
                  {saving?"Saving...":"🔑 Change Password"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-md p-3 text-sm" style={{backgroundColor:"#FFF3E0",color:"#E65100"}}>
                <Unlock size={16}/> Project has no password protection
              </div>

              <div className="relative">
                <input type={showNew?"text":"password"} value={newPass} onChange={e=>setNewPass(e.target.value)}
                  placeholder="New password" className="w-full rounded border px-3 py-2.5 pr-10 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                <button onClick={()=>setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showNew?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>

              {newPass && <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 h-1.5 rounded-full" style={{backgroundColor:"var(--bg-secondary)"}}>
                  <div className="h-full rounded-full transition-all" style={{width:`${strength.score*20}%`,backgroundColor:strength.color}}/>
                </div>
                <span style={{color:strength.color}}>{strength.label}</span>
              </div>}

              <div className="relative">
                <input type={showConfirm?"text":"password"} value={confirmPass} onChange={e=>setConfirmPass(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full rounded border px-3 py-2.5 pr-10 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                <button onClick={()=>setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showConfirm?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>

              <button onClick={handleActivate} disabled={saving||!newPass||newPass!==confirmPass}
                className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>
                {saving?"Activating...":"🔒 Activate Protection"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectProtection;
