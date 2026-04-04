# E-Tax Center — Infrastructure Admin Guide (DRAFT)

> **สถานะ:** ฉบับร่าง — พี่ช้าง + Kai จะทำให้สมบูรณ์ภายหลัง
> **อัพเดทล่าสุด:** 3 เมษายน 2569 (2026)

---

## 1. สถาปัตยกรรมรวม (System Architecture)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Replit (Dev)    │     │   etaxerp.com   │     │   deep-main     │
│  Neon Postgres   │     │   App Server    │     │  Database Server│
│  (US, dev only)  │     │  Windows Server │     │  Ubuntu Linux   │
│                  │     │  Port 5000      │     │  Port 20541     │
│  Branch:         │     │  PM2 managed    │     │  etax-production│
│  replit-agent    │     │  dist/index.cjs │     │  etax-develop   │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                        │
                                 │   LAN: 192.168.10.x    │
                                 ├────────────────────────┤
                                 │   FQDN: deep-main.     │
                                 │   hopto.org (fallback)  │
                                 └────────────────────────┘
```

### เครื่องหลัก

| ชื่อ | ประเภท | OS | IP/Domain | หน้าที่ |
|------|--------|-----|-----------|---------|
| Replit (Neon) | Dev/Cloud | Cloud | — | Development + testing on replit.app |
| server-e5 (deep-main) | Database | Linux | LAN: 192.168.10.201, FQDN: deep-main.hopto.org | Production DB (etax-production, 288 tables) |
| etaxerp | App Server | Windows | FQDN: etaxerp.com, LAN: 192.168.3.35 | Production app (PM2, port 5000) |

---

## 2. Deployment Flow (ขั้นตอนการ Deploy)

```
Kai (Replit) แก้ code
    ↓
พี่ทราย ทดสอบบน replit.app
    ↓ ยืนยัน OK
Kai push GitHub: git push github replit-agent:main --force
    ↓
พี่ช้าง บน etaxerp:
    git pull origin main
    npm run build          ← สำคัญ! PM2 รัน dist/index.cjs (compiled)
    pm2 flush etax-center
    pm2 restart etax-center
```

**ข้อยกเว้น:** Code เกี่ยวกับ encrypted config สามารถ push ตรงได้ไม่ต้องรอพี่ทราย

---

## 3. Encrypted Config System (ระบบ Config เข้ารหัส)

### 3.1 หลักการ

ทุก App Server มี **local config database** (etaxcfg) ที่เก็บ secrets เข้ารหัส AES-256-GCM

**Key derivation:**
```
hostname + MAC address + port → SHA-256 → AES-256-GCM key
```

- Key ผูกกับ hardware ของเครื่อง — ย้ายเครื่องต้อง generate ใหม่
- ไม่เก็บ key ไว้ที่ไหน — derive จาก hardware ทุกครั้ง

### 3.2 Config Bootstrap Chain

```
App Start
  ↓
1. อ่าน .env (dotenv) → ได้ MACHINE_NAME, MACHINE_DB_PORT
  ↓
2. Derive key จาก hostname + MAC + port
  ↓
3. Connect local Postgres (127.0.0.1:MACHINE_DB_PORT/etaxcfg)
  ↓
4. Decrypt enc_content → ได้ config DB credentials
  ↓
5. Read system_config table → ได้ DB_MAIN_URL, DB_MAIN_LAN_URL, etc.
  ↓
6. LAN Probe (ถ้า DB_MAIN_LAN=true)
  ↓
7. Connect production database
```

### 3.3 Config DB Structure (etaxcfg.system_config)

| config_key | ประเภท | คำอธิบาย |
|------------|--------|----------|
| APP_VERSION | non-secret | เวอร์ชั่น app |
| DB_MAIN_URL | secret | Connection string ไป production DB (FQDN) |
| DB_MAIN_LAN_URL | secret | Connection string ไป production DB (LAN IP) |
| RECAPTCHA_SITE_KEY | non-secret | reCAPTCHA site key |
| RECAPTCHA_SECRET_KEY | secret | reCAPTCHA secret key |

### 3.4 Generate Config สำหรับเครื่องใหม่

1. เปิดหน้า **เซิร์ฟเวอร์ฐานข้อมูล** (Platform Admin)
2. เลือกเครื่อง App Server ที่ต้องการ
3. กรอก hostname, MAC address, config DB port
4. กดปุ่ม **สร้าง Config**
5. ทำตาม SQL Steps 1-4 บนเครื่องเป้าหมาย
6. ดาวน์โหลดไฟล์ `.enc` เก็บไว้เป็น backup

---

## 4. .env File (Non-Secret Variables)

### 4.1 ตัวอย่าง .env ของ etaxerp

```env
NODE_ENV=production
PORT=5000
MACHINE_NAME=etaxerp.com
MACHINE_DB_PORT=15064
DB_MAIN_HOST=server-e5
DB_MAIN_LAN=true
```

### 4.2 คำอธิบายแต่ละ variable

| Variable | ค่า | คำอธิบาย |
|----------|-----|----------|
| NODE_ENV | production | โหมดการทำงาน |
| PORT | 5000 | Port ที่ app listen |
| MACHINE_NAME | etaxerp.com | Hostname สำหรับ derive encryption key |
| MACHINE_DB_PORT | 15064 | Port ของ local config DB (etaxcfg) |
| DB_MAIN_HOST | server-e5 | ชื่อ DB server ที่ใช้ (แสดงใน log) |
| DB_MAIN_LAN | true | เปิดใช้ LAN Probe (ดูหัวข้อ 5) |

### 4.3 กฎสำคัญ

- **ห้ามใส่ secret** ใน .env — ใช้ config DB แทน
- **ห้ามใช้ `echo >>` บน Windows** — จะมี trailing space ทำให้ค่าผิด ให้ใช้ Notepad แก้แทน
- .env ถูกเก็บใน DB ด้วย (machines.envContent) เพื่อเป็น reference

---

## 5. LAN Probe (ระบบตรวจสอบ LAN Connection)

### 5.1 หลักการ

เมื่อ `DB_MAIN_LAN=true` ใน .env, app จะทดสอบเชื่อมต่อ DB ผ่าน LAN IP ก่อน — ถ้าสำเร็จใช้ LAN (เร็วกว่า), ถ้าล้มเหลวใช้ FQDN อัตโนมัติ

```
DB_MAIN_LAN=true?
  ├─ Yes → Probe LAN (pg.Client, 5s timeout)
  │         ├─ OK → ใช้ DB_MAIN_LAN_URL (LAN IP, เร็วกว่า)
  │         └─ FAIL → ใช้ DB_MAIN_URL (FQDN, ผ่าน internet)
  └─ No → ใช้ DB_MAIN_URL โดยตรง
```

### 5.2 Log File

**ตำแหน่ง:** `C:\GitApp\etaxcenter\logs\lan-probe.log`

**รูปแบบ:** Append ทุกครั้งที่ restart (ไม่ overwrite) — เก็บประวัติย้อนหลังได้

```
[2026-04-03 13:11:07] --- LAN Probe Start ---
[2026-04-03 13:11:07] FQDN URL: postgresql://***@deep-main.hopto.org:20541/etax-production
[2026-04-03 13:11:07] LAN  URL: postgresql://***@192.168.10.201:20541/etax-production
[2026-04-03 13:11:07] Result: LAN connected ✓ — using LAN URL
[2026-04-03 13:11:07] --- LAN Probe End ---

[2026-04-03 13:25:39] --- LAN Probe Start ---
[2026-04-03 13:25:44] Result: LAN connection FAILED ✗ fallback to FQDN URL
[2026-04-03 13:25:44] --- LAN Probe End ---
```

### 5.3 สถานการณ์ที่ LAN จะ Fail

- Switch/router ระหว่าง App Server กับ DB Server พัง
- สาย LAN หลุด
- NIC ที่ใช้ subnet 192.168.10.x ถูกปิด
- deep-main offline (ทั้ง LAN + FQDN จะ fail — app ไม่สามารถ start ได้)

### 5.4 ทดสอบ Fallback

**วิธีจำลอง LAN fail:**
1. ถอด IP 192.168.10.x ออกจาก NIC ของ etaxerp
2. `pm2 flush etax-center && pm2 restart etax-center`
3. ดู log: `pm2 logs etax-center --out --lines 30 --nostream`
4. ดู probe log: `type C:\GitApp\etaxcenter\logs\lan-probe.log`
5. ใส่ IP กลับ แล้ว restart อีกครั้ง

---

## 6. PM2 Management

### 6.1 คำสั่งที่ใช้บ่อย

```bash
# ดู status
pm2 status

# Restart (หลัง git pull + npm run build)
pm2 flush etax-center && pm2 restart etax-center

# ดู log (ล่าสุด 30 บรรทัด)
pm2 logs etax-center --out --lines 30 --nostream

# ดู error log
pm2 logs etax-center --err --lines 30 --nostream

# ดู process info
pm2 show etax-center
```

### 6.2 สิ่งสำคัญ

- PM2 รัน **`dist/index.cjs`** (compiled JS) — ต้อง `npm run build` หลังแก้ code
- `pm2 restart --update-env` อัพเดท PM2 env แต่ **ไม่ได้อ่าน .env file** — dotenv อ่าน .env ตอน Node start
- ถ้า PM2 crash loop: `pm2 delete etax-center && pm2 start npm --name etax-center -- run start`

---

## 7. 3-Pool Database Architecture

App ใช้ 3 connection pool แยกกัน:

| Pool | ชื่อใน code | ใช้กับ |
|------|-------------|--------|
| db | Main Pool | Accounting, HR, Users, Companies, Core |
| ecomDb | E-Commerce Pool | Orders, Products, Stores, Inventory |
| posDb | POS Pool | POS sessions, transactions |

ทั้ง 3 pool ชี้ไป database เดียวกัน (etax-production) แต่แยก pool เพื่อ isolation

---

## 8. DB Pool Failure Escalation

เมื่อ pool ล้มเหลวต่อเนื่อง ระบบจะ escalate:

```
1-19 failures → Log warning, retry ปกติ
20 failures   → Force process.exit(1) — PM2 restart อัตโนมัติ
```

ดู log: `[DB] CRITICAL: 20 consecutive pool failures — forcing process restart`

---

## 9. Machine Management (เซิร์ฟเวอร์ฐานข้อมูล)

### 9.1 การจัดกลุ่ม

| กลุ่ม | Server Types | ตัวอย่าง |
|-------|-------------|----------|
| ☁️ Dev/Cloud | cloud OS | Replit (Neon) |
| 📦 Database Servers | database type | server-e5, server-backup |
| 🖥️ App Servers | app type | etaxerp, linux-prod-01 |

### 9.2 .env Management

- เก็บ .env content ของแต่ละ App Server ไว้ใน DB (machines.envContent)
- แสดงบน card เป็น badge `.env X vars`
- แก้ไขได้ผ่าน edit form (terminal-style textarea)
- **ใส่เฉพาะ non-secret variables** — secrets อยู่ใน config DB

---

## 10. Troubleshooting

### App ไม่ start หลัง git pull

```bash
# ลืม build
npm run build
pm2 restart etax-center
```

### LAN Probe ไม่ทำงาน

1. เช็ค .env มี `DB_MAIN_LAN=true` (ไม่มี trailing space)
2. เช็ค config DB มี `DB_MAIN_LAN_URL`
3. ดู log: `[DB] LAN check: NODE_ENV=... DB_MAIN_LAN=...`

### Config Bootstrap ล้มเหลว

1. เช็ค local Postgres running: `pg_isready -p 15064`
2. เช็ค password: ต้องตรงกับที่ generate ไว้
3. เช็ค hostname: `hostname` command ต้องตรงกับ MACHINE_NAME
4. เช็ค MAC: ต้องตรงกับตอน generate config

### etaxerp เข้าไม่ได้

1. `pm2 status` — ดู status
2. `pm2 logs etax-center --err` — ดู error
3. เช็ค deep-main online: `ping 192.168.10.201` (LAN) หรือ `ping deep-main.hopto.org` (FQDN)
4. เช็ค port: `netstat -an | findstr 5000`

---

## 11. Security Checklist

- [ ] .env ไม่มี secret (password, connection string)
- [ ] Config DB password ไม่ซ้ำกับ password อื่น
- [ ] .enc file เก็บไว้เป็น backup ในที่ปลอดภัย
- [ ] GitHub repo เป็น private
- [ ] PM2 log ไม่แสดง password (URL ถูก mask เป็น `***`)

---

> **TODO (เพิ่มภายหลัง):**
> - Database Clone procedure
> - etaxerp with internal database
> - Backup & Recovery procedures
> - Server-backup failover
> - SSL/TLS configuration
> - Monitoring & Alerting setup
