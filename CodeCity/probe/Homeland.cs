// Homeland.cs — the Gépország feed (CITY-D34 B, docs/city/homeland/04-data-feed.md). On only while the segéd asks
// ({"t":"hm","on":true}): once a second one 'hm' line with raw cumulative numbers; CodeCity/homeland.js turns them into
// rates, classes and layers. Native calls and PDH, unelevated, read-only; WMI costs 80 times as much here.
// Rows carry the image name and sizes only: never a command line, a window title or memory contents. A process's path is
// looked at once, for the Temp / Downloads hint (CITY-D46 A), and then dropped.
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

static class Homeland
{
    [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int cls, IntPtr buf, int len, out int ret);
    [DllImport("psapi.dll")] static extern bool GetPerformanceInfo(out PerfInfo p, int size);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern int PdhOpenQueryW(string? src, IntPtr user, out IntPtr q);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern int PdhAddEnglishCounterW(IntPtr q, string path, IntPtr user, out IntPtr c);
    [DllImport("pdh.dll")] static extern int PdhCollectQueryData(IntPtr q);
    [DllImport("pdh.dll")] static extern int PdhGetFormattedCounterValue(IntPtr c, uint fmt, out uint type, out Fmt v);
    [DllImport("pdh.dll", CharSet = CharSet.Unicode)] static extern int PdhGetFormattedCounterArrayW(IntPtr c, uint fmt, ref uint size, ref uint n, IntPtr buf);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr h, uint flags, StringBuilder sb, ref int size);

    [StructLayout(LayoutKind.Sequential)] struct PerfInfo { public int cb; public IntPtr commitTotal, commitLimit, commitPeak, physTotal, physAvail, sysCache, kTotal, kPaged, kNonpaged, pageSize; public int handles, procs, threads; }
    [StructLayout(LayoutKind.Sequential)] struct Fmt { public uint status; public double value; }

    const uint FMT = 0x8200;   // PDH_FMT_DOUBLE | PDH_FMT_NOCAP100
    static readonly (string key, string path)[] Single =
    {
        ("modified", @"\Memory\Modified Page List Bytes"), ("sbCore", @"\Memory\Standby Cache Core Bytes"), ("sbNorm", @"\Memory\Standby Cache Normal Priority Bytes"),
        ("sbRes", @"\Memory\Standby Cache Reserve Bytes"), ("free", @"\Memory\Free & Zero Page List Bytes"), ("faults", @"\Memory\Page Faults/sec"), ("hard", @"\Memory\Page Reads/sec"),
        ("page", @"\Paging File(_Total)\% Usage"), ("ctx", @"\System\Context Switches/sec"), ("sys", @"\System\System Calls/sec"), ("irq", @"\Processor Information(_Total)\Interrupts/sec"),
        ("dpc", @"\Processor Information(_Total)\% DPC Time"), ("irqp", @"\Processor Information(_Total)\% Interrupt Time"), ("mhz", @"\Processor Information(_Total)\Processor Frequency"),
        ("perf", @"\Processor Information(_Total)\% Processor Performance"),
    };
    static readonly (string key, string path)[] Multi =
    {
        ("dr", @"\PhysicalDisk(*)\Disk Read Bytes/sec"), ("dw", @"\PhysicalDisk(*)\Disk Write Bytes/sec"), ("dq", @"\PhysicalDisk(*)\Current Disk Queue Length"), ("di", @"\PhysicalDisk(*)\% Idle Time"),
        ("nr", @"\Network Interface(*)\Bytes Received/sec"), ("ns", @"\Network Interface(*)\Bytes Sent/sec"),
        ("ge", @"\GPU Engine(*)\Utilization Percentage"), ("gd", @"\GPU Adapter Memory(*)\Dedicated Usage"), ("gs", @"\GPU Adapter Memory(*)\Shared Usage"),
    };

    static volatile bool on;
    static Thread? run;
    static readonly Dictionary<(long pid, long born), string> hints = new();

    public static void Set(bool want)
    {
        on = want;
        if (want && run is not { IsAlive: true }) { run = new Thread(Loop) { IsBackground = true, Name = "homeland" }; run.Start(); }
    }

    static void Loop()
    {
        try
        {
            PdhOpenQueryW(null, 0, out var q);
            var one = Single.Select(s => { PdhAddEnglishCounterW(q, s.path, 0, out var c); return (s.key, c); }).ToArray();
            var many = Multi.Select(s => { PdhAddEnglishCounterW(q, s.path, 0, out var c); return (s.key, c); }).ToArray();
            PdhCollectQueryData(q);
            var clock = new Stopwatch();
            while (on)
            {
                Thread.Sleep(1000);
                if (!on) break;
                clock.Restart();
                PdhCollectQueryData(q);
                var pdh = new Dictionary<string, double>();
                foreach (var (key, c) in one) if (PdhGetFormattedCounterValue(c, FMT, out _, out var v) == 0 && v.status == 0) pdh[key] = v.value;
                var arr = new Dictionary<string, Dictionary<string, double>>();
                foreach (var (key, c) in many) arr[key] = Array(c);
                GetPerformanceInfo(out var pi, Marshal.SizeOf<PerfInfo>());
                long page = (long)pi.pageSize;
                var mem = new { total = (long)pi.physTotal * page, avail = (long)pi.physAvail * page, commit = (long)pi.commitTotal * page, limit = (long)pi.commitLimit * page,
                    cache = (long)pi.sysCache * page, paged = (long)pi.kPaged * page, nonpaged = (long)pi.kNonpaged * page };
                var eng = new Dictionary<string, double>();
                foreach (var (name, v) in arr["ge"]) { int i = name.IndexOf("engtype_"); if (i >= 0) { string e = name[(i + 8)..]; eng[e] = eng.GetValueOrDefault(e) + v; } }
                var rows = Procs();
                long ms = clock.ElapsedMilliseconds;
                Probe.Emit(new { t = "hm", at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), ms, p = rows, c = Cores(), m = mem, s = pdh,
                    d = arr["dr"].Keys.Select(k => new { name = k, r = arr["dr"].GetValueOrDefault(k), w = arr["dw"].GetValueOrDefault(k), q = arr["dq"].GetValueOrDefault(k), idle = arr["di"].GetValueOrDefault(k) }),
                    n = arr["nr"].Keys.Select(k => new { name = k, rx = arr["nr"].GetValueOrDefault(k), tx = arr["ns"].GetValueOrDefault(k) }),
                    g = new { eng, ded = arr["gd"].Values.Sum(), shared = arr["gs"].Values.Sum() } });
            }
        }
        catch (Exception e) { Probe.Emit(new { t = "error", where = "homeland", e = e.GetType().Name }); }
    }

    static Dictionary<string, double> Array(IntPtr c)
    {
        var o = new Dictionary<string, double>();
        uint size = 0, n = 0;
        PdhGetFormattedCounterArrayW(c, FMT, ref size, ref n, 0);
        if (size == 0) return o;
        IntPtr b = Marshal.AllocHGlobal((int)size);
        try
        {
            if (PdhGetFormattedCounterArrayW(c, FMT, ref size, ref n, b) != 0) return o;
            for (int i = 0; i < n; i++)   // PDH_FMT_COUNTERVALUE_ITEM_W: name pointer, then { status, double } = 24 bytes
            {
                IntPtr it = b + i * 24;
                string name = Marshal.PtrToStringUni(Marshal.ReadIntPtr(it)) ?? "";
                if (name != "_Total" && Marshal.ReadInt32(it, 8) == 0) o[name] = o.GetValueOrDefault(name) + Marshal.PtrToStructure<double>(it + 16);
            }
        }
        finally { Marshal.FreeHGlobal(b); }
        return o;
    }

    // SystemProcessorPerformanceInformation: per logical CPU, 100 ns totals [idle, kernel incl. idle, user, dpc, interrupt]
    static long[][] Cores()
    {
        int n = Environment.ProcessorCount, size = 48 * n;
        IntPtr b = Marshal.AllocHGlobal(size);
        try
        {
            if (NtQuerySystemInformation(8, b, size, out _) != 0) return System.Array.Empty<long[]>();
            var o = new long[n][];
            for (int i = 0; i < n; i++) o[i] = Enumerable.Range(0, 5).Select(k => Marshal.ReadInt64(b, i * 48 + k * 8)).ToArray();
            return o;
        }
        finally { Marshal.FreeHGlobal(b); }
    }

    // SystemProcessInformation (x64 offsets of SYSTEM_PROCESS_INFORMATION): every process, also those we may not open.
    // A row: pid, parent, session, name, threads, cpu (100 ns), working set, private, read, written, hard faults, handles, hint
    static object[][] Procs()
    {
        int len = 2 << 20;
        IntPtr b = Marshal.AllocHGlobal(len);
        try
        {
            int st; while ((st = NtQuerySystemInformation(5, b, len, out int need)) == unchecked((int)0xC0000004))
            { Marshal.FreeHGlobal(b); len = Math.Max(len * 2, need + 65536); b = Marshal.AllocHGlobal(len); }
            if (st != 0) return System.Array.Empty<object[]>();
            var rows = new List<object[]>();
            for (int off = 0; ; )
            {
                int next = Marshal.ReadInt32(b, off);
                long pid = Marshal.ReadInt64(b, off + 80), born = Marshal.ReadInt64(b, off + 32);
                int nameLen = Marshal.ReadInt16(b, off + 56);
                IntPtr namePtr = Marshal.ReadIntPtr(b, off + 64);
                string name = namePtr == 0 ? (pid == 0 ? "Idle" : "System") : Marshal.PtrToStringUni(namePtr, nameLen / 2);
                rows.Add(new object[] { pid, Marshal.ReadInt64(b, off + 88), Marshal.ReadInt32(b, off + 100), name, Marshal.ReadInt32(b, off + 4),
                    Marshal.ReadInt64(b, off + 40) + Marshal.ReadInt64(b, off + 48), Marshal.ReadInt64(b, off + 144), Marshal.ReadInt64(b, off + 8),
                    Marshal.ReadInt64(b, off + 232), Marshal.ReadInt64(b, off + 240), Marshal.ReadInt32(b, off + 16), Marshal.ReadInt32(b, off + 96), Hint(pid, born) });
                if (next == 0) break;
                off += next;
            }
            if (hints.Count > 4000) hints.Clear();
            return rows.ToArray();
        }
        finally { Marshal.FreeHGlobal(b); }
    }

    // CITY-D46 A: where a process started from, as a hint word; the path itself goes no further
    static string Hint(long pid, long born)
    {
        if (hints.TryGetValue((pid, born), out var h)) return h;
        h = "";
        IntPtr ph = OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, (uint)pid);
        if (ph != 0)
        {
            var sb = new StringBuilder(1024); int n = sb.Capacity;
            if (QueryFullProcessImageNameW(ph, 0, sb, ref n))
            {
                string p = sb.ToString().ToLowerInvariant();
                h = p.Contains(@"\appdata\local\temp\") || p.Contains(@"\windows\temp\") ? "temp" : p.Contains(@"\downloads\") ? "downloads" : "";
            }
            CloseHandle(ph);
        }
        return hints[(pid, born)] = h;
    }
}
