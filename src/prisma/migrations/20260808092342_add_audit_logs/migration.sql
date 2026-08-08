-- CreateEnum
CREATE TYPE "AuditLogAction" AS ENUM ('MARK_CREATED', 'MARK_UPDATED', 'MARK_DELETED', 'MARK_PRACTICAL_PUBLISHED', 'MARK_FULL_PUBLISHED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" "AuditLogAction" NOT NULL,
    "actor_id" INTEGER,
    "actor_role" "Role",
    "actor_name" TEXT,
    "mark_id" INTEGER,
    "course_id" INTEGER,
    "course_name" TEXT,
    "student_id" INTEGER,
    "student_full_name" TEXT,
    "academic_key" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_role_idx" ON "audit_logs"("actor_role");

-- CreateIndex
CREATE INDEX "audit_logs_actor_name_idx" ON "audit_logs"("actor_name");

-- CreateIndex
CREATE INDEX "audit_logs_mark_id_idx" ON "audit_logs"("mark_id");

-- CreateIndex
CREATE INDEX "audit_logs_course_id_idx" ON "audit_logs"("course_id");

-- CreateIndex
CREATE INDEX "audit_logs_course_name_idx" ON "audit_logs"("course_name");

-- CreateIndex
CREATE INDEX "audit_logs_student_id_idx" ON "audit_logs"("student_id");

-- CreateIndex
CREATE INDEX "audit_logs_student_full_name_idx" ON "audit_logs"("student_full_name");

-- CreateIndex
CREATE INDEX "audit_logs_academic_key_idx" ON "audit_logs"("academic_key");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
