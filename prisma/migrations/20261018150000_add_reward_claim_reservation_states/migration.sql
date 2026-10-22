-- AlterEnum
ALTER TYPE "RewardClaimStatus" ADD VALUE 'AVAILABLE';
ALTER TYPE "RewardClaimStatus" ADD VALUE 'RESERVED';

-- AlterTable
ALTER TABLE "RewardClaim" ADD COLUMN "reservedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RewardClaim_orderId_status_idx" ON "RewardClaim"("orderId", "status");
