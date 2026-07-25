# Kubernetes deployment runbook

Deploys `bootcamp-platform` to the same k3s cluster as groowcity
(`orbital-k3s-1`, Flux-managed from `github.com/CleveritDemo/orbital-k3s-gitops`),
in its own namespaces, using the same in-cluster Vault instance but with a
dedicated KV mount and Vault Kubernetes-auth role — isolated from groowcity's
secrets and policies, not sharing its mount.

This doc covers the parts that are **not** GitOps'd: Vault mounts/policies/
roles and secret values, and the GHCR pull credential. Everything else (
namespaces, Deployments, Services, Ingresses, ExternalSecrets,
ClusterSecretStore) lives as code in `orbital-k3s-gitops`
`apps/bootcamp-platform/` and syncs automatically via Flux (~10 min interval)
once merged to that repo's `main`.

## Architecture summary

| | dev | prod |
|---|---|---|
| Namespace | `bootcamp-platform-dev` | `bootcamp-platform-prod` |
| Floating image tag | `:develop` | `:prod` |
| SHA-pinned image tag (what's actually deployed) | `:develop-<short-sha>` | `:prod-<short-sha>` |
| Built from | push to `develop` | push to `main` |
| Deployed by | CI auto-promotion (see §6) | Manual — bump `newTag` in the prod overlay and PR it |
| Ingress host | `bootcamp-dev.nodrize.dev` | `bootcamp.nodrize.dev` |
| Vault secret path | `bootcamp-platform/dev` | `bootcamp-platform/prod` |

DNS: `nodrize.dev` has wildcard DNS already pointed at the cluster's
Cloudflare Tunnel (verified — a random nonexistent subdomain resolves
identically to an existing live app's hostname), so no DNS/Tunnel changes are
needed for either hostname.

Both environments currently point at the **same Convex deployment**
(`tame-finch-608`, per local `.env`) — not truly isolated dev/prod data,
by explicit choice for this first pass. Revisit once a separate prod Convex
deployment exists.

## Prerequisites

- `vault` CLI, authenticated with a token that can enable secrets engines
  and write policies/auth roles (an admin/root-equivalent token) against the
  cluster's Vault. Reachable at `https://vault.nodrize.dev`, or via
  `kubectl port-forward -n vault svc/vault 8200:8200` using the
  `orbital-k3s-1` kubeconfig context if the Tunnel route isn't available.
- The Vault Kubernetes auth method must already be enabled at `auth/kubernetes`
  (it is — groowcity's `eso-role` already uses it).
- A GitHub PAT (classic or fine-grained) with `read:packages` scope, for the
  `ghcr-pull-secret`. Create one at github.com → Settings → Developer settings
  → Personal access tokens. This is separate from any CI token.
- The `orbital-k3s-gitops` PR (branch `add-bootcamp-platform`) merged to `main`
  — Flux won't create the namespaces, ClusterSecretStore, or ExternalSecrets
  until then, and the commands below that reference
  `bound_service_account_namespaces=external-secrets` assume the
  `external-secrets` namespace/ServiceAccount already exist (they do — shared
  cluster infra, same as groowcity uses).

## 1. Enable the KV mount

```bash
export VAULT_ADDR=https://vault.nodrize.dev   # or the port-forward address
vault secrets enable -path=bootcamp-platform -version=2 kv
```

## 2. Write the read-only policy

KV v2 requires the `data/` and `metadata/` sub-paths in policy rules, not the
bare mount path:

```bash
vault policy write bootcamp-platform-eso-policy - <<'EOF'
path "bootcamp-platform/data/*" {
  capabilities = ["read"]
}
path "bootcamp-platform/metadata/*" {
  capabilities = ["list", "read"]
}
EOF
```

## 3. Create the Kubernetes-auth role

Bound to the **same** ServiceAccount ESO already runs as cluster-wide
(`external-secrets`/`external-secrets`) — the policy above is what actually
scopes access to only this app's secrets, not the SA binding:

```bash
vault write auth/kubernetes/role/bootcamp-platform-eso-role \
  bound_service_account_names=external-secrets \
  bound_service_account_namespaces=external-secrets \
  policies=bootcamp-platform-eso-policy \
  ttl=1h
```

## 4. Seed the application secrets

Fill in real values — everything below is a placeholder. Keys match
`.env.example` at the repo root exactly, so `envFrom` in the Deployment picks
them all up as-is.

```bash
vault kv put bootcamp-platform/dev \
  CONVEX_DEPLOYMENT="dev:tame-finch-608" \
  NEXT_PUBLIC_CONVEX_URL="https://tame-finch-608.convex.cloud" \
  NEXT_PUBLIC_CONVEX_SITE_URL="https://tame-finch-608.convex.site" \
  AZURE_STORAGE_ACCOUNT="CHANGEME" \
  AZURE_STORAGE_KEY="CHANGEME" \
  AZURE_STORAGE_CONTAINER="media" \
  AZURE_STORAGE_CONNECTION_STRING="CHANGEME" \
  NEXT_PUBLIC_AZURE_BLOB_BASE="CHANGEME" \
  RESEND_API_KEY="CHANGEME" \
  RESEND_FROM_EMAIL="onboarding@resend.dev" \
  SMTP_HOST="CHANGEME" \
  SMTP_PORT="587" \
  SMTP_USER="CHANGEME" \
  SMTP_PASS="CHANGEME" \
  SMTP_FROM="CHANGEME"

# Same values for prod for now (same Convex deployment; reuse or split the
# Azure/email creds as you prefer — nothing technical forces them to match).
vault kv put bootcamp-platform/prod \
  CONVEX_DEPLOYMENT="dev:tame-finch-608" \
  NEXT_PUBLIC_CONVEX_URL="https://tame-finch-608.convex.cloud" \
  NEXT_PUBLIC_CONVEX_SITE_URL="https://tame-finch-608.convex.site" \
  AZURE_STORAGE_ACCOUNT="CHANGEME" \
  AZURE_STORAGE_KEY="CHANGEME" \
  AZURE_STORAGE_CONTAINER="media" \
  AZURE_STORAGE_CONNECTION_STRING="CHANGEME" \
  NEXT_PUBLIC_AZURE_BLOB_BASE="CHANGEME" \
  RESEND_API_KEY="CHANGEME" \
  RESEND_FROM_EMAIL="onboarding@resend.dev" \
  SMTP_HOST="CHANGEME" \
  SMTP_PORT="587" \
  SMTP_USER="CHANGEME" \
  SMTP_PASS="CHANGEME" \
  SMTP_FROM="CHANGEME"
```

## 5. Seed the GHCR pull credential

Used by both namespaces (`ghcr-pull-secret`, synthesized into a
`kubernetes.io/dockerconfigjson` Secret by the `dev-registry.yaml` /
`prod-registry.yaml` ExternalSecrets):

```bash
vault kv put bootcamp-platform/ghcr \
  username="<your-github-username>" \
  token="<the read:packages PAT you created above>"
```

## 6. Set up dev auto-promotion (GITOPS_PAT)

Without this, a new image pushed to `:develop` builds and publishes fine, but
never actually deploys — `bootcamp-platform-dev` keeps running whatever it was
last running until someone manually bumps the image tag (this bit us once
already: see ADR 0009 / the incident where a pull-secret fix synced but the
already-crashed pods needed a manual `kubectl rollout restart` to pick it up).

1. github.com → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Repository access: **Only select repositories** → `CleveritDemo/orbital-k3s-gitops` only (least privilege — this token must not be able to touch any other repo).
3. Permissions: **Contents: Read and write**. Nothing else needed.
4. Set it as a secret on the `bootcamp-platform` repo:
   ```bash
   gh secret set GITOPS_PAT --repo CleveritDemo/bootcamp-platform
   # paste the token when prompted
   ```
5. Next push to `develop` will have CI auto-commit the new `develop-<short-sha>`
   tag into `orbital-k3s-gitops`'s `apps/bootcamp-platform/workloads/overlays/dev/kustomization.yaml`,
   which Flux then syncs — no more manual restarts for dev.

Prod is **not** auto-promoted, on purpose — see that overlay's
`kustomization.yaml` comment for the manual promotion step.

## 7. Merge and verify

Once the `orbital-k3s-gitops` PR is merged and Flux has synced (or force it:
`flux reconcile kustomization apps -n flux-system --with-source`, using the
`orbital-k3s-1` kubeconfig context):

```bash
export KUBECONFIG=~/.kube/orbital-k3s-1.yaml
kubectl get externalsecrets -n bootcamp-platform-dev -n bootcamp-platform-prod
kubectl get pods -n bootcamp-platform-dev -n bootcamp-platform-prod
curl -sI https://bootcamp-dev.nodrize.dev
curl -sI https://bootcamp.nodrize.dev
```

An `ExternalSecret` stuck `SecretSyncedError` almost always means step 1-3
above wasn't done yet, or a typo in the mount/role/policy names. A pod stuck
`ImagePullBackOff` means step 5 wasn't done, or the PAT lacks `read:packages`.

## 8. Self-hosted Convex test (bootcamp-platform-dev only)

Standalone test — deploys `convex-backend` (StatefulSet + 5Gi PVC) and
`convex-dashboard` into `bootcamp-platform-dev`, internal-only (no Ingress —
the admin key derived below is a root credential over all data). Does **not**
touch the app's own config; `bootcamp-platform-dev` keeps using Convex Cloud
until/unless you decide to switch it.

### 8.1 Seed INSTANCE_NAME/INSTANCE_SECRET

```bash
export VAULT_ADDR=https://vault.nodrize.dev   # or the port-forward address
vault kv put bootcamp-platform/convex-selfhosted-dev \
  INSTANCE_NAME="bootcamp-platform-dev-selfhosted" \
  INSTANCE_SECRET="<a fresh `openssl rand -hex 32` value — never commit this to git>"
```

Once this is written, wait for the `convex-selfhosted` ExternalSecret to sync
— `kubectl get externalsecret convex-selfhosted -n bootcamp-platform-dev` —
and `convex-backend-0` should go `1/1 Running`.

### 8.2 Generate an admin key

```bash
export KUBECONFIG=~/.kube/orbital-k3s-1.yaml
kubectl exec -n bootcamp-platform-dev convex-backend-0 -- ./generate_admin_key.sh
```

Save the printed key — it's needed for every command below and is **not**
stored anywhere else (Vault only has the instance secret it's derived from).

### 8.3 Export the real data from Convex Cloud

From this repo, with the existing `.env`/`CONVEX_DEPLOYMENT` already pointed
at the cloud dev deployment (`tame-finch-608`):

```bash
npx convex export --path /tmp/convex-snapshot.zip
```

(Note: the `convex_export/*.jsonl` files already committed in this repo are
a different, custom per-table dump — not Convex's own snapshot format, and
won't work with `convex import`. Use a fresh `convex export` instead.)

### 8.4 Push schema/functions to the self-hosted backend

```bash
kubectl port-forward -n bootcamp-platform-dev svc/convex-backend 3210:3210 3211:3211 &

npx convex deploy \
  --admin-key="<the admin key from 8.2>" \
  --url="http://127.0.0.1:3210"
```

### 8.5 Import the data

```bash
CONVEX_SELF_HOSTED_URL="http://127.0.0.1:3210" \
CONVEX_SELF_HOSTED_ADMIN_KEY="<the admin key from 8.2>" \
npx convex import --replace-all /tmp/convex-snapshot.zip
```

### 8.6 Verify

```bash
kubectl port-forward -n bootcamp-platform-dev svc/convex-dashboard 6791:6791 &
open http://127.0.0.1:6791
```

Log in with the same admin key and confirm the tables/data look right.
`kubectl exec -n bootcamp-platform-dev convex-backend-0 -- curl -s
http://localhost:3210/version` is a quick liveness check without a
port-forward.
