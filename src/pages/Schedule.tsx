import { useLayout } from '../App';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { Card, ErrorBanner, SectionTitle, Spinner, StatCard, hourLabel, money } from '../ui';

export default function Schedule() {
  const { date } = useLayout();

  const availability = useAsync(() => api.availability(date), [date]);
  const stats = useAsync(() => api.stats(date), [date]);

  if (availability.loading) return <Spinner label="Считаю расписание…" />;
  if (availability.error) {
    return <ErrorBanner message={availability.error} onRetry={availability.reload} />;
  }
  if (!availability.data) return null;

  const { rooms, openHour, closeHour } = availability.data;
  const hours: number[] = [];
  for (let hour = openHour; hour < closeHour; hour += 1) hours.push(hour);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Загрузка залов"
          value={stats.data ? `${stats.data.loadPercent}%` : '—'}
          hint={stats.data ? `${stats.data.hoursBooked} ч продано` : undefined}
        />
        <StatCard
          label="Активных броней"
          value={stats.data ? stats.data.bookingsTotal : '—'}
          hint={stats.data ? `${stats.data.bookingsPending} ждут подтверждения` : undefined}
          accent="text-violet-300"
        />
        <StatCard
          label="Выручка за день"
          value={stats.data ? money(stats.data.revenue) : '—'}
          accent="text-emerald-300"
        />
        <StatCard
          label="Лучший зал"
          value={stats.data?.topRoom?.name ?? '—'}
          hint={stats.data?.topRoom ? `${stats.data.topRoom.hours} ч` : 'нет данных'}
          accent="text-amber-300"
        />
      </div>

      <Card className="overflow-x-auto">
        <SectionTitle hint={`${openHour}:00 — ${closeHour}:00`}>
          Занятость по часам
        </SectionTitle>

        <table className="w-full min-w-[720px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-16 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Час
              </th>
              {rooms.map(({ room }) => (
                <th key={room.id} className="text-left">
                  <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                    <div className="text-sm font-medium text-slate-200">{room.name}</div>
                    <div className="text-[11px] text-slate-500">
                      до {room.capacity} чел · {money(room.pricePerHour)}/ч
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="pr-2 text-right align-middle text-xs tabular-nums text-slate-500">
                  {hourLabel(hour)}
                </td>
                {rooms.map(({ room, slots }) => {
                  const slot = slots.find((item) => item.hour === hour);
                  const booked = slot?.status === 'booked';
                  return (
                    <td key={`${room.id}-${hour}`}>
                      <div
                        title={booked ? slot?.guestName : 'Свободно'}
                        className={`h-8 rounded-md border px-2 text-[11px] leading-8 ${
                          booked
                            ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-200'
                            : 'border-slate-800 bg-slate-900/40 text-slate-600'
                        }`}
                      >
                        <span className="block truncate">
                          {booked ? slot?.guestName : 'свободно'}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border border-indigo-500/30 bg-indigo-500/15" />
            занято
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border border-slate-800 bg-slate-900/40" />
            свободно
          </span>
        </div>
      </Card>
    </div>
  );
}
