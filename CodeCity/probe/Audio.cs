// Audio.cs — Core Audio on the default playback device (P10, KV-22): one sound tower per program (its sessions'
// volume and mute, set on request), the per-session peak meters ~12 times a second while something sounds, and the
// device's own peak meter for the stadium. Per-app loopback needs build 20348, so on 19044 these OS meters are it.
using System.Collections.Concurrent;
using System.Runtime.InteropServices;

static class Audio
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo { }
    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator { [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IntPtr devices); [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev); }
    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice { [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionManager2 { [PreserveSig] int GetAudioSessionControl(IntPtr g, int f, out IntPtr c); [PreserveSig] int GetSimpleAudioVolume(IntPtr g, int f, out IntPtr v); [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e); }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionEnumerator { [PreserveSig] int GetCount(out int n); [PreserveSig] int GetSession(int i, out IAudioSessionControl2 s); }
    [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioSessionControl2
    {
        [PreserveSig] int GetState(out int s); [PreserveSig] int GetDisplayName(out IntPtr n); [PreserveSig] int SetDisplayName(IntPtr n, IntPtr ctx);
        [PreserveSig] int GetIconPath(out IntPtr p); [PreserveSig] int SetIconPath(IntPtr p, IntPtr ctx); [PreserveSig] int GetGroupingParam(out Guid g);
        [PreserveSig] int SetGroupingParam(IntPtr g, IntPtr ctx); [PreserveSig] int RegisterAudioSessionNotification(IntPtr n); [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
        [PreserveSig] int GetSessionIdentifier(out IntPtr id); [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr id); [PreserveSig] int GetProcessId(out uint pid);
        [PreserveSig] int IsSystemSoundsSession();
    }
    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ISimpleAudioVolume { [PreserveSig] int SetMasterVolume(float v, ref Guid ctx); [PreserveSig] int GetMasterVolume(out float v); [PreserveSig] int SetMute(int m, ref Guid ctx); [PreserveSig] int GetMute(out int m); }
    [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioMeterInformation { [PreserveSig] int GetPeakValue(out float v); }

    record Sess(string Key, string Name, IAudioSessionControl2 Ctl, ISimpleAudioVolume? Vol, IAudioMeterInformation? Meter);
    static readonly ConcurrentQueue<(string key, float? vol, bool? mute)> commands = new();
    static Guid ours = Guid.NewGuid();   // the event context: our own changes
    static List<Sess> sessions = new();
    static IAudioMeterInformation? master;
    static string sig = "", peakSig = "";

    public static void Command(string key, float? vol, bool? mute) => commands.Enqueue((key, vol, mute));

    public static void Run()
    {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCo();
        int tick = 0;
        while (true)
        {
            bool now = false;
            while (commands.TryDequeue(out var c)) { Apply(c.key, c.vol, c.mute); now = true; }
            if (now || tick % 25 == 0) Refresh(en);
            Peaks();
            tick++;
            Thread.Sleep(80);
        }
    }

    static void Refresh(IMMDeviceEnumerator en)
    {
        foreach (var s in sessions) Release(s.Ctl);
        sessions = new();
        master = null;
        if (en.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out var dev) != 0 || dev == null) { Report(); return; }
        var iidMeter = typeof(IAudioMeterInformation).GUID; var iidMgr = typeof(IAudioSessionManager2).GUID;
        if (dev.Activate(ref iidMeter, 23 /* CLSCTX_ALL */, 0, out var m) == 0) master = (IAudioMeterInformation)m;
        if (dev.Activate(ref iidMgr, 23, 0, out var o) == 0 && ((IAudioSessionManager2)o).GetSessionEnumerator(out var e) == 0)
        {
            e.GetCount(out int n);
            for (int i = 0; i < n; i++)
            {
                if (e.GetSession(i, out var ctl) != 0 || ctl == null) continue;
                ctl.GetState(out int st);
                ctl.GetProcessId(out uint pid);
                bool sys = ctl.IsSystemSoundsSession() == 0;
                if (st == 2 /* expired */ || (pid == 0 && !sys)) { Release(ctl); continue; }
                var (exe, name) = sys ? ("system", "Rendszerhangok") : Probe.ProcName(pid);
                sessions.Add(new Sess(exe.ToLowerInvariant(), name, ctl, ctl as ISimpleAudioVolume, ctl as IAudioMeterInformation));
            }
        }
        Report();
    }

    // one tower per program: the first session's volume, muted only if all are, active if any is
    static void Report()
    {
        var list = sessions.GroupBy(s => s.Key).Select(g =>
        {
            float vol = 1; int mute = 1, active = 0;
            var v = g.First().Vol; if (v != null) v.GetMasterVolume(out vol);
            foreach (var s in g) { int mu = 0; s.Vol?.GetMute(out mu); mute &= mu; s.Ctl.GetState(out int st); if (st == 1) active = 1; }
            return new { key = g.Key, name = g.First().Name, vol = MathF.Round(vol, 2), mute = mute == 1, active = active == 1, n = g.Count() };
        }).OrderBy(a => a.key, StringComparer.Ordinal).ToList();
        string s = System.Text.Json.JsonSerializer.Serialize(list);
        if (s == sig) return;
        sig = s;
        Probe.Emit(new { t = "audio", list });
    }

    static void Peaks()
    {
        float mp = 0; master?.GetPeakValue(out mp);
        var by = new SortedDictionary<string, float>(StringComparer.Ordinal);
        foreach (var s in sessions) { float p = 0; s.Meter?.GetPeakValue(out p); by[s.Key] = Math.Max(by.GetValueOrDefault(s.Key), MathF.Round(p, 2)); }
        var loud = by.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
        string s2 = MathF.Round(mp, 2) + "|" + string.Join(",", loud.Select(kv => kv.Key + ":" + kv.Value));
        if (s2 == peakSig) return;   // silence after silence: nothing goes out
        peakSig = s2;
        Probe.Emit(new { t = "peaks", m = MathF.Round(mp, 2), s = loud });
    }

    static void Apply(string key, float? vol, bool? mute)
    {
        foreach (var s in sessions.Where(s => s.Key == key && s.Vol != null))
        {
            if (vol is float v) s.Vol!.SetMasterVolume(Math.Clamp(v, 0, 1), ref ours);
            if (mute is bool m) s.Vol!.SetMute(m ? 1 : 0, ref ours);
        }
    }

    static void Release(object o) { try { Marshal.FinalReleaseComObject(o); } catch { } }
}
