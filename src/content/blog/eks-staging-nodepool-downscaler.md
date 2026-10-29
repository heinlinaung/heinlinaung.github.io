---
title: "One Nodepool for Everything Was Costing Us Money"
description: "Splitting prod and staging onto separate EKS nodepools, then scaling staging to zero outside office hours with kube-downscaler — and the three things that fight you when you try."
pubDate: 2026-10-29
tags: ["kubernetes", "aws", "eks", "cost", "infra"]
---

> Our EKS cluster ran prod and staging side by side in a single nodepool. Nothing was broken. The bill was just paying for staging to idle through every night and weekend — roughly 75% of the hours in a week.

The fix sounds trivial: put staging on its own nodes, turn those nodes off at night. In practice it took three separate pieces that each had to land in the right order, and the interesting part wasn't the scheduling — it was that **GitOps actively fights you** when something other than Git starts changing replica counts.

## The actual problem wasn't CPU

The first instinct with an over-provisioned cluster is "the nodes are too big." That instinct was wrong here, and checking it first saved us from optimising the wrong axis.

The cluster ran on Karpenter with EKS Auto Mode, pinned to `c6i.xlarge` — a *compute*-optimised instance family. The measured reality across the nodes:

| Dimension | Measured |
| --- | --- |
| Memory requested | 82–98% of capacity |
| CPU actually used | 3–7% |

So the cluster was **memory-bound on compute-optimised hardware**. Karpenter couldn't consolidate anything, because every node was nearly full on the one dimension that mattered — while the dimension we were paying a premium for sat idle. More nodes kept appearing, each one a little more wasteful than the last.

That reframed the work. The goal wasn't fewer nodes; it was *separating workloads so the idle ones could disappear entirely*.

## Three pieces, one order

<figure class="diagram" role="img" aria-label="Diagram of staging workloads moving to a tainted nodepool and scaling to zero at 19:00"><svg viewBox="0 0 580 330" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="np-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><text x="20" y="22" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif" letter-spacing="0.5">BEFORE</text><rect x="20" y="32" width="240" height="96" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="140" y="54" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">single nodepool</text><rect x="36" y="66" width="98" height="24" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="85" y="82" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">prod pods</text><rect x="146" y="66" width="98" height="24" rx="4" fill="#1e1e24" stroke="#3a3a44"/><text x="195" y="82" text-anchor="middle" fill="#d6d6dc" font-size="10" font-family="Inter, sans-serif">staging pods</text><text x="140" y="112" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">c6i.xlarge · 24/7 · 98% mem / 5% cpu</text><line x1="268" y1="80" x2="310" y2="80" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#np-arrow)"/><text x="330" y="22" fill="#8b8b96" font-size="11" font-family="Inter, sans-serif" letter-spacing="0.5">AFTER</text><rect x="320" y="32" width="240" height="44" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="440" y="50" text-anchor="middle" fill="#e9e9ec" font-size="12" font-weight="600" font-family="Inter, sans-serif">default nodepool</text><text x="440" y="66" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">prod pods · always on</text><rect x="320" y="88" width="240" height="56" rx="6" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="440" y="107" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600" font-family="Inter, sans-serif">staging-nodepool (tainted)</text><text x="440" y="124" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">staging pods · memory-optimised</text><text x="440" y="137" text-anchor="middle" fill="#8b8b96" font-size="10" font-family="Inter, sans-serif">~0.4 vCPU / ~12Gi → 1 node</text><line x1="440" y1="144" x2="440" y2="168" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#np-arrow)"/><rect x="300" y="168" width="260" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="430" y="189" text-anchor="middle" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">19:00</tspan> kube-downscaler → replicas 0</text><line x1="430" y1="202" x2="430" y2="224" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#np-arrow)"/><rect x="300" y="224" width="260" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="430" y="245" text-anchor="middle" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">~5 min</tspan> Karpenter removes empty nodes</text><line x1="430" y1="258" x2="430" y2="280" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#np-arrow)"/><rect x="300" y="280" width="260" height="34" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="430" y="301" text-anchor="middle" fill="#d6d6dc" font-size="11" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">07:00</tspan> scale back up, nodes return</text></svg><figcaption>Staging gets its own tainted nodepool, so emptying it actually removes hardware. Without the taint, prod pods would drift onto those nodes and keep them alive.</figcaption></figure>

The three pieces:

1. **A tainted nodepool** (Terraform) — a `staging-nodepool` that allows memory-optimised instance types and carries a taint, so *only* workloads that explicitly tolerate it land there.
2. **Workload pinning** (Helm, GitOps repo) — every staging values file gets a `nodeSelector` and matching toleration.
3. **Scheduled scale-to-zero** (kube-downscaler) — staging deployments go to 0 replicas outside Mon–Fri 07:00–19:00.

Order matters and isn't negotiable: the nodepool must exist before pods are told to prefer it, or those pods go `Pending`. We applied the nodepool manifest first, merged the GitOps change second, and synced the downscaler last.

---

## Piece 1 — the taint is the whole point

A nodepool on its own does nothing. If the new nodes are schedulable by anybody, Karpenter will happily pack prod pods onto them, and then scaling staging to zero empties nothing — the node stays up serving prod.

The taint is what makes the nodes *exclusively* staging's, and therefore genuinely removable:

```yaml
taints:
  - key: workload-tier
    value: staging
    effect: NoSchedule
```

The second half of the Terraform change was widening the allowed instance types to memory-optimised families. Given the 82–98% memory / 3–7% CPU profile, staging's real footprint — about **0.4 vCPU and 12 GiB** — fits on a single right-shaped node instead of being smeared across compute-optimised ones.

## Piece 2 — pinning staging workloads

Each chart gained `nodeSelector`/`tolerations` support in its `templates/deployment.yaml`, and each staging values file got the pairing. Verbatim from `values-staging.yaml`:

```yaml
# CA1: run staging on the tainted staging NodePool
# kube-downscaler scales these workloads to 0 outside
# Mon-Fri 07:00-19:00 Asia/Bangkok.
nodeSelector:
  workload-tier: staging
tolerations:
  - key: workload-tier
    operator: Equal
    value: staging
    effect: NoSchedule
```

Both halves are required, and they do different jobs — this trips people up constantly:

- The **toleration** says *"I'm allowed on those nodes."* It does not attract anything.
- The **nodeSelector** says *"put me there."* Without it, a tolerating pod can still be scheduled anywhere.

Toleration alone gets you pods scattered across prod nodes that merely *could* have gone to staging. NodeSelector alone gets you `Pending` pods that are selected for a node they're not permitted on.

Charts got generic passthrough rather than a hardcoded tier, which is what keeps prod safe:

```yaml
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 8 }}
{{- end }}
{{- with .Values.tolerations }}
tolerations:
  {{- toYaml . | nindent 8 }}
{{- end }}
```

That `with` guard is load-bearing. No prod values file mentions `workload-tier`, so prod renders emit no selector at all — **prod values files were left completely untouched**. Before merging, every chart was `helm template`'d with production values and verified to render clean. A nodepool migration that accidentally pins a prod workload to nodes that get deleted at 19:00 is a very bad evening.

## Piece 3 — kube-downscaler

We used [py-kube-downscaler](https://github.com/caas-team/py-kube-downscaler), pinned to `25.2.0`. The configuration is small enough to read in one go:

```yaml
image:
  repository: ghcr.io/caas-team/py-kube-downscaler
  tag: "25.2.0"

# Scope — only these namespaces are ever touched
targetNamespaces: staging,work-agent-staging,staging-test

defaultUptime: "Mon-Fri 07:00-19:00 Asia/Bangkok"
includeResources: deployments
intervalSeconds: 60
```

Two decisions in there worth calling out.

**Scope it to named namespaces, never cluster-wide.** The downscaler's default posture is to manage everything it can see. An explicit `--namespace` list means a mislabelled prod deployment cannot be scaled to zero by accident. The RBAC is scoped to match.

**Run the downscaler itself on the prod nodepool.** It has to outlive the nodes it empties. Put it on the staging pool and it scales staging to zero, gets evicted along with those nodes, and nothing is left running to scale anything back up at 07:00. The chart has a comment saying exactly this, because it is the kind of thing that looks like a mistake six months later:

```yaml
# Runs on the regular (prod) nodepool on purpose — it must survive the
# staging nodes it empties out.
```

Per-workload opt-out is an annotation, so anything that genuinely needs to run overnight can escape without a redeploy:

```yaml
annotations:
  downscaler/exclude: "true"
```

---

## The part that actually bites: GitOps vs. the downscaler

This is the failure mode worth the whole post.

Argo CD with `selfHeal: true` exists to guarantee that the cluster matches Git. The downscaler's entire job is to make the cluster *not* match Git — it sets `/spec/replicas` to 0 while Git still says 2.

Left alone, those two run in a loop against each other. At 19:00 the downscaler scales staging to 0, Argo notices drift within seconds and scales it back to 2, the downscaler scales it to 0 again at the next 60-second interval. Nodes never empty, Karpenter never consolidates, and the saving is exactly zero — while both controllers burn API calls all night.

The fix is to tell Argo that replicas are not its business for these apps:

```yaml
# kube-downscaler owns replica counts (scale-to-0 outside office hours);
# keep selfHeal from reverting it.
ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
      - /spec/replicas
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
    - RespectIgnoreDifferences=true
```

`ignoreDifferences` alone is **not enough**, and this is the subtle bit. By default it only affects *diffing* — whether Argo reports the app as OutOfSync. A sync triggered for any other reason will still apply the manifest's replica count and stomp the downscaler. `RespectIgnoreDifferences=true` is what extends the exemption to the sync itself.

That block had to go on 29 Application manifests — all 28 staging apps, plus one parked in `argocd/retired/`. Any app that misses it quietly keeps its nodes alive and silently erodes the saving — which is nearly impossible to spot from a dashboard, since everything looks healthy. It just costs money.

---

## What it actually saved

Staging is up 60 hours a week out of 168, so roughly **64% of staging's compute hours disappear**. Combined with the right-shaped instance type, the measured saving was about **$130–160/month** on this one cluster — and the groundwork for a larger follow-up: now that workloads are separated by tier, the prod nodepool can be widened to memory-optimised families too, which repacks ~39 GiB of requests onto 2–3 correctly-shaped nodes instead of 6 compute-optimised ones.

The honest framing: $130–160/month is not a dramatic number. What makes it worth doing is that it's **recurring, zero-risk to production, and fully reversible** — change one schedule string and staging is back to 24/7.

---

## What I'd keep in mind

- **Check which resource you're actually bound on before resizing anything.** Memory-bound on compute-optimised nodes looks identical to "we need more nodes" from a distance, and leads you to the wrong fix.
- **A nodepool without a taint saves nothing.** If other pods can land there, emptying your workloads doesn't remove hardware.
- **`nodeSelector` and `tolerations` are not interchangeable.** One attracts, one permits. You need both.
- **If anything outside Git mutates replicas, GitOps will fight it.** `ignoreDifferences` + `RespectIgnoreDifferences=true` — the second flag is the one people miss, and the first is useless without it for sync-time changes.
- **The downscaler must not live on the nodes it turns off.** Nothing wakes staging up on Monday morning if it does.
- **Apply the nodepool before merging the pinning.** Reverse that order and every staging pod sits `Pending` until the nodepool shows up.
- **Expect one small operational surprise.** Ours was the image shipping no numeric `USER` — with `runAsNonRoot: true` the kubelet can't verify the user and the pod fails `CreateContainerError`, so it took a follow-up commit pinning `runAsUser: 1000` / `runAsGroup: 1000`. Budget for one; there's always one.

The scheduling itself is the easy half. The hard half is every controller in the cluster that has an opinion about replica counts.
