package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// F8 Összefésülés (WP M53): the forks F1–F4 tested TOGETHER, end to end. Each scenario is a realistic survey built with
// the phone's own edit operations (the drawing, the intake, Kamera 2, the wants by room, the site on the map, a variant),
// then: SketchJson write → read (lossless) → the package exactly as the Rendezés export writes it (PlannerExport + the
// takeoff inside, NormScreen.writeExport) → Sketcher/test/fixtures/e2e/<id>.json. The Desktop page and the Planner open
// that same file in Sketcher/test/e2e.test.js (node Sketcher/test/run.js) and must show the same numbers the phone wrote.
//
// The fixtures are checked here (stale = fail); VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test rewrites them.
// Two hand-written old files (an M24 v1 sketch, an M29-era v2 survey) must open unchanged.
class E2eTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val dir = File(repo, "Sketcher/test/fixtures/e2e")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private val rules = TakeoffRules.parse(File(repo, "Sketcher/catalog/takeoff.json").readText())
    private val variants = File(repo, "Sketcher/variants").listFiles { f -> f.name.endsWith(".json") }!!
        .map { FieldKit.parseVariant(it.readText()) }.associateBy { it.id }
    private val update = System.getProperty("vrg.sketch.fixture") == "update"

    companion object {
        const val NOW = 1763700000000L
        const val TOL = 6.0
    }

    private fun kitFor(s: Sketch) = if (s.variantOn) kit.with(variants[s.variant]) else kit
    private fun ans(s: Sketch, q: String, vararg o: String, state: AnswerState = AnswerState.ANSWERED, text: String = "") =
        Intake.answer(kitFor(s), s, q, o.toList(), text, state, NOW - 5000)

    /** A rectangle of [w] × [d] metres around [lat0]/[lon0], turned [deg] — the building as OSM would give it. */
    private fun outline(lat0: Double, lon0: Double, w: Double, d: Double, deg: Double): List<Pair<Double, Double>> =
        listOf(Pt(-w / 2, -d / 2), Pt(w / 2, -d / 2), Pt(w / 2, d / 2), Pt(-w / 2, d / 2))
            .map { SitePlace.turn(it, deg) }.map { SitePlace.toLatLon(lat0, lon0, it.x, it.y) }

    // ---- scenario A: a flat renovated, everything the forks added in one survey ----------------------------------------
    private fun flat(): Sketch {
        var s = Sketch("S-A", "Petőfi u. 7. 2/5", Level.UPPER, created = NOW - 3_600_000, updated = NOW)
        val (s1, kitchen) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(120.0, 100.0), TOL)!!; s = s1
        val (s2, bath) = Ops.addRectRoom(s, Pt(120.0, 0.0), Pt(180.0, 100.0), TOL)!!; s = s2
        val (s3, hall) = Ops.addRectRoom(s, Pt(0.0, 100.0), Pt(180.0, 140.0), TOL)!!; s = s3
        s = Ops.renameRoom(s, hall, "Előszoba")
        s = Ops.toggleKind(s, kitchen, "konyha"); s = Ops.toggleKind(s, bath, "furdo")
        s = Ops.setMeasure(s, kitchen, MeasureKind.WIDTH, 3600); s = Ops.setMeasure(s, kitchen, MeasureKind.DEPTH, 3000)
        s = Ops.setMeasure(s, bath, MeasureKind.WIDTH, 1800)
        s = Ops.setMeasure(s, hall, MeasureKind.DEPTH, 1200)
        // points: what is on the wall today and what the job adds
        val (a1, sockOld) = Ops.addPoint(s, Pt(40.0, 1.0), PointType.SOCKET, PointState.EXISTING, TOL); s = a1
        val (a2, sockOld2) = Ops.addPoint(s, Pt(80.0, 1.0), PointType.SOCKET, PointState.EXISTING, TOL); s = a2
        val (a3, sockNew) = Ops.addPoint(s, Pt(1.0, 50.0), PointType.SOCKET, PointState.PLANNED, TOL); s = a3
        val (a4, hob) = Ops.addPoint(s, Pt(119.0, 30.0), PointType.FIXED, PointState.PLANNED, TOL); s = a4
        val (a5, light) = Ops.addPoint(s, Pt(60.0, 50.0), PointType.LIGHT, PointState.EXISTING, TOL); s = a5
        val (a6, sw) = Ops.addPoint(s, Pt(10.0, 99.0), PointType.SWITCH, PointState.EXISTING, TOL); s = a6
        val (a7, bathLight) = Ops.addPoint(s, Pt(150.0, 50.0), PointType.LIGHT, PointState.PLANNED, TOL); s = a7
        val (a8, board) = Ops.addPoint(s, Pt(179.0, 120.0), PointType.BOARD, PointState.EXISTING, TOL); s = a8
        // Bontás and the built-in Csere (D-77) on the old sockets; the hob's circuit dedicated
        s = Ops.placeTag(s, "T-bontas", sockOld, null)!!.first
        s = Ops.placeTag(s, "T-csere", sockOld2, null)!!.first
        s = Ops.placeTag(s, "T-csere", light, null)!!.first
        s = Ops.placeTag(s, "T-ip44", bathLight, null)!!.first
        val (c1, kc) = Ops.newCircuit(s, listOf(sockOld, sockOld2, sockNew)); s = c1
        s = Ops.renameCircuit(s, kc, "Konyha dugalj")
        val (c2, hc) = Ops.newCircuit(s, listOf(hob)); s = c2
        s = Ops.renameCircuit(s, hc, "Főzőlap"); s = Ops.setDedicated(s, hc, true)
        val (c3, lc) = Ops.newCircuit(s, listOf(light, sw, bathLight)); s = c3
        s = Ops.renameCircuit(s, lc, "Világítás")
        s = Ops.setBoard(s, kc, board); s = Ops.setBoard(s, hc, board); s = Ops.setBoard(s, lc, board)
        val (r1, route) = Ops.addRoute(s, listOf(s.point(sw)!!.at, Pt(10.0, 60.0), s.point(light)!!.at), TOL)!!; s = r1
        s = s.copy(routes = s.routes.map { if (it.id == route) it.copy(circuit = lc) else it })
        s = Ops.addMemo(s, Pt(45.0, 8.0), "régi alu, porcelán dobozok", sockOld)!!.first
        // the photo point (M25): two directions in the kitchen
        val (f1, fp) = PhotoOps.add(s, Pt(60.0, 60.0), TOL); s = f1
        s = PhotoOps.addShot(s, fp, 0, "F-k-e.jpg", NOW - 9000).first
        s = PhotoOps.addShot(s, fp, 180, "F-k-d.jpg", NOW - 8900).first
        // the intake: notes with chips, an open one, the scope, the answers
        s = Intake.addEntry(s, "Az alu vezetéket mind cserélni kell", listOf("problema", "fontos"), kitchen, null, false, false, NOW - 7000)!!.first
        s = Intake.addEntry(s, "Indukciós főzőlap kell a konyhába", listOf("kivansag"), kitchen, null, false, true, NOW - 6900)!!.first
        s = Intake.addEntry(s, "", listOf("lakott", "haziallat"), null, null, false, false, NOW - 6800)!!.first
        s = Intake.addEntry(s, "A fürdő szellőzője a közösbe megy?", listOf("tisztazando"), bath, null, true, false, NOW - 6700)!!.first
        s = Intake.setScope(s, "felujitas", 1); s = Intake.setScope(s, "konyha", 1); s = Intake.setScope(s, "furdo", 1)
        s = Intake.setScope(s, "eloszto", 1); s = Intake.setScope(s, "fozolap", 1)
        // the client's wants by room (F4): 3 sockets in the kitchen, 1 in the hall, 1 for the job; a lamp in the bath
        s = Wants.add(s, "dugalj", kitchen, 3); s = Wants.add(s, "dugalj", hall, 1); s = Wants.add(s, "dugalj", null, 1)
        s = Wants.add(s, "lampa", bath, 1)
        s = ans(s, "lenyeg", "csere"); s = ans(s, "ingatlan", "tarsashaz"); s = ans(s, "kor", "70-90"); s = ans(s, "anyag", "alu")
        s = ans(s, "gepek", "fozolap", "mosogatogep"); s = ans(s, "fozolap_tipus", "indukcio")
        s = ans(s, "keret", "max", text = "1,5 M Ft"); s = ans(s, "hatarido", state = AnswerState.LATER); s = ans(s, "doksi", state = AnswerState.SKIP)
        // the variant (F4 / M31): the bathroom renovation, on
        s = VariantOps.activate(s, variants.getValue("furdo-felujitas"))
        s = ans(s, "furdo_mit", "lampa", "szellozo")
        // Kamera 2 (F3): a board photo with GPS and a type-plate reading, a personal before photo blurred and its after,
        // a photo whose GPS is kept, the walk video, the client's signature
        var cs = Intake.addCapture(s, "C-eloszto.jpg", "eloszto", hall, board, null, NOW - 4000, 47.497912, 19.040235); s = cs.first; val cBoard = cs.second
        s = TypePlate.store(s, cBoard, "B16 3x25A IΔn 30mA No. 12345678", NOW - 3990)
        cs = Intake.addCapture(s, "C-hiba1.jpg", "hiba", kitchen, sockOld, null, NOW - 3800, 47.497912, 19.040235); s = cs.first; val cBefore = cs.second
        s = Intake.editCapture(s, cBefore) { it.copy(privacy = true, note = "a lakó a képen", marks = listOf(
            Mark(MarkKind.BLUR, listOf(Pt(0.1, 0.1), Pt(0.4, 0.5))), Mark(MarkKind.ARROW, listOf(Pt(0.6, 0.6), Pt(0.8, 0.7))))) }
        s = Camera2.markBefore(s, cBefore)
        cs = Intake.addCapture(s, "C-hiba2.jpg", "hiba", kitchen, sockOld, null, NOW - 3000); s = cs.first; val cAfter = cs.second
        s = Camera2.pair(s, cAfter, cBefore)
        cs = Intake.addCapture(s, "C-epulet.jpg", "epulet", null, null, null, NOW - 2900, 47.4979, 19.0402); s = cs.first
        s = Intake.editCapture(s, cs.second) { it.copy(keepGps = true) }
        s = Camera2.addVideo(s, "V-seta.mp4", "nyomvonal", hall, null, 72_000, 41_943_040, NOW - 2500).first
        s = Camera2.addSignature(s, "S-alairas.png", "Kovács Éva", Camera2.STATEMENTS[2], NOW - 1000).first
        // F5: the client's contact (not kept in the package, D-82) and a sound note (D-84)
        s = ClientInfo.set(s, "Minta Ügyfél", "+36 30 000 0000", "minta@example.invalid")
        s = AudioNotes.add(s, "hang_1.m4a", kitchen, 42_000, 300_000, NOW - 900).first
        // F1: the place, the building from OSM, the sketch fitted on it
        s = Intake.setSite(s) { it.copy(address = "Budapest, Petőfi u. 7.", lat = 47.4979, lon = 19.0402, source = "osm") }
        val ring = outline(47.4979, 19.0402, 9.0, 6.0, 12.0)
        val norm = Solver().solve(s)
        val place = SitePlace.autoFit(SitePlace.rooms(norm), ring, NOW - 500)!!
        s = SiteLink.apply(s, SiteLink.Result(s.id, ring, "osm", place, false), NOW - 500)
        s = Intake.markSeen(s, FieldKit.unseen(kitFor(s), s), NOW - 400)
        return s.copy(draft = "", updated = NOW)
    }

    // ---- scenario B: a new house with a garage, an EV charger, two air conditioners; implied circuits ON ----------------
    private fun newHouse(): Sketch {
        var s = Sketch("S-B", "Új ház, Kert u. 3", Level.GROUND, created = NOW - 7_200_000, updated = NOW)
        val (s1, living) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(200.0, 150.0), TOL)!!; s = s1
        val (s2, garage) = Ops.addRectRoom(s, Pt(200.0, 0.0), Pt(320.0, 150.0), TOL)!!; s = s2
        s = Ops.toggleKind(s, living, "nappali"); s = Ops.renameRoom(s, garage, "Garázs")
        s = Ops.setMeasure(s, living, MeasureKind.WIDTH, 6200); s = Ops.setMeasure(s, living, MeasureKind.DEPTH, 4500)
        s = Ops.setMeasure(s, garage, MeasureKind.WIDTH, 3600)
        val (p1, b) = Ops.addPoint(s, Pt(201.0, 20.0), PointType.BOARD, PointState.PLANNED, TOL); s = p1
        val (p2, ev) = Ops.addPoint(s, Pt(319.0, 100.0), PointType.FIXED, PointState.PLANNED, TOL); s = p2
        val (p3, ac) = Ops.addPoint(s, Pt(100.0, 1.0), PointType.FIXED, PointState.PLANNED, TOL); s = p3
        val (p4, so) = Ops.addPoint(s, Pt(1.0, 75.0), PointType.SOCKET, PointState.PLANNED, TOL); s = p4
        val (p5, da) = Ops.addPoint(s, Pt(150.0, 149.0), PointType.DATA, PointState.PLANNED, TOL); s = p5
        val (p6, sen) = Ops.addPoint(s, Pt(260.0, 75.0), PointType.SENSOR, PointState.PLANNED, TOL); s = p6
        val (k1, evc) = Ops.newCircuit(s, listOf(ev)); s = k1; s = Ops.renameCircuit(s, evc, "E-autó")
        val (k2, acc) = Ops.newCircuit(s, listOf(ac)); s = k2; s = Ops.renameCircuit(s, acc, "Klíma")
        s = Ops.placeTag(s, "T-ded", ac, null)!!.first
        val (k3, gc) = Ops.newCircuit(s, listOf(so, sen)); s = k3
        s = Ops.connectCircuits(s).first
        s = Ops.addRoute(s, listOf(s.point(b)!!.at, Pt(260.0, 20.0), Pt(318.0, 20.0), s.point(ev)!!.at), TOL)!!.first
        s = Ops.addMemo(s, Pt(250.0, 140.0), "a töltő a kapu felé", ev)!!.first
        s = Ops.placeTag(s, "T-nedves", null, Pt(300.0, 140.0))!!.first
        s = Intake.setScope(s, "uj", 1); s = Intake.setScope(s, "egesz", 1); s = Intake.setScope(s, "ev", 1)
        s = Intake.setScope(s, "klima", 2); s = Intake.setScope(s, "okos", 1)
        s = Wants.add(s, "dugalj", living, 6); s = Wants.add(s, "dugalj", garage, 2); s = Wants.add(s, "lampa", null, 4)
        s = ans(s, "lenyeg", "uj"); s = ans(s, "ingatlan", "csaladi"); s = ans(s, "auto_kw", "11"); s = ans(s, "tavolsag", "15")
        s = ans(s, "parkolo", "garazs"); s = ans(s, "klima_db", "2"); s = ans(s, "fazis", "3f")
        s = Intake.addEntry(s, "Később napelem is jöhet", listOf("kivansag"), null, null, false, false, NOW - 6000)!!.first
        s = Intake.addEntry(s, "", listOf("kulcs", "hetvege"), null, null, false, false, NOW - 5900)!!.first
        s = Intake.addCapture(s, "B-merohely.jpg", "merohely", null, null, null, NOW - 4000).first
        // the job's place from the phone's GPS only: no outline yet, so no placement and no report
        s = Intake.setSite(s) { it.copy(address = "Szentendre, Kert u. 3.", lat = 47.669, lon = 19.0755, source = "gps") }
        return s.copy(updated = NOW)
    }

    // ---- scenario C: the conversation only, nothing drawn (the first visit) -----------------------------------------------
    private fun talkOnly(): Sketch {
        var s = Sketch("S-C", "Telefonos felmérés", Level.GROUND, created = NOW - 600_000, updated = NOW)
        s = Intake.addEntry(s, "A biztosíték néha leold, ha megy a mosógép és a vízforraló", listOf("problema"), null, null, false, true, NOW - 500_000)!!.first
        s = Intake.addEntry(s, "Mikor jó a helyszíni bejárás?", listOf("visszakerdez", "tisztazando"), null, null, true, false, NOW - 400_000)!!.first
        s = Intake.setScope(s, "hiba", 1); s = Intake.setScope(s, "felulvizsgalat", 1)
        s = Wants.add(s, "dugalj", null, 2)
        s = ans(s, "lenyeg", "javitas"); s = ans(s, "gond", "leold"); s = ans(s, "biztositek", "olvado")
        s = ans(s, "kor", state = AnswerState.LATER)
        s = Camera2.addSignature(s, "S-c.png", "Nagy Béla", Camera2.STATEMENTS[0], NOW - 1000).first
        s = Intake.setSite(s) { it.copy(address = "Vác", source = "kezi") }
        return s.copy(updated = NOW)
    }

    private data class Scenario(val id: String, val title: String, val sketch: Sketch, val implied: Boolean) {
        /** The survey as the phone has it after it was saved and reopened (the fitted site numbers rounded). */
        val saved: Sketch get() = SketchJson.read(SketchJson.write(sketch).toString())!!
    }
    private fun scenarios() = listOf(
        Scenario("a-lakas-felujitas", "Lakásfelújítás: rajz, Csere/Bontás, igények szobánként, Kamera 2, helyszín a térképen, variáns", flat(), false),
        Scenario("b-uj-haz-ev", "Új ház e-autó töltővel, klímával; a „dedikált kör a nagy gépeknek” bekapcsolva", newHouse(), true),
        Scenario("c-csak-beszelgetes", "Csak beszélgetés: jegyzet, válasz, munkakör, aláírás, rajz nélkül", talkOnly(), false),
    )

    /** What the phone's Rendezés export writes (NormScreen.writeExport): the package with the takeoff inside. */
    private fun export(s0: Sketch, implied: Boolean): Pair<JSONObject, Takeoff.Result> {
        val s = SketchFeatures.forExport(emptySet(), s0)   // F5: the client only when kept, sound notes when on
        val n = Solver().solve(s)
        val tk = Takeoff.build(kitFor(s), rules, s, PlanView.of(s, n), now = NOW, impliedDedicated = implied)
        return PlannerExport.build(s, n, NOW).put("takeoff", tk.json) to tk
    }

    /** What the phone itself shows for the survey, for the Desktop and the Planner to match. */
    private fun phone(s0: Sketch, tk: Takeoff.Result, pkg: JSONObject): JSONObject {
        val s = SketchFeatures.forExport(emptySet(), s0)
        val n = Solver().solve(s)
        val k = kitFor(s)
        val site = s.site
        val rep = if (site?.place != null && site.outline.size >= 3) SitePlace.report(SitePlace.rooms(n), site.outline, site.place) else null
        val files = PlannerExport.photoFiles(s).map { it.second } + s.captures.flatMap { c ->
            val name = Intake.exportName(s, c); val plan = Camera2.exportPlan(c)
            listOf(name) + if (plan.marked) listOf(name.removeSuffix(".jpg") + "_jel.jpg") else emptyList()
        }
        return JSONObject()
            .put("items", JSONArray(tk.items.map { JSONArray().put(it.id).put(it.qty).put(it.est) }))
            .put("counts", tk.json.getJSONObject("counts"))
            .put("questions", JSONObject().put("answered", tk.questions.count { it.state == "answered" }).put("open", tk.questions.count { it.state != "answered" }))
            .put("open", FieldKit.open(k, s, n).size)
            .put("wants", JSONArray(Wants.byRoom(k, s).map { (room, l) -> JSONObject().put("room", room ?: JSONObject.NULL)
                .put("items", JSONObject().also { o -> l.forEach { (id, q) -> o.put(id, q) } }) }))
            .put("site", JSONObject().put("lines", JSONArray(SitePlace.lines(rep))).put("verdict", rep?.verdict ?: JSONObject.NULL))
            .put("files", JSONArray(files))
            .put("gps", JSONObject().also { o -> s.captures.forEach { c -> o.put(c.id, Camera2.exportPlan(c).gps) } })
            .put("floors", pkg.getJSONObject("plan").getJSONObject("data").getJSONArray("floors").length())
            .put("devices", pkg.getJSONObject("plan").getJSONObject("data").getJSONArray("devices").length())
    }

    private fun fixture(sc: Scenario): JSONObject {
        val (pkg, tk) = export(sc.saved, sc.implied)
        return JSONObject()
            .put("about", "F8 (WP M53) end-to-end scenario, written by sketch-core E2eTest (VRG_SKETCH_FIXTURE=update); read by Sketcher/test/e2e.test.js. Do not edit.")
            .put("id", sc.id).put("title", sc.title).put("now", NOW)
            .put("package", pkg)
            .put("markdown", Takeoff.markdown(tk.json))
            .put("phone", phone(sc.saved, tk, pkg))
    }

    @Test fun scenariosAreLosslessAndTheFixturesCurrent() {
        dir.mkdirs()
        scenarios().forEach { sc ->
            val s = sc.sketch
            // the file the phone saves after every edit reads back as the same survey, and writes the same text again
            val w1 = SketchJson.write(s)
            val back = SketchJson.read(w1.toString())
            assertNotNull(back, sc.id)
            // (numbers are stored rounded: sketch units to 0.1, a wall position to 1e-4, lat/lon to 1e-6 / 1e-7, the turn
            // to 0.01°; everything else is exact)
            fun shape(x: Sketch) = listOf(x.rooms.map { it.id to it.kinds }, x.points.map { Triple(it.id, it.type, it.state) }, x.measures, x.circuits,
                x.routes.map { Triple(it.id, it.a, it.b) to it.circuit }, x.memos.map { it.text }, x.tags, x.tagUses, x.photos.map { it.shots }, x.entries, x.scope,
                x.answers, x.captures.map { it.copy(lat = null, lon = null) }, x.dismissed, x.seen, x.variant, x.variantOn, x.roomScope, x.plugins,
                x.site?.copy(lat = null, lon = null, footprint = null, outline = emptyList(), place = null), x.site?.outline?.size, x.site?.place?.auto)
            assertEquals(shape(s), shape(back), "${sc.id}: write → read gives the same survey")
            assertEquals(w1.toString(), SketchJson.write(back).toString(), "${sc.id}: and the same file")
            assertEquals(back, SketchJson.read(SketchJson.write(back).toString()), "${sc.id}: a second round changes nothing")
            // the package's sketch is the survey (it reopens on the phone)
            val (pkg, tk) = export(s, sc.implied)
            assertEquals(SketchFeatures.forExport(emptySet(), back), SketchJson.read(pkg.getJSONObject("sketch")), "${sc.id}: the package's sketch reopens as the survey")
            // the takeoff from the package's plan is the one the phone computed from its own solve
            val fromPkg = Takeoff.build(kitFor(s), rules, SketchFeatures.forExport(emptySet(), s), PlanView.fromPackage(pkg), now = NOW, impliedDedicated = sc.implied)
            assertTrue(fromPkg.json.similar(tk.json), "${sc.id}: the takeoff is the same from the package")
            val f = File(dir, sc.id + ".json")
            val fx = fixture(sc)
            if (update) f.writeText(fx.toString(1) + "\n")
            assertTrue(f.exists() && JSONObject(f.readText()).similar(fx), "${f.name} is stale: VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test")
        }
    }

    @Test fun theSeamsHoldInTheFlatScenario() {
        val s = flat()
        val (pkg, tk) = export(s, false)
        val items = tk.items.associateBy { it.id }
        // Csere (D-77) and Bontás by tag; the wants reconcile with the drawing (D-68): 5 wanted, 1 new drawn
        assertEquals(1.0, items["pont.socket.bontas"]?.qty); assertEquals(1.0, items["pont.socket.csere"]?.qty)
        assertEquals(1.0, items["pont.light.csere"]?.qty)
        assertEquals(5.0, items["pont.socket.uj"]?.qty); assertTrue(items["pont.socket.uj"]!!.est)
        // the hob's circuit is dedicated by its own flag; implied circuits off (D-79): a check line instead
        assertEquals(1.0, items["aramkor.dedikalt"]?.qty); assertFalse(items["aramkor.dedikalt"]!!.est)
        assertTrue(tk.checks.any { "dedikált kör kellhet" in it }, tk.checks.toString())
        // the media: the video and the signature listed under their export names, counted with their purposes
        val files = tk.photos.flatMap { it.files }
        assertTrue(files.any { it.endsWith("_nyomvonal.mp4") } && files.any { it.endsWith("_alairas.png") }, files.toString())
        assertEquals(files.size, files.toSet().size)
        assertTrue(files.all { f -> s.captures.any { Intake.exportName(s, it) == f } }, "every listed file is one the export writes")
        // F5 (D-82): the client's contact stays on the phone unless kept; the sound note goes, and is no photo (D-84)
        assertNotNull(s.client); assertFalse(pkg.getJSONObject("sketch").has("client"), "the contact is not in the package")
        assertFalse("Minta Ügyfél" in pkg.toString() || "example.invalid" in pkg.toString())
        assertTrue(pkg.getJSONObject("sketch").getJSONArray("captures").let { a -> (0 until a.length()).any { a.getJSONObject(it).optString("kind") == "audio" } })
        assertTrue(files.none { it.endsWith(".m4a") })
        val kept = export(ClientInfo.setKeep(s, true), false).first
        assertTrue(kept.getJSONObject("sketch").has("client"), "kept: it goes")
        assertFalse(export(s.copy(), false).first.toString().contains("minta@"))
        // the wants by room in the package (F4): on the floors and in plan.wants
        val floors = pkg.getJSONObject("plan").getJSONObject("data").getJSONArray("floors")
        val withWants = (0 until floors.length()).map { floors.getJSONObject(it) }.filter { it.getJSONObject("sk").has("wants") }
        assertEquals(3, withWants.size)
        assertTrue(pkg.getJSONObject("plan").has("wants"))
        // privacy (D-57): the personal photo leaves only blurred, never with GPS; a kept-GPS photo keeps it; the rest lose it
        val by = s.captures.associateBy { it.purpose + (if (it.phase != null) ":" + it.phase else "") }
        val before = by.getValue("hiba:elotte")
        Camera2.exportPlan(before).let { assertTrue(it.burnBlur && it.marked && !it.gps) }
        assertTrue(Camera2.exportPlan(by.getValue("epulet")).gps)
        assertFalse(Camera2.exportPlan(by.getValue("eloszto")).gps)
        assertTrue(Camera2.exportPlan(by.getValue("eloszto"), stripGps = false).gps, "the GPS strip switch off keeps it (D-90)")
        assertFalse(Camera2.exportPlan(before, stripGps = false).gps, "a personal photo never keeps it")
        assertTrue(s.captures.filter { it.kind != CaptureKind.PHOTO }.none { Camera2.exportPlan(it).gps })
        assertTrue(Camera2.privacyOpen(s).isEmpty(), "the personal photo is blurred")
        // the variant request (it ends up in Git): no name, address, coordinates or client text in it
        val req = VariantRequests.build(s, kitFor(s), "Fürdőszoba-felújítás panelházban, a szellőző a közösbe megy.", listOf("furdo"),
            listOf("variant-photo-C1-eloszto.jpg"), NOW).toString()
        listOf(s.name, "Petőfi", "47.49", "19.04", "Kovács", "alu vezeték", s.id, "Minta", "example.invalid", "+36").forEach { assertFalse(it in req, "the request carries \"$it\"") }
        // the site (F1): fitted, reported; the outline and the placement survive the package
        val site = SketchJson.read(pkg.getJSONObject("sketch"))!!.site!!
        assertEquals(4, site.outline.size); assertNotNull(site.place); assertEquals("osm", site.footprint?.src)
        assertTrue(SitePlace.lines(SitePlace.report(SitePlace.rooms(Solver().solve(s)), site.outline, site.place)).isNotEmpty())
        // the shot list: the signature (purpose dokumentum) fills no item (M46)
        assertTrue(FieldKit.shots(kitFor(s), s).filter { it.item.purpose == "dokumentum" && it.item.room == null }.all { it.have == 0 })
    }

    @Test fun impliedCircuitsFollowTheToggle() {
        val s = newHouse()
        val on = export(s, true).second.items.first { it.id == "aramkor.dedikalt" }
        val off = export(s, false).second.items.first { it.id == "aramkor.dedikalt" }
        assertTrue(on.qty > off.qty && on.est && !off.est, "on: ${on.qty}, off: ${off.qty}")
        assertEquals(true, export(s, true).second.json.getJSONObject("config").getBoolean("impliedDedicated"))
    }

    /**
     * F6 (M51, D-93): with every feature switched off the package is the same, only the files beside it change. The one
     * exception is F5's sound notes (D-84: off = they do not leave the phone), a question for the Founder (M53).
     */
    @Test fun everythingOffKeepsThePackage() {
        val s = flat()
        val off = Features.all(emptySet(), false)
        val st = Features.toStores(off)
        assertFalse(st.implied, "all off keeps D-79's implied circuits off")
        assertFalse(Features.on(off, "export.photos") || Features.on(off, "export.burned") || Features.on(off, "export.takeoff"), "no side files")
        val n = Solver().solve(s)
        fun pkg(x: Sketch, sketchOff: Set<String>): JSONObject {
            val e = SketchFeatures.forExport(sketchOff, x); val nn = Solver().solve(e)
            return PlannerExport.build(e, nn, NOW).put("takeoff", Takeoff.build(kitFor(e), rules, e, PlanView.of(e, nn), now = NOW, impliedDedicated = st.implied).json)
        }
        val on = pkg(s, emptySet()); val allOff = pkg(s, st.sketchOff)
        val noAudio = pkg(s.copy(captures = s.captures.filter { it.kind != CaptureKind.AUDIO }), emptySet())
        assertTrue(allOff.similar(noAudio), "everything off: the package is the all-on one without the sound notes")
        assertFalse(allOff.similar(on), "the sound notes are the only difference (D-84 against D-93)")
        assertTrue(n.rooms.isNotEmpty())
    }

    // ---- the old files -----------------------------------------------------------------------------------------------

    /** Every key [old] had is still there with the same value after a read → write (except those listed). */
    private fun keeps(old: JSONObject, now: JSONObject, skip: Set<String>, path: String = "") {
        old.keys().forEach { k ->
            if (path + k in skip) return@forEach
            assertTrue(now.has(k), "$path$k is lost")
            same(old.get(k), now.get(k), skip, "$path$k")
        }
    }

    private fun same(a: Any, b: Any, skip: Set<String>, path: String) {
        when {
            a is JSONObject && b is JSONObject -> keeps(a, b, skip, "$path.")
            a is JSONArray && b is JSONArray -> {
                assertEquals(a.length(), b.length(), "$path: length")
                for (i in 0 until a.length()) same(a.get(i), b.get(i), skip, "$path[]")
            }
            a is Number && b is Number -> assertEquals(a.toDouble(), b.toDouble(), 1e-9, path)
            else -> assertEquals(a.toString(), b.toString(), path)
        }
    }

    @Test fun anM24FileOpensUnchanged() {
        val raw = JSONObject(File(dir, "old-v1-m24.vsketch.json").readText())
        val s = SketchJson.read(raw)!!
        assertEquals(3, s.rooms.size); assertEquals(5, s.points.size); assertEquals(1, s.circuits.size); assertEquals(2, s.measures.size)
        assertTrue(s.entries.isEmpty() && s.captures.isEmpty() && s.site == null && s.roomScope.isEmpty())
        assertEquals(Plugins.DEFAULT_ON, s.plugins, "no plugins key: the defaults")
        assertNull(s.tag("T-csere"), "reading changes nothing (D-80)")
        assertNotNull(SketchFeatures.onOpen(emptySet(), s).tag("T-csere"), "opening on the phone adds the Csere preset (D-80)")
        assertNull(SketchFeatures.onOpen(setOf(SketchFeatures.CSERE_OLD), s).tag("T-csere"), "unless switched off")
        val again = SketchJson.write(s)
        keeps(raw, again, setOf("v"))
        assertEquals(2, again.getInt("v"))
        assertEquals(s, SketchJson.read(again.toString()))
        // the old survey still exports and takes off
        val n = Solver().solve(s)
        val tk = Takeoff.build(kit, rules, s, PlanView.of(s, n), now = NOW)
        assertTrue(tk.items.isNotEmpty() && tk.questions.isNotEmpty())
        assertEquals(3, PlannerExport.build(s, n, NOW).getJSONObject("plan").getJSONObject("data").getJSONArray("floors").length())
    }

    @Test fun anM29SurveyOpensUnchanged() {
        val raw = JSONObject(File(dir, "old-v2-m29.vsketch.json").readText())
        val s = SketchJson.read(raw)!!
        assertEquals(2, s.captures.size); assertTrue(s.captures.all { it.kind == CaptureKind.PHOTO && it.phase == null && !it.privacy && it.ocr.isEmpty() })
        assertEquals(3, s.entries.size); assertEquals("csere", s.answers["lenyeg"]?.options?.first())
        assertTrue(s.roomScope.isEmpty(), "no wants by room: the job totals only")
        assertEquals("Fót, Ady E. u. 2.", s.site?.address); assertTrue(s.site!!.outline.isEmpty()); assertNull(s.site!!.place)
        assertNotNull(s.site!!.footprint)
        assertNotNull(SketchFeatures.onOpen(emptySet(), s).tag("T-csere"))
        assertNotNull(s.tag("T19"), "the user's own tag stays")
        val again = SketchJson.write(s)
        keeps(raw, again, emptySet())
        assertEquals(s, SketchJson.read(again.toString()))
        // a survey whose user already named a tag Csere does not get a second one
        val named = JSONObject(raw.toString()); named.getJSONArray("tags").put(JSONObject().put("id", "T77").put("name", "csere").put("col", 1))
        assertNull(SketchFeatures.onOpen(emptySet(), SketchJson.read(named)!!).tag("T-csere"))
    }
}
