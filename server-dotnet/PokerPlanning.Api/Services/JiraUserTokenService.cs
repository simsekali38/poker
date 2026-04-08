using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PokerPlanning.Api.Data;
using PokerPlanning.Api.Data.Entities;

namespace PokerPlanning.Api.Services;

public sealed class JiraUserTokenService
{
    private static readonly TimeSpan RefreshWindow = TimeSpan.FromMinutes(5);

    private readonly AppDbContext _db;
    private readonly CryptoService _crypto;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public JiraUserTokenService(
        AppDbContext db,
        CryptoService crypto,
        IConfiguration config,
        IHttpClientFactory httpFactory)
    {
        _db = db;
        _crypto = crypto;
        _config = config;
        _httpFactory = httpFactory;
    }

    public async Task SaveTokensAsync(
        string firebaseUid,
        string accessToken,
        string? refreshToken,
        int expiresInSec,
        string? atlassianAccountId,
        CancellationToken ct = default)
    {
        var expiresAt = DateTime.UtcNow.AddSeconds(expiresInSec);
        var existing = await _db.JiraUserTokens.FirstOrDefaultAsync(x => x.FirebaseUid == firebaseUid, ct);
        if (existing == null)
        {
            _db.JiraUserTokens.Add(new JiraUserToken
            {
                Id = Guid.NewGuid().ToString("n"),
                FirebaseUid = firebaseUid,
                AtlassianAccountId = atlassianAccountId,
                AccessTokenEnc = _crypto.Encrypt(accessToken),
                RefreshTokenEnc = refreshToken != null ? _crypto.Encrypt(refreshToken) : null,
                ExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.AtlassianAccountId = atlassianAccountId ?? existing.AtlassianAccountId;
            existing.AccessTokenEnc = _crypto.Encrypt(accessToken);
            if (refreshToken != null)
            {
                existing.RefreshTokenEnc = _crypto.Encrypt(refreshToken);
            }

            existing.ExpiresAt = expiresAt;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<string> GetValidAccessTokenAsync(string firebaseUid, CancellationToken ct = default)
    {
        var row = await _db.JiraUserTokens.FirstOrDefaultAsync(x => x.FirebaseUid == firebaseUid, ct);
        if (row == null)
        {
            throw new InvalidOperationException("Jira is not connected for this user. Use Connect Jira first.");
        }

        var accessToken = _crypto.Decrypt(row.AccessTokenEnc);
        if (row.ExpiresAt - DateTime.UtcNow > RefreshWindow)
        {
            return accessToken;
        }

        if (string.IsNullOrEmpty(row.RefreshTokenEnc))
        {
            throw new InvalidOperationException(
                "Access token expired and no refresh token is stored. Reconnect Jira.");
        }

        var refreshToken = _crypto.Decrypt(row.RefreshTokenEnc);
        var tr = await RefreshAccessTokenAsync(refreshToken, ct);
        var newAccess = tr.GetProperty("access_token").GetString() ?? "";
        var newRefresh = tr.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : refreshToken;
        var expSec = tr.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        await SaveTokensAsync(firebaseUid, newAccess, newRefresh, expSec, row.AtlassianAccountId, ct);
        return newAccess;
    }

    public async Task<JsonElement> ExchangeAuthorizationCodeAsync(string code, CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient();
        var body = new
        {
            grant_type = "authorization_code",
            client_id = _config["Atlassian:ClientId"],
            client_secret = _config["Atlassian:ClientSecret"],
            code,
            redirect_uri = _config["Atlassian:OAuthRedirectUri"],
        };
        var res = await http.PostAsync(
            "https://auth.atlassian.com/oauth/token",
            new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
            ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Code exchange failed: {(int)res.StatusCode} {text}");
        }

        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    private async Task<JsonElement> RefreshAccessTokenAsync(string refreshToken, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        var body = new
        {
            grant_type = "refresh_token",
            client_id = _config["Atlassian:ClientId"],
            client_secret = _config["Atlassian:ClientSecret"],
            refresh_token = refreshToken,
        };
        var res = await http.PostAsync(
            "https://auth.atlassian.com/oauth/token",
            new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
            ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Token refresh failed: {(int)res.StatusCode} {text}");
        }

        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }
}
