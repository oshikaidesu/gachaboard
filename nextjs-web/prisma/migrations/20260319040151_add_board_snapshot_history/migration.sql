-- CreateTable
CREATE TABLE "BoardSnapshotHistory" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "thumbnailSvg" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardSnapshotHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardSnapshotHistory_boardId_savedAt_idx" ON "BoardSnapshotHistory"("boardId", "savedAt");

-- AddForeignKey
ALTER TABLE "BoardSnapshotHistory" ADD CONSTRAINT "BoardSnapshotHistory_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
