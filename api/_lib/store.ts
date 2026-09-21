/**
 * Домен и хранилище. Данные держатся в памяти процесса функции — этого достаточно
 * для демо на Vercel. Всё общение идёт через функции ниже, поэтому замена на
 * PostgreSQL/EF Core не затронет обработчики (см. dotnet-api/ для версии с БД).
 */
import {
  CLOSE_HOUR,
  MAX_HOURS,
  OPEN_HOUR,
  type AvailabilityResponse,
  type Booking,
  type BookingStatus,
  type Room,
  type RoomAvailability,
  type Slot,
  type StatsResponse,
} from './types.js';
import { badRequest, conflict, notFound } from './http.js';

export const ROOMS: Room[] = [
  {
    id: 'room-big',
    name: 'Большой зал',
    capacity: 12,
    pricePerHour: 2500,
    features: ['Сцена', 'Светомузыка', 'Проектор', 'Дым-машина'],
    description: 'Основной зал для больших компаний и корпоративов.',
  },
  {
    id: 'room-small',
    name: 'Малый зал',
    capacity: 6,
    pricePerHour: 1500,
    features: ['Микрофоны Shure', 'Светомузыка'],
    description: 'Уютный зал для небольшой компании.',
  },
  {
    id: 'room-vip',
    name: 'VIP-зал',
    capacity: 8,
    pricePerHour: 3500,
    features: ['Отдельный вход', 'Бар', 'Диваны', 'Персональный официант'],
    description: 'Закрытый зал с собственным баром и обслуживанием.',
  },
  {
    id: 'room-bar',
    name: 'Караоке-бар',
    capacity: 20,
    pricePerHour: 1800,
    features: ['Общий зал', 'Бар', 'Танцпол'],
    description: 'Открытая площадка со свободным входом и ведущим.',
  },
];

const VALID_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];

/** Дата со сдвигом от сегодняшней, в локальном формате YYYY-MM-DD. */
export function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface SeedRow {
  roomId: string;
  dayOffset: number;
  startHour: number;
  hours: number;
  guestName: string;
  phone: string;
  guests: number;
  status: BookingStatus;
  note: string;
}

const SEED: SeedRow[] = [
  { roomId: 'room-big', dayOffset: 0, startHour: 18, hours: 3, guestName: 'Фарход Назаров', phone: '+992 93 112 45 78', guests: 10, status: 'confirmed', note: 'День рождения, нужен торт в 20:00' },
  { roomId: 'room-big', dayOffset: 1, startHour: 20, hours: 3, guestName: 'Дилшод Рахимов', phone: '+992 92 330 18 04', guests: 8, status: 'pending', note: '' },
  { roomId: 'room-small', dayOffset: 0, startHour: 19, hours: 2, guestName: 'Зарина Каримова', phone: '+992 93 774 90 21', guests: 5, status: 'confirmed', note: 'Корпоратив отдела' },
  { roomId: 'room-small', dayOffset: 0, startHour: 22, hours: 2, guestName: 'Умед Сафаров', phone: '+992 55 201 66 39', guests: 4, status: 'pending', note: '' },
  { roomId: 'room-small', dayOffset: 1, startHour: 18, hours: 2, guestName: 'Нилуфар Юсупова', phone: '+992 93 405 12 87', guests: 6, status: 'confirmed', note: 'Девичник' },
  { roomId: 'room-vip', dayOffset: 0, startHour: 21, hours: 3, guestName: 'Рустам Шарипов', phone: '+992 92 118 73 55', guests: 7, status: 'confirmed', note: 'Приедет с охраной, нужен отдельный вход' },
  { roomId: 'room-vip', dayOffset: 2, startHour: 19, hours: 3, guestName: 'Мадина Ахмедова', phone: '+992 93 660 41 12', guests: 6, status: 'pending', note: '' },
  { roomId: 'room-bar', dayOffset: 0, startHour: 12, hours: 2, guestName: 'Сорбон Давлатов', phone: '+992 55 909 33 21', guests: 14, status: 'completed', note: 'Детский праздник' },
  { roomId: 'room-bar', dayOffset: 1, startHour: 21, hours: 3, guestName: 'Фирдавс Азизов', phone: '+992 92 745 08 63', guests: 18, status: 'confirmed', note: 'Ведущий свой' },
  { roomId: 'room-bar', dayOffset: 2, startHour: 20, hours: 3, guestName: 'Шахноза Мирзоева', phone: '+992 93 221 55 90', guests: 12, status: 'pending', note: '' },
];

let sequence = 0;
const nextId = (): string => {
  sequence += 1;
  return `bk-${Date.now().toString(36)}-${sequence.toString(36)}`;
};

function buildSeed(): Booking[] {
  return SEED.map((row) => {
    const room = ROOMS.find((r) => r.id === row.roomId);
    if (!room) throw new Error(`Неизвестный зал в сидах: ${row.roomId}`);
    return {
      id: nextId(),
      roomId: row.roomId,
      date: isoDate(row.dayOffset),
      startHour: row.startHour,
      hours: row.hours,
      guestName: row.guestName,
      phone: row.phone,
      guests: row.guests,
      status: row.status,
      note: row.note,
      totalPrice: room.pricePerHour * row.hours,
      createdAt: new Date().toISOString(),
    };
  });
}

/** Хранилище живёт между вызовами в пределах тёплого инстанса функции. */
let bookings: Booking[] = buildSeed();

// ------------------------------------------------------------------ выборки

export function listRooms(): Room[] {
  return ROOMS;
}

function hoursOf(booking: Booking): number {
  return booking.hours;
}

export function getAvailability(date: string): AvailabilityResponse {
  assertDate(date);
  const dayBookings = bookings.filter((b) => b.date === date && b.status !== 'cancelled');

  const rooms: RoomAvailability[] = ROOMS.map((room) => {
    const roomBookings = dayBookings.filter((b) => b.roomId === room.id);
    const slots: Slot[] = [];
    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) {
      const hit = roomBookings.find(
        (b) => hour >= b.startHour && hour < b.startHour + b.hours,
      );
      slots.push(
        hit
          ? { hour, status: 'booked', bookingId: hit.id, guestName: hit.guestName }
          : { hour, status: 'free' },
      );
    }
    const bookedHours = slots.filter((s) => s.status === 'booked').length;
    const total = CLOSE_HOUR - OPEN_HOUR;
    return {
      room,
      slots,
      bookedHours,
      loadPercent: Math.round((bookedHours / total) * 100),
    };
  });

  return { date, openHour: OPEN_HOUR, closeHour: CLOSE_HOUR, rooms };
}

export function listBookings(filter: {
  date?: string;
  status?: string;
  roomId?: string;
}): Booking[] {
  return bookings
    .filter((b) => (filter.date ? b.date === filter.date : true))
    .filter((b) => (filter.status ? b.status === filter.status : true))
    .filter((b) => (filter.roomId ? b.roomId === filter.roomId : true))
    .sort((a, b) =>
      a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date),
    );
}

export function getStats(date: string): StatsResponse {
  assertDate(date);
  const dayBookings = bookings.filter((b) => b.date === date && b.status !== 'cancelled');
  const hoursBooked = dayBookings.reduce((sum, b) => sum + hoursOf(b), 0);
  const capacity = ROOMS.length * (CLOSE_HOUR - OPEN_HOUR);
  const revenue = dayBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  const perRoom = ROOMS.map((room) => ({
    id: room.id,
    name: room.name,
    hours: dayBookings.filter((b) => b.roomId === room.id).reduce((s, b) => s + b.hours, 0),
  }));
  const topRoom = perRoom.reduce<(typeof perRoom)[number] | null>(
    (best, current) => (best === null || current.hours > best.hours ? current : best),
    null,
  );

  return {
    date,
    bookingsTotal: dayBookings.length,
    bookingsConfirmed: dayBookings.filter((b) => b.status === 'confirmed').length,
    bookingsPending: dayBookings.filter((b) => b.status === 'pending').length,
    hoursBooked,
    revenue,
    loadPercent: capacity === 0 ? 0 : Math.round((hoursBooked / capacity) * 100),
    topRoom: topRoom && topRoom.hours > 0 ? topRoom : null,
  };
}

// ------------------------------------------------------------------ мутации

export function createBooking(input: unknown): Booking {
  if (typeof input !== 'object' || input === null) {
    throw badRequest('Ожидается объект бронирования');
  }
  const raw = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const roomId = String(raw.roomId ?? '').trim();
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) errors.roomId = 'Выберите зал';

  const date = String(raw.date ?? '').trim();
  try {
    assertDate(date);
  } catch {
    errors.date = 'Некорректная дата';
  }
  if (date && date < isoDate()) errors.date = 'Нельзя бронировать прошедшую дату';

  const startHour = Number(raw.startHour);
  if (!Number.isInteger(startHour) || startHour < OPEN_HOUR || startHour >= CLOSE_HOUR) {
    errors.startHour = `Час начала — от ${OPEN_HOUR}:00 до ${CLOSE_HOUR - 1}:00`;
  }

  const hours = Number(raw.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
    errors.hours = `Длительность — от 1 до ${MAX_HOURS} часов`;
  }

  if (
    Number.isInteger(startHour) &&
    Number.isInteger(hours) &&
    startHour + hours > CLOSE_HOUR
  ) {
    errors.hours = `Бронь не может заканчиваться позже ${CLOSE_HOUR}:00`;
  }

  const guestName = String(raw.guestName ?? '').trim();
  if (guestName.length < 2) errors.guestName = 'Укажите имя гостя';
  if (guestName.length > 80) errors.guestName = 'Слишком длинное имя';

  const phone = String(raw.phone ?? '').trim();
  if (phone.replace(/\D/g, '').length < 9) errors.phone = 'Укажите корректный телефон';

  const guests = Number(raw.guests);
  if (!Number.isInteger(guests) || guests < 1) {
    errors.guests = 'Укажите число гостей';
  } else if (room && guests > room.capacity) {
    errors.guests = `Вместимость зала — ${room.capacity} человек`;
  }

  const note = String(raw.note ?? '').trim().slice(0, 300);

  if (Object.keys(errors).length > 0) {
    throw badRequest('Проверьте заполнение формы', errors);
  }

  const clash = bookings.find(
    (b) =>
      b.roomId === roomId &&
      b.date === date &&
      b.status !== 'cancelled' &&
      startHour < b.startHour + b.hours &&
      b.startHour < startHour + hours,
  );
  if (clash) {
    throw conflict('Это время уже занято', {
      clashWith: { id: clash.id, startHour: clash.startHour, hours: clash.hours },
    });
  }

  const booking: Booking = {
    id: nextId(),
    roomId,
    date,
    startHour,
    hours,
    guestName,
    phone,
    guests,
    status: 'pending',
    note,
    totalPrice: room!.pricePerHour * hours,
    createdAt: new Date().toISOString(),
  };
  bookings = [...bookings, booking];
  return booking;
}

export function updateBookingStatus(id: string, status: unknown): Booking {
  const next = String(status ?? '').trim() as BookingStatus;
  if (!VALID_STATUSES.includes(next)) {
    throw badRequest(`Статус должен быть одним из: ${VALID_STATUSES.join(', ')}`);
  }
  const index = bookings.findIndex((b) => b.id === id);
  if (index === -1) throw notFound('Бронирование не найдено');

  const updated: Booking = { ...bookings[index], status: next };
  bookings = bookings.map((b, i) => (i === index ? updated : b));
  return updated;
}

export function deleteBooking(id: string): void {
  const exists = bookings.some((b) => b.id === id);
  if (!exists) throw notFound('Бронирование не найдено');
  bookings = bookings.filter((b) => b.id !== id);
}

// ------------------------------------------------------------------ утилиты

export function assertDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Дата должна быть в формате YYYY-MM-DD');
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('Некорректная дата');
  }
}

/** Только для тестов: сбросить состояние к сидам. */
export function resetStore(): void {
  bookings = buildSeed();
}
