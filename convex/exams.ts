import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByLesson = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const exam = await ctx.db
      .query("exams")
      .filter((q) => q.eq(q.field("lessonId"), args.lessonId))
      .first();

    if (!exam) return null;

    const questions = await ctx.db
      .query("examQuestions")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .collect();

    const questionsWithOptions = await Promise.all(
      questions.map(async (q) => {
        const options = await ctx.db
          .query("examOptions")
          .withIndex("by_question", (oq) => oq.eq("questionId", q._id))
          .collect();
        return { ...q, options };
      })
    );

    return { ...exam, questions: questionsWithOptions };
  },
});

export const submitExam = mutation({
  args: {
    userId: v.string(),
    examId: v.id("exams"),
    score: v.number(),
    passed: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("examSubmissions", {
      userId: args.userId,
      examId: args.examId,
      score: args.score,
      passed: args.passed,
      submittedAt: Date.now(),
    });
  },
});

export const listSubmissions = query({
  args: { userId: v.string(), examId: v.id("exams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("examSubmissions")
      .withIndex("by_user_exam", (q) => q.eq("userId", args.userId).eq("examId", args.examId))
      .collect();
  },
});
