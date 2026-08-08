import { createListHandler } from "../lib/express-prisma-query";
import { prisma } from "../lib/prisma";
import { ForbiddenError } from "../errors";

export const getAllAuditLogs = createListHandler({
  prisma: prisma.auditLog,

  allowedSortFields: [
    "id",
    "action",
    "actor_id",
    "actor_role",
    "actor_name",
    "mark_id",
    "course_id",
    "course_name",
    "student_id",
    "student_full_name",
    "academic_key",
    "created_at",
  ],

  fieldTypes: {
    id: "number",
    action: "text",
    actor_id: "number",
    actor_role: "text",
    actor_name: "text",
    mark_id: "number",
    course_id: "number",
    course_name: "text",
    student_id: "number",
    student_full_name: "text",
    academic_key: "text",
    created_at: "date",
  },

  searchableFields: [
    "actor_name",
    "course_name",
    "student_full_name",
    "academic_key",
  ],

  findManyArgs: {
    select: {
      id: true,
      action: true,
      actor_id: true,
      actor_role: true,
      actor_name: true,
      mark_id: true,
      course_id: true,
      course_name: true,
      student_id: true,
      student_full_name: true,
      academic_key: true,
      before_data: true,
      after_data: true,
      metadata: true,
      created_at: true,
    },
  } as any,

  handleFindArgs: ({ req, findManyArgs }) => {
    const role = (req.user as { role?: string } | undefined)?.role;

    if (role !== "ADMIN") {
      throw new ForbiddenError("Only admins can access audit logs");
    }

    return findManyArgs;
  },
});
