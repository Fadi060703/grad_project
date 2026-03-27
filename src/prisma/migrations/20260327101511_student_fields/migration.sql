-- CreateTable
CREATE TABLE "Student" (
    "rollNum" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("rollNum")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
