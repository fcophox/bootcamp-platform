# C4 — Level 1: System Context

Shows Bootcamp Platform's position relative to its users and the external
services it depends on. See ADRs [[0002-supabase-to-convex-migration]] and
[[0006-azure-blob-for-media-storage]] for why these specific externals exist.

```mermaid
C4Context
    title System Context — Bootcamp Platform

    Person(alumno, "Alumno", "Student taking bootcamps")
    Person(docente, "Docente", "Instructor managing content")
    Person(superadmin, "Superadmin", "Platform administrator")

    System(platform, "Bootcamp Platform", "Next.js 16 app: CMS (admin/instructor) + Dashboard (student)")

    System_Ext(convex, "Convex", "Database, backend functions, and auth (Convex Auth)")
    System_Ext(azureBlob, "Azure Blob Storage", "Media: lesson resources, cover images, masterclass materials")
    System_Ext(email, "Email (SMTP / Resend)", "Student invitations, password reset")

    Rel(alumno, platform, "Learns, takes exams, gives feedback", "HTTPS")
    Rel(docente, platform, "Manages bootcamps/lessons/exams, views students", "HTTPS")
    Rel(superadmin, platform, "Manages roles, all platform admin", "HTTPS")

    Rel(platform, convex, "Reads/writes data, authenticates users", "Convex client / HTTPS")
    Rel(platform, azureBlob, "Uploads/serves media", "HTTPS")
    Rel(platform, email, "Sends invitation & reset emails", "SMTP / REST")
```

**Note:** Supabase does not appear here — it was fully replaced by Convex
(see [[0002-supabase-to-convex-migration]]). `supabase/migrations/*.sql` is
historical only.
