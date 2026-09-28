import { Vehicle } from "./db";

export interface ApiResponseMeta {
  total: number;
  page: number;
  per_page: number;
  pending_post_count: number;
  pending_update_count: number;
}

export interface VehicleApiResponse {
  status: boolean;
  data: Vehicle[];
  meta: ApiResponseMeta;
}

export type ExtensionMessage =
  | { type: "SYNC_VEHICLES"; payload: Vehicle[] }
  | { type: "SAVE_SINGLE_VEHICLE"; payload: Vehicle }
  | { type: "UPDATE_VEHICLES"; payload: Partial<Vehicle> }
  | { type: "GET_VEHICLES" }
  | { type: "CLEAR_VEHICLES" }
  | { type: "FETCH_IMAGE"; url: string }; // CORS-bypassing image download (host permission per origin)