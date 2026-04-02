import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

export function deriveKey(hostname: string, macAddress: string): Buffer {
  const raw = `${hostname.trim().toLowerCase()}::${macAddress.trim().toLowerCase().replace(/[:-]/g, "")}`;
  return crypto.createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return payload.toString("base64");
}

export function decrypt(encoded: string, key: Buffer): string {
  const payload = Buffer.from(encoded, "base64");
  const iv = payload.subarray(0, 16);
  const authTag = payload.subarray(16, 32);
  const encrypted = payload.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateConfigDbCredentials(): { username: string; password: string } {
  const username = "etax_config";
  const password = crypto.randomBytes(24).toString("base64url");
  return { username, password };
}

export function generateEncryptedConfigFile(
  hostname: string,
  macAddress: string,
  configDbUser: string,
  configDbPassword: string,
  configDbPort: string = "5432",
  configDbName: string = "etax_config"
): { encryptedContent: string; keyPreview: string } {
  const key = deriveKey(hostname, macAddress);
  const config = {
    configDb: {
      host: "127.0.0.1",
      port: configDbPort,
      database: configDbName,
      user: configDbUser,
      password: configDbPassword,
    },
    generatedAt: new Date().toISOString(),
    machine: { hostname, macAddress },
  };
  const encryptedContent = encrypt(JSON.stringify(config), key);
  const keyPreview = key.toString("hex").slice(0, 8) + "..." + key.toString("hex").slice(-8);
  return { encryptedContent, keyPreview };
}
