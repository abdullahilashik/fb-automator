export const DEFAULT_ITEMS = [
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

export const VEHICLE_DEFAULTS = {
  vehicleType: "Car/van",
  imageUrls: [],
  location: "",
  year: "",
  make: "",
  model: "",
  mileage: "",
  price: "",
  fuelType: "",
  transmission: "",
  bodyStyle: "",
  condition: "",
  exteriorColour: "",
  interiorColour: "",
  cleanTitle: false,
  description: "",
};

/**
 * Normalize one raw incoming object against the vehicle schema.
 * Returns null when the entry is unusable (not an object).
 */
export function normalizeVehicle(raw, id) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const imageUrls = Array.isArray(raw.imageUrls)
    ? raw.imageUrls.filter((u) => typeof u === "string" && u.length > 0)
    : raw.imageUrls && typeof raw.imageUrls === "string"
      ? [raw.imageUrls]
      : [];

  return {
    ...VEHICLE_DEFAULTS,
    ...raw,
    id,
    imageUrls,
    cleanTitle: Boolean(raw.cleanTitle ?? VEHICLE_DEFAULTS.cleanTitle),
    year: raw.year != null ? String(raw.year) : "",
    mileage: raw.mileage != null ? String(raw.mileage) : "",
    price: raw.price != null ? String(raw.price) : "",
  };
}

function signatureOf(item) {
  return [item.make, item.model, item.year, item.price]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * Append incoming raw entries to the existing list.
 * - Accepts array (callers may wrap a single object beforehand).
 * - Assigns auto-increment ids from max(existing)+1.
 * - Skips exact duplicates on make|model|year|price signature.
 */
export function appendVehicles(existingItems, incomingRaw) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingRaw) ? incomingRaw : [];
  const seen = new Set(existing.map(signatureOf));
  let nextId = existing.reduce((max, it) => Math.max(max, Number(it.id) || 0), 0) + 1;

  const appended = [];
  for (const raw of incoming) {
    const normalized = normalizeVehicle(raw, nextId);
    if (!normalized) continue;
    const sig = signatureOf(normalized);
    // Skip blank rows and duplicates (also de-dupe within the same batch).
    if (sig === "|||" || seen.has(sig)) continue;
    seen.add(sig);
    appended.push(normalized);
    nextId += 1;
  }
  return [...existing, ...appended];
}
