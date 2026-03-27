/*
  Warnings:

  - You are about to drop the column `accountType` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Team` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserTeams` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dateOfBirth` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatherName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `motherName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placeOfBirth` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropForeignKey
ALTER TABLE "_UserTeams" DROP CONSTRAINT "_UserTeams_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserTeams" DROP CONSTRAINT "_UserTeams_B_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accountType",
DROP COLUMN "email",
DROP COLUMN "password",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "fatherName" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "groupId" INTEGER NOT NULL,
ADD COLUMN     "motherName" TEXT NOT NULL,
ADD COLUMN     "placeOfBirth" TEXT NOT NULL;

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "Team";

-- DropTable
DROP TABLE "_UserTeams";

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
