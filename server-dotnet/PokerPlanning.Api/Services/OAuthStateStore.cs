using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace PokerPlanning.Api.Services;

public sealed class OAuthStartState
{
    public required string FirebaseUid { get; init; }
    public required string ReturnUrl { get; init; }
    public required long CreatedAtMs { get; init; }
}

/// <summary>In-memory OAuth state (replace with Redis for multi-instance).</summary>
public sealed class OAuthStateStore
{
    private static readonly ConcurrentDictionary<string, OAuthStartState> Store = new();
    private const int TtlMs = 15 * 60 * 1000;

    private static void Sweep()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var kv in Store)
        {
            if (now - kv.Value.CreatedAtMs > TtlMs)
            {
                Store.TryRemove(kv.Key, out _);
            }
        }
    }

    public string Create(string firebaseUid, string returnUrl)
    {
        Sweep();
        var id = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var state = new OAuthStartState
        {
            FirebaseUid = firebaseUid,
            ReturnUrl = returnUrl,
            CreatedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        Store[id] = state;
        return id;
    }

    public OAuthStartState? Consume(string id)
    {
        Sweep();
        if (!Store.TryRemove(id, out var v))
        {
            return null;
        }

        if (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - v.CreatedAtMs > TtlMs)
        {
            return null;
        }

        return v;
    }
}
