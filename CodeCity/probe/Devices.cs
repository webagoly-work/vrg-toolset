// Devices.cs — the USB tree and the paired Bluetooth devices (P10, KV-22), from SetupAPI, every 2 s (a plug-in shows
// within 2 s). USB: each device's port chain from DEVPKEY_Device_LocationPaths (PCIROOT…#USBROOT(n)#USB(3)#USB(1)),
// interfaces of composite devices left out. Bluetooth: the paired devices (BTHENUM\DEV_*, BTHLE\DEV_*); a battery level
// is published only while a device is connected (on its hands-free child node), so a reported battery = connected.
// No instance id, serial or address travels — only a short hash of it.
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

static class Devices
{
    [StructLayout(LayoutKind.Sequential)] struct SP_DEVINFO_DATA { public uint cbSize; public Guid ClassGuid; public uint DevInst; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)] struct DEVPROPKEY { public Guid fmtid; public uint pid; public DEVPROPKEY(string g, uint p) { fmtid = new Guid(g); pid = p; } }
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode)] static extern IntPtr SetupDiGetClassDevsW(IntPtr guid, string? enumerator, IntPtr hwnd, uint flags);
    [DllImport("setupapi.dll")] static extern bool SetupDiEnumDeviceInfo(IntPtr set, uint i, ref SP_DEVINFO_DATA d);
    [DllImport("setupapi.dll")] static extern bool SetupDiGetDevicePropertyW(IntPtr set, ref SP_DEVINFO_DATA d, ref DEVPROPKEY key, out uint type, byte[]? buf, uint size, out uint req, uint flags);
    [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);

    static readonly DEVPROPKEY InstanceId = new("78c34fc8-104a-4aca-9ea4-524d52996e57", 256), FriendlyName = new("a45c254e-df1c-4efd-8020-67d146a850e0", 14),
        DeviceDesc = new("a45c254e-df1c-4efd-8020-67d146a850e0", 2), Class = new("a45c254e-df1c-4efd-8020-67d146a850e0", 9),
        LocationPaths = new("a45c254e-df1c-4efd-8020-67d146a850e0", 37), BusDesc = new("540b947e-8b40-45bc-a8a2-6a0b894cbda2", 4),
        ContainerId = new("8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c", 2), Battery = new("104ea319-6ee2-4701-bd47-8ddbf425bbe5", 2),
        LastConnected = new("2bd67d8b-8beb-48d5-87e0-6cda3428040a", 11);
    static string usbSig = "", btSig = "";

    public static void Run()
    {
        while (true)
        {
            try { Usb(); } catch { }
            try { Bluetooth(); } catch { }
            Thread.Sleep(2000);
        }
    }

    static void Usb()
    {
        var roots = new List<string>();
        var list = new List<object>();
        foreach (var get in Each("USB"))
        {
            var path = (get(LocationPaths) as string[] ?? Array.Empty<string>()).FirstOrDefault(p => p.StartsWith("PCIROOT") && p.Contains("USBROOT"));
            if (path == null || path.Contains("USBMI")) continue;
            int k = path.IndexOf("#USB(", path.IndexOf("USBROOT")); string root = k < 0 ? path : path[..k];
            if (!roots.Contains(root)) roots.Add(root);
            var chain = Regex.Matches(k < 0 ? "" : path[k..], @"#USB\((\d+)\)").Select(m => int.Parse(m.Groups[1].Value)).ToArray();
            if (chain.Length == 0) continue;   // the root hub itself: a row of the board, not a device
            string name = get(BusDesc) as string ?? get(FriendlyName) as string ?? get(DeviceDesc) as string ?? "?";
            list.Add(new { id = Hash(get(InstanceId) as string), name = name.Trim(), cls = get(Class) as string ?? "", root = roots.IndexOf(root), chain });
        }
        string j = System.Text.Json.JsonSerializer.Serialize(list);
        if (j == usbSig) return;
        usbSig = j;
        Probe.Emit(new { t = "usb", roots = roots.Count, list });
    }

    static void Bluetooth()
    {
        var battery = new Dictionary<string, int>();
        foreach (var en in new[] { "BTHENUM", "BTHLEDEVICE", "BTHLE" })
            foreach (var get in Each(en))
                if (get(Battery) is byte b && get(ContainerId) is Guid c) battery[c.ToString()] = b;
        var list = new List<object>();
        foreach (var en in new[] { "BTHENUM", "BTHLE" })
            foreach (var get in Each(en))
            {
                string id = get(InstanceId) as string ?? "";
                if (!Regex.IsMatch(id, @"^BTH(ENUM|LE)\\DEV_", RegexOptions.IgnoreCase)) continue;
                string cont = get(ContainerId) is Guid c ? c.ToString() : "";
                int? batt = battery.TryGetValue(cont, out int bv) ? bv : null;
                var last = get(LastConnected) is DateTime t ? t.ToString("o") : null;
                list.Add(new { id = Hash(id), name = (get(FriendlyName) as string ?? get(DeviceDesc) as string ?? "?").Trim(), le = id.StartsWith("BTHLE", StringComparison.OrdinalIgnoreCase),
                    battery = batt, connected = batt != null, last });
            }
        string j = System.Text.Json.JsonSerializer.Serialize(list);
        if (j == btSig) return;
        btSig = j;
        Probe.Emit(new { t = "bt", list });
    }

    // every present device of one enumerator, as a property getter
    static IEnumerable<Func<DEVPROPKEY, object?>> Each(string enumerator)
    {
        IntPtr set = SetupDiGetClassDevsW(0, enumerator, 0, 0x2 /* PRESENT */ | 0x4 /* ALLCLASSES */);
        if (set == -1) yield break;
        try
        {
            var d = new SP_DEVINFO_DATA { cbSize = (uint)Marshal.SizeOf<SP_DEVINFO_DATA>() };
            for (uint i = 0; SetupDiEnumDeviceInfo(set, i, ref d); i++)
            {
                var dd = d;
                yield return key => Prop(set, dd, key);
            }
        }
        finally { SetupDiDestroyDeviceInfoList(set); }
    }

    static object? Prop(IntPtr set, SP_DEVINFO_DATA d, DEVPROPKEY key)
    {
        SetupDiGetDevicePropertyW(set, ref d, ref key, out _, null, 0, out uint need, 0);
        if (need == 0 || need > 65536) return null;
        var buf = new byte[need];
        if (!SetupDiGetDevicePropertyW(set, ref d, ref key, out uint type, buf, need, out _, 0)) return null;
        return type switch
        {
            0x12 => Encoding.Unicode.GetString(buf).TrimEnd('\0'),
            0x2012 => Encoding.Unicode.GetString(buf).Split('\0', StringSplitOptions.RemoveEmptyEntries),
            0x03 => buf[0],
            0x0D => new Guid(buf),
            0x10 => DateTime.FromFileTimeUtc(BitConverter.ToInt64(buf, 0)),
            _ => null
        };
    }

    static string Hash(string? s) => s == null ? "" : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)))[..10].ToLowerInvariant();
}
