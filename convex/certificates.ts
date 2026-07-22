import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByUserAndBootcamp = query({
  args: { userId: v.string(), bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("certificates")
      .withIndex("by_user_bootcamp", (q) => q.eq("userId", args.userId).eq("bootcampId", args.bootcampId))
      .first();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    bootcampId: v.id("bootcamps"),
    certificateUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("certificates", {
      userId: args.userId,
      bootcampId: args.bootcampId,
      certificateUrl: args.certificateUrl,
      issuedAt: Date.now(),
    });
  },
});
