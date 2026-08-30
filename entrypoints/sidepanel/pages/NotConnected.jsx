import React from "react";
import { ExternalLink } from "lucide-react";
import Header from "../_components/Header";
import Footer from "../_components/Footer";

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
  onConnectHandle,
}) => {
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
            Please log into Facebook and open the Marketplace creation page in a browser
            tab to use this extension. Keep the tab open while working.
          </p>
          <button
            onClick={() => onConnectHandle(true)}
            className="mt-1 w-full bg-[#00a2e8] hover:bg-[#008bc9] text-white text-sm font-bold py-2.5 px-4 rounded-lg inline-flex items-center justify-center gap-2 transition-all"
          >
            Open Facebook Marketplace
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotConnected;