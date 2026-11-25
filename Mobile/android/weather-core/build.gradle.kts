// VRG Időjárás on the phone (WP M44), pure JVM: the MET Norway, DWD MOSMIX and MeteoAlarm parsers, the fusion and the
// field rules ported from Weather/lib (fuse.js, rules.js, vars.js), with Weather/config's rules, places, sources and
// settings bundled as exact copies (WeatherCoreTest fails when they drift). feature-weather is the Android shell.
plugins {
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    // Android ships org.json in the framework (same rule as kit-core)
    compileOnly("org.json:json:20240303")
    testImplementation("org.json:json:20240303")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // the bundled config must equal Weather/config (WeatherCoreTest)
    val repo = rootProject.projectDir.resolve("../..").canonicalFile
    systemProperty("vrg.repo", repo.path)
    inputs.dir(repo.resolve("Weather/config"))
}
