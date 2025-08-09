export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  new_used: string;
  trim?: string;
  color?: string;
  mileage?: number;
  price?: number;
  description?: string;
  features?: string[];
  photo_url_list?: string[]; // Now properly TEXT[] type in database
  status: string;
  qr_code_url?: string;
  dealer_name?: string;
  created_at: string;
}