# Local pre-prompt filter: prior art and directions

Read 2026-11-24. Author: Akecheta. Every claim has a link and was read on that date, except lines marked **[recalled]**. Those come from memory, have no fetched source, and need checking before use.

**Access limits.** `arxiv.org`, `huggingface.co` and `snowballstem.org` did not resolve from this session, so no paper abstract was read. For papers I used the authors' GitHub READMEs. That means **no accuracy figures for the retrieval-gating classifiers** (section 1), and no router quality numbers beyond what READMEs state. If those hosts are allowed, a second pass can fill the gaps. Project context: `node tools/vrg-ctx.js q` answered "No index yet", so nothing was checked against the Stack.

Convention: "Source says" is the page's claim. "Conclusion" is mine.

## 1. Retrieval gating (retrieve or not)

- **Self-RAG.** Source says: the model emits reflection tokens (`[Retrieval]` / `[No Retrieval]`, plus relevance, support and utility critiques). It can "multiple times or completely skip retrieval". A `threshold` (default 0.2) controls how often adaptive retrieval fires. [github.com/AkariAsai/self-rag](https://github.com/AkariAsai/self-rag). No benchmark numbers on that page.
- **Adaptive-RAG.** Source says: a smaller LM (`t5-large`) is trained to predict query complexity. It then picks no retrieval, single-step retrieval, or iterative multi-step retrieval. Labels are "silver" (what the retrieval-augmented LLM answered correctly) plus dataset-bias "binary" labels. [github.com/starsuzi/Adaptive-RAG](https://github.com/starsuzi/Adaptive-RAG). Conclusion: the label-making trick, using the outcome of the cheaper path as free supervision, transfers directly to this project. Accuracy: not read.
- **FLARE.** Source says: it predicts the upcoming sentence and retrieves only when that sentence contains low-confidence tokens. [github.com/jzbjyb/FLARE](https://github.com/jzbjyb/FLARE). Conclusion: this needs token probabilities from the generator. A pre-prompt filter has none, so FLARE applies only to the mid-session variant, not to the first prompt.
- **SKR (self-knowledge guided retrieval)** and other retrieval-necessity classifiers: not fetched (the paper host was blocked). The idea is that the model's own knowledge of the question decides whether to retrieve. **[recalled]**
- Signals used by these methods: query complexity (Adaptive-RAG), generator confidence (FLARE), model self-critique (Self-RAG). None use "does this term occur in my private corpus". Conclusion: for a personal knowledge graph, corpus-hit evidence (section 4) is a cheaper and more direct signal than any of these.

## 2. Cost routing between models

- **RouteLLM.** Source says: trained routers "reduce costs by up to 85%" while keeping 95% of GPT-4 performance on MT Bench, and match commercial routers at over 40% lower cost. Router types: matrix factorisation (recommended), a BERT classifier, a causal-LLM classifier, similarity-weighted Elo, and random. Trained on preference data for a GPT-4 / Mixtral pair; the README says they generalise to other pairs. Apache-2.0. [github.com/lm-sys/RouteLLM](https://github.com/lm-sys/RouteLLM). Last-commit date not shown on the page. Conclusion: the 85% figure is a ceiling on chat benchmarks, not coding-agent sessions. The README does not show it for tool-using work.
- **FrugalGPT.** Source says: a collection of techniques for LLM use under budget constraints, with cached generations from 12 commercial LLMs. Apache-2.0. [github.com/stanford-futuredata/FrugalGPT](https://github.com/stanford-futuredata/FrugalGPT). The README gives no savings figure. The three strategies (prompt adaptation, approximation, cascade) are **[recalled]**.
- **RouterBench.** Source says: a benchmark and pipeline for multi-LLM routing, with cost-versus-performance plots, a dataset on Hugging Face, MIT licence. [github.com/withmartian/routerbench](https://github.com/withmartian/routerbench). Prompt and model counts: not on the page.
- **Hybrid LLM** (small-versus-large router with a tunable quality threshold) and Not Diamond: not fetched.
- Conclusion: all of these train on pairwise quality data. A solo user has none at the start, so a rule-based router with logged overrides (section 6) is the realistic start. The one transferable idea is a single quality-versus-cost threshold you can tune.

## 3. Local semantic or intent routers

- **semantic-router (aurelio).** Source says: it compares a request to example utterances per route in vector space. Each decision carries a calibratable confidence score. The quickstart uses a local FastEmbed model (`BAAI/bge-small-en-v1.5`) that "runs entirely on your machine", with no API key. MIT. [github.com/aurelio-labs/semantic-router](https://github.com/aurelio-labs/semantic-router). Conclusion: Python only. In Node you would reimplement the idea, which is small (embed utterances, cosine, threshold).
- **model2vec.** Source says: static embeddings, models "up to 500 times faster" on CPU and "up to 50" times smaller, with the best model about 30 MB and the smallest about 8 MB. One multilingual model, `potion-multilingual-128M`, is distilled from bge-m3. MIT. [github.com/MinishLab/model2vec](https://github.com/MinishLab/model2vec). Conclusion: the best fit for a hook with a 30 s timeout (section 5). Whether it handles Hungarian well is **not confirmed**; test it on your own prompts.
- **KeyBERT** can use model2vec as a backend and suggests `paraphrase-multilingual-MiniLM-L12-v2` for multilingual text. MIT. [github.com/MaartenGr/KeyBERT](https://github.com/MaartenGr/KeyBERT).
- multilingual-e5-small, bge-m3 and fastText: not fetched (Hugging Face blocked). That bge-m3 is multilingual follows from model2vec's README above. fastText classifiers are very fast but need labelled data.
- **Hungarian.** Nothing fetched shows measured Hungarian intent-routing accuracy. Open question; the cheapest answer is to build a 50 to 100 prompt labelled set (section 6) and compare candidates on it.

## 4. Keyword and statistical methods

- **Term specificity against your own corpus.** The Stack already uses SQLite full-text search. Conclusion (mine, no external source): SQLite FTS5 can return BM25 ranking, so "best BM25 score of the prompt's terms against the Stack" is a near-free dependence signal. A prompt whose rare terms hit many Stack nodes is "dependent". A prompt with no hits is "independent". Check FTS5's `bm25()` in the SQLite docs before building.
- **YAKE.** Source says: unsupervised, needs no training, external corpus or dictionaries, and supports multiple languages. The page shows English and Portuguese examples and does not mention Hungarian. [github.com/LIAAD/yake](https://github.com/LIAAD/yake). Licence not named on the page. Hungarian: not confirmed.
- **KeyBERT**: see section 3. It adds an embedding model, so heavier than YAKE.
- **HuSpaCy.** Source says: spaCy pipelines for Hungarian with tokenizer, lemmatiser, morphological tagger, dependency parser, NER and embeddings. Four models: `md` (fastest, 3 of 5 stars), `lg` (4), `trf` (4.5, GPU recommended), `trf_xl` (5). Library Apache-2.0, models CC BY-SA 4.0. [github.com/huspacy/huspacy](https://github.com/huspacy/huspacy). No lemmatiser accuracy figures on the page. Conclusion: Python only, so a Node hook would shell out to it or use another route.
- Snowball Hungarian, Hunspell, emMorph / e-magyar: not fetched (host blocked, or no time). They are the lighter options for Node, but I have no verified source. A Hungarian agglutinative-suffix problem is real, so a stemmer or prefix-match (for example the first 5 to 6 characters) is a plausible cheap compromise. This is my reasoning, not sourced.

## 5. Prompt augmentation, compression, harnessing

- **UserPromptSubmit hook (official).** Source says: it runs when a prompt is submitted, before Claude processes it; it has no matcher, so it fires every time. The prompt arrives as the `prompt` field of the stdin JSON, along with `session_id`, `transcript_path`, `cwd` and `permission_mode`. Output: plain stdout on exit 0 is added to context. JSON `hookSpecificOutput.additionalContext` is delivered as a system reminder alongside the prompt. `decision: "block"` or exit code 2 blocks the prompt. `sessionTitle` can set the session title. [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks).
  - Limits stated there: `additionalContext`, `systemMessage` and stdout are each capped at 10,000 characters, and overflow is saved to a file with only a 2,000-character preview delivered. The default timeout is 30 s, and a timed-out hook is cancelled and the prompt still goes through (unless `onFailure: "block"`, which needs Claude Code v2.1.295 or later). Hooks also fire on scheduled tasks, background subagent reports and cross-session messages.
  - Conclusion: the hook can add context and a title. **I found no output field that switches the model.** I read about two thirds of that page (characters 0 to 200,000 of 293,835), so absence is not proven. "Suggested model" would therefore be text in `additionalContext` or a prompt for you to act on, not an enforced switch. Verify before designing around it.
- **Anthropic, effective context engineering.** Source says: context is "a finite resource with diminishing marginal returns"; aim for "the smallest set of high-signal tokens". Agents keep lightweight identifiers (paths, queries, links) and load data at runtime. A hybrid of up-front loading and just-in-time exploration is described, with Claude Code loading CLAUDE.md up front and using glob and grep otherwise. Advice: "do the simplest thing that works". [anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Conclusion: the dressed context should be pointers (Stack node ids, file paths), not pasted content.
- **LLMLingua.** Source says: "up to 20x compression with minimal performance loss". The example is 2,365 tokens to 211, a single illustration rather than a benchmark. LongLLMLingua is "up to 21.4%" better RAG performance with a quarter of the tokens. MIT. The page gives no quantified quality loss, and its sample output is visibly garbled. [github.com/microsoft/LLMLingua](https://github.com/microsoft/LLMLingua). Conclusion: compress retrieved context, not the user's own prompt or code.
- **DSPy.** Source says: "programming, rather than prompting" language models; its optimisers tune prompts and weights. MIT. [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy). Conclusion: heavy for this need; useful later to optimise the classifier prompt against your labelled set.
- **MCP for local knowledge:** the Stack already exposes `stack_search` and related tools through MCP (per CLAUDE.md). I did not research MCP further.

## 6. Feedback loops

No source fetched covers this directly. RouteLLM and Adaptive-RAG above show that routers are trained on outcome labels. The "silver label" idea in Adaptive-RAG is the closest model: label by what worked. Bandit approaches are not fetched and not cited. Conclusion (mine): log, per prompt, the verdict, the dressed fields, and any override (you pick another model or say "no context needed"). An override is a free label. Keep a frozen labelled set of 50 to 100 prompts, in both languages, to compare any rule change.

## 7. Risks

Each is my reasoning unless a link is given.
- **Misrouting cost:** a wrong "independent" verdict costs a failed first turn on a weak model plus a retry. A wrong "dependent" verdict costs tokens only. Bias the threshold toward "dependent". Anthropic's own advice is to test with the best model first ([source](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).
- **Injection via dressed context:** anything pulled from the Stack (notes, commit text, fetched pages) enters as a system reminder, which carries more authority than a tool result. Pass only ids and short quoted fields, and never raw fetched text. Note the hook doc says `additionalContext` arrives as a system reminder ([source](https://code.claude.com/docs/en/hooks)).
- **Privacy:** the filter is local, but whatever it appends goes online. Keep client names and addresses out of `additionalContext` (it is sent to the model).
- **Over-constraining:** a rigid harness blocks better answers. Prefer "preferred" and "default" wording, and let you override per prompt.
- **Silent failure:** a timed-out hook lets the prompt through without context ([source](https://code.claude.com/docs/en/hooks)). Log every timeout.

## Where this could go (value over effort)

1. **Move the filter into a UserPromptSubmit hook** so it works in every session. Official, and the field and output formats are confirmed. [hooks docs](https://code.claude.com/docs/en/hooks).
2. **FTS5/BM25 corpus-hit gate** as the first dependence signal; no model needed, and fast. Supports: "retrieval necessity" is the open problem in section 1, and corpus hits answer it directly. Check SQLite's `bm25()` docs for the weight function.
3. **Pointer-only dressing**: append Stack node ids and file paths, not content. [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
4. **Per-intent output templates** (a few fixed forms chosen by verdict), kept under the 10,000-character cap. [hooks docs](https://code.claude.com/docs/en/hooks).
5. **Override logging and a labelled eval set** (50 to 100 bilingual prompts); override as free label. [Adaptive-RAG silver labels](https://github.com/starsuzi/Adaptive-RAG).
6. **Local embedding index of the Stack** with model2vec (about 30 MB, CPU, multilingual variant), tested on Hungarian first. [model2vec](https://github.com/MinishLab/model2vec).
7. **Session-to-workline linker**: use the hook's `session_id`, `cwd` and `sessionTitle` output to tag each session with a workline automatically. [hooks docs](https://code.claude.com/docs/en/hooks).
8. **Learned thresholds from overrides**: tune one dial (cost versus quality), as RouteLLM does with its threshold. [RouteLLM](https://github.com/lm-sys/RouteLLM).
9. **Mid-session re-routing**: hooks fire on every prompt, so the same filter can flag a drift ("this prompt now needs the Stack"). FLARE's trigger idea is the model-side analogue. [FLARE](https://github.com/jzbjyb/FLARE).
10. **Model suggestion, then cascade**: suggest a cheap model first and escalate on a failed or overridden first turn. FrugalGPT is the cascade source. [FrugalGPT](https://github.com/stanford-futuredata/FrugalGPT). Confirm first whether a hook can switch models at all (see section 5).
11. **Semantic-router-style utterance routes** in Node (embed 5 to 10 example prompts per intent, cosine and threshold). [semantic-router](https://github.com/aurelio-labs/semantic-router).
12. **Token budget prediction**: not researched; no source. Start by logging prompt length against session token use, and see whether it predicts anything.

## Not confirmed

- Accuracy of any retrieval-gating classifier (Adaptive-RAG, SKR, Self-RAG); the paper hosts were blocked.
- Quality-versus-cost curves for Hybrid LLM, RouterBench and FrugalGPT; the READMEs give none apart from RouteLLM's.
- Hungarian performance of model2vec, bge-m3, multilingual-e5, YAKE; Snowball, Hunspell and emMorph for Node.
- Whether a hook can change the model; last-commit dates for every repo (the pages did not show them).
