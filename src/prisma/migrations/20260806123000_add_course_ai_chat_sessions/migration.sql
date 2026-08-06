-- CreateEnum
CREATE TYPE "CourseAiChatMessageSender" AS ENUM ('USER', 'MODEL');

-- CreateTable
CREATE TABLE "course_ai_chat_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "student_id" INTEGER,
    "course_id" INTEGER NOT NULL,
    "previous_interaction_id" TEXT NOT NULL,
    "summaries_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_ai_chat_messages" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "sender" "CourseAiChatMessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_ai_chat_sessions_user_id_course_id_key" ON "course_ai_chat_sessions"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "course_ai_chat_sessions_course_id_idx" ON "course_ai_chat_sessions"("course_id");

-- CreateIndex
CREATE INDEX "course_ai_chat_sessions_student_id_idx" ON "course_ai_chat_sessions"("student_id");

-- CreateIndex
CREATE INDEX "course_ai_chat_messages_session_id_created_at_idx" ON "course_ai_chat_messages"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "course_ai_chat_sessions" ADD CONSTRAINT "course_ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_ai_chat_sessions" ADD CONSTRAINT "course_ai_chat_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_ai_chat_sessions" ADD CONSTRAINT "course_ai_chat_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_ai_chat_messages" ADD CONSTRAINT "course_ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "course_ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
