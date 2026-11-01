// Pages.cs — the physical page map for Gépország's market (CITY-D44 B): every frame of RAM, folded into 4096 cells by address.
// A RAMMap-style read through the undocumented SystemSuperfetchInformation query, so it may fail on another Windows build: it
// then says so and nothing else suffers. Read-only. It carries the page's list and use, never a process or a file. Debug and
// profile privileges are switched on in this process only, for the query, and back off after it.
// It has its own one-way pipe, \\.\pipe\vrg-etw-pages: connecting is the request, so vrg-etw still takes no input from anyone.
// The scan costs time on a busy machine, so it never runs on a timer, and a result stands for 10 s.
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;

static class Pages
{
    public const int CellCount = 4096, ListKinds = 8, UseKinds = 12;
    const int InfoClass = 79, RangesQuery = 17, PfnQuery = 6, Debug = 20, Profile = 13;
    const int ReqHeader = 192, Identity = 24, Chunk = 256 * 1024, StandsMs = 10000;
    const long TooManyPages = 1L << 32;   // 16 TB: a number this size means the layout is not what we think

    [StructLayout(LayoutKind.Sequential)] struct Sf { public uint Version, Magic; public int Class; public IntPtr Data; public uint Length; }
    [DllImport("ntdll")] static extern int NtQuerySystemInformation(int c, ref Sf info, int size, out int got);
    [DllImport("ntdll")] static extern int RtlAdjustPrivilege(int priv, bool on, bool thread, out bool was);

    static int Query(int cls, IntPtr data, int len)
    {
        var sf = new Sf { Version = 45, Magic = 0x6B756843, Class = cls, Data = data, Length = (uint)len };
        return NtQuerySystemInformation(InfoClass, ref sf, Marshal.SizeOf<Sf>(), out _);
    }

    // PF_MEMORY_RANGE_INFO: version 1 counts at offset 4 with ranges from 8, version 2 at 8 with ranges from 16
    public static List<(long start, long n)> ParseRanges(byte[] b, int version)
    {
        int count = BitConverter.ToInt32(b, version == 1 ? 4 : 8), at = version == 1 ? 8 : 16;
        var list = new List<(long, long)>();
        for (int i = 0; i < count && at + 16 <= b.Length; i++, at += 16) list.Add((BitConverter.ToInt64(b, at), BitConverter.ToInt64(b, at + 8)));
        return list;
    }

    static List<(long start, long n)>? Ranges()
    {
        const int size = 64 * 1024;
        var mem = Marshal.AllocHGlobal(size);
        try
        {
            foreach (int version in new[] { 1, 2 })
            {
                var b = new byte[size];
                BitConverter.TryWriteBytes(b, version);
                Marshal.Copy(b, 0, mem, size);
                if (Query(RangesQuery, mem, size) < 0) continue;
                Marshal.Copy(mem, b, 0, size);
                var list = ParseRanges(b, version);
                if (list.Count > 0) return list;
            }
            return null;
        }
        finally { Marshal.FreeHGlobal(mem); }
    }

    // the frame's two descriptions, from MEMORY_FRAME_INFORMATION: use in bits 0-3, list in bits 4-6
    public sealed class Map
    {
        readonly long last, gran;
        readonly int[] byList = new int[CellCount * ListKinds], byUse = new int[CellCount * UseKinds];
        public readonly long[] Lists = new long[ListKinds], Uses = new long[UseKinds];
        public long Seen;
        public Map(long lastFrame) { last = lastFrame; gran = lastFrame / CellCount + 1; }
        public long Gran => gran;
        public void Add(long frame, ulong info)
        {
            if (frame < 0 || frame > last) return;
            int cell = (int)(frame / gran), use = (int)(info & 15), list = (int)(info >> 4 & 7);
            byList[cell * ListKinds + list]++; Lists[list]++; Seen++;
            if (use < UseKinds) { byUse[cell * UseKinds + use]++; Uses[use]++; }
        }
        // one character a cell, the most common value there; '.' is an address with no RAM behind it
        static string Fold(int[] counts, int width)
        {
            var s = new StringBuilder(CellCount);
            for (int c = 0; c < CellCount; c++)
            {
                int best = -1, top = 0;
                for (int v = 0; v < width; v++) if (counts[c * width + v] > top) { top = counts[c * width + v]; best = v; }
                s.Append(best < 0 ? '.' : "0123456789ab"[best]);
            }
            return s.ToString();
        }
        public string ListCells => Fold(byList, ListKinds);
        public string UseCells => Fold(byUse, UseKinds);
    }

    static object Scan()
    {
        var clock = Stopwatch.StartNew();
        RtlAdjustPrivilege(Debug, true, false, out bool hadDebug);
        RtlAdjustPrivilege(Profile, true, false, out bool hadProfile);
        var mem = IntPtr.Zero;
        try
        {
            var ranges = Ranges();
            if (ranges == null) return new { t = "pages", ok = false, why = "ranges" };
            long end = ranges.Max(r => r.start + r.n);
            if (ranges.Any(r => r.start < 0 || r.n <= 0) || end > TooManyPages) return new { t = "pages", ok = false, why = "layout" };
            var map = new Map(end - 1);
            int bytes = ReqHeader + Chunk * Identity;
            mem = Marshal.AllocHGlobal(bytes);
            foreach (var (start, n) in ranges)
                for (long done = 0; done < n; done += Chunk)
                {
                    int count = (int)Math.Min(Chunk, n - done), size = ReqHeader + count * Identity;
                    Marshal.WriteInt32(mem, 0, 1); Marshal.WriteInt32(mem, 4, 1); Marshal.WriteInt64(mem, 8, count);
                    for (int i = 0; i < count; i++)
                    {
                        Marshal.WriteInt64(mem, ReqHeader + i * Identity, 0);
                        Marshal.WriteInt64(mem, ReqHeader + i * Identity + 8, start + done + i);
                    }
                    int status = Query(PfnQuery, mem, size);
                    if (status < 0) return new { t = "pages", ok = false, why = "x" + status.ToString("X8") };
                    for (int i = 0; i < count; i++) map.Add(Marshal.ReadInt64(mem, ReqHeader + i * Identity + 8), (ulong)Marshal.ReadInt64(mem, ReqHeader + i * Identity));
                }
            return Result(map, clock.ElapsedMilliseconds, false);
        }
        catch (Exception e) { return new { t = "pages", ok = false, why = e.GetType().Name }; }
        finally
        {
            if (mem != IntPtr.Zero) Marshal.FreeHGlobal(mem);
            if (!hadDebug) RtlAdjustPrivilege(Debug, false, false, out _);
            if (!hadProfile) RtlAdjustPrivilege(Profile, false, false, out _);
        }
    }

    static object Result(Map m, long ms, bool demo) => new { t = "pages", ok = true, demo, at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), ms, gran = m.Gran, seen = m.Seen, lists = m.Lists, uses = m.Uses, l = m.ListCells, u = m.UseCells };

    // --demo: frames made up here, folded by the same code, for the pipe and the segéd
    static object Fake()
    {
        var map = new Map(1 << 20);
        var dice = new Random(7);
        for (long f = 0x100; f < 1 << 20; f++) map.Add(f, (uint)dice.Next(UseKinds) | (uint)(dice.Next(10) switch { 0 => 0, 1 => 1, < 5 => 2, 5 => 3, _ => 6 }) << 4);
        return Result(map, 1, true);
    }

    public static void Serve(string name, PipeSecurity sec, bool demo)
    {
        string line = ""; long at = 0;
        while (true)
        {
            try
            {
                using var p = NamedPipeServerStreamAcl.Create(name, PipeDirection.Out, 1, PipeTransmissionMode.Byte, PipeOptions.None, 0, 65536, sec);
                p.WaitForConnection();
                if (line == "" || Environment.TickCount64 - at > StandsMs) { line = JsonSerializer.Serialize(demo ? Fake() : Scan()); at = Environment.TickCount64; }
                var bytes = new UTF8Encoding(false).GetBytes(line + "\n");
                p.Write(bytes, 0, bytes.Length);
                p.Flush();
                p.WaitForPipeDrain();
            }
            catch (Exception) { Thread.Sleep(1000); }
        }
    }
}
