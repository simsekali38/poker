namespace PokerPlanning.Api.Data.Entities;

public sealed class JiraUserToken
{
    public string Id { get; set; } = default!;
    public string FirebaseUid { get; set; } = default!;
    public string? AtlassianAccountId { get; set; }
    public string AccessTokenEnc { get; set; } = default!;
    public string? RefreshTokenEnc { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
