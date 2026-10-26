// vrg-probe — the Kódváros Tier A sidecar (P10, KV-21; report §1.4, CITY-D18 A). Unelevated, read-only.
//
// JSON lines on stdout: 'hello' once, 'windows' (the whole list, at start and every 15 s as a resync), then
// 'open' / 'close' / 'fg' as WinEvents arrive (SetWinEventHook needs a message loop, hence a sidecar). A window
// counts when it is a visible, uncloaked, titled top-level window that is not a tool window — what the taskbar
// shows. Only the handle, the process id, the exe name and the product name travel; never a window title.
// Stdin closing (the companion gone) ends it. Nothing is written anywhere.
//
//   node CodeCity/tools/build-probe.js     -> CodeCity/probe/bin/publish/vrg-probe.exe
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

static class Probe
{
    delegate void WinEventProc(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr mod, WinEventProc proc, uint pid, uint tid, uint flags);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern int GetWindowTextLengthW(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern long GetWindowLongPtrW(IntPtr h, int idx);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetMessageW(out MSG m, IntPtr h, uint min, uint max);
    [DllImport("user32.dll")] static extern bool PostThreadMessageW(uint tid, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SetTimer(IntPtr h, IntPtr id, uint ms, IntPtr fn);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr h, uint flags, StringBuilder sb, ref int size);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);

    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }

    const uint EVENT_SYSTEM_FOREGROUND = 0x0003, EVENT_OBJECT_DESTROY = 0x8001, EVENT_OBJECT_UNCLOAKED = 0x8018;
    const uint WINEVENT_OUTOFCONTEXT = 0, WINEVENT_SKIPOWNPROCESS = 2, WM_QUIT = 0x0012, WM_TIMER = 0x0113;
    const long WS_EX_TOOLWINDOW = 0x80;
    static readonly string[] Shell = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd" };

    record Win(uint Pid, string Exe, string Name);
    static readonly Dictionary<IntPtr, Win> wins = new();
    static readonly Dictionary<uint, (string exe, string name)> procs = new();
    static IntPtr fg;
    static WinEventProc? keep;   // the hook's delegate must outlive the hook

    static void Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        uint main = GetCurrentThreadId();
        new Thread(() => { try { while (Console.In.ReadLine() != null) { } } catch { } PostThreadMessageW(main, WM_QUIT, 0, 0); }) { IsBackground = true }.Start();
        Emit(new { t = "hello", v = 1, pid = Environment.ProcessId });
        Resync(true);
        keep = OnEvent;
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, 0, keep, 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_UNCLOAKED, 0, keep, 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        SetTimer(0, 0, 15000, 0);
        while (GetMessageW(out var m, 0, 0, 0) > 0) if (m.message == WM_TIMER) Resync(false);
    }

    static void OnEvent(IntPtr hook, uint ev, IntPtr h, int idObject, int idChild, uint thread, uint time)
    {
        if (h == 0 || idObject != 0 || idChild != 0) return;
        if (ev == EVENT_SYSTEM_FOREGROUND) { Foreground(); return; }
        if (ev != EVENT_OBJECT_DESTROY && GetAncestor(h, 2 /* GA_ROOT */) != h) return;
        Update(h, ev != EVENT_OBJECT_DESTROY && Counts(h));
        if (h == GetForegroundWindow()) Foreground();
    }

    static void Update(IntPtr h, bool counts)
    {
        bool had = wins.ContainsKey(h);
        if (counts && !had && Describe(h) is Win w) { wins[h] = w; Emit(new { t = "open", h = (long)h, pid = w.Pid, exe = w.Exe, name = w.Name }); }
        else if (!counts && had) { wins.Remove(h); Emit(new { t = "close", h = (long)h }); }
    }

    static void Foreground()
    {
        var h = GetForegroundWindow();
        if (h == fg) return;
        fg = h;
        Emit(new { t = "fg", h = wins.ContainsKey(h) ? (long)h : 0 });
    }

    // the whole list: at start, then every 15 s in case an event was missed
    static void Resync(bool first)
    {
        var now = new HashSet<IntPtr>();
        EnumWindows((h, _) => { if (Counts(h)) now.Add(h); return true; }, 0);
        foreach (var h in wins.Keys.Where(k => !now.Contains(k)).ToList()) Update(h, false);
        foreach (var h in now) Update(h, true);
        if (first) Emit(new { t = "windows", list = wins.Select(kv => new { h = (long)kv.Key, pid = kv.Value.Pid, exe = kv.Value.Exe, name = kv.Value.Name }) });
        Foreground();
    }

    static bool Counts(IntPtr h)
    {
        if (!IsWindowVisible(h) || GetWindow(h, 4 /* GW_OWNER */) != 0 || GetWindowTextLengthW(h) == 0) return false;
        if ((GetWindowLongPtrW(h, -20 /* GWL_EXSTYLE */) & WS_EX_TOOLWINDOW) != 0) return false;
        if (DwmGetWindowAttribute(h, 14 /* DWMWA_CLOAKED */, out int cloaked, 4) == 0 && cloaked != 0) return false;
        var cls = new StringBuilder(64); GetClassNameW(h, cls, 64);
        return !Shell.Contains(cls.ToString());
    }

    static Win? Describe(IntPtr h)
    {
        GetWindowThreadProcessId(h, out uint pid);
        if (pid == 0) return null;
        if (!procs.TryGetValue(pid, out var p))
        {
            string exe = "?", name = "?";
            IntPtr ph = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
            if (ph != 0)
            {
                var sb = new StringBuilder(1024); int n = sb.Capacity;
                if (QueryFullProcessImageNameW(ph, 0, sb, ref n))
                {
                    string full = sb.ToString();
                    exe = Path.GetFileName(full);
                    try { name = FileVersionInfo.GetVersionInfo(full).FileDescription ?? ""; } catch { name = ""; }
                    if (string.IsNullOrWhiteSpace(name)) name = Path.GetFileNameWithoutExtension(full);
                }
                CloseHandle(ph);
            }
            p = (exe, name.Trim());
            if (procs.Count > 500) procs.Clear();
            procs[pid] = p;
        }
        return new Win(pid, p.exe, p.name);
    }

    static void Emit(object o) { Console.Out.Write(JsonSerializer.Serialize(o) + "\n"); Console.Out.Flush(); }
}
