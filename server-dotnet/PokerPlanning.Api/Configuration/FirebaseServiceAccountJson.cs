using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace PokerPlanning.Api.Configuration;

/// <summary>
/// Supports either a JSON string in <c>FirebaseServiceAccountJson</c> or a nested object in appsettings
/// (ASP.NET does not bind a scalar string when the value is a JSON object — that case returned null and caused 503).
/// </summary>
public static class FirebaseServiceAccountJson
{
    public static string? Resolve(IConfiguration config)
    {
        var direct = config["FirebaseServiceAccountJson"]?.Trim();
        if (!string.IsNullOrEmpty(direct) && direct.StartsWith('{'))
        {
            return direct;
        }

        var section = config.GetSection("FirebaseServiceAccountJson");
        if (!section.Exists())
        {
            return null;
        }

        var children = section.GetChildren().ToList();
        if (children.Count == 0)
        {
            return null;
        }

        var dict = new Dictionary<string, string>();
        foreach (var child in children)
        {
            dict[child.Key] = child.Value ?? "";
        }

        return JsonSerializer.Serialize(dict);
    }
}
