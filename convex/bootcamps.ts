import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("bootcamps").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bootcamps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getById = query({
  args: { id: v.id("bootcamps") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByLegacyId = query({
  args: { legacyId: v.number() },
  handler: async (ctx, args) => {
    const bootcamps = await ctx.db.query("bootcamps").collect();
    return bootcamps.find((b) => b.legacyId === args.legacyId) || null;
  },
});

export const getWithModulesAndLessons = query({
  args: { legacyId: v.optional(v.number()), convexId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let bootcamp = null;
    
    // Find bootcamp by legacyId or convexId
    if (args.legacyId) {
      const bootcamps = await ctx.db.query("bootcamps").collect();
      bootcamp = bootcamps.find((b) => b.legacyId === args.legacyId);
    } else if (args.convexId) {
      try {
        const id = ctx.db.normalizeId("bootcamps", args.convexId);
        if (id) {
          bootcamp = await ctx.db.get(id);
        }
      } catch {
        // Try to find by string match
        const bootcamps = await ctx.db.query("bootcamps").collect();
        bootcamp = bootcamps.find((b) => b._id.toString() === args.convexId);
      }
    }
    
    if (!bootcamp) {
      return null;
    }
    
    // Get modules for this bootcamp
    const allModules = await ctx.db
      .query("modules")
      .withIndex("by_bootcamp", (q) => q.eq("bootcampId", bootcamp._id))
      .collect();
    
    // Get lessons for each module
    const modulesWithLessons = await Promise.all(
      allModules.map(async (mod) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_module", (q) => q.eq("moduleId", mod._id))
          .collect();
        
        return {
          id: mod.legacyId || mod._id.toString(),
          _id: mod._id,
          title: mod.title,
          order: mod.order,
          lessons: lessons.map((les) => ({
            id: les.legacyId || les._id.toString(),
            _id: les._id,
            title: les.title,
            type: les.type,
            content: les.content,
            order: les.order,
          })).sort((a, b) => a.order - b.order),
        };
      })
    );
    
    return {
      id: bootcamp.legacyId || bootcamp._id.toString(),
      _id: bootcamp._id,
      legacyId: bootcamp.legacyId,
      title: bootcamp.title,
      slug: bootcamp.slug,
      description: bootcamp.description,
      imageUrl: bootcamp.imageUrl,
      enableChecklist: bootcamp.enableChecklist,
      enableRanking: bootcamp.enableRanking,
      isFrozen: bootcamp.isFrozen,
      color: bootcamp.color,
      icon: bootcamp.icon,
      startDate: bootcamp.startDate,
      duration: bootcamp.duration,
      level: bootcamp.level,
      modules: modulesWithLessons.sort((a, b) => a.order - b.order),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    enableChecklist: v.optional(v.boolean()),
    enableRanking: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bootcamps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error(`El slug "${args.slug}" ya está en uso.`);
    }

    return await ctx.db.insert("bootcamps", {
      title: args.title,
      slug: args.slug,
      description: args.description,
      imageUrl: args.imageUrl,
      enableChecklist: args.enableChecklist ?? true,
      enableRanking: args.enableRanking ?? true,
      isFrozen: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("bootcamps"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    enableChecklist: v.optional(v.boolean()),
    enableRanking: v.optional(v.boolean()),
    isFrozen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("bootcamps") },
  handler: async (ctx, args) => {
    // Also delete modules and lessons associated with bootcamp
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_bootcamp", (q) => q.eq("bootcampId", args.id))
      .collect();

    for (const mod of modules) {
      const lessons = await ctx.db
        .query("lessons")
        .withIndex("by_module", (q) => q.eq("moduleId", mod._id))
        .collect();

      for (const les of lessons) {
        await ctx.db.delete(les._id);
      }
      await ctx.db.delete(mod._id);
    }

    await ctx.db.delete(args.id);
  },
});
