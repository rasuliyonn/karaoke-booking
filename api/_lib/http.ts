/** Хелперы HTTP: единый формат ответов и ошибок. */

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): unknown;
  send(body: unknown): unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, message, details);

export const notFound = (message = 'Не найдено') => new ApiError(404, message);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, message, details);

export function json(res: ApiResponse, status: number, body: unknown): void {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(body));
}

export function fail(res: ApiResponse, error: unknown): void {
  if (error instanceof ApiError) {
    json(res, error.status, { error: error.message, details: error.details ?? null });
    return;
  }
  const message = error instanceof Error ? error.message : 'Внутренняя ошибка';
  json(res, 500, { error: message });
}

/** Приводит query-параметр к строке (Vercel отдаёт string | string[]). */
export function asString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export function asInt(value: unknown): number | undefined {
  const raw = asString(value);
  if (raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export async function readBody(req: { body?: unknown }): Promise<Record<string, unknown>> {
  const raw = req.body;
  if (raw === undefined || raw === null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      throw badRequest('Тело запроса не является корректным JSON');
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  throw badRequest('Неподдерживаемый формат тела запроса');
}
