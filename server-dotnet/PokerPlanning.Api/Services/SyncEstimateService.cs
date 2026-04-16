using System.Text.Json;
using System.Text.Json.Nodes;
using PokerPlanning.Api.Models;

namespace PokerPlanning.Api.Services;

public sealed record SyncVoteLine(string MemberId, string DisplayName, string Card);

public sealed record SyncParticipantLine(string MemberId, string DisplayName);

public sealed record SyncEstimateInput(
    string SessionId,
    string StoryId,
    string StoryTitle,
    string JiraIssueKey,
    string JiraSiteUrl,
    string? JiraBoardId,
    int? SprintId,
    string Estimate,
    string Method,
    bool? IncludeComment,
    IReadOnlyList<SyncVoteLine> Votes,
    IReadOnlyList<SyncParticipantLine> Participants);

public sealed class SyncEstimateService
{
    private readonly JiraRestService _jira;
    private readonly FirebaseFirestoreService _firestore;
    private readonly IConfiguration _config;
    private const string AuditKey = "planningPokerAudit";
    private const int MaxAuditEntries = 40;

    public SyncEstimateService(JiraRestService jira, FirebaseFirestoreService firestore, IConfiguration config)
    {
        _jira = jira;
        _firestore = firestore;
        _config = config;
    }

    public async Task<bool> SyncAsync(string firebaseUid, SyncEstimateInput input, CancellationToken ct)
    {
        var (cloudId, issue) = await _jira.GetIssueWithCloudIdAsync(
            firebaseUid,
            input.JiraIssueKey,
            input.JiraSiteUrl,
            ct);
        var issueId = issue.IssueId;

        var (numeric, label) = MapCardToStoryPoints(input.Estimate);
        var boardId = string.IsNullOrWhiteSpace(input.JiraBoardId)
            ? _config["JiraDefaultBoardId"]?.Trim()
            : input.JiraBoardId.Trim();

        if (numeric != null)
        {
            await _jira.PutStoryPointsFieldAsync(firebaseUid, cloudId, issueId, numeric.Value, ct);
            if (_config["JiraUseBoardEstimation"] == "true" && !string.IsNullOrEmpty(boardId))
            {
                try
                {
                    await _jira.PutBoardEstimationAsync(
                        firebaseUid,
                        cloudId,
                        issueId,
                        boardId!,
                        numeric.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        ct);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Optional board estimation failed: " + ex.Message);
                }
            }
        }

        if (input.SprintId is int sid && sid > 0)
        {
            await _jira.AddIssuesToSprintAsync(
                firebaseUid,
                cloudId,
                sid,
                new[] { input.JiraIssueKey },
                ct);
        }

        if (_config["JiraIncludeAuditProperty"] == "true")
        {
            var raw = await _jira.GetIssuePropertyAsync(firebaseUid, cloudId, issueId, AuditKey, ct);
            JsonElement? prevValue = null;
            if (raw != null)
            {
                var el = raw.Value;
                if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty("value", out var v))
                {
                    prevValue = v;
                }
                else
                {
                    prevValue = el;
                }
            }

            var entries = new List<JsonElement>();
            if (prevValue != null && prevValue.Value.ValueKind == JsonValueKind.Object &&
                prevValue.Value.TryGetProperty("entries", out var entArr) && entArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var e in entArr.EnumerateArray())
                {
                    entries.Add(e);
                }
            }

            var entryEl = JsonSerializer.SerializeToElement(
                new
                {
                    sessionId = input.SessionId,
                    storyId = input.StoryId,
                    storyTitle = input.StoryTitle,
                    timestamp = DateTime.UtcNow.ToString("o"),
                    votes = input.Votes.Select(v => new { memberId = v.MemberId, displayName = v.DisplayName, card = v.Card }),
                    participants = input.Participants.Select(p => new { memberId = p.MemberId, displayName = p.DisplayName }),
                    finalEstimate = new { card = input.Estimate, label, method = input.Method, numeric },
                });
            entries.Add(entryEl);
            if (entries.Count > MaxAuditEntries)
            {
                entries = entries.Skip(entries.Count - MaxAuditEntries).ToList();
            }

            var arr = new JsonArray();
            foreach (var e in entries)
            {
                arr.Add(JsonNode.Parse(e.GetRawText()));
            }

            var auditObj = new JsonObject { ["version"] = 1, ["entries"] = arr };
            var auditDoc = JsonSerializer.Deserialize<JsonElement>(auditObj.ToJsonString());
            await _jira.PutIssuePropertyAsync(firebaseUid, cloudId, issueId, AuditKey, auditDoc, ct);
        }

        if (input.IncludeComment == true)
        {
            await _jira.PostIssueCommentAsync(firebaseUid, cloudId, issueId, BuildCommentText(input), ct);
        }

        return await _firestore.MarkStoryJiraSyncedAsync(input.SessionId, input.StoryId, ct);
    }

    private static (double? Numeric, string Label) MapCardToStoryPoints(string estimate)
    {
        var label = estimate.Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(label, @"^\d+(\.\d+)?$"))
        {
            return (double.Parse(label, System.Globalization.CultureInfo.InvariantCulture), label);
        }

        var tshirt = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
        {
            ["xs"] = 1,
            ["s"] = 2,
            ["m"] = 3,
            ["l"] = 5,
            ["xl"] = 8,
        };
        if (tshirt.TryGetValue(label.ToLowerInvariant(), out var n))
        {
            return (n, label);
        }

        return (null, label);
    }

    private static string BuildCommentText(SyncEstimateInput input)
    {
        var lines = new List<string>
        {
            "[Planning poker]",
            $"Session: {input.SessionId}",
            $"Story: {input.StoryTitle} ({input.StoryId})",
            $"Final estimate: {input.Estimate} ({input.Method})",
            $"Time: {DateTime.UtcNow:o}",
            "",
            "Votes (revealed):",
        };
        lines.AddRange(input.Votes.Select(v => $"• {v.DisplayName}: {v.Card}"));
        return string.Join("\n", lines);
    }
}
