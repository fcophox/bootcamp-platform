import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importLegacyAuth = mutation({
  args: {
    users: v.array(
      v.object({
        supabaseUserId: v.string(),
        email: v.string(),
        passwordHash: v.string(),
        role: v.string(),
        migrated: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const user of args.users) {
      const existing = await ctx.db
        .query("legacyAuth")
        .withIndex("by_email", (q) => q.eq("email", user.email.toLowerCase().trim()))
        .first();
      if (!existing) {
        await ctx.db.insert("legacyAuth", {
          supabaseUserId: user.supabaseUserId,
          email: user.email.toLowerCase().trim(),
          passwordHash: user.passwordHash,
          role: user.role,
          migrated: false,
        });
        count++;
      }
    }
    return { inserted: count };
  },
});

export const importAllData = mutation({
  args: {
    bootcamps: v.array(v.any()),
    modules: v.array(v.any()),
    lessons: v.array(v.array(v.any())), // chunked to stay within args limit if large
    bootcampStudents: v.array(v.any()),
    invitations: v.array(v.any()),
    lessonCompletions: v.array(v.array(v.any())), // chunked
    certificates: v.array(v.any()),
    masterclasses: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const bootcampIdMap = new Map<number, any>();
    const moduleIdMap = new Map<number, any>();
    const lessonIdMap = new Map<number, any>();

    // 1. Insert Bootcamps
    for (const b of args.bootcamps) {
      const slug = b.slug || `bootcamp-${b.id}-${Date.now()}`;
      const newId = await ctx.db.insert("bootcamps", {
        title: b.title,
        slug: slug,
        description: b.description || undefined,
        imageUrl: b.imageUrl || undefined,
        enableChecklist: b.enableChecklist ?? true,
        enableRanking: b.enableRanking ?? true,
        isFrozen: false,
      });
      bootcampIdMap.set(b.id, newId);
    }

    // 2. Insert Modules
    for (const m of args.modules) {
      const newBootcampId = bootcampIdMap.get(m.bootcampId);
      if (newBootcampId) {
        const newId = await ctx.db.insert("modules", {
          bootcampId: newBootcampId,
          title: m.title,
          order: m.order ?? 0,
        });
        moduleIdMap.set(m.id, newId);
      }
    }

    // 3. Insert Lessons (flatten chunks)
    const flatLessons = args.lessons.flat();
    for (const l of flatLessons) {
      const newModuleId = moduleIdMap.get(l.moduleId);
      if (newModuleId) {
        const type = l.type === "exam" ? "exam" : l.type === "reading" ? "reading" : "video";
        const newId = await ctx.db.insert("lessons", {
          moduleId: newModuleId,
          title: l.title,
          type: type,
          content: l.content || undefined,
          videoUrl: l.videoUrl || undefined,
          duration: l.duration ? Number(l.duration) : undefined,
          order: l.order ?? 0,
        });
        lessonIdMap.set(l.id, newId);
      }
    }

    // 4. Insert BootcampStudents
    for (const bs of args.bootcampStudents) {
      const newBootcampId = bootcampIdMap.get(bs.bootcampId);
      if (newBootcampId) {
        await ctx.db.insert("bootcampStudents", {
          bootcampId: newBootcampId,
          userId: String(bs.userId),
          status: bs.status || "active",
          enrolledAt: bs.createdAt ? new Date(bs.createdAt).getTime() : Date.now(),
        });
      }
    }

    // 5. Insert Invitations
    for (const inv of args.invitations) {
      const newBootcampId = inv.bootcampId ? bootcampIdMap.get(inv.bootcampId) : undefined;
      await ctx.db.insert("invitations", {
        email: (inv.email || "").toLowerCase().trim(),
        role: inv.role || "alumno",
        token: inv.token || String(Math.random()),
        bootcampId: newBootcampId,
        status: inv.status || "pending",
        expiresAt: inv.expiresAt ? new Date(inv.expiresAt).getTime() : Date.now() + 7 * 86400000,
      });
    }

    // 6. Insert LessonCompletions (flatten chunks)
    const flatCompletions = args.lessonCompletions.flat();
    for (const lc of flatCompletions) {
      const newLessonId = lessonIdMap.get(lc.lessonId);
      if (newLessonId) {
        await ctx.db.insert("lessonCompletions", {
          userId: String(lc.userId),
          lessonId: newLessonId,
          completedAt: lc.createdAt ? new Date(lc.createdAt).getTime() : Date.now(),
        });
      }
    }

    // 7. Insert Certificates
    for (const cert of args.certificates) {
      const newBootcampId = bootcampIdMap.get(cert.bootcampId);
      if (newBootcampId) {
        await ctx.db.insert("certificates", {
          userId: String(cert.userId),
          bootcampId: newBootcampId,
          certificateUrl: cert.certificateUrl,
          issuedAt: cert.issuedAt ? new Date(cert.issuedAt).getTime() : Date.now(),
        });
      }
    }

    // 8. Insert Masterclasses
    for (const mc of args.masterclasses) {
      await ctx.db.insert("masterclasses", {
        title: mc.title,
        videoUrl: mc.videoUrl,
        description: mc.description || undefined,
        order: mc.order ?? 0,
      });
    }

    return {
      bootcamps: bootcampIdMap.size,
      modules: moduleIdMap.size,
      lessons: lessonIdMap.size,
    };
  },
});
