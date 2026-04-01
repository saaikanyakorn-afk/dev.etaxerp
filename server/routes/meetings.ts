import type { Express } from "express";
import { db } from "../db";
import { meetings, meetingParticipants, users } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function registerMeetingRoutes(app: Express) {
  app.get("/api/meetings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const participantRows = await db.select({ meetingId: meetingParticipants.meetingId })
        .from(meetingParticipants)
        .where(eq(meetingParticipants.userId, user.id));
      const meetingIdsFromParticipant = participantRows.map(r => r.meetingId);

      const createdMeetings = await db.select({ id: meetings.id })
        .from(meetings)
        .where(
          user.tenantId
            ? and(eq(meetings.tenantId, user.tenantId), eq(meetings.createdBy, user.id))
            : eq(meetings.createdBy, user.id)
        );
      const createdIds = createdMeetings.map(r => r.id);

      const allIds = Array.from(new Set([...meetingIdsFromParticipant, ...createdIds]));
      if (allIds.length === 0) return res.json([]);

      const allMeetings = await db.select().from(meetings)
        .where(inArray(meetings.id, allIds))
        .orderBy(desc(meetings.startTime));

      const result = [];
      for (const meeting of allMeetings) {
        const participants = await db.select({
          id: meetingParticipants.id,
          userId: meetingParticipants.userId,
          fullName: users.fullName,
          status: meetingParticipants.status,
        }).from(meetingParticipants)
          .innerJoin(users, eq(users.id, meetingParticipants.userId))
          .where(eq(meetingParticipants.meetingId, meeting.id));

        const [creator] = await db.select({ fullName: users.fullName })
          .from(users).where(eq(users.id, meeting.createdBy));

        result.push({
          ...meeting,
          createdByName: creator?.fullName || "Unknown",
          participants,
        });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { title, description, meetingUrl, meetingType, startTime, endTime, chatRoomId, participantIds } = req.body;
      if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: "title, startTime, endTime required" });
      }

      const [meeting] = await db.insert(meetings).values({
        tenantId: user.tenantId,
        companyId: req.body.companyId || null,
        title,
        description: description || null,
        meetingUrl: meetingUrl || null,
        meetingType: meetingType || "other",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: user.id,
        status: "scheduled",
        chatRoomId: chatRoomId || null,
      }).returning();

      if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
        const uniqueIds = Array.from(new Set([user.id, ...participantIds])) as number[];
        if (user.tenantId) {
          const validUsers = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.tenantId, user.tenantId), inArray(users.id, uniqueIds)));
          const validIds = new Set(validUsers.map(u => u.id));
          const invalidIds = uniqueIds.filter(id => !validIds.has(id));
          if (invalidIds.length > 0) {
            return res.status(400).json({ error: "Some participant IDs are not in your organization" });
          }
        }
        for (const uid of uniqueIds) {
          await db.insert(meetingParticipants).values({
            meetingId: meeting.id,
            userId: uid,
            status: uid === user.id ? "accepted" : "invited",
          });
        }
      } else {
        await db.insert(meetingParticipants).values({
          meetingId: meeting.id,
          userId: user.id,
          status: "accepted",
        });
      }

      res.json(meeting);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const meetingId = Number(req.params.id);
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });

      const participants = await db.select({
        id: meetingParticipants.id,
        userId: meetingParticipants.userId,
        fullName: users.fullName,
        status: meetingParticipants.status,
      }).from(meetingParticipants)
        .innerJoin(users, eq(users.id, meetingParticipants.userId))
        .where(eq(meetingParticipants.meetingId, meetingId));

      const isParticipant = participants.some(p => p.userId === user.id);
      const isCreator = meeting.createdBy === user.id;
      if (!isParticipant && !isCreator) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const [creator] = await db.select({ fullName: users.fullName })
        .from(users).where(eq(users.id, meeting.createdBy));

      res.json({
        ...meeting,
        createdByName: creator?.fullName || "Unknown",
        participants,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const meetingId = Number(req.params.id);
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.createdBy !== user.id) return res.status(403).json({ error: "Only creator can update" });

      const updates: any = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.meetingUrl !== undefined) updates.meetingUrl = req.body.meetingUrl;
      if (req.body.meetingType !== undefined) updates.meetingType = req.body.meetingType;
      if (req.body.startTime !== undefined) updates.startTime = new Date(req.body.startTime);
      if (req.body.endTime !== undefined) updates.endTime = new Date(req.body.endTime);
      if (req.body.status !== undefined) updates.status = req.body.status;

      const [updated] = await db.update(meetings).set(updates).where(eq(meetings.id, meetingId)).returning();

      if (req.body.participantIds && Array.isArray(req.body.participantIds)) {
        await db.delete(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId));
        const uniqueIds = Array.from(new Set([user.id, ...req.body.participantIds])) as number[];
        for (const uid of uniqueIds) {
          await db.insert(meetingParticipants).values({
            meetingId: meetingId,
            userId: uid,
            status: uid === user.id ? "accepted" : "invited",
          });
        }
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const meetingId = Number(req.params.id);
      const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) return res.status(404).json({ error: "Meeting not found" });
      if (meeting.createdBy !== user.id) return res.status(403).json({ error: "Only creator can cancel" });

      await db.update(meetings)
        .set({ status: "cancelled" })
        .where(eq(meetings.id, meetingId));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings/:id/respond", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const meetingId = Number(req.params.id);
      const { status } = req.body;
      if (!status || !["accepted", "declined"].includes(status)) {
        return res.status(400).json({ error: "status must be 'accepted' or 'declined'" });
      }

      const [participant] = await db.select().from(meetingParticipants)
        .where(and(
          eq(meetingParticipants.meetingId, meetingId),
          eq(meetingParticipants.userId, user.id)
        ));
      if (!participant) return res.status(404).json({ error: "Not invited to this meeting" });

      await db.update(meetingParticipants)
        .set({ status })
        .where(eq(meetingParticipants.id, participant.id));
      res.json({ ok: true, status });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
