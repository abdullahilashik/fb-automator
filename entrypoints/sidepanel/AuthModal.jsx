import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { browser } from "wxt/browser";
import { DEALERCORE_CONFIG } from "@/utils/dealercore-config";
import { getAccessToken, getDealerCoreBaseUrl, fetchMe, launchOAuthLogin, openAuthInTab, getRedirectUri, diagnoseDealercore } from "@/utils/dealercore-api";

const AuthModal = ({ open, onClose, onSuccess, dark }) => {
  const [base, setBase] = useState(DEALERCORE_CONFIG.DEFAULT_DOMAIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    setDiag(null);
    getDealerCoreBaseUrl().then(setBase).catch(() => {});
  }, [open ]);

  if (!open) return null;

  const handleLogin = async () => {
    setError("");
    setBusy(true);
    try {
      const token = await launchOAuthLogin(base);
      const me = await fetchMe(base, token);
      const authData = {
        token,
        baseUrl: base,
        user: me.user ?? null,
        dealer: me.dealer ?? null,
        branch: me.branch ?? null,
        branches: me.branches ?? [],
      };
      // Persist session snapshot for UI; token itself lives under token_<base>.
      await browser.storage.local.set({ dealercore_session: { ...authData, savedAt: Date.now() } });
      onSuccess(authData);
      toast.success("Signed in with DealerCore");
    } catch (e) {
      setError(e.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenInTab = async () => {
    setError("");
    try {
      const url = await openAuthInTab(base);
      toast.success("Auth page opened in a tab — check the server error there");
      console.log("[dealercore] auth URL:", url);
    } catch (e) {
      setError(e.message || "Could not open auth page.");
    }
  };

  const handleDiagnose = async () => {
    setError("");
    setBusy(true);
    try {
      setDiag(await diagnoseDealercore(base));
    } catch (e) {
      setError(e.message || "Diagnostics failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyRedirect = async () => {    try {
      await navigator.clipboard.writeText(getRedirectUri());
      toast.success("Redirect URI copied — paste it into the Nova OAuth client");
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-[320px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-sky-600/10 dark:bg-sky-500/15 px-5 py-4 flex items-center justify-between">
          <img
            src={dark ? "/dc-logo-dark.png" : "/dc-logo.png"}
            alt="DealerCore"
            className="h-6 w-auto object-contain"
          />
          <button onClick={onClose} className="text-black/70 dark:text-gray-300 hover:text-black dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Sign in with DealerCore</h2>
          </div>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-1">
            First-party OAuth via redirect URI. No client secret is bundled (public client + PKCE).
          </p>
          <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mb-4 break-all">{base}</p>

          {DEALERCORE_CONFIG.CLIENT_ID === "YOUR_FIRST_PARTY_CLIENT_ID_TEST" && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Set <span className="font-mono">CLIENT_ID</span> in <span className="font-mono">utils/dealercore-config.js</span> (Nova → Integrations → OAuth Clients).
            </p>
          )}

          {error && <p className="text-[11px] text-red-500 mb-2 whitespace-pre-wrap">{error}</p>}

          {diag && (
            <div className="mb-3 text-[10px] font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 space-y-1">
              {diag.results.map((r) => (
                <div key={r.label} className="flex gap-1.5">
                  <span className={r.status >= 200 && r.status < 400 ? "text-green-600" : "text-red-500"}>
                    [{r.status}]
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">{r.label}</span>
                </div>
              ))}
              <div className="text-gray-500 dark:text-gray-400 break-all pt-1 border-t border-gray-200 dark:border-gray-700">
                redirect: {diag.redirectUri}
              </div>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={busy}
            className="w-full text-sm bg-[#00a2e8] hover:bg-[#008bc9] text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            {busy ? "Waiting for DealerCore…" : "Login with DealerCore"}
          </button>
          <button
            onClick={handleOpenInTab}
            disabled={busy}
            className="mt-2 w-full text-[11px] font-semibold text-sky-600 hover:text-sky-700 py-1 disabled:opacity-60"
          >
            Page won't load? Open auth page in a tab to see the server error
          </button>
          <button
            onClick={handleDiagnose}
            disabled={busy}
            className="mt-1 w-full text-[11px] font-semibold text-gray-500 hover:text-gray-700 py-1 disabled:opacity-60"
          >
            Diagnose connection
          </button>
          <button
            onClick={copyRedirect}
            className="mt-1 w-full text-[10px] font-mono text-gray-400 hover:text-gray-600 py-1 break-all"
            title="Copy redirect URI"
          >
            {getRedirectUri()}
          </button>
          <p className="mt-2 text-[10px] text-gray-400 text-center">
            Register the URI above in Nova → Integrations → OAuth Clients. Silent handshake runs automatically when you browse DealerCore — use this button only if it reports unauthenticated.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
