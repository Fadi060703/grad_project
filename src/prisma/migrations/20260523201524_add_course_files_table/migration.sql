-- CreateTable
CREATE TABLE "course_files" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "type" "LectureType" NOT NULL,
    "file" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_files_course_id_idx" ON "course_files"("course_id");

-- AddForeignKey
ALTER TABLE "course_files" ADD CONSTRAINT "course_files_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
