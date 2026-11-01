---
title: "The Five Dots That Slow Down Your Cluster"
description: "Why one call to api.stripe.com becomes ten DNS queries inside Kubernetes, how that turns into mysterious 5-second hangs, and the three-line fix most teams never apply."
pubDate: 2026-11-01
tags: ["kubernetes", "dns", "performance", "infra"]
---

> Somewhere in your cluster, a pod is asking a question ten times to get one answer. It has been doing this since the day you deployed it. Nobody noticed, because it works — just slowly, and occasionally not at all.

The culprit is five characters in a config file you have probably never opened: `ndots:5`.

This one is worth understanding not because it's exotic, but because it's the **default**. Every pod, every cluster, out of the box. And the symptom it produces — the infamous five-second hang — looks nothing like a DNS problem when you're staring at it.

## First, a post office

When your app asks for `api.stripe.com`, something has to turn that name into an address. That's DNS, and it's the postal service of the internet: you give it a name, it gives you a location.

Inside Kubernetes there's a wrinkle. Pods need to talk to *each other* too, and they do it with short nicknames — just `payments` instead of some long official address. Very convenient.

But now the post office has a problem. When you hand it `payments`, that's a nickname needing expansion. When you hand it `api.stripe.com`, that's a real address needing no help at all.

**How does it tell the difference?** It counts the dots.

<figure class="diagram" role="img" aria-label="Diagram showing how a name with few dots is treated as a nickname and expanded, while a name with many dots is treated as complete"><svg viewBox="0 0 580 220" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="nd-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="20" y="24" width="540" height="76" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="40" y="50" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">FEWER THAN 5 DOTS  →  "must be a nickname, let me help"</text><rect x="40" y="60" width="128" height="26" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="104" y="77" text-anchor="middle" fill="#d6d6dc" font-size="11" font-family="ui-monospace, monospace">payments</text><line x1="174" y1="73" x2="206" y2="73" stroke="#8b9eff" stroke-width="1.4" marker-end="url(#nd-a)"/><rect x="212" y="60" width="330" height="26" rx="4" fill="#1e1e24" stroke="#4ade80"/><text x="377" y="77" text-anchor="middle" fill="#4ade80" font-size="11" font-family="ui-monospace, monospace">payments.default.svc.cluster.local</text><rect x="20" y="116" width="540" height="76" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="40" y="142" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">5 DOTS OR MORE  →  "that's already complete, send as-is"</text><rect x="40" y="152" width="200" height="26" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="140" y="169" text-anchor="middle" fill="#d6d6dc" font-size="11" font-family="ui-monospace, monospace">a.b.c.d.e.example.com</text><line x1="246" y1="165" x2="278" y2="165" stroke="#8b9eff" stroke-width="1.4" marker-end="url(#nd-a)"/><text x="294" y="169" fill="#4ade80" font-size="11" font-family="Inter, sans-serif">sent exactly as written</text></svg><figcaption>The rule in one line: fewer dots than the threshold means "expand me", more means "I'm already complete."</figcaption></figure>

The threshold is `ndots`. Kubernetes sets it to **5**.

Now count the dots in `api.stripe.com`. Two. Which is fewer than five. So Kubernetes looks at that perfectly valid, fully-formed internet address and concludes: *that must be a nickname. Let me help.*

It is about to be extremely unhelpful.

---

## What "helping" actually looks like

Every pod gets a small list of suffixes to try — its neighbourhood, its building, its city, roughly. Faced with a name it thinks is a nickname, the resolver works down that list, trying each one in turn.

So `api.stripe.com` becomes a sequence:

<figure class="diagram" role="img" aria-label="Sequence of four failed DNS lookups followed by one successful lookup for api.stripe.com"><svg viewBox="0 0 580 268" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="20" y="20" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif">Your app asked for one thing: api.stripe.com</text><rect x="20" y="32" width="430" height="30" rx="5" fill="#16161a" stroke="#f87171"/><text x="34" y="52" fill="#d6d6dc" font-size="10.5" font-family="ui-monospace, monospace">api.stripe.com.default.svc.cluster.local</text><text x="540" y="52" text-anchor="end" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">no such thing ✗</text><rect x="20" y="70" width="430" height="30" rx="5" fill="#16161a" stroke="#f87171"/><text x="34" y="90" fill="#d6d6dc" font-size="10.5" font-family="ui-monospace, monospace">api.stripe.com.svc.cluster.local</text><text x="540" y="90" text-anchor="end" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">no such thing ✗</text><rect x="20" y="108" width="430" height="30" rx="5" fill="#16161a" stroke="#f87171"/><text x="34" y="128" fill="#d6d6dc" font-size="10.5" font-family="ui-monospace, monospace">api.stripe.com.cluster.local</text><text x="540" y="128" text-anchor="end" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">no such thing ✗</text><rect x="20" y="146" width="430" height="30" rx="5" fill="#16161a" stroke="#f87171"/><text x="34" y="166" fill="#d6d6dc" font-size="10.5" font-family="ui-monospace, monospace">api.stripe.com.ec2.internal</text><text x="540" y="166" text-anchor="end" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">no such thing ✗</text><rect x="20" y="184" width="430" height="30" rx="5" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="34" y="204" fill="#d6d6dc" font-size="10.5" font-family="ui-monospace, monospace">api.stripe.com</text><text x="540" y="204" text-anchor="end" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">found it ✓</text><text x="20" y="240" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">Four wasted round-trips before the obvious one. And it gets worse —</text><text x="20" y="258" fill="#f87171" font-size="10.5" font-weight="600" font-family="Inter, sans-serif">each line is actually TWO queries (one for IPv4, one for IPv6) = 10 total.</text></svg><figcaption>Four guaranteed failures, then the answer that was correct from the start. The last line is the kicker: everything doubles for IPv6.</figcaption></figure>

Four failures, then success. And because the resolver asks for IPv4 and IPv6 addresses simultaneously, every one of those lines is really two queries.

**Ten DNS queries. One answer. Every single time.**

Not cached, not amortised — this repeats for every connection your app opens to that external service.

---

## Scenario 1: the payment API that got slow

A checkout service calls Stripe. Each call needs a name lookup first, and each lookup is ten queries instead of one.

On a quiet cluster nobody notices; the DNS server is fast and 9 wasted queries cost maybe a millisecond. Then traffic triples for a sale, and suddenly the DNS pods are pinned at 100% CPU while the actual application servers sit at 20%.

The investigation goes exactly where you'd expect, and exactly where the problem isn't: scale up DNS, tune the app, blame Stripe. Nobody looks at the resolver config, because the resolver config is a *default* — and defaults feel like they've already been thought about by someone smarter.

**What's really happening:** the cluster isn't handling more traffic. It's handling the same traffic, multiplied by ten, in one specific subsystem.

> **The tell:** your DNS service is the busiest thing in the cluster, and the ratio of DNS queries to actual requests is wildly above 1:1.

---

## Scenario 2: the five-second hang

This is the one that burns a week.

A service works fine. Then occasionally — maybe one request in two hundred — it takes **exactly five seconds**. Not four, not six. Five. Then it works fine again.

Exactness like that is a gift, because nothing in your application is that punctual. Your code doesn't produce round numbers; timeouts do. Five seconds is the resolver's default "I got no reply, let me retry" delay.

Here's the mechanism, and it's a genuinely elegant piece of bad luck:

<figure class="diagram" role="img" aria-label="Diagram showing two DNS queries sent at the same moment from one socket, one being dropped by the kernel, causing a five second wait"><svg viewBox="0 0 580 244" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="nd-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="22" y="26" width="112" height="54" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="78" y="48" text-anchor="middle" fill="#e9e9ec" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">Your pod</text><text x="78" y="66" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">asks for both at once</text><line x1="138" y1="42" x2="186" y2="42" stroke="#8b9eff" stroke-width="1.4" marker-end="url(#nd-b)"/><line x1="138" y1="66" x2="186" y2="66" stroke="#8b9eff" stroke-width="1.4" marker-end="url(#nd-b)"/><rect x="190" y="28" width="92" height="24" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="236" y="44" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">IPv4 question</text><rect x="190" y="56" width="92" height="24" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="236" y="72" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">IPv6 question</text><text x="236" y="98" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">same door, same instant</text><line x1="288" y1="40" x2="330" y2="40" stroke="#4ade80" stroke-width="1.4" marker-end="url(#nd-b)"/><line x1="288" y1="68" x2="320" y2="68" stroke="#f87171" stroke-width="1.4"/><text x="334" y="44" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">arrives ✓</text><text x="326" y="72" fill="#f87171" font-size="16" font-weight="600" font-family="Inter, sans-serif">✗</text><text x="344" y="72" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">silently dropped by the kernel</text><rect x="22" y="128" width="536" height="46" rx="6" fill="#16161a" stroke="#f87171" stroke-width="1.5"/><text x="290" y="147" text-anchor="middle" fill="#f87171" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">Your app now waits for an answer that will never come.</text><text x="290" y="165" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">It gives up after exactly 5 seconds, retries, and succeeds instantly.</text><text x="290" y="206" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">Ten queries per lookup means ten chances to roll this dice —</text><text x="290" y="224" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">which is why ndots:5 and the 5-second hang are the same story.</text></svg><figcaption>Two questions leave through the same door at the same moment, the kernel loses track of one, and your app pays five seconds for it.</figcaption></figure>

The IPv4 and IPv6 questions go out *simultaneously through the same network socket*. The kernel tracks connections by their source and destination, and two packets leaving at the same instant from the same place can collide in that bookkeeping. One gets dropped. Silently.

Your app sits there waiting for a reply that no longer exists, times out after five seconds, retries, and succeeds immediately.

**This is where the two problems meet.** The collision is rare. But `ndots:5` makes you roll that dice *ten times per lookup* instead of twice. Rare multiplied by ten, multiplied by every request your service makes, becomes "a few times an hour" — which is exactly often enough to be infuriating and rare enough to never reproduce on demand.

> **The tell:** suspiciously round latency. Exactly 5s, sometimes 10s. Round numbers mean timeouts, and timeouts mean something is waiting for a reply that isn't coming.

---

## Scenario 3: the logging bill

A background worker ships logs to an external collector. It doesn't reuse connections — every batch opens a fresh one, so every batch does a fresh lookup.

Ten thousand batches an hour becomes a hundred thousand DNS queries an hour, ninety thousand of which are *guaranteed* to fail before the real one succeeds.

The visible costs arrive from directions that make the root cause nearly invisible:

- the DNS pods need more memory, so somebody raises the limit
- cloud DNS charges per query, so the bill creeps up
- DNS latency graphs look terrible, so somebody adds another replica

Each fix is locally sensible and none of them touch the actual problem. The cluster is working perfectly — it's just answering a question nobody meant to ask, ninety thousand times an hour.

> **The tell:** your DNS failure graph is enormous and nothing is actually broken. Those aren't errors. That's the system doing exactly what you configured it to do.

---

## How to fix it

Three options, cheapest first.

### Fix 1: add a dot

The fastest fix in this entire post. Put a trailing dot on external names in your config:

```diff
- STRIPE_API=https://api.stripe.com
+ STRIPE_API=https://api.stripe.com.
```

That dot means "this is complete, don't help me." Ten queries become two, instantly.

The catch is that it's easy to miss one, and some libraries and TLS certificate checks get grumpy about the trailing dot. Test it rather than rolling it out everywhere on faith.

### Fix 2: lower the threshold

The real fix. Tell your pods to stop being so eager:

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
```

Now anything with 2+ dots is treated as a complete address. `api.stripe.com` resolves in one step; `payments` still expands as before, so internal nicknames keep working.

**Why 2 and not 1?** Because one-dot internal names like `payments.default` are common, and `ndots:1` would break them. 2 is the sweet spot for most clusters — but check how your services actually address each other before committing.

The trade-off is honest: this is per-pod config, so it needs to land in every deployment. Most teams apply it to the handful of services that talk to the outside world constantly, and leave the rest alone.

### Fix 3: put a cache on every node

Run a small DNS cache on each node so lookups are answered locally instead of crossing the network.

This doesn't reduce the *number* of queries — the nine useless ones still happen — but it makes them nearly free, and it sidesteps the dropped-packet problem by changing how queries travel. It's the sturdiest option and the one to reach for at scale.

<figure class="diagram" role="img" aria-label="Comparison of the three fixes by effort and effect"><svg viewBox="0 0 580 182" xmlns="http://www.w3.org/2000/svg" role="presentation"><rect x="16" y="20" width="176" height="128" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="104" y="44" text-anchor="middle" fill="#e9e9ec" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">Trailing dot</text><text x="104" y="70" text-anchor="middle" fill="#4ade80" font-size="19" font-weight="600" font-family="Inter, sans-serif">10 → 2</text><text x="104" y="94" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">one character</text><text x="104" y="112" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">easy to miss one</text><text x="104" y="134" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">try it today</text><rect x="202" y="20" width="176" height="128" rx="8" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="290" y="44" text-anchor="middle" fill="#4ade80" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">ndots: 2</text><text x="290" y="70" text-anchor="middle" fill="#4ade80" font-size="19" font-weight="600" font-family="Inter, sans-serif">10 → 2</text><text x="290" y="94" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">three lines of YAML</text><text x="290" y="112" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">per deployment</text><text x="290" y="134" text-anchor="middle" fill="#4ade80" font-size="9.5" font-family="Inter, sans-serif">start here</text><rect x="388" y="20" width="176" height="128" rx="8" fill="#16161a" stroke="#2a2a31"/><text x="476" y="44" text-anchor="middle" fill="#e9e9ec" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">Node-local cache</text><text x="476" y="70" text-anchor="middle" fill="#8b9eff" font-size="19" font-weight="600" font-family="Inter, sans-serif">10, but free</text><text x="476" y="94" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">cluster-wide, once</text><text x="476" y="112" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">real infrastructure</text><text x="476" y="134" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">for scale</text><text x="290" y="172" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">The middle one fixes the cause. The right one makes the cause stop mattering.</text></svg><figcaption>Not mutually exclusive — plenty of clusters run the cache and set ndots on their chattiest services.</figcaption></figure>

---

## Why the default is like this

It's tempting to call `ndots:5` a mistake. It isn't, quite.

Kubernetes has an internal address format that genuinely contains four dots — `service.namespace.svc.cluster.local`. For *partial* versions of that name to expand correctly, the threshold has to be high. Five makes internal service discovery work beautifully.

It just does so by assuming the thing you're looking up is probably inside the cluster. In 2015, that was a fair bet. Today your pods talk to payment APIs, object storage, managed databases and half a dozen SaaS vendors — mostly names with two dots.

The default optimises for a world that stopped existing a decade ago. It's still the default because changing it would break clusters that depend on the old behaviour, which is the most ordinary reason anything stays the way it is.

## The short version

- **Kubernetes counts dots to decide if a name needs help.** Fewer than five means "expand it."
- **`api.stripe.com` has two dots**, so it gets expanded — four guaranteed failures before the right answer.
- **Double it for IPv6.** Ten queries, one answer, every time.
- **Exactly 5 seconds of latency is never your code.** It's a dropped DNS packet waiting on a timeout, and ndots gives it ten chances to happen instead of two.
- **The fix is three lines of YAML.** `ndots: 2` on your outward-facing services, or a trailing dot if you need something today.
- **Check the ratio.** If DNS queries vastly outnumber actual requests, you're already paying this tax.

Go look at a pod that calls an external API. Count how many questions it asks to get one answer. If the number is ten, it has been ten this whole time.
