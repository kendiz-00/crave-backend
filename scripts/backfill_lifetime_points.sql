-- Backfill lifetimePointsEarned from existing EARN transactions
-- This should be run once after adding the lifetimePointsEarned field

UPDATE "User" u
SET "lifetimePointsEarned" = (
    SELECT COALESCE(SUM(CASE WHEN rt.points > 0 THEN rt.points ELSE 0 END), 0)
    FROM "RewardTransaction" rt
    WHERE rt."userId" = u.id
    AND rt.type = 'EARN'
)
WHERE u."lifetimePointsEarned" = 0;
