using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using PokerPlanning.Api.Configuration;

namespace PokerPlanning.Api.Services;

/// <summary>Firebase Auth token verification + Firestore story update (matches Node firebaseAdmin.ts).</summary>
public sealed class FirebaseFirestoreService
{
    private readonly IConfiguration _config;
    private FirestoreDb? _db;
    private bool _initFailed;

    public FirebaseFirestoreService(IConfiguration config)
    {
        _config = config;
    }

    private FirestoreDb? GetDb()
    {
        if (_db != null)
        {
            return _db;
        }

        if (_initFailed)
        {
            return null;
        }

        var json = FirebaseServiceAccountJson.Resolve(_config);
        if (string.IsNullOrEmpty(json))
        {
            _initFailed = true;
            return null;
        }

        try
        {
            var credential = GoogleCredential.FromJson(json);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var projectId = doc.RootElement.GetProperty("project_id").GetString() ?? "";
            _db = new FirestoreDbBuilder
            {
                ProjectId = projectId,
                Credential = credential,
            }.Build();
            return _db;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Firestore init failed: " + ex);
            _initFailed = true;
            return null;
        }
    }

    public async Task<bool> MarkStoryJiraSyncedAsync(string sessionId, string storyId, CancellationToken ct = default)
    {
        var db = GetDb();
        if (db == null)
        {
            return false;
        }

        var path = $"planning_poker_sessions/{sessionId}/stories/{storyId}";
        var doc = db.Document(path);
        await doc.UpdateAsync(
            new Dictionary<string, object>
            {
                { "jiraSyncedAt", FieldValue.ServerTimestamp },
                { "updatedAt", FieldValue.ServerTimestamp },
            },
            cancellationToken: ct);
        return true;
    }
}
