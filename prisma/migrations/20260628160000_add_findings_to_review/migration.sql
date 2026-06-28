-- Add structured findings array to Review
ALTER TABLE "Review" ADD COLUMN "findings" TEXT NOT NULL DEFAULT '[]';
