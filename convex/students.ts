import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByBootcamp = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bootcampStudents")
      .withIndex("by_bootcamp_user", (q) => q.eq("bootcampId", args.bootcampId))
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bootcampStudents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const enroll = mutation({
  args: {
    bootcampId: v.id("bootcamps"),
    userId: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bootcampStudents")
      .withIndex("by_bootcamp_user", (q) => q.eq("bootcampId", args.bootcampId).eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status || "active" });
      return existing._id;
    }

    return await ctx.db.insert("bootcampStudents", {
      bootcampId: args.bootcampId,
      userId: args.userId,
      status: args.status || "active",
      enrolledAt: Date.now(),
    });
  },
});

export const removeStudent = mutation({
  args: { id: v.id("bootcampStudents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
