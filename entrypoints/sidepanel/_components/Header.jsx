import React from "react";
import { Bookmark, LogOut, RefreshCw, User } from "lucide-react";

const Header = ({
  dark,
  auth,
  avatarLabel,
  avatarMenuOpen,
  avatarMenuRef,
  onToggleAvatar,
  onLogout,
  onRefresh,
  onOpenSettings,
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
    <div className="flex items-center gap-2">
      <img
        src={dark ? "/dc-logo-dark.png" : "/dc-logo.png"}
        alt="DealerCore"
        className="h-6 w-auto object-contain"
      />
    </div>
    <div className="flex items-center gap-3 text-gray-400">
      <button className="hover:text-gray-600 dark:hover:text-gray-300" onClick={onRefresh}>
        <RefreshCw className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-4 bg-gray-200 dark:bg-gray-700" />
      <button className="hover:text-gray-600 dark:hover:text-gray-300">
        <Bookmark className="w-4 h-4" />
      </button>
      <button className="hover:text-gray-600 dark:hover:text-gray-300" onClick={onOpenSettings}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <div className="relative" ref={avatarMenuRef}>
        <button
          onClick={onToggleAvatar}
          className="hover:opacity-80 transition-opacity"
          title={auth ? avatarLabel : "Sign in"}
        >
          {auth ? (
            <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center overflow-hidden text-sm font-semibold ring-2 ring-sky-100 dark:ring-sky-900">
              {auth.user?.imageUrl ? (
                <img
                  src={auth.user.imageUrl}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                avatarLabel
              )}
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-700">
              <User className="w-4 h-4" />
            </div>
          )}
        </button>

        {auth && avatarMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-1 z-40">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
              <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate">
                {auth.user?.name || "User"}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {auth.user?.email || auth.user?.phone || ""}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default Header;