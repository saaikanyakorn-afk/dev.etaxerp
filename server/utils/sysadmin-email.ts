import nodemailer from "nodemailer";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function getSmtpConfig() {
  const rows = await db.execute(sql`
    SELECT config_key, config_value FROM system_config
    WHERE config_key IN (
      'SYSADMIN_SMTP_HOST','SYSADMIN_SMTP_PORT','SYSADMIN_SMTP_USER',
      'SYSADMIN_SMTP_PASS','SYSADMIN_SMTP_FROM','SYSADMIN_SMTP_SECURE'
    )
  `);
  const cfg: Record<string, string> = {};
  for (const row of rows.rows as any[]) {
    cfg[row.config_key] = row.config_value;
  }
  return cfg;
}

export async function sendSysAdminEmail(to: string, subject: string, html: string): Promise<void> {
  const cfg = await getSmtpConfig();

  if (!cfg.SYSADMIN_SMTP_HOST || !cfg.SYSADMIN_SMTP_USER || !cfg.SYSADMIN_SMTP_PASS) {
    console.warn("[SysAdmin Email] SMTP not configured — email not sent:", { to, subject });
    console.info("[SysAdmin Email] Would send:", { to, subject, html: html.slice(0, 200) });
    return;
  }

  const smtpPass = cfg.SYSADMIN_SMTP_PASS.trim();
  console.log(`[SysAdmin SMTP] host=${cfg.SYSADMIN_SMTP_HOST} user=${cfg.SYSADMIN_SMTP_USER} passLen=${smtpPass.length} passFirst6=${smtpPass.slice(0,6)}`);
  const transporter = nodemailer.createTransport({
    host: cfg.SYSADMIN_SMTP_HOST,
    port: Number(cfg.SYSADMIN_SMTP_PORT || "587"),
    secure: cfg.SYSADMIN_SMTP_SECURE === "true",
    auth: {
      user: cfg.SYSADMIN_SMTP_USER,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: cfg.SYSADMIN_SMTP_FROM || cfg.SYSADMIN_SMTP_USER,
    to,
    subject,
    html,
  });
}

export function buildOtpEmail(otp: string, purpose: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9fafb;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#1e293b;padding:12px 20px;border-radius:8px">
          <span style="color:#fb9678;font-size:18px;font-weight:bold">🔐 E-Tax Center</span>
        </div>
      </div>
      <h2 style="color:#1e293b;margin:0 0 8px">รหัส OTP — ${purpose}</h2>
      <p style="color:#64748b;margin:0 0 24px">รหัสนี้หมดอายุใน <strong>10 นาที</strong> ห้ามแชร์กับผู้อื่น</p>
      <div style="background:#1e293b;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="color:#fb9678;font-size:36px;font-weight:bold;letter-spacing:8px">${otp}</span>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center">
        หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาแจ้งผู้ดูแลระบบทันที
      </p>
    </div>
  `;
}

export async function getSmtpConfigForDisplay() {
  const cfg = await getSmtpConfig();
  return {
    host: cfg.SYSADMIN_SMTP_HOST || "",
    port: Number(cfg.SYSADMIN_SMTP_PORT || "587"),
    user: cfg.SYSADMIN_SMTP_USER || "",
    pass: cfg.SYSADMIN_SMTP_PASS ? "••••••••" : "",
    from: cfg.SYSADMIN_SMTP_FROM || "",
    secure: cfg.SYSADMIN_SMTP_SECURE === "true",
    configured: !!(cfg.SYSADMIN_SMTP_HOST && cfg.SYSADMIN_SMTP_USER && cfg.SYSADMIN_SMTP_PASS),
  };
}

export async function saveSmtpConfig(cfg: {
  host: string; port: number; user: string; pass?: string; from: string; secure: boolean;
}) {
  const upsert = async (key: string, value: string) => {
    await db.execute(sql`
      INSERT INTO system_config (config_key, config_value)
      VALUES (${key}, ${value})
      ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value
    `);
  };
  await upsert("SYSADMIN_SMTP_HOST", cfg.host);
  await upsert("SYSADMIN_SMTP_PORT", String(cfg.port));
  await upsert("SYSADMIN_SMTP_USER", cfg.user);
  await upsert("SYSADMIN_SMTP_FROM", cfg.from);
  await upsert("SYSADMIN_SMTP_SECURE", String(cfg.secure));
  if (cfg.pass && !cfg.pass.startsWith("••••")) {
    await upsert("SYSADMIN_SMTP_PASS", cfg.pass.trim());
  }
}
