---
title: "RAG and Vector Search, Explained Simply"
description: "How AI assistants actually look things up, in plain language with pictures — matching words vs matching meaning, why deleting is the hard part, and where the data can live."
pubDate: 2026-10-30
tags: ["aws", "dynamodb", "rag", "ai", "vector-search", "infra"]
---

> AI assistants don't actually "know" your documents. They look things up, fast, every time you ask. This is a plain-language tour of how that lookup works — and why choosing where to keep the data is trickier than it sounds.

## The problem: a librarian with no memory

Imagine hiring a brilliant librarian who forgets everything the moment you walk away. They can read anything you hand them and explain it beautifully — but they can't remember your filing cabinet.

So every time you ask a question, someone has to run to the cabinet, grab the handful of pages most likely to help, and put them in the librarian's hands *before* they answer.

That errand is the whole trick. It's called **RAG** — retrieval-augmented generation. Unpacked: *go find the relevant stuff, then let the AI answer using it.*

<figure class="diagram" role="img" aria-label="Diagram showing a question going to a document store, retrieving relevant pages, then to the AI which produces an answer"><svg viewBox="0 0 580 200" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="rag2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="12" y="74" width="104" height="48" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="64" y="94" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Your</text><text x="64" y="110" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">question</text><line x1="120" y1="98" x2="152" y2="98" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag2-arrow)"/><rect x="156" y="60" width="120" height="76" rx="8" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="216" y="84" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">The cabinet</text><text x="216" y="103" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">all your documents,</text><text x="216" y="117" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">cut into small pieces</text><line x1="280" y1="98" x2="312" y2="98" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag2-arrow)"/><text x="296" y="88" text-anchor="middle" fill="#8b8b96" font-size="9" font-family="Inter, sans-serif">top 5</text><rect x="316" y="74" width="104" height="48" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="368" y="94" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Relevant</text><text x="368" y="110" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">pages</text><line x1="424" y1="98" x2="456" y2="98" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#rag2-arrow)"/><rect x="460" y="74" width="108" height="48" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="514" y="94" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">AI reads them,</text><text x="514" y="110" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">then answers</text><text x="290" y="172" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">The AI never memorises anything. Every question starts another trip to the cabinet.</text></svg><figcaption>RAG in one picture. The interesting engineering is almost entirely in the middle box — finding the right handful of pages.</figcaption></figure>

Everything below is about that middle box.

---

## Two ways to find a page

### Way one: match the words

The old, obvious approach. You typed "refund" — go find pages containing "refund." This is how search has worked for decades, and it is *excellent* at a particular thing: exact oddities. Order numbers. Error codes. People's names.

If you search for `ERR_5521`, word-matching finds the one page with that exact string and is completely certain about it.

Its weakness is just as specific. Ask *"how do I get my money back"* and it will happily return nothing at all — because the page you wanted says **"refund policy"**, and not one of your words appears on it. The computer isn't being obtuse. It genuinely has no idea that "money back" and "refund" are the same idea.

### Way two: match the meaning

The newer approach turns every piece of text into a long list of numbers — a few hundred of them — that act like **coordinates on a map of meaning.**

That sounds abstract, so here's the thing that makes it click: on this map, *things that mean similar things end up near each other*, even when they share no words at all.

<figure class="diagram" role="img" aria-label="A map of meaning where refund policy and money back sit close together, while an unrelated topic sits far away"><svg viewBox="0 0 580 262" xmlns="http://www.w3.org/2000/svg" role="presentation"><rect x="40" y="18" width="500" height="196" rx="8" fill="#141418" stroke="#2a2a31"/><line x1="40" y1="116" x2="540" y2="116" stroke="#23232a" stroke-width="1"/><line x1="290" y1="18" x2="290" y2="214" stroke="#23232a" stroke-width="1"/><circle cx="150" cy="72" r="6" fill="#4ade80"/><text x="164" y="69" fill="#e9e9ec" font-size="11.5" font-family="Inter, sans-serif">"refund policy"</text><text x="164" y="84" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">(a page in your cabinet)</text><circle cx="196" cy="110" r="6" fill="#8b9eff"/><text x="210" y="107" fill="#e9e9ec" font-size="11.5" font-family="Inter, sans-serif">"how do I get my money back"</text><text x="210" y="122" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">(what you typed)</text><line x1="156" y1="78" x2="190" y2="104" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="3 3"/><text x="146" y="100" fill="#4ade80" font-size="9.5" font-family="Inter, sans-serif">close</text><circle cx="452" cy="178" r="6" fill="#6b6b76"/><text x="330" y="182" text-anchor="end" fill="#8b8b96" font-size="11.5" font-family="Inter, sans-serif">"how to reset your password"</text><line x1="338" y1="178" x2="444" y2="178" stroke="#3a3a44" stroke-width="1.5" stroke-dasharray="3 3"/><text x="392" y="170" text-anchor="middle" fill="#6b6b76" font-size="9.5" font-family="Inter, sans-serif">far away</text><text x="290" y="246" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">Not one word in common — but the meanings land in the same neighbourhood.</text></svg><figcaption>Searching becomes "what's nearest to my question on this map?" rather than "which pages contain my words?"</figcaption></figure>

Those coordinate-lists are called **vectors**, and this is **semantic search**. Finding an answer is now a geometry question: *what sits closest to the question?*

It handles paraphrasing, typos, and even different languages — a question in Thai can land right next to an English page that means the same thing.

But it has two quirks worth knowing, because both bite real users.

**It blurs near-identical oddities.** `ERR_5521` and `ERR_5522` mean almost nothing to the map, so they land nearly on top of each other. The precision that word-matching gives you for free is exactly what this loses.

**It can never say "I don't know."** This is the big one. Ask for the nearest 5 pages and you *always* get 5 pages — even when your cabinet contains nothing remotely relevant. There's always *something* nearest. The system hands over 5 unrelated pages with no warning, the AI dutifully reads them, and you get a confident answer built on nothing.

<figure class="diagram" role="img" aria-label="Diagram contrasting word search returning zero results with meaning search always returning five results"><svg viewBox="0 0 580 206" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="290" y="20" text-anchor="middle" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif">You ask about something that simply isn't in your cabinet</text><rect x="26" y="38" width="248" height="128" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="150" y="62" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Word matching</text><text x="150" y="92" text-anchor="middle" fill="#4ade80" font-size="26" font-weight="600" font-family="Inter, sans-serif">0 results</text><text x="150" y="120" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">"Nothing here."</text><text x="150" y="140" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">Honest. You know to stop.</text><rect x="306" y="38" width="248" height="128" rx="8" fill="#16161a" stroke="#f87171" stroke-width="1.5"/><text x="430" y="62" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Meaning matching</text><text x="430" y="92" text-anchor="middle" fill="#f87171" font-size="26" font-weight="600" font-family="Inter, sans-serif">5 results</text><text x="430" y="120" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">...all irrelevant, none flagged.</text><text x="430" y="140" text-anchor="middle" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">The AI answers anyway.</text><text x="290" y="192" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">This is where a lot of "why did the AI make that up?" actually comes from.</text></svg><figcaption>Meaning-based search has no natural way to report "nothing matched." If you don't add that check yourself, nobody does.</figcaption></figure>

The fix is unglamorous: measure *how far away* the nearest result was, and if it's beyond some distance, say "I don't have anything on that" instead of answering.

### Way three: just do both

Run both searches, then merge the two lists of results. Word-matching catches the error codes; meaning-matching catches the paraphrases. A page that scores well on *both* is almost certainly the right one.

This is **hybrid search**, and it's the best-quality option. The catch is that you're now maintaining two separate search systems over the same documents, and they have to agree — including when a document is deleted. That's real ongoing work, not a checkbox.

| | Word matching | Meaning matching | Both |
| --- | --- | --- | --- |
| Error codes, IDs, names | Excellent | Poor | Excellent |
| "Said differently" questions | Poor | Excellent | Excellent |
| Different languages | No | Yes | Yes |
| Can say "nothing matched" | Yes | No | Partly |
| Systems to maintain | One | One | Two |

---

## Where do you keep all this?

Now the practical question. Those coordinate-lists have to live somewhere, and you have three broad options.

For years the answer was a **specialist vector database** — a separate system built purely for "find me the nearest coordinates." They're very good at it.

But they introduce a quiet structural problem. Your ordinary information (who uploaded this file, what it's called, who's allowed to see it) lives in your normal database. The coordinates live in the specialist one. **Two systems, two copies, and nothing keeping them honest.**

<figure class="diagram" role="img" aria-label="Diagram contrasting a two-system setup where deletes can be forgotten with a one-system setup where deletes cascade automatically"><svg viewBox="0 0 580 248" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="rag3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><text x="146" y="20" text-anchor="middle" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif" letter-spacing="0.4">TWO SYSTEMS</text><rect x="22" y="32" width="248" height="162" rx="8" fill="#16161a" stroke="#f87171" stroke-width="1.5"/><rect x="40" y="48" width="96" height="40" rx="5" fill="#1e1e24" stroke="#3a3a44"/><text x="88" y="66" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">file info</text><text x="88" y="80" text-anchor="middle" fill="#8b8b96" font-size="9" font-family="Inter, sans-serif">main database</text><rect x="156" y="48" width="96" height="40" rx="5" fill="#1e1e24" stroke="#3a3a44"/><text x="204" y="66" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">coordinates</text><text x="204" y="80" text-anchor="middle" fill="#8b8b96" font-size="9" font-family="Inter, sans-serif">vector database</text><text x="88" y="112" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">delete ✓</text><text x="204" y="112" text-anchor="middle" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">...forgotten ✗</text><line x1="88" y1="120" x2="88" y2="136" stroke="#3a3a44" stroke-width="1.2" marker-end="url(#rag3-arrow)"/><line x1="204" y1="120" x2="204" y2="136" stroke="#3a3a44" stroke-width="1.2" marker-end="url(#rag3-arrow)"/><text x="146" y="156" text-anchor="middle" fill="#f87171" font-size="10.5" font-weight="600" font-family="Inter, sans-serif">File looks deleted.</text><text x="146" y="174" text-anchor="middle" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">Its content is still searchable.</text><text x="434" y="20" text-anchor="middle" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif" letter-spacing="0.4">ONE SYSTEM</text><rect x="310" y="32" width="248" height="162" rx="8" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><rect x="342" y="48" width="184" height="40" rx="5" fill="#1e1e24" stroke="#3a3a44"/><text x="434" y="66" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">file info + coordinates</text><text x="434" y="80" text-anchor="middle" fill="#8b8b96" font-size="9" font-family="Inter, sans-serif">stored together</text><text x="434" y="112" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">delete ✓</text><line x1="434" y1="120" x2="434" y2="136" stroke="#3a3a44" stroke-width="1.2" marker-end="url(#rag3-arrow)"/><text x="434" y="156" text-anchor="middle" fill="#4ade80" font-size="10.5" font-weight="600" font-family="Inter, sans-serif">Both vanish together.</text><text x="434" y="174" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">Nothing to remember.</text><text x="290" y="230" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">Deleting is where two-system setups quietly go wrong — and it rarely announces itself.</text></svg><figcaption>Keeping the coordinates beside the data they describe removes an entire category of bug, rather than relying on everyone remembering the second delete.</figcaption></figure>

That deletion gap is not hypothetical. It's easy to ship a "delete file" button that removes the row from the main database and never touches the coordinates — the file disappears from the interface while its contents stay findable. Nothing errors. Nobody notices until someone asks the AI about a document that supposedly no longer exists.

Which is why the recent interesting development is that **ordinary databases can now do this too.**

- **Postgres** (with an add-on called pgvector) stores coordinates in a regular table. Your data and its coordinates live in one place, and it can do word-matching *and* meaning-matching — so proper hybrid search is genuinely within reach.
- **DynamoDB**, as of August 2026, has this built in natively. The coordinates attach to the item itself, so deleting the item removes them automatically. There's no server to run, and an idle system costs essentially nothing.

| | DynamoDB | Postgres + pgvector | Specialist vector DB |
| --- | --- | --- | --- |
| Data and coordinates together | Yes | Yes | No |
| Deleting removes both | Automatically | Yes | You must remember |
| Can also do word matching | No | Yes | Usually |
| Narrowing results | Exact matches only | Anything | Flexible |
| Running costs when idle | Near zero | Pay for the server | Pay for the cluster |
| Something to operate | No | A database | A cluster |

There's no winner here, and that's the honest answer. A specialist vector database is the strongest *searcher*. Postgres is the most *flexible*. DynamoDB is the least work to *own*.

## Three surprises if you try the DynamoDB route

**You can only narrow results by exact matches.** You can say "only this customer's documents." You cannot say "only documents from the last month," or "any of these three folders." Those have to be handled in your own code. Worth knowing early, because the setup is locked in when you create it — changing your mind later means rebuilding.

**Separating customers is not the same as securing them.** You can group each customer's documents separately, and it's tempting to assume that keeps them apart. It doesn't — it's organisation, not a lock. Anyone whose code can run a search can search *any* group. The protection has to live in your application, and AWS says this plainly in its own documentation. It's worth repeating because it quietly contradicts how the rest of DynamoDB usually works.

**A broken save can look like a successful one.** Get a detail wrong — a mismatched setting, a missing field — and the save *succeeds* while the item silently never becomes searchable. No error, a green tick, and a system that finds nothing. The defence is simple: after loading documents, count how many are actually searchable, and shout if the number is short.

## What to remember

- **RAG is just an errand.** Fetch the relevant pages, hand them to the AI, let it answer from those.
- **Word matching is precise, meaning matching is flexible.** They fail on opposite kinds of question, which is why using both works so well.
- **Meaning-based search never admits defeat** — it always returns *something*. Check how close the match really was, or you'll ship confident nonsense.
- **Deleting is the hard part.** If the coordinates live in a separate system from the data, someone will eventually forget to delete them in both.
- **Chunk well.** How you slice documents matters more than which storage you choose. A fragment reading "the limit is 50 per hour" is unfindable on its own — give each piece a line of context about where it came from, and it becomes findable.
- **Pick for the work you're signing up for**, not the benchmark. They all search well enough. They differ enormously in what you have to maintain.
