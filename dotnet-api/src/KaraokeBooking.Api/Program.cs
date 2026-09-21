using KaraokeBooking.Api;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<BookingStore>();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var feature = context.Features.Get<IExceptionHandlerFeature>();
    var error = feature?.Error;
    context.Response.ContentType = "application/json; charset=utf-8";

    if (error is DomainException domain)
    {
        context.Response.StatusCode = domain.Status;
        await context.Response.WriteAsJsonAsync(new { error = domain.Message, details = domain.Errors });
        return;
    }

    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new
    {
        error = error?.Message ?? "Внутренняя ошибка",
        details = (object?)null,
    });
}));

app.UseCors();

app.MapGet("/api/health", () => Results.Ok(new { ok = true, service = "karaoke-booking-api" }));

app.MapGet("/api/rooms", (BookingStore store) => Results.Ok(store.ListRooms()));

app.MapGet("/api/availability", (BookingStore store, string? date) =>
    Results.Ok(store.GetAvailability(date ?? BookingStore.IsoDate())));

app.MapGet("/api/stats", (BookingStore store, string? date) =>
    Results.Ok(store.GetStats(date ?? BookingStore.IsoDate())));

app.MapGet("/api/bookings", (BookingStore store, string? date, string? status, string? roomId) =>
    Results.Ok(store.ListBookings(date, status, roomId)));

app.MapPost("/api/bookings", (BookingStore store, CreateBookingRequest request) =>
{
    var created = store.Create(request);
    return Results.Created($"/api/bookings/{created.Id}", created);
});

app.MapPatch("/api/bookings/{id}", (BookingStore store, string id, UpdateStatusRequest request) =>
    Results.Ok(store.UpdateStatus(id, request.Status)));

app.MapDelete("/api/bookings/{id}", (BookingStore store, string id) =>
{
    store.Delete(id);
    return Results.Ok(new { ok = true });
});

app.Run();

/// <summary>Нужен для интеграционных тестов через WebApplicationFactory.</summary>
public partial class Program;
