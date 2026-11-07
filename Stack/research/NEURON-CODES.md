# Neuron codes: addresses and gate kinds for the axiom neurons

2026-11-07. Status: **v0 built** (`neurons.js`, `out/neurons.json`, `node stack.js neuron <addr>`, the Konnektóm card).
The point of this note: the axiom neurons get an address and a logic role now, so that a later phase can string
them into ordered paths, the **memory path patterns** the engines will run on.

## 1. What a neuron is (recap)

- A **node** (pont) is 2 KB of a file.
- An **axiom** is a continuous run of 12, 24, 48, 120, 220 or 400 KB of one file. Each axiom has one connector
  node, the **neuron**.
- The axioms nest. A 24 KB neuron holds the two 12 KB neurons inside it, and so on up to 400 KB.
  So every file larger than 12 KB is a small tree of neurons. Its **head** is the last neuron of the highest tier
  it reaches.
- Today there are 6 436 neurons. Files under 12 KB have none: most memory notes, briefs and decisions.
  See NC-Q2.

## 2. The address

```
  r  cz  wtj
  │  │   └─ run: 3 chars of hash(file id | KB | index); unique within the build (salted on a clash)
  │  └───── family: 2 chars of hash(file id); every neuron of one file shares it
  └──────── gate: what the neuron does with a signal (section 3)
```

- **6 characters**: lowercase letters and digits, in the Crockford base32 alphabet `0-9 a-z` without `i l o u`
  (no 1/l or 0/o mix-ups). There are 32⁵ ≈ 33.5 M roots, so collisions are rare and are resolved anyway.
- **Derived from the file.** You can tell that two neurons belong to the same file because the family prefix
  matches (`rcz…`, `mcz…`). Like a short git hash, any unique prefix finds a neuron:
  `node stack.js neuron czw`.
- **The root never changes** (the last 5 characters). It stays put as long as the file keeps its id and the run
  keeps its place. The **gate letter is the neuron's current role**, so it can change: a waiting decision `g…`
  becomes a switch `x…` once it is answered.
  Two consequences:
  - an engine keys on the root and reads the gate;
  - a person reads the whole 6 characters.
- **Weight** (`w`, signal strength 1–9) is kept beside the address, not inside it. Weight is state: it moves
  with every amplify or damp, and addresses must not.
  - Default weight: tier + 1 (12 KB = w1 … 400 KB = w6).
  - `a` adds a point; `d` removes one.

## 3. The gate kinds

| Letter | Name | Inputs → outputs | What it does with a signal | Set today from |
|---|---|---|---|---|
| `r` | relay · továbbító | 1 → 1 | passes it to the next address | the default for every neuron that is not a head |
| `f` | fork · elágazás | 1 → 2 | sends it to two parallel addresses | a file on two pathways (`line` + `line2`) |
| `m` | merge · összefutás | 2+ → 1 | joins several vectors into one address | a hub file (8 or more links) |
| `g` | gate · kapu | 1 → 1 (blocked) | stops the vector until its condition holds | a decision on a *waiting* pathway |
| `x` | switch · váltó | 1 → 1 of 2 | routes to one of two, by state | a decision that has been answered |
| `t` | threshold · küszöb | k of n → 1 | fires only when k of its n inputs are active | agents, agent tools, the council |
| `a` | amplify · erősítő | 1 → 1, w+1 | adds one point of signal strength | touched in the last 3 days |
| `d` | damp · csillapító | 1 → 1, w−1 | removes one point | quiet for over 30 days on a parked pathway, or on no pathway |
| `n` | inhibit · gátló | 1 → 1, silences a neighbour | an arriving signal suppresses the next one | ended or absorbed pathways (superseded knowledge) |
| `h` | hold · tároló | 1 → latch | keeps the signal until it is read | memory notes |
| `c` | clock · ütem | 0 → 1 | fires on its own rhythm | runs, days, scheduled tasks |
| `s` | source · forrás | 0 → 1 | a vector starts here | session starts, briefs, codephrases |
| `e` | end · kimenet | 1 → 0 | the signal leaves the system | commits, merges |

- **Order of the rules.** The first match wins, top to bottom in `roleOf` (`neurons.js`): kind first (s e c t),
  then decisions (g x), then pathway state (n), then shape (f m), then memory (h), then time (a d), and relay last.
- **Which neurons get a role.** Only the head of each file carries the file's role. A source also marks its first
  12 KB run, and an end its last one, so a path can start or stop there.
- **Today's counts:**
  - r 6 054
  - c 151
  - f 94
  - m 93
  - n 32
  - a 7
  - x 3
  - t 2
  - h, s, e, g: 0, because those files are under 12 KB (NC-Q2)

## 4. How the gates compose (the logic, for the engines)

A **signal** is a token with a weight w, travelling from address to address.

- **relay:** w stays.
- **amplify / damp:** w ± 1, clamped to 0…9. At w = 0 the signal dies.
- **fork:** the same signal goes to both outputs. Each copy has w − 1 (splitting costs strength), but never below 1.
- **merge:** fires once all its listed inputs have arrived within one window. The output w is the largest input
  w plus 1 (agreement strengthens).
- **threshold k/n:** like merge, but k of n inputs are enough. k defaults to ⌈n/2⌉.
- **gate:** holds the signal until its condition is true. The condition is a fact in the stack, for example
  "decision Q:x answered". When it opens, the signal passes with its w.
- **switch:** picks output 0 or 1 from a fact. For a decision, the fact is the chosen option.
- **inhibit:** its output marks the next address *muted* for one window. A muted neuron drops what it receives.
- **hold:** stores the last signal and re-emits it when an engine reads the address. Reading clears it,
  unless the address is pinned.
- **clock:** emits w = its weight on a period. The period is taken from the file's own rhythm: daily for
  days, per run for runs.
- **source / end:** where paths start and stop. An end emits nothing; it is logged as "left the system".

These rules are the contract only. Nothing executes them yet; that is phase P2.

## 5. Stringing neurons into memory paths (the later phases)

A **path** is an ordered list of addresses, written as one string:

```
s7k2qa > rczwtj > fq3m0p { r8kk2n | r8k1wd } > m55t0z > e9a0xh
```

- `>` follows.
- `{ … | … }` marks a fork's two branches.
- A merge closes them.

Because addresses are short and stable, a path is small enough to:

- store as a pattern, alongside the stack's existing `patterns.json`, which mines tool sequences from sessions;
- compare by edit distance;
- replay as firing in the Konnektóm (the tracers already draw neuron-to-neuron lines);
- hand to an agent as "the way this kind of work went last time".

**Proposed phases:**

1. **P1, record.** Turn each recorded session's firing (the run → touched nodes, already in `D.fire`) into the
   path of neurons it lit, in time order. Keep only the head neurons, so paths stay short.
2. **P2, engine.** A small runner that pushes a signal along a path with the section 4 rules, so a path can be
   *tested*: does it still reach its end, which gate is closed, where did the signal die?
3. **P3, patterns.** Mine repeated sub-paths across sessions (the same miner as `patterns.js`, on addresses
   instead of tool names). Name the frequent ones; they are the *memory path patterns*.
4. **P4, use.** Given a new task, find the closest pattern and propose its next addresses. Show it lit in the Holo.

## 6. Open questions (NC-Q)

- **NC-Q1. Gate letter in the address, or only beside it?** Today it is inside, as you asked: the code says
  what the neuron does.
  - The cost: when the role changes, the full 6-character code changes. The root stays the same.
  - The alternative: a 5-character root as the address, with the gate as a tag.
- **NC-Q2. Small files.** Under 12 KB a file has no neuron, so memory notes, decisions and briefs (the h, g, s,
  e roles) have none today. Options:
  - **A.** every file gets at least one *point neuron* (its whole length), marked as tier 0;
  - **B.** keep 12 KB as the floor.
- **NC-Q3. Forks and merges by links, not only by facts.** Today `f` comes from "on two pathways" and `m` from
  "8+ links". The engine (P2) would be more useful if a fork listed its two actual next addresses (the two
  pathways' next files). That needs the path order from P1 first.
- **NC-Q4. Weight scale.** Today: 1–9, starting at tier + 1, ±1 per amplify or damp.
  Alternative: start every neuron at w5 and let only gates move it.
