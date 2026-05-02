---
title: "An example post (delete me)"
description: "A demo post showing typography, code blocks, lists, and quotes. Safe to delete once you publish your first real post."
pubDate: 2026-05-01
tags: ["example"]
draft: false
---

This post is here so the styling is visible right away. Delete the file when you publish a real one.

## Headings render like this

Body copy uses Inter at 16px on a 1.7 line-height. Long-form reading should feel calm, not cramped. Inline code looks like `pg_dump --schema-only`.

### A subheading

Lists work as you'd expect:

- Mostly Node + Postgres
- Increasingly TypeScript
- Reluctantly Kubernetes
- Occasionally Rails

Numbered lists too:

1. Read what's there.
2. Change the smallest thing that works.
3. Ship.

## Code blocks

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, "div-by-zero"> {
  if (b === 0) return { ok: false, error: "div-by-zero" };
  return { ok: true, value: a / b };
}
```

```bash
# rebuild and deploy
npm run build && npm run deploy
```

## Quotes

> If you don't already run Kubernetes, do not adopt it for one event. Use Docker Compose on a single beefy box and sleep at night.

## Links

This is an [external link](https://astro.build) and this is *emphasized* text.

## Tables

| Stack | When I reach for it |
|---|---|
| Postgres | Default. Almost always. |
| MongoDB | Document-shaped data with no relational pull. |
| DynamoDB | Hot path with known access patterns. |

That's about it. Delete me.
