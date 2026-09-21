/**
 * Типизированный клиент API. Типы повторяют контракт из api/_lib/types.ts и
 * dotnet-api/Models.cs — при изменении править во всех трёх местах.
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
  date: string;
  startHour: number;
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

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: Record<string, string> | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Сервер недоступен. Проверьте соединение.');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; details?: Record<string, string> };
    throw new ApiError(response.status, body.error ?? `Ошибка ${response.status}`, body.details ?? null);
  }

  return payload as T;
}

export const api = {
  rooms: () => request<Room[]>('/rooms'),

  availability: (date: string) =>
    request<AvailabilityResponse>(`/availability?date=${encodeURIComponent(date)}`),

  stats: (date: string) => request<StatsResponse>(`/stats?date=${encodeURIComponent(date)}`),

  bookings: (params: { date?: string; status?: string; roomId?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.date) search.set('date', params.date);
    if (params.status) search.set('status', params.status);
    if (params.roomId) search.set('roomId', params.roomId);
    const suffix = search.toString() ? `?${search}` : '';
    return request<Booking[]>(`/bookings${suffix}`);
  },

  createBooking: (input: CreateBookingInput) =>
    request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(input) }),

  updateStatus: (id: string, status: BookingStatus) =>
    request<Booking>(`/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  removeBooking: (id: string) =>
    request<{ ok: true }>(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
