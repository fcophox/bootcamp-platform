import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.string()),
  }).index("email", ["email"]),

  // Tabla legacy para migración perezosa de contraseñas de Supabase (bcrypt)
  legacyAuth: defineTable({
    supabaseUserId: v.optional(v.string()),
    email: v.string(),
    passwordHash: v.string(), // bcrypt hash de Supabase auth.users
    role: v.string(), // superadmin | docente | alumno
    migrated: v.boolean(),
  }).index("by_email", ["email"]),

  // Presencia en tiempo real de usuarios conectados
  presence: defineTable({
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    updated: v.number(),
  }).index("by_updated", ["updated"]).index("by_user", ["userId"]),

  // Colecciones de la plataforma
  bootcamps: defineTable({
    title: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    enableChecklist: v.optional(v.boolean()),
    enableRanking: v.optional(v.boolean()),
    isFrozen: v.optional(v.boolean()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    duration: v.optional(v.string()),
    level: v.optional(v.string()),
    startDate: v.optional(v.string()),
    students: v.optional(v.number()),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_slug", ["slug"]),

  modules: defineTable({
    title: v.string(),
    order: v.number(),
    bootcampId: v.id("bootcamps"),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_bootcamp", ["bootcampId"]),

  lessons: defineTable({
    title: v.string(),
    type: v.string(),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    duration: v.optional(v.any()),
    order: v.number(),
    moduleId: v.optional(v.id("modules")),
    bootcampId: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    legacyModuleId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_module", ["moduleId"]),

  exams: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    lessonId: v.optional(v.id("lessons")),
    legacyId: v.optional(v.any()),
    timeLimitSeconds: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }),

  examQuestions: defineTable({
    examId: v.id("exams"),
    question: v.string(),
    order: v.number(),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_exam", ["examId"]),

  examOptions: defineTable({
    questionId: v.id("examQuestions"),
    optionText: v.string(),
    isCorrect: v.boolean(),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_question", ["questionId"]),

  examSubmissions: defineTable({
    userId: v.string(),
    examId: v.id("exams"),
    score: v.number(),
    passed: v.boolean(),
    submittedAt: v.number(),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_user_exam", ["userId", "examId"]),

  bootcampStudents: defineTable({
    bootcampId: v.id("bootcamps"),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    enrolledAt: v.optional(v.number()),
    joinedAt: v.optional(v.number()),
    invitedAt: v.optional(v.number()),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_bootcamp_user", ["bootcampId", "userId"]).index("by_user", ["userId"]),

  invitations: defineTable({
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    token: v.optional(v.string()),
    bootcampId: v.optional(v.any()),
    status: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    isUsed: v.optional(v.boolean()),
    usedBy: v.optional(v.string()),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_token", ["token"]).index("by_email", ["email"]),

  lessonCompletions: defineTable({
    userId: v.optional(v.string()),
    studentId: v.optional(v.any()),
    lessonId: v.optional(v.any()),
    bootcampId: v.optional(v.any()),
    completedAt: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    legacyLessonId: v.optional(v.any()),
    legacyStudentId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_user_lesson", ["userId", "lessonId"]).index("by_user", ["userId"]),

  lessonFeedbacks: defineTable({
    userId: v.string(),
    lessonId: v.any(),
    isLiked: v.optional(v.boolean()),
    comment: v.optional(v.string()),
    createdAt: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_lesson", ["lessonId"]).index("by_user_lesson", ["userId", "lessonId"]),

  certificates: defineTable({
    userId: v.optional(v.string()),
    bootcampId: v.optional(v.id("bootcamps")),
    certificateUrl: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    title: v.optional(v.string()),
    backgroundImageUrl: v.optional(v.string()),
    directorSignatureUrl: v.optional(v.string()),
    instructorSignatureUrl: v.optional(v.string()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
    dateFontSize: v.optional(v.any()),
    datePositionY: v.optional(v.any()),
    isActive: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    nameFontSize: v.optional(v.any()),
    namePositionY: v.optional(v.any()),
    programFontSize: v.optional(v.any()),
    programPositionY: v.optional(v.any()),
    showDirectorSignature: v.optional(v.any()),
    showInstructorSignature: v.optional(v.any()),
    textColor: v.optional(v.any()),
    titleFontSize: v.optional(v.any()),
  }).index("by_user_bootcamp", ["userId", "bootcampId"]),

  masterclasses: defineTable({
    title: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
    bootcampId: v.optional(v.any()),
    materials: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }),

  medicionEmpresas: defineTable({
    nombre: v.string(),
    rut: v.optional(v.string()),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }),

  medicionEvaluaciones: defineTable({
    empresaId: v.id("medicionEmpresas"),
    nombre: v.string(),
    fecha: v.number(),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_empresa", ["empresaId"]),

  medicionResultados: defineTable({
    evaluacionId: v.id("medicionEvaluaciones"),
    datos: v.any(),
    legacyId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_evaluacion", ["evaluacionId"]),

  medicionPreguntas: defineTable({
    bootcampId: v.any(),
    createdBy: v.string(),
    texto: v.string(),
    tipo: v.string(),
    opciones: v.optional(v.any()),
    orden: v.number(),
    enviada: v.boolean(),
    pausada: v.optional(v.boolean()),
    legacyId: v.optional(v.any()),
    legacyBootcampId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_bootcamp", ["bootcampId"]),

  medicionRespuestas: defineTable({
    preguntaId: v.string(),
    userId: v.string(),
    valor: v.string(),
    legacyId: v.optional(v.any()),
    legacyPreguntaId: v.optional(v.any()),
    createdAt: v.optional(v.any()),
    updatedAt: v.optional(v.any()),
  }).index("by_pregunta", ["preguntaId"]).index("by_user", ["userId"]),

  // Tokens para recuperación de contraseña
  passwordResetTokens: defineTable({
    email: v.string(),
    token: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_token", ["token"]).index("by_email", ["email"]),
});
