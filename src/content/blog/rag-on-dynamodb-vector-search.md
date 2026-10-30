---
title: "RAG on DynamoDB, and Why We Didn't Pick pgvector"
description: "DynamoDB shipped native vector search. What it's genuinely good at, where it bites, how it compares to pgvector and Zilliz — and a straight look at semantic vs keyword vs hybrid retrieval."
pubDate: 2026-10-30
tags: ["aws", "dynamodb", "rag", "ai", "vector-search", "infra"]
---

> Picking a vector store is mostly a question about *deletes* and *tenants*, not about recall benchmarks. We ended up on DynamoDB's native vector index — and the reason had almost nothing to do with search quality.

AWS shipped vector search in DynamoDB as a native index type (GA 5 Aug 2026). Not a wrapper over OpenSearch, not S3 Vectors underneath — a real index on an attribute, maintained the way a GSI is maintained. That property turns out to matter more than any latency number.

Before the store comparison, though, it's worth being precise about what kind of search we're even asking for, because "RAG" gets used to mean three different retrieval strategies with very different failure modes.

## Three ways to find a chunk

<figure class="diagram" role="img" aria-label="Comparison of keyword, semantic, and hybrid retrieval"><svg viewBox="0 0 580 268" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="rag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="14" y="28" width="172" height="212" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="100" y="50" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Keyword (BM25)</text><text x="100" y="72" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">matches literal tokens</text><rect x="30" y="86" width="140" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="100" y="101" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">"ERR_QUOTA_5521"</text><text x="100" y="128" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">exact IDs, codes, names</text><text x="100" y="146" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">no model, cheap</text><text x="100" y="176" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">misses paraphrase</text><text x="100" y="194" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">"refund" ≠ "money back"</text><rect x="200" y="28" width="172" height="212" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="286" y="50" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Semantic (vector)</text><text x="286" y="72" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">matches meaning</text><rect x="216" y="86" width="140" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="286" y="101" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">[0.21, -0.88, …]</text><text x="286" y="128" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">paraphrase, synonyms</text><text x="286" y="146" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">cross-lingual</text><text x="286" y="176" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">fumbles rare tokens</text><text x="286" y="194" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">always returns k hits</text><rect x="386" y="28" width="180" height="212" rx="6" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="476" y="50" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">Hybrid</text><text x="476" y="72" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">run both, fuse ranks</text><rect x="402" y="86" width="148" height="22" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="476" y="101" text-anchor="middle" fill="#d6d6dc" font-size="9.5" font-family="ui-monospace, monospace">RRF: Σ 1/(k + rank)</text><text x="476" y="128" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">covers both failure modes</text><text x="476" y="146" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">best real-world recall</text><text x="476" y="176" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">two indexes to keep</text><text x="476" y="194" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">in sync, more infra</text><text x="290" y="258" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">The two engines fail on opposite inputs — which is exactly why fusing them works.</text></svg><figcaption>Keyword and semantic search have complementary blind spots. Hybrid is not a compromise between them; it is coverage of both.</figcaption></figure>

### Keyword search (BM25 / full-text)

Classic lexical matching. The query is tokenised, and documents are ranked by term frequency weighted against how rare each term is across the corpus.

**Good at:** exact identifiers — error codes, SKUs, function names, people's names, API fields. If a user searches `ERR_QUOTA_5521`, BM25 finds the one chunk containing that string and ranks it first with total confidence. It needs no model, no GPU, no embedding cost, and it's trivially explainable: you can point at the matched token.

**Bad at:** vocabulary mismatch. "How do I get my money back" will not match a document that says "refund policy" if the word *refund* never appears in the query. It has no notion that two different strings mean the same thing. Stemming and synonym lists patch the edges and never fix the middle.

### Semantic search (dense vectors)

Text is run through an embedding model into a vector; similar meanings land near each other. Retrieval is a nearest-neighbour lookup.

**Good at:** paraphrase and intent. "money back" lands near "refund policy" because the model learned they're used the same way. It handles typos reasonably, generalises across phrasings, and with a multilingual model it will match a Thai query to English source text — something no amount of synonym tuning gets you.

**Bad at:** precisely the things keyword search nails. Rare tokens get smeared — `ERR_QUOTA_5521` and `ERR_QUOTA_5522` embed almost identically, because the model never learned they're meaningfully different. Worse, **vector search always returns `k` results.** There is no "no match." Ask about something absent from the corpus and you get the `k` least-irrelevant chunks with respectable-looking scores, which is a very efficient way to feed an LLM confident nonsense. The score is a distance, not a probability — you need your own threshold, tuned per corpus, to say "nothing here."

### Hybrid search

Run both, then fuse the rankings. The standard approach is **Reciprocal Rank Fusion** — score each document by the sum of `1 / (k + rank)` across result lists, with `k` typically 60. The appeal is that it uses only *ranks*, so you never have to make a BM25 score commensurable with a cosine distance, which is a genuinely nasty normalisation problem.

```text
score(d) = Σ  1 / (k + rank_i(d))        k ≈ 60
         i ∈ {bm25, vector}
```

**Good at:** real queries, which are a mix. In practice hybrid beats either alone on most retrieval benchmarks, because a document that both engines rank highly is a much stronger signal than either in isolation.

**Bad at:** operational simplicity. You now maintain two indexes over the same corpus, keep them consistent on write *and on delete*, and own a fusion parameter that needs tuning. That cost is the whole reason to think carefully before reaching for it.

| | Keyword | Semantic | Hybrid |
| --- | --- | --- | --- |
| Exact IDs / codes | Excellent | Poor | Excellent |
| Paraphrase / intent | Poor | Excellent | Excellent |
| Cross-lingual | No | Yes | Yes |
| "No good match" signal | Natural (zero hits) | None (always `k`) | Partial |
| Cost per query | Negligible | Embedding call | Both |
| Infra to maintain | One index | One index | Two + fusion |
| Explainable to a user | Yes | Not really | Partly |

---

## So which store?

Our use case: an org admin uploads PDFs into a **reference bank**; the solution-designer agent retrieves from exactly one bank attached to a workspace. Multi-tenant, modest corpus, and — critically — **deleting one file must provably remove its retrievable data**, with two admins uploading the same PDF isolated from each other on delete.

That last requirement did most of the deciding.

### The dual-write problem

Any dedicated vector database creates the same architecture: metadata lives in your primary store, vectors live in the vector DB. Every write touches two systems, and so does every delete. There is no transaction across them.

We had already been bitten by this. The legacy Knowledge Bank on this platform runs Zilliz (Milvus), and an audit turned up something uncomfortable: **no vector-deletion code existed anywhere in the platform.** Deleting a knowledge bank removed one MongoDB document and orphaned every embedding permanently. Nobody wrote the second delete, nothing failed loudly, and the vectors stayed searchable. That's the dual-write failure mode in its natural habitat — it doesn't announce itself.

DynamoDB's vector index is maintained like a GSI, which kills the problem outright:

> Vector attribute is deleted from an item → The corresponding entry in the vector index is deleted.

One `DeleteItem`, one store, no second system to forget. For a feature whose spec literally says *"deleting a file must remove its RAG data,"* that's not a nice-to-have.

### The three candidates

**Zilliz / Milvus** is the most capable search engine of the three — richer index types, proper filtering, built-in hybrid support. It's also a separate cluster with separate credentials, separate failure modes, and a cost model that surprised us: a performance-optimised CU is entirely in-memory and holds roughly 1.5M vectors at 768 dims, so at 1536 dims one CU is about **750K vectors, total** — already shared with a live corpus. "We'll just add our collection to the existing cluster" was not free capacity; it was buying CUs. Add the dual-write problem and the fact that the existing collection had **no tenant field at all** (isolation depended entirely on callers passing the right IDs), and it was a poor fit for a multi-tenant feature with hard delete requirements.

**pgvector** was the serious contender, and in a greenfield service it may well be the right answer: one Postgres instance holds metadata *and* vectors, so you get the single-store property **plus** real SQL filtering, real transactions, and `tsvector` full-text sitting right there for genuine hybrid search. It loses here for two reasons, one principled and one boring. The principled one: it's only single-store if the service owns a Postgres, and this feature ships as a module inside an existing API that doesn't have one — adding an RDS instance to get it would reintroduce exactly the operational surface we were trying to avoid. The boring one: our Aurora is pinned at **PostgreSQL 16.6**, below the 16.8 floor pgvector 0.8 needs for iterative index scans. A version upgrade on a shared production database is not a dependency you want on a new feature.

**DynamoDB** won on fit, not on capability. It's the weakest search engine of the three. But vectors live on the same items as metadata, deletes cascade for free, there's no cluster to run, and it's on-demand so an idle bank costs nothing.

| | DynamoDB | pgvector | Zilliz / Milvus |
| --- | --- | --- | --- |
| Single store with metadata | Yes | Yes | No (dual-write) |
| Delete cascades to vectors | Automatic | Same transaction | Manual, easy to forget |
| Filter expressiveness | **Equality only** | Full SQL | Rich |
| Built-in hybrid / full-text | No | Yes (`tsvector`) | Yes |
| Tenant isolation at DB level | **No** (see below) | Yes (RLS / predicates) | Partition keys |
| Ops burden | None | An instance to run | A cluster to run |
| Scale ceiling | Very high | Index-dependent | Very high |
| Idle cost | ~zero (on-demand) | Instance cost | CU cost |

---

## The three things that bite

### 1. Filters are equality-only

The docs are blunt:

> The equality operator (`=`) is supported in `SearchConditionExpression` for both vector index partition key and inline filter attributes. Comparison, range, and set-membership operators (`<>`, `<`, `<=`, `>`, `>=`, `IN`) are not yet available.

No `IN`, no ranges. "Search these three banks" is not expressible — that's three queries merged client-side. "Only chunks from the last 30 days" is not expressible at all; you'd bucket dates into an equality-able attribute and filter on that.

Worth checking against your real query shapes *before* committing, because the index schema — dimensions, distance function, projection, partition key, inline filters — is **immutable after creation**. Changing any of it means a new index, so you pre-register generously:

```js
VectorIndexes: [{
  IndexName: INDEX,
  VectorAttribute: { AttributeName: 'embedding' },
  Dimensions: 1536,
  DistanceFunction: 'COSINE',        // lower score = more similar
  Projection: {
    ProjectionType: 'INCLUDE',
    // Only projected attributes can ever be returned by SearchVectors.
    NonKeyAttributes: ['content', 'fileName', 'pageNumber'],
  },
  SearchSchema: [
    // Every SearchVectors call MUST supply bankId; there is no global search.
    { AttributeName: 'bankId',   SearchSchemaElementType: 'HASH' },
    // Equality-only filters. Locked at creation — pre-register generously.
    { AttributeName: 'orgId',    SearchSchemaElementType: 'INLINE_FILTER' },
    { AttributeName: 'fileId',   SearchSchemaElementType: 'INLINE_FILTER' },
    { AttributeName: 'mimeType', SearchSchemaElementType: 'INLINE_FILTER' },
  ],
}]
```

Two of those filters — `fileId` and `mimeType` — aren't used by any query today. They're registered because adding one later means rebuilding the index, and the marginal cost of declaring them now is nil. Note also the `Projection`: **only projected attributes can ever come back from a search**, so anything the retrieval path needs to show the user has to be named here.

### 2. Partition-key scoping is not security

This one deserves to be read twice, verbatim from the AWS docs:

> **Partition key scoping is not a security boundary.** Using a partition key to scope searches to a single tenant is a data-locality and performance optimization, not an access-control mechanism. Any principal that holds `dynamodb:SearchVectors` permission on the index can search any partition key value. Because fine-grained access control (FGAC) condition keys such as `dynamodb:LeadingKeys` do not apply to `SearchVectors`, you cannot restrict access to individual partition key values at the IAM policy level.

If you've used DynamoDB's FGAC before, this inverts an assumption you probably hold. `dynamodb:LeadingKeys` is the standard way to scope a principal to its own partition — and it silently does nothing here. AWS's own recommendation when you need hard isolation is separate tables or indexes per tenant, with distinct IAM grants.

There's a sharp edge in how it fails, too: because those condition keys aren't in the request context, **a policy statement carrying an FGAC condition doesn't match a `SearchVectors` request at all, and DynamoDB denies it.** It fails closed, which is the safe direction but a confusing one to debug — you get an access-denied on a permission you believe you granted. The grant has to stand alone:

```js
// ⚠ Keep this statement separate and condition-free. FGAC condition keys
//   (dynamodb:LeadingKeys etc.) are absent from the SearchVectors request
//   context, so a conditioned statement never matches → access DENIED.
{ Sid: 'ReferenceBankVectorSearch', Effect: 'Allow',
  Action: 'dynamodb:SearchVectors',
  Resource: `${tableArn}/index/${INDEX}` },
```

That constraint is precisely *why* tenancy had to live in the service layer rather than in IAM.

Our response is to treat the partition key as routing and put authorization in the service layer, with the tenant also asserted as an inline filter for defence in depth:

```ts
/** Search one bank's partition. orgId is asserted as an inline filter —
 *  defence in depth; real authorization happens in the service layer. */
const out = await this.client.send(
  new SearchVectorsCommand({
    TableName: this.table,
    IndexName: this.index,
    SearchVector: opts.queryVector.map(N),
    TopK: opts.topK,
    SearchConditionExpression: 'bankId = :b AND orgId = :o',
    ExpressionAttributeValues: {
      ':b': S(opts.bankId),
      ':o': S(opts.orgId),
    },
  }),
);
```

The `orgId` filter doesn't *grant* anything — a caller with the IAM permission could omit it. It's a backstop against a service-layer bug passing a bank ID from the wrong org, not a boundary.

### 3. Writes fail silently, in two different ways

This is the one that costs you an afternoon, because nothing errors.

**Dimension mismatch.** Change embedding model or dimensions without recreating the index and new writes are silently excluded from it. The item is in the table. It never appears in search.

**Missing partition key.** Same outcome, from the docs:

> If your vector index defines a partition key in the SearchSchema and you write an item without that attribute, the write succeeds on the base table but the item is silently excluded from the vector index. It will not appear in `SearchVectors` results even though the base table item and its vector embedding still exist.

Both produce an ingestion that reports success and a bank that returns nothing. The defence is an explicit assertion after ingest — count what you wrote, count what's actually searchable, and fail loudly on a mismatch:

```ts
// Assert written == stored. (Vector-index inclusion is asynchronous;
// a dimension mismatch would silently exclude items — the dimensions
// are pinned in embeddings.service.ts to prevent exactly that.)
const stored = await this.store.countSearchableChunks(bankId, fileId);
if (stored < chunks.length) {
  throw new Error(
    `chunk count mismatch: wrote ${chunks.length}, table has ${stored}`,
  );
}
```

We pin the model in one place for the same reason:

```ts
// One model for the whole table: the vector index's Dimensions is immutable
// and a mismatch does not error — items are silently excluded from the index.
export const REFERENCE_BANK_EMBEDDING_MODEL = 'text-embedding-3-small';
export const REFERENCE_BANK_EMBEDDING_DIMENSIONS = 1536;
```

Three smaller wire-format traps, each of which cost a debugging round:

- `SearchVectors.SearchVector` is a **bare** `AttributeValue[]` — `[{N:"0.1"}, …]` — *not* wrapped in `{L:[…]}`. The `L` wrapper is only for writing the attribute on an item.
- `SearchSchema` is a **flat array** of `{AttributeName, SearchSchemaElementType: "HASH" | "INLINE_FILTER"}`, not a nested partition-key/filters object. Every attribute in it must be declared in `AttributeDefinitions` — but the vector attribute itself must **not** be.
- A newly `ACTIVE` index is **not immediately searchable.** `SearchVectors` is served by a separate endpoint and returns `ValidationException: The table does not have the specified index` for a short window after `DescribeTable` says `ACTIVE`. Treat the first searches as retryable; the readiness check that actually works is a real search in a retry loop.

---

## Chunking matters more than the store

Worth saying plainly, because it's easy to spend all your attention on the database: **how you chunk affects retrieval quality more than which vector store you picked.** Every option above returns good results given good chunks, and all of them return garbage given bad ones.

Our chunks are token-budgeted and line-aware, built upstream in a separate OCR pipeline:

```python
TOKENIZER = tiktoken.get_encoding("cl100k_base")
MIN_TOKENS = 1024
TARGET_TOKENS = 1536
LINE_OVERLAP_TOKENS = 100
```

Chunks never cross a semantic segment boundary — the document is segmented first, then chunked *within* each segment, so a chunk never straddles two unrelated topics. The overlap keeps a sentence split across a boundary retrievable from both sides.

The more interesting part is what gets embedded. Each chunk is prefixed with a short generated description of the section it came from, following Anthropic's [contextual retrieval](https://www.anthropic.com/news/contextual-retrieval) approach:

```python
context_for_embedding = (
    f'Topic: {seg["title"]}\n'
    f'Covers: {seg["context"]}\n'
    f"---\n"
    f"{clean_text}"
)
```

This directly attacks the weakness described earlier. A chunk reading *"the limit is 50 per hour"* is nearly unretrievable on its own — it has no subject. Prefixed with `Topic: API rate limits`, it embeds somewhere useful. It's a cheap fix for the single biggest cause of bad semantic recall: chunks that lost their context when they were cut out of the document.

---

## What we didn't build: hybrid

Our implementation is **pure semantic** — one `SearchVectors` call, no lexical leg, no fusion. That's a deliberate scope decision, and the trade-off is the one described above: queries containing exact identifiers are the weak spot, and there is no natural "nothing matched" signal.

It's worth being clear about *why* this isn't a quick follow-up. DynamoDB has no full-text index. Adding hybrid means standing up a second system — OpenSearch, or a Postgres with `tsvector` — which reintroduces precisely the dual-write-and-delete problem that drove the store choice in the first place. The cascade-delete property we picked DynamoDB for would have to be re-engineered by hand for the lexical index.

That's the honest shape of the trade: **DynamoDB buys you delete-correctness and zero ops at the cost of ever having cheap hybrid search.** If your retrieval quality genuinely depends on exact-token matching, that's a strong argument for pgvector, where full-text sits in the same database and the same transaction. For a reference bank of prose documents queried in natural language by an agent, semantic alone is a reasonable place to start — and the store is wrapped behind a four-method seam (`upsertChunks` / `search` / `deleteByFile` / `deleteByBank`) precisely so that conclusion can be revisited without rewriting the feature.

---

## What I'd keep in mind

- **Choose a vector store on its delete and tenancy story, not its recall benchmark.** Every candidate retrieves well enough. They differ enormously in what happens when a user deletes a file.
- **Dual-write is a real failure mode, not a theoretical one.** Our legacy path orphans every embedding on delete and has done so silently for years. A single-store design removes the class of bug rather than requiring discipline forever.
- **Vector search never says "I don't know."** It always returns `k` hits with plausible scores. Set a distance threshold per corpus, or you're shipping confident hallucinations.
- **Read the filter operators before designing your queries.** Equality-only rules out `IN` and ranges, and the index schema is immutable — the time to find this out is before `CreateTable`.
- **`dynamodb:LeadingKeys` does not apply to `SearchVectors`.** If you carry that assumption over from normal DynamoDB, your tenant isolation is weaker than you believe. Grant the permission in its own unconditioned statement and enforce tenancy in the service layer.
- **Assert that writes actually indexed.** Dimension mismatch and a missing partition key both succeed on the base table and vanish from search. Count written vs. indexed and fail loudly.
- **Fix chunking before blaming the store.** A chunk that lost its context when it was cut out of the document is unretrievable by any engine. Prefixing each chunk with its section topic is cheap and helps more than most tuning.
- **Hybrid is the quality answer and the ops cost.** Two indexes, consistent on write *and delete*, plus a fusion parameter. Pick it deliberately, not by default.

The uncomfortable summary: the best search engine of the three was the one we rejected, and we rejected it for reasons that had nothing to do with search.
