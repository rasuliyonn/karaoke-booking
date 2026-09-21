import { Link } from 'react-router-dom';
import { useLayout } from '../App';
import { api } from '../api';
import { useAsync } from '../useAsync';
import { Button, Card, ErrorBanner, SectionTitle, Spinner, money } from '../ui';

export default function Rooms() {
  const { date } = useLayout();
  const availability = useAsync(() => api.availability(date), [date]);

  if (availability.loading) return <Spinner label="Загружаю залы…" />;
  if (availability.error) {
    return <ErrorBanner message={availability.error} onRetry={availability.reload} />;
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle hint={`загрузка на ${date}`}>Залы</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {(availability.data?.rooms ?? []).map(({ room, loadPercent, bookedHours }) => (
            <div
              key={room.id}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">{room.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{room.description}</p>
                </div>
                <span className="whitespace-nowrap rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
                  {money(room.pricePerHour)}/ч
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Вместимость</dt>
                  <dd className="text-slate-200">{room.capacity} чел</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Занято сегодня</dt>
                  <dd className="text-slate-200">{bookedHours} ч</dd>
                </div>
              </dl>

              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                  <span>Загрузка</span>
                  <span className="tabular-nums">{loadPercent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400"
                    style={{ width: `${loadPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {room.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-md bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-1">
                <Link to="/new">
                  <Button variant="ghost">Забронировать</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
