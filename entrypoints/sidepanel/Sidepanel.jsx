import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { browser } from "wxt/browser";
import toast from "react-hot-toast";
import AuthModal from "./AuthModal";
import Settings from "./pages/Settings";
import Listing, { buildVehicles } from "./pages/Listing";
import NotConnected from "./pages/NotConnected";

const TARGET_URL = "https://www.facebook.com/marketplace/create/vehicle";

const DEFAULT_ITEMS = [
  {
    id: 1,
    vehicleType: "Car/van",
    imageUrls: ["https://picsum.photos/800/600"],
    location: "Sydney, New South Wales, Australia",
    year: "2021",
    make: "Ford",
    model: "F-150",
    mileage: "25000",
    price: "45000",
    fuelType: "Petrol",
    transmission: "Automatic transmission",
    bodyStyle: "Van",
    condition: "Excellent",
    exteriorColour: "Black",
    interiorColour: "Black",
    cleanTitle: true,
    description: "Excellent condition, one owner, smoke-free.",
  },
  {
    id: 2,
    vehicleType: "Car/van",
    imageUrls: ["https://picsum.photos/800/600"],
    location: "Melbourne, Victoria, Australia",
    year: "2022",
    make: "Toyota",
    model: "Camry",
    mileage: "15000",
    price: "35000",
    fuelType: "Hybrid",
    transmission: "Automatic transmission",
    bodyStyle: "Van",
    condition: "Like new",
    exteriorColour: "White",
    interiorColour: "Grey",
    cleanTitle: true,
    description: "Great car, fuel efficient, low mileage.",
  },
];

const Sidepanel = () => {
  const [items, setItems] = useState([]);
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

  const vehicles = useMemo(
    () => buildVehicles(items, results, currentIndex, running),
    [items, results, currentIndex, running]
  );

  const loadData = useCallback(async () => {
    try {
      const data = await browser.storage.local.get(["items", "results", "currentIndex", "selectedIds", "auth"]);
      const storedItems = Array.isArray(data.items) && data.items.length ? data.items : DEFAULT_ITEMS;
      const storedResults = Array.isArray(data.results) ? data.results : [];
      const storedIndex = data.currentIndex || 0;
      const storedSelected = Array.isArray(data.selectedIds)
        ? new Set(data.selectedIds)
        : new Set(storedItems.map((it) => it.id));

      setItems(storedItems);
      setResults(storedResults);
      setCurrentIndex(storedIndex);
      setSelectedIds(storedSelected);
      if (data.auth) setAuth(data.auth);
      setRunning(
        !!data.items && !(storedResults.length && storedResults.length >= storedItems.length)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const data = await browser.storage.local.get(["items", "results", "currentIndex"]);
      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
      if (Array.isArray(data.results)) {
        setResults(data.results);
        const targetItems = Array.isArray(data.items) ? data.items : items;
        if (targetItems.length && data.results.length >= targetItems.length) {
          setRunning(false);
          toast.success("All selected listings processed");
        }
      }
      if (data.currentIndex !== undefined) {
        setCurrentIndex(data.currentIndex);
      }
      if (data.items === undefined && data.results === undefined) {
        setRunning(false);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [running, items]);

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
      const dark =
        theme === "dark" || (theme === "system" && media.matches);
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
  };

  const handleLogout = () => {
    setAuth(null);
    setAvatarMenuOpen(false);
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
      const allSelected = vehicles.length > 0 && vehicles.every((v) => prev.has(v.id));
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

    await browser.storage.local.set({
      items: selectedItems,
      currentIndex: 0,
      results: [],
    });

    const itemIds = new Set(selectedItems.map((it) => it.id));
    setItems(selectedItems);
    setResults([]);
    setCurrentIndex(0);
    setRunning(true);
    setSelectedIds(itemIds);

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      toast.error("No active tab found");
      return;
    }

    if (tab.url && tab.url.startsWith("https://www.facebook.com/marketplace/create/")) {
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

  const saveDraft = async () => {
    const selectedItems = items.filter((it) => selectedIds.has(it.id));
    if (!selectedItems.length) {
      toast.error("Select at least one vehicle");
      return;
    }
    await browser.storage.local.set({ draftItems: selectedItems, draftSavedAt: Date.now() });
    toast.success("Draft saved");
  };

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
          onConnectHandle={setIsConnected}
        />
      </div>
    )

  return (
    <div className="h-full w-full bg-gray-200 dark:bg-gray-950 flex flex-col overflow-hidden">
      {view === "settings" ? (
        <Settings
          theme={theme}
          onThemeChange={handleThemeChange}
          auth={auth}
          onOpenAuth={() => setAuthModalOpen(true)}
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
          onRefresh={loadData}
          onOpenSettings={() => setView("settings")}
          onToggleCar={toggleCar}
          onToggleAll={toggleAll}
          onClearSelection={clearSelection}
          onStartAutomation={startAutomation}
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