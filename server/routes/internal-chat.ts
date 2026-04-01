import type { Express } from "express";
import { db } from "../db";
import { internalChatRooms, internalChatMembers, internalChatMessages, internalChatReactions, users } from "@shared/schema";
import { eq, and, desc, sql, inArray, gt, isNull, ilike } from "drizzle-orm";

const typingState: Map<number, Map<number, { fullName: string; expiresAt: number }>> = new Map();

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function registerInternalChatRoutes(app: Express) {
  app.get("/api/internal-chat/users", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const INTERNAL_ROLES = ["admin", "manager", "accountant", "super_admin", "employee"];
      const allUsers = await db.select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        role: users.role,
      }).from(users).where(
        user.tenantId
          ? and(eq(users.tenantId, user.tenantId), inArray(users.role, INTERNAL_ROLES))
          : inArray(users.role, INTERNAL_ROLES)
      );
      res.set("Cache-Control", "no-cache, no-store");
      res.json(allUsers.filter(u => u.id !== user.id));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/rooms", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const memberRows = await db.select({ roomId: internalChatMembers.roomId })
        .from(internalChatMembers)
        .where(eq(internalChatMembers.userId, user.id));
      const roomIds = memberRows.map(r => r.roomId);
      if (roomIds.length === 0) return res.json([]);

      const rooms = await db.select().from(internalChatRooms)
        .where(inArray(internalChatRooms.id, roomIds))
        .orderBy(desc(internalChatRooms.lastMessageAt));

      const result = [];
      for (const room of rooms) {
        const members = await db.select({
          userId: internalChatMembers.userId,
          fullName: users.fullName,
          lastReadAt: internalChatMembers.lastReadAt,
        }).from(internalChatMembers)
          .innerJoin(users, eq(users.id, internalChatMembers.userId))
          .where(eq(internalChatMembers.roomId, room.id));

        const [lastMsg] = await db.select({
          body: internalChatMessages.body,
          senderId: internalChatMessages.senderId,
          senderName: users.fullName,
          createdAt: internalChatMessages.createdAt,
        }).from(internalChatMessages)
          .innerJoin(users, eq(users.id, internalChatMessages.senderId))
          .where(eq(internalChatMessages.roomId, room.id))
          .orderBy(desc(internalChatMessages.createdAt))
          .limit(1);

        const myMember = members.find(m => m.userId === user.id);
        let unreadCount = 0;
        if (myMember?.lastReadAt) {
          const [cnt] = await db.select({ count: sql<number>`count(*)::int` })
            .from(internalChatMessages)
            .where(and(
              eq(internalChatMessages.roomId, room.id),
              gt(internalChatMessages.createdAt, myMember.lastReadAt)
            ));
          unreadCount = cnt?.count || 0;
        } else {
          const [cnt] = await db.select({ count: sql<number>`count(*)::int` })
            .from(internalChatMessages)
            .where(eq(internalChatMessages.roomId, room.id));
          unreadCount = cnt?.count || 0;
        }

        let displayName = room.name;
        if (room.type === "direct") {
          const other = members.find(m => m.userId !== user.id);
          displayName = other?.fullName || "Unknown";
        }

        result.push({
          ...room,
          displayName,
          members,
          lastMessage: lastMsg || null,
          unreadCount,
        });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/rooms", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { name, type, memberIds } = req.body;
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: "memberIds required" });
      }

      if (type === "direct" && memberIds.length === 1) {
        const otherId = memberIds[0];
        const existing = await db.execute(sql`
          SELECT r.id FROM internal_chat_rooms r
          WHERE r.type = 'direct'
          AND EXISTS (SELECT 1 FROM internal_chat_members m WHERE m.room_id = r.id AND m.user_id = ${user.id})
          AND EXISTS (SELECT 1 FROM internal_chat_members m WHERE m.room_id = r.id AND m.user_id = ${otherId})
        `);
        if (existing.rows && existing.rows.length > 0) {
          return res.json({ id: existing.rows[0].id, existing: true });
        }
      }

      const [room] = await db.insert(internalChatRooms).values({
        tenantId: user.tenantId,
        name: type === "group" ? (name || "กลุ่มแชท") : null,
        type: type || "direct",
        createdBy: user.id,
      }).returning();

      const allMembers = [user.id, ...memberIds.filter((id: number) => id !== user.id)];
      for (const uid of allMembers) {
        await db.insert(internalChatMembers).values({ roomId: room.id, userId: uid });
      }

      res.json(room);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/rooms/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const before = req.query.before ? Number(req.query.before) : null;

      let whereClause = eq(internalChatMessages.roomId, roomId);

      const messages = await db.select({
        id: internalChatMessages.id,
        roomId: internalChatMessages.roomId,
        senderId: internalChatMessages.senderId,
        senderName: users.fullName,
        body: internalChatMessages.body,
        messageType: internalChatMessages.messageType,
        replyToId: internalChatMessages.replyToId,
        pinnedAt: internalChatMessages.pinnedAt,
        pinnedBy: internalChatMessages.pinnedBy,
        attachmentUrl: internalChatMessages.attachmentUrl,
        attachmentName: internalChatMessages.attachmentName,
        editedAt: internalChatMessages.editedAt,
        deletedAt: internalChatMessages.deletedAt,
        forwardedFromId: internalChatMessages.forwardedFromId,
        forwardedFromRoomName: internalChatMessages.forwardedFromRoomName,
        createdAt: internalChatMessages.createdAt,
      }).from(internalChatMessages)
        .innerJoin(users, eq(users.id, internalChatMessages.senderId))
        .where(before
          ? and(whereClause, sql`${internalChatMessages.id} < ${before}`)
          : whereClause
        )
        .orderBy(desc(internalChatMessages.id))
        .limit(limit);

      const allMembers = await db.select({
        userId: internalChatMembers.userId,
        lastReadAt: internalChatMembers.lastReadAt,
      }).from(internalChatMembers)
        .where(eq(internalChatMembers.roomId, roomId));
      const otherMembers = allMembers.filter(m => m.userId !== user.id);

      const reversed = messages.reverse();
      const msgIds = reversed.map(m => m.id);

      let reactionsMap: Record<number, { emoji: string; userId: number; userName: string }[]> = {};
      if (msgIds.length > 0) {
        const allReactions = await db.select({
          id: internalChatReactions.id,
          messageId: internalChatReactions.messageId,
          userId: internalChatReactions.userId,
          userName: users.fullName,
          emoji: internalChatReactions.emoji,
        }).from(internalChatReactions)
          .innerJoin(users, eq(users.id, internalChatReactions.userId))
          .where(inArray(internalChatReactions.messageId, msgIds));
        for (const r of allReactions) {
          (reactionsMap[r.messageId] ||= []).push({ emoji: r.emoji, userId: r.userId, userName: r.userName });
        }
      }

      let replyMap: Record<number, { id: number; body: string; senderName: string }> = {};
      const replyIds = reversed.filter(m => m.replyToId).map(m => m.replyToId!);
      if (replyIds.length > 0) {
        const replyMsgs = await db.select({
          id: internalChatMessages.id,
          body: internalChatMessages.body,
          senderName: users.fullName,
        }).from(internalChatMessages)
          .innerJoin(users, eq(users.id, internalChatMessages.senderId))
          .where(inArray(internalChatMessages.id, replyIds));
        for (const r of replyMsgs) {
          replyMap[r.id] = r;
        }
      }

      const enriched = reversed.map(msg => {
        const readBy = otherMembers
          .filter(m => m.lastReadAt && msg.createdAt && new Date(m.lastReadAt) >= new Date(msg.createdAt))
          .map(m => m.userId);
        return {
          ...msg,
          readBy,
          reactions: reactionsMap[msg.id] || [],
          replyTo: msg.replyToId ? replyMap[msg.replyToId] || null : null,
        };
      });

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/rooms/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const { body, replyToId, attachmentUrl, attachmentName } = req.body;
      if (!body?.trim() && !attachmentUrl) return res.status(400).json({ error: "body or attachment required" });

      if (replyToId) {
        const [replyMsg] = await db.select({ id: internalChatMessages.id }).from(internalChatMessages)
          .where(and(eq(internalChatMessages.id, replyToId), eq(internalChatMessages.roomId, roomId)));
        if (!replyMsg) return res.status(400).json({ error: "Invalid reply target" });
      }

      const [msg] = await db.insert(internalChatMessages).values({
        roomId,
        senderId: user.id,
        body: body?.trim() || "",
        messageType: attachmentUrl ? "file" : "text",
        replyToId: replyToId || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
      }).returning();

      await db.update(internalChatRooms)
        .set({ lastMessageAt: new Date() })
        .where(eq(internalChatRooms.id, roomId));

      await db.update(internalChatMembers)
        .set({ lastReadAt: new Date() })
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));

      let mentionedUserIds: number[] = [];
      const messageBody = body?.trim() || "";
      const mentionMatches = messageBody.match(/@(\S+)/g);
      if (mentionMatches && mentionMatches.length > 0) {
        const mentionedUsernames = mentionMatches.map((m: string) => m.slice(1));
        const mentionedUsers = await db.select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.username, mentionedUsernames));
        mentionedUserIds = mentionedUsers.map(u => u.id);
      }

      res.json({ ...msg, senderName: user.fullName, mentionedUserIds });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/internal-chat/rooms/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const [room] = await db.select().from(internalChatRooms).where(eq(internalChatRooms.id, roomId));
      if (room?.type === "group" && room.createdBy !== user.id) {
        return res.status(403).json({ error: "เฉพาะผู้สร้างกลุ่มเท่านั้นที่สามารถลบประวัติได้" });
      }

      await db.transaction(async (tx) => {
        await tx.delete(internalChatMessages).where(eq(internalChatMessages.roomId, roomId));
        await tx.update(internalChatRooms)
          .set({ lastMessageAt: null })
          .where(eq(internalChatRooms.id, roomId));
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/internal-chat/rooms/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const [room] = await db.select().from(internalChatRooms).where(eq(internalChatRooms.id, roomId));
      if (room?.type === "group" && room.createdBy !== user.id) {
        return res.status(403).json({ error: "เฉพาะผู้สร้างกลุ่มเท่านั้นที่สามารถลบห้องแชทได้" });
      }

      await db.transaction(async (tx) => {
        await tx.delete(internalChatMessages).where(eq(internalChatMessages.roomId, roomId));
        await tx.delete(internalChatMembers).where(eq(internalChatMembers.roomId, roomId));
        await tx.delete(internalChatRooms).where(eq(internalChatRooms.id, roomId));
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/rooms/:id/messages/:msgId/reactions", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const msgId = Number(req.params.msgId);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const { emoji } = req.body;
      if (!emoji) return res.status(400).json({ error: "emoji required" });

      const [targetMsg] = await db.select({ id: internalChatMessages.id }).from(internalChatMessages)
        .where(and(eq(internalChatMessages.id, msgId), eq(internalChatMessages.roomId, roomId)));
      if (!targetMsg) return res.status(404).json({ error: "Message not found in this room" });

      const existing = await db.select().from(internalChatReactions)
        .where(and(
          eq(internalChatReactions.messageId, msgId),
          eq(internalChatReactions.userId, user.id),
          eq(internalChatReactions.emoji, emoji)
        ));
      if (existing.length > 0) {
        await db.delete(internalChatReactions).where(eq(internalChatReactions.id, existing[0].id));
        return res.json({ removed: true });
      }

      const [reaction] = await db.insert(internalChatReactions).values({
        messageId: msgId,
        userId: user.id,
        emoji,
      }).returning();
      res.json(reaction);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/internal-chat/rooms/:id/messages/:msgId/pin", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const msgId = Number(req.params.msgId);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const [msg] = await db.select().from(internalChatMessages)
        .where(and(eq(internalChatMessages.id, msgId), eq(internalChatMessages.roomId, roomId)));
      if (!msg) return res.status(404).json({ error: "Message not found" });

      if (msg.pinnedAt) {
        await db.update(internalChatMessages)
          .set({ pinnedAt: null, pinnedBy: null })
          .where(eq(internalChatMessages.id, msgId));
        return res.json({ pinned: false });
      }

      await db.update(internalChatMessages)
        .set({ pinnedAt: new Date(), pinnedBy: user.id })
        .where(eq(internalChatMessages.id, msgId));
      res.json({ pinned: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/rooms/:id/pinned", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const pinned = await db.select({
        id: internalChatMessages.id,
        body: internalChatMessages.body,
        senderName: users.fullName,
        pinnedAt: internalChatMessages.pinnedAt,
        createdAt: internalChatMessages.createdAt,
      }).from(internalChatMessages)
        .innerJoin(users, eq(users.id, internalChatMessages.senderId))
        .where(and(
          eq(internalChatMessages.roomId, roomId),
          sql`${internalChatMessages.pinnedAt} IS NOT NULL`
        ))
        .orderBy(desc(internalChatMessages.pinnedAt));
      res.json(pinned);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const callStore = new Map<number, {
    id: number;
    callerId: number;
    callerName: string;
    targetUserId: number;
    offerSdp: string;
    answerSdp: string | null;
    callerIce: any[];
    calleeIce: any[];
    status: "ringing" | "answered" | "ended";
    createdAt: number;
  }>();
  let callIdSeq = 1;

  setInterval(() => {
    const now = Date.now();
    Array.from(callStore.entries()).forEach(([id, call]) => {
      if (now - call.createdAt > 5 * 60 * 1000) {
        callStore.delete(id);
      }
    });
  }, 30_000);

  app.post("/api/internal-chat/calls/initiate", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { targetUserId, sdp } = req.body;
      if (!targetUserId || !sdp) return res.status(400).json({ error: "targetUserId and sdp required" });

      const id = callIdSeq++;
      callStore.set(id, {
        id,
        callerId: user.id,
        callerName: user.fullName,
        targetUserId,
        offerSdp: sdp,
        answerSdp: null,
        callerIce: [],
        calleeIce: [],
        status: "ringing",
        createdAt: Date.now(),
      });
      res.json({ callId: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/calls/pending", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const pending: any[] = [];
      Array.from(callStore.values()).forEach(call => {
        if (call.targetUserId === user.id && call.status === "ringing") {
          pending.push({
            callId: call.id,
            callerId: call.callerId,
            callerName: call.callerName,
            sdp: call.offerSdp,
          });
        }
      });
      res.json(pending);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/calls/:id/answer", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const call = callStore.get(callId);
      if (!call) return res.status(404).json({ error: "Call not found" });
      if (call.targetUserId !== user.id) return res.status(403).json({ error: "Not the call target" });

      const { sdp } = req.body;
      if (!sdp) return res.status(400).json({ error: "sdp required" });

      call.answerSdp = sdp;
      call.status = "answered";
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/calls/:id/answer", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const call = callStore.get(callId);
      if (!call) return res.status(404).json({ error: "Call not found" });
      if (user.id !== call.callerId && user.id !== call.targetUserId) return res.status(403).json({ error: "Not a participant" });

      if (call.answerSdp) {
        res.json({ answered: true, sdp: call.answerSdp });
      } else if (call.status === "ended") {
        res.json({ answered: false, ended: true });
      } else {
        res.json({ answered: false });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/calls/:id/ice", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const call = callStore.get(callId);
      if (!call) return res.status(404).json({ error: "Call not found" });
      if (user.id !== call.callerId && user.id !== call.targetUserId) return res.status(403).json({ error: "Not a participant" });

      const { candidate } = req.body;
      if (!candidate) return res.status(400).json({ error: "candidate required" });

      if (user.id === call.callerId) {
        call.callerIce.push(candidate);
      } else {
        call.calleeIce.push(candidate);
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/calls/:id/ice", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const call = callStore.get(callId);
      if (!call) return res.status(404).json({ error: "Call not found" });
      if (user.id !== call.callerId && user.id !== call.targetUserId) return res.status(403).json({ error: "Not a participant" });

      if (user.id === call.callerId) {
        res.json(call.calleeIce);
      } else {
        res.json(call.callerIce);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/calls/:id/end", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const call = callStore.get(callId);
      if (!call) return res.status(404).json({ error: "Call not found" });
      if (user.id !== call.callerId && user.id !== call.targetUserId) return res.status(403).json({ error: "Not a participant" });

      call.status = "ended";
      setTimeout(() => callStore.delete(callId), 10_000);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const groupCallStore = new Map<number, {
    id: number;
    roomId: number;
    roomName: string;
    participants: Map<number, { userId: number; fullName: string; joinedAt: number }>;
    signals: { from: number; to: number; type: "offer" | "answer" | "ice"; data: any; ts: number }[];
    status: "active" | "ended";
    createdAt: number;
  }>();
  let groupCallIdSeq = 1;

  setInterval(() => {
    const now = Date.now();
    Array.from(groupCallStore.entries()).forEach(([id, call]) => {
      if (now - call.createdAt > 30 * 60 * 1000) {
        groupCallStore.delete(id);
      }
    });
  }, 60_000);

  app.post("/api/internal-chat/group-calls/start", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { roomId } = req.body;
      if (!roomId) return res.status(400).json({ error: "roomId required" });

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      for (const [, gc] of groupCallStore) {
        if (gc.roomId === roomId && gc.status === "active") {
          return res.json({ callId: gc.id, existing: true });
        }
      }

      const [room] = await db.select().from(internalChatRooms).where(eq(internalChatRooms.id, roomId));

      const id = groupCallIdSeq++;
      const participants = new Map<number, { userId: number; fullName: string; joinedAt: number }>();
      participants.set(user.id, { userId: user.id, fullName: user.fullName, joinedAt: Date.now() });

      groupCallStore.set(id, {
        id,
        roomId,
        roomName: room?.name || "Group Call",
        participants,
        signals: [],
        status: "active",
        createdAt: Date.now(),
      });

      res.json({ callId: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/group-calls/room/:roomId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.roomId);

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      for (const [, gc] of groupCallStore) {
        if (gc.roomId === roomId && gc.status === "active") {
          return res.json({
            callId: gc.id,
            active: true,
            participants: Array.from(gc.participants.values()),
          });
        }
      }
      res.json({ active: false });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/group-calls/:id/join", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const gc = groupCallStore.get(callId);
      if (!gc || gc.status !== "active") return res.status(404).json({ error: "Call not found" });

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, gc.roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member of this room" });

      const isAlreadyIn = gc.participants.has(user.id);
      if (!isAlreadyIn && gc.participants.size >= 4) {
        return res.status(400).json({ error: "ห้องประชุมเต็มแล้ว (สูงสุด 4 คน)" });
      }

      const existingParticipants = Array.from(gc.participants.values()).filter(p => p.userId !== user.id);

      if (!isAlreadyIn) {
        gc.participants.set(user.id, { userId: user.id, fullName: user.fullName, joinedAt: Date.now() });
      }

      res.json({
        callId: gc.id,
        existingParticipants,
        allParticipants: Array.from(gc.participants.values()),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/group-calls/:id/signal", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const gc = groupCallStore.get(callId);
      if (!gc || gc.status !== "active") return res.status(404).json({ error: "Call not found" });
      if (!gc.participants.has(user.id)) return res.status(403).json({ error: "Not in this call" });

      const { to, type, data } = req.body;
      if (!to || !type || !data) return res.status(400).json({ error: "to, type, data required" });
      const validTypes = ["offer", "answer", "ice"];
      if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid signal type" });
      if (!gc.participants.has(to)) return res.status(400).json({ error: "Target not in call" });

      const payload = typeof data === "string" ? data : JSON.stringify(data);
      if (payload.length > 50000) return res.status(400).json({ error: "Signal payload too large" });

      gc.signals.push({ from: user.id, to, type, data, ts: Date.now() });

      if (gc.signals.length > 500) {
        gc.signals = gc.signals.slice(-200);
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/group-calls/:id/signals", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const gc = groupCallStore.get(callId);
      if (!gc || gc.status !== "active") return res.status(404).json({ error: "Call not found" });
      if (!gc.participants.has(user.id)) return res.status(403).json({ error: "Not in this call" });

      const since = Number(req.query.since) || 0;
      const mySignals = gc.signals.filter(s => s.to === user.id && s.ts > since);

      res.json({
        signals: mySignals,
        participants: Array.from(gc.participants.values()),
        status: gc.status,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/group-calls/:id/leave-beacon", async (req, res) => {
    try {
      const callId = Number(req.params.id);
      const gc = groupCallStore.get(callId);
      if (!gc) return res.status(404).json({ error: "Call not found" });
      if (req.isAuthenticated() && req.user) {
        const userId = (req.user as any).id;
        gc.participants.delete(userId);
        gc.signals = gc.signals.filter(s => s.from !== userId && s.to !== userId);
        if (gc.participants.size === 0) {
          gc.status = "ended";
          setTimeout(() => groupCallStore.delete(callId), 10_000);
        }
      }
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.post("/api/internal-chat/group-calls/:id/leave", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const callId = Number(req.params.id);
      const gc = groupCallStore.get(callId);
      if (!gc) return res.status(404).json({ error: "Call not found" });
      if (!gc.participants.has(user.id)) return res.status(403).json({ error: "Not in this call" });

      gc.participants.delete(user.id);
      gc.signals = gc.signals.filter(s => s.from !== user.id && s.to !== user.id);

      if (gc.participants.size === 0) {
        gc.status = "ended";
        setTimeout(() => groupCallStore.delete(callId), 10_000);
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/internal-chat/rooms/:id/read", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      await db.update(internalChatMembers)
        .set({ lastReadAt: new Date() })
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/rooms/:id/messages/search", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const q = (req.query.q as string || "").trim();
      if (!q) return res.json([]);

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const results = await db.select({
        id: internalChatMessages.id,
        roomId: internalChatMessages.roomId,
        senderId: internalChatMessages.senderId,
        senderName: users.fullName,
        body: internalChatMessages.body,
        messageType: internalChatMessages.messageType,
        createdAt: internalChatMessages.createdAt,
      }).from(internalChatMessages)
        .innerJoin(users, eq(users.id, internalChatMessages.senderId))
        .where(and(
          eq(internalChatMessages.roomId, roomId),
          isNull(internalChatMessages.deletedAt),
          ilike(internalChatMessages.body, `%${q}%`)
        ))
        .orderBy(desc(internalChatMessages.createdAt))
        .limit(50);

      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/rooms/:id/messages/:msgId/forward", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const msgId = Number(req.params.msgId);
      const { targetRoomId } = req.body;
      if (!targetRoomId) return res.status(400).json({ error: "targetRoomId required" });

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member of source room" });

      const [targetMembership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, targetRoomId), eq(internalChatMembers.userId, user.id)));
      if (!targetMembership) return res.status(403).json({ error: "Not a member of target room" });

      const [originalMsg] = await db.select().from(internalChatMessages)
        .where(and(eq(internalChatMessages.id, msgId), eq(internalChatMessages.roomId, roomId)));
      if (!originalMsg) return res.status(404).json({ error: "Message not found" });
      if (originalMsg.deletedAt) return res.status(400).json({ error: "Cannot forward deleted message" });

      const [sourceRoom] = await db.select({ name: internalChatRooms.name, type: internalChatRooms.type })
        .from(internalChatRooms).where(eq(internalChatRooms.id, roomId));

      let sourceRoomName = sourceRoom?.name || "แชท";
      if (sourceRoom?.type === "direct") {
        const members = await db.select({ fullName: users.fullName })
          .from(internalChatMembers)
          .innerJoin(users, eq(users.id, internalChatMembers.userId))
          .where(and(eq(internalChatMembers.roomId, roomId), sql`${internalChatMembers.userId} != ${user.id}`));
        sourceRoomName = members[0]?.fullName || "แชท";
      }

      const [forwarded] = await db.insert(internalChatMessages).values({
        roomId: targetRoomId,
        senderId: user.id,
        body: originalMsg.body,
        messageType: originalMsg.messageType,
        attachmentUrl: originalMsg.attachmentUrl,
        attachmentName: originalMsg.attachmentName,
        forwardedFromId: originalMsg.id,
        forwardedFromRoomName: sourceRoomName,
      }).returning();

      await db.update(internalChatRooms)
        .set({ lastMessageAt: new Date() })
        .where(eq(internalChatRooms.id, targetRoomId));

      await db.update(internalChatMembers)
        .set({ lastReadAt: new Date() })
        .where(and(eq(internalChatMembers.roomId, targetRoomId), eq(internalChatMembers.userId, user.id)));

      res.json({ ...forwarded, senderName: user.fullName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/internal-chat/rooms/:id/messages/:msgId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const msgId = Number(req.params.msgId);
      const { body } = req.body;
      if (!body?.trim()) return res.status(400).json({ error: "body required" });

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const [msg] = await db.select().from(internalChatMessages)
        .where(and(eq(internalChatMessages.id, msgId), eq(internalChatMessages.roomId, roomId)));
      if (!msg) return res.status(404).json({ error: "Message not found" });
      if (msg.senderId !== user.id) return res.status(403).json({ error: "Can only edit your own messages" });
      if (msg.deletedAt) return res.status(400).json({ error: "Cannot edit deleted message" });

      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (msg.createdAt && new Date(msg.createdAt) < fifteenMinAgo) {
        return res.status(400).json({ error: "Can only edit messages within 15 minutes" });
      }

      const [updated] = await db.update(internalChatMessages)
        .set({ body: body.trim(), editedAt: new Date() })
        .where(eq(internalChatMessages.id, msgId))
        .returning();

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/internal-chat/rooms/:id/messages/:msgId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);
      const msgId = Number(req.params.msgId);

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const [msg] = await db.select().from(internalChatMessages)
        .where(and(eq(internalChatMessages.id, msgId), eq(internalChatMessages.roomId, roomId)));
      if (!msg) return res.status(404).json({ error: "Message not found" });
      if (msg.senderId !== user.id) return res.status(403).json({ error: "Can only delete your own messages" });

      await db.update(internalChatMessages)
        .set({ deletedAt: new Date() })
        .where(eq(internalChatMessages.id, msgId));

      res.json({ ok: true, deleted: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/internal-chat/rooms/:id/typing", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      if (!typingState.has(roomId)) {
        typingState.set(roomId, new Map());
      }
      typingState.get(roomId)!.set(user.id, {
        fullName: user.fullName,
        expiresAt: Date.now() + 3000,
      });

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/internal-chat/rooms/:id/typing", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const roomId = Number(req.params.id);

      const [membership] = await db.select().from(internalChatMembers)
        .where(and(eq(internalChatMembers.roomId, roomId), eq(internalChatMembers.userId, user.id)));
      if (!membership) return res.status(403).json({ error: "Not a member" });

      const roomTyping = typingState.get(roomId);
      if (!roomTyping) return res.json([]);

      const now = Date.now();
      const result: { userId: number; fullName: string }[] = [];
      const entries = Array.from(roomTyping.entries());
      for (const [userId, data] of entries) {
        if (data.expiresAt < now) {
          roomTyping.delete(userId);
        } else if (userId !== user.id) {
          result.push({ userId, fullName: data.fullName });
        }
      }
      if (roomTyping.size === 0) typingState.delete(roomId);

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
