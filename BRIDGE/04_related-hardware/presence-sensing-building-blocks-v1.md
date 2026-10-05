# Presence Sensing as a Building-Block System — v1.0
### Knowledge base for designing multi-sensor "field pattern" automations

---

## PART 1 — Most Advanced Commercially Available Presence Sensors (mid-2026 snapshot)

These are the current top-tier consumer/prosumer devices. All go beyond simple PIR by using radar or RF field-sensing to detect *stillness*, not just motion.

### Aqara FP400 (Spatial Multi-Sensor) — current flagship
- mmWave radar + AI processing, tracks up to **10 people simultaneously**
- **Posture detection**: distinguishes standing / sitting / lying down per person
- Coverage up to **10 × 8 m** per unit — large-area/open-plan capable
- Native **Matter over Thread** + retains Zigbee fallback (works with older Aqara M2/M3 hubs)
- Acts as a **Thread mesh router** — strengthens the network instead of adding load
- Much stronger interference cancellation than FP2 — largely eliminates "ghosting" (fans/curtains read as people)
- Fall detection tuned for bathrooms (steam/humidity resistant reliability)
- Trade-off: overkill for simple room on/off; FP2 still cheaper and sufficient for that

### Aqara FP2 — the mature workhorse, still the zoning champion
- Up to **30 configurable detection zones** per device, each independently exposed as an occupancy entity
- Real-time multi-target tracking (up to 5 people) with live x/y position — **not exposed outside the Aqara app**, but per-zone binary state is
- Fall detection built in
- Requires the Aqara ecosystem/app for zone setup (one-time), then usable via HomeKit Controller integration or Aqara integration in Home Assistant — **cannot be tuned live from HA**, only from the Aqara app
- USB powered, no battery option

### Aqara FP300 — sensor-fusion in one body
- **5-in-1**: mmWave + PIR + temperature + humidity + illuminance in a single compact, wire-free unit
- Dual radio: switchable Thread (Matter) or Zigbee 3.0
- 120° field of view, continuous AI learning to suppress false triggers, ~20 ft range
- This is itself a small demonstration of "multi-sensor-on-one-device" fusion — worth studying as a reference design

### Everything Presence One (EP1) — the open, tunable option
- DIY-adjacent but retail-assembled: **PIR + mmWave (DFRobot module) on the same board**, two mounting slots trading horizontal vs vertical field of view
- Every parameter tunable directly in Home Assistant (ESPHome-based) — no cloud/app dependency, unlike FP2
- In direct testing, PIR triggers first (fast edge detection), mmWave confirms sustained presence, roughly matching FP2 on entry speed but giving full local control
- Best pick if you want to **build your own fusion logic** rather than trust a sealed algorithm

### Apollo R PRO-1 — professional wired option
- **Dual mmWave radar** for zero-latency multi-target tracking
- **PoE powered** — no wall-wart, clean install, no battery maintenance, ideal for permanent/professional installs
- Native ESPHome integration — fully local
- Positioned as the top pick for a serious local-first Home Assistant deployment (vs FP2's cloud/app dependency for configuration)

### Sonoff SNZB-06P — budget entry point
- 5.8 GHz radar (not 24GHz mmWave, but functionally similar for presence), ~4 m static range, 100° angle
- Built-in illuminance sensor (updates only on motion/presence events)
- ~$15–22, native Zigbee2MQTT/ZHA — good for scaling presence to every room cheaply

### Meross MS605 / similar Matter-native units
- PIR + mmWave + light in one, IP67 rated — the standard pick for **bathrooms/wet areas** where cameras are unacceptable and humidity kills lesser sensors
- Battery powered via CR123A (up to 3 years on Thread)

### WiFi CSI (Channel State Information) sensing — the emerging non-hardware layer
- Uses **existing WiFi routers/access points** to detect human movement and even breathing through walls, using signal distortion patterns rather than a dedicated radar chip
- No new hardware required in principle (firmware/CSI-capable chipset dependent) — ESP32-based CSI extraction projects exist for Home Assistant today
- State of the art (2026 research) reports **>97% presence detection accuracy in multi-room scenarios using deep learning models (e.g., TCD-FERN, CRONOS)** on commodity WiFi hardware
- Strategically important as a **privacy-preserving, camera-free, hardware-light sensing layer** — but still mostly DIY/research-grade for home use, not yet a polished consumer product category
- Best framed as a future building block for your ESPBLOK ecosystem: one ESP32 + router pair could become a whole-room presence layer with zero additional sensors

**Takeaway for your build:** FP400/FP2 dominate the polished-and-zoned category; EP1/Apollo R PRO-1 dominate the local-control/tunable category; Sonoff/Meross dominate cost-per-room scaling; WiFi CSI is the frontier you could integrate given your ESP32/CM5 direction and your preference for open, self-contained tools.

---

## PART 2 — Mono-Sensor Technology Catalog

For each sensor type: **function · how it's used · strengths/weaknesses · how the raw hardware works · what smarter software unlocks · how it works as a presence-sensing building block (fused on one device, or arrayed as multiples of the same type).**

---

### 1. PIR (Passive Infrared)
- **Function**: detects a change in infrared radiation as a warm object crosses the sensor's field of view.
- **Use**: entry/exit triggers, security lighting, cheap motion-activated automations.
- **Strengths**: cheap, low power (battery-friendly for years), instant response to movement, no calibration needed.
- **Weaknesses**: blind to stillness (reading, sleeping, working at a desk), no distance/count/zone data, affected by ambient temp near body temp, false triggers from HVAC vents or direct sunlight.
- **Raw hardware**: pyroelectric crystal behind a Fresnel lens splits the field of view into segments; crystal generates a tiny voltage when IR flux across it changes; a comparator circuit thresholds that voltage into a digital trigger.
- **With better software**: even a binary PIR gains value when you log *timing patterns* (time-of-day frequency) rather than just triggering — a rolling baseline can flag anomalies (someone up at 3am who never is).
- **As a building block**:
  - *Single-device fusion*: pair with mmWave (as in EP1) — PIR gives near-zero-latency edge detection on entry, mmWave takes over for sustained-stillness confirmation. This solves both the "slow to trigger" and "clears too early" problems simultaneously.
  - *Multiple of same type*: sequential PIRs down a hallway or between rooms give you direction of travel and let you build occupancy counting (in minus out) without any single sensor knowing "how many."

### 2. mmWave Radar (24GHz / 60GHz FMCW)
- **Function**: emits and receives millimeter-wave radio, detects micro-Doppler shifts from movement — down to breathing/chest displacement.
- **Use**: sustained presence, sleep detection, fall detection, multi-target tracking, posture (newer chips).
- **Strengths**: detects stillness, works through thin materials/fabric/low light, gives distance/zone/count data, no camera privacy concern.
- **Weaknesses**: pricier, mostly mains-powered (continuous sensing = higher draw), false triggers from fans/curtains/reflective surfaces/pets, needs placement tuning and zone calibration.
- **Raw hardware**: FMCW (frequency-modulated continuous wave) radar chip transmits a swept-frequency signal, measures phase/frequency shift of the reflection to derive range and Doppler velocity; onboard DSP or an attached MCU processes the raw IQ data into zones/targets.
- **With better software**: raw radar can be pushed further than the sealed "occupied/clear" output most modules expose — with access to raw range-Doppler data (as on EP1/Apollo boards) you can build your own posture/fall/breathing-rate classifiers.
- **As a building block**:
  - *Single-device fusion*: combine with PIR (fast edge trigger) and with illuminance (gate automations by ambient light, as FP300 does).
  - *Multiple of same type*: several mmWave units with overlapping zones build a full-room occupancy heatmap and multi-person tracking beyond any single unit's field of view — effectively how FP400 extends FP2's single-unit zoning to whole open-plan spaces.

### 3. 5.8GHz Microwave Radar (Doppler, non-FMCW)
- **Function**: simpler cousin of mmWave — detects motion via Doppler shift only, no fine ranging.
- **Use**: budget presence sensors (Sonoff SNZB-06P class).
- **Strengths**: much cheaper than true mmWave, still detects through-fabric motion PIR misses, decent range.
- **Weaknesses**: coarser than FMCW mmWave — less reliable stillness/breathing detection, fewer zones, more prone to false triggers from anything moving in range.
- **Raw hardware**: a Doppler radar transceiver (fixed frequency) mixes transmitted and received signal; any frequency difference (Doppler shift) indicates motion; simpler analog front end than FMCW.
- **With better software**: signal-strength trend (not just Doppler event) can hint at "someone moved but is now still nearby" if you log continuous RSSI rather than only trigger events.
- **As a building block**: cheapest way to scale "is anything moving here" to every room; pair with a temp/humidity/light combo sensor (many budget units already do this) for cost-effective multi-signal rooms.

### 4. Ultrasonic Sensors
- **Function**: emits ultrasonic pulses, measures echo return time (like sonar) to detect distance/motion.
- **Use**: older occupancy sensors, parking sensors, liquid level, some presence detection (largely superseded by mmWave for presence).
- **Strengths**: cheap, works in total darkness, good for short-range precise distance.
- **Weaknesses**: affected by temperature/humidity (speed of sound varies), audible-adjacent frequencies can bother pets, short effective range, easily blocked by soft materials.
- **Raw hardware**: piezoelectric transducer emits a pulse (typically 40kHz), timer measures time-of-flight to echo, distance = (time × speed of sound)/2.
- **With better software**: continuous distance logging (not just threshold trigger) turns it into a crude "is something near this exact spot" sensor — useful for a workbench or a specific chair, not a whole room.
- **As a building block**: good as a *localized* confirmation layer at a single point (e.g., "is someone at this exact desk") layered under a room-level mmWave/PIR signal for confidence scoring.

### 5. Time-of-Flight (ToF) / LiDAR
- **Function**: measures distance via light pulse time-of-flight per pixel, giving a rough depth map.
- **Use**: robot vacuums, gesture sensing, single-point or small-array presence/distance (e.g., VL53L Series), some advanced presence sensors for precise range-gating.
- **Strengths**: very precise short-range distance, works in darkness, immune to most EM interference, small/cheap single-point modules (VL53L0X/1X/5CX) are ESP32-friendly.
- **Weaknesses**: struggles with reflective/black/transparent surfaces, mostly short range (a few meters for cheap modules), single-point units give no "who/what" context, higher-res LiDAR is pricier.
- **Raw hardware**: emits an IR laser/LED pulse, a SPAD (single-photon avalanche diode) array times the photon return per pixel, computing distance per zone.
- **With better software**: multi-zone ToF chips (8×8 pixel arrays) can distinguish "something small passed" vs "someone is standing here" from the depth pattern shape.
- **As a building block**: excellent narrow-purpose confirmation sensor — e.g., mounted at a doorway to precisely count crossings (direction-aware, unlike PIR), feeding into your hallway occupancy-counting design.

### 6. Thermal Array / Low-Resolution IR Grid (e.g., AMG8833/Grid-EYE, MLX90640)
- **Function**: an 8×8 or 32×24 grid of individual thermopile pixels — essentially a very-low-res thermal camera.
- **Use**: people-counting, "warm blob" occupancy without identifiable imagery, fall detection, HVAC zoning.
- **Strengths**: privacy-preserving (no recognizable image), works in total darkness, gives count + rough position, cheap and ESP32-compatible.
- **Weaknesses**: low resolution means poor separation of close-together people, sensitive to ambient temperature swings, short range compared to radar.
- **Raw hardware**: an array of thermopile elements, each independently measuring incident IR (heat) and outputting a temperature-mapped grid via I2C.
- **With better software**: apply simple blob-detection/connected-component analysis on the grid to count discrete "warm shapes" and track them frame to frame — a lightweight local alternative to a camera + ML.
- **As a building block**: a strong *privacy-first* count/position layer to fuse with mmWave — mmWave gives movement/breathing confidence, thermal array gives rough shape/position confirmation, without ever recording an identifiable image (useful for a bathroom, bedroom, or anywhere a camera is unacceptable).

### 7. Camera + On-Device ML (person/pose detection)
- **Function**: full image capture, processed locally or in cloud via a person-detection/pose model.
- **Use**: highest-fidelity presence, identity (if paired with recognition), activity/pose classification, security recording.
- **Strengths**: richest possible data — count, identity, pose, activity, direction, even what people are doing, not just that they exist.
- **Weaknesses**: privacy-invasive (biggest weakness by far — avoid in bedrooms/bathrooms), lighting-dependent unless IR/night mode, heaviest compute/bandwidth, most expensive to process well.
- **Raw hardware**: CMOS image sensor + ISP, frames pushed to an inference engine (local NPU like a Coral/Hailo module, or cloud API) running an object-detection or pose-estimation model.
- **With better software**: on-device models (e.g., Frigate + a coral TPU) give you zone-based person detection entirely locally, no cloud dependency, which fits your local-first design instinct.
- **As a building block**: use sparingly and only where privacy is a non-issue (workshop, front door, garage) as the "ground truth" layer in a confidence-scoring system — camera confirmation can be the highest-weight vote precisely because it's least ambiguous, reserved for high-stakes automations (unlocking, arming).

### 8. UWB (Ultra-Wideband)
- **Function**: precise indoor positioning (down to ~10cm) via time-of-flight radio ranging between tags/anchors.
- **Use**: precise room-level and sub-room-level localization, especially of tagged objects/people (phone-based UWB, Apple/Android support growing), asset tracking.
- **Strengths**: far more precise than BLE/WiFi for localization, low latency, good for tracking a *specific tagged* person/object rather than "anyone."
- **Weaknesses**: requires the person/object to carry a UWB-capable device or tag (not device-free like radar), needs multiple fixed anchors for triangulation, still an emerging/pricier category for home use.
- **Raw hardware**: anchors and tags exchange radio pulses across a very wide bandwidth; time-of-flight (and sometimes angle-of-arrival) between multiple anchors triangulates position.
- **With better software**: combine multiple anchors' ranging data into a Kalman-filtered position estimate for smooth room-to-room tracking of a known person (e.g., "which room is Yarris's phone actually in" rather than just "phone is home").
- **As a building block**: complements device-free radar sensors by adding *identity* — UWB tells you *who*, mmWave/thermal tells you *that someone's there and how they're behaving*. Multiple UWB anchors across a floor plan effectively become a whole-home real-time location system.

### 9. BLE RSSI / Angle-of-Arrival (AoA) Presence
- **Function**: uses Bluetooth Low Energy signal strength (or, on newer AoA-capable hardware, arrival angle) from a phone/wearable/tag to estimate proximity or position.
- **Use**: room-level "is my phone here" presence, proximity automations, simple person-tracking without new hardware (most phones already broadcast BLE).
- **Strengths**: no dedicated tag needed if using phone BLE, cheap ESP32-based BLE proxies scale easily, works well for coarse room-presence.
- **Weaknesses**: RSSI-only is noisy (walls, orientation, interference all skew distance estimates), not truly device-free (someone without their phone is invisible), AoA hardware is still a small niche.
- **Raw hardware**: BLE radio measures received signal strength of advertisement packets; AoA variants use antenna arrays to measure phase differences across antennas to estimate direction.
- **With better software**: multiple BLE receivers (ESPHome `bluetooth_proxy` nodes) triangulate/trilaterate a device's room via relative RSSI across nodes rather than trusting any single reading — this is exactly the multi-of-same-sensor pattern.
- **As a building block**: cheapest possible "which room is this specific person in" layer — several ESP32 BLE proxies (you likely already have compatible boards) scattered through the house give room-granular presence with hardware you may already own, and it pairs naturally with radar/PIR to add the "who" on top of "someone."

### 10. WiFi RSSI / Device Presence (router-based)
- **Function**: detects whether a known device (phone) is associated with the home WiFi network.
- **Use**: whole-house "is anyone home" presence, arrival/departure triggers.
- **Strengths**: zero extra hardware, works with any existing router/AP, good binary "home/away" signal.
- **Weaknesses**: no room granularity, phone WiFi sleep/power-saving causes false "away" flickers, doesn't detect guests or device-less presence.
- **Raw hardware**: router/AP tracks connected MAC addresses; presence integrations poll the router (or ARP scan the LAN) to check association status.
- **With better software**: debounce/hysteresis (require N consecutive misses before marking "away") fixes most of the flicker problem — a simple state-machine fix.
- **As a building block**: the cheapest possible whole-home gate — use as a top-level condition ("only run detailed room automations if house-level presence is true") layered above your room-level sensor fusion, saving compute/complexity when nobody's home at all.

### 11. WiFi CSI (Channel State Information)
- **Function**: extracts fine-grained channel distortion data from ordinary WiFi transmissions to detect movement/breathing — effectively turns existing WiFi into device-free radar.
- **Use**: through-wall motion/presence sensing without dedicated radar hardware, emerging in DIY/research Home Assistant projects.
- **Strengths**: potentially uses infrastructure you already have, camera-free/privacy-preserving, can sense through walls (multi-room coverage from fewer nodes).
- **Weaknesses**: still mostly research/DIY-grade for home use, chipset-dependent (needs CSI-capable WiFi hardware/firmware, e.g., specific ESP32 or router chipsets), requires ML models to get useful accuracy, not yet a polished off-the-shelf product category.
- **Raw hardware**: WiFi receiver reports per-subcarrier amplitude/phase (the channel state) used normally for equalization; human movement perturbs the multipath environment, changing CSI patterns over time.
- **With better software**: this is *almost entirely* a software play — research systems report >97% multi-room presence accuracy using recurrent/deep models on subcarrier-fused CSI data (e.g., TCD-FERN, CRONOS architectures), so quality here is dominated by the model, not the radio.
- **As a building block**: the most promising frontier for your ESPBLOK line — a single ESP32 + a router pair could become a whole-room sensing layer without adding a radar module at all; best treated as an experimental parallel signal to corroborate mmWave/PIR at low incremental hardware cost.

### 12. Acoustic / Microphone Sensing
- **Function**: detects sound events (footsteps, voices, glass break, appliance beeps, door slams) via amplitude/frequency analysis or on-device classification.
- **Use**: sound-based occupancy confirmation, security (glass-break detectors), appliance-done detection (washing machine beep, kettle click), baby/pet monitoring.
- **Strengths**: detects things no other sensor type can (specific event *sounds*), cheap MEMS mics, can work through non-line-of-sight.
- **Weaknesses**: privacy-sensitive if recording, ambient noise causes false positives, needs decent classification software to be useful beyond raw volume threshold.
- **Raw hardware**: MEMS microphone converts pressure waves to an analog/digital signal; simple systems threshold on amplitude (dB), advanced systems run FFT/spectral or ML classification on-device.
- **With better software**: an on-device keyword/event classifier (e.g., a small TinyML model on ESP32) turns a $2 mic into an "appliance finished" or "someone's talking in this room" detector without ever transmitting raw audio — much more privacy-respecting than it sounds.
- **As a building block**: a strong *corroborating* signal rather than a primary one — "radar says someone's in the kitchen AND mic detects talking/cooking sounds" raises confidence far more than either alone, useful in your confidence-scoring framework.

### 13. Vibration / Accelerometer (MEMS)
- **Function**: detects mechanical vibration or tilt/motion of the object it's mounted to.
- **Use**: tamper detection (already covered), appliance/machinery health trending, footstep detection on floors, door/window force-entry detection.
- **Strengths**: cheap, tiny, very low power, detects things purely optical/radar sensors can't (someone walking on a floor above, a machine's bearing wear).
- **Weaknesses**: only useful when mounted to the right surface, no "presence" data by itself — needs interpretation/context, drift/false trigger from environmental vibration (traffic, wind on windows).
- **Raw hardware**: MEMS accelerometer (capacitive or piezoresistive) measures acceleration on 1-3 axes; a threshold or FFT-based algorithm distinguishes vibration "signatures."
- **With better software**: baseline the normal vibration signature per mounted object over weeks, then flag *deviation* from baseline rather than a fixed amplitude threshold — this is your structural/equipment health idea directly.
- **As a building block**: multiple units on a floor structure can detect footsteps well before radar/PIR would trigger (someone approaching from an adjacent room), giving you a genuine "pre-arrival" signal for automations that want a head start (e.g., pre-warming a room).

### 14. Magnetic Contact / Reed Switch / Hall Effect
- **Function**: detects open/closed state of a door, window, drawer, or cabinet via a magnet-and-sensor pair.
- **Use**: security, HVAC gating (don't heat with a window open), usage-pattern tracking (drawer/tool usage, already discussed).
- **Strengths**: extremely reliable, dead simple, tiny power draw, binary and unambiguous.
- **Weaknesses**: only tells you open/closed, not who or how long, magnet/sensor gap must be well-aligned.
- **Raw hardware**: reed switch = two ferromagnetic contacts sealed in glass that close under magnetic field; Hall-effect versions use a solid-state sensor that outputs based on magnetic field strength (allows finer position/proximity sensing than a simple reed switch).
- **With better software**: log open/close *duration and frequency* rather than just current state — turns a $3 sensor into a usage-pattern data source (which you already identified for tool drawers).
- **As a building block**: use as a **fast-path presence hint** — door contact opening is often the earliest signal of someone entering a space, arriving well before radar/PIR confirm; excellent as the "primer" event in a state machine (empty → entering) before other sensors confirm "occupied."

### 15. Ambient Light (Illuminance / Lux)
- **Function**: measures visible light level.
- **Use**: gating motion-activated lighting (don't turn lights on if it's already bright), adaptive brightness curves, day/night automation logic.
- **Strengths**: cheap, simple, essential context for any lighting automation.
- **Weaknesses**: only tells you brightness, not presence — always a supporting sensor, never primary.
- **Raw hardware**: photodiode or phototransistor (sometimes a dedicated ambient light IC like the BH1750) generates current proportional to incident light, converted to lux via calibrated response curve.
- **With better software**: log lux trend over the day per room to build a personalized "normal" curve, then flag deviations (e.g., a room that's darker than usual at a given hour might mean blocked blinds or a bulb failure) — extending it into a diagnostic tool, not just a gate.
- **As a building block**: nearly always paired on the *same device* as a presence sensor (as in FP300, Meross MS605) — it's the cheapest possible context multiplier, converting a raw "motion detected" event into "motion detected AND it's dark" before triggering lights.

### 16. CO2 (NDIR)
- **Function**: measures carbon dioxide concentration.
- **Use**: ventilation control, indirect occupancy/count estimation, air-quality alerts.
- **Strengths**: directly tied to human respiration — a genuinely orthogonal signal to motion/radar, good long-timescale occupancy proxy even when people are still.
- **Weaknesses**: slow response (minutes, not seconds — CO2 has to build up/disperse), affected by room volume/ventilation rate, more expensive sensor (NDIR modules aren't as cheap as basic gas sensors), can't tell you *where* in a room.
- **Raw hardware**: Non-Dispersive InfraRed (NDIR) sensor shines IR through a gas sample chamber onto a detector tuned to CO2's absorption wavelength (~4.26µm); absorption level indicates concentration.
- **With better software**: rate-of-rise (not just absolute ppm) combined with room volume gives a rough real-time occupancy *count* estimate — more sophisticated than a fixed-threshold alarm.
- **As a building block**: the best long-timescale corroborator for "is this room actually occupied over the last 20 minutes" — radar/PIR answer "right now," CO2 answers "has it been occupied for a while," which is exactly the kind of orthogonal confirmation your confidence-scoring model wants (a slow-but-certain signal versus fast-but-noisy ones).

### 17. VOC (Volatile Organic Compounds)
- **Function**: measures general "chemical" air contamination (from people, cooking, cleaning products, off-gassing materials).
- **Use**: air-quality-triggered ventilation, general "something's happening" indicator (cooking, painting, showering).
- **Strengths**: sensitive to a broad range of human-generated activity beyond just CO2.
- **Weaknesses**: non-specific (can't tell *what* caused the reading), drifts and needs periodic calibration/burn-in, slower response than motion sensors.
- **Raw hardware**: metal-oxide semiconductor (MOx) sensor — VOC gases change the resistance of a heated tin-oxide film; resistance change is converted to a relative VOC index.
- **With better software**: correlate VOC spikes with time-of-day/room to auto-learn "this spike pattern = cooking" vs "this = showering" without hardcoding.
- **As a building block**: mostly a *secondary corroborator* alongside CO2/humidity for activity classification rather than presence per se — useful in a kitchen/bathroom fusion stack to distinguish activity types, not just occupancy.

### 18. Humidity (Capacitive)
- **Function**: measures relative humidity (%RH).
- **Use**: mold/condensation prevention (already discussed), bathroom fan automation, presence-adjacent (showers spike humidity fast).
- **Strengths**: cheap, often bundled with temp sensors, fast-reacting in bathrooms specifically.
- **Weaknesses**: not a general presence indicator (irrelevant in most rooms), affected by weather/season baseline shifts.
- **Raw hardware**: capacitive polymer sensor changes dielectric constant with absorbed moisture, measured as a capacitance shift.
- **With better software**: rate-of-rise thresholding (not absolute %) reliably detects "shower just started" within a minute or two, faster than absolute-humidity logic.
- **As a building block**: an excellent bathroom-specific "activity started" trigger to fuse with a waterproof presence sensor (like the Meross MS605) for fan/extraction automation that's smarter than a timer.

### 19. Temperature
- **Function**: measures ambient temperature.
- **Use**: HVAC control, freeze/overheat alerts, indirect occupancy inference (body heat contribution in small enclosed spaces), equipment thermal monitoring (relevant to your electrical panel diagnostics work).
- **Strengths**: cheap, ubiquitous, dual-purpose for comfort and diagnostics.
- **Weaknesses**: slow-changing, easily confounded by external factors (sun through a window, HVAC vents), not a direct presence signal on its own.
- **Raw hardware**: thermistor or bandgap silicon sensor (e.g., SHT-series, DS18B20) outputs a resistance or digital value proportional to temperature.
- **With better software**: per-room baseline-and-deviate modeling (as you already do conceptually for HVAC zoning) surfaces both comfort automation and diagnostic insight ("this room always runs cold" = insulation issue) from the same data stream.
- **As a building block**: multiple temp sensors across a panel or enclosure (directly applicable to your electrician work) create a thermal gradient map — a spike in one zone relative to its neighbors flags a developing fault (loose connection, overloaded breaker) well before a trip, functionally identical in structure to the humidity-leak-triangulation idea from earlier.

### 20. Barometric Pressure
- **Function**: measures atmospheric pressure.
- **Use**: weather prediction (rate of change), altitude estimation, occasionally used as a coarse door/window-open detector (small pressure differential when a door in a sealed space opens).
- **Strengths**: essentially free to add (bundled into many combo sensor ICs), useful for weather-reactive automations (close windows before a storm).
- **Weaknesses**: not useful for room-level presence at all; mostly whole-building or outdoor-context data.
- **Raw hardware**: MEMS piezoresistive or capacitive pressure sensor measures deflection of a diaphragm under atmospheric pressure, converted to hPa.
- **With better software**: rate-of-change over 1-3 hours (not absolute value) is the standard trick for short-term weather prediction — worth automating irrigation/window-closing off this rather than absolute pressure.
- **As a building block**: minor player in presence work, but occasionally useful as a corroborating "door opened" cue in a well-sealed room (a pressure pulse coincides with any door opening in a tight envelope) — mostly a curiosity rather than a core tool for you.

### 21. Current / Power Monitoring (CT clamp, inline smart plug)
- **Function**: measures real-time current draw (and derived power/energy) of a circuit or device.
- **Use**: appliance-state inference (already discussed), whole-panel load management (already discussed), indirect presence (someone turned on a kettle = someone's home).
- **Strengths**: gives you *behavioral* data no motion/radar sensor can — what's actually running, not just that a room is occupied.
- **Weaknesses**: only as useful as your appliance-signature knowledge; doesn't detect passive presence (someone reading uses no power).
- **Raw hardware**: CT (current transformer) clamp induces a proportional current from the AC magnetic field around a conductor, or an inline shunt/Hall sensor measures current directly; combined with voltage sampling for true power (not just apparent).
- **With better software**: per-device load signature libraries (peak draw shape, duration, cycle pattern) let one CT clamp on a whole-house feed distinguish *which* appliance is running via disaggregation algorithms (non-intrusive load monitoring, NILM) — no per-device sensor needed at all.
- **As a building block**: an indirect but very reliable presence/activity corroborator — "kitchen circuit shows kettle signature" is a stronger occupancy signal for that specific activity than any generic motion sensor, and multiple CT clamps across circuits build the whole-house load map you described earlier.

### 22. Capacitive / Proximity Sensing
- **Function**: detects nearby conductive objects (including human bodies) via change in capacitance, without contact.
- **Use**: touch-free switches, seat-occupancy sensing (capacitive car seats), presence-at-a-surface detection (desk, chair, cabinet).
- **Strengths**: very short-range but extremely reliable at that range, no line-of-sight needed, low cost, can be embedded invisibly (behind a surface).
- **Weaknesses**: short range only (cm to low meters), sensitive to environmental humidity/conductive clutter, not a room-scale solution.
- **Raw hardware**: an electrode forms one plate of a capacitor; a nearby human body (conductive, grounded) changes the effective capacitance, detected via oscillator frequency shift or charge-time measurement.
- **With better software**: multiple capacitive zones (e.g., embedded under a desk/chair/workbench edges) can be scanned sequentially to build a rough occupied/empty map of specific furniture, not just the room.
- **As a building block**: the most precise possible "is this exact spot occupied" signal — pairs beautifully with room-level radar as the final-confirmation layer at a specific chair/workbench, exactly where mmWave zoning sometimes struggles to be that precise.

### 23. Load Cell / Pressure Mat
- **Function**: measures physical weight/force at a location.
- **Use**: bed-occupancy sensing, chair-occupancy, doormat presence trigger, safe/cabinet tamper detection.
- **Strengths**: unambiguous — if it reads weight, something is physically there, immune to all the "ghosting" problems radar/PIR suffer from.
- **Weaknesses**: only covers the exact physical footprint of the mat/cell, needs calibration/tare, can be defeated by weight distributed outside the sensed area.
- **Raw hardware**: strain gauge bonded to a metal flexure changes resistance under load (Wheatstone bridge amplifies the tiny signal), or a simple force-sensitive resistor (FSR) changes resistance with applied pressure.
- **With better software**: differential weight change (not absolute) lets one bed sensor distinguish "person got in" vs "pet jumped on" by magnitude, and combined with time-series can even estimate restlessness/sleep quality trends.
- **As a building block**: the ultimate ground-truth confirmation for a specific spot — in your confidence-scoring framework this deserves a very high vote weight, since false positives are nearly impossible; ideal as the tie-breaker sensor in ambiguous radar/PIR situations (bed, favorite chair, workbench stool).

---

## PART 3 — Rework Notes for v2.0

Things to develop further once you've digested this v1.0 knowledge base:

1. **Comparison matrix / cheat-sheet table** — a single table (sensor type × cost × range × power draw × privacy level × latency × best-fit room) so you can pick building blocks at a glance instead of reading prose each time.
2. **Confidence-scoring worked examples** — take the framework from our earlier conversation and show 3-4 fully worked point-weight tables (e.g., "occupied" score built from PIR+mmWave+CO2+door contact with actual suggested weights and thresholds) rather than leaving it conceptual.
3. **ESPBLOK-specific hardware shortlist** — cross-reference this catalog against parts you can actually source from Hestore.hu or AliExpress and are ESP32/I2C/UART compatible, so v2 becomes a literal BOM-ready reference, not just theory.
4. **HA/ESPHome YAML snippets per sensor type** — a working config block for each sensor category (template sensor for hysteresis, statistics sensor for baseline-and-deviate, etc.) so the doc becomes copy-paste usable.
5. **A "which sensor for which room/problem" decision tree** — workshop vs bedroom vs bathroom vs electrical panel vs hallway, mapped to a recommended minimum sensor stack for each, tying Part 1 (devices) and Part 2 (raw technologies) together into concrete shopping/build lists.
6. **Cost tiers** — budget/mid/pro versions of a full-house sensor rollout, so this becomes a planning tool for phased purchasing rather than an open-ended wishlist.
7. **Fault/degradation matrix** — for each sensor, what happens when it fails or loses network (ties into the "graceful degradation" approach from earlier) — worth a dedicated table given your safety-conscious electrician instincts.
8. **Visual diagrams** — field-of-view cones, zone-overlap diagrams, and a sample multi-sensor room floorplan once this becomes the HTML/interactive version.
9. **This is the point where HTML makes sense** — once the matrix, decision tree, and YAML snippets exist, the natural v2/v3 form is an interactive reference tool (filterable table + room-planner) in your established dark-amber design language, rather than a static document.

---

*This is a knowledge-gathering document (v1.0), not yet a build tool. Say the word when you want v2 (tables/snippets/decision tree) or the eventual interactive HTML reference.*
