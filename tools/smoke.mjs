/**
 * Прогон API без Vercel: поднимает обработчик и дёргает эндпоинты.
 *
 *   node --experimental-strip-types tools/smoke.mjs        # напрямую (Node 22+)
 *   node tools/smoke.mjs .smoke/fn.mjs                     # по собранному бандлу
 *
 * Путь указывается от текущей рабочей директории. Используется в CI, чтобы
 * поймать поломку маршрутов до деплоя.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const target = process.argv[2] ?? 'api/router.ts';
const { default: handler } = await import(pathToFileURL(resolve(process.cwd(), target)).href);

function call(method, path, { query = {}, body } = {}) {
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, value) {
        this.headers[name] = value;
        return this;
      },
      send(payload) {
        let parsed = null;
        try {
          parsed = JSON.parse(payload);
        } catch {
          parsed = payload;
        }
        resolve({ status: this.statusCode, body: parsed });
      },
    };

    Promise.resolve(handler({ method, query, body, headers: {} }, response)).catch((error) =>
      resolve({ status: 500, body: { error: String(error) } }),
    );
  });
}

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

console.log('Прогон API:');

// --- Маршрутизация. Общие проверки: ловят поломку rewrite и разбора пути. ---

const health = await call('GET', '/api/health', { query: { __route: 'health' } });
check('GET /api/health → 200 (через __route, как в проде)', health.status === 200 && health.body.ok === true, health);

const healthFallback = await call('GET', '/api/health', { query: { path: ['health'] } });
check('GET /api/health → 200 (запасной разбор query.path)', healthFallback.status === 200, healthFallback);

const seedList = await call('GET', '/api/bookings', { query: { __route: 'bookings' } });
const seedBooking = Array.isArray(seedList.body) ? seedList.body[0] : null;
const seedId = seedBooking?.id ?? 'none';
const deep = await call('GET', `/api/bookings/${seedId}`, { query: { __route: `bookings/${seedId}` } });
check(
  'Многосегментный путь доходит до маршрутизатора',
  deep.status === 200 && deep.body?.id === seedBooking?.id,
  deep,
);

const deepMissing = await call('GET', '/api/__probe/deep', { query: { __route: '__probe/deep' } });
check(
  'Неизвестный многосегментный путь → 404 от API',
  deepMissing.status === 404 && deepMissing.body?.error?.includes('__probe/deep'),
  deepMissing,
);

const rooms = await call('GET', '/api/rooms', { query: { path: ['rooms'] } });
check('GET /api/rooms → 4 зала', rooms.status === 200 && rooms.body.length === 4, rooms);

const availability = await call('GET', '/api/availability', {
  query: { path: ['availability'], date: '2030-06-01' },
});
check(
  'GET /api/availability → слоты на всю смену',
  availability.status === 200 &&
    availability.body.rooms.every((room) => room.slots.length === 12),
  availability.status,
);

const stats = await call('GET', '/api/stats', {
  query: { path: ['stats'], date: '2030-06-01' },
});
check('GET /api/stats → 200', stats.status === 200 && typeof stats.body.loadPercent === 'number', stats);

const created = await call('POST', '/api/bookings', {
  query: { path: ['bookings'] },
  body: {
    roomId: 'room-small',
    date: '2030-06-01',
    startHour: 15,
    hours: 2,
    guestName: 'Смоук Тест',
    phone: '+992 93 111 22 33',
    guests: 4,
  },
});
check('POST /api/bookings → 201', created.status === 201 && created.body.status === 'pending', created);

const clash = await call('POST', '/api/bookings', {
  query: { path: ['bookings'] },
  body: {
    roomId: 'room-small',
    date: '2030-06-01',
    startHour: 16,
    hours: 2,
    guestName: 'Смоук Тест',
    phone: '+992 93 111 22 33',
    guests: 2,
  },
});
check('POST пересечения → 409', clash.status === 409, clash);

const invalid = await call('POST', '/api/bookings', {
  query: { path: ['bookings'] },
  body: { roomId: '', date: '2030-06-01', startHour: 15, hours: 9, guestName: '', phone: '1', guests: 0 },
});
check(
  'POST с ошибками → 400 и разбивка по полям',
  invalid.status === 400 && invalid.body.details && Object.keys(invalid.body.details).length >= 4,
  invalid,
);

const confirmed = await call('PATCH', `/api/bookings/${created.body.id}`, {
  query: { path: ['bookings', created.body.id] },
  body: { status: 'confirmed' },
});
check('PATCH статуса → confirmed', confirmed.status === 200 && confirmed.body.status === 'confirmed', confirmed);

const removed = await call('DELETE', `/api/bookings/${created.body.id}`, {
  query: { path: ['bookings', created.body.id] },
});
check('DELETE брони → 200', removed.status === 200 && removed.body.ok === true, removed);

const missing = await call('GET', '/api/nope', { query: { __route: 'nope' } });
check('Неизвестный маршрут → 404 от API, а не от платформы', missing.status === 404 && missing.body?.error, missing);

console.log(failures === 0 ? '\nВсе проверки пройдены.' : `\nПровалено проверок: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
