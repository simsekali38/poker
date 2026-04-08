using System.Text;
using System.Text.Json;
using PokerPlanning.Api.Models;

namespace PokerPlanning.Api.Services;

public sealed class JiraRestService
{
    private readonly JiraUserTokenService _tokens;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    public JiraRestService(JiraUserTokenService tokens, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _tokens = tokens;
        _httpFactory = httpFactory;
        _config = config;
    }

    public async Task<JiraIssueDto> GetIssueForUserAsync(
        string firebaseUid,
        string issueKey,
        string siteUrl,
        CancellationToken ct = default)
    {
        var (_, issue) = await GetIssueWithCloudIdAsync(firebaseUid, issueKey, siteUrl, ct);
        return issue;
    }

    public async Task<(string CloudId, JiraIssueDto Issue)> GetIssueWithCloudIdAsync(
        string firebaseUid,
        string issueKey,
        string siteUrl,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var http = _httpFactory.CreateClient();
        var resources = await JiraSiteService.FetchAccessibleResourcesAsync(http, access, ct);
        var cloudId = JiraSiteService.ResolveCloudId(resources, siteUrl);
        var issue = await FetchIssueByCloudIdAsync(http, access, cloudId, issueKey, ct);
        return (cloudId, issue);
    }

    private static async Task<JiraIssueDto> FetchIssueByCloudIdAsync(
        HttpClient http,
        string accessToken,
        string cloudId,
        string issueKey,
        CancellationToken ct)
    {
        var fields = "summary,description,status,assignee";
        var url =
            $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{Uri.EscapeDataString(issueKey)}?fields={fields}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        req.Headers.Accept.ParseAdd("application/json");
        var res = await http.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Jira issue fetch failed: {(int)res.StatusCode} {text}");
        }

        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement;
        var id = root.GetProperty("id").GetString() ?? "";
        var key = root.GetProperty("key").GetString() ?? "";
        var fieldsEl = root.GetProperty("fields");
        var summary = fieldsEl.GetProperty("summary").GetString() ?? "";
        var desc = fieldsEl.GetProperty("description");
        string? plain = desc.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.String => desc.GetString(),
            _ => AdfToPlain(desc),
        };
        var statusEl = fieldsEl.GetProperty("status");
        var status = new JiraStatusDto(
            statusEl.GetProperty("id").GetString() ?? "",
            statusEl.GetProperty("name").GetString() ?? "",
            statusEl.TryGetProperty("statusCategory", out var sc) && sc.TryGetProperty("name", out var scn)
                ? scn.GetString()
                : null);
        JiraAssigneeDto? assignee = null;
        if (fieldsEl.TryGetProperty("assignee", out var asg) && asg.ValueKind != JsonValueKind.Null)
        {
            var aid = asg.GetProperty("accountId").GetString() ?? "";
            assignee = new JiraAssigneeDto(
                aid,
                asg.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? aid : aid,
                asg.TryGetProperty("emailAddress", out var em) ? em.GetString() : null);
        }

        return new JiraIssueDto(key, id, summary, plain, status, assignee);
    }

    private static string? AdfToPlain(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (node.ValueKind == JsonValueKind.String)
        {
            return node.GetString();
        }

        if (node.ValueKind == JsonValueKind.Object && node.TryGetProperty("type", out var t))
        {
            var type = t.GetString();
            if (type == "doc" && node.TryGetProperty("content", out var c) && c.ValueKind == JsonValueKind.Array)
            {
                return string.Join(
                    "\n",
                    c.EnumerateArray().Select(AdfToPlain).Where(x => !string.IsNullOrEmpty(x)));
            }

            if (type == "paragraph" && node.TryGetProperty("content", out var pc) &&
                pc.ValueKind == JsonValueKind.Array)
            {
                return string.Join("", pc.EnumerateArray().Select(AdfToPlain));
            }

            if (type == "text" && node.TryGetProperty("text", out var tx))
            {
                return tx.GetString();
            }

            if (node.TryGetProperty("content", out var inner) && inner.ValueKind == JsonValueKind.Array)
            {
                return string.Join("", inner.EnumerateArray().Select(AdfToPlain));
            }
        }

        return node.ToString();
    }

    public async Task PutBoardEstimationAsync(
        string firebaseUid,
        string cloudId,
        string issueId,
        string boardId,
        string valueStr,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var http = _httpFactory.CreateClient();
        var url =
            $"https://api.atlassian.com/ex/jira/{cloudId}/rest/agile/1.0/issue/{issueId}/estimation?boardId={Uri.EscapeDataString(boardId)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        req.Content = new StringContent(
            JsonSerializer.Serialize(new { value = valueStr }),
            Encoding.UTF8,
            "application/json");
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode && res.StatusCode != System.Net.HttpStatusCode.NoContent)
        {
            var t = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Board estimation failed: {(int)res.StatusCode} {t}");
        }
    }

    public async Task PutStoryPointsFieldAsync(
        string firebaseUid,
        string cloudId,
        string issueId,
        double points,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var fieldId = _config["JiraStoryPointsFieldId"] ?? "customfield_10016";
        var http = _httpFactory.CreateClient();
        var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueId}";
        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["fields"] = new Dictionary<string, object> { [fieldId] = points },
        });
        using var req = new HttpRequestMessage(HttpMethod.Put, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var t = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"Story points update failed: {(int)res.StatusCode} {t}");
        }
    }

    public async Task<JsonElement?> GetIssuePropertyAsync(
        string firebaseUid,
        string cloudId,
        string issueId,
        string propertyKey,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var http = _httpFactory.CreateClient();
        var url =
            $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueId}/properties/{Uri.EscapeDataString(propertyKey)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        req.Headers.Accept.ParseAdd("application/json");
        var res = await http.SendAsync(req, ct);
        if (res.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!res.IsSuccessStatusCode)
        {
            var t = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"get property failed: {(int)res.StatusCode} {t}");
        }

        var text = await res.Content.ReadAsStringAsync(ct);
        return JsonSerializer.Deserialize<JsonElement>(text);
    }

    public async Task PutIssuePropertyAsync(
        string firebaseUid,
        string cloudId,
        string issueId,
        string propertyKey,
        JsonElement value,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var http = _httpFactory.CreateClient();
        var url =
            $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueId}/properties/{Uri.EscapeDataString(propertyKey)}";
        using var req = new HttpRequestMessage(HttpMethod.Put, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        req.Content = new StringContent(value.GetRawText(), Encoding.UTF8, "application/json");
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var t = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"put property failed: {(int)res.StatusCode} {t}");
        }
    }

    public async Task PostIssueCommentAsync(
        string firebaseUid,
        string cloudId,
        string issueId,
        string plainText,
        CancellationToken ct = default)
    {
        var access = await _tokens.GetValidAccessTokenAsync(firebaseUid, ct);
        var http = _httpFactory.CreateClient();
        var url = $"https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueId}/comment";
        var body = JsonSerializer.Serialize(new
        {
            body = new
            {
                type = "doc",
                version = 1,
                content = new[]
                {
                    new
                    {
                        type = "paragraph",
                        content = new[] { new { type = "text", text = plainText } },
                    },
                },
            },
        });
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var t = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"comment failed: {(int)res.StatusCode} {t}");
        }
    }

}
