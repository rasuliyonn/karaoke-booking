/**
 * Общие типы контракта API. Один и тот же контракт реализуют:
 *   - api/          — serverless-функции Node.js (то, что работает на Vercel)
 *   - dotnet-api/   — ASP.NET Core Web API на C#
 * При изменении — править обе реализации.
 */

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  features: string[];
  description: string;
}

export interface Booking {
  id: string;
  roomId: string;
  /** Дата в формате YYYY-MM-DD */
  date: string;
  /** Час начала, 12..23 */
  startHour: number;
  /** Длительность в часах, 1..4 */
  hours: number;
  guestName: string;
  phone: string;
  guests: number;
  status: BookingStatus;
  note: string;
  totalPrice: number;
  createdAt: string;
}

export interface Slot {
  hour: number;
  status: 'free' | 'booked';
  bookingId?: string;
  guestName?: string;
}

export interface RoomAvailability {
  room: Room;
  slots: Slot[];
  bookedHours: number;
  loadPercent: number;
}

export interface AvailabilityResponse {
  date: string;
  openHour: number;
  closeHour: number;
  rooms: RoomAvailability[];
}

export interface StatsResponse {
  date: string;
  bookingsTotal: number;
  bookingsConfirmed: number;
  bookingsPending: number;
  hoursBooked: number;
  revenue: number;
  loadPercent: number;
  topRoom: { id: string; name: string; hours: number } | null;
}

export interface CreateBookingInput {
  roomId: string;
  date: string;
  startHour: number;
  hours: number;
  guestName: string;
  phone: string;
  guests: number;
  note?: string;
}

export const OPEN_HOUR = 12;
export const CLOSE_HOUR = 24;
export const MAX_HOURS = 4;

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  completed: 'Завершена',
};
