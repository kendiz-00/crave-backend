/*
  Warnings:

  - A unique constraint covering the columns `[userId,referenceId]` on the table `RewardTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "RewardTransaction" ADD COLUMN     "referenceId" TEXT;

-- CreateIndex
CREATE INDEX "RewardTransaction_referenceId_idx" ON "RewardTransaction"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardTransaction_userId_referenceId_key" ON "RewardTransaction"("userId", "referenceId");
