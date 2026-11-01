// Estate.cs — the Birtok walk (CITY-D45 note, D52 A) as `vrg-probe --estate <root> [seconds]`: its own short-lived process, the
// same result as CodeCity/estate-walk.js, which stays as the fallback. A directory listing already carries every file's size,
// so nothing opens or stats a file: here that is about 9 000 files a second against 3 000 for the Node walk, because the
// antivirus sits on every open. Numbers and folder names only; a file's name is read for its extension and dropped.
// Links are not followed, walled zones are not read. Folders take turns in slices, so a huge one cannot starve the rest and
// no time is left unused while anything is unfinished.
using System.IO.Enumeration;
using System.Text.Json;
using System.Text.Json.Serialization;

class EstateStat
{
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("size")] public long Size { get; set; }
    [JsonPropertyName("files")] public long Files { get; set; }
    [JsonPropertyName("kinds")] public Dictionary<string, long> Kinds { get; set; } = new();
    [JsonPropertyName("bands")] public long[] Bands { get; set; } = new long[3];
    [JsonPropertyName("top")] public List<object[]> Top { get; set; } = new();
    [JsonPropertyName("own"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] public bool Own { get; set; }
    [JsonPropertyName("rest"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] public int Rest { get; set; }
    [JsonPropertyName("restricted"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Restricted { get; set; }
    [JsonPropertyName("partial"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] public bool Partial { get; set; }
    [JsonPropertyName("kids"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public List<EstateStat>? Kids { get; set; }
}

static class Estate
{
    const long BandMid = 1L << 20, BandBig = 100L << 20;
    const int TopN = 5, KeepKids = 8, SliceMs = 700;
    static readonly Dictionary<string, string> KindOf = Kinds();
    static readonly EnumerationOptions Opt = new() { AttributesToSkip = 0, IgnoreInaccessible = true, RecurseSubdirectories = false, ReturnSpecialDirectories = false };

    static Dictionary<string, string> Kinds()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        void Add(string kind, string list) { foreach (var e in list.Split(' ')) map["." + e] = kind; }
        Add("image", "jpg jpeg png gif webp bmp tif tiff heic raw cr2 nef svg psd ai");
        Add("audio", "mp3 wav flac ogg m4a aac wma opus");
        Add("video", "mp4 mkv avi mov wmv webm m4v mpg mpeg");
        Add("doc", "pdf doc docx xls xlsx ppt pptx txt md rtf odt ods csv epub");
        Add("code", "js mjs ts tsx py c h cpp hpp cs java kt html htm css json xml yaml yml ps1 cmd bat sh go rs ino");
        Add("archive", "zip 7z rar tar gz iso cab msi img vhd vhdx wim bak");
        Add("program", "exe dll sys ocx drv so pak");
        return map;
    }
    static string? Walled(string n)
    {
        var l = n.ToLowerInvariant();
        return l.StartsWith("h_backup_") ? "H_BACKUP_*" : l == ".ssh" ? ".ssh" : l == "$recycle.bin" ? "Lomtár" : l == "system volume information" ? "rendszer" : null;
    }
    static void Count(EstateStat st, long size, string name)
    {
        var kind = KindOf.GetValueOrDefault(Path.GetExtension(name), "other");
        st.Size += size; st.Files++;
        st.Kinds[kind] = st.Kinds.GetValueOrDefault(kind) + size;
        st.Bands[size >= BandBig ? 2 : size >= BandMid ? 1 : 0]++;
        if (size < BandBig) return;
        st.Top.Add(new object[] { size, kind });
        if (st.Top.Count > TopN) { st.Top.Sort((a, b) => ((long)b[0]).CompareTo((long)a[0])); st.Top.RemoveAt(TopN); }
    }
    // one folder's listing: its files into st, its real subfolders handed back
    static List<(string name, string path)> Scan(EstateStat st, string dir)
    {
        var subs = new List<(string, string)>();
        try
        {
            var it = new FileSystemEnumerable<(string name, long size, bool isDir, bool link, string path)>(dir,
                (ref FileSystemEntry e) => (e.FileName.ToString(), e.Length, e.IsDirectory, (e.Attributes & FileAttributes.ReparsePoint) != 0, e.ToFullPath()), Opt);
            foreach (var f in it)
            {
                if (f.link) continue;
                if (f.isDir) { subs.Add((f.name, f.path)); continue; }
                Count(st, f.size, f.name);
            }
        }
        catch (Exception) { /* a folder that vanished or refuses: its bytes stay unread */ }
        return subs;
    }
    class Job { public EstateStat St = new(); public Stack<string> Dirs = new(); }

    static void Merge(EstateStat into, EstateStat st)
    {
        into.Size += st.Size; into.Files += st.Files;
        foreach (var (k, v) in st.Kinds) into.Kinds[k] = into.Kinds.GetValueOrDefault(k) + v;
        for (var i = 0; i < 3; i++) into.Bands[i] += st.Bands[i];
        into.Top.AddRange(st.Top);
        into.Partial |= st.Partial;
    }
    public static void Run(string root, int seconds)
    {
        var clock = System.Diagnostics.Stopwatch.StartNew();
        var limit = Math.Max(2, seconds) * 1000L;
        var own = new EstateStat { Own = true, Kids = new() };
        var dirs = new List<EstateStat>();
        var walled = new List<string>();
        var jobs = new List<Job>();
        var tops = new List<(EstateStat item, EstateStat ownFiles, List<EstateStat> kids)>();
        foreach (var (name, path) in Scan(own, root))
        {
            var w = Walled(name);
            if (w != null) { walled.Add(w); continue; }
            var item = new EstateStat { Name = name };
            var mine = new EstateStat { Own = true };
            var kids = new List<EstateStat>();
            foreach (var (kn, kp) in Scan(mine, path))
            {
                var kw = Walled(kn);
                if (kw != null) { kids.Add(new EstateStat { Name = kn, Restricted = kw }); continue; }
                var job = new Job { St = new EstateStat { Name = kn } };
                job.Dirs.Push(kp);
                kids.Add(job.St); jobs.Add(job);
            }
            tops.Add((item, mine, kids));
        }
        var total = Math.Max(1, jobs.Count);
        var live = new Queue<Job>(jobs);
        while (live.Count > 0 && clock.ElapsedMilliseconds < limit)
        {
            var job = live.Dequeue();
            var until = clock.ElapsedMilliseconds + SliceMs;
            while (job.Dirs.Count > 0 && clock.ElapsedMilliseconds < until)
                foreach (var (name, path) in Scan(job.St, job.Dirs.Pop()))
                    if (Walled(name) == null) job.Dirs.Push(path);
            if (job.Dirs.Count > 0) live.Enqueue(job);
            Console.WriteLine(JsonSerializer.Serialize(new { p = Math.Round(1 - (double)live.Count / total, 3) }));
        }
        foreach (var job in live) job.St.Partial = true;
        foreach (var (item, mine, kids) in tops)
        {
            kids.Sort((a, b) => b.Size.CompareTo(a.Size));
            var keep = kids.Take(KeepKids).ToList();
            var rest = new EstateStat { Rest = kids.Count - keep.Count };
            foreach (var k in kids.Skip(KeepKids)) Merge(rest, k);
            if (rest.Size > 0) keep.Add(rest);
            if (mine.Size > 0) keep.Add(mine);
            foreach (var k in keep) { Merge(item, k); k.Top = k.Top.OrderByDescending(t => (long)t[0]).Take(TopN).ToList(); }
            item.Top = new();
            item.Kids = keep;
            dirs.Add(item);
        }
        if (own.Size > 0) dirs.Add(own);
        var at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Console.WriteLine(JsonSerializer.Serialize(new { root, at, ms = clock.ElapsedMilliseconds, partial = dirs.Any(d => d.Partial), walled, dirs = dirs.OrderByDescending(d => d.Size).ToList() }));
    }
}
