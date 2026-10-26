// vrg-etw — the Kódváros Tier B sidecar (P11, KV-23; report §1.4, CITY-D17 A, D23 A). Elevated, read-only.
//
// One real-time ETW session: Kernel-Network (TCP/UDP send/receive per process: the exact cargo), Kernel-File (reads and
// writes inside this repo), Kernel-Process (the process tree), and DNS-Client (which name a process looked up). The
// filters are fixed here: the repo root is baked in at build time (node CodeCity/tools/build-etw.js), it takes no
// arguments but --demo, and it reads nothing from anyone. Out: JSON lines on the named pipe \\.\pipe\vrg-etw — the
// current user may read it, nobody may write to it, the network is denied. Nothing is written to disk.
// Started by a scheduled task the user creates (docs/city/wp/p11-etw.md); runs from C:\Program Files\VRG\Kodvaros-ETW
// with its own runtime copy in .\dotnet (AppHostDotNetSearch=AppRelative), never from a user-writable folder.
//
//   vrg-etw.exe            the real thing (must be elevated)
//   vrg-etw.exe --demo     unelevated, made-up events on \\.\pipe\vrg-etw-demo (to test the pipe and the segéd)
using System.Collections.Concurrent;
using System.IO.Pipes;
using System.Net;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Parsers;
using Microsoft.Diagnostics.Tracing.Session;

static class Etw
{
    const string SessionName = "VRG-Kodvaros-ETW";
    static readonly string Repo = ((typeof(Etw).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "VrgRepoRoot")?.Value) ?? "").TrimEnd('\\', '/') + "\\";
    static readonly string[] Skip = { ".git\\", "node_modules\\", "Planner\\apps\\", ".cache\\", "Vendor\\" };
    static readonly int Self = Environment.ProcessId;
    static readonly BlockingCollection<string> outbox = new(5000);
    static readonly List<StreamWriter> clients = new();
    static readonly object agg = new();
    static Dictionary<int, Net> net = new();
    static HashSet<string> files = new();
    static readonly Dictionary<string, long> dnsSeen = new();
    static readonly Dictionary<int, (int ppid, string exe)> procs = new();   // the tree, for a reader that joins later
    static string hello = "";

    class Net { public string Exe = ""; public long Rx, Tx; public Dictionary<(string ip, int port, string proto), long[]> To = new(); }

    static int Main(string[] args)
    {
        bool demo = args.Length == 1 && args[0] == "--demo";
        if (args.Length > 0 && !demo) return 64;
        if (!demo && TraceEventSession.IsElevated() != true) return 2;   // the task must "run with highest privileges"
        StartPipe(demo ? "vrg-etw-demo" : "vrg-etw");
        new Thread(Writer) { IsBackground = true }.Start();
        new Thread(() => { while (true) { Thread.Sleep(1000); Flush(); } }) { IsBackground = true }.Start();
        return demo ? Demo() : Trace();
    }

    // the ETW session runs only while someone reads the pipe (an open city), and stops 30 s after the last reader left
    static int Trace()
    {
        hello = JsonSerializer.Serialize(new { t = "hello", v = 1, demo = false });
        while (true)
        {
            while (Readers() == 0) Thread.Sleep(500);
            TraceEventSession session;
            try
            {
                session = new TraceEventSession(SessionName) { StopOnDispose = true };   // a named kernel session (Win8+): never takes over "NT Kernel Logger"
                session.EnableKernelProvider(KernelTraceEventParser.Keywords.NetworkTCPIP | KernelTraceEventParser.Keywords.Process |
                    KernelTraceEventParser.Keywords.FileIOInit | KernelTraceEventParser.Keywords.FileIO | KernelTraceEventParser.Keywords.DiskFileIO);
            }
            catch (Exception e) { Send(new { t = "error", where = "kernel", e = e.GetType().Name, m = e.Message }); Thread.Sleep(10000); continue; }
            try { session.EnableProvider("Microsoft-Windows-DNS-Client"); }
            catch (Exception e) { Send(new { t = "error", where = "dns", e = e.GetType().Name }); }
            AppDomain.CurrentDomain.ProcessExit += (_, _) => session.Dispose();
            lock (procs) procs.Clear();   // the rundown (ProcessDCStart) fills it again

            var k = session.Source.Kernel;
            k.TcpIpSend += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "tcp", 0, d.size);
            k.TcpIpRecv += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "tcp", d.size, 0);
            k.TcpIpSendIPV6 += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "tcp", 0, d.size);
            k.TcpIpRecvIPV6 += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "tcp", d.size, 0);
            k.UdpIpSend += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "udp", 0, d.size);
            k.UdpIpRecv += d => Cargo(d.ProcessID, d.ProcessName, d.daddr, d.dport, "udp", d.size, 0);
            k.ProcessStart += d => Proc("start", d.ProcessID, d.ParentID, d.ImageFileName);
            k.ProcessDCStart += d => Proc("run", d.ProcessID, d.ParentID, d.ImageFileName);
            k.ProcessStop += d => Proc("stop", d.ProcessID, 0, "");
            k.FileIORead += d => File(d.ProcessID, d.ProcessName, 'r', d.FileName);
            k.FileIOWrite += d => File(d.ProcessID, d.ProcessName, 'w', d.FileName);
            session.Source.Dynamic.All += e =>
            {
                if (e.ProviderName != "Microsoft-Windows-DNS-Client" || (int)e.ID != 3008) return;   // a query completed
                if (e.PayloadByName("QueryName") is string name && name.Length > 0) Dns(e.ProcessID, e.ProcessName, name);
            };
            new Thread(() =>
            {
                int idle = 0;
                while (idle < 30) { Thread.Sleep(1000); idle = Readers() == 0 ? idle + 1 : 0; }
                session.Dispose();   // Process() below returns
            }) { IsBackground = true }.Start();
            session.Source.Process();
        }
    }

    static int Readers() { lock (clients) return clients.Count; }

    static void Proc(string op, int pid, int ppid, string exe)
    {
        lock (procs) { if (op == "stop") procs.Remove(pid); else procs[pid] = (ppid, exe); }
        Send(new { t = "proc", op, pid, ppid, exe });
    }

    static void Cargo(int pid, string exe, IPAddress addr, int port, string proto, int rx, int tx)
    {
        if (pid == Self) return;
        lock (agg)
        {
            if (!net.TryGetValue(pid, out var n)) net[pid] = n = new Net { Exe = exe };
            n.Rx += rx; n.Tx += tx;
            var key = (addr.ToString(), port, proto);
            if (!n.To.TryGetValue(key, out var v)) { if (n.To.Count > 64) return; n.To[key] = v = new long[2]; }
            v[0] += rx; v[1] += tx;
        }
    }

    static void File(int pid, string exe, char op, string path)
    {
        if (pid == Self || string.IsNullOrEmpty(path) || Repo.Length < 4 || !path.StartsWith(Repo, StringComparison.OrdinalIgnoreCase)) return;
        string rel = path[Repo.Length..];
        if (Skip.Any(s => rel.StartsWith(s, StringComparison.OrdinalIgnoreCase))) return;
        lock (agg) if (files.Count < 300) files.Add(pid + "|" + exe + "|" + op + "|" + rel.Replace('\\', '/'));
    }

    static void Dns(int pid, string exe, string name)
    {
        long now = Environment.TickCount64;
        lock (dnsSeen)
        {
            if (dnsSeen.TryGetValue(name, out long at) && now - at < 10000) return;
            if (dnsSeen.Count > 2000) dnsSeen.Clear();
            dnsSeen[name] = now;
        }
        Send(new { t = "dns", pid, exe, name });
    }

    // once a second: the cargo per process (top 12, each with its top 6 destinations) and the repo files touched
    static void Flush()
    {
        Dictionary<int, Net> n; HashSet<string> f;
        lock (agg) { n = net; net = new(); f = files; files = new(); }
        if (n.Count > 0)
            Send(new { t = "net", list = n.OrderByDescending(kv => kv.Value.Rx + kv.Value.Tx).Take(12).Select(kv => new {
                pid = kv.Key, exe = kv.Value.Exe, rx = kv.Value.Rx, tx = kv.Value.Tx,
                to = kv.Value.To.OrderByDescending(x => x.Value[0] + x.Value[1]).Take(6).Select(x => new { ip = x.Key.ip, port = x.Key.port, proto = x.Key.proto, rx = x.Value[0], tx = x.Value[1] }) }) });
        if (f.Count > 0)
            Send(new { t = "file", list = f.Select(s => s.Split('|', 4)).Select(p => new { pid = int.Parse(p[0]), exe = p[1], op = p[2], path = p[3] }) });
    }

    // --demo: the same lines, made up — git cloning, a Bash grep reading two repo files, a DNS lookup
    static int Demo()
    {
        hello = JsonSerializer.Serialize(new { t = "hello", v = 1, demo = true });
        Proc("run", 4100, 1, "claude.exe"); Proc("start", 4200, 4100, "bash.exe"); Proc("start", 4300, 4200, "git-remote-https.exe");
        for (int i = 0; ; i++)
        {
            Cargo(4300, "git-remote-https.exe", IPAddress.Parse("140.82.121.4"), 443, "tcp", 2_500_000, 12_000);
            if (i % 3 == 0) { File(4200, "bash.exe", 'r', Repo + "README.md"); File(4200, "bash.exe", 'r', Repo + "CodeCity\\companion.js"); }
            if (i == 0) Dns(4300, "git-remote-https.exe", "github.com");
            Thread.Sleep(1000);
        }
    }

    // ---- the pipe: current user read-only, no network, any number of readers (up to 4 at a time)
    static void StartPipe(string name)
    {
        var sec = new PipeSecurity();
        var user = WindowsIdentity.GetCurrent().User!;
        sec.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.Read | PipeAccessRights.WriteAttributes | PipeAccessRights.Synchronize, AccessControlType.Allow));
        sec.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
        sec.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
        sec.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null), PipeAccessRights.FullControl, AccessControlType.Deny));
        if (TraceEventSession.IsElevated() != true)   // --demo: the creating (non-admin) user must also create the next instance
            sec.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.CreateNewInstance, AccessControlType.Allow));
        new Thread(() =>
        {
            while (true)
            {
                try
                {
                    var p = NamedPipeServerStreamAcl.Create(name, PipeDirection.Out, 4, PipeTransmissionMode.Byte, PipeOptions.None, 0, 65536, sec);
                    p.WaitForConnection();
                    var w = new StreamWriter(p, new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" };
                    string tree;
                    lock (procs) tree = JsonSerializer.Serialize(new { t = "procs", list = procs.Select(kv => new { pid = kv.Key, ppid = kv.Value.ppid, exe = kv.Value.exe }) });
                    lock (clients) { w.WriteLine(hello); w.WriteLine(tree); clients.Add(w); }
                }
                catch { Thread.Sleep(1000); }
            }
        }) { IsBackground = true }.Start();
    }

    static void Send(object o) { outbox.TryAdd(JsonSerializer.Serialize(o)); }   // a full outbox drops lines rather than stall ETW

    static void Writer()
    {
        foreach (var line in outbox.GetConsumingEnumerable())
        {
            lock (clients)
                foreach (var w in clients.ToList())
                {
                    try { w.WriteLine(line); }
                    catch { clients.Remove(w); try { w.Dispose(); } catch { } }
                }
        }
    }
}
