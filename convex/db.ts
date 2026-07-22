import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const TABLE_MAP: Record<string, string> = {
  Bootcamp: "bootcamps",
  Module: "modules",
  Lesson: "lessons",
  BootcampStudent: "bootcampStudents",
  UserRole: "legacyAuth",
  LessonCompletion: "lessonCompletions",
  Exam: "exams",
  ExamQuestion: "examQuestions",
  ExamOption: "examOptions",
  ExamSubmission: "examSubmissions",
  Certificate: "certificates",
  Feedback: "lessonFeedbacks",
  LessonFeedback: "lessonFeedbacks",
  Masterclass: "masterclasses",
  Invitation: "invitations",
  MedicionPregunta: "medicionPreguntas",
  MedicionRespuesta: "medicionRespuestas",
};

function getTableName(supabaseTable: string): string {
  return TABLE_MAP[supabaseTable] || supabaseTable;
}

export const genericQuery = query({
  args: {
    table: v.string(),
    eqFilters: v.optional(v.array(v.object({ field: v.string(), value: v.any() }))),
    inFilters: v.optional(v.array(v.object({ field: v.string(), values: v.array(v.any()) }))),
    orderField: v.optional(v.string()),
    orderDesc: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const table = getTableName(args.table);
    let q = ctx.db.query(table as any);

    const records = await q.collect();

    // Filter in-memory to support dynamic queries from Supabase compatibility shim
    let filtered = records;

    if (args.eqFilters) {
      for (const filter of args.eqFilters) {
        filtered = filtered.filter((r: any) => {
          if (table === "legacyAuth") {
            if (filter.field === "id") {
              return (
                r._id?.toString() === filter.value ||
                r.supabaseUserId === filter.value ||
                r.email === filter.value ||
                r.id === filter.value
              );
            }
            if (filter.field === "email") {
              return (
                r.email?.toLowerCase().trim() ===
                String(filter.value).toLowerCase().trim()
              );
            }
          }

          if (filter.field === "id") {
            const docId = r._id ? r._id.toString() : r.id;
            return (
              docId === filter.value ||
              r.id === filter.value ||
              r.supabaseUserId === filter.value
            );
          }

          if (filter.field === "userId" || filter.field === "user_id") {
            return (
              r.userId === filter.value ||
              r.user_id === filter.value ||
              r.email === filter.value
            );
          }

          if (filter.field === "bootcampId" || filter.field === "bootcamp_id") {
            const filterVal = String(filter.value);
            return (
              String(r.bootcampId) === filterVal || 
              String(r.bootcamp_id) === filterVal ||
              (r.legacyBootcampId && String(r.legacyBootcampId) === filterVal)
            );
          }

          if (filter.field === "lessonId" || filter.field === "lesson_id") {
            const filterVal = String(filter.value);
            return (
              String(r.lessonId) === filterVal || 
              String(r.lesson_id) === filterVal ||
              (r.legacyLessonId && String(r.legacyLessonId) === filterVal)
            );
          }
          
          if (filter.field === "studentId" || filter.field === "student_id") {
            const filterVal = String(filter.value);
            return (
              String(r.studentId) === filterVal || 
              String(r.student_id) === filterVal ||
              (r.legacyStudentId && String(r.legacyStudentId) === filterVal)
            );
          }

          return r[filter.field] === filter.value;
        });
      }
    }

    if (args.inFilters) {
      for (const filter of args.inFilters) {
        const valueSet = new Set(filter.values.map(String));
        filtered = filtered.filter((r: any) => {
          if (filter.field === "id") {
            const docId = r._id ? r._id.toString() : r.id;
            return (
              valueSet.has(String(docId)) ||
              valueSet.has(String(r.id)) ||
              (r.supabaseUserId && valueSet.has(String(r.supabaseUserId))) ||
              (r.legacyId && valueSet.has(String(r.legacyId)))
            );
          }
          
          // Handle studentId - check both studentId and legacyStudentId
          if (filter.field === "studentId" || filter.field === "student_id") {
            return (
              valueSet.has(String(r.studentId)) ||
              valueSet.has(String(r.student_id)) ||
              (r.legacyStudentId && valueSet.has(String(r.legacyStudentId)))
            );
          }
          
          // Handle lessonId - check both lessonId and legacyLessonId
          if (filter.field === "lessonId" || filter.field === "lesson_id") {
            return (
              valueSet.has(String(r.lessonId)) ||
              valueSet.has(String(r.lesson_id)) ||
              (r.legacyLessonId && valueSet.has(String(r.legacyLessonId)))
            );
          }
          
          // Handle bootcampId - check both bootcampId and legacyBootcampId
          if (filter.field === "bootcampId" || filter.field === "bootcamp_id") {
            return (
              valueSet.has(String(r.bootcampId)) ||
              valueSet.has(String(r.bootcamp_id)) ||
              (r.legacyBootcampId && valueSet.has(String(r.legacyBootcampId)))
            );
          }
          
          return (
            valueSet.has(String(r[filter.field])) ||
            (r.userId && valueSet.has(String(r.userId))) ||
            (r.user_id && valueSet.has(String(r.user_id)))
          );
        });
      }
    }

    // Map _id and _creationTime to id and createdAt for compatibility
    // Also map legacy fields for lessonCompletions compatibility
    let mapped = filtered.map((r) => {
      const { _id, _creationTime, ...rest } = r as any;
      const result: any = {
        id: typeof _id === "object" ? _id.toString() : _id,
        _id: _id,
        createdAt: _creationTime,
        ...rest,
      };
      
      // For lessonCompletions, prefer legacyStudentId and legacyLessonId for compatibility
      if (table === "lessonCompletions") {
        if (r.legacyStudentId !== undefined) {
          result.studentId = r.legacyStudentId;
        }
        if (r.legacyLessonId !== undefined) {
          result.lessonId = r.legacyLessonId;
        }
      }
      
      return result;
    });

    if (args.orderField) {
      const field = args.orderField;
      mapped.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        return valA < valB ? -1 : 1;
      });
      if (args.orderDesc) {
        mapped.reverse();
      }
    }

    return mapped;
  },
});

export const genericInsert = mutation({
  args: {
    table: v.string(),
    document: v.any(),
  },
  handler: async (ctx, args) => {
    const table = getTableName(args.table);
    
    // Normalize references and remove null values (Convex doesn't accept null, use undefined)
    const doc = { ...args.document };
    if (doc.id) delete doc.id;
    
    // Remove null values - Convex schema uses v.optional() which accepts undefined but not null
    for (const key of Object.keys(doc)) {
      if (doc[key] === null) {
        delete doc[key];
      }
    }
    
    const id = await ctx.db.insert(table as any, doc);
    return { id };
  },
});

export const genericUpdate = mutation({
  args: {
    table: v.string(),
    id: v.optional(v.string()),
    ids: v.optional(v.array(v.string())),
    document: v.any(),
  },
  handler: async (ctx, args) => {
    const table = getTableName(args.table);
    const doc = { ...args.document };
    if (doc.id) delete doc.id;
    
    // Remove null values - Convex schema uses v.optional() which accepts undefined but not null
    for (const key of Object.keys(doc)) {
      if (doc[key] === null) {
        delete doc[key];
      }
    }
    
    const targetIds = args.ids || (args.id ? [args.id] : []);
    
    for (const id of targetIds) {
      let docId: any = null;
      
      // First, try to normalize as a Convex ID
      try {
        docId = ctx.db.normalizeId(table as any, id);
      } catch {
        // Not a valid Convex ID format
      }
      
      // If not a valid Convex ID, try to find by legacyId
      if (!docId) {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          const records = await ctx.db.query(table as any).collect();
          const record = records.find((r: any) => r.legacyId === numericId);
          if (record) {
            docId = record._id;
          }
        }
      }
      
      if (!docId) {
        throw new Error(`genericUpdate: Could not find document with id "${id}" in table "${table}"`);
      }
      
      await ctx.db.patch(docId, doc);
    }
    return { success: true };
  },
});

export const genericUpsert = mutation({
  args: {
    table: v.string(),
    document: v.any(),
    uniqueKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const table = getTableName(args.table);
    const doc = { ...args.document };
    if (doc.id) delete doc.id;
    
    // Remove null values - Convex schema uses v.optional() which accepts undefined but not null
    for (const key of Object.keys(doc)) {
      if (doc[key] === null) {
        delete doc[key];
      }
    }

    let existingRecord: any = null;
    let uniqueKeys = args.uniqueKeys;

    if (!uniqueKeys) {
      if (table === "lessonFeedbacks") {
        uniqueKeys = ["lessonId", "userId"];
      } else if (table === "lessonCompletions") {
        uniqueKeys = doc.userId ? ["userId", "lessonId"] : ["studentId", "lessonId"];
      } else if (table === "bootcampStudents") {
        uniqueKeys = ["bootcampId", "email"];
      }
    }

    if (uniqueKeys && uniqueKeys.length > 0) {
      const records = await ctx.db.query(table as any).collect();
      existingRecord = records.find((r: any) => {
        return uniqueKeys!.every((key) => r[key] === doc[key]);
      });
    } else if (args.document.id) {
      try {
        const docId = ctx.db.normalizeId(table as any, args.document.id);
        if (docId) {
          existingRecord = await ctx.db.get(docId);
        }
      } catch {
        // Ignored
      }
    }

    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, doc);
      return { id: existingRecord._id, updated: true };
    } else {
      const id = await ctx.db.insert(table as any, doc);
      return { id, inserted: true };
    }
  },
});

export const genericDelete = mutation({
  args: {
    table: v.string(),
    id: v.optional(v.string()),
    ids: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const table = getTableName(args.table);
    const targetIds = args.ids || (args.id ? [args.id] : []);
    
    for (const id of targetIds) {
      let docId: any = null;
      
      // First, try to normalize as a Convex ID
      try {
        docId = ctx.db.normalizeId(table as any, id);
      } catch {
        // Not a valid Convex ID format
      }
      
      // If not a valid Convex ID, try to find by legacyId
      if (!docId) {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          const records = await ctx.db.query(table as any).collect();
          const record = records.find((r: any) => r.legacyId === numericId);
          if (record) {
            docId = record._id;
          }
        }
      }
      
      if (docId) {
        await ctx.db.delete(docId);
      }
    }
    return { success: true };
  },
});
