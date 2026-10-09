using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var origins = (builder.Configuration["FRIOTRACK_ORIGINS"] ?? "http://localhost:5173,http://127.0.0.1:5173").Split(',', StringSplitOptions.RemoveEmptyEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddSingleton<WorkspaceStore>();
var app = builder.Build();
app.UseCors();
app.UseRateLimiter();
app.Use(async (context, next) => {
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    try { await next(); }
    catch (ApiError e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { code = e.Code }); }
    catch (System.Text.Json.JsonException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { code = "requiredFields" }); }
});
app.MapGet("/api/health", () => new { status = "ok", service = "FrioTrack", version = "2.0" });
app.MapPost("/api/auth/login", (JsonObject body, WorkspaceStore store) => store.Login(body)).RequireRateLimiting("auth");
app.MapPost("/api/auth/register", (JsonObject body, WorkspaceStore store) => store.Register(body)).RequireRateLimiting("auth");
app.MapGet("/api/workspace", (HttpContext context, WorkspaceStore store) => store.Workspace(context));
app.MapPost("/api/commands", (JsonObject body, HttpContext context, WorkspaceStore store) => store.Command(context, body));
app.MapPost("/api/auth/logout", (HttpContext context, WorkspaceStore store) => { store.Logout(context); return Results.NoContent(); });
app.Run();

sealed class ApiError(string code, int status = 400) : Exception(code) {
    public string Code { get; } = code;
    public int Status { get; } = status;
}

sealed class WorkspaceStore {
    readonly object gate = new();
    readonly string path;
    JsonObject database;
    static string Text(JsonNode? n, string key) => n?[key]?.ToString() ?? "";
    static string Now() => DateTimeOffset.UtcNow.ToString("O");
    static string Digest(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    static JsonObject Copy(JsonObject value) => (JsonObject)value.DeepClone();
    static JsonObject Password(string value) {
        var salt = RandomNumberGenerator.GetBytes(16);
        return new JsonObject { ["salt"] = Convert.ToBase64String(salt), ["hash"] = Convert.ToBase64String(Rfc2898DeriveBytes.Pbkdf2(value, salt, 210_000, HashAlgorithmName.SHA256, 32)) };
    }
    static bool Matches(string value, JsonObject credentials) {
        var hash = Rfc2898DeriveBytes.Pbkdf2(value, Convert.FromBase64String(Text(credentials, "salt")), 210_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(hash, Convert.FromBase64String(Text(credentials, "hash")));
    }
    public WorkspaceStore(IConfiguration configuration, IWebHostEnvironment environment) {
        var home = Environment.GetEnvironmentVariable("HOME");
        path = configuration["FRIOTRACK_DATA_FILE"] ?? Path.Combine(home ?? environment.ContentRootPath, "data", "friotrack.json");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path)) database = JsonNode.Parse(File.ReadAllText(path))!.AsObject();
        else {
            var state = JsonNode.Parse(File.ReadAllText(Path.Combine(environment.ContentRootPath, "seed.json")))!.AsObject();
            var credentials = new JsonObject();
            foreach (var (id, setting) in new[] { ("coordinator-1", "FRIOTRACK_COORDINATOR_PASSWORD"), ("cargo-1", "FRIOTRACK_CLIENT_PASSWORD") }) {
                var password = configuration[setting] ?? throw new InvalidOperationException($"Missing {setting}");
                if (password.Length < 12) throw new InvalidOperationException("Initial passwords require at least 12 characters.");
                credentials[id] = Password(password);
            }
            database = new JsonObject { ["state"] = state, ["credentials"] = credentials, ["sessions"] = new JsonObject() };
            Save();
        }
    }
    void Save() {
        File.WriteAllText(path + ".tmp", database.ToJsonString());
        File.Move(path + ".tmp", path, true);
    }
    JsonObject State => database["state"]!.AsObject();
    JsonObject Sessions => database["sessions"]!.AsObject();
    JsonObject Account(HttpContext context) {
        var header = context.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal)) throw new ApiError("sessionExpired", 401);
        var session = Sessions[Digest(header[7..])];
        if (session is null || !DateTimeOffset.TryParse(Text(session, "expiresAt"), out var expiry) || expiry <= DateTimeOffset.UtcNow) throw new ApiError("sessionExpired", 401);
        return State["profiles"]!.AsArray().OfType<JsonObject>().FirstOrDefault(p => Text(p, "id") == Text(session, "profileId")) ?? throw new ApiError("sessionExpired", 401);
    }
    JsonObject StartSession(JsonObject account) {
        foreach (var expired in Sessions.Where(s => DateTimeOffset.Parse(Text(s.Value, "expiresAt")) <= DateTimeOffset.UtcNow).Select(s => s.Key).ToArray()) Sessions.Remove(expired);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expires = DateTimeOffset.UtcNow.AddHours(8).ToString("O");
        Sessions[Digest(token)] = new JsonObject { ["profileId"] = Text(account, "id"), ["expiresAt"] = expires };
        Save();
        return new JsonObject { ["token"] = token, ["expiresAt"] = expires, ["profile"] = account.DeepClone(), ["state"] = Visible(account) };
    }
    public JsonObject Login(JsonObject body) { lock (gate) {
        var email = Text(body, "email").Trim().ToLowerInvariant();
        var password = Text(body, "password");
        if (email.Length > 140 || password.Length > 128) throw new ApiError("invalidCredentials", 401);
        var account = State["profiles"]!.AsArray().OfType<JsonObject>().FirstOrDefault(p => Text(p, "email").ToLowerInvariant() == email);
        var credentials = account is null ? null : database["credentials"]?[Text(account, "id")] as JsonObject;
        // Always perform a password derivation, including unknown accounts.
        var valid = credentials is null ? Matches(password, Password("invalid-account-placeholder")) : Matches(password, credentials);
        if (credentials is null || !valid) throw new ApiError("invalidCredentials", 401);
        return StartSession(account!);
    } }
    public JsonObject Register(JsonObject body) { lock (gate) {
        var password = Text(body, "password");
        if (password.Length < 12 || password.Length > 128) throw new ApiError("invalidPassword");
        if (body["consent"]?.ToString() != "true") throw new ApiError("requiredConsent");
        if (Text(body, "role") is not ("" or "cargo-client")) throw new ApiError("forbidden", 403);
        var account = new JsonObject { ["id"] = "profile-" + Guid.NewGuid(), ["name"] = Text(body, "name").Trim(), ["email"] = Text(body, "email").Trim().ToLowerInvariant(), ["organization"] = Text(body, "organization").Trim(), ["role"] = "cargo-client" };
        Operations.ValidateProfile(State, account, "");
        State["profiles"]!.AsArray().Add(account);
        database["credentials"]![Text(account, "id")] = Password(password);
        return StartSession(account);
    } }
    JsonObject Visible(JsonObject account) {
        var state = Copy(State);
        if (Text(account, "role") == "coordinator") return state;
        var id = Text(account, "id");
        var shipments = state["shipments"]!.AsArray().OfType<JsonObject>().Where(s => Text(s, "customerId") == id).ToArray();
        var ids = shipments.Select(s => Text(s, "id")).ToHashSet();
        void Filter(string key, Func<JsonObject, bool> predicate) {
            var array = state[key]!.AsArray();
            for (var i = array.Count - 1; i >= 0; i--) if (!predicate(array[i]!.AsObject())) array.RemoveAt(i);
        }
        Filter("profiles", p => Text(p, "id") == id);
        Filter("shipments", s => ids.Contains(Text(s, "id")));
        Filter("alerts", a => ids.Contains(Text(a, "shipmentId")));
        Filter("notifications", n => ids.Contains(Text(n, "shipmentId")) && (n["recipientProfileIds"] is not JsonArray recipients || recipients.Any(r => r?.ToString() == id)));
        Filter("vehicles", v => shipments.Any(s => Text(s, "vehicleId") == Text(v, "id")));
        Filter("drivers", d => shipments.Any(s => Text(s, "driverId") == Text(d, "id")));
        return state;
    }
    public JsonObject Workspace(HttpContext context) { lock (gate) { var account = Account(context); return new JsonObject { ["profile"] = account.DeepClone(), ["state"] = Visible(account) }; } }
    public JsonObject Command(HttpContext context, JsonObject body) { lock (gate) {
        var account = Account(context);
        var state = Copy(State);
        var result = Operations.Apply(state, account, Text(body, "type"), body["payload"] as JsonObject ?? new JsonObject());
        database["state"] = state;
        Save();
        var current = state["profiles"]!.AsArray().OfType<JsonObject>().First(p => Text(p, "id") == Text(account, "id"));
        return new JsonObject { ["profile"] = current.DeepClone(), ["state"] = Visible(current), ["result"] = result?.DeepClone() };
    } }
    public void Logout(HttpContext context) { lock (gate) { Account(context); Sessions.Remove(Digest(context.Request.Headers.Authorization.ToString()[7..])); Save(); } }
}
