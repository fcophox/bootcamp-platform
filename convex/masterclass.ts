import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("masterclasses").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    videoUrl: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("masterclasses", args);
  },
});
