using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using PokerPlanning.Api.Configuration;

namespace PokerPlanning.Api.Services;

public sealed class FirebaseAuthService
{
    public FirebaseAuthService(IConfiguration config)
    {
        var json = FirebaseServiceAccountJson.Resolve(config);
        if (string.IsNullOrEmpty(json) || FirebaseApp.DefaultInstance != null)
        {
            return;
        }

        try
        {
            FirebaseApp.Create(new AppOptions { Credential = GoogleCredential.FromJson(json) });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Firebase Admin init failed: " + ex);
        }
    }

    /// <summary>null = not configured, empty = invalid token, else uid.</summary>
    public async Task<string?> VerifyIdTokenAsync(string idToken, CancellationToken ct = default)
    {
        if (FirebaseApp.DefaultInstance == null)
        {
            return null;
        }

        try
        {
            var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(idToken, ct);
            return decoded.Uid;
        }
        catch
        {
            return "";
        }
    }
}
