// Media.cs — what Windows says is playing (GSMTC, Win10 1809+; P10 KV-22, CITY-D25 A): app, status, title, artist,
// once a second. No Spotify API, no login. The WinRT calls go through raw vtables (the C# projection would need the
// Windows SDK package from nuget.org); every interface id and slot below was read from this machine's
// System32\WinMetadata\Windows.Media.winmd (Windows.Media.Control.*) and Windows.Foundation (IAsyncInfo, IVectorView).
using System.Runtime.InteropServices;

static unsafe class Media
{
    [DllImport("combase.dll")] static extern int RoGetActivationFactory(IntPtr cls, ref Guid iid, out IntPtr factory);
    [DllImport("combase.dll", CharSet = CharSet.Unicode)] static extern int WindowsCreateString(string s, int len, out IntPtr h);
    [DllImport("combase.dll")] static extern int WindowsDeleteString(IntPtr h);
    [DllImport("combase.dll")] static extern char* WindowsGetStringRawBuffer(IntPtr h, out uint len);

    static Guid IID_Statics = new("2050c4ee-11a0-57de-aed7-c97c70338245");   // IGlobalSystemMediaTransportControlsSessionManagerStatics
    static Guid IID_AsyncInfo = new("00000036-0000-0000-C000-000000000046");
    // slots (IInspectable takes 0-5): Statics.RequestAsync 6 · Manager.GetCurrentSession 6, GetSessions 7 · Session.SourceAppUserModelId 6,
    // TryGetMediaPropertiesAsync 7, GetPlaybackInfo 9 · PlaybackInfo.PlaybackStatus 7 · MediaProperties.Title 6, Artist 9 ·
    // IVectorView.GetAt 6, Size 7 · IAsyncInfo.Status 7 · IAsyncOperation.GetResults 8
    static readonly string[] Status = { "closed", "opened", "changing", "stopped", "playing", "paused" };
    static string sig = "";

    static void* Fn(IntPtr o, int slot) => (*(void***)o)[slot];
    static IntPtr Ptr(IntPtr o, int slot) { IntPtr r = 0; return ((delegate* unmanaged[Stdcall]<IntPtr, IntPtr*, int>)Fn(o, slot))(o, &r) == 0 ? r : 0; }
    static int Int(IntPtr o, int slot) { int r = -1; ((delegate* unmanaged[Stdcall]<IntPtr, int*, int>)Fn(o, slot))(o, &r); return r; }
    static string Str(IntPtr o, int slot)
    {
        IntPtr h = 0;
        if (((delegate* unmanaged[Stdcall]<IntPtr, IntPtr*, int>)Fn(o, slot))(o, &h) != 0 || h == 0) return "";
        char* p = WindowsGetStringRawBuffer(h, out uint n); string s = new string(p, 0, (int)n); WindowsDeleteString(h); return s;
    }
    static IntPtr Await(IntPtr op)
    {
        if (op == 0) return 0;
        IntPtr r = 0;
        if (Marshal.QueryInterface(op, ref IID_AsyncInfo, out var info) == 0)
        {
            int st = 0;
            for (int i = 0; i < 300 && (st = Int(info, 7)) == 0; i++) Thread.Sleep(10);
            if (st == 1) r = Ptr(op, 8);
            Marshal.Release(info);
        }
        Marshal.Release(op);
        return r;
    }
    static void Rel(IntPtr p) { if (p != 0) Marshal.Release(p); }

    public static void Run()
    {
        IntPtr mgr = 0;
        try
        {
            const string name = "Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager";
            WindowsCreateString(name, name.Length, out var cls);
            if (RoGetActivationFactory(cls, ref IID_Statics, out var statics) == 0) { mgr = Await(Ptr(statics, 6)); Rel(statics); }
            WindowsDeleteString(cls);
        }
        catch { }
        if (mgr == 0) { Probe.Emit(new { t = "media", ok = false, list = Array.Empty<object>() }); return; }
        while (true)
        {
            try { Poll(mgr); } catch { }
            Thread.Sleep(1000);
        }
    }

    static void Poll(IntPtr mgr)
    {
        var list = new List<object>();
        IntPtr cur = Ptr(mgr, 6); string curApp = cur != 0 ? Str(cur, 6) : ""; Rel(cur);
        IntPtr vec = Ptr(mgr, 7);
        if (vec != 0)
        {
            uint n = (uint)Int(vec, 7);
            for (uint i = 0; i < n && i < 16; i++)
            {
                IntPtr s = 0;
                if (((delegate* unmanaged[Stdcall]<IntPtr, uint, IntPtr*, int>)Fn(vec, 6))(vec, i, &s) != 0 || s == 0) continue;
                string app = Str(s, 6);
                IntPtr pb = Ptr(s, 9); int st = pb != 0 ? Int(pb, 7) : 0; Rel(pb);
                IntPtr props = Await(Ptr(s, 7));
                string title = props != 0 ? Str(props, 6) : "", artist = props != 0 ? Str(props, 9) : "";
                Rel(props); Rel(s);
                list.Add(new { app, key = KeyOf(app), status = st >= 0 && st < Status.Length ? Status[st] : "?", title = Cut(title), artist = Cut(artist), current = app == curApp });
            }
            Rel(vec);
        }
        string j = System.Text.Json.JsonSerializer.Serialize(list);
        if (j == sig) return;
        sig = j;
        Probe.Emit(new { t = "media", ok = true, list });
    }

    // the program behind an app id: "Spotify.exe" -> spotify.exe; "SpotifyAB.SpotifyMusic_…!Spotify" -> spotify.exe; "Chrome" -> chrome.exe
    static string KeyOf(string app)
    {
        string t = app.Contains('!') ? app[(app.LastIndexOf('!') + 1)..] : app;
        if (t.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) t = t[..^4];
        return t.ToLowerInvariant() + ".exe";
    }
    static string Cut(string s) => s.Length > 120 ? s[..120] : s;
}
