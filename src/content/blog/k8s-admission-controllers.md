---
title: "Kubernetes Admission Controllers"
description: "What admission controllers are, where they sit in the API server request flow, and how to build your own validating webhook."
pubDate: 2026-05-03
tags: ["kubernetes", "infra"]
---

> Admission controllers are a full request-processing layer inside the Kubernetes API server — not just a simple on/off setting.

If you've ever wondered how tools like OPA/Gatekeeper, Kyverno, or Istio's sidecar injection actually work, admission controllers are the answer. They intercept every write request to the API server and get to either modify it or reject it before anything hits etcd.

## Where they sit in the request flow

When you run `kubectl apply -f pod.yaml`, the API server processes the request in this order:

<figure class="diagram" role="img" aria-label="Kubernetes API server request flow diagram"><svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" role="presentation"><defs><marker id="ac-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="#8b9eff"/></marker></defs><rect x="20" y="20" width="520" height="48" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="280" y="50" text-anchor="middle" fill="#e9e9ec" font-size="13" font-weight="600" font-family="Inter, sans-serif">kubectl apply -f pod.yaml</text><line x1="280" y1="68" x2="280" y2="90" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ac-arrow)"/><rect x="20" y="90" width="520" height="40" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="280" y="115" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">1. Authentication</tspan>  — who are you?</text><line x1="280" y1="130" x2="280" y2="150" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ac-arrow)"/><rect x="20" y="150" width="520" height="40" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="280" y="175" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">2. Authorization</tspan>  — are you allowed?</text><line x1="280" y1="190" x2="280" y2="210" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ac-arrow)"/><rect x="20" y="210" width="520" height="40" rx="6" fill="#16161a" stroke="#4ade80" stroke-width="1.5"/><text x="280" y="235" text-anchor="middle" fill="#d6d6dc" font-size="13" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#4ade80">3. Admission Controllers</tspan>  — modify or reject?</text><line x1="280" y1="250" x2="280" y2="270" stroke="#8b9eff" stroke-width="1.5" marker-end="url(#ac-arrow)"/><rect x="20" y="270" width="520" height="24" rx="6" fill="#16161a" stroke="#2a2a31"/><text x="280" y="287" text-anchor="middle" fill="#d6d6dc" font-size="12" font-family="Inter, sans-serif"><tspan font-weight="600" fill="#e9e9ec">4. Persistence</tspan>  — saved to etcd</text></svg><figcaption>Admission controllers sit between "authorized" and "stored in etcd" — after the cluster decides you're allowed to do something, but before it actually does it.</figcaption></figure>

That third step is the interesting one. You've already proven who you are and that you have RBAC permission — admission controllers are the last chance to ask *should this actually happen the way it was requested?*

---

## Two types: mutating and validating

### Mutating admission controllers

These can **rewrite the request** before it's stored. Common uses:

- Inject a sidecar container (how Istio works)
- Add default labels or annotations automatically
- Fill in missing resource limits

The request that lands in etcd may not look exactly like what you submitted.

### Validating admission controllers

These can only **approve or reject** — no modifications. Common uses:

- Block containers that request `privileged: true`
- Enforce naming conventions
- Require specific labels on all deployments
- Reject images not from your approved registry

### Order of execution matters

Mutating runs first, validating runs second. This is deliberate: you want all mutations to be settled before the final policy check fires.

```
Request
  ↓
Mutating Admission Controllers   (can rewrite)
  ↓
Validating Admission Controllers (approve or deny)
  ↓
Stored in etcd
```

---

## Built-in vs webhook-based

### Built-in controllers

These ship with Kubernetes and are enabled via API server flags:

```bash
--enable-admission-plugins=NamespaceLifecycle,LimitRanger,ServiceAccount,ResourceQuota
```

Common built-ins you'll see in production:

| Controller | What it does |
| --- | --- |
| `NamespaceLifecycle` | Rejects requests into terminating namespaces |
| `LimitRanger` | Enforces CPU/memory limits from LimitRange objects |
| `ServiceAccount` | Auto-mounts service account tokens |
| `ResourceQuota` | Blocks requests that would exceed namespace quotas |

The fact that you enable them with a flag is why people sometimes think admission controllers are "just a switch." The built-ins are. Custom ones are not.

### Webhook-based controllers

This is where the real power lives. Kubernetes can call out to an external HTTP service — *your* code — and let it decide.

Two webhook types map to the two controller types:

- `MutatingWebhookConfiguration` — your service can mutate the object
- `ValidatingWebhookConfiguration` — your service approves or rejects

The flow becomes:

```
API Server
  → HTTPS POST to your webhook
  → your code inspects the AdmissionReview request
  → returns allowed: true/false (+ optional patch for mutating)
  → API server continues or rejects
```

Tools like **OPA/Gatekeeper** and **Kyverno** are just well-packaged validating webhook implementations.

---

## Building a validating webhook

The demo repo lives at [github.com/heinlinaung/k8s-webhook-demo](https://github.com/heinlinaung/k8s-webhook-demo). Here's the shape of what you're building.

### What the API server sends you

Every webhook call is an `AdmissionReview` object:

```json
{
  "apiVersion": "admission.k8s.io/v1",
  "kind": "AdmissionReview",
  "request": {
    "uid": "abc-123",
    "kind": { "group": "", "version": "v1", "kind": "Pod" },
    "operation": "CREATE",
    "object": {
      "metadata": { "name": "my-pod", "namespace": "default" },
      "spec": {
        "containers": [{ "name": "app", "image": "nginx:latest" }]
      }
    }
  }
}
```

### What you return

```json
{
  "apiVersion": "admission.k8s.io/v1",
  "kind": "AdmissionReview",
  "response": {
    "uid": "abc-123",
    "allowed": false,
    "status": {
      "message": "Image tag 'latest' is not allowed. Use a specific version."
    }
  }
}
```

Set `allowed: true` to let it through, `false` to block it. The `message` is what the user sees when their `kubectl apply` is rejected.

### Registering the webhook

You tell Kubernetes about your webhook via a `ValidatingWebhookConfiguration`:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: image-tag-validator
webhooks:
  - name: validate-image-tags.example.com
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
        operations: ["CREATE", "UPDATE"]
    clientConfig:
      service:
        name: my-webhook
        namespace: default
        path: /validate
      caBundle: <base64-encoded-ca-cert>
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail
```

`failurePolicy: Fail` means if your webhook is down, requests are rejected. `Ignore` means they go through. Pick based on how critical your policy is — security policies should fail closed.

### The TLS requirement

Kubernetes requires webhook endpoints to use TLS. For local development with [kind](https://kind.sigs.k8s.io/), the easiest path is [cert-manager](https://cert-manager.io/) to issue a self-signed cert and auto-inject the `caBundle`.

---

## Real-world use cases

| Policy | Implementation |
| --- | --- |
| Block `latest` image tags | Validating webhook |
| Require team labels on all resources | Validating webhook |
| Auto-inject monitoring sidecar | Mutating webhook |
| Enforce approved image registries | Validating webhook |
| Set default resource limits | Mutating webhook |
| Prevent privileged containers | Built-in + validating webhook |

The pattern: anything you'd want enforced at *apply time* rather than discovered later in a CI scan is a candidate for an admission webhook.

---

## What I'd keep in mind

- **TLS is non-negotiable** — Kubernetes won't call HTTP-only endpoints. Budget time for cert setup.
- **`failurePolicy` is a security decision** — fail open or fail closed? Know which you're choosing.
- **Webhook latency adds up** — every `kubectl apply` waits for your webhook to respond. Keep handlers fast.
- **Test with dry runs first** — the `--dry-run=server` flag sends the request through admission but doesn't persist. Use it.
- **Kyverno or Gatekeeper before rolling your own** — custom webhooks are the right call when you need logic that policy engines can't express. For standard enforcement rules, use the existing tools.

The demo repo has a working local setup with kind, cert-manager, and a simple image-tag validation webhook if you want to see the full wiring.
