import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Plus, Eye, EyeOff, Pencil, Trash2, Check, X,
  MonitorSmartphone, Cloud, Monitor, Wifi, WifiOff,
  ArrowRight, Database, Globe, MapPin, RefreshCw,
  Key, Shield, Copy, Download, Lock, Unlock,
} from "lucide-react";

interface MachineRecord {
  id: number;
  localName: string;
  windowsName: string | null;
  fqdn: string | null;
  domainName: string | null;
  lanIp: string | null;
  wanIp: string | null;
  os: string;
  serverType: string;
  role: string;
  cpuModel: string | null;
  ramSize: string | null;
  machineModel: string | null;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  notes: string | null;
  encHostname: string | null;
  encMacAddress: string | null;
  encConfigDbPort: string | null;
  encConfigDbName: string | null;
  encConfigDbUser: string | null;
  encConfigDbPassword: string | null;
  encContent: string | null;
  encGeneratedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const OS_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  windows: { icon: Monitor, label: "Windows", color: "text-blue-600 bg-blue-50 border-blue-200" },
  linux: { icon: MonitorSmartphone, label: "Linux (aaPanel)", color: "text-orange-600 bg-orange-50 border-orange-200" },
  cloud: { icon: Cloud, label: "Cloud", color: "text-purple-600 bg-purple-50 border-purple-200" },
};

const SERVER_TYPE_CONFIG: Record<string, { label: string; badge: string; badgeBg: string }> = {
  app: { label: "App Server", badge: "text-blue-700", badgeBg: "bg-blue-100" },
  database: { label: "Database Server", badge: "text-purple-700", badgeBg: "bg-purple-100" },
  app_database: { label: "App + Database", badge: "text-orange-700", badgeBg: "bg-orange-100" },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  dev_source: { label: "Dev Source", color: "text-cyan-700", bgColor: "bg-cyan-100" },
  production: { label: "Production", color: "text-green-700", bgColor: "bg-green-100" },
  testing: { label: "Testing", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  backup: { label: "Backup", color: "text-gray-700", bgColor: "bg-gray-100" },
};

function MachineCard({ machine, onEdit }: { machine: MachineRecord; onEdit: (m: MachineRecord) => void }) {
  const [showPw, setShowPw] = useState(false);
  const osConfig = OS_CONFIG[machine.os] || OS_CONFIG.linux;
  const roleConfig = ROLE_CONFIG[machine.role] || ROLE_CONFIG.testing;
  const serverTypeConfig = SERVER_TYPE_CONFIG[machine.serverType] || SERVER_TYPE_CONFIG.app_database;
  const OsIcon = osConfig.icon;

  return (
    <Card className={`border hover:shadow-md transition-shadow cursor-pointer ${osConfig.color}`} onClick={() => onEdit(machine)} data-testid={`card-machine-${machine.id}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <OsIcon className="h-5 w-5" />
            <span className="font-bold text-base">{machine.localName}</span>
          </div>
          <div className="flex gap-1">
            <Badge className={`${serverTypeConfig.badgeBg} ${serverTypeConfig.badge} text-xs`}>
              {serverTypeConfig.label}
            </Badge>
            <Badge className={`${roleConfig.bgColor} ${roleConfig.color} text-xs`}>
              {roleConfig.label}
            </Badge>
          </div>
        </div>

        {(machine.machineModel || machine.cpuModel || machine.ramSize) && (
          <div className="text-xs text-gray-500 space-y-0.5">
            {machine.machineModel && <div>{machine.machineModel}</div>}
            {machine.cpuModel && <div>CPU: {machine.cpuModel}</div>}
            {machine.ramSize && <div>RAM: {machine.ramSize}</div>}
          </div>
        )}

        <div className="space-y-1.5 text-sm">
          {machine.fqdn && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">FQDN</span>
              <span className="font-mono text-xs">{machine.fqdn}</span>
            </div>
          )}
          {machine.windowsName && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Windows Name</span>
              <span className="font-mono text-xs">{machine.windowsName}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1"><Globe className="h-3 w-3" /> Domain</span>
            <span className="font-mono text-xs">{machine.domainName || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> LAN</span>
            <span className="font-mono text-xs">{machine.lanIp || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1"><Wifi className="h-3 w-3" /> WAN</span>
            <span className="font-mono text-xs">{machine.wanIp || "—"}</span>
          </div>
        </div>

        <div className="border-t pt-2 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1"><Database className="h-3 w-3" /> DB</span>
            <span className="font-mono text-xs">{machine.dbName}:{machine.dbPort}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">User</span>
            <span className="font-mono text-xs">{machine.dbUser}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Password</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs">{showPw ? machine.dbPassword : "••••••••"}</span>
              <button onClick={e => { e.stopPropagation(); setShowPw(!showPw); }} className="p-0.5 hover:bg-gray-200 rounded" data-testid={`btn-toggle-pw-${machine.id}`}>
                {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t pt-2 space-y-1.5 text-sm">
        </div>

        {machine.notes && (
          <div className="border-t pt-2">
            <p className="text-xs text-gray-500 italic">{machine.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditMachineDialog({
  machine,
  onSave,
  onCancel,
  onDelete,
  saving,
}: {
  machine: MachineRecord | null;
  onSave: (m: Partial<MachineRecord> & { localName: string; dbName: string; dbUser: string; dbPassword: string }) => void;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  saving?: boolean;
}) {
  const isNew = !machine;
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [form, setForm] = useState({
    localName: machine?.localName || "",
    windowsName: machine?.windowsName || "",
    fqdn: machine?.fqdn || "",
    domainName: machine?.domainName || "",
    lanIp: machine?.lanIp || "",
    wanIp: machine?.wanIp || "",
    os: machine?.os || "windows",
    serverType: machine?.serverType || "app_database",
    role: machine?.role || "testing",
    cpuModel: machine?.cpuModel || "",
    ramSize: machine?.ramSize || "",
    machineModel: machine?.machineModel || "",
    dbPort: machine?.dbPort || "5432",
    dbName: machine?.dbName || "",
    dbUser: machine?.dbUser || "",
    dbPassword: machine?.dbPassword || "",
    notes: machine?.notes || "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-edit-machine">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">{isNew ? "เพิ่มเครื่องใหม่" : `แก้ไข: ${machine.localName}`}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ชื่อเครื่อง (ชื่อเรียก) *</Label>
              <Input value={form.localName} onChange={e => setForm({ ...form, localName: e.target.value })} placeholder="เช่น server-e5, etaxerp" data-testid="input-local-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">Domain Name</Label>
              <Input value={form.domainName} onChange={e => setForm({ ...form, domainName: e.target.value })} placeholder="เช่น deep-main.hopto.org" data-testid="input-domain-name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Windows Computer Name</Label>
              <Input value={form.windowsName} onChange={e => setForm({ ...form, windowsName: e.target.value })} placeholder="เช่น ETAXERP-PC (จาก hostname command)" data-testid="input-windows-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">FQDN</Label>
              <Input value={form.fqdn} onChange={e => setForm({ ...form, fqdn: e.target.value })} placeholder="เช่น etaxerp.com" data-testid="input-fqdn" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">LAN IP</Label>
              <Input value={form.lanIp} onChange={e => setForm({ ...form, lanIp: e.target.value })} placeholder="เช่น 192.168.1.100" data-testid="input-lan-ip" />
            </div>
            <div>
              <Label className="text-sm font-medium">WAN IP</Label>
              <Input value={form.wanIp} onChange={e => setForm({ ...form, wanIp: e.target.value })} placeholder="เช่น 184.82.211.214" data-testid="input-wan-ip" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">ข้อมูลฮาร์ดแวร์</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">รุ่นเครื่อง / Make & Model</Label>
                <Input value={form.machineModel} onChange={e => setForm({ ...form, machineModel: e.target.value })} placeholder="เช่น Dell OptiPlex 7060" data-testid="input-machine-model" />
              </div>
              <div>
                <Label className="text-sm font-medium">CPU</Label>
                <Input value={form.cpuModel} onChange={e => setForm({ ...form, cpuModel: e.target.value })} placeholder="เช่น Xeon E3-1280 V2 @3.6GHz" data-testid="input-cpu-model" />
              </div>
              <div>
                <Label className="text-sm font-medium">RAM</Label>
                <Input value={form.ramSize} onChange={e => setForm({ ...form, ramSize: e.target.value })} placeholder="เช่น 32GB DDR3" data-testid="input-ram-size" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">ระบบปฏิบัติการ *</Label>
              <Select value={form.os} onValueChange={(v: any) => setForm({ ...form, os: v })}>
                <SelectTrigger data-testid="select-os"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="linux">Linux</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">ประเภท *</Label>
              <Select value={form.serverType} onValueChange={(v: any) => setForm({ ...form, serverType: v })}>
                <SelectTrigger data-testid="select-server-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">App Server</SelectItem>
                  <SelectItem value="database">Database Server</SelectItem>
                  <SelectItem value="app_database">App + Database</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">บทบาท (Role) *</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev_source">Dev Source</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Local Config Database (ฐานข้อมูล config บนเครื่องนี้)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Port</Label>
                <Input value={form.dbPort} onChange={e => setForm({ ...form, dbPort: e.target.value })} placeholder="5432" data-testid="input-db-port" />
              </div>
              <div>
                <Label className="text-sm font-medium">Database Name</Label>
                <Input className="font-mono" value={form.dbName} onChange={e => setForm({ ...form, dbName: e.target.value })} placeholder="เช่น db_rp_pdt" data-testid="input-db-name" />
              </div>
              <div>
                <Label className="text-sm font-medium">Username</Label>
                <Input className="font-mono" value={form.dbUser} onChange={e => setForm({ ...form, dbUser: e.target.value })} placeholder="เช่น replit_pdt" data-testid="input-db-user" />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-sm font-medium">Password</Label>
              <div className="flex gap-2">
                <Input className="font-mono flex-1" type={showDbPassword ? "text" : "password"} value={form.dbPassword} onChange={e => setForm({ ...form, dbPassword: e.target.value })} placeholder="รหัสผ่าน" data-testid="input-db-password" />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowDbPassword(!showDbPassword)} data-testid="btn-toggle-password">
                  {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ข้อมูลเพิ่มเติม เช่น spec เครื่อง, เวลาที่ online" data-testid="input-notes" />
          </div>
        </div>

        <div className="p-6 border-t flex items-center justify-between">
          <div>
            {!isNew && onDelete && (
              <Button variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onDelete(machine.id)} data-testid="button-delete-machine">
                <Trash2 className="h-4 w-4 mr-1" /> ลบเครื่องนี้
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-edit">
              <X className="h-4 w-4 mr-1" /> ยกเลิก
            </Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => onSave(form)} disabled={saving} data-testid="button-save-machine">
              <Check className="h-4 w-4 mr-1" /> {saving ? "กำลังบันทึก..." : isNew ? "เพิ่มเครื่อง" : "บันทึก"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EncryptionKeyGenerator({ machines, onRefresh }: { machines: MachineRecord[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [hostname, setHostname] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [configDbPort, setConfigDbPort] = useState("");
  const [configDbName, setConfigDbName] = useState("etaxcfg");
  const appMachines = machines.filter(m => (m.serverType === "app" || m.serverType === "app_database") && (m.role === "production" || m.role === "staging" || m.role === "testing"));
  const selectedMachine = appMachines.find(m => String(m.id) === selectedMachineId);
  const saved = selectedMachine?.encContent ? selectedMachine : null;
  const prodMachine = machines.find(m => m.role === "production");
  const prodDbUrl = prodMachine
    ? `postgresql://${prodMachine.dbUser}:${encodeURIComponent(prodMachine.dbPassword)}@${prodMachine.domainName || prodMachine.lanIp || "localhost"}:${prodMachine.dbPort}/${prodMachine.dbName}`
    : null;
  const [result, setResult] = useState<{
    configDbUser: string;
    configDbPassword: string;
    encryptedContent: string;
    keyPreview: string;
  } | null>(null);

  const activeData = result ? {
    configDbUser: result.configDbUser,
    configDbPassword: result.configDbPassword,
    encryptedContent: result.encryptedContent,
    configDbName: configDbName,
    hostname: hostname,
    configDbPort: configDbPort,
  } : saved ? {
    configDbUser: saved.encConfigDbUser!,
    configDbPassword: saved.encConfigDbPassword!,
    encryptedContent: saved.encContent!,
    configDbName: saved.encConfigDbName || "etaxcfg",
    hostname: saved.encHostname || "",
    configDbPort: saved.encConfigDbPort || "",
  } : null;

  const handleSelectMachine = (id: string) => {
    setSelectedMachineId(id);
    setResult(null);
    const m = appMachines.find(mc => String(mc.id) === id);
    if (m) {
      if (m.encHostname) setHostname(m.encHostname);
      else if (m.fqdn) setHostname(m.fqdn);
      else if (m.windowsName) setHostname(m.windowsName);
      else setHostname("");
      setMacAddress(m.encMacAddress || "");
      setConfigDbPort(m.encConfigDbPort || "");
      setConfigDbName(m.encConfigDbName || "etaxcfg");
    }
  };

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/machines/generate-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname, macAddress, configDbPort, configDbName, machineId: selectedMachineId || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      onRefresh();
      toast({ title: "สร้าง Encryption Key สำเร็จ", description: selectedMachine ? `บันทึกไว้ที่เครื่อง ${selectedMachine.localName}` : undefined });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const testDecryptMut = useMutation({
    mutationFn: async () => {
      const enc = activeData?.encryptedContent;
      const res = await fetch("/api/platform/machines/test-decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: activeData?.hostname || hostname, macAddress, dbPort: activeData?.configDbPort || configDbPort, encryptedContent: enc }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ทดสอบ Decrypt สำเร็จ", description: "Hostname + MAC ถูกต้อง" });
    },
    onError: (err: any) => {
      toast({ title: "Decrypt ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `คัดลอก ${label} แล้ว` });
  };

  const downloadConfigFile = () => {
    const enc = activeData?.encryptedContent;
    if (!enc) return;
    const blob = new Blob([enc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "etax-config.enc";
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildSqlStep1 = (d: typeof activeData) => {
    if (!d) return "";
    return `-- เปิด Command Prompt (Run as Administrator) แล้วรัน:
"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" -U postgres -p ${d.configDbPort}

-- รันคำสั่งนี้ใน psql:
CREATE USER ${d.configDbUser} WITH PASSWORD '${d.configDbPassword}';
CREATE DATABASE ${d.configDbName} OWNER ${d.configDbUser};`;
  };

  const buildSqlStep2 = (d: typeof activeData) => {
    if (!d) return "";
    return `-- เชื่อมต่อไปที่ config database:
\\c ${d.configDbName}

-- สร้าง table:
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value TEXT NOT NULL DEFAULT '',
  description TEXT,
  environment VARCHAR(50) DEFAULT 'all',
  is_secret BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${d.configDbUser};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${d.configDbUser};`;
  };

  const buildSqlStep3 = (d: typeof activeData) => {
    if (!d) return "";
    const dbMainUrl = prodDbUrl || 'postgresql://USER:PASSWORD@deep-main.hopto.org:PORT/DATABASE';
    const prodLanIp = prodMachine?.lanIp;
    const dbMainLanUrl = prodLanIp && prodDbUrl
      ? prodDbUrl.replace(/(@)[^:]+(:)/, `$1${prodLanIp}$2`)
      : 'postgresql://USER:PASSWORD@LAN_IP:PORT/DATABASE';
    return `-- ใส่ค่า config ทั้งหมด (DB + LAN + reCAPTCHA + version):
INSERT INTO system_config (config_key, config_value, description, environment, is_secret) VALUES
('DB_MAIN_URL', '${dbMainUrl}', 'Main database connection (FQDN)', 'production', true),
('DB_MAIN_LAN_URL', '${dbMainLanUrl}', 'Main database connection (LAN IP) — ใช้เมื่อ .env DB_MAIN_LAN=true', 'production', true),
('RECAPTCHA_SITE_KEY', 'YOUR_RECAPTCHA_SITE_KEY', 'reCAPTCHA v2 site key', 'all', false),
('RECAPTCHA_SECRET_KEY', 'YOUR_RECAPTCHA_SECRET_KEY', 'reCAPTCHA v2 secret key', 'all', true),
('APP_VERSION', '1.0.0', 'Application version', 'all', false)
ON CONFLICT (config_key) DO NOTHING;

-- อย่าลืมแก้ค่า YOUR_RECAPTCHA_SITE_KEY และ YOUR_RECAPTCHA_SECRET_KEY ให้ถูกต้อง
-- DB_MAIN_LAN_URL ใช้คู่กับ .env DB_MAIN_LAN=true (ดาบสองคม — ดูคู่มือ)`;
  };

  const buildSqlStep4 = (d: typeof activeData) => {
    if (!d) return "";
    const dbServerName = machines.find(m => m.role === "production" && (m.serverType === "database" || m.serverType === "app_database"))?.localName || "deep-main";
    return `-- ตั้ง Environment Variables ใน PM2 หรือ .env:
MACHINE_NAME=${d.hostname}
MACHINE_DB_PORT=${d.configDbPort}
DB_MAIN_HOST=${dbServerName}
-- (ถ้า app server อยู่ LAN เดียวกับ DB server — ดาบสองคม ดูคู่มือ):
-- DB_MAIN_LAN=true

-- วาง .enc file ไว้ที่:
-- C:\\GitApp\\etaxcenter\\config\\etax-config.enc
-- (ใช้ปุ่มดาวน์โหลดด้านบน)

-- ⚠️ DB_MAIN_HOST = ชื่อ DB server ที่กำลังชี้อยู่ (ไม่ใช่ secret)
--   ถ้าเปลี่ยน DB server (เช่น clone) ต้องแก้ค่านี้ด้วย
-- ⚠️ DB_MAIN_LAN=true (ถ้าเปิดใช้):
--   ถ้า LAN ต่อได้ → ใช้ LAN IP (เร็วกว่า)
--   ถ้า LAN ต่อไม่ได้ → fallback ไป FQDN อัตโนมัติ (ช้าขึ้น ~5 วินาที)
--   ดู log: logs/lan-probe.log บนเครื่อง app server`;
  };

  return (
    <Card className="border-2 border-amber-200 bg-amber-50/30" data-testid="card-encryption-generator">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          Encrypted Config — สร้างและจัดการ
        </CardTitle>
        <p className="text-xs text-gray-500">
          เลือกเครื่องเป้าหมาย → สร้าง encryption key → ข้อมูลจะบันทึกไว้ในฐานข้อมูล กลับมาดูได้ทุกเมื่อ
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">เลือกเครื่องเป้าหมาย *</Label>
          <Select value={selectedMachineId} onValueChange={handleSelectMachine}>
            <SelectTrigger data-testid="select-enc-machine">
              <SelectValue placeholder="เลือกเครื่อง..." />
            </SelectTrigger>
            <SelectContent>
              {appMachines.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.localName} ({m.role}) {m.encContent ? "— มี config แล้ว" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMachineId && (
          <>
            {saved && !result && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-3">
                <Lock className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-800">มี Encrypted Config อยู่แล้ว</p>
                  <p className="text-xs text-green-600">สร้างเมื่อ: {saved.encGeneratedAt ? new Date(saved.encGeneratedAt).toLocaleString("th-TH") : "ไม่ทราบ"} | Hostname: {saved.encHostname} | MAC: {saved.encMacAddress}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Hostname *</Label>
                <Input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="เช่น etaxerp.com" data-testid="input-enc-hostname" />
                <p className="text-xs text-gray-400 mt-1">Windows: Computer Name / Linux: hostname</p>
              </div>
              <div>
                <Label className="text-sm font-medium">MAC Address *</Label>
                <Input value={macAddress} onChange={e => setMacAddress(e.target.value)} placeholder="เช่น 90:B1:1C:A1:01:B5" data-testid="input-enc-mac" />
                <p className="text-xs text-gray-400 mt-1">Windows: ipconfig /all</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Config DB Port *</Label>
                <Input value={configDbPort} onChange={e => setConfigDbPort(e.target.value)} placeholder="ห้ามใช้ 5432" data-testid="input-enc-port" />
                <p className="text-xs text-red-400 mt-1">port เป็นส่วนหนึ่งของ Encryption Key</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Config DB Name</Label>
                <Input value={configDbName} onChange={e => setConfigDbName(e.target.value)} placeholder="etaxcfg" data-testid="input-enc-dbname" />
              </div>
            </div>

            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white w-full"
              onClick={() => generateMut.mutate()}
              disabled={!hostname || !macAddress || !configDbPort || generateMut.isPending}
              data-testid="button-generate-key"
            >
              <Key className="h-4 w-4 mr-2" />
              {generateMut.isPending ? "กำลังสร้าง..." : saved ? "สร้างใหม่ (ทับของเดิม)" : "สร้าง Encryption Key + Config File"}
            </Button>
          </>
        )}

        {activeData && (
          <div className="border-t pt-4 space-y-4">
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <h4 className="text-sm font-bold text-green-700 flex items-center gap-2">
                <Lock className="h-4 w-4" /> ข้อมูลสำหรับตั้งค่าบนเครื่องเป้าหมาย {selectedMachine ? `(${selectedMachine.localName})` : ""}
              </h4>

              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-amber-800">Step 1: สร้าง User + Database</h5>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700" onClick={() => copyToClipboard(buildSqlStep1(activeData), "Step 1 SQL")} data-testid="btn-copy-step1">
                    <Copy className="h-3 w-3 mr-1" /> คัดลอก
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs whitespace-pre-wrap">{buildSqlStep1(activeData)}</pre>
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-blue-800">Step 2: สร้าง Table + Permissions</h5>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-blue-400 text-blue-700" onClick={() => copyToClipboard(buildSqlStep2(activeData), "Step 2 SQL")} data-testid="btn-copy-step2">
                    <Copy className="h-3 w-3 mr-1" /> คัดลอก
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs whitespace-pre-wrap">{buildSqlStep2(activeData)}</pre>
              </div>

              <div className="bg-green-50 border border-green-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-green-800">Step 3: ใส่ค่า DB Connection</h5>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-green-400 text-green-700" onClick={() => copyToClipboard(buildSqlStep3(activeData), "Step 3 SQL")} data-testid="btn-copy-step3">
                    <Copy className="h-3 w-3 mr-1" /> คัดลอก
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs whitespace-pre-wrap">{buildSqlStep3(activeData)}</pre>
                {prodDbUrl && (
                  <p className="text-xs text-green-700 font-bold">✓ DB_MAIN_URL ถูกใส่อัตโนมัติจาก server: {prodMachine?.localName}</p>
                )}
              </div>

              <div className="bg-purple-50 border border-purple-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-purple-800">Step 4: วาง .enc file + ตั้ง ENV</h5>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-purple-400 text-purple-700" onClick={downloadConfigFile} data-testid="btn-download-config">
                      <Download className="h-3 w-3 mr-1" /> ดาวน์โหลด .enc
                    </Button>
                  </div>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs whitespace-pre-wrap">{buildSqlStep4(activeData)}</pre>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => testDecryptMut.mutate()}
                  disabled={testDecryptMut.isPending}
                  data-testid="btn-test-decrypt"
                >
                  <Unlock className="h-4 w-4 mr-1" /> {testDecryptMut.isPending ? "กำลังทดสอบ..." : "ทดสอบ Decrypt"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DatabaseServers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMachine, setEditingMachine] = useState<MachineRecord | null | undefined>(undefined);

  const { data: machines = [], isLoading } = useQuery<MachineRecord[]>({
    queryKey: ["/api/platform/machines"],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/platform/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      setEditingMachine(undefined);
      toast({ title: "เพิ่มเครื่องสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/platform/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      setEditingMachine(undefined);
      toast({ title: "บันทึกสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/machines/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      setEditingMachine(undefined);
      toast({ title: "ลบเครื่องสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    if (editingMachine === null) {
      createMut.mutate(data);
    } else if (editingMachine) {
      updateMut.mutate({ id: editingMachine.id, ...data });
    }
  };

  const devSource = machines.find(m => m.role === "dev_source");
  const prodMachines = machines.filter(m => m.role === "production");

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto" data-testid="page-database-servers">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="h-7 w-7 text-[#fb9678]" />
              เซิร์ฟเวอร์ฐานข้อมูล
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการเครื่องเซิร์ฟเวอร์ทั้งหมดที่ใช้ในระบบ</p>
          </div>
          <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => setEditingMachine(null)} data-testid="button-add-machine">
            <Plus className="h-4 w-4 mr-1" /> เพิ่มเครื่องใหม่
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-2 border-cyan-200 bg-cyan-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <Database className="h-5 w-5 text-cyan-700" />
                </div>
                <div>
                  <p className="text-xs text-cyan-600 font-medium">Dev Source (ต้นทาง Dev)</p>
                  <p className="text-lg font-bold text-cyan-900">{devSource?.localName || "— ยังไม่ได้กำหนด"}</p>
                </div>
                {devSource && prodMachines.length > 0 && (
                  <div className="ml-auto flex items-center gap-2 text-gray-400">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Database className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Production (ใช้งานจริง)</p>
                  <p className="text-lg font-bold text-green-900">
                    {prodMachines.length > 0 ? prodMachines.map(m => m.localName).join(", ") : "— ยังไม่ได้กำหนด"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p>กำลังโหลดข้อมูลเครื่อง...</p>
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">ยังไม่มีเครื่องในระบบ</p>
            <p className="text-sm">กด "เพิ่มเครื่องใหม่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {machines.map(m => (
              <MachineCard key={m.id} machine={m} onEdit={setEditingMachine} />
            ))}
          </div>
        )}

        <div className="mt-8">
          <EncryptionKeyGenerator machines={machines} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] })} />
        </div>

        {editingMachine !== undefined && (
          <EditMachineDialog
            machine={editingMachine}
            onSave={handleSave}
            onCancel={() => setEditingMachine(undefined)}
            onDelete={(id) => deleteMut.mutate(id)}
            saving={createMut.isPending || updateMut.isPending}
          />
        )}
      </div>
    </PlatformLayout>
  );
}
