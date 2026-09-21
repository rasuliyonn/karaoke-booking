# Karaoke Booking

Система бронирования караоке-залов: расписание слотов по часам, оформление и
подтверждение броней, загрузка залов и выручка за смену.

**Демо:** _ссылка появится после деплоя_

![Стек](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&labelColor=0B1120)
![Стек](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&labelColor=0B1120)
![Стек](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white&labelColor=0B1120)
![Стек](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white&labelColor=0B1120)

---

## Что умеет

- **Расписание** — сетка «час × зал» на выбранную дату, занятые слоты подписаны гостем
- **Брони** — фильтры по дате и статусу, смена статуса, удаление
- **Залы** — вместимость, цена за час, оснащение и текущая загрузка
- **Новая бронь** — форма с проверкой на сервере, конфликты по времени ловятся до сохранения
- **Показатели дня** — загрузка, число броней, выручка, самый востребованный зал

## Стек

| Слой | Технологии |
| :--- | :--- |
| Фронтенд | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| API (прод) | Node.js serverless-функции на Vercel |
| API (портфолио) | ASP.NET Core 10, Minimal API, xUnit |
| Инфраструктура | Vercel, Docker, GitHub Actions |

## Архитектура

```
karaoke-booking/
├── src/              React-приложение (страницы, клиент API, UI-примитивы)
├── api/              serverless-функции Node.js — то, что работает на Vercel
│   ├── [...path].ts  единая точка входа, маршрутизация внутри
│   └── _lib/         домен (store.ts), типы и HTTP-хелперы
├── dotnet-api/       ASP.NET Core Web API — та же логика на C#
│   ├── src/          Minimal API + домен в BookingStore
│   └── tests/        17 тестов на правила бронирования
└── tools/smoke.mjs   прогон эндпоинтов без Vercel
```

**Почему две реализации API.** Vercel не умеет запускать .NET — там нет рантайма.
Чтобы демо было живым, прод-версия написана на Node.js serverless-функциях.
C#-версия реализует **тот же контракт** и лежит рядом: её можно поднять локально
или в Docker и убедиться, что поведение совпадает.

Контракт общий, менять нужно во всех трёх местах:

- `api/_lib/types.ts` — типы serverless-версии
- `dotnet-api/src/KaraokeBooking.Api/Models.cs` — типы C#-версии
- `src/api.ts` — типы фронтенда

## API

| Метод | Путь | Назначение |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Проверка живости |
| `GET` | `/api/rooms` | Список залов |
| `GET` | `/api/availability?date=YYYY-MM-DD` | Слоты по часам для каждого зала |
| `GET` | `/api/stats?date=YYYY-MM-DD` | Показатели дня |
| `GET` | `/api/bookings?date=&status=&roomId=` | Брони с фильтрами |
| `POST` | `/api/bookings` | Создать бронь |
| `PATCH` | `/api/bookings/{id}` | Сменить статус |
| `DELETE` | `/api/bookings/{id}` | Удалить бронь |

Ошибки валидации приходят с `400` и разбивкой по полям:

```json
{
  "error": "Проверьте заполнение формы",
  "details": {
    "guestName": "Укажите имя гостя",
    "hours": "Длительность — от 1 до 4 часов"
  }
}
```

Занятое время — `409 Conflict`. Бизнес-правила: смена 12:00–24:00, бронь 1–4 часа,
нельзя бронировать прошедшую дату и превышать вместимость зала.

## Запуск

### Через Vercel (фронтенд + serverless API вместе)

```bash
npm install
npx vercel dev
```

### Через Docker (React + C# API)

```bash
docker compose up --build
# → http://localhost:5173
```

### Вручную

```bash
# C# API на :5080
cd dotnet-api/src/KaraokeBooking.Api
dotnet run

# фронтенд на :5173, проксирует /api на :5080
cd ../../..
npm install
npm run dev
```

## Тесты

```bash
npm run smoke                        # 10 проверок serverless API
cd dotnet-api && dotnet test         # 17 тестов правил бронирования
npm run build                        # типы + сборка фронтенда
```

CI гоняет всё это на каждый push — см. `.github/workflows/ci.yml`.

## Деплой

Проект разворачивается на Vercel одной командой: фронтенд собирается Vite,
`api/[...path].ts` автоматически становится serverless-функцией.

```bash
npx vercel --prod
```

C#-версию можно поднять на любом хостинге, умеющем Docker (Render, Railway, VPS) —
в `dotnet-api/` лежит готовый `Dockerfile`, слушает порт `8080`.

## Что стоит знать

- **Данные в памяти.** Serverless-версия держит брони в памяти процесса функции:
  демо работает, но состояние сбрасывается при холодном старте и не общее между
  инстансами. Всё общение идёт через функции в `api/_lib/store.ts`, поэтому замена
  на PostgreSQL не затронет обработчики.
- **C#-версия без базы.** Тот же принцип: домен в `BookingStore`, подмена на
  EF Core + PostgreSQL — локальная правка одного класса.
- **OpenAPI не подключён намеренно.** `Microsoft.AspNetCore.OpenApi 10.0.0` тянет
  `Microsoft.OpenApi 2.0.0` с известной уязвимостью (GHSA-v5pm-xwqc-g5wc), а
  исправление требует перехода на 3.x с ломающими изменениями. Эндпоинты
  задокументированы выше.
