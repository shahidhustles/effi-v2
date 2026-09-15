import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer } from "./cases";

const maxCaseChats = 50;
const maxCaseChatMessages = 200;
const maxChatTitleLength = 80;

const chatRole = v.union(v.literal("user"), v.literal("assistant"));
const chatParts = v.array(v.record(v.string(), v.any()));

export const listChats = query({
  args: { caseId: v.id("cases") },
  returns: v.array(
    v.object({
      chatId: v.id("caseChats"),
      title: v.string(),
      createdAt: v.number(),
      lastMessageAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    const caseRecord = await ctx.db.get(args.caseId);
    if (!caseRecord) throw new Error("Unknown case.");
    const chats = await ctx.db
      .query("caseChats")
      .withIndex("by_case_id_and_last_message_at", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .take(maxCaseChats);
    return chats.map((chat) => ({
      chatId: chat._id,
      title: chat.title,
      createdAt: chat.createdAt,
      lastMessageAt: chat.lastMessageAt,
    }));
  },
});

export const createChat = mutation({
  args: { caseId: v.id("cases"), title: v.string() },
  returns: v.object({ chatId: v.id("caseChats") }),
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    const caseRecord = await ctx.db.get(args.caseId);
    if (!caseRecord) throw new Error("Unknown case.");
    const title = args.title.trim().slice(0, maxChatTitleLength) || "New chat";
    const now = Date.now();
    const chatId = await ctx.db.insert("caseChats", {
      caseId: args.caseId,
      title,
      createdAt: now,
      lastMessageAt: now,
    });
    return { chatId };
  },
});

export const listByChat = query({
  args: { chatId: v.id("caseChats") },
  returns: v.array(
    v.object({
      messageId: v.id("caseChatMessages"),
      role: chatRole,
      parts: chatParts,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Unknown chat.");
    const messages = await ctx.db
      .query("caseChatMessages")
      .withIndex("by_chat_id_and_created_at", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .take(maxCaseChatMessages);
    return messages.map((message) => ({
      messageId: message._id,
      role: message.role,
      parts: message.parts,
      createdAt: message.createdAt,
    }));
  },
});

export const appendMessage = mutation({
  args: { caseId: v.id("cases"), chatId: v.id("caseChats"), role: chatRole, parts: chatParts },
  returns: v.object({ messageId: v.id("caseChatMessages") }),
  handler: async (ctx, args) => {
    const { actor } = await requireOfficer(ctx);
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.caseId !== args.caseId) throw new Error("Unknown chat.");
    const messageId = await ctx.db.insert("caseChatMessages", {
      caseId: args.caseId,
      chatId: args.chatId,
      officerIdentityId: actor._id,
      role: args.role,
      parts: args.parts,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.chatId, { lastMessageAt: Date.now() });
    return { messageId };
  },
});
