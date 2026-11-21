package hu.vrg.mobile.sketch

import org.json.JSONObject

// F5 (WP M50, D-82): the client's contact on the survey, entered on the phone (Helyszín → Ügyfél). Name, phone and
// e-mail; the address is the site's (Site.address), not stored twice. It is PERSONAL data, so the D-57 rule F3 used for
// GPS applies: it stays in the survey file on the phone, and every copy that leaves the phone (the Rendezés package,
// its takeoff, a share) has it stripped unless the user ticked "Ügyféladat a kiadott csomagban marad" (keep). It is
// never in a variant request (VariantRequests.build does not read it) and never in Git (no fixture carries it; the
// Felmérési jegyzőkönyv and the Planner read it from the user's own file at run time).
//
// File: an optional "client" object {name, phone, email, keep?} in the v2 survey; written only when something is
// filled in, so a survey without it is byte-identical to before and an old file opens unchanged.

data class Client(val name: String = "", val phone: String = "", val email: String = "", val keep: Boolean = false) {
    val isEmpty: Boolean get() = name.isBlank() && phone.isBlank() && email.isBlank()
}

object ClientInfo {
    /** The contact as typed (trimmed); all three blank removes it. [keep] is kept as it was. */
    fun set(s: Sketch, name: String, phone: String, email: String): Sketch {
        val c = Client(name.trim(), phone.trim(), email.trim(), s.client?.keep ?: false)
        return s.copy(client = if (c.isEmpty) null else c)
    }

    fun setKeep(s: Sketch, keep: Boolean): Sketch = s.client?.let { s.copy(client = it.copy(keep = keep)) } ?: s

    /** What leaves the phone: the survey without the contact, unless the user keeps it in. */
    fun forExport(s: Sketch): Sketch = if (s.client?.keep == true) s else if (s.client == null) s else s.copy(client = null)

    /** A rough check for the e-mail field (the phone only warns, it never blocks typing). */
    fun emailLooksOk(e: String) = e.isBlank() || Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(e.trim())

    /** One line for the Helyszín card: "Minta Ügyfél · +36 30 …" or "" when empty. */
    fun line(c: Client?) = if (c == null || c.isEmpty) "" else listOf(c.name, c.phone, c.email).filter { it.isNotBlank() }.joinToString(" · ")

    fun write(s: Sketch, o: JSONObject) {
        val c = s.client ?: return
        if (c.isEmpty) return
        val j = JSONObject().put("name", c.name).put("phone", c.phone).put("email", c.email)
        if (c.keep) j.put("keep", true)
        o.put("client", j)
    }

    fun read(o: JSONObject, s: Sketch): Sketch {
        val j = o.optJSONObject("client") ?: return s
        val c = Client(j.optString("name").trim(), j.optString("phone").trim(), j.optString("email").trim(), j.optBoolean("keep"))
        return if (c.isEmpty) s else s.copy(client = c)
    }
}
