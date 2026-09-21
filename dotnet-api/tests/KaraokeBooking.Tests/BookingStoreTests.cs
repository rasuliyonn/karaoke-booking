using KaraokeBooking.Api;

namespace KaraokeBooking.Tests;

/// <summary>
/// Тесты домена бронирования. Проверяют правила, которые легко сломать:
/// пересечение по времени, вместимость зала, границы смены и переходы статусов.
/// </summary>
public class BookingStoreTests
{
    private static BookingStore NewStore() => new();

    private static CreateBookingRequest Valid(
        string roomId = "room-small",
        string? date = null,
        int startHour = 15,
        int hours = 2,
        string guestName = "Тест Тестов",
        string phone = "+992 93 000 11 22",
        int guests = 4) =>
        new(roomId, date ?? BookingStore.IsoDate(5), startHour, hours, guestName, phone, guests, "");

    [Fact]
    public void Список_залов_содержит_четыре_зала()
    {
        Assert.Equal(4, NewStore().ListRooms().Count);
    }

    [Fact]
    public void Создание_брони_проставляет_цену_и_статус_ожидания()
    {
        var store = NewStore();
        var booking = store.Create(Valid(hours: 3));

        Assert.Equal("pending", booking.Status);
        Assert.Equal(1500m * 3, booking.TotalPrice);
        Assert.StartsWith("bk-", booking.Id);
    }

    [Fact]
    public void Пересекающаяся_бронь_отклоняется()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(7);
        store.Create(Valid(date: date, startHour: 18, hours: 2));

        var error = Assert.Throws<DomainException>(
            () => store.Create(Valid(date: date, startHour: 19, hours: 2)));

        Assert.Equal(409, error.Status);
    }

    [Fact]
    public void Соседняя_бронь_впритык_разрешается()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(8);
        store.Create(Valid(date: date, startHour: 18, hours: 2));

        var next = store.Create(Valid(date: date, startHour: 20, hours: 2));

        Assert.Equal(20, next.StartHour);
    }

    [Fact]
    public void Отменённая_бронь_не_мешает_новой()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(9);
        var first = store.Create(Valid(date: date, startHour: 18, hours: 2));
        store.UpdateStatus(first.Id, "cancelled");

        var second = store.Create(Valid(date: date, startHour: 18, hours: 2));

        Assert.Equal(18, second.StartHour);
    }

    [Fact]
    public void Превышение_вместимости_зала_отклоняется()
    {
        var store = NewStore();

        var error = Assert.Throws<DomainException>(
            () => store.Create(Valid(roomId: "room-small", guests: 20)));

        Assert.Equal(400, error.Status);
        Assert.Contains("guests", error.Errors!.Keys);
    }

    [Theory]
    [InlineData(11, 2)]   // раньше открытия
    [InlineData(23, 3)]   // выходит за закрытие
    [InlineData(20, 9)]   // больше максимальной длительности
    public void Некорректное_время_отклоняется(int startHour, int hours)
    {
        var store = NewStore();

        var error = Assert.Throws<DomainException>(() => store.Create(Valid(startHour: startHour, hours: hours)));

        Assert.Equal(400, error.Status);
    }

    [Fact]
    public void Прошедшая_дата_отклоняется()
    {
        var store = NewStore();

        var error = Assert.Throws<DomainException>(
            () => store.Create(Valid(date: BookingStore.IsoDate(-1))));

        Assert.Contains("date", error.Errors!.Keys);
    }

    [Fact]
    public void Короткий_телефон_отклоняется()
    {
        var store = NewStore();

        var error = Assert.Throws<DomainException>(() => store.Create(Valid(phone: "123")));

        Assert.Contains("phone", error.Errors!.Keys);
    }

    [Fact]
    public void Неизвестный_статус_отклоняется()
    {
        var store = NewStore();
        var booking = store.Create(Valid());

        var error = Assert.Throws<DomainException>(() => store.UpdateStatus(booking.Id, "в отпуске"));

        Assert.Equal(400, error.Status);
    }

    [Fact]
    public void Удаление_несуществующей_брони_даёт_404()
    {
        var store = NewStore();

        var error = Assert.Throws<DomainException>(() => store.Delete("нет-такой"));

        Assert.Equal(404, error.Status);
    }

    [Fact]
    public void Слоты_покрывают_всю_смену()
    {
        var store = NewStore();
        var availability = store.GetAvailability(BookingStore.IsoDate());

        Assert.All(availability.Rooms, room =>
            Assert.Equal(Constants.CloseHour - Constants.OpenHour, room.Slots.Length));
    }

    [Fact]
    public void Занятый_час_помечается_в_слотах()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(11);
        store.Create(Valid(date: date, startHour: 16, hours: 2));

        var room = store.GetAvailability(date).Rooms.Single(r => r.Room.Id == "room-small");
        var booked = room.Slots.Where(s => s.Status == "booked").Select(s => s.Hour).ToArray();

        Assert.Equal(new[] { 16, 17 }, booked);
        Assert.Equal(2, room.BookedHours);
    }

    [Fact]
    public void Статистика_считает_выручку_и_загрузку()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(12);
        store.Create(Valid(date: date, startHour: 14, hours: 2));

        var stats = store.GetStats(date);

        Assert.Equal(1, stats.BookingsTotal);
        Assert.Equal(2, stats.HoursBooked);
        Assert.Equal(3000m, stats.Revenue);
        Assert.Equal("room-small", stats.TopRoom!.Id);
    }

    [Fact]
    public void Фильтр_по_статусу_работает()
    {
        var store = NewStore();
        var date = BookingStore.IsoDate(13);
        var booking = store.Create(Valid(date: date));
        store.Create(Valid(date: date, startHour: 20));
        store.UpdateStatus(booking.Id, "confirmed");

        var confirmed = store.ListBookings(date, "confirmed", null);

        Assert.Single(confirmed);
        Assert.Equal(booking.Id, confirmed[0].Id);
    }
}
