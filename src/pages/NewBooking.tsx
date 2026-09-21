import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLayout } from '../App';
import {
  ApiError,
  CLOSE_HOUR,
  MAX_HOURS,
  OPEN_HOUR,
  api,
  type Booking,
  type CreateBookingInput,
} from '../api';
import { useAsync } from '../useAsync';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  SectionTitle,
  Spinner,
  StatusPill,
  hourLabel,
  inputClass,
  money,
} from '../ui';

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
const DURATIONS = Array.from({ length: MAX_HOURS }, (_, i) => i + 1);

export default function NewBooking() {
  const { date, setDate } = useLayout();
  const rooms = useAsync(() => api.rooms(), []);

  const [roomId, setRoomId] = useState('');
  const [startHour, setStartHour] = useState(19);
  const [hours, setHours] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('+992 ');
  const [guests, setGuests] = useState(4);
  const [note, setNote] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Booking | null>(null);

  const room = useMemo(
    () => (rooms.data ?? []).find((item) => item.id === roomId) ?? null,
    [rooms.data, roomId],
  );

  const total = room ? room.pricePerHour * hours : 0;
  const endsAt = startHour + hours;

  const reset = () => {
    setCreated(null);
    setFieldErrors({});
    setFormError(null);
    setGuestName('');
    setPhone('+992 ');
    setGuests(4);
    setNote('');
  };

  const submit = async () => {
    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    const payload: CreateBookingInput = {
      roomId,
      date,
      startHour,
      hours,
      guestName,
      phone,
      guests,
      note,
    };

    try {
      const booking = await api.createBooking(payload);
      setCreated(booking);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFieldErrors(cause.details ?? {});
        setFormError(cause.message);
      } else {
        setFormError(cause instanceof Error ? cause.message : 'Не удалось создать бронь');
      }
    } finally {
      setSaving(false);
    }
  };

  if (rooms.loading) return <Spinner label="Загружаю залы…" />;
  if (rooms.error) return <ErrorBanner message={rooms.error} onRetry={rooms.reload} />;

  if (created) {
    return (
      <Card className="max-w-2xl">
        <SectionTitle>Бронь создана</SectionTitle>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Номер</span>
            <span className="font-mono text-slate-200">{created.id}</span>
            <StatusPill status={created.status} />
          </div>
          <div className="text-slate-300">
            {room?.name} · {created.date} · {hourLabel(created.startHour)}–
            {hourLabel(created.startHour + created.hours)}
          </div>
          <div className="text-slate-400">
            {created.guestName}, {created.guests} гостей · {money(created.totalPrice)}
          </div>
          <p className="pt-2 text-xs text-slate-500">
            Бронь создаётся в статусе «Ожидает» — подтвердите её в разделе «Брони».
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={reset}>Создать ещё</Button>
          <Link to="/bookings">
            <Button variant="ghost">К списку броней</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl">
      <SectionTitle hint="все поля обязательны, кроме примечания">Новая бронь</SectionTitle>

      {formError ? (
        <div className="mb-4">
          <ErrorBanner message={formError} />
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Зал" error={fieldErrors.roomId}>
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className={inputClass}
          >
            <option value="">— выберите зал —</option>
            {(rooms.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · до {item.capacity} чел · {money(item.pricePerHour)}/ч
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Дата" error={fieldErrors.date}>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Начало" error={fieldErrors.startHour}>
            <select
              value={startHour}
              onChange={(event) => setStartHour(Number(event.target.value))}
              className={inputClass}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Длительность"
            error={fieldErrors.hours}
            hint={endsAt > CLOSE_HOUR ? `выходит за ${CLOSE_HOUR}:00` : `до ${hourLabel(endsAt)}`}
          >
            <select
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className={inputClass}
            >
              {DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {value} ч
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Имя гостя" error={fieldErrors.guestName}>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder="Фарход Назаров"
              className={inputClass}
            />
          </Field>

          <Field label="Телефон" error={fieldErrors.phone}>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+992 93 000 00 00"
              className={inputClass}
            />
          </Field>

          <Field
            label="Гостей"
            error={fieldErrors.guests}
            hint={room ? `вместимость ${room.capacity}` : undefined}
          >
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(event) => setGuests(Number(event.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Примечание" error={fieldErrors.note}>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="День рождения, нужен торт к 20:00"
            className={`${inputClass} resize-y`}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
          <div className="text-sm text-slate-400">
            Итого
            <span className="ml-2 text-lg font-semibold text-slate-100">
              {total > 0 ? money(total) : '—'}
            </span>
            {room ? (
              <span className="ml-2 text-xs text-slate-500">
                {hours} ч × {money(room.pricePerHour)}
              </span>
            ) : null}
          </div>
          <Button type="submit" disabled={saving || !roomId}>
            {saving ? 'Сохраняю…' : 'Создать бронь'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
