---
title: "AI Stuff Part 1"
description: "The whole modern AI stack in plain English — next-token prediction, tokens, transformers, context windows, RAG, tools, agents, and MCP — with diagrams and interactive demos."
pubDate: 2026-08-04
tags: ["ai", "llm", "rag", "mcp", "general"]
---

> Strip away the jargon and a large language model does one boringly simple thing: **it predicts the next word**.
>
> Everything else — RAG, agents, MCP, tool use — is machinery bolted around that one guess to feed it the right information at the right moment.

I keep getting asked variations of "so how does this actually work?" This is the answer I wish I could hand over every time — the whole modern AI stack in plain English, no maths required.

It builds up in layers: the brain at the center, then the system wrapped around it, then the specific acronyms people trip over. There are diagrams throughout, plus three demos you can actually poke at.

This is part one, covering the foundations — how models work and how the pieces fit together. Later parts will go deeper on the individual mechanisms.

---

## 1. The core: what an AI model actually is

At the heart of every modern AI is a large language model — an **LLM**. You give it some text, it guesses what comes next, one small chunk at a time. Then it feeds its own output back in and guesses again, over and over, until it has written a full answer.

That's genuinely it. Writing code, explaining physics, holding a conversation — all of it comes out of that one repeated guess.

<figure class="diagram" role="img" aria-label="Diagram of next-token prediction: input tokens enter a neural network which outputs ranked probabilities for the next token"><svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="nt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><text x="90" y="28" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">Your input</text><text x="550" y="28" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">Next-word guesses</text><rect x="30" y="44" width="120" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="90" y="66" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="JetBrains Mono, monospace">the</text><rect x="30" y="86" width="120" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="90" y="108" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="JetBrains Mono, monospace">cat</text><rect x="30" y="128" width="120" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="90" y="150" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="JetBrains Mono, monospace">sat</text><rect x="30" y="170" width="120" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="90" y="192" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="JetBrains Mono, monospace">on the</text><rect x="230" y="80" width="180" height="128" rx="8" fill="#1b1b3a" stroke="#5b6fcf" stroke-width="1.5"/><text x="320" y="130" text-anchor="middle" fill="#e9e9ec" font-size="14" font-weight="600" font-family="Inter, sans-serif">Neural network</text><text x="320" y="152" text-anchor="middle" fill="#8b9eff" font-size="11" font-family="Inter, sans-serif">Billions of parameters</text><text x="320" y="170" text-anchor="middle" fill="#8b9eff" font-size="11" font-family="Inter, sans-serif">Stacked layers</text><line x1="155" y1="124" x2="226" y2="140" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#nt-arrow)"/><line x1="414" y1="140" x2="486" y2="80" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#nt-arrow)"/><rect x="490" y="62" width="120" height="34" rx="6" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="550" y="84" text-anchor="middle" fill="#4ade80" font-size="13" font-weight="600" font-family="JetBrains Mono, monospace">mat (82%)</text><rect x="490" y="104" width="120" height="30" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="550" y="124" text-anchor="middle" fill="#7c7c85" font-size="12" font-family="JetBrains Mono, monospace">floor (9%)</text><rect x="490" y="142" width="120" height="30" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="550" y="162" text-anchor="middle" fill="#7c7c85" font-size="12" font-family="JetBrains Mono, monospace">roof (3%)</text><rect x="490" y="180" width="120" height="30" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="550" y="200" text-anchor="middle" fill="#7c7c85" font-size="12" font-family="JetBrains Mono, monospace">… (6%)</text><path d="M550 214 L550 246 L320 246 L320 212" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#nt-arrow)"/><text x="435" y="266" text-anchor="middle" fill="#7c7c85" font-size="11" font-style="italic" font-family="Inter, sans-serif">the winning word is appended to the input, and the whole thing runs again</text></svg><figcaption>The model picks "mat", adds it to the input, and repeats to build the full answer — one token at a time.</figcaption></figure>

A few words that go with that picture.

### Tokens

The model doesn't read whole words. It chops text into pieces called **tokens** — roughly ¾ of a word each. "Cats" might be one token; "unbelievable" might be three. Every input and output is really a stream of tokens.

Type something and watch it get chopped up:

<figure class="diagram demo">
  <label class="demo-label" for="tok-input">Your text</label>
  <input id="tok-input" class="demo-input" type="text" value="Unbelievably, tokenization isn't intuitive." autocomplete="off" spellcheck="false" />
  <div id="tok-out" class="tok-out" aria-live="polite"></div>
  <p class="demo-note"><span id="tok-count">—</span> · each coloured box is one token the model actually sees</p>
  <figcaption>An approximation of real tokenization — exact splits differ per model, but the shape is right: common words stay whole, rare ones shatter.</figcaption>
</figure>

Notice what happens: common words survive intact, while unusual words, long words, and punctuation break apart. This is also why models are sometimes bad at counting letters in a word — they never saw the letters, only the chunks.

### Parameters (or weights)

These are the billions of internal numbers the model learned during training. Think of them as billions of tiny knobs, tuned until the guessing got good. When someone says a model is "70B", they mean 70 billion knobs.

### Transformer

The specific neural-network design almost every modern LLM uses. Its superpower is **attention**: when processing a word, it looks back at all the other words and decides which ones matter most.

In "the cat sat on the ___", attention lets it notice *cat* and *sat* to land on *mat*. That single idea is why AI got dramatically better after 2017.

<figure class="diagram" role="img" aria-label="Attention diagram showing the blank word attending most strongly to cat and sat"><svg viewBox="0 0 640 190" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="320" y="24" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">Which earlier words matter for guessing the blank?</text><rect x="24" y="44" width="80" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="64" y="66" text-anchor="middle" fill="#7c7c85" font-size="13" font-family="JetBrains Mono, monospace">the</text><rect x="118" y="44" width="80" height="34" rx="6" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="158" y="66" text-anchor="middle" fill="#4ade80" font-size="13" font-weight="600" font-family="JetBrains Mono, monospace">cat</text><rect x="212" y="44" width="80" height="34" rx="6" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="252" y="66" text-anchor="middle" fill="#4ade80" font-size="13" font-weight="600" font-family="JetBrains Mono, monospace">sat</text><rect x="306" y="44" width="80" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="346" y="66" text-anchor="middle" fill="#7c7c85" font-size="13" font-family="JetBrains Mono, monospace">on</text><rect x="400" y="44" width="80" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="440" y="66" text-anchor="middle" fill="#7c7c85" font-size="13" font-family="JetBrains Mono, monospace">the</text><rect x="494" y="44" width="110" height="34" rx="6" fill="#1b1b3a" stroke="#8b9eff" stroke-width="1.5"/><text x="549" y="66" text-anchor="middle" fill="#8b9eff" font-size="13" font-weight="600" font-family="JetBrains Mono, monospace">___</text><path d="M549 82 Q380 165 158 82" fill="none" stroke="#4ade80" stroke-width="3" opacity="0.95"/><path d="M549 82 Q420 150 252 82" fill="none" stroke="#4ade80" stroke-width="2.4" opacity="0.85"/><path d="M549 82 Q500 120 440 82" fill="none" stroke="#8b9eff" stroke-width="1" opacity="0.35"/><path d="M549 82 Q470 130 346 82" fill="none" stroke="#8b9eff" stroke-width="1" opacity="0.3"/><path d="M549 82 Q330 175 64 82" fill="none" stroke="#8b9eff" stroke-width="1" opacity="0.22"/><text x="320" y="184" text-anchor="middle" fill="#7c7c85" font-size="11" font-style="italic" font-family="Inter, sans-serif">thicker line = more attention</text></svg><figcaption>Attention weights aren't equal. "cat" and "sat" carry the signal; the two "the"s carry almost none.</figcaption></figure>

### Training vs. using it

Two totally separate phases, and conflating them causes most of the confusion:

| | Training | Inference |
| --- | --- | --- |
| When | Once, ahead of time | Every time you chat |
| What happens | Reads a huge chunk of the internet, adjusts billions of knobs | Knobs are frozen; just fast next-token guessing |
| Cost | Enormous, slow | Small, fast |
| Analogy | Building the brain | Using the brain |

Training builds the brain; inference uses it. This is also exactly why a model has a **knowledge cutoff** — it only knows what existed when it was trained. Nothing you say in a chat teaches it anything permanent.

---

## 2. Zooming out: the whole AI system

Here's the part most people miss. **The raw LLM is just the engine.** A product like ChatGPT or Claude is a whole system built around that engine.

The model on its own cannot browse the web, remember past chats, or open your files. Those abilities all come from components bolted on around it.

<figure class="diagram" role="img" aria-label="Layered diagram of an AI system: user, application layer, context window, LLM, and external connections"><svg viewBox="0 0 680 400" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="sys-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="250" y="16" width="180" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="340" y="38" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">You</text><line x1="340" y1="50" x2="340" y2="70" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><rect x="24" y="70" width="632" height="250" rx="10" fill="none" stroke="#2a2a31" stroke-dasharray="5 5"/><text x="40" y="90" fill="#7c7c85" font-size="11" font-weight="600" font-family="Inter, sans-serif">APPLICATION LAYER — decides what the model sees</text><rect x="170" y="104" width="340" height="86" rx="8" fill="#111114" stroke="#8b9eff" stroke-width="1.5"/><text x="340" y="126" text-anchor="middle" fill="#8b9eff" font-size="13" font-weight="600" font-family="Inter, sans-serif">Context window</text><text x="340" y="146" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">system prompt · your question · chat history</text><text x="340" y="164" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">retrieved documents · tool results</text><text x="340" y="182" text-anchor="middle" fill="#4a4a52" font-size="10" font-style="italic" font-family="Inter, sans-serif">the model's entire short-term memory</text><line x1="340" y1="190" x2="340" y2="212" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><rect x="230" y="212" width="220" height="70" rx="8" fill="#1b1b3a" stroke="#5b6fcf" stroke-width="1.5"/><text x="340" y="240" text-anchor="middle" fill="#e9e9ec" font-size="14" font-weight="600" font-family="Inter, sans-serif">LLM</text><text x="340" y="262" text-anchor="middle" fill="#8b9eff" font-size="11" font-family="Inter, sans-serif">next-token prediction only</text><rect x="40" y="130" width="106" height="60" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="93" y="155" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Memory</text><text x="93" y="173" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">past chats</text><line x1="146" y1="150" x2="166" y2="150" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><rect x="534" y="130" width="106" height="60" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="587" y="155" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Guardrails</text><text x="587" y="173" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">safety checks</text><line x1="534" y1="150" x2="514" y2="150" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><line x1="170" y1="300" x2="510" y2="300" stroke="#1f1f24" stroke-width="1"/><rect x="24" y="336" width="196" height="52" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="122" y="358" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Vector DB (RAG)</text><text x="122" y="376" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">your private documents</text><rect x="242" y="336" width="196" height="52" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="340" y="358" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Tools</text><text x="340" y="376" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">search · code · email</text><rect x="460" y="336" width="196" height="52" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="558" y="358" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">MCP servers</text><text x="558" y="376" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Drive · Slack · DBs</text><line x1="122" y1="336" x2="122" y2="316" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><line x1="340" y1="336" x2="340" y2="316" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/><line x1="558" y1="336" x2="558" y2="316" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#sys-arrow)"/></svg><figcaption>The model sits at the bottom of the stack, not the top. Everything above it exists to decide what lands in the context window.</figcaption></figure>

### The prompt and the context window

Everything the model "sees" at once is the **context window** — its short-term working memory. Into it goes:

- your question
- hidden instructions (the **system prompt**, which sets the AI's rules and personality)
- any relevant files or past messages the application chose to include

The model has no memory beyond this window. **Every technique below is really about getting the right stuff into that window at the right moment.** If you remember one thing from this post, make it that.

### Embeddings and vector databases

An **embedding** turns text into a list of numbers that captures its *meaning*. Texts about similar things end up with similar numbers, even when they share no words at all.

A **vector database** stores millions of these and instantly finds the ones closest in meaning to your question. This is how AI does "search by meaning" instead of "search by exact keyword" — and it's the engine behind the next section.

<figure class="diagram" role="img" aria-label="Diagram showing sentences about dogs clustering together in meaning-space, away from sentences about finance"><svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="320" y="20" text-anchor="middle" fill="#7c7c85" font-size="11" font-family="Inter, sans-serif">"Meaning space" — closeness means similar meaning, not similar spelling</text><rect x="24" y="34" width="592" height="200" rx="8" fill="#111114" stroke="#1f1f24"/><circle cx="150" cy="90" r="6" fill="#4ade80"/><text x="164" y="94" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif">"my puppy won't stop barking"</text><circle cx="196" cy="130" r="6" fill="#4ade80"/><text x="210" y="134" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif">"the dog is loud"</text><circle cx="140" cy="164" r="6" fill="#4ade80"/><text x="154" y="168" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif">"canine noise complaint"</text><ellipse cx="200" cy="128" rx="130" ry="62" fill="none" stroke="#4ade80" stroke-dasharray="4 4" opacity="0.5"/><text x="200" y="204" text-anchor="middle" fill="#4ade80" font-size="10" font-style="italic" font-family="Inter, sans-serif">no shared keywords, same meaning</text><circle cx="470" cy="86" r="6" fill="#8b9eff"/><text x="484" y="90" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif">"Q3 revenue rose"</text><circle cx="508" cy="126" r="6" fill="#8b9eff"/><text x="522" y="130" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif">"profits are up"</text><ellipse cx="500" cy="108" rx="96" ry="46" fill="none" stroke="#8b9eff" stroke-dasharray="4 4" opacity="0.5"/><text x="500" y="172" text-anchor="middle" fill="#8b9eff" font-size="10" font-style="italic" font-family="Inter, sans-serif">a different neighbourhood</text></svg><figcaption>"my puppy won't stop barking" and "canine noise complaint" share zero words but land next to each other. Keyword search would miss that entirely.</figcaption></figure>

---

## 3. RAG — giving the AI knowledge it wasn't trained on

**RAG** stands for **Retrieval-Augmented Generation**.

The problem it solves: the model's knowledge is frozen at training time, and it knows nothing about *your* private documents. RAG fixes this by fetching relevant information **first**, then handing it to the model alongside your question.

The trick is those embeddings. Your documents get chopped into chunks and stored in a vector database. When you ask something, the system finds the chunks closest in meaning and stuffs them into the context window — so the model answers from real retrieved facts instead of guessing from memory.

<figure class="diagram" role="img" aria-label="RAG pipeline diagram showing indexing ahead of time and retrieval at question time"><svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="rag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker><marker id="rag-arrow-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#4ade80"/></marker></defs><text x="40" y="22" fill="#7c7c85" font-size="11" font-weight="600" font-family="Inter, sans-serif">AHEAD OF TIME — index your documents</text><rect x="24" y="34" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="84" y="53" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Your docs</text><text x="84" y="69" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">PDFs, wiki, code</text><line x1="144" y1="56" x2="182" y2="56" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="186" y="34" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="246" y="53" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Chunk</text><text x="246" y="69" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">split into passages</text><line x1="306" y1="56" x2="344" y2="56" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="348" y="34" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="408" y="53" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">Embed</text><text x="408" y="69" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">text → numbers</text><line x1="468" y1="56" x2="506" y2="56" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="510" y="34" width="166" height="44" rx="6" fill="#111114" stroke="#8b9eff" stroke-width="1.5"/><text x="593" y="53" text-anchor="middle" fill="#8b9eff" font-size="12" font-weight="600" font-family="Inter, sans-serif">Vector database</text><text x="593" y="69" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">searchable by meaning</text><line x1="24" y1="104" x2="676" y2="104" stroke="#1f1f24"/><text x="40" y="130" fill="#7c7c85" font-size="11" font-weight="600" font-family="Inter, sans-serif">AT QUESTION TIME</text><rect x="24" y="144" width="130" height="40" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="89" y="169" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Your question</text><line x1="154" y1="164" x2="192" y2="164" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="196" y="144" width="120" height="40" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="256" y="169" text-anchor="middle" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif">Embed it too</text><path d="M316 164 L400 164 L400 96" fill="none" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><text x="410" y="130" fill="#7c7c85" font-size="10" font-style="italic" font-family="Inter, sans-serif">find nearest chunks</text><path d="M560 82 L560 210 L470 210" fill="none" stroke="#4ade80" stroke-width="1.5" marker-end="url(#rag-arrow-g)"/><rect x="240" y="190" width="226" height="40" rx="6" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="353" y="215" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">Top matching chunks</text><line x1="353" y1="230" x2="353" y2="252" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="180" y="252" width="346" height="44" rx="6" fill="#111114" stroke="#8b9eff" stroke-width="1.5"/><text x="353" y="271" text-anchor="middle" fill="#8b9eff" font-size="12" font-weight="600" font-family="Inter, sans-serif">Context window</text><text x="353" y="288" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">question + retrieved chunks, together</text><line x1="353" y1="296" x2="353" y2="314" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag-arrow)"/><rect x="270" y="314" width="166" height="24" rx="6" fill="#1b1b3a" stroke="#5b6fcf"/><text x="353" y="331" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">LLM writes the answer</text></svg><figcaption>Indexing happens once, up front. Retrieval happens on every question. The model itself never changes.</figcaption></figure>

Try the retrieval step. Pick a question and watch which chunks get pulled — note that matches happen on *meaning*, not shared words:

<figure class="diagram demo">
  <p class="demo-label">Ask the "company handbook"</p>
  <div class="demo-btns" id="rag-btns"></div>
  <div class="rag-cols">
    <div>
      <p class="rag-head">Knowledge base <span class="rag-dim">(7 chunks)</span></p>
      <ul id="rag-chunks" class="rag-list"></ul>
    </div>
    <div>
      <p class="rag-head">Sent to the model</p>
      <pre id="rag-ctx" class="rag-ctx" aria-live="polite"></pre>
    </div>
  </div>
  <figcaption>Only the top-scoring chunks make it into the context window. Everything else is left behind — which is why bad retrieval quietly produces bad answers.</figcaption>
</figure>

Why RAG matters: it keeps answers current and grounded, cuts down on made-up **hallucinations**, and lets an AI work with private data it never saw in training — all without the huge cost of retraining the model.

---

## 4. Tools, agents, and MCP

The model can also *do* things, not just talk.

### Tool use

Also called **function calling**. The application tells the model: "here are some tools you can call — a calculator, a web search, a way to send email." When the model decides it needs one, it outputs a request like *"search the web for X"*. The application runs that action and feeds the result back into the context.

To you it looks seamless. Under the hood, it's the model *asking* and the app *doing*. The model never touches the outside world itself.

### Agents

An **agent** is just an AI doing that in a **loop** to accomplish a bigger goal: think → use a tool → look at the result → decide the next step → repeat, until the task is done.

A basic chatbot answers in one shot. An agent might search, read three pages, run some code, and check its own work before replying.

<figure class="diagram" role="img" aria-label="Agent loop diagram: think, act, observe, repeat until done"><svg viewBox="0 0 620 260" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="ag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker><marker id="ag-arrow-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#4ade80"/></marker></defs><rect x="20" y="106" width="104" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="72" y="133" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Goal</text><line x1="124" y1="128" x2="162" y2="128" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ag-arrow)"/><rect x="166" y="40" width="120" height="44" rx="6" fill="#1b1b3a" stroke="#5b6fcf" stroke-width="1.5"/><text x="226" y="60" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">1. Think</text><text x="226" y="76" text-anchor="middle" fill="#8b9eff" font-size="10" font-family="Inter, sans-serif">what do I need?</text><rect x="340" y="40" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="400" y="60" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">2. Act</text><text x="400" y="76" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">call a tool</text><rect x="340" y="172" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="400" y="192" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">3. Observe</text><text x="400" y="208" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">read the result</text><rect x="166" y="172" width="120" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="226" y="192" text-anchor="middle" fill="#d6d6dc" font-size="12" font-weight="600" font-family="Inter, sans-serif">4. Done?</text><text x="226" y="208" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">if not, loop</text><line x1="286" y1="62" x2="336" y2="62" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ag-arrow)"/><line x1="400" y1="84" x2="400" y2="168" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ag-arrow)"/><line x1="336" y1="194" x2="290" y2="194" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ag-arrow)"/><line x1="226" y1="168" x2="226" y2="88" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ag-arrow)"/><line x1="286" y1="212" x2="470" y2="212" stroke="#4ade80" stroke-width="1.5" marker-end="url(#ag-arrow-g)"/><rect x="474" y="190" width="126" height="44" rx="6" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="537" y="217" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">Final answer</text><text x="374" y="234" fill="#4ade80" font-size="10" font-style="italic" font-family="Inter, sans-serif">yes</text></svg><figcaption>The loop is the whole difference between a chatbot and an agent. Same model, wrapped in a loop with tools.</figcaption></figure>

### MCP

Now the problem **MCP** solves. Every tool and app — Google Drive, Slack, your database — has its own way of connecting. Without a standard, developers hand-build a custom connector for every single combination. Three apps and four tools means twelve integrations.

**MCP** — the **Model Context Protocol** — is a shared "plug shape" that fixes this. It's **USB-C for AI**: build your app to speak MCP once, and it connects to any tool that also speaks MCP.

<figure class="diagram" role="img" aria-label="Comparison diagram: tangled custom integrations versus a single MCP standard layer"><svg viewBox="0 0 680 290" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="160" y="20" text-anchor="middle" fill="#7c7c85" font-size="11" font-weight="600" font-family="Inter, sans-serif">WITHOUT MCP — 3 × 4 = 12 custom connectors</text><rect x="40" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="75" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App A</text><rect x="128" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="163" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App B</text><rect x="216" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="251" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App C</text><rect x="24" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="55" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Drive</text><rect x="98" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="129" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Slack</text><rect x="172" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="203" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">DB</text><rect x="246" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="277" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Git</text><g stroke="#5b6fcf" stroke-width="1" opacity="0.5"><line x1="75" y1="64" x2="55" y2="212"/><line x1="75" y1="64" x2="129" y2="212"/><line x1="75" y1="64" x2="203" y2="212"/><line x1="75" y1="64" x2="277" y2="212"/><line x1="163" y1="64" x2="55" y2="212"/><line x1="163" y1="64" x2="129" y2="212"/><line x1="163" y1="64" x2="203" y2="212"/><line x1="163" y1="64" x2="277" y2="212"/><line x1="251" y1="64" x2="55" y2="212"/><line x1="251" y1="64" x2="129" y2="212"/><line x1="251" y1="64" x2="203" y2="212"/><line x1="251" y1="64" x2="277" y2="212"/></g><text x="160" y="268" text-anchor="middle" fill="#7c7c85" font-size="10" font-style="italic" font-family="Inter, sans-serif">every new tool means rebuilding for every app</text><line x1="340" y1="30" x2="340" y2="260" stroke="#1f1f24"/><text x="510" y="20" text-anchor="middle" fill="#7c7c85" font-size="11" font-weight="600" font-family="Inter, sans-serif">WITH MCP — everyone speaks one protocol</text><rect x="384" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="419" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App A</text><rect x="472" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="507" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App B</text><rect x="560" y="36" width="70" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="595" y="55" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">App C</text><g stroke="#4ade80" stroke-width="1.5"><line x1="419" y1="64" x2="419" y2="112"/><line x1="507" y1="64" x2="507" y2="112"/><line x1="595" y1="64" x2="595" y2="112"/></g><rect x="368" y="112" width="284" height="44" rx="8" fill="#0f2a1c" stroke="#4ade80" stroke-width="1.5"/><text x="510" y="132" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">MCP</text><text x="510" y="148" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">one standard plug shape</text><g stroke="#4ade80" stroke-width="1.5"><line x1="399" y1="156" x2="399" y2="212"/><line x1="473" y1="156" x2="473" y2="212"/><line x1="547" y1="156" x2="547" y2="212"/><line x1="621" y1="156" x2="621" y2="212"/></g><rect x="368" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="399" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Drive</text><rect x="442" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="473" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Slack</text><rect x="516" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="547" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">DB</text><rect x="590" y="212" width="62" height="28" rx="5" fill="#16161a" stroke="#2a2a31"/><text x="621" y="231" text-anchor="middle" fill="#7c7c85" font-size="10" font-family="Inter, sans-serif">Git</text><text x="510" y="268" text-anchor="middle" fill="#4ade80" font-size="10" font-style="italic" font-family="Inter, sans-serif">build once, connect to anything</text></svg><figcaption>The left side is the integration problem every platform eventually hits. MCP collapses N×M custom connectors into N+M.</figcaption></figure>

---

## 5. A few more terms you'll bump into

**Fine-tuning** — taking an already-trained model and training it a bit more on specialized examples (legal contracts, your company's writing style) so it gets better at that niche.

The distinction that matters: RAG **hands** the model facts at question time; fine-tuning **bakes** a skill or style into the model itself. RAG is cheaper and easier to update; fine-tuning goes deeper but costs more.

| | RAG | Fine-tuning |
| --- | --- | --- |
| Changes the model? | No | Yes |
| Good for | Facts, private docs, fresh data | Style, tone, niche skills |
| Updating it | Re-index a document | Re-train |
| Cost | Low | High |

**Hallucination** — when a model states something false with total confidence. It happens because the model is fundamentally guessing plausible next words, and a plausible-sounding wrong answer can score just as well as a right one. RAG and tool use are the main ways to reduce it.

**Multimodal** — a model that handles more than text: images, audio, sometimes video. Same core idea, just trained to turn pictures and sound into tokens too.

**Temperature** — a dial for randomness. Low temperature makes the model pick the most likely next word every time (focused, repetitive); high temperature lets it take chances (creative, less predictable).

Drag the dial and watch the same probabilities get sharpened or flattened:

<figure class="diagram demo">
  <label class="demo-label" for="temp-range">Temperature: <span id="temp-val">0.7</span></label>
  <input id="temp-range" class="demo-range" type="range" min="0" max="20" value="7" step="1" />
  <div id="temp-bars" class="temp-bars"></div>
  <p class="demo-note" id="temp-note"></p>
  <figcaption>Same model, same input, one dial. At 0.0 it always says "mat"; crank it up and "roof" becomes a real possibility.</figcaption>
</figure>

**Prompt engineering** — the craft of wording your request and instructions well. Since everything rides on what's in the context window, how you phrase things genuinely changes output quality.

---

## Putting it all together

Zoom all the way out and the whole picture is one simple loop wrapped in helpful machinery:

- A **transformer-based LLM** sits at the center doing next-token prediction.
- Around it, an **application layer** decides what goes into the **context window**.
- It pulls in facts through **RAG**, connects to the outside world through **tools** and **MCP**, and runs in a loop when acting as an **agent**.

Training builds the brain once. Everything else is about feeding that brain the right context at the right moment.

That framing is genuinely useful when debugging AI systems too. When an answer comes back wrong, the question is almost never "is the model broken?" — it's **"what was actually in the context window when it answered?"** Nine times out of ten, that's where the bug lives.

That's the foundation. In a follow-up I want to go a level deeper on the pieces that deserve their own post — how attention actually works inside a transformer, how RAG chunking and re-ranking make or break retrieval quality, and what it takes to build an agent that doesn't get stuck in its own loop.

<style>
.prose .demo { text-align: left; }
.prose .demo-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-soft);
  margin: 0 0 8px;
}
.prose .demo-input {
  width: 100%;
  padding: 9px 11px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--fg);
  background: var(--bg);
  border: 1px solid var(--line-2);
  border-radius: 6px;
}
.prose .demo-input:focus { outline: none; border-color: var(--accent); }
.prose .demo-range { width: 100%; accent-color: var(--accent); margin: 2px 0 4px; }
.prose .demo-note { margin: 10px 0 0; font-size: 12px; color: var(--muted); }
.prose .tok-out { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; min-height: 30px; }
.prose .tok {
  padding: 3px 7px;
  font-family: var(--font-mono);
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--line-2);
  white-space: pre;
  color: var(--fg-soft);
}
.prose .demo-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.prose .demo-btn {
  padding: 6px 10px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--fg-soft);
  background: var(--panel-2);
  border: 1px solid var(--line-2);
  border-radius: 6px;
  cursor: pointer;
}
.prose .demo-btn:hover { border-color: var(--accent); color: var(--fg); }
.prose .demo-btn[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); background: #16162a; }
.prose .rag-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 620px) { .prose .rag-cols { grid-template-columns: 1fr; } }
.prose .rag-head { margin: 0 0 8px; font-size: 11px; font-weight: 600; color: var(--fg-soft); }
.prose .rag-dim { color: var(--muted); font-weight: 400; }
.prose .rag-list { list-style: none; margin: 0; padding: 0; }
.prose .rag-list li {
  font-size: 12px;
  line-height: 1.45;
  padding: 7px 9px;
  margin-bottom: 6px;
  border-radius: 5px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--muted);
  transition: border-color .15s, color .15s;
}
.prose .rag-list li.hit { border-color: var(--good); color: var(--fg-soft); background: #0f2a1c; }
.prose .rag-score { float: right; font-family: var(--font-mono); font-size: 10px; opacity: .8; }
.prose .rag-ctx {
  margin: 0;
  padding: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--fg-soft);
  background: var(--bg);
  border: 1px solid var(--accent);
  border-radius: 5px;
  min-height: 120px;
}
.prose .temp-bars { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }
.prose .temp-row { display: flex; align-items: center; gap: 10px; }
.prose .temp-word {
  width: 62px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg-soft);
  text-align: right;
  flex: none;
}
.prose .temp-track { flex: 1; height: 20px; background: var(--bg); border-radius: 4px; overflow: hidden; }
.prose .temp-fill { height: 100%; background: var(--accent-soft); border-radius: 4px; transition: width .18s ease; }
.prose .temp-row:first-child .temp-fill { background: var(--good); }
.prose .temp-pct {
  width: 46px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  flex: none;
}
</style>

<script>
// ---- Demo 1: tokenizer ----
(function () {
  var input = document.getElementById("tok-input");
  var out = document.getElementById("tok-out");
  var count = document.getElementById("tok-count");
  if (!input || !out || !count) return;

  var COLORS = ["#1b1b3a", "#0f2a1c", "#2a1f16", "#16232a", "#241628"];
  var COMMON = ["the","a","an","is","isn","it","and","or","but","to","of","in","on","for","with","at","by","this","that","was","are","be","as","not","you","my"];

  // Rough approximation of BPE: keep short/common words whole, split longer ones.
  function tokenize(text) {
    var toks = [];
    var parts = text.match(/\s*[A-Za-z]+|\s*[0-9]+|\s*[^\sA-Za-z0-9]|\s+/g) || [];
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      var bare = part.trim();
      if (!bare) continue;
      var isWord = /^[A-Za-z]+$/.test(bare);
      if (!isWord || bare.length <= 4 || COMMON.indexOf(bare.toLowerCase()) !== -1) {
        toks.push(part);
        continue;
      }
      var lead = part.slice(0, part.length - bare.length);
      var i = 0;
      var first = true;
      while (i < bare.length) {
        var size = i === 0 ? 4 : 3 + (i % 2);
        toks.push((first ? lead : "") + bare.slice(i, i + size));
        i += size;
        first = false;
      }
    }
    return toks;
  }

  function render() {
    var toks = tokenize(input.value);
    out.textContent = "";
    for (var i = 0; i < toks.length; i++) {
      var span = document.createElement("span");
      span.className = "tok";
      span.style.background = COLORS[i % COLORS.length];
      span.textContent = toks[i].replace(/ /g, "·");
      out.appendChild(span);
    }
    count.textContent = toks.length + (toks.length === 1 ? " token" : " tokens");
  }

  input.addEventListener("input", render);
  render();
})();

// ---- Demo 2: RAG retrieval ----
(function () {
  var btnWrap = document.getElementById("rag-btns");
  var list = document.getElementById("rag-chunks");
  var ctx = document.getElementById("rag-ctx");
  if (!btnWrap || !list || !ctx) return;

  var CHUNKS = [
    { text: "Annual leave: staff get 21 paid days per year, accruing monthly from the start date.", topic: "leave", score: 0.86 },
    { text: "Remote work is allowed up to 3 days per week with manager approval.", topic: "remote", score: 0.91 },
    { text: "Expenses under $200 are auto-approved; anything above needs a receipt and sign-off.", topic: "expenses", score: 0.88 },
    { text: "Time off requests should be filed at least two weeks ahead in the HR portal.", topic: "leave", score: 0.74 },
    { text: "Staff may log in from anywhere outside the office, provided their team lead agrees.", topic: "remote", score: 0.79 },
    { text: "Meal receipts must be itemised before they can be reimbursed.", topic: "expenses", score: 0.81 },
    { text: "The office kitchen is restocked on Mondays and Thursdays.", topic: "misc", score: 0.12 }
  ];

  var QUESTIONS = [
    { label: "How many holidays do I get?", topic: "leave" },
    { label: "Can I work from home?", topic: "remote" },
    { label: "Do I need a receipt for lunch?", topic: "expenses" }
  ];

  var MISS = [0.14, 0.11, 0.09, 0.17, 0.13, 0.10, 0.08];

  function pick(qIndex) {
    var q = QUESTIONS[qIndex];
    for (var b = 0; b < btnWrap.children.length; b++) {
      btnWrap.children[b].setAttribute("aria-pressed", String(b === qIndex));
    }

    var scored = CHUNKS.map(function (c, i) {
      var hit = c.topic === q.topic;
      return { text: c.text, score: hit ? c.score : MISS[i], hit: hit };
    });

    var ranked = scored.slice().sort(function (a, b) { return b.score - a.score; });
    var top = ranked.filter(function (s) { return s.hit; }).slice(0, 2);

    list.textContent = "";
    scored.forEach(function (s) {
      var li = document.createElement("li");
      if (top.indexOf(s) !== -1) li.className = "hit";
      var sc = document.createElement("span");
      sc.className = "rag-score";
      sc.textContent = s.score.toFixed(2);
      li.appendChild(sc);
      li.appendChild(document.createTextNode(s.text));
      list.appendChild(li);
    });

    var retrieved = top.map(function (s, i) {
      return "  [" + (i + 1) + "] " + s.text;
    }).join("\n");

    ctx.textContent =
      "SYSTEM: Answer using only the context below.\n\n" +
      "CONTEXT:\n" + (retrieved || "  (nothing matched)") + "\n\n" +
      "USER: " + q.label;
  }

  QUESTIONS.forEach(function (q, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "demo-btn";
    b.textContent = q.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { pick(i); });
    btnWrap.appendChild(b);
  });

  pick(0);
})();

// ---- Demo 3: temperature ----
(function () {
  var range = document.getElementById("temp-range");
  var val = document.getElementById("temp-val");
  var bars = document.getElementById("temp-bars");
  var note = document.getElementById("temp-note");
  if (!range || !val || !bars || !note) return;

  var WORDS = ["mat", "floor", "roof", "moon"];
  var LOGITS = [3.4, 1.6, 0.7, 0.1];

  var rows = WORDS.map(function (w) {
    var row = document.createElement("div");
    row.className = "temp-row";
    var word = document.createElement("span");
    word.className = "temp-word";
    word.textContent = w;
    var track = document.createElement("div");
    track.className = "temp-track";
    var fill = document.createElement("div");
    fill.className = "temp-fill";
    track.appendChild(fill);
    var pct = document.createElement("span");
    pct.className = "temp-pct";
    row.appendChild(word);
    row.appendChild(track);
    row.appendChild(pct);
    bars.appendChild(row);
    return { fill: fill, pct: pct };
  });

  function render() {
    var t = Number(range.value) / 10;
    val.textContent = t.toFixed(1);

    var probs;
    if (t === 0) {
      probs = LOGITS.map(function (_, i) { return i === 0 ? 1 : 0; });
    } else {
      var exps = LOGITS.map(function (l) { return Math.exp(l / t); });
      var sum = exps.reduce(function (a, b) { return a + b; }, 0);
      probs = exps.map(function (e) { return e / sum; });
    }

    probs.forEach(function (p, i) {
      rows[i].fill.style.width = (p * 100).toFixed(1) + "%";
      rows[i].pct.textContent = (p * 100).toFixed(1) + "%";
    });

    note.textContent = t === 0
      ? "Fully deterministic — always picks “mat”. Same input, same output, every time."
      : t < 0.5
        ? "Focused. Nearly always “mat” — good for factual answers and code."
        : t < 1.1
          ? "Balanced. The default range for most chat assistants."
          : "Creative and risky. Unlikely words become real options — including nonsense.";
  }

  range.addEventListener("input", render);
  render();
})();
</script>
