import React, { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  ArrowLeft, Bug, ExternalLink, ListChecks, LogIn, LogOut, Monitor, Moon,
  PlusCircle, RefreshCw, ShieldCheck, ShoppingBag, Sun,
} from "lucide-react";
import toast from "react-hot-toast";
import { verifySession } from "@/utils/dealercore-api";

const scrapeFbProfile = () => {
  const img =
    document.querySelector('a[role="link"][aria-label] img, [role="banner"] img[alt], header img[alt]');
  const nameEl = document.querySelector('[role="banner"] [role="link"] span, [aria-label="Menu"] span');
  return {
    avatar: img?.src || null,
    name: nameEl?.textContent?.trim() || null,
  };
};

const QUICK_LINKS = [
  {
    label: "Marketplace",
    desc: "Browse Facebook Marketplace",
    url: "https://www.facebook.com/marketplace",
    Icon: ShoppingBag,
  },
  {
    label: "Create listing",
    desc: "New vehicle listing form",
    url: "https://www.facebook.com/marketplace/create/vehicle",
    Icon: PlusCircle,
  },
  {
    label: "My listings",
    desc: "Your published listings",
    url: "https://www.facebook.com/marketplace/you/selling",
    Icon: ListChecks,
  },
];

const Settings = ({ theme, onThemeChange, auth, onOpenAuth, onLogout, onBack }) => {
  const [fb, setFb] = useState({ state: "loading", name: null, avatar: null, userId: null });
  const [bugMessage, setBugMessage] = useState("");
  const [checkingDc, setCheckingDc] = useState(false);

  // Auth-method agnostic: handshake connections carry no token on `auth`
  // (the token lives under token_<origin>), so detect on identity, not token.
  const dcConnected = !!(auth?.user || auth?.dealer || auth?.branch);
  const authMethod = auth?.token ? "OAuth" : dcConnected ? "Active session" : null;

  const checkFacebook = useCallback(async () => {
    setFb({ state: "loading", name: null, avatar: null, userId: null });
    try {
      const cookie = await browser.cookies.get({
        url: "https://www.facebook.com",
        name: "c_user",
      });

      if (!cookie?.value) {
        setFb({ state: "logged_out", name: null, avatar: null, userId: null });
        return;
      }

      let name = null;
      let avatar = null;
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.url?.includes("facebook.com")) {
          const res = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeFbProfile,
          });
          const data = res?.[0]?.result;
          name = data?.name || null;
          avatar = data?.avatar || null;
        }
      } catch {
        // DOM scraping is best-effort; cookie already confirms login.
      }

      setFb({ state: "logged_in", name, avatar, userId: cookie.value });
    } catch {
      setFb({ state: "unknown", name: null, avatar: null, userId: null });
    }
  }, []);

  useEffect(() => {
    checkFacebook();
  }, [checkFacebook]);

  const checkDealerCore = async () => {
    setCheckingDc(true);
    try {
      const result = await verifySession();
      if (result.connected) {
        const who = result.me?.user?.name || result.me?.user?.email || "user";
        toast.success(`Connected as ${who} (${result.base})`);
      } else {
        toast.error(`Not connected — ${result.reason}`);
      }
    } catch (e) {
      toast.error(e?.message || "Connection check failed.");
    } finally {
      setCheckingDc(false);
    }
  };

  const submitBug = () => {    if (!bugMessage.trim()) {
      toast.error("Describe the problem first");
      return;
    }
    setBugMessage("");
    toast.success("Bug report submitted");
  };

  const appearanceOptions = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Appearance
          </h2>
          <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {appearanceOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => onThemeChange(value)}
                className={`flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg transition-all ${
                  theme === value
                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Connection status
          </h2>
          <div className="space-y-3">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
                    Facebook
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    fb.state === "logged_in"
                      ? "text-green-600"
                      : fb.state === "logged_out"
                        ? "text-gray-500"
                        : "text-amber-600"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      fb.state === "logged_in"
                        ? "bg-green-500"
                        : fb.state === "logged_out"
                          ? "bg-gray-400"
                          : "bg-amber-500"
                    }`}
                  />
                  {fb.state === "loading"
                    ? "Checking..."
                    : fb.state === "logged_in"
                      ? "Logged in"
                      : fb.state === "logged_out"
                        ? "Not logged in"
                        : "Unknown"}
                </span>
              </div>

              {fb.state === "logged_in" ? (
                <div className="flex items-center gap-2.5">
                  {fb.avatar ? (
                    <img
                      src={fb.avatar}
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      className="w-8 h-8 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
                      alt="Facebook"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-sm font-semibold">
                      {(fb.name || "F").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {fb.name || "Facebook user"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      FB ID · {fb.userId}
                    </p>
                  </div>
                </div>
              ) : fb.state === "logged_out" ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Sign in to facebook.com so listings can be published to your account.
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Could not determine the connection status.
                </p>
              )}

              <button
                onClick={checkFacebook}
                className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
                    DealerCore
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    dcConnected ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${dcConnected ? "bg-green-500" : "bg-amber-500"}`}
                  />
                  {dcConnected ? "Connected" : "Not connected"}
                </span>
              </div>

              {dcConnected ? (
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-sm font-semibold">
                    {auth.user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {auth.user?.name || "User"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {auth.user?.email || auth.user?.phone || "Signed in"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  Sign in to sync your listings and publish progress.
                </p>
              )}

              {dcConnected && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5 mb-2">
                  {authMethod && (
                    <p>
                      Method: <span className="font-semibold">{authMethod}</span>
                    </p>
                  )}
                  {auth?.baseUrl && <p className="font-mono break-all">{auth.baseUrl}</p>}
                  {auth?.dealer?.name && <p>Dealer: {auth.dealer.name}</p>}
                  {auth?.branch?.name && <p>Branch: {auth.branch.name}</p>}
                </div>
              )}

              <div className="flex gap-2">
                {!dcConnected && (
                  <button
                    onClick={onOpenAuth}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-white bg-[#00a2e8] hover:bg-[#008bc9] py-2 rounded-lg transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign in to DealerCore
                  </button>
                )}
                {dcConnected && (
                  <button
                    onClick={onLogout}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-bold text-red-500 border border-red-300 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 py-2 rounded-lg transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                )}
                <button
                  onClick={checkDealerCore}
                  disabled={checkingDc}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingDc ? "animate-spin" : ""}`} />
                  Verify
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Quick links
          </h2>
          <div className="border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 rounded-xl overflow-hidden">
            {QUICK_LINKS.map(({ label, desc, url, Icon }) => (
              <button
                key={label}
                onClick={() => browser.tabs.create({ url })}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{desc}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="inline-flex text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Report a bug <span className="text-[10px] rounded-full px-2 text-center bg-red-600 text-white ml-4">stall</span>
          </h2>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <textarea
              value={bugMessage}
              onChange={(e) => setBugMessage(e.target.value)}
              rows={3}
              disabled
              placeholder="What went wrong? Include steps to reproduce if possible."
              className="w-full text-[12px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-sky-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none transition-all"
            />
            <button
              onClick={submitBug}
              disabled
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 py-2 rounded-lg transition-all"
            >
              <Bug className="w-3.5 h-3.5" /> Send report
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;