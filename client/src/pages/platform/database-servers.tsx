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
  domainName: string | null;
  lanIp: string | null;
  wanIp: string | null;
  os: string;
  role: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const OS_CONFIG: Record<string, { icon: any; label: string; color: string; remoteAccess: boolean; cloneMethod: string }> = {
  windows: { icon: Monitor, label: "Windows", color: "text-blue-600 bg-blue-50 border-blue-200", remoteAccess: true, cloneMethod: "pg_dump → Remote psql" },
  linux: { icon: MonitorSmartphone, label: "Linux (aaPanel)", color: "text-orange-600 bg-orange-50 border-orange-200", remoteAccess: false, cloneMethod: "Standalone Clone Tool" },
  cloud: { icon: Cloud, label: "Cloud", color: "text-purple-600 bg-purple-50 border-purple-200", remoteAccess: true, cloneMethod: "pg_dump → Remote psql" },
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
  const OsIcon = osConfig.icon;

  return (
    <Card className={`border hover:shadow-md transition-shadow cursor-pointer ${osConfig.color}`} onClick={() => onEdit(machine)} data-testid={`card-machine-${machine.id}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <OsIcon className="h-5 w-5" />
            <span className="font-bold text-base">{machine.localName}</span>
          </div>
          <Badge className={`${roleConfig.bgColor} ${roleConfig.color} text-xs`}>
            {roleConfig.label}
          </Badge>
        </div>

        <div className="space-y-1.5 text-sm">
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
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Remote</span>
            <Badge variant="outline" className={osConfig.remoteAccess ? "text-green-600 border-green-300" : "text-red-500 border-red-300"}>
              {osConfig.remoteAccess ? "รับ Remote ได้" : "localhost เท่านั้น"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">วิธี Clone</span>
            <span className="text-xs font-medium text-gray-700">{osConfig.cloneMethod}</span>
          </div>
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
  const [form, setForm] = useState({
    localName: machine?.localName || "",
    domainName: machine?.domainName || "",
    lanIp: machine?.lanIp || "",
    wanIp: machine?.wanIp || "",
    os: machine?.os || "windows",
    role: machine?.role || "testing",
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
              <Label className="text-sm font-medium">ชื่อเครื่อง (Local Name) *</Label>
              <Input value={form.localName} onChange={e => setForm({ ...form, localName: e.target.value })} placeholder="เช่น server-e5" data-testid="input-local-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">Domain Name</Label>
              <Input value={form.domainName} onChange={e => setForm({ ...form, domainName: e.target.value })} placeholder="เช่น deep-main.hopto.org" data-testid="input-domain-name" />
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

          <div className="grid grid-cols-2 gap-4">
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
              <p className="text-xs text-gray-400 mt-1">
                {form.os === "windows" && "→ รับ Remote Connection ได้"}
                {form.os === "linux" && "→ localhost เท่านั้น — ต้องใช้ Standalone Clone Tool"}
                {form.os === "cloud" && "→ รับ Remote Connection ได้"}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">บทบาท (Role) *</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev_source">Dev Source — ต้นทาง (Dev)</SelectItem>
                  <SelectItem value="production">Production — ใช้งานจริง</SelectItem>
                  <SelectItem value="testing">Testing — ทดสอบ</SelectItem>
                  <SelectItem value="backup">Backup — สำรองข้อมูล</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">การเชื่อมต่อฐานข้อมูล</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Port</Label>
                <Input value={form.dbPort} onChange={e => setForm({ ...form, dbPort: e.target.value })} placeholder="5432" data-testid="input-db-port" />
              </div>
              <div>
                <Label className="text-sm font-medium">Database Name</Label>
                <Input value={form.dbName} onChange={e => setForm({ ...form, dbName: e.target.value })} placeholder="เช่น db_rp_pdt" data-testid="input-db-name" />
              </div>
              <div>
                <Label className="text-sm font-medium">Username</Label>
                <Input value={form.dbUser} onChange={e => setForm({ ...form, dbUser: e.target.value })} placeholder="เช่น replit_pdt" data-testid="input-db-user" />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-sm font-medium">Password</Label>
              <Input type="password" value={form.dbPassword} onChange={e => setForm({ ...form, dbPassword: e.target.value })} placeholder="รหัสผ่าน" data-testid="input-db-password" />
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

function EncryptionKeyGenerator() {
  const { toast } = useToast();
  const [hostname, setHostname] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [configDbPort, setConfigDbPort] = useState("5432");
  const [configDbName, setConfigDbName] = useState("etax_config");
  const [result, setResult] = useState<{
    configDbUser: string;
    configDbPassword: string;
    encryptedContent: string;
    keyPreview: string;
  } | null>(null);

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/machines/generate-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname, macAddress, configDbPort, configDbName }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ title: "สร้าง Encryption Key สำเร็จ" });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const testDecryptMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/machines/test-decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname, macAddress, encryptedContent: result?.encryptedContent }),
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
    if (!result) return;
    const blob = new Blob([result.encryptedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etax-config-${hostname.replace(/[^a-zA-Z0-9]/g, "_")}.enc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2 border-amber-200 bg-amber-50/30" data-testid="card-encryption-generator">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          สร้าง Encryption Key สำหรับเครื่องเป้าหมาย
        </CardTitle>
        <p className="text-xs text-gray-500">
          กรอก hostname + MAC address ของเครื่องปลายทาง → ระบบจะสร้าง encrypted config file
          ที่ decrypt ได้เฉพาะบนเครื่องนั้นเท่านั้น
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Hostname ของเครื่องเป้าหมาย *</Label>
            <Input
              value={hostname}
              onChange={e => setHostname(e.target.value)}
              placeholder="เช่น server-e5, linux-prod-01"
              data-testid="input-enc-hostname"
            />
            <p className="text-xs text-gray-400 mt-1">Windows: Computer Name / Linux: hostname command</p>
          </div>
          <div>
            <Label className="text-sm font-medium">MAC Address ของเครื่องเป้าหมาย *</Label>
            <Input
              value={macAddress}
              onChange={e => setMacAddress(e.target.value)}
              placeholder="เช่น AA:BB:CC:DD:EE:FF"
              data-testid="input-enc-mac"
            />
            <p className="text-xs text-gray-400 mt-1">Windows: ipconfig /all / Linux: ip link show</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Config DB Port</Label>
            <Input value={configDbPort} onChange={e => setConfigDbPort(e.target.value)} placeholder="5432" data-testid="input-enc-port" />
          </div>
          <div>
            <Label className="text-sm font-medium">Config DB Name</Label>
            <Input value={configDbName} onChange={e => setConfigDbName(e.target.value)} placeholder="etax_config" data-testid="input-enc-dbname" />
          </div>
        </div>

        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white w-full"
          onClick={() => generateMut.mutate()}
          disabled={!hostname || !macAddress || generateMut.isPending}
          data-testid="button-generate-key"
        >
          <Key className="h-4 w-4 mr-2" />
          {generateMut.isPending ? "กำลังสร้าง..." : "สร้าง Encryption Key + Config File"}
        </Button>

        {result && (
          <div className="border-t pt-4 space-y-4">
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-bold text-green-700 flex items-center gap-2">
                <Lock className="h-4 w-4" /> ผลลัพธ์ — ข้อมูลสำหรับนำไปใช้บนเครื่องเป้าหมาย
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="text-xs text-gray-500">Config DB Username</span>
                    <p className="font-mono text-sm font-bold">{result.configDbUser}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.configDbUser, "Username")} data-testid="btn-copy-user">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="text-xs text-gray-500">Config DB Password</span>
                    <p className="font-mono text-sm font-bold">{result.configDbPassword}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.configDbPassword, "Password")} data-testid="btn-copy-password">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="text-xs text-gray-500">Encryption Key (preview)</span>
                    <p className="font-mono text-sm">{result.keyPreview}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <Label className="text-xs text-gray-500 mb-1">Encrypted Config File Content</Label>
                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs break-all max-h-24 overflow-y-auto">
                  {result.encryptedContent}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={downloadConfigFile} data-testid="btn-download-config">
                  <Download className="h-4 w-4 mr-1" /> ดาวน์โหลด .enc file
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => copyToClipboard(result.encryptedContent, "Encrypted Content")} data-testid="btn-copy-encrypted">
                  <Copy className="h-4 w-4 mr-1" /> คัดลอก
                </Button>
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

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
                <p className="font-bold">ขั้นตอนการติดตั้งบนเครื่องเป้าหมาย:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>สร้าง PostgreSQL user: <code className="bg-blue-100 px-1 rounded">{result.configDbUser}</code> ด้วย password ข้างบน</li>
                  <li>สร้าง database: <code className="bg-blue-100 px-1 rounded">{configDbName}</code></li>
                  <li>วาง .enc file ไว้ที่ <code className="bg-blue-100 px-1 rounded">./config/etax-config.enc</code></li>
                  <li>ตั้ง <code className="bg-blue-100 px-1 rounded">MACHINE_NAME={hostname}</code> ใน .env</li>
                  <li>App จะ decrypt อัตโนมัติตอน startup</li>
                </ol>
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
          <EncryptionKeyGenerator />
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
