using Microsoft.AspNetCore.Mvc;

namespace PokerPlanning.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class HealthController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { ok = true, service = "poker-planning-server" });
    }

    /// <summary>Debug: send header <c>Origin: https://your-spa</c> to see if it would be allowed.</summary>
    [HttpGet("cors-check")]
    public IActionResult CorsCheck([FromServices] IConfiguration config)
    {
        var origin = Request.Headers.Origin.ToString();
        var raw = config["CorsOrigin"]?.Trim() ?? "*";
        var allowed = false;
        if (raw == "*")
        {
            allowed = !string.IsNullOrEmpty(origin);
        }
        else
        {
            var list = raw.Split(',').Select(s => s.Trim().TrimEnd('/')).Where(s => s.Length > 0).ToList();
            allowed = !string.IsNullOrEmpty(origin) && list.Contains(origin.TrimEnd('/'));
        }

        return Ok(new
        {
            ok = true,
            requestOrigin = string.IsNullOrEmpty(origin) ? null : origin,
            allowed,
            configuredOrigins = raw == "*" ? new[] { "*" } : raw.Split(',').Select(s => s.Trim()).ToArray(),
        });
    }
}
