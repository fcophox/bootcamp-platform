import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getStudentData = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    let emailLower = args.email.toLowerCase().trim();

    if (!args.email.includes("@")) {
      const users = await ctx.db.query("users").collect();
      const user = users.find((u) => u._id.toString() === args.email);
      if (user && user.email) {
        emailLower = user.email.toLowerCase().trim();
      }
    }

    // 1. Get all enrollments for this student
    const enrollments = await ctx.db
      .query("bootcampStudents")
      .filter((q) =>
        q.and(
          q.eq(q.field("email"), emailLower),
          q.or(
            q.eq(q.field("status"), "active"),
            q.eq(q.field("status"), "frozen")
          )
        )
      )
      .collect();

    // Get all completions - we'll filter by student legacyId per bootcamp
    const allCompletions = await ctx.db.query("lessonCompletions").collect();

    const bootcampsData = [];
    let continueLearning = null;

    for (const enrollment of enrollments) {
      const bootcamp = await ctx.db.get(enrollment.bootcampId);
      if (!bootcamp) continue;

      // Get student's legacyId for this enrollment to match completions
      const studentLegacyId = enrollment.legacyId;
      
      // Filter completions for this student using legacyStudentId
      const studentCompletions = allCompletions.filter(c => 
        c.legacyStudentId === studentLegacyId || 
        String(c.studentId) === String(studentLegacyId)
      );
      const completedLessonIds = new Set(
        studentCompletions.map((c) => c.legacyLessonId || c.lessonId)
      );

      // Fetch modules for this bootcamp
      const modules = await ctx.db
        .query("modules")
        .withIndex("by_bootcamp", (q) => q.eq("bootcampId", bootcamp._id))
        .collect();

      const lessons = [];
      for (const mod of modules) {
        const modLessons = await ctx.db
          .query("lessons")
          .withIndex("by_module", (q) => q.eq("moduleId", mod._id))
          .collect();
        lessons.push(...modLessons);
      }

      // Sort lessons by order
      lessons.sort((a, b) => a.order - b.order);

      const realLessons = lessons.filter((l) => l.type !== "subtitle");
      
      // Check completion by both _id and legacyId
      const completedCount = realLessons.filter((l) => 
        completedLessonIds.has(l._id) || 
        completedLessonIds.has(l.legacyId) ||
        completedLessonIds.has(String(l._id)) ||
        completedLessonIds.has(String(l.legacyId))
      ).length;
      
      const progress = realLessons.length > 0 ? Math.round((completedCount / realLessons.length) * 100) : 0;

      bootcampsData.push({
        id: bootcamp._id as any, // Cast for compat
        title: bootcamp.title,
        description: bootcamp.description || "",
        duration: bootcamp.duration || "",
        level: bootcamp.level || "",
        students: bootcamp.students || 0,
        startDate: bootcamp.startDate || "",
        isFrozen: enrollment.status === "frozen",
        icon: bootcamp.icon || "code",
        color: bootcamp.color || "green",
        imageUrl: bootcamp.imageUrl,
        progress,
      });

      // Find first incomplete lesson for continue learning
      if (!continueLearning && realLessons.length > 0) {
        const nextLesson = realLessons.find((l) => 
          !completedLessonIds.has(l._id) && 
          !completedLessonIds.has(l.legacyId) &&
          !completedLessonIds.has(String(l._id)) &&
          !completedLessonIds.has(String(l.legacyId))
        );
        if (nextLesson) {
          continueLearning = {
            bootcampId: bootcamp._id,
            bootcampTitle: bootcamp.title,
            lessonId: nextLesson._id,
            lessonTitle: nextLesson.title,
            completedCount,
            totalCount: realLessons.length,
            icon: bootcamp.icon,
            color: bootcamp.color,
          };
        }
      }
    }

    return {
      bootcamps: bootcampsData,
      continueLearning,
    };
  },
});

export const getCmsData = query({
  args: { email: v.string(), role: v.string() },
  handler: async (ctx, args) => {
    let emailLower = args.email.toLowerCase().trim();

    if (!args.email.includes("@")) {
      const users = await ctx.db.query("users").collect();
      const user = users.find((u) => u._id.toString() === args.email);
      if (user && user.email) {
        emailLower = user.email.toLowerCase().trim();
      }
    }

    // If superadmin, return all bootcamps
    if (args.role === "superadmin") {
      const bootcamps = await ctx.db.query("bootcamps").collect();
      return bootcamps.map((b) => ({
        id: b._id,
        title: b.title,
        description: b.description || "",
        duration: b.duration || "",
        level: b.level || "",
        students: b.students || 0,
        startDate: b.startDate || "",
        icon: b.icon || "code",
        color: b.color || "green",
        imageUrl: b.imageUrl,
      }));
    }

    // If docente, return only bootcamps where enrolled/associated
    if (args.role === "docente") {
      const enrollments = await ctx.db
        .query("bootcampStudents")
        .filter((q) => q.eq(q.field("email"), emailLower))
        .collect();

      const bootcampsData = [];
      for (const enrollment of enrollments) {
        const bootcamp = await ctx.db.get(enrollment.bootcampId);
        if (bootcamp) {
          bootcampsData.push({
            id: bootcamp._id,
            title: bootcamp.title,
            description: bootcamp.description || "",
            duration: bootcamp.duration || "",
            level: bootcamp.level || "",
            students: bootcamp.students || 0,
            startDate: bootcamp.startDate || "",
            icon: bootcamp.icon || "code",
            color: bootcamp.color || "green",
            imageUrl: bootcamp.imageUrl,
          });
        }
      }
      return bootcampsData;
    }

    return [];
  },
});
