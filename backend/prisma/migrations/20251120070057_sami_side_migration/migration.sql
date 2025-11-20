/*
  Warnings:

  - You are about to drop the `chat_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `chats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "public"."chat_messages" DROP CONSTRAINT "chat_messages_chatId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "public"."chats" DROP CONSTRAINT "chats_spaceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "public"."chat_messages";

-- DropTable
DROP TABLE IF EXISTS "public"."chats";
