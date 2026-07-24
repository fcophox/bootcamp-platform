# C4 — Level 3: Components (inside the Next.js App container)

```mermaid
C4Component
    title Component Diagram — Next.js App container

    Container_Boundary(nextapp, "Next.js App") {
        Component(proxy, "proxy.ts", "Next.js Middleware", "convexAuthNextjsMiddleware — coarse auth gate for /cms and /dashboard, redirects /login")
        Component(cms, "app/cms/*", "React Server/Client Components", "Admin/instructor surface: bootcamp, module, exam, student, certificate, feedback, encuestas management")
        Component(dashboard, "app/dashboard/*", "React Server/Client Components", "Student surface: bootcamp player, lessons, exams, certificate, profile")
        Component(actions, "app/actions/*.ts", "Server Actions ('use server')", "One file per domain; calls shim, revalidatePath/redirect (ADR 0008)")
        Component(roles, "utils/roles*.ts", "Role resolver", "getRoleFromEmail(): metadata -> hardcoded VIP emails -> default alumno (ADR 0004)")
        Component(shimComp, "utils/supabase/{server,client}.ts", "Compatibility shim", "Supabase-shaped query builder over Convex generic functions (ADR 0003)")
    }

    Rel(proxy, cms, "Gates access to")
    Rel(proxy, dashboard, "Gates access to")
    Rel(cms, actions, "Invokes")
    Rel(dashboard, actions, "Invokes")
    Rel(actions, shimComp, "createClient().from(...)")
    Rel(actions, roles, "Authorization check per action")
    Rel(cms, roles, "Redirects alumno away from /cms")
```

Both `app/cms/*` and `app/dashboard/*` independently re-check role via
`utils/roles*.ts` (see [[0001-nextjs-app-router-two-surfaces]] and
[[0004-convex-auth-and-role-model]]) — there is no single authorization
chokepoint in this diagram, by design.
