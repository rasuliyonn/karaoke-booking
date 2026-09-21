using System.Globalization;

namespace KaraokeBooking.Api;

/// <summary>
/// Домен бронирования. Данные держатся в памяти — в этом демо база не нужна.
/// Всё общение идёт через методы ниже, поэтому подмена на EF Core + PostgreSQL
/// не затронет эндпоинты.
/// </summary>
public sealed class BookingStore
{
    private readonly object _gate = new();
    private List<Booking> _bookings;
    private int _sequence;

    public static readonly Room[] Rooms =
    [
        new("room-big", "Большой зал", 12, 2500m,
            ["Сцена", "Светомузыка", "Проектор", "Дым-машина"],
            "Основной зал для больших компаний и корпоративов."),
        new("room-small", "Малый зал", 6, 1500m,
            ["Микрофоны Shure", "Светомузыка"],
            "Уютный зал для небольшой компании."),
        new("room-vip", "VIP-зал", 8, 3500m,
            ["Отдельный вход", "Бар", "Диваны", "Персональный официант"],
            "Закрытый зал с собственным баром и обслуживанием."),
        new("room-bar", "Караоке-бар", 20, 1800m,
            ["Общий зал", "Бар", "Танцпол"],
            "Открытая площадка со свободным входом и ведущим."),
    ];

    private sealed record SeedRow(
        string RoomId, int DayOffset, int StartHour, int Hours,
        string GuestName, string Phone, int Guests, string Status, string Note);

    private static readonly SeedRow[] Seed =
    [
        new("room-big", 0, 18, 3, "Фарход Назаров", "+992 93 112 45 78", 10, "confirmed", "День рождения, нужен торт в 20:00"),
        new("room-big", 1, 20, 3, "Дилшод Рахимов", "+992 92 330 18 04", 8, "pending", ""),
        new("room-small", 0, 19, 2, "Зарина Каримова", "+992 93 774 90 21", 5, "confirmed", "Корпоратив отдела"),
        new("room-small", 0, 22, 2, "Умед Сафаров", "+992 55 201 66 39", 4, "pending", ""),
        new("room-small", 1, 18, 2, "Нилуфар Юсупова", "+992 93 405 12 87", 6, "confirmed", "Девичник"),
        new("room-vip", 0, 21, 3, "Рустам Шарипов", "+992 92 118 73 55", 7, "confirmed", "Приедет с охраной, нужен отдельный вход"),
        new("room-vip", 2, 19, 3, "Мадина Ахмедова", "+992 93 660 41 12", 6, "pending", ""),
        new("room-bar", 0, 12, 2, "Сорбон Давлатов", "+992 55 909 33 21", 14, "completed", "Детский праздник"),
        new("room-bar", 1, 21, 3, "Фирдавс Азизов", "+992 92 745 08 63", 18, "confirmed", "Ведущий свой"),
        new("room-bar", 2, 20, 3, "Шахноза Мирзоева", "+992 93 221 55 90", 12, "pending", ""),
    ];

    public BookingStore() => _bookings = BuildSeed();

    // ---------------------------------------------------------------- утилиты

    /// <summary>Дата со сдвигом от сегодняшней в формате YYYY-MM-DD.</summary>
    public static string IsoDate(int offsetDays = 0)
        => DateTime.Today.AddDays(offsetDays).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static void AssertDate(string? date)
    {
        if (string.IsNullOrWhiteSpace(date) ||
            !DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out _))
        {
            throw new DomainException(400, "Дата должна быть в формате YYYY-MM-DD");
        }
    }

    private string NextId()
    {
        _sequence++;
        return $"bk-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds():x}-{_sequence:x}";
    }

    private List<Booking> BuildSeed()
    {
        var list = new List<Booking>();
        foreach (var row in Seed)
        {
            var room = Rooms.FirstOrDefault(r => r.Id == row.RoomId)
                ?? throw new InvalidOperationException($"Неизвестный зал в сидах: {row.RoomId}");
            list.Add(new Booking(
                NextId(), row.RoomId, IsoDate(row.DayOffset), row.StartHour, row.Hours,
                row.GuestName, row.Phone, row.Guests, row.Status, row.Note,
                room.PricePerHour * row.Hours, DateTimeOffset.UtcNow));
        }
        return list;
    }

    // ---------------------------------------------------------------- выборки

    public IReadOnlyList<Room> ListRooms() => Rooms;

    public AvailabilityResponse GetAvailability(string? date)
    {
        AssertDate(date);
        var day = _bookings.Where(b => b.Date == date && b.Status != "cancelled").ToList();
        var total = Constants.CloseHour - Constants.OpenHour;

        var rooms = Rooms.Select(room =>
        {
            var roomBookings = day.Where(b => b.RoomId == room.Id).ToList();
            var slots = new List<Slot>();
            for (var hour = Constants.OpenHour; hour < Constants.CloseHour; hour++)
            {
                var hit = roomBookings.FirstOrDefault(
                    b => hour >= b.StartHour && hour < b.StartHour + b.Hours);
                slots.Add(hit is null
                    ? new Slot(hour, "free", null, null)
                    : new Slot(hour, "booked", hit.Id, hit.GuestName));
            }

            var bookedHours = slots.Count(s => s.Status == "booked");
            return new RoomAvailability(
                room, slots.ToArray(), bookedHours,
                total == 0 ? 0 : (int)Math.Round(bookedHours * 100.0 / total));
        }).ToArray();

        return new AvailabilityResponse(date!, Constants.OpenHour, Constants.CloseHour, rooms);
    }

    public IReadOnlyList<Booking> ListBookings(string? date, string? status, string? roomId)
    {
        lock (_gate)
        {
            return _bookings
                .Where(b => string.IsNullOrEmpty(date) || b.Date == date)
                .Where(b => string.IsNullOrEmpty(status) || b.Status == status)
                .Where(b => string.IsNullOrEmpty(roomId) || b.RoomId == roomId)
                .OrderBy(b => b.Date).ThenBy(b => b.StartHour)
                .ToList();
        }
    }

    public StatsResponse GetStats(string? date)
    {
        AssertDate(date);
        var day = _bookings.Where(b => b.Date == date && b.Status != "cancelled").ToList();
        var hoursBooked = day.Sum(b => b.Hours);
        var capacity = Rooms.Length * (Constants.CloseHour - Constants.OpenHour);

        var topRoom = Rooms
            .Select(room => new TopRoom(
                room.Id, room.Name, day.Where(b => b.RoomId == room.Id).Sum(b => b.Hours)))
            .OrderByDescending(r => r.Hours)
            .FirstOrDefault();

        return new StatsResponse(
            date!,
            day.Count,
            day.Count(b => b.Status == "confirmed"),
            day.Count(b => b.Status == "pending"),
            hoursBooked,
            day.Sum(b => b.TotalPrice),
            capacity == 0 ? 0 : (int)Math.Round(hoursBooked * 100.0 / capacity),
            topRoom is { Hours: > 0 } ? topRoom : null);
    }

    // ---------------------------------------------------------------- мутации

    public Booking Create(CreateBookingRequest request)
    {
        var errors = new Dictionary<string, string>();

        var roomId = (request.RoomId ?? string.Empty).Trim();
        var room = Rooms.FirstOrDefault(r => r.Id == roomId);
        if (room is null) errors["roomId"] = "Выберите зал";

        var date = (request.Date ?? string.Empty).Trim();
        try
        {
            AssertDate(date);
            if (date.CompareTo(IsoDate()) < 0) errors["date"] = "Нельзя бронировать прошедшую дату";
        }
        catch (DomainException)
        {
            errors["date"] = "Некорректная дата";
        }

        var startHour = request.StartHour ?? 0;
        if (startHour < Constants.OpenHour || startHour >= Constants.CloseHour)
        {
            errors["startHour"] = $"Час начала — от {Constants.OpenHour}:00 до {Constants.CloseHour - 1}:00";
        }

        var hours = request.Hours ?? 0;
        if (hours < 1 || hours > Constants.MaxHours)
        {
            errors["hours"] = $"Длительность — от 1 до {Constants.MaxHours} часов";
        }
        else if (startHour + hours > Constants.CloseHour)
        {
            errors["hours"] = $"Бронь не может заканчиваться позже {Constants.CloseHour}:00";
        }

        var guestName = (request.GuestName ?? string.Empty).Trim();
        if (guestName.Length < 2) errors["guestName"] = "Укажите имя гостя";
        else if (guestName.Length > 80) errors["guestName"] = "Слишком длинное имя";

        var phone = (request.Phone ?? string.Empty).Trim();
        var digits = phone.Count(char.IsDigit);
        if (digits < 9) errors["phone"] = "Укажите корректный телефон";

        var guests = request.Guests ?? 0;
        if (guests < 1) errors["guests"] = "Укажите число гостей";
        else if (room is not null && guests > room.Capacity)
        {
            errors["guests"] = $"Вместимость зала — {room.Capacity} человек";
        }

        var note = (request.Note ?? string.Empty).Trim();
        if (note.Length > 300) note = note[..300];

        if (errors.Count > 0) throw new DomainException(400, "Проверьте заполнение формы", errors);

        lock (_gate)
        {
            var clash = _bookings.FirstOrDefault(b =>
                b.RoomId == roomId && b.Date == date && b.Status != "cancelled" &&
                startHour < b.StartHour + b.Hours && b.StartHour < startHour + hours);

            if (clash is not null)
            {
                throw new DomainException(409, "Это время уже занято", new Dictionary<string, string>
                {
                    ["clashWith"] = $"{clash.StartHour}:00, {clash.Hours} ч",
                });
            }

            var booking = new Booking(
                NextId(), roomId, date, startHour, hours, guestName, phone, guests,
                "pending", note, room!.PricePerHour * hours, DateTimeOffset.UtcNow);

            _bookings = [.. _bookings, booking];
            return booking;
        }
    }

    public Booking GetBooking(string id)
    {
        lock (_gate)
        {
            return _bookings.FirstOrDefault(row => row.Id == id)
                ?? throw new DomainException(404, "Бронирование не найдено");
        }
    }

    public Booking UpdateStatus(string id, string? status)
    {
        var next = (status ?? string.Empty).Trim();
        if (!Constants.ValidStatuses.Contains(next))
        {
            throw new DomainException(400,
                $"Статус должен быть одним из: {string.Join(", ", Constants.ValidStatuses)}");
        }

        lock (_gate)
        {
            var index = _bookings.FindIndex(b => b.Id == id);
            if (index < 0) throw new DomainException(404, "Бронирование не найдено");

            var updated = _bookings[index] with { Status = next };
            _bookings = [.. _bookings.Take(index), updated, .. _bookings.Skip(index + 1)];
            return updated;
        }
    }

    public void Delete(string id)
    {
        lock (_gate)
        {
            if (_bookings.All(b => b.Id != id))
            {
                throw new DomainException(404, "Бронирование не найдено");
            }
            _bookings = _bookings.Where(b => b.Id != id).ToList();
        }
    }
}
