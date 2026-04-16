using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using PokerPlanning.Api.Filters;
using PokerPlanning.Api.Services;

namespace PokerPlanning.Api.Controllers;

[ApiController]
[Route("api/jira")]
public sealed class JiraController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly OAuthStateStore _oauthState;
    private readonly JiraUserTokenService _tokens;
    private readonly JiraRestService _jira;
    private readonly SyncEstimateService _sync;
    private readonly IHttpClientFactory _httpFactory;

    public JiraController(
        IConfiguration config,
        OAuthStateStore oauthState,
        JiraUserTokenService tokens,
        JiraRestService jira,
        SyncEstimateService sync,
        IHttpClientFactory httpFactory)
    {
        _config = config;
        _oauthState = oauthState;
        _tokens = tokens;
        _jira = jira;
        _sync = sync;
        _httpFactory = httpFactory;
    }

    public sealed record OAuthStartDto(string ReturnUrl);

    [HttpPost("oauth/start")]
    [ServiceFilter(typeof(FirebaseAuthFilter))]
    public IActionResult OAuthStart([FromBody] OAuthStartDto? body)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.ReturnUrl) || !Uri.TryCreate(body.ReturnUrl, UriKind.Absolute, out _))
        {
            return BadRequest(new { error = "Invalid body", details = "returnUrl must be a valid absolute URL" });
        }

        var uid = HttpContext.RequireUid();
        var state = _oauthState.Create(uid, body.ReturnUrl);
        var scopes = Uri.EscapeDataString(
            (_config["Atlassian:Scopes"] ?? "").Replace("\t", " ").Trim());
        var redirect = Uri.EscapeDataString(_config["Atlassian:OAuthRedirectUri"] ?? "");
        var clientId = Uri.EscapeDataString(_config["Atlassian:ClientId"] ?? "");
        var authorizeUrl =
            $"https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id={clientId}" +
            $"&scope={scopes}&redirect_uri={redirect}&response_type=code&prompt=consent&state={Uri.EscapeDataString(state)}";
        return Ok(new { redirectUrl = authorizeUrl });
    }

    [HttpGet("oauth/callback")]
    public async Task<IActionResult> OAuthCallback(
        [FromQuery(Name = "error")] string? oauthError,
        [FromQuery] string? code,
        [FromQuery] string? state,
        CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(oauthError) && !string.IsNullOrEmpty(state))
        {
            var stDenied = _oauthState.Consume(state);
            if (stDenied != null)
            {
                return RedirectWithJiraError(stDenied.ReturnUrl, oauthError);
            }
        }

        if (!string.IsNullOrEmpty(oauthError) && string.IsNullOrEmpty(state))
        {
            return TextPlain(oauthError, StatusCodes.Status400BadRequest);
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
        {
            return TextPlain("Missing code or state", StatusCodes.Status400BadRequest);
        }

        var st = _oauthState.Consume(state);
        if (st == null)
        {
            return TextPlain("Invalid or expired OAuth state", StatusCodes.Status400BadRequest);
        }

        try
        {
            var tr = await _tokens.ExchangeAuthorizationCodeAsync(code, ct);
            var access = tr.GetProperty("access_token").GetString() ?? "";
            var refresh = tr.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
            var expSec = tr.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;

            string? atlassianAccountId = null;
            try
            {
                var http = _httpFactory.CreateClient();
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.atlassian.com/me");
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
                var me = await http.SendAsync(req, ct);
                if (me.IsSuccessStatusCode)
                {
                    await using var stream = await me.Content.ReadAsStreamAsync(ct);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    if (doc.RootElement.TryGetProperty("account_id", out var aid))
                    {
                        atlassianAccountId = aid.GetString();
                    }
                }
            }
            catch
            {
                // optional
            }

            await _tokens.SaveTokensAsync(st.FirebaseUid, access, refresh, expSec, atlassianAccountId, ct);

            var http2 = _httpFactory.CreateClient();
            var resources = await JiraSiteService.FetchAccessibleResourcesAsync(http2, access, ct);
            var site = JiraSiteService.PickDefaultSiteUrl(resources);

            var qb = new Dictionary<string, string?> { ["jira_connected"] = "1" };
            if (!string.IsNullOrEmpty(site))
            {
                qb["jira_site"] = site;
            }

            var redirect = QueryHelpers.AddQueryString(st.ReturnUrl, qb!);
            return Redirect(redirect);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            var msg = ex.Message;
            if (msg.Length > 400)
            {
                msg = msg[..400];
            }

            return RedirectWithJiraError(st.ReturnUrl, msg);
        }
    }

    private static RedirectResult RedirectWithJiraError(string returnUrl, string errorCode)
    {
        var url = QueryHelpers.AddQueryString(
            returnUrl,
            new Dictionary<string, string?> { ["jira_error"] = errorCode });
        return new RedirectResult(url);
    }

    private static ContentResult TextPlain(string body, int statusCode) =>
        new()
        {
            Content = body,
            ContentType = "text/plain; charset=utf-8",
            StatusCode = statusCode,
        };

    [HttpGet("issues/{issueKey}")]
    [ServiceFilter(typeof(FirebaseAuthFilter))]
    public async Task<IActionResult> GetIssue([FromRoute] string issueKey, [FromQuery] string? siteUrl, CancellationToken ct)
    {
        issueKey = issueKey.Trim();
        siteUrl = siteUrl?.Trim() ?? "";
        if (string.IsNullOrEmpty(issueKey) || string.IsNullOrEmpty(siteUrl))
        {
            return BadRequest(new { error = "issueKey and siteUrl query are required" });
        }

        var uid = HttpContext.RequireUid();
        try
        {
            var issue = await _jira.GetIssueForUserAsync(uid, issueKey, siteUrl, ct);
            return Ok(new
            {
                issueKey = issue.IssueKey,
                issueId = issue.IssueId,
                summary = issue.Summary,
                description = issue.Description,
                status = new { id = issue.Status.Id, name = issue.Status.Name, category = issue.Status.Category },
                assignee = issue.Assignee == null
                    ? null
                    : new
                    {
                        accountId = issue.Assignee.AccountId,
                        displayName = issue.Assignee.DisplayName,
                        emailAddress = issue.Assignee.EmailAddress,
                    },
            });
        }
        catch (Exception e)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = e.Message });
        }
    }

    /// <summary>Lists Jira Software boards for a project (from issue key project, e.g. EVRST).</summary>
    [HttpGet("boards")]
    [ServiceFilter(typeof(FirebaseAuthFilter))]
    public async Task<IActionResult> GetBoards([FromQuery] string? siteUrl, [FromQuery] string? projectKey, CancellationToken ct)
    {
        siteUrl = siteUrl?.Trim() ?? "";
        projectKey = projectKey?.Trim() ?? "";
        if (string.IsNullOrEmpty(siteUrl) || string.IsNullOrEmpty(projectKey))
        {
            return BadRequest(new { error = "siteUrl and projectKey query params are required" });
        }

        var uid = HttpContext.RequireUid();
        try
        {
            var boards = await _jira.ListBoardsForProjectAsync(uid, siteUrl, projectKey, ct);
            return Ok(new
            {
                boards = boards.Select(b => new { id = b.Id, name = b.Name, type = b.Type }),
            });
        }
        catch (Exception e)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = e.Message });
        }
    }

    [HttpGet("board-sprints")]
    [ServiceFilter(typeof(FirebaseAuthFilter))]
    public async Task<IActionResult> GetBoardSprints([FromQuery] string? siteUrl, [FromQuery] string? boardId, CancellationToken ct)
    {
        siteUrl = siteUrl?.Trim() ?? "";
        boardId = boardId?.Trim() ?? "";
        if (string.IsNullOrEmpty(siteUrl) || string.IsNullOrEmpty(boardId))
        {
            return BadRequest(new { error = "siteUrl and boardId query params are required" });
        }

        var uid = HttpContext.RequireUid();
        try
        {
            var (board, sprints) = await _jira.GetBoardSprintsBundleAsync(uid, siteUrl, boardId, ct);
            return Ok(new
            {
                board = new { id = board.Id, name = board.Name },
                sprints = sprints.Select(s => new { id = s.Id, name = s.Name, state = s.State, originBoardId = s.OriginBoardId }),
            });
        }
        catch (Exception e)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = e.Message });
        }
    }

    public sealed record SyncEstimateDto(
        string SessionId,
        string StoryId,
        string StoryTitle,
        string JiraIssueKey,
        string? JiraSiteUrl,
        string? JiraBoardId,
        int? SprintId,
        string Estimate,
        string Method,
        bool? IncludeComment,
        List<SyncVoteLineDto> Votes,
        List<SyncParticipantLineDto> Participants);

    public sealed record SyncVoteLineDto(string MemberId, string DisplayName, string Card);
    public sealed record SyncParticipantLineDto(string MemberId, string DisplayName);

    [HttpPost("sync-estimate")]
    [ServiceFilter(typeof(FirebaseAuthFilter))]
    public async Task<IActionResult> SyncEstimate([FromBody] SyncEstimateDto? body, CancellationToken ct)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.JiraSiteUrl))
        {
            return BadRequest(new { error = body == null ? "Invalid body" : "jiraSiteUrl is required" });
        }

        var uid = HttpContext.RequireUid();
        var input = new SyncEstimateInput(
            body.SessionId,
            body.StoryId,
            body.StoryTitle,
            body.JiraIssueKey,
            body.JiraSiteUrl,
            body.JiraBoardId,
            body.SprintId,
            body.Estimate,
            body.Method,
            body.IncludeComment,
            body.Votes.Select(v => new SyncVoteLine(v.MemberId, v.DisplayName, v.Card)).ToList(),
            body.Participants.Select(p => new SyncParticipantLine(p.MemberId, p.DisplayName)).ToList());

        try
        {
            var firestoreUpdated = await _sync.SyncAsync(uid, input, ct);
            return Ok(new { ok = true, firestoreUpdated });
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e);
            return StatusCode(StatusCodes.Status502BadGateway, new { error = e.Message });
        }
    }
}
