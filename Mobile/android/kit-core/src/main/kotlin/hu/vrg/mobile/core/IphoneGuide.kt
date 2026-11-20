package hu.vrg.mobile.core

import org.json.JSONObject

// The iPhone guide (Mobile/web/guide/iphone.json): how to connect an iPhone, step by step. One file for both sides:
// the iPhone web app shows it on Eszköz and Útmutató; the Android app bundles it (kit's assets) and shows it under
// Eszközök → iPhone csatlakoztatása. Parsed here so IphoneGuideTest checks the very file both apps read.

data class GuideFaq(val q: String, val a: String)

data class GuideSection(val id: String, val title: String, val who: Who, val steps: List<String>, val faq: List<GuideFaq>) {
    enum class Who(val hu: String) { IPHONE("az iPhone-on"), OWNER("a tulajdonos Android telefonján"), BOTH("") }
}

data class IphoneGuide(val url: String, val title: String, val intro: String, val sections: List<GuideSection>) {
    companion object {
        fun parse(json: String?): IphoneGuide? = try {
            val o = JSONObject(json ?: return null)
            val a = o.getJSONArray("sections")
            IphoneGuide(o.getString("url"), o.getString("title"), o.getString("intro"), (0 until a.length()).map { i ->
                val s = a.getJSONObject(i)
                val steps = s.optJSONArray("steps")
                val faq = s.optJSONArray("faq")
                GuideSection(
                    s.getString("id"), s.getString("title"),
                    when (s.optString("who")) { "iphone" -> GuideSection.Who.IPHONE; "owner" -> GuideSection.Who.OWNER; else -> GuideSection.Who.BOTH },
                    if (steps == null) emptyList() else (0 until steps.length()).map { steps.getString(it) },
                    if (faq == null) emptyList() else (0 until faq.length()).map { faq.getJSONObject(it).let { f -> GuideFaq(f.getString("q"), f.getString("a")) } },
                )
            }).takeIf { it.url.startsWith("https://") && it.sections.isNotEmpty() }
        } catch (e: Exception) { null }
    }
}
