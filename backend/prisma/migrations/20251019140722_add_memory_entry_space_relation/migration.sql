-- AddForeignKey
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
