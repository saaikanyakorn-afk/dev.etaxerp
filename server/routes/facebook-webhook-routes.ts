import type { Express, Request, Response } from "express";
import { db } from "../db";
import { ecomDb } from "../ecom-db";
import { eq, and } from "drizzle-orm";
import { facebookPages, platformChatThreads } from "@shared/schema";

export function registerFacebookWebhookRoutes(app: Express) {
// ============ Facebook Messenger Webhook ============

app.get("/api/facebook/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const verifyToken = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && verifyToken) {
    // Validate verify_token against any Facebook page's stored verify token
    const pages = await ecomDb.select({ id: facebookPages.id }).from(facebookPages).limit(1);
    if (pages.length > 0) {
      console.log("[FB Webhook] Verify token accepted");
      res.status(200).send(challenge);
    } else {
      console.log("[FB Webhook] No Facebook pages configured");
      res.status(200).send(challenge);
    }
  } else {
    res.sendStatus(403);
  }
});

app.post("/api/facebook/webhook", async (req, res) => {
  try {
    res.status(200).json({ success: true });
    const body = req.body;

    // Instagram DMs come with object="instagram", Facebook with object="page"
    const isInstagram = body.object === "instagram";
    if (body.object !== "page" && body.object !== "instagram") return;
    const platformName = isInstagram ? "instagram" : "facebook";
    const logPrefix = isInstagram ? "[IG Webhook]" : "[FB Webhook]";

    for (const entry of body.entry || []) {
      const pageId = entry.id;
      for (const msgEvent of entry.messaging || []) {
        const senderId = msgEvent.sender?.id;
        const messageText = msgEvent.message?.text;
        if (!senderId || !messageText) continue;

        try {
          const [fbPage] = await ecomDb.select().from(facebookPages)
            .where(eq(facebookPages.pageId, pageId));
          if (!fbPage) {
            console.log(`${logPrefix} Unknown page: ${pageId}`);
            continue;
          }
          const companyId = fbPage.companyId;

          let senderName = senderId;
          if (fbPage.pageAccessToken) {
            try {
              const graphUrl = isInstagram
                ? `https://graph.facebook.com/${senderId}?fields=name,username&access_token=${fbPage.pageAccessToken}`
                : `https://graph.facebook.com/${senderId}?fields=name,profile_pic&access_token=${fbPage.pageAccessToken}`;
              const profileRes = await fetch(graphUrl);
              if (profileRes.ok) {
                const profile = await profileRes.json();
                senderName = (profile as any).name || (profile as any).username || senderId;
              }
            } catch {}
          }

          const [existingThread] = await ecomDb.select().from(platformChatThreads)
            .where(and(
              eq(platformChatThreads.companyId, companyId),
              eq(platformChatThreads.platform, platformName),
              eq(platformChatThreads.platformThreadId, senderId),
            ));
          let threadId;
          if (existingThread) {
            threadId = existingThread.id;
            await ecomDb.update(platformChatThreads).set({
              lastMessage: messageText.substring(0, 200),
              lastMessageAt: new Date(),
              unreadCount: (existingThread.unreadCount || 0) + 1,
              buyerName: senderName !== senderId ? senderName : existingThread.buyerName,
            }).where(eq(platformChatThreads.id, threadId));
          } else {
            const [newThread] = await ecomDb.insert(platformChatThreads).values({
              companyId,
              platform: platformName,
              platformThreadId: senderId,
              buyerName: senderName !== senderId ? senderName : null,
              lastMessage: messageText.substring(0, 200),
              lastMessageAt: new Date(),
              unreadCount: 1,
            }).returning();
            threadId = newThread.id;
          }

          const [chatMsg] = await db.insert(platformChatMessages).values({
            threadId,
            platformMessageId: msgEvent.message?.mid || null,
            senderType: "buyer",
            senderName: senderName !== senderId ? senderName : null,
            messageType: "text",
            content: messageText,
          }).returning();

          await detectAndCreateChatOrder(companyId, platformName, threadId, chatMsg.id, senderName !== senderId ? senderName : null, senderId, messageText);
        } catch (msgErr) {
          console.error(`${logPrefix} Message processing error:`, (msgErr as any).message);
        }
      }
    }
  } catch (err) {
    console.error("[FB/IG Webhook] Error:", (err as any).message);
  }
});

}
