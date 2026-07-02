import { useState, type FormEvent } from "react";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { KdcmLogo } from "../common/KdcmLogo";

interface StepProps {
  onNext: () => void;
  onSkip?: () => void;
  researcherName: string;
  setResearcherName: (n: string) => void;
}

/** Step 1 — Welcome */
function StepWelcome({ onNext, researcherName, setResearcherName }: StepProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (researcherName.trim()) onNext();
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
      <KdcmLogo size={96} variant="color" />
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Welcome to KDCM
        </h1>
        <p className="mt-2 text-sm opacity-60" style={{ color: "var(--text-secondary)" }}>
          Qualitative data analysis, reimagined.
        </p>
      </div>
      <div className="w-full max-w-xs">
        <label className="mb-1.5 block text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          What should we call you?
        </label>
        <input
          autoFocus
          type="text"
          value={researcherName}
          onChange={(e) => setResearcherName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-md border px-4 py-2.5 text-sm outline-none transition"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
          required
        />
      </div>
      <button
        type="submit"
        disabled={!researcherName.trim()}
        className="rounded-md bg-peach-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-peach-700 disabled:opacity-40 min-touch"
      >
        Continue
      </button>
    </form>
  );
}

/** Step 2 — Import first document */
function StepImport({ onNext, onSkip }: StepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-peach-100">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 10v20M16 22l8-8 8 8" stroke="#F1D7FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 32v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="#F1D7FF" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Import your first document
        </h2>
        <p className="mt-1.5 text-sm opacity-60" style={{ color: "var(--text-secondary)" }}>
          Supports PDF, DOCX, TXT, and RTF files. You can always add more later.
        </p>
      </div>
      <button
        onClick={onNext}
        className="rounded-md bg-peach-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-peach-700 min-touch"
      >
        Import document
      </button>
      <button
        onClick={onSkip}
        className="text-sm font-medium underline opacity-50 hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        I'll do it later
      </button>
    </div>
  );
}

/** Step 3 — Create first category */
function StepCategory({ onNext, onSkip }: StepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-peach-100">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="8" y="8" width="14" height="12" rx="2" stroke="#F1D7FF" strokeWidth="2.5"/>
          <rect x="26" y="8" width="14" height="12" rx="2" stroke="#F1D7FF" strokeWidth="2.5"/>
          <rect x="8" y="24" width="14" height="16" rx="2" stroke="#F1D7FF" strokeWidth="2.5"/>
          <path d="M30 28h6M33 25v6" stroke="#F1D7FF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Create your first category
        </h2>
        <p className="mt-1.5 text-sm opacity-60" style={{ color: "var(--text-secondary)" }}>
          Categories are used to organize and code segments of your documents.
        </p>
      </div>
      <button
        onClick={onNext}
        className="rounded-md bg-peach-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-peach-700 min-touch"
      >
        Create category
      </button>
      <button
        onClick={onSkip}
        className="text-sm font-medium underline opacity-50 hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        I'll do it later
      </button>
    </div>
  );
}

/** Step 4 — Done */
function StepDone({ onNext, researcherName }: StepProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="20" stroke="#4CAF50" strokeWidth="3"/>
          <path d="M16 24l6 6 10-12" stroke="#4CAF50" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {researcherName ? `Ready, ${researcherName}!` : "All set!"}
        </h2>
        <p className="mt-1.5 text-sm opacity-60" style={{ color: "var(--text-secondary)" }}>
          Your workspace is ready. You can always import more documents and create categories later.
        </p>
      </div>
      <button
        onClick={onNext}
        className="rounded-md bg-peach-500 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-peach-700 min-touch"
      >
        Get started
      </button>
    </div>
  );
}

/* ── Step indicator dots ── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-10" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full transition-all duration-300"
          style={{
            backgroundColor: i < current ? "var(--peach)" : "#E0E0E0",
            transform: i === current ? "scale(1.4)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Main modal ── */

export function OnboardingModal() {
  const onboardingDone = useOnboardingStore((s) => s.onboardingDone);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [researcherName, setResearcherName] = useState("");

  if (onboardingDone) return null;

  const next = () => {
    if (step === 3) {
      completeOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => {
    // Skips current step, goes to next (or done if last)
    if (step === 3) {
      completeOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  };

  const shared = { onNext: next, onSkip: skip, researcherName, setResearcherName };

  const steps = [
    <StepWelcome key="s0" {...shared} />,
    <StepImport   key="s1" {...shared} />,
    <StepCategory key="s2" {...shared} />,
    <StepDone     key="s3" {...shared} />,
  ];

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col"
      style={{ backgroundColor: "var(--bg-primary)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      {/* Dots */}
      <StepDots current={step} total={steps.length} />

      {/* Step content */}
      <div className="flex flex-1 flex-col">
        {steps[step]}
      </div>
    </div>
  );
}

export default OnboardingModal;
