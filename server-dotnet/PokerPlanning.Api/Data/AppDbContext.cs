using Microsoft.EntityFrameworkCore;
using PokerPlanning.Api.Data.Entities;

namespace PokerPlanning.Api.Data;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<JiraUserToken> JiraUserTokens => Set<JiraUserToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<JiraUserToken>(e =>
        {
            e.ToTable("JiraUserToken");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.FirebaseUid).IsUnique();
            e.Property(x => x.FirebaseUid).HasMaxLength(128);
            e.Property(x => x.AccessTokenEnc).IsRequired();
        });
    }
}
