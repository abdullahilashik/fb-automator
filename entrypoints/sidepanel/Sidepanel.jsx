import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { browser } from "wxt/browser";
import toast from "react-hot-toast";
import AuthModal from "./AuthModal";
import Settings from "./pages/Settings";
import Listing, { buildVehicles } from "./pages/Listing";
import NotConnected from "./pages/NotConnected";
import { fromDealerCoreVehicle } from "@/utils/default-items";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/utils/db";
import {
  getAccessToken,
  fetchMe,
  clearDealerCoreSession,
  tryAutoConnect,
  getDealerCoreBaseUrl,
  launchOAuthLogin,
  fetchAllVehicles,
} from "@/utils/dealercore-api";

const TARGET_URL = "https://www.facebook.com/marketplace/create/vehicle";

// A failing auto-connect can settle in single-digit milliseconds, so the
// connecting state is held for at least this long to stay perceivable.
const MIN_CONNECTING_MS = 450;

const Sidepanel = () => {
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [view, setView] = useState("main");
  const [theme, setTheme] = useState("system");
  const [dark, setDark] = useState(false);
  const avatarMenuRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const selectionInitRef = useRef(false);

  // Dexie (IndexedDB) is the source of truth for the vehicle list, so the
  // panel stays live against bridge/feed/automation writes without poll timers.
  const rawVehicles = useLiveQuery(() => db.vehicles.toArray(), []) ?? [];

  const items = useMemo(() => {
    const out = [];
    for (const v of rawVehicles) {
      const it = fromDealerCoreVehicle(v);
      if (it) out.push({ ...it, id: v.id });
    }
    return out;
  }, [rawVehicles]);

  const vehicles = useMemo(
    () => buildVehicles(items, results, currentIndex, running),
    [items, results, currentIndex, running],
  );

  // Auto-select all once when a list is first shown and the user hasn't
  // chosen a selection yet (mirrors the pre-Dexie initial-load default).
  useEffect(() => {
    if (selectionInitRef.current || !items.length) return;
    setSelectedIds((prev) => {
      if (prev.size) {
        selectionInitRef.current = true;
        return prev;
      }
      return new Set(items.map((it) => it.id));
    });
    selectionInitRef.current = true;
  }, [items]);

  // NOTE: there used to be a mount-time `handleConnect()` call here that popped
  // the OAuth flow on every open. That contradicts the approved silent
  // handshake design, so Flow A now only starts from the landing button.

  const loadData = useCallback(async () => {
    try {
      const data = await browser.storage.local.get([
        "results",
        "currentIndex",
        "selectedIds",
        "auth",
        "dealercore_session",
        "runQueueIds",
        "automation_state",
      ]);
      const storedResults = Array.isArray(data.results) ? data.results : [];
      const storedIndex = data.currentIndex || 0;
      const storedSelected = Array.isArray(data.selectedIds)
        ? new Set(data.selectedIds)
        : new Set();

      setResults(storedResults);
      setCurrentIndex(storedIndex);
      if (storedSelected.size) setSelectedIds(storedSelected);
      if (data.auth) setAuth(data.auth);
      else if (data.dealercore_session?.user) setAuth(data.dealercore_session);
      // Detect an in-progress run when the panel opens mid-way.
      setRunning(
        !!data.runQueueIds &&
          data.automation_state?.phase !== "complete" &&
          data.automation_state?.phase !== "cancelled",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Derive connection from real DealerCore session (handshake or OAuth),
    // not the local toggle. Validates the per-domain Bearer via /me.
    (async () => {
      try {
        const { base, token } = await getAccessToken();
        if (!token) return;
        const me = await fetchMe(base, token);
        setAuth({
          token,
          baseUrl: base,
          user: me.user ?? null,
          dealer: me.dealer ?? null,
          branch: me.branch ?? null,
          branches: me.branches ?? [],
        });
        setIsConnected(true);
      } catch {
        // No valid session — stay on NotConnected with Login button.
      }
    })();
  }, [loadData]);

  // ── Landing-page connection state machine ──
  // idle       → silent attempt found nothing; show "Connect with DealerCore"
  // connecting → a silent attempt or Flow A is in flight; show progress
  // error      → Flow A was tried and failed; show why, offer a retry
  const [connectStatus, setConnectStatus] = useState("connecting");
  const [connectMessage, setConnectMessage] = useState(
    "Checking your active DealerCore session…",
  );

  const applySession = (result) => {
    setAuth({
      token: result.token ?? null,
      baseUrl: result.base,
      user: result.me?.user ?? null,
      dealer: result.me?.dealer ?? null,
      branch: result.me?.branch ?? null,
      branches: result.me?.branches ?? [],
    });
    setIsConnected(true);
  };

  // Silent auto-connect: on open, try the handshake with no user interaction.
  // Never opens a tab, never steals focus, never pops the OAuth window — it
  // just means the common case is already connected before the user looks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConnectStatus("connecting");
      setConnectMessage("Checking your active DealerCore session…");
      const started = Date.now();
      const result = await tryAutoConnect();
      if (cancelled) return;
      // A failing attempt can resolve in a few milliseconds, which is too fast
      // to perceive — the spinner would flash and the panel would appear to
      // jump straight to the button. Hold the connecting state long enough to
      // actually read.
      const elapsed = Date.now() - started;
      if (elapsed < MIN_CONNECTING_MS) {
        await new Promise((r) => setTimeout(r, MIN_CONNECTING_MS - elapsed));
        if (cancelled) return;
      }
      if (!result.ok) {
        // Expected on a cold browser: no DealerCore session. Not an error —
        // offer the connect button instead.
        setConnectStatus("idle");
        return;
      }
      applySession(result);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pull the full pending list from DealerCore (§5) instead of only whatever
  // the postMessage bridge happened to deliver while the panel was open.
  // This is what the header's refresh button runs.
  const [syncing, setSyncing] = useState(false);
  const [syncMeta, setSyncMeta] = useState(null);

  const syncFromDealerCore = useCallback(async () => {
    setSyncing(true);
    try {
      const vehicleData = await fetchAllVehicles();
      const { vehicles, meta, truncated } = vehicleData;

      let added = 0;
      let updated = 0;
      if (Array.isArray(vehicles) && vehicles.length > 0) {
        const response = await browser.runtime.sendMessage({
          type: "SYNC_VEHICLES",
          payload: vehicles,
        });
        if (!response?.success) {
          throw new Error(response?.error || "Local vehicle sync failed");
        }
        added = response.added || 0;
        updated = response.updated || 0;
      }

      setSyncMeta(meta);
      const bits = [`${added} new`, `${updated} updated`];
      if (truncated) bits.push("list truncated");
      toast.success(`Synced from DealerCore — ${bits.join(", ")}`);
    } catch (e) {
      if (e?.rateLimited) toast.error(e.message);
      else if (e?.unauthenticated) {
        toast.error("DealerCore session expired. Reconnect to keep syncing.");
      } else {
        toast.error(e?.message || "Sync from DealerCore failed");
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await syncFromDealerCore();
    await loadData();
  }, [syncFromDealerCore, loadData]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const data = await browser.storage.local.get([
        "results",
        "currentIndex",
        "runQueueIds",
        "automation_state",
      ]);
      if (Array.isArray(data.results)) {
        setResults(data.results);
        const expected = Array.isArray(data.runQueueIds)
          ? data.runQueueIds.length
          : 0;
        if (expected && data.results.length >= expected) {
          setRunning(false);
          toast.success("All selected listings processed");
        }
      }
      if (data.currentIndex !== undefined) {
        setCurrentIndex(data.currentIndex);
      }
      // The run queue is cleared on cancel/complete, so treat that and the
      // phase as authoritative for stopping the "running" state.
      if (!data.runQueueIds) {
        setRunning(false);
      }
      if (
        data.automation_state?.phase === "cancelled" ||
        data.automation_state?.phase === "complete"
      ) {
        setRunning(false);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    browser.storage.local.set({ selectedIds: Array.from(selectedIds) });
  }, [selectedIds]);

  useEffect(() => {
    browser.storage.local.set({ auth });
  }, [auth]);

  useEffect(() => {
    (async () => {
      const data = await browser.storage.local.get("appearance");
      if (data.appearance?.theme) {
        setTheme(data.appearance.theme);
      }
    })();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      setDark(dark);
    };
    apply();
    browser.storage.local.set({ appearance: { theme } });
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const handleThemeChange = (value) => setTheme(value);

  useEffect(() => {
    const handleClick = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAuthSuccess = (authData) => {
    setAuth(authData);
    setAuthModalOpen(false);
    setIsConnected(true);
  };

  // Landing-page "Connect with DealerCore" → Flow A (interactive OAuth).
  // The silent handshake already had its chance in the auto-connect effect, so
  // this goes straight to OAuth rather than repeating it.
  const handleConnect = async () => {
    setConnectStatus("connecting");
    setConnectMessage("Opening DealerCore sign-in…");
    try {
      const base = await getDealerCoreBaseUrl();
      const token = await launchOAuthLogin(base);
      const me = await fetchMe(base, token);
      applySession({ token, base, me });
    } catch (e) {
      setConnectMessage(e?.message || "Login failed.");
      setConnectStatus("error");
    }
  };

  const handleLogout = async () => {
    try {
      await clearDealerCoreSession();
    } catch {}
    setAuth(null);
    setIsConnected(false);
    setAvatarMenuOpen(false);
    // Sign-out latches the silent handshake off, so don't immediately retry it.
    setConnectStatus("idle");
    toast.success("Signed out");
  };

  const avatarLabel = auth?.user?.name?.charAt(0)?.toUpperCase() || "?";

  const toggleCar = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected =
        vehicles.length > 0 && vehicles.every((v) => prev.has(v.id));
      return allSelected ? new Set() : new Set(vehicles.map((v) => v.id));
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedCount = vehicles.filter((v) => selectedIds.has(v.id)).length;

  const startAutomation = async () => {
    const selectedItems = items.filter((it) => selectedIds.has(it.id));
    if (!selectedItems.length) {
      toast.error("Select at least one vehicle");
      return;
    }

    // The vehicle data already lives in Dexie; storage only carries the
    // per-run queue (which vehicle ids, progress, and results).
    await browser.storage.local.set({
      runQueueIds: selectedItems.map((it) => it.id),
      currentIndex: 0,
      results: [],
      // Fresh run clears any previous cancel request.
      automation_state: { phase: "running", cancelRequested: false },
    });
    setCancelling(false);

    const itemIds = new Set(selectedItems.map((it) => it.id));
    setResults([]);
    setCurrentIndex(0);
    setRunning(true);
    setSelectedIds(itemIds);

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      toast.error("No active tab found");
      return;
    }

    if (
      tab.url &&
      tab.url.startsWith("https://www.facebook.com/marketplace/create/")
    ) {
      browser.tabs.sendMessage(tab.id, { action: "START_AUTOMATION" }, () => {
        if (browser.runtime.lastError) {
          browser.tabs.update(tab.id, { url: TARGET_URL });
        }
      });
    } else {
      browser.tabs.update(tab.id, { url: TARGET_URL });
    }

    toast.success(`Publishing ${selectedItems.length} vehicle(s)`);
  };

  const cancelAutomation = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      // The content script mirrors this flag and bails at its next checkpoint.
      await browser.storage.local.set({
        automation_state: { phase: "cancelling", cancelRequested: true },
      });

      // If the Facebook tab was closed there is no script to acknowledge, so
      // clear the queue ourselves after a grace period.
      const cleared = await new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = setInterval(async () => {
          const data = await browser.storage.local.get(
            ["runQueueIds", "automation_state"],
          );
          if (!data.runQueueIds) {
            clearInterval(timer);
            resolve(true);
          } else if (Date.now() - startedAt > 8000) {
            clearInterval(timer);
            resolve(false);
          }
        }, 400);
      });

      if (!cleared) {
        await browser.storage.local.remove([
          "runQueueIds",
          "currentIndex",
          "results",
        ]);
        toast(
          "Automation stopped. The Facebook tab may still be finishing a publish.",
        );
      } else {
        toast.success("Automation cancelled");
      }
      setRunning(false);
      setResults([]);
      setCurrentIndex(0);
    } catch (e) {
      toast.error(e?.message || "Could not cancel");
    } finally {
      setCancelling(false);
    }
  };

  const saveDraft = async () => {
    const selectedItems = items.filter((it) => selectedIds.has(it.id));
    if (!selectedItems.length) {
      toast.error("Select at least one vehicle");
      return;
    }
    await browser.storage.local.set({
      draftItems: selectedItems,
      draftSavedAt: Date.now(),
    });
    toast.success("Draft saved");
  };

  // The landing page owns its own progress state, so there is no separate
  // full-screen placeholder here — that would duplicate the in-page spinner.
  if (!isConnected)
    return (
      <div className="h-full w-full bg-gray-200 dark:bg-gray-950 flex flex-col overflow-hidden">
        <NotConnected
          dark={dark}
          auth={auth}
          avatarLabel={avatarLabel}
          avatarMenuOpen={avatarMenuOpen}
          avatarMenuRef={avatarMenuRef}
          onToggleAvatar={() => {
            if (auth) setAvatarMenuOpen((v) => !v);
            else setAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onRefresh={loadData}
          onOpenSettings={() => setView("settings")}
          status={connectStatus}
          message={connectMessage}
          onConnect={handleConnect}
        />
      </div>
    );

  return (
    <div className="h-full w-full bg-gray-200 dark:bg-gray-950 flex flex-col overflow-hidden">
      {view === "settings" ? (
        <Settings
          theme={theme}
          onThemeChange={handleThemeChange}
          auth={auth}
          onOpenAuth={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
          onBack={() => setView("main")}
        />
      ) : (
        <Listing
          dark={dark}
          loading={loading}
          vehicles={vehicles}
          selectedIds={selectedIds}
          selectedCount={selectedCount}
          running={running}
          auth={auth}
          avatarLabel={avatarLabel}
          avatarMenuOpen={avatarMenuOpen}
          avatarMenuRef={avatarMenuRef}
          onToggleAvatar={() => {
            if (auth) setAvatarMenuOpen((v) => !v);
            else setAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
          syncing={syncing}
          syncMeta={syncMeta}
          onOpenSettings={() => setView("settings")}
          onToggleCar={toggleCar}
          onToggleAll={toggleAll}
          onClearSelection={clearSelection}
          onStartAutomation={startAutomation}
          onCancelAutomation={cancelAutomation}
          cancelling={cancelling}
          onSaveDraft={saveDraft}
        />
      )}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        dark={dark}
      />
    </div>
  );
};

export default Sidepanel;
