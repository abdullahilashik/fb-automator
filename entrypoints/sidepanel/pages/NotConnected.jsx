import React from "react";
import { AlertCircle, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Header from "../_components/Header";
import Footer from "../_components/Footer";

/**
 * Landing / not-connected page.
 *
 * status:
 *   'connecting' — a silent attempt or Flow A is in flight; show progress
 *   'idle'       — the silent attempt found nothing; offer the connect button
 *   'error'      — Flow A was tried and failed; show why, offer a retry
 */
const NotConnected = ({
  dark,
  auth,
  avatarLabel,
  avatarMenuOpen,
  avatarMenuRef,
  onToggleAvatar,
  onLogout,
  onRefresh,
  onOpenSettings,
  status = "idle",
  message = "",
  onConnect,
}) => {
  const connecting = status === "connecting";
  const failed = status === "error";

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <Header
        dark={dark}
        auth={auth}
        avatarLabel={avatarLabel}
        avatarMenuOpen={avatarMenuOpen}
        avatarMenuRef={avatarMenuRef}
        onToggleAvatar={onToggleAvatar}
        onLogout={onLogout}
        onRefresh={onRefresh}
        onOpenSettings={onOpenSettings}
      />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center p-5">
        {/* ─────────── connecting ─────────── */}
        {connecting && (
          <div className="w-full max-w-[300px] flex flex-col items-center gap-4 px-1 py-4 text-center">
            <div className="relative">
              <img
                src={dark ? "/dc-logo-dark.png" : "/dc-logo.png"}
                alt="DealerCore"
                className="h-9 w-auto object-contain opacity-80"
              />
              <Loader2 className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-5 h-5 animate-spin text-sky-500" />
            </div>

            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Connecting to DealerCore
              </h4>
              <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
                {message || "Checking your active DealerCore session…"}
              </p>
            </div>

            {/* indeterminate progress */}
            <div className="w-full h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-sky-500 animate-[slide_1.4s_ease-in-out_infinite]" />
            </div>

            <p className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
              This reuses your existing DealerCore sign-in. Make sure you're logged
              in on the DealerCore app — not the Nova admin panel.
            </p>
          </div>
        )}

        {/* ─────────── failed ─────────── */}
        {failed && (
          <div className="w-full max-w-[300px] border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl flex flex-col items-center gap-3 p-6 bg-white dark:bg-gray-800">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-red-50 dark:bg-red-950/40">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 text-center">
              Couldn't connect
            </h4>
            <p className="text-[12px] leading-relaxed text-red-600 dark:text-red-400 text-center whitespace-pre-wrap break-words">
              {message}
            </p>
            <button
              onClick={onConnect}
              className="mt-1 w-full bg-[#00a2e8] hover:bg-[#008bc9] text-white text-sm font-bold py-2.5 px-4 rounded-lg inline-flex items-center justify-center gap-2 transition-all"
            >
              Try again
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              You can also open the avatar menu for detailed connection diagnostics.
            </p>
          </div>
        )}

        {/* ─────────── idle / offer connect ─────────── */}
        {!connecting && !failed && (
          <div className="w-full max-w-[300px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-2xl flex flex-col items-center gap-3 p-6">
            <img
              src={dark ? "/not-connected-dark.png" : "/not-connected.png"}
              alt="Not connected"
              className="h-52 w-auto object-contain"
            />
            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 text-center">
              Not Connected
            </h4>
            <p className="text-[12px] leading-relaxed text-gray-500 dark:text-gray-400 text-center">
              Connect your DealerCore account to start advertising your vehicles.
            </p>
            <button
              onClick={onConnect}
              className="mt-1 w-full bg-[#00a2e8] hover:bg-[#008bc9] text-white text-sm font-bold py-2.5 px-4 rounded-lg inline-flex items-center justify-center gap-2 transition-all"
            >
              Connect with DealerCore
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              Opens the DealerCore sign-in page. You can also open the avatar menu
              to connect using your active browser session.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default NotConnected;
