# คู่มือการติดตั้ง E-Tax Center
## วิธีติดตั้งระบบ E-Tax Center บนเครื่องของคุณ

---

## สิ่งที่ต้องเตรียม (Prerequisites)

1. **Node.js** เวอร์ชัน 20 ขึ้นไป
   - ดาวน์โหลด: https://nodejs.org/
   - ตรวจสอบ: เปิด Terminal แล้วพิมพ์ `node --version`

2. **PostgreSQL** เวอร์ชัน 14 ขึ้นไป
   - ดาวน์โหลด: https://www.postgresql.org/download/
   - หรือใช้ผ่าน Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16`

3. **Git** (ถ้าต้องการ clone จาก repository)
   - ดาวน์โหลด: https://git-scm.com/

---

## ขั้นตอนการติดตั้ง

### ขั้นตอนที่ 1: แตกไฟล์โค้ด
แตกไฟล์ `etax-center-source.zip` ไปยังโฟลเดอร์ที่ต้องการ

### ขั้นตอนที่ 2: เปิด Terminal
เปิด Terminal (Command Prompt / PowerShell / Terminal) แล้วเข้าไปที่โฟลเดอร์โปรเจค:
```bash
cd etax-center
```

### ขั้นตอนที่ 3: ติดตั้ง Dependencies
```bash
npm install
```
รอจนติดตั้งเสร็จ (อาจใช้เวลา 2-5 นาที)

### ขั้นตอนที่ 4: สร้างฐานข้อมูล PostgreSQL
เปิด pgAdmin หรือ Terminal แล้วสร้างฐานข้อมูลใหม่:
```sql
CREATE DATABASE etax_center;
```

### ขั้นตอนที่ 5: ตั้งค่า Environment Variables
สร้างไฟล์ `.env` ในโฟลเดอร์หลักของโปรเจค แล้วใส่ค่าเหล่านี้:
```env
# ฐานข้อมูล (แก้ไข username, password, host, port ตามที่ตั้งไว้)
DATABASE_URL=postgresql://username:password@localhost:5432/etax_center

# Session Secret (ใส่ค่าอะไรก็ได้ ยาวอย่างน้อย 32 ตัวอักษร)
SESSION_SECRET=your-super-secret-key-change-this-to-something-random

# LINE Messaging API (ถ้าต้องการใช้ฟีเจอร์ LINE)
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token

# Resend Email (ถ้าต้องการใช้ฟีเจอร์ส่งอีเมล)
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### ขั้นตอนที่ 6: สร้างตารางในฐานข้อมูล
```bash
npm run db:push
```
คำสั่งนี้จะสร้างตารางทั้งหมดในฐานข้อมูลให้อัตโนมัติ

### ขั้นตอนที่ 7: เริ่มใช้งาน (Development Mode)
```bash
npm run dev
```
เปิดเบราว์เซอร์แล้วไปที่: **http://localhost:5000**

---

## การ Build สำหรับ Production

### Build โปรเจค
```bash
npm run build
```

### รันใน Production Mode
```bash
npm start
```

---

## บัญชีเริ่มต้น (Default Login)

เมื่อเปิดระบบครั้งแรก ให้สมัครสมาชิกผ่านหน้า Register:
- ไปที่ http://localhost:5000
- กดปุ่ม "สมัครสมาชิก" หรือ "Register"
- กรอกข้อมูลบริษัทและผู้ใช้งาน
- บัญชีแรกที่สร้างจะเป็น Admin อัตโนมัติ

---

## โครงสร้างโปรเจค

```
etax-center/
├── client/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/       # หน้าต่างๆ ของระบบ
│   │   ├── components/  # คอมโพเนนท์ที่ใช้ซ้ำ
│   │   ├── hooks/       # React Hooks
│   │   └── lib/         # Utility functions
│   └── public/          # ไฟล์ Static
├── server/              # Backend (Express.js)
│   ├── routes.ts        # API Routes
│   ├── storage.ts       # Database Operations
│   └── index.ts         # Server Entry Point
├── shared/              # โค้ดที่ใช้ร่วมกัน
│   └── schema.ts        # Database Schema (Drizzle ORM)
├── package.json         # Dependencies
└── drizzle.config.ts    # Database Configuration
```

---

## การแก้ปัญหาเบื้องต้น (Troubleshooting)

### 1. ติดตั้ง npm install แล้ว Error
- ตรวจสอบเวอร์ชัน Node.js: `node --version` (ต้อง v20+)
- ลองลบ node_modules แล้วติดตั้งใหม่:
  ```bash
  rm -rf node_modules
  npm install
  ```

### 2. เชื่อมต่อฐานข้อมูลไม่ได้
- ตรวจสอบว่า PostgreSQL เปิดอยู่
- ตรวจสอบ DATABASE_URL ในไฟล์ .env ว่าถูกต้อง
- ทดสอบการเชื่อมต่อ: `psql "postgresql://username:password@localhost:5432/etax_center"`

### 3. Port 5000 ถูกใช้งานอยู่แล้ว
- บน Mac: `lsof -i :5000` แล้ว `kill -9 PID`
- บน Windows: `netstat -ano | findstr :5000` แล้ว `taskkill /PID xxxx /F`

### 4. หน้าเว็บขึ้นหน้าขาว
- เปิด Developer Tools (F12) ดู Console เพื่อตรวจสอบ Error
- ตรวจสอบว่า `npm run db:push` สำเร็จแล้ว

---

## ติดต่อสอบถาม
หากมีปัญหาในการติดตั้ง สามารถติดต่อได้ผ่านช่องทาง:
- Facebook Page
- LINE Official
- โทรศัพท์

---

*E-Tax Center - ระบบบัญชีดิจิทัลครบวงจร*
