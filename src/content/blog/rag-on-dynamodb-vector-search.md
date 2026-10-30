---
title: "RAG on DynamoDB, and Why We Didn't Pick pgvector"
description: "The short version: we picked a vector store on delete semantics and tenancy, not on search quality — plus a quick tour of keyword vs semantic vs hybrid retrieval."
pubDate: 2026-10-30
tags: ["aws", "dynamodb", "rag", "ai", "vector-search", "infra"]
---

> **TL;DR** — DynamoDB now has native vector search. We chose it over pgvector and Zilliz for a multi-tenant RAG feature, and the deciding factor was *deletes*, not recall. Short post; no deep dive.

## The three kinds of search

Worth being precise, because "RAG" gets used for three strategies with very different failure modes.

<figure class="diagram" role="img" aria-label="Comparison of keyword, semantic, and hybrid retrieval"><svg viewBox="0 0 580 250" xmlns="http://www.w3.org/2000/svg" role="presentation"><rect x="14" y="20" width="172" height="196" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="100" y="42" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Keyword (BM25)</text><text x="100" y="63" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">matches literal tokens</text><rect x="30" y="77" width="140" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="100" y="92" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">"ERR_QUOTA_5521"</text><text x="100" y="121" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">exact IDs, codes, names</text><text x="100" y="139" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">cheap, no model</text><text x="100" y="167" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">misses paraphrase</text><text x="100" y="185" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">"refund" ≠ "money back"</text><rect x="200" y="20" width="172" height="196" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="286" y="42" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Semantic (vector)</text><text x="286" y="63" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">matches meaning</text><rect x="216" y="77" width="140" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="286" y="92" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">[0.21, -0.88, …]</text><text x="286" y="121" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">paraphrase, synonyms</text><text x="286" y="139" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">cross-lingual</text><text x="286" y="167" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">fumbles rare tokens</text><text x="286" y="185" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">always returns k hits</text><rect x="386" y="20" width="180" height="196" rx="6" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="476" y="42" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">Hybrid</text><text x="476" y="63" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">run both, fuse ranks</text><rect x="402" y="77" width="148" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="476" y="92" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">RRF: Σ 1/(k + rank)</text><text x="476" y="121" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">covers both blind spots</text><text x="476" y="139" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">best real-world recall</text><text x="476" y="167" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">two indexes to keep</text><text x="476" y="185" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">in sync, more infra</text><text x="290" y="238" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">The two engines fail on opposite inputs — which is why fusing them works.</text></svg><figcaption>Keyword and semantic search have complementary blind spots. Hybrid isn't a compromise between them; it's coverage of both.</figcaption></figure>

**Keyword (BM25)** matches literal tokens. Unbeatable for error codes, SKUs, function names — anything a user types exactly. Useless when the words differ: "how do I get my money back" won't find a page titled "refund policy."

**Semantic (vectors)** matches meaning, so it handles paraphrase, typos, and even cross-language queries. Two catches. It smears rare tokens — `ERR_QUOTA_5521` and `ERR_QUOTA_5522` look nearly identical to the model. And **it never says "I don't know"**: ask about something that isn't in your corpus and you get the `k` least-irrelevant chunks with respectable-looking scores, which is an efficient way to feed an LLM confident nonsense.

**Hybrid** runs both and fuses the rankings — usually with Reciprocal Rank Fusion, which combines by *rank*, so you never have to make a BM25 score comparable to a cosine distance. Best quality, at the cost of two indexes to keep in sync on every write *and delete*.

| | Keyword | Semantic | Hybrid |
| --- | --- | --- | --- |
| Exact IDs / codes | Excellent | Poor | Excellent |
| Paraphrase / intent | Poor | Excellent | Excellent |
| "No good match" signal | Natural | None | Partial |
| Infra to maintain | One index | One index | Two + fusion |

---

## Why DynamoDB won

Our case: org admins upload PDFs into a reference bank, an AI agent retrieves from one bank at a time. Multi-tenant, modest corpus, and one hard requirement — **deleting a file must provably remove its retrievable data.**

That requirement did most of the deciding, because every dedicated vector database creates the same problem: metadata in your primary store, vectors somewhere else, and no transaction across the two. Every write touches both systems — and so does every delete.

We'd already been bitten by this. Our legacy knowledge base runs Zilliz, and an audit turned up something uncomfortable: **no vector-deletion code existed anywhere in the platform.** Deleting a knowledge bank removed one database row and orphaned every embedding permanently. Nobody wrote the second delete, nothing failed loudly, and the vectors stayed searchable. That's the dual-write failure mode in its natural habitat — it doesn't announce itself.

DynamoDB's vector index is maintained like a secondary index: delete the item and the vector goes with it. One store, nothing to forget.

| | DynamoDB | pgvector | Zilliz |
| --- | --- | --- | --- |
| Single store with metadata | Yes | Yes | No (dual-write) |
| Delete cascades to vectors | Automatic | Same transaction | Manual, easy to forget |
| Filter expressiveness | Equality only | Full SQL | Rich |
| Built-in hybrid / full-text | No | Yes | Yes |
| Ops burden | None | An instance | A cluster |
| Idle cost | ~zero | Instance cost | Cluster cost |

**pgvector** was the real contender, and may well be right for you — one Postgres holds metadata, vectors, *and* full-text, so you get the single-store property plus genuine hybrid search. It lost on circumstance rather than merit: this feature ships inside an existing API that doesn't own a Postgres, and standing one up would have reintroduced exactly the operational surface we were trying to avoid.

**Zilliz** is the best search engine of the three. It's also a cluster to run, a dual-write to maintain, and its pricing surprised us — the capacity we assumed was spare turned out to be mostly consumed by the existing corpus.

DynamoDB won on *fit*, not capability. It is the weakest search engine here.

## Three things to know before you pick it

**Filters are equality-only.** No `IN`, no ranges, no `<` or `>`. "Search these three banks" becomes three queries merged in your own code. And the index schema — dimensions, distance function, partition key, filters — is immutable once created, so think it through before you create the table.

**Partition-key scoping is not a security boundary.** This is the one that inverts an assumption. If you've used DynamoDB's fine-grained access control, you'd expect `dynamodb:LeadingKeys` to scope a caller to its own tenant. It doesn't apply to vector search at all — AWS says so explicitly and recommends separate tables per tenant if you need isolation at the data layer. We enforce tenancy in the service layer instead, and treat the partition key as routing.

**Writes can fail silently.** Mismatch your embedding dimensions, or omit the partition key, and the write *succeeds* on the table while the item is quietly excluded from the index. No error, a successful-looking ingestion, and a corpus that returns nothing. Count what you wrote against what's actually searchable, and fail loudly on a mismatch.

## What we didn't build

We shipped **semantic only** — no keyword leg, no fusion. The trade-off is the one above: queries containing exact identifiers are the weak spot, and there's no natural "nothing matched" signal.

It isn't a quick follow-up, either. DynamoDB has no full-text index, so adding hybrid means standing up a second system — which reintroduces the dual-write-and-delete problem we picked DynamoDB to avoid. That's the honest shape of the trade: **DynamoDB buys delete-correctness and zero ops at the cost of ever having cheap hybrid search.**

One thing that helped more than any store-level tuning: **chunking.** We prefix every chunk with a one-line description of the section it came from before embedding it. A chunk reading *"the limit is 50 per hour"* is nearly unretrievable on its own — it has no subject. Prefixed with its topic, it lands somewhere useful.

## Takeaways

- **Pick a vector store on its delete and tenancy story, not its recall benchmark.** They all retrieve well enough; they differ enormously in what happens when a user deletes a file.
- **Dual-write is a real failure mode, not a theoretical one.** Ours orphaned embeddings silently for years. A single-store design removes the bug class instead of requiring discipline forever.
- **Vector search never says "I don't know."** Set a distance threshold per corpus, or you're shipping confident hallucinations.
- **Check the filter operators before designing your queries.** Equality-only rules out a lot, and the schema is immutable.
- **Don't assume IAM tenant scoping carries over to vector search.** It doesn't.
- **Fix chunking before blaming the store.** It's the cheapest quality win available.

The uncomfortable summary: the best search engine of the three was the one we rejected, and we rejected it for reasons that had nothing to do with search.
