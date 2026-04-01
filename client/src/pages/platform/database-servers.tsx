import { useState } from "react";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Server, Plus, Eye, EyeOff, Pencil, Trash2, Check, X,
  MonitorSmartphone, Cloud, Monitor, Wifi, WifiOff,
  ArrowRight, Database, Globe, MapPin, RefreshCw,
} from "lucide-react";

interface MachineRecord {
  id: string;
  localName: string;
  domainName: string;
  lanIp: string;
  wanIp: string;
  os: "windows" | "linux" | "cloud";
  role: "dev_source" | "production" | "testing" | "backup";
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  notes: string;
}

const DEMO_MACHINES: MachineRecord[] = [
  {
    id: "1",
    localName: "Replit (Neon)",
    domainName: "—",
    lanIp: "—",
    wanIp: "—",
    os: "cloud",
    role: "dev_source",
    dbPort: "5432",
    dbName: "neondb",
    dbUser: "neondb_owner",
    dbPassword: "••••••••",
    notes: "Cloud database — always online",
  },
  {
    id: "2",
    localName: "server-e5",
    domainName: "deep-main.hopto.org",
    lanIp: "192.168.1.100",
    wanIp: "184.82.211.214",
    os: "windows",
    role: "production",
    dbPort: "5432",
    dbName: "db_rp_pdt",
    dbUser: "replit_pdt",
    dbPassword: "••••••••",
    notes: "Xeon E5-2660 v2, 32GB RAM, online 8:00-23:59 เวลาไทย",
  },
  {
    id: "3",
    localName: "linux-test-01",
    domainName: "—",
    lanIp: "192.168.1.201",
    wanIp: "—",
    os: "linux",
    role: "testing",
    dbPort: "5432",
    dbName: "etax_center",
    dbUser: "etaxuser",
    dbPassword: "••••••••",
    notes: "aaPanel — localhost only, ต้องใช้ Standalone Clone Tool",
  },
  {
    id: "4",
    localName: "linux-prod-01",
    domainName: "—",
    lanIp: "192.168.1.202",
    wanIp: "—",
    os: "linux",
    role: "production",
    dbPort: "5432",
    dbName: "etax_center",
    dbUser: "etaxuser",
    dbPassword: "••••••••",
    notes: "aaPanel — Final production destination, localhost only",
  },
  {
    id: "5",
    localName: "server-backup",
    domainName: "—",
    lanIp: "192.168.1.150",
    wanIp: "—",
    os: "windows",
    role: "backup",
    dbPort: "5432",
    dbName: "etax_backup",
    dbUser: "backup_user",
    dbPassword: "••••••••",
    notes: "Backup DB + History DB (read-only)",
  },
];

const OS_CONFIG = {
  windows: { label: "Windows", icon: Monitor, color: "bg-blue-100 text-blue-700", remoteAccess: true, cloneMethod: "Remote Clone" },
  linux: { label: "Linux", icon: MonitorSmartphone, color: "bg-orange-100 text-orange-700", remoteAccess: false, cloneMethod: "Standalone Clone Tool" },
  cloud: { label: "Cloud", icon: Cloud, color: "bg-purple-100 text-purple-700", remoteAccess: true, cloneMethod: "Remote Clone" },
};

const ROLE_CONFIG: Record<string, { label: string; thaiLabel: string; color: string }> = {
  dev_source: { label: "Dev Source", thaiLabel: "ต้นทาง (Dev)", color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  production: { label: "Production", thaiLabel: "ใช้งานจริง", color: "bg-green-100 text-green-700 border-green-300" },
  testing: { label: "Testing", thaiLabel: "ทดสอบ", color: "bg-amber-100 text-amber-700 border-amber-300" },
  backup: { label: "Backup", thaiLabel: "สำรองข้อมูล", color: "bg-gray-100 text-gray-600 border-gray-300" },
};

function MachineCard({ machine, onEdit }: { machine: MachineRecord; onEdit: (m: MachineRecord) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const osConfig = OS_CONFIG[machine.os];
  const roleConfig = ROLE_CONFIG[machine.role];
  const OsIcon = osConfig.icon;

  const isOnline = machine.os === "cloud";

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow" data-testid={`card-machine-${machine.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${osConfig.color}`}>
              <OsIcon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">{machine.localName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-xs ${roleConfig.color}`}>
                  {roleConfig.thaiLabel}
                </Badge>
                <Badge variant="outline" className={`text-xs ${osConfig.color}`}>
                  {osConfig.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isOnline ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? "Online" : "ยังไม่ได้ตรวจสอบ"}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(machine)} data-testid={`button-edit-machine-${machine.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Domain</span>
            <p className="font-mono text-sm mt-0.5">{machine.domainName}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> LAN IP</span>
            <p className="font-mono text-sm mt-0.5">{machine.lanIp}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> WAN IP</span>
            <p className="font-mono text-sm mt-0.5">{machine.wanIp}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs flex items-center gap-1"><Database className="h-3 w-3" /> Port</span>
            <p className="font-mono text-sm mt-0.5">{machine.dbPort}</p>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs">Database</span>
              <p className="font-mono text-sm mt-0.5">{machine.dbName}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">User</span>
              <p className="font-mono text-sm mt-0.5">{machine.dbUser}</p>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-gray-500 text-xs">Password</span>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="font-mono text-sm">{showPassword ? "actual_password" : "••••••••"}</p>
              <button onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Remote Connection</span>
            <Badge variant="outline" className={osConfig.remoteAccess ? "text-green-600 border-green-300" : "text-red-500 border-red-300"}>
              {osConfig.remoteAccess ? "รับ Remote ได้" : "localhost เท่านั้น"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">วิธี Clone</span>
            <span className="text-xs font-medium text-gray-700">{osConfig.cloneMethod}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Clone ล่าสุด</span>
            <span className="text-xs text-gray-400">— ยังไม่มีข้อมูล</span>
          </div>
        </div>

        {machine.notes && (
          <div className="border-t pt-3">
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
}: {
  machine: MachineRecord | null;
  onSave: (m: MachineRecord) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) {
  const isNew = !machine;
  const [form, setForm] = useState<MachineRecord>(
    machine || {
      id: Date.now().toString(),
      localName: "",
      domainName: "",
      lanIp: "",
      wanIp: "",
      os: "windows",
      role: "testing",
      dbPort: "5432",
      dbName: "",
      dbUser: "",
      dbPassword: "",
      notes: "",
    }
  );

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
            <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => onSave(form)} data-testid="button-save-machine">
              <Check className="h-4 w-4 mr-1" /> {isNew ? "เพิ่มเครื่อง" : "บันทึก"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DatabaseServers() {
  const [machines, setMachines] = useState<MachineRecord[]>(DEMO_MACHINES);
  const [editingMachine, setEditingMachine] = useState<MachineRecord | null | undefined>(undefined);

  const devSource = machines.find(m => m.role === "dev_source");
  const prodMachines = machines.filter(m => m.role === "production");

  const handleSave = (m: MachineRecord) => {
    setMachines(prev => {
      const idx = prev.findIndex(p => p.id === m.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = m;
        return updated;
      }
      return [...prev, m];
    });
    setEditingMachine(undefined);
  };

  const handleDelete = (id: string) => {
    setMachines(prev => prev.filter(m => m.id !== id));
    setEditingMachine(undefined);
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {machines.map(m => (
            <MachineCard key={m.id} machine={m} onEdit={setEditingMachine} />
          ))}
        </div>

        {editingMachine !== undefined && (
          <EditMachineDialog
            machine={editingMachine}
            onSave={handleSave}
            onCancel={() => setEditingMachine(undefined)}
            onDelete={handleDelete}
          />
        )}
      </div>
    </PlatformLayout>
  );
}