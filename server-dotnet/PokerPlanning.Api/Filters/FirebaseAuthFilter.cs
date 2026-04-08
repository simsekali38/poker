using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using PokerPlanning.Api.Services;

namespace PokerPlanning.Api.Filters;

public sealed class FirebaseAuthFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        if (config["DevSkipAuth"] == "true" && !string.IsNullOrEmpty(config["DevFirebaseUid"]))
        {
            context.HttpContext.Items["FirebaseUid"] = config["DevFirebaseUid"]!;
            await next();
            return;
        }

        var auth = context.HttpContext.Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            context.Result = new JsonResult(new { error = "Missing Authorization Bearer token" })
            {
                StatusCode = StatusCodes.Status401Unauthorized,
            };
            return;
        }

        var token = auth["Bearer ".Length..].Trim();
        var firebase = context.HttpContext.RequestServices.GetRequiredService<FirebaseAuthService>();
        var uid = await firebase.VerifyIdTokenAsync(token, context.HttpContext.RequestAborted);
        if (uid == null)
        {
            context.Result = new JsonResult(new { error = "Firebase Admin is not configured on the server" })
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable,
            };
            return;
        }

        if (uid.Length == 0)
        {
            context.Result = new JsonResult(new { error = "Invalid or expired Firebase ID token" })
            {
                StatusCode = StatusCodes.Status401Unauthorized,
            };
            return;
        }

        context.HttpContext.Items["FirebaseUid"] = uid;
        await next();
    }
}

public static class HttpContextFirebaseExtensions
{
    public static string RequireUid(this HttpContext http)
    {
        return http.Items["FirebaseUid"] as string ?? throw new InvalidOperationException("Missing Firebase uid");
    }
}
