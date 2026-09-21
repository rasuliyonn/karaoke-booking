import type { VercelRequest, VercelResponse } from '@vercel/node';
import { asString, fail, json, notFound, readBody } from './_lib/http.js';
import * as store from './_lib/store.js';

/**
 * Сегменты пути после /api/.
 *
 * Источников три, и порядок здесь важен:
 *  1. `__route` — его подставляет rewrite из vercel.json (`/api/:route*`);
 *  2. `path` — на случай прямого вызова файла `[...path]`;
 *  3. `req.url` — запасной вариант для локального прогона.
 *
 * Почему не catch-all файл: Vercel сопоставляет `api/[...path].ts` только с
 * ОДНИМ сегментом пути, поэтому `/api/bookings/:id` до функции не доходит и
 * отдаётся платформенная 404. Rewrite в vercel.json решает это явно.
 */
function segmentsOf(req: VercelRequest): string[] {
  const injected = req.query?.__route;
  if (Array.isArray(injected)) return injected.map(String);
  if (typeof injected === 'string' && injected.length > 0) {
    return injected.split('/').filter(Boolean);
  }

  const fromQuery = req.query?.path;
  if (Array.isArray(fromQuery)) return fromQuery.map(String);
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    return fromQuery.split('/').filter(Boolean);
  }

  const path = (req.url ?? '').split('?')[0].replace(/^\/api\/?/, '');
  return path.length > 0 ? path.split('/').filter(Boolean) : [];
}

/**
 * Единая точка входа API. Все запросы на /api/* приходят сюда через rewrite,
 * поэтому маршрутизация сделана вручную — так логика лежит рядом, а не
 * размазана по десятку файлов-функций.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const segments = segmentsOf(req);
    const [resource, id] = segments;
    const method = (req.method ?? 'GET').toUpperCase();

    if (resource === 'health') {
      return json(res, 200, { ok: true, service: 'karaoke-booking-api' });
    }

    if (resource === 'rooms' && method === 'GET') {
      return json(res, 200, store.listRooms());
    }

    if (resource === 'availability' && method === 'GET') {
      const date = asString(req.query.date) ?? store.isoDate();
      return json(res, 200, store.getAvailability(date));
    }

    if (resource === 'stats' && method === 'GET') {
      const date = asString(req.query.date) ?? store.isoDate();
      return json(res, 200, store.getStats(date));
    }

    if (resource === 'bookings') {
      if (id && method === 'GET') {
        return json(res, 200, store.getBooking(id));
      }
      if (method === 'GET') {
        return json(
          res,
          200,
          store.listBookings({
            date: asString(req.query.date),
            status: asString(req.query.status),
            roomId: asString(req.query.roomId),
          }),
        );
      }
      if (method === 'POST') {
        const body = await readBody(req);
        return json(res, 201, store.createBooking(body));
      }
      if (id && method === 'PATCH') {
        const body = await readBody(req);
        return json(res, 200, store.updateBookingStatus(id, body.status));
      }
      if (id && method === 'DELETE') {
        store.deleteBooking(id);
        return json(res, 200, { ok: true });
      }
    }

    throw notFound(`Маршрут не найден: ${method} /api/${segments.join('/')}`);
  } catch (error) {
    fail(res, error);
  }
}
