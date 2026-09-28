// utils/db.ts
import { Dexie, type EntityTable } from 'dexie';

export interface IFacebook {
  account_id: string;
  post_id: string;
  post_url: string;
}

export interface IVehicleDetails {
  year: number;
  make: string;
  model: string;
  badge: string;
  series: string;
  body_style: string;
  body_type: string;
  mileage: number;
  odometer: number;
  odometer_unit: string;
  price: number;
  condition: string;
  fuel_type: string;
  transmission: string;
  transmission_type: string;
  colour: string;
  vin: string;
  registration_no: string;
  registration_state: string;
  registration_expiry: string;
}

export interface IPricing {
  price: number;
  advertised_price: number;
  discount_price: number | null;
  price_type: string;
}

export interface IDescriptionTemplate {
  title: string;
  features: string;
  comments: string;
  offering: string;
  warranty: string;
  tags: string;
  signature: string;
}

export interface ITimestamps {
  vehicle_updated_at: string;
  last_synced_at: string | null;
}

export interface Vehicle {
  id: number; // Native API primary key
  status: 'post' | 'update' | string;
  facebook: IFacebook;
  details: IVehicleDetails;
  pricing: IPricing;
  description: string;
  description_templates: IDescriptionTemplate;
  images: string[];
  timestamps: ITimestamps;
  // Local-only sync bookkeeping written by UPDATE_SYNC_STATUS after a §6
  // write-back. Not part of the DealerCore API shape.
  sync_status?: 'synced' | 'failed' | null;
  sync_error?: string | null;
}

export const db = new Dexie('VehicleExtensionDB') as Dexie & {
  vehicles: EntityTable<Vehicle, 'id'>;
};

// Index definition: Use 'id' (not '++id') because IDs come directly from the API.
// Indexed nested properties allow filtering/sorting via Dexie queries.
db.version(1).stores({
  vehicles: 'id, status, details.make, details.model, details.year, pricing.price, timestamps.vehicle_updated_at',
});