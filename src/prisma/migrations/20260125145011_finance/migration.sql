-- CreateTable
CREATE TABLE "GroupStock" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,

    CONSTRAINT "GroupStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "ammount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupStock_groupId_key" ON "GroupStock"("groupId");

-- AddForeignKey
ALTER TABLE "GroupStock" ADD CONSTRAINT "GroupStock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
