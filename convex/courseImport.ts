import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Existing modules/lessons for a git-managed bootcamp, keyed by sourcePath,
// for the Next.js server action to diff a freshly-parsed repo tree against.
export const getSyncState = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_bootcamp", (q) => q.eq("bootcampId", args.bootcampId))
      .collect();

    const lessonsByModule = await Promise.all(
      modules.map((m) =>
        ctx.db
          .query("lessons")
          .withIndex("by_module", (q) => q.eq("moduleId", m._id))
          .collect()
      )
    );

    return {
      modules: modules
        .filter((m) => m.sourcePath)
        .map((m) => ({ convexId: m._id, sourcePath: m.sourcePath as string })),
      lessons: lessonsByModule
        .flat()
        .filter((l) => l.sourcePath && l.sourceHash)
        .map((l) => ({
          convexId: l._id,
          sourcePath: l.sourcePath as string,
          sourceHash: l.sourceHash as string,
        })),
    };
  },
});

// Connection metadata for the "Sync now" flow, including the encrypted PAT.
// Deliberately role-gated inside the handler (unlike most other functions
// in this file's siblings, which leave authorization to the Next.js
// caller) because this is the one query that returns secret material.
export const getBootcampSyncMeta = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUserWithRole, {});
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "docente")) {
      throw new Error("No tienes permisos para ver esta conexión");
    }

    const bootcamp = await ctx.db.get(args.bootcampId);
    if (!bootcamp) return null;

    return {
      sourceRepo: bootcamp.sourceRepo ?? null,
      sourcePath: bootcamp.sourcePath ?? null,
      sourceRef: bootcamp.sourceRef ?? null,
      sourcePatEncrypted: bootcamp.sourcePatEncrypted ?? null,
      lastSyncedAt: bootcamp.lastSyncedAt ?? null,
      lastSyncStatus: bootcamp.lastSyncStatus ?? null,
      lastSyncError: bootcamp.lastSyncError ?? null,
    };
  },
});

export const applyImport = mutation({
  args: {
    bootcampId: v.optional(v.id("bootcamps")),
    course: v.object({
      title: v.string(),
      description: v.string(),
      duration: v.string(),
      level: v.string(),
      startDate: v.string(),
      icon: v.string(),
      color: v.string(),
      enableChecklist: v.boolean(),
      enableRanking: v.boolean(),
    }),
    connection: v.optional(
      v.object({
        sourceRepo: v.string(),
        sourcePath: v.string(),
        sourceRef: v.string(),
        sourcePatEncrypted: v.string(),
      })
    ),
    modulesToCreate: v.array(
      v.object({ sourcePath: v.string(), title: v.string(), order: v.number() })
    ),
    modulesToUpdate: v.array(
      v.object({
        convexId: v.id("modules"),
        sourcePath: v.string(),
        title: v.string(),
        order: v.number(),
      })
    ),
    modulesToDelete: v.array(v.id("modules")),
    lessonsToCreate: v.array(
      v.object({
        moduleSourcePath: v.string(),
        sourcePath: v.string(),
        title: v.string(),
        type: v.string(),
        order: v.number(),
        content: v.string(),
        sourceHash: v.string(),
      })
    ),
    lessonsToUpdate: v.array(
      v.object({
        convexId: v.id("lessons"),
        title: v.string(),
        type: v.string(),
        order: v.number(),
        content: v.string(),
        sourceHash: v.string(),
      })
    ),
    lessonsToDelete: v.array(v.id("lessons")),
  },
  handler: async (ctx, args) => {
    let bootcampId = args.bootcampId;
    if (!bootcampId) {
      if (!args.connection) {
        throw new Error("connection es requerido al crear un bootcamp desde un repositorio");
      }
      bootcampId = await ctx.db.insert("bootcamps", {
        ...args.course,
        ...args.connection,
        students: 0,
        lastSyncedAt: Date.now(),
        lastSyncStatus: "success",
      });
    } else {
      await ctx.db.patch(bootcampId, {
        ...args.course,
        lastSyncedAt: Date.now(),
        lastSyncStatus: "success",
        lastSyncError: undefined,
      });
    }

    // lessonsToDelete and modulesToDelete are disjoint ID sets, each deleted
    // via a plain ctx.db.delete (not convex/modules.ts's cascading `remove`
    // mutation) -- so their order here doesn't affect correctness today.
    // Every lesson under a wholly-removed module is already included in
    // lessonsToDelete (see lib/courseImport/diff.ts), which is what actually
    // guarantees no orphaned lessons remain. Lessons are still deleted first
    // as defensive practice, in case a future change routes module deletion
    // through the cascading `remove` mutation instead.
    for (const lessonId of args.lessonsToDelete) {
      await ctx.db.delete(lessonId);
    }
    for (const moduleId of args.modulesToDelete) {
      await ctx.db.delete(moduleId);
    }

    const moduleIdByPath = new Map<string, Id<"modules">>();
    for (const m of args.modulesToCreate) {
      const id = await ctx.db.insert("modules", {
        bootcampId,
        title: m.title,
        order: m.order,
        sourcePath: m.sourcePath,
      });
      moduleIdByPath.set(m.sourcePath, id);
    }
    for (const m of args.modulesToUpdate) {
      await ctx.db.patch(m.convexId, { title: m.title, order: m.order });
      moduleIdByPath.set(m.sourcePath, m.convexId);
    }

    for (const l of args.lessonsToCreate) {
      const moduleId = moduleIdByPath.get(l.moduleSourcePath);
      if (!moduleId) {
        throw new Error(`No se pudo resolver el módulo para la lección "${l.sourcePath}"`);
      }
      await ctx.db.insert("lessons", {
        moduleId,
        title: l.title,
        type: l.type,
        order: l.order,
        content: l.content,
        sourcePath: l.sourcePath,
        sourceHash: l.sourceHash,
      });
    }
    for (const l of args.lessonsToUpdate) {
      await ctx.db.patch(l.convexId, {
        title: l.title,
        type: l.type,
        order: l.order,
        content: l.content,
        sourceHash: l.sourceHash,
      });
    }

    return { bootcampId };
  },
});

export const recordSyncFailure = mutation({
  args: { bootcampId: v.id("bootcamps"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bootcampId, {
      lastSyncStatus: "error",
      lastSyncError: args.error,
    });
  },
});
