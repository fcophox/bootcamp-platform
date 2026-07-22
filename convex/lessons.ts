import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByModule = query({
  args: { moduleId: v.id("modules") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessons")
      .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    moduleId: v.id("modules"),
    title: v.string(),
    type: v.union(v.literal("video"), v.literal("reading"), v.literal("exam")),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("lessons", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("lessons"),
    title: v.optional(v.string()),
    type: v.optional(v.union(v.literal("video"), v.literal("reading"), v.literal("exam"))),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listUserCompletions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessonCompletions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const toggleCompletion = mutation({
  args: { userId: v.string(), lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lessonCompletions")
      .withIndex("by_user_lesson", (q) => q.eq("userId", args.userId).eq("lessonId", args.lessonId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { completed: false };
    } else {
      await ctx.db.insert("lessonCompletions", {
        userId: args.userId,
        lessonId: args.lessonId,
        completedAt: Date.now(),
      });
      return { completed: true };
    }
  },
});
