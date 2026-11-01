// Sensors.cs — CPU temperature, fans, voltages and disk temperature for Gépország (CITY-D51 A), through LibreHardwareMonitorLib
// 0.9.6 (MPL-2.0, pinned in packages.lock.json). Read-only: nothing here sets a fan or a voltage, and the library is only ever
// asked to read. It uses the PawnIO driver, which the user installs; the library has no installer in it, and if PawnIO is
// missing this says so and sends what it can. Opened only while someone reads the pipe, closed 30 s after the last reader, as
// the ETW session is. Motherboard, CPU and storage only: no GPU (nvidia-smi has it), no memory SPD, no USB controllers.
using LibreHardwareMonitor.Hardware;

static class Sensors
{
    const int EveryMs = 5000, CloseAfterMs = 30000;

    class Rows : IVisitor
    {
        public readonly List<object> List = new();
        public void VisitComputer(IComputer c) => c.Traverse(this);
        public void VisitHardware(IHardware h) { h.Update(); h.Traverse(this); }
        public void VisitParameter(IParameter p) { }
        public void VisitSensor(ISensor s)
        {
            var kind = s.SensorType switch { SensorType.Temperature => "temp", SensorType.Fan => "fan", SensorType.Voltage => "volt", SensorType.Power => "power", _ => "" };
            if (kind == "" || s.Value is not float v || float.IsNaN(v)) return;
            var hw = s.Hardware.Parent ?? s.Hardware;
            var group = hw.HardwareType switch { HardwareType.Cpu => "cpu", HardwareType.Motherboard => "board", HardwareType.Storage => "disk", _ => "" };
            if (group == "") return;
            // the model name of a disk, never its serial: the Identifier is left out on purpose
            List.Add(new { g = group, hw = Short(hw.Name), k = kind, n = Short(s.Name), v = Math.Round(v, 1) });
        }
        static string Short(string s) => s.Length > 40 ? s[..40] : s;
    }

    static object Read(Computer pc)
    {
        var rows = new Rows();
        pc.Accept(rows);
        return new { t = "sens", at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), pawnio = PawnIoState(), list = rows.List };
    }
    static bool PawnIoState() { try { return LibreHardwareMonitor.PawnIo.PawnIo.IsInstalled; } catch (Exception) { return false; } }

    public static void Loop(Func<int> readers, Action<object> send)
    {
        Computer? pc = null;
        var idle = 0;
        while (true)
        {
            if (readers() == 0)
            {
                idle += 1000;
                if (pc != null && idle >= CloseAfterMs) { try { pc.Close(); } catch (Exception) { } pc = null; }
                Thread.Sleep(1000);
                continue;
            }
            idle = 0;
            try
            {
                if (pc == null) { pc = new Computer { IsCpuEnabled = true, IsMotherboardEnabled = true, IsStorageEnabled = true }; pc.Open(); }
                send(Read(pc));
            }
            catch (Exception e) { send(new { t = "error", where = "sensors", e = e.GetType().Name }); }
            Thread.Sleep(EveryMs);
        }
    }
    // --demo: made-up readings of the same shape, for the pipe and the segéd
    public static void Demo(Func<int> readers, Action<object> send)
    {
        while (true)
        {
            if (readers() > 0) send(new { t = "sens", at = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), pawnio = false, demo = true, list = new object[]
            {
                new { g = "cpu", hw = "Próba CPU", k = "temp", n = "Core Average", v = 47.5 }, new { g = "board", hw = "Próba alaplap", k = "fan", n = "Fan #1", v = 900.0 },
            } });
            Thread.Sleep(EveryMs);
        }
    }
}
