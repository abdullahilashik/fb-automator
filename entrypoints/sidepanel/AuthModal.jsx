import React, { useEffect, useState } from "react";
import { ArrowLeft, Car, Loader2, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";

const b64url = (obj) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const createMockToken = (user) => {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({
    sub: user.email || user.phone,
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  return `${header}.${payload}.demo-signature`;
};

const validateContact = (value) => {
  const v = value.trim();
  if (!v) return "Enter an email or phone number";
  if (v.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email";
  }
  return /^\+?[\d\s()-]{7,}$/.test(v) ? null : "Enter a valid phone number";
};

const AuthModal = ({ open, onClose, onSuccess, dark }) => {
  const [step, setStep] = useState("contact");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("contact");
    setContact("");
    setOtp("");
    setDemoCode("");
    setSending(false);
    setVerifying(false);
    setError("");
  }, [open]);

  if (!open) return null;

  const handleSendCode = async () => {
    const err = validateContact(contact);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setDemoCode(String(Math.floor(100000 + Math.random() * 900000)));
    setStep("otp");
  };

  const handleResend = async () => {
    setError("");
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setDemoCode(String(Math.floor(100000 + Math.random() * 900000)));
    setOtp("");
    toast.success("New code sent");
  };

  const handleVerify = async () => {
    if (otp.trim().length < 4) {
      setError("Enter the full code");
      return;
    }
    setError("");
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 1500));
    setVerifying(false);

    if (otp.trim() !== demoCode) {
      setError("Invalid code. Try again.");
      return;
    }

    const isEmail = contact.includes("@");
    const user = {
      name: isEmail ? contact.split("@")[0] : "User",
      email: isEmail ? contact : null,
      phone: isEmail ? null : contact,
      imageUrl: null,
    };
    const token = createMockToken(user);
    onSuccess({ token, user });
    toast.success("Signed in successfully");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-[320px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-sky-600/10 dark:bg-sky-500/15 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={dark ? "/dc-logo-dark.png" : "/dc-logo.png"}
              alt="DealerCore"
              className="h-6 w-auto object-contain"
            />
          </div>
          <button onClick={onClose} className="text-black/70 dark:text-gray-300 hover:text-black dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === "contact" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Sign in</h2>
              </div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">
                Enter your email or phone number and we'll send you a one-time code.
              </p>

              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Email or phone number
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                placeholder="you@example.com or +1 555 000 0000"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900 transition-all"
              />

              {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}

              <button
                onClick={handleSendCode}
                disabled={sending}
                className="mt-4 w-full text-sm bg-[#00a2e8] hover:bg-[#008bc9] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending code..." : "Send code"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep("contact");
                  setError("");
                  setOtp("");
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
              >
                <ArrowLeft className="w-3 h-3" /> Change contact
              </button>

              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Enter the code</h2>
              </div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-3">
                We sent a 6-digit code to
                <span className="font-semibold text-gray-700 dark:text-gray-200"> {contact}</span>.
              </p>

              <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="000000"
                maxLength={6}
                className="w-full text-sm tracking-[0.5em] font-mono text-center border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900 transition-all"
              />

              <div className="mt-3 flex items-start gap-2 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                <RefreshCw className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Demo mode — your code is{" "}
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{demoCode}</span>
                </p>
              </div>

              {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="mt-4 w-full text-sm bg-[#00a2e8] hover:bg-[#008bc9] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {verifying ? "Verifying..." : "Verify & sign in"}
              </button>

              <button
                onClick={handleResend}
                disabled={sending}
                className="mt-2 w-full text-[11px] font-semibold text-sky-600 hover:text-sky-700 py-1"
              >
                {sending ? "Sending..." : "Resend code"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;