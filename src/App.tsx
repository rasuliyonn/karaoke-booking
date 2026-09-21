import { useState } from 'react';
import { NavLink, Outlet, Route, Routes, useOutletContext } from 'react-router-dom';
import Schedule from './pages/Schedule';
import Bookings from './pages/Bookings';
import Rooms from './pages/Rooms';
import NewBooking from './pages/NewBooking';
import { inputClass, prettyDate, shiftIso, todayIso } from './ui';

export interface LayoutContext {
  date: string;
  setDate: (value: string) => void;
}

export const useLayout = () => useOutletContext<LayoutContext>();

const NAV = [
  { to: '/', label: 'Расписание', icon: '▦', end: true },
  { to: '/bookings', label: 'Брони', icon: '☰', end: false },
  { to: '/rooms', label: 'Залы', icon: '◈', end: false },
  { to: '/new', label: 'Новая бронь', icon: '＋', end: false },
];

function Layout() {
  const [date, setDate] = useState(todayIso());

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-slate-800 bg-slate-950/80 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="text-xl">🎤</span>
          <div>
            <div className="text-sm font-semibold text-slate-100">Karaoke Booking</div>
            <div className="text-[11px] text-slate-500">бронирование залов</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-200'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              <span className="text-xs opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">
              {prettyDate(date)}
            </h1>
            <p className="text-sm text-slate-500">
              Смена 12:00–24:00 · четыре зала
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(shiftIso(date, -1))}
              className="rounded-lg border border-slate-700 px-2.5 py-2 text-sm text-slate-300 hover:border-slate-500"
              aria-label="Предыдущий день"
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || todayIso())}
              className={`${inputClass} w-40`}
            />
            <button
              type="button"
              onClick={() => setDate(shiftIso(date, 1))}
              className="rounded-lg border border-slate-700 px-2.5 py-2 text-sm text-slate-300 hover:border-slate-500"
              aria-label="Следующий день"
            >
              →
            </button>
          </div>
        </header>

        <Outlet context={{ date, setDate } satisfies LayoutContext} />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
      <div className="text-sm text-slate-300">Страница не найдена</div>
      <NavLink to="/" className="mt-2 inline-block text-sm text-indigo-300 hover:underline">
        Вернуться к расписанию
      </NavLink>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Schedule />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="new" element={<NewBooking />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
