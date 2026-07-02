import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Building, Check, X, AlertCircle } from "lucide-react";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

type AuthView = "login" | "register" | "forgot";

/* ── Password strength ── */

function getStrength(pw: string): { label: string; color: string; pct: number } {
  if (pw.length < 6) return { label: "Weak", color: "#F44336", pct: 25 };
  if (pw.length < 8) return { label: "Fair", color: "#F1D7FF", pct: 50 };
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw) && pw.length >= 8) return { label: "Good", color: "#4CAF50", pct: 75 };
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 10) return { label: "Strong", color: "#2E7D32", pct: 100 };
  return { label: "Fair", color: "#F1D7FF", pct: 50 };
}

/* ── Login ── */

function LoginForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill all fields"); return; }
    setLoading(true); setError("");
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    toast.success("Welcome", "Login successful");
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Email</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="you@institution.edu" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-10 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="••••••••" />
          <button onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-60">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
            style={{ accentColor: "var(--peach)" }} /> Remember me
        </label>
        <button onClick={() => onSwitch("forgot")} className="hover:underline" style={{ color: "#000" }}>
          Forgot password?
        </button>
      </div>

      <button onClick={handleLogin} disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-peach-500 py-3 text-sm font-semibold text-white hover:bg-peach-700 disabled:opacity-50 min-touch"
        style={{ minHeight: 48 }}>
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-xs opacity-40">
        Don't have an account? <button onClick={() => onSwitch("register")} style={{ color: "#000" }} className="font-medium hover:underline">Create one</button>
      </p>
    </div>
  );
}

/* ── Register ── */

function RegisterForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [institution, setInstitution] = useState("");
  const [instType, setInstType] = useState("university");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const strength = getStrength(password);
  const passwordsMatch = !confirm || password === confirm;
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async () => {
    if (!name || !email || !password || !institution) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    toast.success("Account created", "Check your email to verify");
    onSwitch("login");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Full name</label>
        <div className="relative">
          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="Your name" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Email</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: emailValid ? "var(--border)" : "#F44336", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="you@institution.edu" />
          {email && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {emailValid ? <Check size={14} color="#4CAF50" /> : <X size={14} color="#F44336" />}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="Min 8 chars + 1 number" />
        </div>
        {password && (
          <div className="mt-1.5">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${strength.pct}%`, backgroundColor: strength.color }} />
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: strength.color }}>{strength.label}</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Confirm password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: confirm ? (passwordsMatch ? "#4CAF50" : "#F44336") : "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="Repeat password" />
          {confirm && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {passwordsMatch ? <Check size={14} color="#4CAF50" /> : <X size={14} color="#F44336" />}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Institution</label>
          <div className="relative">
            <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
            <input value={institution} onChange={(e) => setInstitution(e.target.value)}
              className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              placeholder="University or company" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Type</label>
          <select value={instType} onChange={(e) => setInstType(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <option value="university">University</option>
            <option value="company">Company</option>
            <option value="independent">Independent</option>
          </select>
        </div>
      </div>

      {/* Storage notice */}
      <div className="rounded-lg p-3 text-[10px]" style={{ backgroundColor: "rgba(241, 215, 255, 0.5)", color: "#C4A0D4" }}>
        💾 100MB included. Download the desktop app for unlimited storage.
      </div>

      <button onClick={handleRegister} disabled={loading}
        className="flex w-full items-center justify-center rounded-lg bg-peach-500 py-3 text-sm font-semibold text-white hover:bg-peach-700 disabled:opacity-50 min-touch"
        style={{ minHeight: 48 }}>
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-xs opacity-40">
        Already have an account? <button onClick={() => onSwitch("login")} style={{ color: "#000" }} className="font-medium hover:underline">Sign in</button>
      </p>
    </div>
  );
}

/* ── Forgot Password ── */

function ForgotForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!email) return;
    await new Promise((r) => setTimeout(r, 1000));
    setSent(true);
    toast.success("Email sent", "Check your inbox for reset link");
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">📧</div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Check your email</p>
        <p className="text-xs opacity-40">We sent a password reset link to {email}</p>
        <button onClick={() => onSwitch("login")}
          className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: "#000" }}>
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Reset password</p>
        <p className="text-xs opacity-40">Enter your email to receive a reset link</p>
      </div>
      <div>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            placeholder="you@institution.edu" />
        </div>
      </div>
      <button onClick={handleSend}
        className="flex w-full items-center justify-center rounded-lg bg-peach-500 py-3 text-sm font-semibold text-white hover:bg-peach-700 min-touch">
        Send reset link
      </button>
      <button onClick={() => onSwitch("login")}
        className="flex w-full items-center justify-center text-xs" style={{ color: "#000" }}>
        ← Back to sign in
      </button>
    </div>
  );
}

/* ── Main ── */

export function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");
  const { toast } = useToast();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(135deg, rgba(241, 215, 255, 0.5) 0%, #fff 50%, rgba(241, 215, 255, 0.5) 100%)",
    }}>
      <div className="w-full max-w-[420px] rounded-2xl shadow-xl p-8" style={{ backgroundColor: "var(--bg-panel)" }}>
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🍑</div>
          <h1 className="text-2xl font-bold" style={{ color: "#000" }}>KDCM</h1>
          <p className="text-[10px] opacity-30 mt-1">Qualitative Data Platform</p>
        </div>

        {/* Language selector placeholder */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-1 text-xs">
            {[{ code: "es", flag: "🇪🇸" }, { code: "en", flag: "🇺🇸" }, { code: "fr", flag: "🇫🇷" }, { code: "pt", flag: "🇧🇷" }].map((l) => (
              <button key={l.code} onClick={() => toast.info(`Language: ${l.code.toUpperCase()}`, "Language preference saved")}
                className="rounded px-2 py-1 hover:bg-gray-100 opacity-50 hover:opacity-80">
                {l.flag} {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {view === "login" && <LoginForm onSwitch={setView} />}
        {view === "register" && <RegisterForm onSwitch={setView} />}
        {view === "forgot" && <ForgotForm onSwitch={setView} />}
      </div>
    </div>
  );
}

export default AuthScreen;
