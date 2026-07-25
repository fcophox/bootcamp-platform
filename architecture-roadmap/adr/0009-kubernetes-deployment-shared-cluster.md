# 0009. Deploy to the shared orbital-k3s-1 cluster, isolated namespace and Vault mount

## Status
Accepted

## Context
The platform previously had no deployment path beyond Vercel/local dev, and
this session added a working Docker image + GHCR pipeline
([ADR: see `architecture-roadmap/kubernetes-deployment-runbook.md`](../kubernetes-deployment-runbook.md)).
A shared k3s cluster (`orbital-k3s-1`, Flux-managed from
`github.com/CleveritDemo/orbital-k3s-gitops`) already runs another
production app, groowcity, alongside a real in-cluster Vault instance
(HA/Raft, Azure Key Vault auto-unseal) consumed via External Secrets
Operator (ESO), and a Cloudflare Tunnel providing TLS-terminated ingress to
`nodrize.dev` (wildcard DNS already routed to the tunnel).

## Decision
Deploy `bootcamp-platform` to this same cluster rather than standing up
separate infrastructure:
- Two new namespaces, `bootcamp-platform-dev` and `bootcamp-platform-prod`,
  fed by `develop` → `:develop` and `main` → `:prod` GHCR image tags
  respectively (CI extended to build both).
- A **dedicated** Vault KV-v2 mount (`bootcamp-platform/`) and a **dedicated**
  Vault Kubernetes-auth role/policy (`bootcamp-platform-eso-role`), rather
  than reusing groowcity's mount/role. Same Vault server (shared cluster
  infra), isolated secrets and access policy — a policy scoped to
  `bootcamp-platform/*` cannot read groowcity's secrets or vice versa.
- Ingress via the existing Traefik + Cloudflare Tunnel path, no new
  DNS/Tunnel configuration needed (`nodrize.dev` wildcard DNS already
  resolves to the tunnel, confirmed by resolving a random nonexistent
  subdomain identically to a known-live app's hostname).
- GHCR pull credentials synced from Vault via an ESO-templated
  `kubernetes.io/dockerconfigjson` Secret, rather than a SOPS-encrypted file
  committed to the gitops repo (groowcity's ACR pull secret pattern) — one
  secrets backend (Vault) instead of splitting between SOPS and Vault.
- Manifests live in `orbital-k3s-gitops` `apps/bootcamp-platform/` (a
  separate repo from this one), following groowcity's exact Kustomize
  base+overlays structure, submitted as a PR rather than pushed directly to
  that repo's `main` — Flux auto-syncs that repo with `prune: true`, and it
  is shared infrastructure other live apps depend on.

## Consequences
- Both dev and prod k8s environments currently point at the same Convex
  deployment (`tame-finch-608`) as local dev — not data-isolated between
  environments, an explicit simplification for this first pass (see
  `kubernetes-deployment-runbook.md`).
- Vault mounts, policies, auth roles, and secret *values* are not GitOps'd —
  they're set up out-of-band via the `vault` CLI (documented in the
  runbook), consistent with how groowcity's Vault setup already works in
  this cluster (no `policies/` folder exists in `orbital-k3s-gitops`
  either). This means the ClusterSecretStore/ExternalSecret YAML alone is
  not sufficient to bring the deployment up — the runbook's manual steps
  are load-bearing.
- Reusing this cluster means `bootcamp-platform`'s prod availability is
  now coupled to `orbital-k3s-1`'s health/capacity, the same as groowcity's
  — a shared-fate tradeoff made deliberately for operational simplicity
  (one cluster, one Vault, one Cloudflare Tunnel to maintain) rather than
  isolating blast radius.
