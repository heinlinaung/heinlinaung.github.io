---
title: "Deploying Without Holding Your Breath"
description: "Why the normal Kubernetes deploy is a coin flip, how a canary release turns it into a dial, and a local demo that catches a bad version and rolls it back on its own."
pubDate: 2026-11-01
tags: ["kubernetes", "argo", "istio", "prometheus", "deployment", "infra"]
---

> There's a particular silence that follows pressing deploy. Everyone watches the dashboards. Nobody types anything. For about ninety seconds, an entire team is holding its breath.

That ritual exists because the normal Kubernetes deployment has exactly one gear: **go.** It replaces old pods with new ones as fast as it safely can, and its only question is "is the new pod alive?" — not "is the new pod any *good*?"

A pod can be perfectly alive and still be returning errors to every single customer.

## The problem with "alive"

Kubernetes checks health the way a doorman checks ID. It knocks, the container answers, the container goes on the list. Whether that container is quietly 500-ing on every real request is not a question anyone asked.

<figure class="diagram" role="img" aria-label="Diagram showing a standard deployment replacing all pods, with all traffic hitting the broken new version"><svg viewBox="0 0 580 206" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="ar-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><text x="20" y="20" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif">A normal deploy, 90 seconds in</text><rect x="20" y="32" width="104" height="58" rx="7" fill="#16161a" stroke="#2a2a31"/><text x="72" y="56" text-anchor="middle" fill="#e9e9ec" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">All your</text><text x="72" y="73" text-anchor="middle" fill="#e9e9ec" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">users</text><line x1="130" y1="61" x2="186" y2="61" stroke="#f87171" stroke-width="2" marker-end="url(#ar-a)"/><text x="158" y="52" text-anchor="middle" fill="#f87171" font-size="10" font-family="Inter, sans-serif">100%</text><rect x="192" y="32" width="150" height="58" rx="7" fill="#16161a" stroke="#f87171" stroke-width="1.5"/><text x="267" y="56" text-anchor="middle" fill="#f87171" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">v2 (broken)</text><text x="267" y="74" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">every pod replaced</text><rect x="368" y="32" width="192" height="58" rx="7" fill="#16161a" stroke="#2a2a31"/><text x="464" y="50" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">✓ pods are Running</text><text x="464" y="66" text-anchor="middle" fill="#4ade80" font-size="10.5" font-family="Inter, sans-serif">✓ health checks pass</text><text x="464" y="82" text-anchor="middle" fill="#f87171" font-size="10.5" font-family="Inter, sans-serif">✗ every request fails</text><rect x="20" y="108" width="540" height="42" rx="7" fill="#16161a" stroke="#f87171" stroke-width="1.5"/><text x="290" y="134" text-anchor="middle" fill="#f87171" font-size="11.5" font-weight="600" font-family="Inter, sans-serif">Kubernetes thinks this deploy went perfectly.</text><text x="290" y="178" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">The rollback starts when a human notices. That's the part that takes minutes.</text></svg><figcaption>"Running" and "working" are different claims. Only one of them is being checked.</figcaption></figure>

So the real failure isn't the bug — bugs are unavoidable. It's that **100% of your users meet the bug at the same moment**, and the clock on fixing it doesn't start until a human notices.

## The idea: a dial instead of a switch

What if, instead of flipping everyone over at once, you sent **5%** of traffic to the new version and watched what happened?

If it looks fine, go to 20%. Then 50%. Then everyone. If it looks bad at any point, send everyone back to the old version — which is still running, untouched, ready.

<figure class="diagram" role="img" aria-label="Diagram showing traffic shifting gradually from version one to version two in steps"><svg viewBox="0 0 580 212" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="20" y="18" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif">Same deploy, as a dial</text><rect x="20" y="30" width="112" height="112" rx="7" fill="#16161a" stroke="#2a2a31"/><rect x="32" y="44" width="88" height="80" rx="4" fill="#1e1e24"/><rect x="32" y="118" width="88" height="6" rx="2" fill="#8b9eff"/><text x="76" y="88" text-anchor="middle" fill="#8b9eff" font-size="15" font-weight="600" font-family="Inter, sans-serif">5%</text><text x="76" y="160" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">a few hundred</text><text x="76" y="174" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">people, 2 min</text><rect x="152" y="30" width="112" height="112" rx="7" fill="#16161a" stroke="#2a2a31"/><rect x="164" y="44" width="88" height="80" rx="4" fill="#1e1e24"/><rect x="164" y="108" width="88" height="16" rx="2" fill="#8b9eff"/><text x="208" y="88" text-anchor="middle" fill="#8b9eff" font-size="15" font-weight="600" font-family="Inter, sans-serif">20%</text><text x="208" y="160" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">still watching</text><rect x="284" y="30" width="112" height="112" rx="7" fill="#16161a" stroke="#2a2a31"/><rect x="296" y="44" width="88" height="80" rx="4" fill="#1e1e24"/><rect x="296" y="84" width="88" height="40" rx="2" fill="#8b9eff"/><text x="340" y="80" text-anchor="middle" fill="#8b9eff" font-size="15" font-weight="600" font-family="Inter, sans-serif">50%</text><text x="340" y="160" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">looking good</text><rect x="416" y="30" width="144" height="112" rx="7" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><rect x="432" y="44" width="112" height="80" rx="4" fill="#4ade80" opacity="0.22"/><text x="488" y="88" text-anchor="middle" fill="#4ade80" font-size="15" font-weight="600" font-family="Inter, sans-serif">100%</text><text x="488" y="160" text-anchor="middle" fill="#4ade80" font-size="10" font-family="Inter, sans-serif">promoted</text><text x="290" y="200" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">At any point, "back to v1" is instant — v1 never stopped running.</text></svg><figcaption>This is a canary release. The name comes from the birds miners carried underground to detect gas — a small, early warning.</figcaption></figure>

Your blast radius stops being "everyone" and becomes "5% of people, for two minutes."

That's already a huge win. But there's still a human in the loop, squinting at dashboards and deciding when to turn the dial. **The interesting part is removing that human.**

---

## Three pieces, three jobs

Here's where the three tools in the title come in, and the division of labour is cleaner than you'd expect.

<figure class="diagram" role="img" aria-label="Diagram showing Argo Rollouts as the conductor, Istio as the traffic valve, and Prometheus as the judge"><svg viewBox="0 0 580 230" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="ar-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="208" y="20" width="164" height="60" rx="7" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="290" y="42" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">Argo Rollouts</text><text x="290" y="60" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">the conductor</text><text x="290" y="73" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">decides what happens next</text><line x1="240" y1="86" x2="150" y2="124" stroke="#8b9eff" stroke-width="1.3" marker-end="url(#ar-b)"/><line x1="340" y1="86" x2="430" y2="124" stroke="#8b9eff" stroke-width="1.3" marker-end="url(#ar-b)"/><rect x="36" y="130" width="196" height="64" rx="7" fill="#16161a" stroke="#2a2a31"/><text x="134" y="152" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Istio</text><text x="134" y="170" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">the valve</text><text x="134" y="184" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">"send exactly 5% over there"</text><rect x="348" y="130" width="196" height="64" rx="7" fill="#16161a" stroke="#2a2a31"/><text x="446" y="152" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">Prometheus</text><text x="446" y="170" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">the judge</text><text x="446" y="184" text-anchor="middle" fill="#8b8b96" font-size="9.5" font-family="Inter, sans-serif">"are those 5% getting errors?"</text><text x="290" y="220" text-anchor="middle" fill="#8b8b96" font-size="10.5" font-family="Inter, sans-serif">The conductor asks the judge, then tells the valve what to do. No human required.</text></svg><figcaption>Each tool does one job. The magic is entirely in the loop between them.</figcaption></figure>

**Argo Rollouts** replaces your `Deployment` with a `Rollout` — same thing, but it takes a recipe: *go to 20%, wait, check, go to 40%...*

**Istio** is the traffic valve. Kubernetes alone can only split traffic by changing pod counts (want 5%? run 19 old pods and 1 new one). Istio splits by *percentage*, independent of how many pods exist. That's the difference between a dial and a staircase.

**Prometheus** is the judge. It already knows your error rate. The clever bit is that Istio reports every request it routes, so **you get a per-version error rate for free** — without adding a single line of instrumentation to your app.

That last point is the quiet hero of this setup. Istio sees `v1` and `v2` as separate destinations, so the question "is the new version worse than the old one?" becomes a query you can just *ask*.

---

## The recipe

Here's a complete canary strategy. Even without knowing the syntax, you can read it top to bottom:

```yaml
strategy:
  canary:
    steps:
      - setWeight: 20          # send 20% to the new version
      - pause: {duration: 30s} # let it marinate
      - analysis:              # ask Prometheus: still healthy?
          templates:
            - templateName: success-rate
      - setWeight: 50
      - pause: {duration: 30s}
      - setWeight: 100         # all good — everyone moves over
```

And the judge it consults:

```yaml
successCondition: result[0] >= 0.95
failureLimit: 3
```

In English: **at least 95% of requests must succeed, and I'll tolerate three bad readings before I pull the cord.**

If the analysis fails, Argo doesn't page anyone. It sets the traffic weight back to zero and stops. The old version — which never went anywhere — is serving 100% again, usually before a human would have finished reading the alert.

---

## What this actually feels like

I've put the full local setup in a separate walkthrough (link below), but here's the part worth seeing.

You deploy a deliberately broken version. Then you watch this:

```text
Name:            rollouts-demo
Status:          ॥ Paused
Strategy:        Canary
  Step:          3/6
  SetWeight:     20
  ActualWeight:  20

NAME                        KIND         STATUS        AGE
⟳ rollouts-demo             Rollout      ॥ Paused      3m
├──# revision:2
│  └──⧉ rollouts-demo-7bf84f9696  ReplicaSet   ✔ Healthy     40s
│     └──□ ...                    Pod          ✔ Running     40s
└──# revision:1
   └──⧉ rollouts-demo-6cf78c9f55  ReplicaSet   ✔ Healthy     3m
```

Note what's on screen: **both versions, at once, with a weight between them.** That's the whole mental model in one view. Revision 1 hasn't been destroyed; it's sitting there at 80%, waiting to find out whether revision 2 earns its job.

Thirty seconds later the analysis runs, finds a 60% error rate, and the status flips to `Degraded`. Traffic goes back to 100% old version. Nobody did anything.

The first time you see that happen on your own machine, the idea stops being abstract.

---

## Three honest caveats

**Canary needs traffic to work.** The judge is doing statistics. If your service gets ten requests an hour, 5% of that is nothing to measure, and the analysis is theatre. For low-traffic services, blue-green (keep both versions, switch all at once, keep the old one warm) is the more honest choice.

**A good metric is harder than the setup.** Error rate catches crashes and 500s. It does not catch "the checkout button now charges twice" — that's a success, by HTTP's standards. Your analysis is exactly as smart as the question you ask it.

**Istio is a big thing to adopt.** A service mesh is real operational weight. If you don't already run one, Argo Rollouts can split traffic by pod count without it — coarser, but zero new infrastructure. Don't adopt a mesh *just* for canaries.

## Try it locally

The full walkthrough — local cluster, Istio, Prometheus, the manifests, and a deliberately broken version to watch get rejected — is here:

**→ [Argo Rollouts local demo: canary with Istio + Prometheus](https://heinlinaung.notion.site/Argo-Rollouts-local-demo-canary-with-Istio-Prometheus-40b592f87dd5813c98c6fb50727ea0c6)**

It's about twenty minutes end to end, and everything runs on your laptop. The reference demo video is [Argo Rollouts Demo](https://www.youtube.com/watch?v=hIL0E2gLkf8), which covers the same Istio integration.

## The short version

- **Kubernetes checks if a pod is alive, not whether it works.** Those aren't the same claim.
- **A canary makes the blast radius small**: 5% of users for two minutes, instead of everyone at once.
- **Three jobs**: Argo Rollouts conducts, Istio splits the traffic, Prometheus judges the result.
- **Istio gives you per-version error rates free**, because it already sees every request and knows which version answered it.
- **The rollback is the point.** The old version never stopped running, so going back is a weight change, not a redeploy.
- **Automated analysis removes the human from the loop** — and the human was always the slowest part.

The goal isn't deploying more often. It's that deploying stops being an event you need to be present for.
