namespace PokerPlanning.Api.Services;

public sealed record AccessibleResource(string Id, string Url, string Name);

public static class JiraSiteService
{
    public static async Task<IReadOnlyList<AccessibleResource>> FetchAccessibleResourcesAsync(
        HttpClient http,
        string accessToken,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(
            HttpMethod.Get,
            "https://api.atlassian.com/oauth/token/accessible-resources");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"accessible-resources failed: {(int)res.StatusCode} {body}");
        }

        using var doc = System.Text.Json.JsonDocument.Parse(body);
        var list = new List<AccessibleResource>();
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetString() ?? "";
            var url = el.GetProperty("url").GetString() ?? "";
            var name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            list.Add(new AccessibleResource(id, url, name));
        }

        return list;
    }

    public static string ResolveCloudId(IReadOnlyList<AccessibleResource> resources, string siteUrl)
    {
        Uri siteUri;
        try
        {
            siteUri = new Uri(siteUrl);
        }
        catch
        {
            throw new InvalidOperationException("Invalid jiraSiteUrl");
        }

        var originStr = siteUri.GetLeftPart(UriPartial.Authority);
        foreach (var r in resources)
        {
            try
            {
                if (new Uri(r.Url).GetLeftPart(UriPartial.Authority) == originStr)
                {
                    return r.Id;
                }
            }
            catch
            {
                // ignore
            }
        }

        if (resources.Count == 1)
        {
            return resources[0].Id;
        }

        throw new InvalidOperationException(
            "Could not match jiraSiteUrl to an Atlassian Cloud site for this account.");
    }

    public static string? PickDefaultSiteUrl(IReadOnlyList<AccessibleResource> resources) =>
        resources.Count == 0 ? null : resources[0].Url;
}
