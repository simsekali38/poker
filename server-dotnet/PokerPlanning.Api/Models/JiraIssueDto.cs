namespace PokerPlanning.Api.Models;

public sealed record JiraIssueDto(
    string IssueKey,
    string IssueId,
    string Summary,
    string? Description,
    JiraStatusDto Status,
    JiraAssigneeDto? Assignee);

public sealed record JiraStatusDto(string Id, string Name, string? Category);

public sealed record JiraAssigneeDto(string AccountId, string DisplayName, string? EmailAddress);
