# FLIP (Fluid Implicit Particle): how it works and where VRG could use it. Research note, 2026-10-23

Source: a screenshot from a fluid-simulation video. The title card and teal-cell/black-dot look match
Matthias Müller's *Ten Minute Physics* FLIP episode. That is likely the source but has not been confirmed.
This is a **clean-room reverse-engineering of the technique**, not of code. The algorithm is public
(Brackbill & Ruppel 1986; brought into graphics by Zhu & Bridson 2005, *Animating Sand as a Fluid*).
Everything in `flip-spike/` was written here from the algorithm, and nothing was copied.

> The REA tool ([note](2026-10-20_rea-reverse-engineer-anything.md)) is not involved, because there is no
> binary to inspect. "REA" here means the method: see the feature, understand it, build our own.

Spike: [`flip-spike/index.html`](flip-spike/index.html). It is one file with no dependencies, and you open it directly
(it uses no localStorage, so `file://` is fine). It was checked in the browser pane: a 56×41 grid with 2 784
particles runs at about 3 ms per step on Canvas 2D, the dam break settles, and the draggable obstacle splashes.

---

## 0. The short answer

FLIP is a **hybrid**. Particles carry the fluid: they move it around and remember its velocity, so it
keeps detail and splash. A coarse grid makes it behave like water: it solves the pressure and keeps the
fluid incompressible. Each frame the velocity goes particles → grid → solve → back to particles.

What the screenshot shows directly:
- **Black dots** are particles (≈ 4 per cell, hex-packed at start).
- **Teal squares** are grid cells marked `FLUID` because at least one particle sits in them. White cells
  are `AIR`. The ragged staircase surface and the holes near the top are why the cell marking is coarse.
  The particles keep the smooth surface the grid can't.
- The grid is **staggered (MAC)**: horizontal velocity `u` lives on vertical cell faces and vertical velocity `v` on
  horizontal faces. Divergence per cell is then just `u_right − u_left + v_top − v_bottom`.

## 1. The step loop (what the spike does, in order)

| # | Step | What it does | Gotcha |
|---|---|---|---|
| 1 | Integrate | `v += g·dt`, `x += v·dt` on particles | plain explicit Euler is fine; the grid fixes the rest |
| 2 | Push apart | spatial hash (counting sort, cell = 2.2 r), 2 passes, separate pairs closer than 2r | without it particles clump and leave holes, and volume is visibly lost |
| 3 | Collide | clamp to walls; push out of the obstacle and give the particle the obstacle's velocity | do it **before** P2G so the grid sees legal positions |
| 4 | P2G | bilinear splat of particle `vx` / `vy` onto `u` / `v` faces (offset ½ cell on the other axis), normalise by weight sum; faces of solid cells get the solid's velocity; save a copy (`prevU/prevV`) | the half-cell offsets are the #1 bug source |
| 5 | Density | splat particle count onto cell centres; `ρ0` = mean over fluid cells on the first frame | |
| 6 | Project | Gauss–Seidel over fluid cells, over-relaxation 1.9, 20–100 iterations; per cell `p = −div / (number of open neighbours)`, spread to the 4 faces. **Drift compensation:** `div −= k·(ρ − ρ0)` where it's too dense | no pressure array needed; the velocities are corrected in place |
| 7 | G2P | for each particle, `PIC = interpolated grid v`; `FLIP = old particle v + (grid v − prevGrid v)`; `v = (1−α)·PIC + α·FLIP`, α ≈ 0.9; only faces touching a non-air cell count | α = 1 noisy and energetic, α = 0 viscous like honey |

Tuning learnt from the spike:
- particle radius `0.3·h` → about 4 particles per cell; less and the surface gets holes;
- over-relaxation 1.9 converges fast, while >1.95 starts to jitter;
- drift compensation off → the fluid slowly sinks and loses volume. Toggle it in the spike to see it.

## 2. Same parts, other jobs

FLIP is three reusable pieces, and the pieces matter more to us than the water:

1. **MAC grid + pressure projection.** This is the core of every Eulerian solver: smoke, air, heat. Add
   advection of a scalar (temperature, smoke density) and you have an airflow/heat sim without particles.
2. **Counting-sort spatial hash.** O(n) neighbour search. Useful anywhere we need "what is near this point":
   label de-collision, snapping, clustering.
3. **Gauss–Seidel relaxation with over-relaxation.** A generic "satisfy many local constraints
   iteratively" loop, which is also how position-based layout solvers work.

## 3. Implementation ideas for VRG (ranked)

| ★ | Idea | Where | Notes |
|---|---|---|---|
| ★★★ | **Spatial hash + push-apart for label de-collision** | Planner `labels.js`, sheet exports | Directly serves the "no overlapping labels" rule. Treat label boxes as particles with a minimum distance, anchor springs back to their device, 2–5 push-apart passes. It runs in O(n) where pairwise is O(n²), so it scales to full floor plans. Smallest, most useful takeaway. |
| ★★★ | **Endpoint / device snapping via the hash** | Planner endpoints + auto-snap | Same structure answers "nearest box/endpoint within r" instantly while dragging. |
| ★★ | **Elosztó heat view** | Elosztó DIN-rail app | Grid part only: enclosure cross-section as solid mask, breakers/PSUs as heat sources, buoyancy (`v += β·(T−T0)`), advect T. **Qualitative only** ("hot spot top-right, leave a gap"), not a substitute for the IEC 61439 temperature-rise check. |
| ★★ | **Room airflow / smoke illustration** | BRIDGE client material, ventilation and smoke-detector placement story | Room section from the Planner as obstacles, inlet/outlet as fixed face velocities, tracer particles. Good for explaining *why* a detector goes where it goes. Clearly label it as an illustration, not CFD. |
| ★★ | **Ambient visuals** | Client preview (WebGL), Media Wall idle screen, brochure title card | Port the loop to WebGL2/WebGPU compute for 50–200 k particles. Our own animation, so it fits the "own illustrations" rule. |
| ★★ | **CYD / S3 desk toy + benchmark** | Planner CYD (2432S024R), S3 modules | Tilt (IMU) or the knob pad sets gravity direction. ESP32-S3 has a single-precision FPU at 240 MHz; a ~32×24 grid with ~1–2 k particles and fewer solver iterations is a plausible target, but it is not measured yet. Good S3 performance benchmark + show-piece. |
| ★ | **Sump / shower-channel / tank side view** | BRIDGE leak sensing story | FLIP fits **vertical sections** (water under gravity). For "where does a leak spread on the floor" (plan view), the right tool is a **shallow-water / height-field** sim, not FLIP. |

Not a fit: floor-heating loops and pipe sizing are network problems (pressure drop per segment), and conduit
fill is geometry. Neither needs a fluid sim.

## 4. Scaling path if an idea goes ahead

1. Canvas 2D JS (this spike), up to about 10 k particles.
2. Same structure in typed arrays + one `<canvas>` ImageData blit for points, up to about 30 k.
3. WebGL2 (transform feedback) or WebGPU compute: P2G needs atomics or a gather pass. Above 100 k.
4. 3D only if a client-preview piece really needs it. The 2D version covers every idea above.

## 5. Open questions

- **FLIP-Q1** Which idea first?  A) label de-collision in `labels.js`  B) Elosztó heat view  C) CYD desk toy
- **FLIP-Q2** Should the spike go into START.cmd's research section or stay a loose file?  A) stay loose  B) add it
- **FLIP-Q3** Ambient visuals: should they follow the VRG Title Card look (teal on dark)?  A) yes  B) separate style
