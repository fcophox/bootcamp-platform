# Architecture Roadmap

This folder documents the *actual* current architecture of `bootcamp-platform`
— reconstructed from code and git history, not from the (partially stale)
top-level `CLAUDE.md`/`README.md`. Start here, then drill into ADRs or C4
diagrams as needed. For a live, agent-facing summary of the stack, see
`../AGENTS.md`.

## How to navigate

- **New to this repo?** Read `c4/01-context.md` → `c4/02-containers.md` →
  `c4/03-components.md` in order, top-down.
- **Wondering "why does X work this way"?** Check `adr/` — each decision is
  numbered and cross-linked (`[[NNNN-slug]]` references point to sibling ADRs).
- **Wondering "what's left to clean up"?** See `ROADMAP.md`.

## Architecture Decision Records

| ADR | Title |
|---|---|
| [0001](adr/0001-nextjs-app-router-two-surfaces.md) | Next.js App Router with two product surfaces |
| [0002](adr/0002-supabase-to-convex-migration.md) | Migrate backend from Supabase to Convex |
| [0003](adr/0003-supabase-compatibility-shim.md) | Supabase-shaped compatibility shim over Convex |
| [0004](adr/0004-convex-auth-and-role-model.md) | Convex Auth with three-role, multi-fallback authorization |
| [0005](adr/0005-dual-legacy-numeric-and-convex-string-ids.md) | Support both legacy numeric IDs and Convex string IDs |
| [0006](adr/0006-azure-blob-for-media-storage.md) | Azure Blob Storage for media uploads |
| [0007](adr/0007-design-tokens-single-source-of-truth.md) | Design.MD as the single source of truth for design tokens |
| [0008](adr/0008-server-actions-for-mutations.md) | Next.js Server Actions as the sole mutation layer |
| [0009](adr/0009-kubernetes-deployment-shared-cluster.md) | Deploy to the shared orbital-k3s-1 cluster, isolated namespace and Vault mount |

## C4 Diagrams

| Level | File |
|---|---|
| 1 — System Context | [c4/01-context.md](c4/01-context.md) |
| 2 — Containers | [c4/02-containers.md](c4/02-containers.md) |
| 3 — Components | [c4/03-components.md](c4/03-components.md) |

## Kubernetes deployment

See [kubernetes-deployment-runbook.md](kubernetes-deployment-runbook.md) for
the Vault/GHCR setup steps needed to bring the k8s deployment up (not
GitOps'd — manifests live in a separate repo, `orbital-k3s-gitops`).

## Roadmap

See [ROADMAP.md](ROADMAP.md) for known gaps and next steps.
