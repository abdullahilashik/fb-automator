import React from "react";
import { PlayCircle, Car, Settings, CheckCircle } from "lucide-react";

const Popup = () => {
  // Static Data for testing
  const testData = {
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
    bodyStyle: "Pickup Truck",
    condition: "Excellent",
    exteriorColour: "Black",
    interiorColour: "Black",
    cleanTitle: true,
    description: "Excellent condition, one owner, smoke-free.",
  };

  const startAutomation = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "START_AUTOMATION",
        payload: testData,
      });
    });
  };

  return (
    <div className="w-[350px] bg-white shadow-2xl rounded-xl overflow-hidden border border-gray-100">
      <div className="bg-blue-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="text-white" size={24} />
          <h1 className="text-lg font-bold text-white">FB Automator</h1>
        </div>
        <Settings className="text-blue-100 cursor-pointer hover:rotate-90 transition-transform" size={20} />
      </div>

      <div className="p-5">
        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Item Preview</h2>
          <div className="grid grid-cols-2 gap-2 text-[12px] font-mono text-gray-600">
            <div className="bg-white p-1 rounded border border-gray-100">Make: {testData.make}</div>
            <div className="bg-white p-1 rounded border border-gray-100">Model: {testData.model}</div>
            <div className="bg-white p-1 rounded border border-gray-100 col-span-2">Loc: {testData.location.substring(0, 30)}...</div>
          </div>
        </div>

        <button
          onClick={startAutomation}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-md hover:shadow-lg"
        >
          <PlayCircle size={20} />
          Start Automation
        </button>
      </div>

      <div className="px-5 pb-5 pt-0">
        <div className="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-md">
          <CheckCircle size={14} />
          <span>Ready to inject fields</span>
        </div>
        <p className="mt-3 text-[10px] text-gray-400 text-center italic">
          Ensure 'Vehicle for Sale' page is open.
        </p>
      </div>
    </div>
  );
};

export default Popup;
