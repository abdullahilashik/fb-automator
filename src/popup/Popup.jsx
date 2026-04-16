import React from "react";
import { PlayCircle, Car } from "lucide-react";

const Popup = () => {
  // Static Data for testing all fields
  const testData = {
    vehicleType: "Car/van",
    imageUrls: ["https://picsum.photos/800/600"],
    location: "Dhaka",
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
    description: "Excellent condition, one owner, smoke-free. Never been in an accident. Regular service history.",
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
    <div className="w-80 p-5 bg-white shadow-xl">
      <div className="flex items-center gap-2 mb-4 border-b pb-2">
        <Car className="text-blue-600" />
        <h1 className="text-lg font-bold text-gray-800">FB Marketplace Bot</h1>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-50 p-3 rounded border border-gray-200 text-[11px] font-mono text-gray-600">
          <p>
            Target: {testData.year} {testData.make} {testData.model}
          </p>
          <p>Location: {testData.location}</p>
          <p>Price: ${testData.price}</p>
          <p>Fields: 16 Total</p>
        </div>

        <button
          onClick={startAutomation}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95 shadow-lg"
        >
          <PlayCircle size={20} />
          Inject All Fields
        </button>
      </div>

      <p className="mt-4 text-[10px] text-gray-400 text-center italic">
        Requires 'Vehicle for Sale' creation page to be active.
      </p>
    </div>
  );
};

export default Popup;
