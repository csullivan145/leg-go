export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  google_id: string;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'planning' | 'active' | 'completed';
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripOffset {
  id: string;
  trip_id: string;
  amount: number;
  description: string;
}

export interface Route {
  id: string;
  trip_id: string;
  name: string;
  status: 'draft' | 'winner' | 'rejected';
  order: number;
}

export type TransportType = 'flight' | 'train' | 'ferry' | 'car' | 'bus';

export interface Leg {
  id: string;
  route_id: string;
  type: 'location' | 'travel';
  order: number;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  transport_type: TransportType | null;
  cost: number | null;
  duration: string | null;
  stops: number | null;
  company: string | null;
  booking_id: string | null;
  booking_link: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_location: string | null;
  arrival_location: string | null;
  notes: string | null;
}

export interface Accommodation {
  id: string;
  leg_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  cost_per_night: number | null;
  total_cost: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  amenities: string[];
  booking_link: string | null;
  notes: string | null;
}

export interface DayTrip {
  id: string;
  leg_id: string;
  date: string;
  destination_name: string;
  status: 'confirmed' | 'idea';
  transport_type: TransportType | null;
  cost: number | null;
  notes: string | null;
}

export interface Activity {
  id: string;
  leg_id: string;
  date: string;
  name: string;
  time: string | null;
  booking_id: string | null;
  booking_link: string | null;
  notes: string | null;
}

export interface CarRental {
  id: string;
  leg_id: string;
  company: string | null;
  cost: number | null;
  pickup_date: string | null;
  return_date: string | null;
  notes: string | null;
}

export interface TripShare {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'viewer' | 'editor';
}

export type TripRole = 'owner' | 'editor' | 'viewer';
