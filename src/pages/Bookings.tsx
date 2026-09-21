import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLayout } from '../App';
import { api, STATUS_LABELS, type BookingStatus } from '../api';
import { useAsync } from '../useAsync';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  SectionTitle,
  Spinner,
  StatusPill,
  hourLabel,
  money,
  prettyDate,
} from '../ui';

const FILTERS: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'confirmed', label: STATUS_LABELS.confirmed },
  { value: 'completed', label: STATUS_LABELS.completed },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
];

export default function Bookings() {
  const { date } = useLayout();
  const [scope, setScope] = useState<'day' | 'all'>('day');
  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const bookings = useAsync(
    () =>
      api.bookings({
        date: scope === 'day' ? date : undefined,
        status: status === 'all' ? undefined : status,
      }),
    [date, scope, status],
  );
  const rooms = useAsync(() => api.rooms(), []);

  const roomNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of rooms.data ?? []) map.set(room.id, room.name);
    return map;
  }, [rooms.data]);

  const changeStatus = async (id: string, next: BookingStatus) => {
    setBusyId(id);
    setActionError(null);
    try {
      await api.updateStatus(id, next);
      bookings.reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Не удалось изменить статус');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await api.removeBooking(id);
      bookings.reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Не удалось удалить бронь');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          hint={bookings.data ? `найдено: ${bookings.data.length}` : undefined}
        >
          Бронирования
        </SectionTitle>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setScope('day')}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                scope === 'day' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {prettyDate(date)}
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`rounded-md px-3 py-1.5 text-xs transition ${
                scope === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все даты
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatus(item.value)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  status === item.value
                    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Link to="/new" className="ml-auto">
            <Button variant="subtle">＋ Новая бронь</Button>
          </Link>
        </div>

        {actionError ? (
          <div className="mb-4">
            <ErrorBanner message={actionError} />
          </div>
        ) : null}

        {bookings.loading ? (
          <Spinner label="Загружаю брони…" />
        ) : bookings.error ? (
          <ErrorBanner message={bookings.error} onRetry={bookings.reload} />
        ) : (bookings.data ?? []).length === 0 ? (
          <EmptyState
            title="Броней нет"
            hint="Смените фильтр или создайте новую бронь"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 font-medium">Дата и время</th>
                  <th className="py-2 pr-3 font-medium">Зал</th>
                  <th className="py-2 pr-3 font-medium">Гость</th>
                  <th className="py-2 pr-3 font-medium">Гостей</th>
                  <th className="py-2 pr-3 font-medium">Сумма</th>
                  <th className="py-2 pr-3 font-medium">Статус</th>
                  <th className="py-2 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(bookings.data ?? []).map((booking) => (
                  <tr key={booking.id} className="border-b border-slate-800/60 align-top">
                    <td className="py-3 pr-3">
                      <div className="text-slate-200">{prettyDate(booking.date)}</div>
                      <div className="text-xs text-slate-500">
                        {hourLabel(booking.startHour)} — {hourLabel(booking.startHour + booking.hours)}
                        {' · '}
                        {booking.hours} ч
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-300">
                      {roomNames.get(booking.roomId) ?? booking.roomId}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="text-slate-200">{booking.guestName}</div>
                      <div className="text-xs text-slate-500">{booking.phone}</div>
                      {booking.note ? (
                        <div className="mt-1 max-w-[220px] text-xs text-slate-500">
                          {booking.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-slate-300">{booking.guests}</td>
                    <td className="py-3 pr-3 tabular-nums text-slate-200">
                      {money(booking.totalPrice)}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill status={booking.status} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {booking.status === 'pending' ? (
                          <Button
                            variant="subtle"
                            disabled={busyId === booking.id}
                            onClick={() => void changeStatus(booking.id, 'confirmed')}
                          >
                            Подтвердить
                          </Button>
                        ) : null}
                        {booking.status === 'confirmed' ? (
                          <Button
                            variant="subtle"
                            disabled={busyId === booking.id}
                            onClick={() => void changeStatus(booking.id, 'completed')}
                          >
                            Завершить
                          </Button>
                        ) : null}
                        {booking.status !== 'cancelled' ? (
                          <Button
                            variant="ghost"
                            disabled={busyId === booking.id}
                            onClick={() => void changeStatus(booking.id, 'cancelled')}
                          >
                            Отменить
                          </Button>
                        ) : null}
                        <Button
                          variant="danger"
                          disabled={busyId === booking.id}
                          onClick={() => void remove(booking.id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
