import React from "react";
import { Loader2, Send } from "lucide-react";
import Header from "../_components/Header";

const STATUS_STYLES = {
  success: {
    card: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
    footer: "text-green-700 dark:text-green-400",
    message: "Ad details filled",
  },
  error: {
    card: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
    footer: "text-red-700 dark:text-red-400",
    message: "Required fields couldn't be filled",
  },
  processing: {
    card: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
    footer: "text-blue-700 dark:text-blue-400",
    message: "Processing:",
  },
  default: {
    card: "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
    footer: "text-gray-400",
    message: "",
  },
};

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#f3f4f6"/><text x="50%" y="50%" fill="#9ca3af" font-family="sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle">No photo</text></svg>'
  );

export function buildVehicles(items, results, currentIndex, running) {
  return items.map((item, index) => {
    const res = (results || []).find((r) => r.id === item.id);
    let status = "default";
    let progress = 0;

    if (res) {
      status = res.status === "Success" ? "success" : "error";
      progress = res.status === "Success" ? 100 : 95;
    } else if (running && index === currentIndex) {
      status = "processing";
      progress = 50;
    }

    return {
      id: item.id,
      name: `${item.year} ${item.make} ${item.model}`,
      trim: item.vehicleType,
      price: `$${Number(item.price || 0).toLocaleString()}`,
      km: item.mileage,
      transmission: item.transmission,
      fuel: item.fuelType,
      image: item.imageUrls?.[0],
      status,
      progress,
    };
  });
}

const Listing = ({
  dark,
  loading,
  vehicles,
  selectedIds,
  selectedCount,
  running,
  auth,
  avatarLabel,
  avatarMenuOpen,
  avatarMenuRef,
  onToggleAvatar,
  onLogout,
  onRefresh,
  onOpenSettings,
  onToggleCar,
  onToggleAll,
  onClearSelection,
  onStartAutomation,
  onSaveDraft,
}) => (
  <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden shadow-xl">
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

    <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
      {loading ? (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <h1 className="text-md font-bold text-gray-900 dark:text-gray-100 leading-tight">Select Vehicles</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 mb-6">
            Choose the vehicles you want to advertise on Facebook.
          </p>

          <div className="flex justify-between items-center mb-4">
            <span className="text-[12px] text-gray-600 dark:text-gray-300">{vehicles.length} vehicles available</span>
            <button
              onClick={onToggleAll}
              className="text-[12px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
            >
              Select all
            </button>
          </div>

          <div className="space-y-3">
            {vehicles.map((car) => {
              const style = STATUS_STYLES[car.status];
              const isSelected = selectedIds.has(car.id);
              return (
                <div
                  key={car.id}
                  onClick={() => onToggleCar(car.id)}
                  className={`relative border rounded-lg transition-all cursor-pointer group flex flex-col overflow-hidden ${style.card}`}
                >
                  <div className="p-2 flex gap-3">
                    <div className="flex items-start pt-1">
                      <div
                        className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${isSelected ? "bg-sky-500 border-sky-500" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <img
                      src={car.image}
                      onError={(e) => (e.currentTarget.src = FALLBACK_IMAGE)}
                      className="w-24 h-16 object-cover rounded-md bg-gray-50 dark:bg-gray-800"
                      alt={car.name}
                    />

                    <div className="flex-1 min-w-0 relative">
                      <div className="flex justify-between items-start">
                        <h3 className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate">{car.name}</h3>
                        {car.status === "error" && (
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="text-red-400 hover:text-red-600 p-1 bg-white dark:bg-gray-800 rounded-full shadow-sm"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0">{car.trim}</p>
                      <p className="text-[12px] font-bold text-sky-500">{car.price}</p>
                      <p className="text-[10px] text-gray-400 mt-0">
                        {car.km} km • {car.transmission} • {car.fuel}
                      </p>
                    </div>
                  </div>

                  {car.status !== "default" && (
                    <div
                      className={`relative px-3 py-2 flex justify-between items-center text-[11px] font-medium ${style.footer}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {car.status === "success" && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {car.status === "error" && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span>{style.message}</span>
                      </div>
                      <span>{car.progress}%</span>
                    </div>
                  )}

                  {car.status === "processing" && (
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-sky-400 transition-all duration-500"
                      style={{ width: `${car.progress}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>

    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      <div className="flex justify-between items-center mb-3">
        <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
          <span>{selectedCount}</span> vehicles selected
        </p>
        <button
          onClick={onClearSelection}
          className="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors"
        >
          Clear selection
        </button>
      </div>
      <div className="space-y-2">
        <button
          onClick={onStartAutomation}
          disabled={selectedCount === 0 || running}
          className="text-sm w-full bg-[#00a2e8] hover:bg-[#008bc9] text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {running ? "Publishing..." : "Publish"}
        </button>
        <button
          onClick={onSaveDraft}
          className="text-sm w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
        >
          Save as draft
        </button>
      </div>
    </div>
  </div>
);

export default Listing;