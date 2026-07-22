import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByBootcamp = query({
  args: { bootcampId: v.id("bootcamps") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("modules")
      .withIndex("by_bootcamp", (q) => q.eq("bootcampId", args.bootcampId))
      .collect();
  },
});

export const create = mutation({
  args: {
    bootcampId: v.id("bootcamps"),
    title: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("modules", {
      bootcampId: args.bootcampId,
      title: args.title,
      order: args.order,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("modules"),
    title: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("modules") },
  handler: async (ctx, args) => {
    // Delete lessons inside module
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_module", (q) => q.eq("moduleId", args.id))
      .collect();

    for (const les of lessons) {
      await ctx.db.delete(les._id);
    }

    await ctx.db.delete(args.id);
  },
});
