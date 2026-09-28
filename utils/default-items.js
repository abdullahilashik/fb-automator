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

/**
 * Merge a batch of raw DealerCore API vehicles into the stored list.
 *
 * Upserts by `dealerCoreId` so the same vehicle arriving twice — once via the
 * §4 postMessage bridge, once via a §5 API sync — cannot duplicate, and keeps
 * the locally assigned `id` so selection and per-item result state stay
 * aligned after a refresh.
 *
 * UPDATE_POLICY: 're-publish' — an existing entry is replaced with the fresh
 * copy so the next automation run publishes current details. To skip
 * already-synced vehicles instead, keep the existing entry and ignore the
 * incoming one.
 *
 * Shared by the bridge and the sidepanel sync so the two can't drift.
 */
export function mergeDealerCoreVehicles(existingItems, incomingRaw) {
  let merged = Array.isArray(existingItems) ? [...existingItems] : [];
  const incoming = Array.isArray(incomingRaw) ? incomingRaw : [];
  const mapped = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const vehicle = fromDealerCoreVehicle(raw);
    if (!vehicle) continue;
    mapped.push(vehicle);

    const idx =
      vehicle.dealerCoreId != null
        ? merged.findIndex((it) => it.dealerCoreId === vehicle.dealerCoreId)
        : -1;

    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...vehicle, id: merged[idx].id };
      updated += 1;
      continue;
    }

    const next = appendVehicles(merged, [vehicle]);
    if (next.length > merged.length) {
      merged = next;
      added += 1;
    } else {
      // appendVehicles dropped it as a blank row or signature duplicate.
      skipped += 1;
    }
  }

  return { items: merged, added, updated, skipped, mapped };
}

/**
 * Map a DealerCore Facebook-Marketplace API vehicle (auth-guide.md §5)
 * into the flat shape the FB automation form filler consumes.
 * Returns a normalized object WITHOUT a local id (callers assign via
 * normalizeVehicle/appendVehicles), but WITH dealerCoreId for upserts.
 */
export function fromDealerCoreVehicle(apiVehicle) {
  if (!apiVehicle || typeof apiVehicle !== 'object') return null;
  const details = apiVehicle.details || {};
  const pricing = apiVehicle.pricing || {};
  const images = Array.isArray(apiVehicle.images) ? apiVehicle.images.slice(0, 20) : [];

  const year = details.year ?? '';
  const mileage = details.mileage ?? details.odometer ?? '';
  const price = pricing.price ?? pricing.advertised_price ?? '';
  const bodyStyle = details.body_style ?? details.body_type ?? '';

  // Guide has no dedicated location field — fall back to branch/state text
  // when present, else empty (FB step will skip an empty location).
  const branch = apiVehicle.branch || {};
  const location =
    apiVehicle.location ||
    [branch.name, branch.state].filter(Boolean).join(', ') ||
    '';

  return {
    ...VEHICLE_DEFAULTS,
    dealerCoreId: apiVehicle.id ?? null,
    dealerCoreStatus: apiVehicle.status ?? null, // 'post' | 'update'
    dealerCoreFacebook: apiVehicle.facebook || null,
    // Local sync bookkeeping (written after a §6 write-back mirror).
    syncStatus: apiVehicle.sync_status ?? null,
    syncError: apiVehicle.sync_error ?? null,
    lastSyncedAt: apiVehicle.timestamps?.last_synced_at ?? null,
    // A row is "synced" once the server has a facebook post id and a sync stamp.
    dealerCoreSynced: Boolean(
      apiVehicle.facebook?.post_id && apiVehicle.timestamps?.last_synced_at,
    ),
    vehicleType: 'Car/van',
    imageUrls: images.filter((u) => typeof u === 'string' && u.length > 0),
    location: String(location),
    year: String(year ?? ''),
    make: String(details.make ?? ''),
    model: String(details.model ?? ''),
    mileage: String(mileage ?? ''),
    price: String(price ?? ''),
    fuelType: String(details.fuel_type ?? ''),
    transmission: String(details.transmission ?? ''),
    bodyStyle: String(bodyStyle ?? ''),
    condition: String(details.condition ?? ''),
    exteriorColour: String(details.colour ?? ''),
    interiorColour: '',
    cleanTitle: false,
    description: String(apiVehicle.description ?? ''),
  };
}

/**
 * Inverse of fromDealerCoreVehicle: turn a flat automation item (as used by the
 * feed page, popup test data, and legacy storage.local `items`) back into a raw
 * Dexie `Vehicle` row so everything shares one IndexedDB store.
 *
 * `id` is preserved from the flat item when present (Dexie's primary key);
 * callers that need auto-increment handle assignment in the background.
 */
export function toDealerCoreVehicle(flat) {
  if (!flat || typeof flat !== 'object') return null;
  const details = flat.details || {};
  const pricing = flat.pricing || {};

  return {
    id: Number.isFinite(Number(flat.id)) ? Number(flat.id) : (flat.dealerCoreId ?? null),
    status: flat.dealerCoreStatus || 'post',
    facebook: flat.dealerCoreFacebook || {
      account_id: flat.account_id ?? '',
      post_id: flat.post_id ?? '',
      post_url: flat.post_url ?? '',
    },
    details: {
      year: Number(flat.year ?? details.year) || null,
      make: String(flat.make ?? details.make ?? ''),
      model: String(flat.model ?? details.model ?? ''),
      badge: details.badge ?? '',
      series: details.series ?? '',
      body_style: String(flat.bodyStyle ?? details.body_style ?? details.body_type ?? ''),
      body_type: String(flat.bodyStyle ?? details.body_type ?? details.body_style ?? ''),
      mileage: Number(flat.mileage ?? details.mileage ?? details.odometer) || null,
      odometer: Number(details.odometer) || null,
      odometer_unit: details.odometer_unit ?? '',
      price: Number(flat.price ?? pricing.price ?? pricing.advertised_price) || null,
      condition: String(flat.condition ?? details.condition ?? ''),
      fuel_type: String(flat.fuelType ?? details.fuel_type ?? ''),
      transmission: String(flat.transmission ?? details.transmission ?? ''),
      transmission_type: details.transmission_type ?? '',
      colour: String(flat.exteriorColour ?? details.colour ?? ''),
      vin: details.vin ?? '',
      registration_no: details.registration_no ?? '',
      registration_state: details.registration_state ?? '',
      registration_expiry: details.registration_expiry ?? '',
    },
    pricing: {
      price: Number(flat.price ?? pricing.price ?? pricing.advertised_price) || null,
      advertised_price: Number(pricing.advertised_price) || null,
      discount_price: pricing.discount_price ?? null,
      price_type: pricing.price_type ?? '',
    },
    description: String(flat.description ?? ''),
    description_templates: {
      title: '',
      features: '',
      comments: '',
      offering: '',
      warranty: '',
      tags: '',
      signature: '',
    },
    images: Array.isArray(flat.imageUrls) ? flat.imageUrls.slice(0, 20) : [],
    timestamps: {
      vehicle_updated_at: flat.vehicle_updated_at ?? null,
      last_synced_at: flat.last_synced_at ?? null,
    },
    sync_status: flat.syncStatus ?? flat.sync_status ?? null,
    sync_error: flat.syncError ?? flat.sync_error ?? null,
  };
}
