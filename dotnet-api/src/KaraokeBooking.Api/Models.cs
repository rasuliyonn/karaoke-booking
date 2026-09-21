namespace KaraokeBooking.Api;

/// <summary>
/// Контракт API. Те же поля отдаёт serverless-версия на Node.js (api/_lib/types.ts) —
/// при изменении править обе реализации.
/// </summary>
public static class Constants
{
    public const int OpenHour = 12;
    public const int CloseHour = 24;
    public const int MaxHours = 4;

    public static readonly string[] ValidStatuses =
        ["pending", "confirmed", "cancelled", "completed"];
}

public sealed record Room(
    string Id,
    string Name,
    int Capacity,
    decimal PricePerHour,
    string[] Features,
    string Description);

public sealed record Booking(
    string Id,
    string RoomId,
    string Date,
    int StartHour,
    int Hours,
    string GuestName,
    string Phone,
    int Guests,
    string Status,
    string Note,
    decimal TotalPrice,
    DateTimeOffset CreatedAt);

public sealed record Slot(int Hour, string Status, string? BookingId, string? GuestName);

public sealed record RoomAvailability(
    Room Room,
    Slot[] Slots,
    int BookedHours,
    int LoadPercent);

public sealed record AvailabilityResponse(
    string Date,
    int OpenHour,
    int CloseHour,
    RoomAvailability[] Rooms);

public sealed record TopRoom(string Id, string Name, int Hours);

public sealed record StatsResponse(
    string Date,
    int BookingsTotal,
    int BookingsConfirmed,
    int BookingsPending,
    int HoursBooked,
    decimal Revenue,
    int LoadPercent,
    TopRoom? TopRoom);

public sealed record CreateBookingRequest(
    string? RoomId,
    string? Date,
    int? StartHour,
    int? Hours,
    string? GuestName,
    string? Phone,
    int? Guests,
    string? Note);

public sealed record UpdateStatusRequest(string? Status);

/// <summary>Ошибка предметной области с HTTP-статусом и разбивкой по полям.</summary>
public sealed class DomainException : Exception
{
    public int Status { get; }
    public Dictionary<string, string>? Errors { get; }

    public DomainException(int status, string message, Dictionary<string, string>? errors = null)
        : base(message)
    {
        Status = status;
        Errors = errors;
    }
}
