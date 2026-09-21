# Сборка и запуск ASP.NET Core API.
# Контекст сборки — папка dotnet-api/.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Сначала только csproj — чтобы restore кешировался отдельным слоем.
COPY src/KaraokeBooking.Api/KaraokeBooking.Api.csproj src/KaraokeBooking.Api/
RUN dotnet restore src/KaraokeBooking.Api/KaraokeBooking.Api.csproj

COPY src/ src/
RUN dotnet publish src/KaraokeBooking.Api/KaraokeBooking.Api.csproj \
        -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0

EXPOSE 8080
ENTRYPOINT ["dotnet", "KaraokeBooking.Api.dll"]
