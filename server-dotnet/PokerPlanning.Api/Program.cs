using Microsoft.EntityFrameworkCore;
using PokerPlanning.Api.Data;
using PokerPlanning.Api.Filters;
using PokerPlanning.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();

var corsOrigin = builder.Configuration["CorsOrigin"]?.Trim() ?? "*";
builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "api",
        policy =>
        {
            if (corsOrigin == "*")
            {
                policy.SetIsOriginAllowed(_ => true)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
            else
            {
                var origins = corsOrigin.Split(',')
                    .Select(s => s.Trim().TrimEnd('/'))
                    .Where(s => s.Length > 0)
                    .ToArray();
                policy.WithOrigins(origins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
        });
});

var conn = builder.Configuration.GetConnectionString("Default") ?? "Data Source=./data/app.db";
if (conn.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
{
    var rel = conn["Data Source=".Length..].Trim();
    if (!Path.IsPathRooted(rel))
    {
        rel = Path.Combine(builder.Environment.ContentRootPath, rel);
        var dir = Path.GetDirectoryName(rel);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        conn = $"Data Source={rel}";
    }
}

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(conn));

builder.Services.AddSingleton<OAuthStateStore>();
builder.Services.AddSingleton<CryptoService>();
builder.Services.AddSingleton<FirebaseAuthService>();
builder.Services.AddSingleton<FirebaseFirestoreService>();
builder.Services.AddScoped<JiraUserTokenService>();
builder.Services.AddScoped<JiraRestService>();
builder.Services.AddScoped<SyncEstimateService>();
builder.Services.AddScoped<FirebaseAuthFilter>();

var portEnv = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(portEnv) && int.TryParse(portEnv, out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseRouting();
app.UseCors("api");
app.MapControllers();

var corsLog = corsOrigin == "*" ? "* (reflect)" : corsOrigin;
Console.WriteLine($"poker-planning-api CORS: {corsLog}");

app.Run();
