-- CreateTable
CREATE TABLE "course_file_flashcards" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "course_file_id" INTEGER NOT NULL,
    "course_type" "LectureType" NOT NULL,
    "cards" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_file_flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_file_summaries" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "course_file_id" INTEGER NOT NULL,
    "course_type" "LectureType" NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_file_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_file_flashcards_course_file_id_key" ON "course_file_flashcards"("course_file_id");

-- CreateIndex
CREATE INDEX "course_file_flashcards_course_id_idx" ON "course_file_flashcards"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_file_summaries_course_file_id_key" ON "course_file_summaries"("course_file_id");

-- CreateIndex
CREATE INDEX "course_file_summaries_course_id_idx" ON "course_file_summaries"("course_id");

-- AddForeignKey
ALTER TABLE "course_file_flashcards" ADD CONSTRAINT "course_file_flashcards_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_file_flashcards" ADD CONSTRAINT "course_file_flashcards_course_file_id_fkey" FOREIGN KEY ("course_file_id") REFERENCES "course_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_file_summaries" ADD CONSTRAINT "course_file_summaries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_file_summaries" ADD CONSTRAINT "course_file_summaries_course_file_id_fkey" FOREIGN KEY ("course_file_id") REFERENCES "course_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
