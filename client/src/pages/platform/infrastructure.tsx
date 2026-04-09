import { useState, useEffect } from "react";
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
  Key, Shield, Copy, Download, Lock, Unlock, History, AlertTriangle,
  ChevronDown, ChevronRight, Star, Network, Plug, Radio,
  Router, ExternalLink, Phone, Link2, ArrowRightLeft, Loader2,
  CheckCircle2, XCircle,
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
  appPort: string;
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
  envContent: string | null;
  isOfficial: boolean;
  targetDbMachineId: number | null;
  routerId: number | null;
  internetType: string;
  sysadminEmail: string | null;
  sysadminLineId: string | null;
  physicalLocation: string | null;
  locationId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LocationRecord {
  id: number;
  name: string;
  locationType: string;
  parentId: number | null;
  address: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RouterRecord {
  id: number;
  name: string;
  model: string | null;
  lanIp: string | null;
  adminUrl: string | null;
  adminUsername: string | null;
  adminPassword: string | null;
  wanIp: string | null;
  internetType: string;
  ispName: string | null;
  ispPackage: string | null;
  ispRegisteredCompany: string | null;
  ispAccountNumber: string | null;
  ispLinkId: string | null;
  ispCallCenter: string | null;
  ispSupportUrl: string | null;
  physicalLocation: string | null;
  locationId: number | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface NicRecord {
  id: number;
  machineId: number;
  nicName: string;
  macAddress: string | null;
  ipAddress: string;
  subnetMask: string;
  forwardedFor: string | null;
  forwardedPort: string | null;
  routerId: number | null;
  notes: string | null;
  createdAt?: string;
}

interface NicIpRecord {
  id: number;
  nicId: number;
  ipAddress: string;
  subnetMask: string;
  label: string | null;
  isPrimary: boolean;
  createdAt?: string;
}

interface PlatformDomainRecord {
  id: number;
  domainName: string;
  provider: string;
  manageUrl: string | null;
  username: string | null;
  password: string | null;
  routerId: number | null;
  isRouterManaged: boolean;
  machineId: number | null;
  purpose: string | null;
  port: number | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PortForwardRecord {
  id: number;
  routerId: number;
  externalPort: string;
  lanIp: string;
  internalPort: string | null;
  protocol: string;
  purpose: string | null;
  notes: string | null;
  createdAt?: string;
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function sameSubnet(ip1: string, ip2: string, mask1: string, mask2: string): boolean {
  const m1 = ipToInt(mask1);
  const m2 = ipToInt(mask2);
  if (m1 !== m2) return false;
  return (ipToInt(ip1) & m1) === (ipToInt(ip2) & m1);
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

function RouterCard({ router, domains, allNics, machines, portForwards, locations, expanded, onToggle, onEdit, onDelete, credentialsUnlocked }: {
  router: RouterRecord;
  domains: PlatformDomainRecord[];
  allNics: NicRecord[];
  machines: MachineRecord[];
  portForwards: PortForwardRecord[];
  locations: LocationRecord[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (r: RouterRecord) => void;
  onDelete: (id: number) => void;
  credentialsUnlocked: boolean;
}) {
  const [showAdminPw, setShowAdminPw] = useState(false);
  const connectedNics = allNics.filter(n => n.routerId === router.id);
  const connectedMachineIds = [...new Set(connectedNics.map(n => n.machineId))];
  const connectedMachines = machines.filter(m => connectedMachineIds.includes(m.id));
  const myDomains = domains.filter(d => d.routerId === router.id);
  const autoManagedDomain = myDomains.find(d => d.isRouterManaged);
  const myPortForwards = portForwards.filter(pf => pf.routerId === router.id);
  const routerLocation = router.locationId ? locations.find(l => l.id === router.locationId) : null;
  const routerLocationLabel = routerLocation
    ? (routerLocation.parentId ? (() => { const p = locations.find(l => l.id === routerLocation.parentId); return p ? `${p.name} > ${routerLocation.name}` : routerLocation.name; })() : routerLocation.name)
    : router.physicalLocation;

  return (
    <div className={`border rounded-lg transition-all border-teal-300 bg-teal-50/30 ${expanded ? "shadow-md" : "hover:shadow-sm"}`} data-testid={`card-router-${router.id}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left" data-testid={`btn-toggle-router-${router.id}`}>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        <Router className="h-4 w-4 text-teal-600 shrink-0" />
        <span className="font-bold text-sm text-teal-900 truncate">{router.name}</span>
        {router.lanIp && <span className="text-xs font-mono text-teal-600 hidden sm:inline">{router.lanIp}</span>}
        {router.ispName && <span className="text-xs text-gray-400 hidden sm:inline">({router.ispName})</span>}
        {autoManagedDomain && (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-300 text-[10px] px-1.5 py-0 font-mono hidden sm:flex items-center gap-0.5">
            <Globe className="h-2.5 w-2.5" /> {autoManagedDomain.domainName}
            <span className="text-[8px] text-indigo-400 ml-0.5">Auto</span>
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {myDomains.length > 0 && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300 text-[10px] px-1.5 py-0">
              <Globe className="h-2.5 w-2.5 mr-0.5" />{myDomains.length}
            </Badge>
          )}
          {connectedMachines.length > 0 && (
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px] px-1.5 py-0">
              <Server className="h-2.5 w-2.5 mr-0.5" />{connectedMachines.length}
            </Badge>
          )}
          <Badge className={`text-[10px] px-1.5 py-0 ${router.internetType === "fixed" ? "bg-green-500 text-white" : "bg-orange-400 text-white"}`}>
            {router.internetType === "fixed" ? "Fixed IP" : "Dynamic"}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-teal-200 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-400 text-xs block">LAN IP (Gateway)</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs font-bold text-teal-700">{router.lanIp || "—"}</span>
                {router.adminUrl && (
                  <a href={router.adminUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700" data-testid={`link-router-admin-${router.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">WAN IP</span>
              <span className="font-mono text-xs">{router.wanIp || "—"}</span>
            </div>
            {router.model && (
              <div>
                <span className="text-gray-400 text-xs block">รุ่น</span>
                <span className="text-xs">{router.model}</span>
              </div>
            )}
            {routerLocationLabel && (
              <div>
                <span className="text-gray-400 text-xs block">สถานที่ตั้ง</span>
                <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-red-400" />{routerLocationLabel}</span>
              </div>
            )}
          </div>

          {credentialsUnlocked && (router.adminUsername || router.adminPassword) && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded">
              <h5 className="text-[10px] font-semibold text-amber-700 mb-1 flex items-center gap-1"><Key className="h-3 w-3" /> Router Login</h5>
              <div className="flex items-center gap-4 text-xs">
                {router.adminUsername && <span>user: <span className="font-mono font-medium">{router.adminUsername}</span></span>}
                {router.adminPassword && (
                  <span className="flex items-center gap-1">
                    pw: <span className="font-mono">{showAdminPw ? router.adminPassword : "••••••"}</span>
                    <button onClick={e => { e.stopPropagation(); setShowAdminPw(!showAdminPw); }} className="p-0.5 hover:bg-amber-200 rounded">
                      {showAdminPw ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {(router.ispName || router.ispPackage) && (
            <div className="p-2 bg-white rounded border border-gray-200">
              <h5 className="text-[10px] font-semibold text-gray-500 mb-1">ISP Information</h5>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {router.ispName && <div><span className="text-gray-400">ISP:</span> <span className="font-medium">{router.ispName}</span></div>}
                {router.ispPackage && <div><span className="text-gray-400">แพ็กเกจ:</span> <span className="font-medium">{router.ispPackage}</span></div>}
                {router.ispRegisteredCompany && <div><span className="text-gray-400">ชื่อบริษัท:</span> <span>{router.ispRegisteredCompany}</span></div>}
                {router.ispAccountNumber && <div><span className="text-gray-400">เลขสัญญา:</span> <span className="font-mono">{router.ispAccountNumber}</span></div>}
                {router.ispLinkId && <div><span className="text-gray-400">Link ID:</span> <span className="font-mono">{router.ispLinkId}</span></div>}
                {router.ispCallCenter && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-green-500" />
                    <span className="font-medium">{router.ispCallCenter}</span>
                  </div>
                )}
                {router.ispSupportUrl && (
                  <div>
                    <a href={router.ispSupportUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                      <Link2 className="h-3 w-3" /> Support
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {myDomains.length > 0 && (
            <div className="p-2 bg-indigo-50/50 border border-indigo-200 rounded">
              <h5 className="text-[10px] font-semibold text-indigo-600 mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Domains ที่ใช้ WAN IP ของ Router นี้ ({myDomains.length})</h5>
              {autoManagedDomain && (
                <div className="flex items-center gap-2 mb-1.5 p-1.5 bg-indigo-100 border border-indigo-300 rounded text-xs">
                  <Router className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="font-mono font-bold text-indigo-800">{autoManagedDomain.domainName}</span>
                  <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0">Auto-Update</Badge>
                  <span className="text-[10px] text-indigo-500">Router อัพเดต WAN IP ให้อัตโนมัติ</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {myDomains.filter(d => !d.isRouterManaged).map(d => (
                  <Badge key={d.id} variant="outline" className="text-[10px] px-1.5 py-0.5 bg-white text-indigo-700 border-indigo-300">
                    {d.domainName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {connectedMachines.length > 0 && (
            <div className="p-2 bg-teal-50 border border-teal-200 rounded">
              <h5 className="text-[10px] font-semibold text-teal-700 mb-1 flex items-center gap-1"><Server className="h-3 w-3" /> เครื่องที่เชื่อมต่อผ่าน NIC ({connectedMachines.length})</h5>
              <div className="flex flex-wrap gap-1.5">
                {connectedMachines.map(m => (
                  <Badge key={m.id} variant="outline" className="bg-white text-teal-800 border-teal-300 text-[10px] px-1.5 py-0.5">
                    {m.localName}
                    {m.isOfficial && <Star className="h-2.5 w-2.5 ml-0.5 text-amber-400 fill-amber-300" />}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <PortForwardList routerId={router.id} portForwards={myPortForwards} machines={machines} />

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onEdit(router); }} data-testid={`btn-edit-router-${router.id}`}>
              <Pencil className="h-3 w-3 mr-1" /> แก้ไข
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50" onClick={e => { e.stopPropagation(); if (confirm(`ลบ Router "${router.name}"?`)) onDelete(router.id); }} data-testid={`btn-delete-router-${router.id}`}>
              <Trash2 className="h-3 w-3 mr-1" /> ลบ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PortForwardList({ routerId, portForwards, machines }: { routerId: number; portForwards: PortForwardRecord[]; machines: MachineRecord[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ externalPort: "", lanIp: "", internalPort: "", protocol: "TCP", purpose: "" });

  const addMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/platform/routers/${routerId}/port-forwards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-port-forwards"] }); setAdding(false); setForm({ externalPort: "", lanIp: "", internalPort: "", protocol: "TCP", purpose: "" }); toast({ title: "เพิ่ม Port Forward แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/port-forwards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-port-forwards"] }); toast({ title: "ลบ Port Forward แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const machineByIp = (ip: string) => {
    return machines.find(m => m.lanIp === ip);
  };

  return (
    <div className="p-2 bg-amber-50 border border-amber-200 rounded" data-testid={`port-forwards-router-${routerId}`}>
      <div className="flex items-center justify-between mb-1.5">
        <h5 className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
          <ArrowRightLeft className="h-3 w-3" /> Port Forwarding ({portForwards.length})
        </h5>
        <Button size="sm" variant="ghost" className="h-5 text-[10px] text-amber-700 hover:bg-amber-100 px-1.5" onClick={e => { e.stopPropagation(); setAdding(!adding); }} data-testid={`btn-add-portfwd-${routerId}`}>
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </Button>
      </div>

      {portForwards.length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          <div className="grid grid-cols-[80px_120px_80px_60px_1fr_28px] gap-1 text-[9px] font-semibold text-amber-600 px-1">
            <span>Ext. Port</span><span>LAN IP</span><span>Int. Port</span><span>Proto</span><span>Purpose</span><span></span>
          </div>
          {portForwards.map(pf => {
            const machine = machineByIp(pf.lanIp);
            return (
              <div key={pf.id} className="grid grid-cols-[80px_120px_80px_60px_1fr_28px] gap-1 items-center text-xs bg-white rounded px-1 py-0.5 border border-amber-100" data-testid={`row-portfwd-${pf.id}`}>
                <span className="font-mono font-bold text-amber-800">{pf.externalPort}</span>
                <span className="font-mono text-gray-700 flex items-center gap-1">
                  {pf.lanIp}
                  {machine && <Badge variant="outline" className="text-[8px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">{machine.localName}</Badge>}
                </span>
                <span className="font-mono text-gray-500">{pf.internalPort || pf.externalPort}</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">{pf.protocol}</Badge>
                <span className="text-gray-600 truncate">{pf.purpose || "—"}</span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={e => { e.stopPropagation(); if (confirm("ลบ Port Forward นี้?")) deleteMut.mutate(pf.id); }} data-testid={`btn-del-portfwd-${pf.id}`}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="bg-white border border-amber-200 rounded p-2 space-y-2" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-gray-500">External Port *</Label>
              <Input className="h-7 text-xs font-mono" placeholder="80 หรือ 440-450" value={form.externalPort} onChange={e => setForm({ ...form, externalPort: e.target.value })} data-testid={`input-pf-ext-port-${routerId}`} />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">LAN IP ปลายทาง *</Label>
              <Input className="h-7 text-xs font-mono" placeholder="192.168.1.100" value={form.lanIp} onChange={e => setForm({ ...form, lanIp: e.target.value })} data-testid={`input-pf-lanip-${routerId}`} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-gray-500">Internal Port (ถ้าต่างจาก Ext.)</Label>
              <Input className="h-7 text-xs font-mono" placeholder="เหมือน Ext." value={form.internalPort} onChange={e => setForm({ ...form, internalPort: e.target.value })} data-testid={`input-pf-int-port-${routerId}`} />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Protocol</Label>
              <Select value={form.protocol} onValueChange={v => setForm({ ...form, protocol: v })}>
                <SelectTrigger className="h-7 text-xs" data-testid={`select-pf-proto-${routerId}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                  <SelectItem value="TCP/UDP">TCP/UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Purpose</Label>
              <Input className="h-7 text-xs" placeholder="HTTP / HTTPS / DB" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} data-testid={`input-pf-purpose-${routerId}`} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" disabled={!form.externalPort || !form.lanIp || addMut.isPending} onClick={() => addMut.mutate(form)} data-testid={`btn-save-portfwd-${routerId}`}>
              {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} เพิ่ม
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRouterDialog({ router, locations, onSave, onCancel, saving }: { router: RouterRecord | null; locations: LocationRecord[]; onSave: (data: any) => void; onCancel: () => void; saving?: boolean }) {
  const isNew = !router;
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    name: router?.name || "",
    model: router?.model || "",
    lanIp: router?.lanIp || "",
    adminUrl: router?.adminUrl || "",
    adminUsername: router?.adminUsername || "",
    adminPassword: router?.adminPassword || "",
    wanIp: router?.wanIp || "",
    internetType: router?.internetType || "dynamic",
    ispName: router?.ispName || "",
    ispPackage: router?.ispPackage || "",
    ispRegisteredCompany: router?.ispRegisteredCompany || "",
    ispAccountNumber: router?.ispAccountNumber || "",
    ispLinkId: router?.ispLinkId || "",
    ispCallCenter: router?.ispCallCenter || "",
    ispSupportUrl: router?.ispSupportUrl || "",
    physicalLocation: router?.physicalLocation || "",
    locationId: router?.locationId ? String(router.locationId) : "",
    notes: router?.notes || "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-edit-router">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Router className="h-5 w-5 text-teal-600" />
            {isNew ? "เพิ่ม Router ใหม่" : `แก้ไข: ${router.name}`}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ชื่อ Router *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น Router บ้านพี่ช้าง" data-testid="input-router-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">รุ่น / Model</Label>
              <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="เช่น TP-Link ER7206" data-testid="input-router-model" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">LAN IP (Gateway)</Label>
              <Input className="font-mono" value={form.lanIp} onChange={e => setForm({ ...form, lanIp: e.target.value })} placeholder="192.168.1.1" data-testid="input-router-lan-ip" />
            </div>
            <div>
              <Label className="text-sm font-medium">Admin URL</Label>
              <Input className="font-mono" value={form.adminUrl} onChange={e => setForm({ ...form, adminUrl: e.target.value })} placeholder="http://192.168.1.1:8080" data-testid="input-router-admin-url" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Admin Username</Label>
              <Input className="font-mono" value={form.adminUsername} onChange={e => setForm({ ...form, adminUsername: e.target.value })} placeholder="admin" data-testid="input-router-admin-user" />
            </div>
            <div>
              <Label className="text-sm font-medium">Admin Password</Label>
              <div className="flex gap-2">
                <Input className="font-mono flex-1" type={showPw ? "text" : "password"} value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} data-testid="input-router-admin-password" />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">WAN IP</Label>
              <Input className="font-mono" value={form.wanIp} onChange={e => setForm({ ...form, wanIp: e.target.value })} placeholder="184.82.xxx.xxx" data-testid="input-router-wan-ip" />
            </div>
            <div>
              <Label className="text-sm font-medium">Internet Type</Label>
              <Select value={form.internetType} onValueChange={v => setForm({ ...form, internetType: v })}>
                <SelectTrigger data-testid="select-router-internet-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic IP (ใช้ DDNS)</SelectItem>
                  <SelectItem value="fixed">Fixed IP (คงที่)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">สถานที่ตั้ง (Location)</Label>
              <Select value={form.locationId || "none"} onValueChange={v => setForm({ ...form, locationId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-router-location"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                  {locations.filter(l => !l.parentId).map(parent => {
                    const children = locations.filter(c => c.parentId === parent.id);
                    return [
                      <SelectItem key={parent.id} value={String(parent.id)}>
                        {parent.name}
                      </SelectItem>,
                      ...children.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          &nbsp;&nbsp;└ {c.name}
                        </SelectItem>
                      )),
                    ];
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">หมายเหตุ</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-router-notes" />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">ข้อมูล ISP</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">ชื่อ ISP</Label>
                <Input value={form.ispName} onChange={e => setForm({ ...form, ispName: e.target.value })} placeholder="เช่น 3BB, TRUE, AIS" data-testid="input-isp-name" />
              </div>
              <div>
                <Label className="text-sm font-medium">แพ็กเกจ (Speed)</Label>
                <Input value={form.ispPackage} onChange={e => setForm({ ...form, ispPackage: e.target.value })} placeholder="เช่น 1000/500 Mbps" data-testid="input-isp-package" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label className="text-sm font-medium">จดในนามบริษัท</Label>
                <Input value={form.ispRegisteredCompany} onChange={e => setForm({ ...form, ispRegisteredCompany: e.target.value })} data-testid="input-isp-company" />
              </div>
              <div>
                <Label className="text-sm font-medium">เลขที่สัญญา / Account No.</Label>
                <Input className="font-mono" value={form.ispAccountNumber} onChange={e => setForm({ ...form, ispAccountNumber: e.target.value })} data-testid="input-isp-account" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <Label className="text-sm font-medium">Link ID</Label>
                <Input className="font-mono" value={form.ispLinkId} onChange={e => setForm({ ...form, ispLinkId: e.target.value })} placeholder="แจ้ง ISP เวลาโทรแจ้งเหตุ" data-testid="input-isp-link-id" />
              </div>
              <div>
                <Label className="text-sm font-medium">Call Center</Label>
                <Input value={form.ispCallCenter} onChange={e => setForm({ ...form, ispCallCenter: e.target.value })} placeholder="เช่น 1530" data-testid="input-isp-call-center" />
              </div>
              <div>
                <Label className="text-sm font-medium">Support URL</Label>
                <Input className="font-mono" value={form.ispSupportUrl} onChange={e => setForm({ ...form, ispSupportUrl: e.target.value })} placeholder="https://support.3bb.co.th" data-testid="input-isp-support-url" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-router">ยกเลิก</Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => onSave(form)} disabled={saving || !form.name} data-testid="button-save-router">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditLocationDialog({ location, allLocations, onSave, onCancel, saving }: {
  location: LocationRecord | null;
  allLocations: LocationRecord[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const isNew = !location;
  const [form, setForm] = useState({
    name: location?.name || "",
    locationType: location?.locationType || "company",
    parentId: location?.parentId ? String(location.parentId) : "",
    address: location?.address || "",
    notes: location?.notes || "",
  });

  const parentOptions = allLocations.filter(l => !l.parentId && l.id !== location?.id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-edit-location">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600" />
            {isNew ? "เพิ่ม Location ใหม่" : `แก้ไข: ${location.name}`}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-sm font-medium">ชื่อ Location *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="เช่น Deep Digital Co., Ltd." data-testid="input-loc-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ประเภท</Label>
              <Select value={form.locationType} onValueChange={v => setForm({ ...form, locationType: v, parentId: v === "company" ? "" : form.parentId })}>
                <SelectTrigger data-testid="select-loc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">บริษัท (Company)</SelectItem>
                  <SelectItem value="branch">สาขา (Branch)</SelectItem>
                  <SelectItem value="datacenter">Data Center</SelectItem>
                  <SelectItem value="home">บ้าน (Home)</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.locationType !== "company" && (
              <div>
                <Label className="text-sm font-medium">สังกัด (Parent)</Label>
                <Select value={form.parentId || "none"} onValueChange={v => setForm({ ...form, parentId: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-loc-parent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— ไม่มี Parent</SelectItem>
                    {parentOptions.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <Label className="text-sm font-medium">ที่อยู่</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="เช่น 123 ถ.สุขุมวิท แขวง..." data-testid="input-loc-address" />
          </div>
          <div>
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-loc-notes" />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-location">ยกเลิก</Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => onSave(form)} disabled={saving || !form.name} data-testid="button-save-location">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const PURPOSE_CONFIG: Record<string, { label: string; color: string }> = {
  app: { label: "App", color: "bg-blue-100 text-blue-700 border-blue-300" },
  db: { label: "Database", color: "bg-purple-100 text-purple-700 border-purple-300" },
  both: { label: "App + DB", color: "bg-orange-100 text-orange-700 border-orange-300" },
};

const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  noip: { label: "noIP", color: "text-green-700" },
  freedns: { label: "FreeDNS", color: "text-blue-700" },
  other: { label: "Other", color: "text-gray-700" },
};

function DomainCard({ domain, routers, machines, expanded, onToggle, onEdit, onDelete, credentialsUnlocked }: {
  domain: PlatformDomainRecord;
  routers: RouterRecord[];
  machines: MachineRecord[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (d: PlatformDomainRecord) => void;
  onDelete: (id: number) => void;
  credentialsUnlocked: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const linkedRouter = domain.routerId ? routers.find(r => r.id === domain.routerId) : null;
  const linkedMachine = domain.machineId ? machines.find(m => m.id === domain.machineId) : null;
  const purposeConfig = domain.purpose ? PURPOSE_CONFIG[domain.purpose] : null;
  const providerConfig = PROVIDER_CONFIG[domain.provider] || PROVIDER_CONFIG.other;

  return (
    <div className={`border rounded-lg transition-all border-indigo-300 bg-indigo-50/30 ${expanded ? "shadow-md" : "hover:shadow-sm"}`} data-testid={`card-domain-${domain.id}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left" data-testid={`btn-toggle-domain-${domain.id}`}>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        <Globe className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="font-bold text-sm text-indigo-900 font-mono truncate">{domain.domainName}</span>
        {domain.isRouterManaged && (
          <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0">
            <Router className="h-2.5 w-2.5 mr-0.5" /> Auto
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {purposeConfig && (
            <Badge variant="outline" className={`${purposeConfig.color} text-[10px] px-1.5 py-0`}>
              {purposeConfig.label}
            </Badge>
          )}
          {linkedRouter && (
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px] px-1.5 py-0">
              <Router className="h-2.5 w-2.5 mr-0.5" />{linkedRouter.name}
            </Badge>
          )}
          {linkedMachine && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-[10px] px-1.5 py-0">
              <Server className="h-2.5 w-2.5 mr-0.5" />{linkedMachine.localName}
            </Badge>
          )}
          <span className={`text-[10px] ${providerConfig.color}`}>{providerConfig.label}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-indigo-200 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-400 text-xs block">Provider</span>
              <span className={`text-xs font-medium ${providerConfig.color}`}>{providerConfig.label}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Purpose</span>
              <span className="text-xs">{purposeConfig ? purposeConfig.label : "ยังไม่กำหนด"}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Router ที่ตาม WAN IP</span>
              <span className="text-xs">{linkedRouter ? linkedRouter.name : "— ไม่ได้ผูก"}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">เครื่องที่ให้บริการ</span>
              <span className="text-xs">{linkedMachine ? linkedMachine.localName : "— ไม่ได้ผูก"}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Router Auto-Managed</span>
              <span className={`text-xs font-medium ${domain.isRouterManaged ? "text-indigo-600" : "text-gray-400"}`}>
                {domain.isRouterManaged ? "ใช่ — Router อัพเดตเอง" : "ไม่ — ต้องอัพเดตจากภายนอก"}
              </span>
            </div>
          </div>

          {credentialsUnlocked && (domain.username || domain.password || domain.manageUrl) && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded">
              <h5 className="text-[10px] font-semibold text-amber-700 mb-1 flex items-center gap-1"><Key className="h-3 w-3" /> Credentials</h5>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {domain.manageUrl && (
                  <a href={domain.manageUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                    <ExternalLink className="h-3 w-3" /> Manage
                  </a>
                )}
                {domain.username && <span>user: <span className="font-mono font-medium">{domain.username}</span></span>}
                {domain.password && (
                  <span className="flex items-center gap-1">
                    pw: <span className="font-mono">{showPw ? domain.password : "••••••"}</span>
                    <button onClick={e => { e.stopPropagation(); setShowPw(!showPw); }} className="p-0.5 hover:bg-amber-200 rounded">
                      {showPw ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {domain.notes && <p className="text-xs text-gray-400 italic">{domain.notes}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onEdit(domain); }} data-testid={`btn-edit-domain-${domain.id}`}>
              <Pencil className="h-3 w-3 mr-1" /> แก้ไข
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300 hover:bg-red-50" onClick={e => { e.stopPropagation(); if (confirm(`ลบ Domain "${domain.domainName}"?`)) onDelete(domain.id); }} data-testid={`btn-delete-domain-${domain.id}`}>
              <Trash2 className="h-3 w-3 mr-1" /> ลบ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditDomainDialog({ domain, routers, machines, onSave, onCancel, saving }: {
  domain: PlatformDomainRecord | null;
  routers: RouterRecord[];
  machines: MachineRecord[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const isNew = !domain;
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    domainName: domain?.domainName || "",
    provider: domain?.provider || "noip",
    manageUrl: domain?.manageUrl || "",
    username: domain?.username || "",
    password: domain?.password || "",
    routerId: domain?.routerId ? String(domain.routerId) : "",
    isRouterManaged: domain?.isRouterManaged || false,
    machineId: domain?.machineId ? String(domain.machineId) : "",
    purpose: domain?.purpose || "",
    notes: domain?.notes || "",
  });

  const handleSave = () => {
    onSave({
      ...form,
      routerId: form.routerId ? Number(form.routerId) : null,
      machineId: form.machineId ? Number(form.machineId) : null,
      purpose: form.purpose || null,
      manageUrl: form.manageUrl || null,
      username: form.username || null,
      password: form.password || null,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-edit-domain">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            {isNew ? "เพิ่ม Domain ใหม่" : `แก้ไข: ${domain.domainName}`}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Domain Name *</Label>
              <Input className="font-mono" value={form.domainName} onChange={e => setForm({ ...form, domainName: e.target.value })} placeholder="deep-main.hopto.org" data-testid="input-domain-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">Provider</Label>
              <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
                <SelectTrigger data-testid="select-domain-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="noip">noIP</SelectItem>
                  <SelectItem value="freedns">FreeDNS</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">ผูก WAN IP ของ Router</Label>
            <Select value={form.routerId || "none"} onValueChange={v => setForm({ ...form, routerId: v === "none" ? "" : v, isRouterManaged: v === "none" ? false : form.isRouterManaged })}>
              <SelectTrigger data-testid="select-domain-router"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ไม่ได้ผูก Router</SelectItem>
                {routers.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name} {r.wanIp ? `(WAN: ${r.wanIp})` : ""} {r.lanIp ? `• LAN: ${r.lanIp}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.routerId && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isRouterManaged} onChange={e => setForm({ ...form, isRouterManaged: e.target.checked })} className="rounded border-indigo-400" data-testid="check-router-managed" />
                <span className="font-medium text-indigo-800">Router อัพเดต Domain นี้เอง (Auto-Update WAN IP)</span>
              </label>
              <p className="text-[11px] text-indigo-500 mt-1 ml-6">เมื่อเปิด: Router จะอัพเดต WAN IP ของ Domain นี้อัตโนมัติ (1 Router มีได้แค่ 1 Auto Domain — ถ้าเลือกจะแทนที่ตัวเดิม)</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ให้บริการเครื่อง</Label>
              <Select value={form.machineId || "none"} onValueChange={v => setForm({ ...form, machineId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-domain-machine"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ได้ผูก</SelectItem>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.localName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Purpose</Label>
              <Select value={form.purpose || "none"} onValueChange={v => setForm({ ...form, purpose: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-domain-purpose"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                  <SelectItem value="app">App Server</SelectItem>
                  <SelectItem value="db">Database Server</SelectItem>
                  <SelectItem value="both">App + Database</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Manage URL</Label>
            <Input className="font-mono" value={form.manageUrl} onChange={e => setForm({ ...form, manageUrl: e.target.value })} placeholder="https://my.noip.com/..." data-testid="input-domain-manage-url" />
          </div>
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Login Credentials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Username</Label>
                <Input className="font-mono" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} data-testid="input-domain-username" />
              </div>
              <div>
                <Label className="text-sm font-medium">Password</Label>
                <div className="flex gap-2">
                  <Input className="font-mono flex-1" type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="input-domain-password" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-domain-notes" />
          </div>
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-domain">ยกเลิก</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saving || !form.domainName} data-testid="button-save-domain">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NicIpList({ nicId }: { nicId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: allNicIps = [] } = useQuery<NicIpRecord[]>({ queryKey: ["/api/platform/all-nic-ips"] });
  const myIps = allNicIps.filter(ip => ip.nicId === nicId);
  const [adding, setAdding] = useState(false);
  const [ipForm, setIpForm] = useState({ ipAddress: "", subnetMask: "255.255.255.0", label: "", isPrimary: false });

  const addIpMut = useMutation({
    mutationFn: async (data: typeof ipForm) => {
      const res = await fetch(`/api/platform/nics/${nicId}/ips`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nic-ips"] }); setAdding(false); setIpForm({ ipAddress: "", subnetMask: "255.255.255.0", label: "", isPrimary: false }); toast({ title: "เพิ่ม IP แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteIpMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/nic-ips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nic-ips"] }); toast({ title: "ลบ IP แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const togglePrimaryMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/nic-ips/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrimary: true }) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nic-ips"] }); toast({ title: "ตั้งเป็น Primary IP แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="ml-6 pl-3 border-l-2 border-blue-200 space-y-1 py-1" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-blue-600">Additional IPs ({myIps.length})</span>
        <button className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5" onClick={() => setAdding(!adding)} data-testid={`btn-add-ip-${nicId}`}>
          <Plus className="h-2.5 w-2.5" /> เพิ่ม IP
        </button>
      </div>
      {myIps.map(ip => (
        <div key={ip.id} className="flex items-center gap-2 text-[11px] group/ip py-0.5" data-testid={`nic-ip-row-${ip.id}`}>
          <span className={`font-mono ${ip.isPrimary ? "text-blue-700 font-bold" : "text-gray-600"}`}>{ip.ipAddress}</span>
          <span className="font-mono text-gray-400 text-[10px]">/{ip.subnetMask}</span>
          {ip.isPrimary && (
            <Badge className="bg-blue-600 text-white text-[9px] px-1 py-0">Primary</Badge>
          )}
          {ip.label && <span className="text-gray-400 text-[10px] italic">{ip.label}</span>}
          {!ip.isPrimary && (
            <button onClick={() => togglePrimaryMut.mutate(ip.id)} className="opacity-0 group-hover/ip:opacity-100 text-[10px] text-blue-400 hover:text-blue-600 transition-opacity" data-testid={`btn-set-primary-${ip.id}`}>
              set primary
            </button>
          )}
          <button onClick={() => { if (confirm("ลบ IP นี้?")) deleteIpMut.mutate(ip.id); }} className="opacity-0 group-hover/ip:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-400 transition-opacity ml-auto" data-testid={`btn-delete-ip-${ip.id}`}>
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
      {adding && (
        <div className="flex items-end gap-1.5 flex-wrap py-1" onClick={e => e.stopPropagation()}>
          <div>
            <Label className="text-[9px] text-gray-400">IP *</Label>
            <Input className="h-6 text-[11px] font-mono w-32" placeholder="192.168.1.101" value={ipForm.ipAddress} onChange={e => setIpForm({ ...ipForm, ipAddress: e.target.value })} data-testid={`input-extra-ip-${nicId}`} />
          </div>
          <div>
            <Label className="text-[9px] text-gray-400">Subnet</Label>
            <Input className="h-6 text-[11px] font-mono w-32" placeholder="255.255.255.0" value={ipForm.subnetMask} onChange={e => setIpForm({ ...ipForm, subnetMask: e.target.value })} data-testid={`input-extra-subnet-${nicId}`} />
          </div>
          <div>
            <Label className="text-[9px] text-gray-400">Label</Label>
            <Input className="h-6 text-[11px] w-24" placeholder="VIP, VLAN" value={ipForm.label} onChange={e => setIpForm({ ...ipForm, label: e.target.value })} data-testid={`input-extra-label-${nicId}`} />
          </div>
          <label className="flex items-center gap-1 text-[10px] text-gray-500 pb-0.5">
            <input type="checkbox" checked={ipForm.isPrimary} onChange={e => setIpForm({ ...ipForm, isPrimary: e.target.checked })} className="rounded h-3 w-3" />
            Primary
          </label>
          <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700" onClick={() => addIpMut.mutate(ipForm)} disabled={!ipForm.ipAddress} data-testid={`btn-save-ip-${nicId}`}>
            <Check className="h-2.5 w-2.5 mr-0.5" /> เพิ่ม
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setAdding(false)}>ยกเลิก</Button>
        </div>
      )}
    </div>
  );
}

function NicSection({ machineId, allNics, allMachines, allRouters }: { machineId: number; allNics: NicRecord[]; allMachines: MachineRecord[]; allRouters: RouterRecord[] }) {
  const [adding, setAdding] = useState(false);
  const [expandedNicId, setExpandedNicId] = useState<number | null>(null);
  const [form, setForm] = useState({ nicName: "", macAddress: "", ipAddress: "", subnetMask: "255.255.255.0", forwardedFor: "", forwardedPort: "", routerId: "", notes: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const myNics = allNics.filter(n => n.machineId === machineId);
  const otherNics = allNics.filter(n => n.machineId !== machineId);
  const { data: allNicIps = [] } = useQuery<NicIpRecord[]>({ queryKey: ["/api/platform/all-nic-ips"] });

  const getAllIpsForNic = (nic: NicRecord): { ip: string; mask: string }[] => {
    const ips: { ip: string; mask: string }[] = [{ ip: nic.ipAddress, mask: nic.subnetMask }];
    const extras = allNicIps.filter(x => x.nicId === nic.id);
    for (const extra of extras) {
      ips.push({ ip: extra.ipAddress, mask: extra.subnetMask });
    }
    return ips;
  };

  const lanPeers = new Map<number, { machineName: string; viaIp: string; peerIp: string; viaAdditionalIp: boolean }>();
  for (const myNic of myNics) {
    const myIps = getAllIpsForNic(myNic);
    for (const otherNic of otherNics) {
      if (lanPeers.has(otherNic.machineId)) continue;
      const otherIps = getAllIpsForNic(otherNic);
      let found = false;
      for (const myIpEntry of myIps) {
        for (const otherIpEntry of otherIps) {
          if (sameSubnet(myIpEntry.ip, otherIpEntry.ip, myIpEntry.mask, otherIpEntry.mask)) {
            const peer = allMachines.find(m => m.id === otherNic.machineId);
            const isAdditional = myIpEntry.ip !== myNic.ipAddress || otherIpEntry.ip !== otherNic.ipAddress;
            if (peer) lanPeers.set(otherNic.machineId, { machineName: peer.localName, viaIp: myIpEntry.ip, peerIp: otherIpEntry.ip, viaAdditionalIp: isAdditional });
            found = true; break;
          }
        }
        if (found) break;
      }
    }
  }

  const addMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/platform/machines/${machineId}/nics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nics"] }); setAdding(false); setForm({ nicName: "", macAddress: "", ipAddress: "", subnetMask: "255.255.255.0", forwardedFor: "", forwardedPort: "", routerId: "", notes: "" }); toast({ title: "เพิ่ม NIC แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (nicId: number) => {
      const res = await fetch(`/api/platform/machine-nics/${nicId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nics"] }); toast({ title: "ลบ NIC แล้ว" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const FORWARD_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    db: { label: "DB", color: "bg-purple-100 text-purple-700 border-purple-300", icon: Database },
    app: { label: "App (80/443)", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Globe },
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5" />
          Network Interfaces ({myNics.length})
        </h4>
        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setAdding(!adding); }} data-testid={`btn-add-nic-${machineId}`}>
          <Plus className="h-3 w-3 mr-1" /> เพิ่ม NIC
        </Button>
      </div>

      {myNics.length === 0 && !adding && (
        <div className="text-xs text-gray-400 italic p-2 border border-dashed rounded text-center">ยังไม่มีข้อมูล NIC</div>
      )}

      {myNics.map(nic => {
        const fwd = nic.forwardedFor ? FORWARD_LABELS[nic.forwardedFor] : null;
        const linkedRouter = nic.routerId ? allRouters.find(r => r.id === nic.routerId) : null;
        const nicIpCount = allNicIps.filter(ip => ip.nicId === nic.id).length;
        const isExpanded = expandedNicId === nic.id;
        return (
          <div key={nic.id} data-testid={`nic-row-${nic.id}`}>
            <div className={`flex items-center gap-2 p-2 bg-white border rounded text-xs group ${isExpanded ? "border-blue-300 rounded-b-none" : ""}`}>
              <button onClick={e => { e.stopPropagation(); setExpandedNicId(isExpanded ? null : nic.id); }} className="shrink-0 p-0.5 hover:bg-gray-100 rounded">
                {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
              </button>
              <Plug className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="font-medium text-gray-700 w-24 truncate">{nic.nicName}</span>
              <span className="font-mono text-blue-600 font-bold">{nic.ipAddress}</span>
              <span className="font-mono text-gray-400 text-[10px]">/{nic.subnetMask}</span>
              {nic.macAddress && <span className="font-mono text-gray-400 text-[10px] hidden lg:inline">{nic.macAddress}</span>}
              {linkedRouter && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-300 text-[10px] px-1.5 py-0">
                  <Router className="h-2.5 w-2.5 mr-0.5" />{linkedRouter.name}
                </Badge>
              )}
              {fwd && (
                <Badge variant="outline" className={`${fwd.color} text-[10px] px-1.5 py-0 flex items-center gap-0.5`}>
                  <Radio className="h-2.5 w-2.5" />
                  Forwarded → {fwd.label}
                  {nic.forwardedFor === "db" && nic.forwardedPort && <span className="font-mono">:{nic.forwardedPort}</span>}
                </Badge>
              )}
              {!fwd && <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300 text-[10px] px-1.5 py-0">LAN only</Badge>}
              {nicIpCount > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-300 text-[10px] px-1.5 py-0">
                  +{nicIpCount} IP
                </Badge>
              )}
              {nic.notes && <span className="text-gray-400 italic truncate hidden md:inline">{nic.notes}</span>}
              <button onClick={(e) => { e.stopPropagation(); if (confirm("ลบ NIC นี้?")) deleteMut.mutate(nic.id); }} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-400 transition-opacity" data-testid={`btn-delete-nic-${nic.id}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {isExpanded && (
              <div className="bg-blue-50/30 border border-t-0 border-blue-300 rounded-b p-2">
                <NicIpList nicId={nic.id} />
              </div>
            )}
          </div>
        );
      })}

      {adding && (
        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] text-gray-500">ชื่อ NIC *</Label>
              <Input className="h-7 text-xs" placeholder="Ethernet 1" value={form.nicName} onChange={e => setForm({ ...form, nicName: e.target.value })} data-testid={`input-nic-name-${machineId}`} />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">IP Address *</Label>
              <Input className="h-7 text-xs font-mono" placeholder="192.168.1.100" value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} data-testid={`input-nic-ip-${machineId}`} />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Subnet Mask</Label>
              <Input className="h-7 text-xs font-mono" placeholder="255.255.255.0" value={form.subnetMask} onChange={e => setForm({ ...form, subnetMask: e.target.value })} data-testid={`input-nic-subnet-${machineId}`} />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">MAC Address</Label>
              <Input className="h-7 text-xs font-mono" placeholder="AA:BB:CC:DD:EE:FF" value={form.macAddress} onChange={e => setForm({ ...form, macAddress: e.target.value })} data-testid={`input-nic-mac-${machineId}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] text-gray-500">Router (เชื่อมต่อผ่าน)</Label>
              <Select value={form.routerId || "none"} onValueChange={val => setForm({ ...form, routerId: val === "none" ? "" : val })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ระบุ</SelectItem>
                  {allRouters.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name} {r.lanIp ? `(${r.lanIp})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Port Forwarding</Label>
              <Select value={form.forwardedFor || "none"} onValueChange={val => setForm({ ...form, forwardedFor: val === "none" ? "" : val, forwardedPort: val !== "db" ? "" : form.forwardedPort })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่มี (LAN only)</SelectItem>
                  <SelectItem value="db">Forward → Database</SelectItem>
                  <SelectItem value="app">Forward → App (80/443)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.forwardedFor === "db" && (
              <div>
                <Label className="text-[10px] text-gray-500">External Port</Label>
                <Input className="h-7 text-xs font-mono" placeholder="20541" value={form.forwardedPort} onChange={e => setForm({ ...form, forwardedPort: e.target.value })} data-testid={`input-nic-fwd-port-${machineId}`} />
              </div>
            )}
            <div>
              <Label className="text-[10px] text-gray-500">หมายเหตุ</Label>
              <Input className="h-7 text-xs" placeholder="" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid={`input-nic-notes-${machineId}`} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>ยกเลิก</Button>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => addMut.mutate(form)} disabled={!form.nicName || !form.ipAddress} data-testid={`btn-save-nic-${machineId}`}>
              <Check className="h-3 w-3 mr-1" /> บันทึก
            </Button>
          </div>
        </div>
      )}

      {lanPeers.size > 0 && (
        <div className="p-2 bg-green-50/50 border border-green-200 rounded-lg">
          <h5 className="text-[10px] font-semibold text-green-700 mb-1 flex items-center gap-1"><Wifi className="h-3 w-3" /> LAN Connectivity (คำนวณจาก subnet)</h5>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {Array.from(lanPeers.entries()).map(([peerId, info]) => (
              <Badge key={peerId} variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] px-1.5 py-0.5">
                {info.machineName}
                <span className="font-mono ml-1 text-green-600">{info.peerIp}</span>
                {info.viaAdditionalIp && <span className="text-[8px] text-green-500 ml-0.5">(additional IP)</span>}
              </Badge>
            ))}
          </div>
          <div className="flex items-start gap-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>คำนวณจากข้อมูล IP ที่บันทึกไว้เท่านั้น <strong>ไม่การันตี</strong>ว่าเชื่อมต่อได้จริง — หากต้องการผลที่ถูกต้อง ให้เปิดหน้านี้จาก<strong>เครื่องนั้น</strong>โดยตรง แล้วใช้ Test DB Connection</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface PathResult {
  label: string;
  host: string;
  port: number;
  alive: boolean;
  latency: number;
  version?: string;
  error?: string;
}

interface SkippedPath {
  label: string;
  host: string;
  reason: string;
}

function TargetDbSelector({ machine, allMachines, onChangeTarget }: {
  machine: MachineRecord;
  allMachines: MachineRecord[];
  onChangeTarget: (id: number, targetId: number | null) => void;
}) {
  const currentVal = machine.targetDbMachineId ? String(machine.targetDbMachineId) : "none";
  const [selectedVal, setSelectedVal] = useState(currentVal);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "done">("idle");
  const [pathResults, setPathResults] = useState<PathResult[]>([]);
  const [skippedPaths, setSkippedPaths] = useState<SkippedPath[]>([]);
  const [testError, setTestError] = useState("");
  const [isIncomplete, setIsIncomplete] = useState(false);
  const hasChanged = selectedVal !== currentVal;
  const isSelf = selectedVal === String(machine.id);
  const isNone = selectedVal === "none";
  const anyAlive = pathResults.some(p => p.alive);

  useEffect(() => {
    setSelectedVal(currentVal);
    setTestStatus("idle");
    setPathResults([]);
    setSkippedPaths([]);
    setTestError("");
    setIsIncomplete(false);
  }, [currentVal]);

  const handleSelect = (val: string) => {
    setSelectedVal(val);
    setTestStatus("idle");
    setPathResults([]);
    setSkippedPaths([]);
    setTestError("");
    setIsIncomplete(false);
  };

  const handleTest = async () => {
    if (isNone) return;
    const targetId = parseInt(selectedVal, 10);
    setTestStatus("testing");
    setPathResults([]);
    setSkippedPaths([]);
    setTestError("");
    setIsIncomplete(false);
    try {
      const res = await fetch(`/api/platform/machines/${targetId}/test-db`, { method: "POST" });
      const data = await res.json();
      if (data.paths) setPathResults(data.paths);
      if (data.skipped) setSkippedPaths(data.skipped);
      if (data.error) setTestError(data.error);
      if (data.incomplete) setIsIncomplete(true);
      setTestStatus("done");
    } catch (err: any) {
      setTestError(err.message);
      setTestStatus("done");
    }
  };

  const handleConfirm = () => {
    const newTarget = isNone ? null : parseInt(selectedVal, 10);
    onChangeTarget(machine.id, newTarget);
    setTestStatus("idle");
    setPathResults([]);
    setSkippedPaths([]);
    setTestError("");
    setIsIncomplete(false);
  };

  const handleCancel = () => {
    setSelectedVal(currentVal);
    setTestStatus("idle");
    setPathResults([]);
    setSkippedPaths([]);
    setTestError("");
    setIsIncomplete(false);
  };

  const targetMachine = selectedVal !== "none" && selectedVal !== String(machine.id)
    ? allMachines.find(m => m.id === parseInt(selectedVal, 10))
    : null;

  return (
    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-purple-500 shrink-0" />
        <span className="text-xs font-medium text-gray-600 shrink-0">Target DB:</span>
        <Select value={selectedVal} onValueChange={handleSelect}>
          <SelectTrigger className="h-7 text-xs flex-1 max-w-[220px]" data-testid={`select-target-db-${machine.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-gray-400">— ยังไม่ได้กำหนด</span>
            </SelectItem>
            <SelectItem value={String(machine.id)}>
              <span className="flex items-center gap-1">
                <span className="text-blue-600 font-medium">ตัวเอง (local DB)</span>
                <span className="text-gray-400 font-mono text-[10px]">{machine.dbName}:{machine.dbPort}</span>
              </span>
            </SelectItem>
            {allMachines.filter(m => m.id !== machine.id).map(m => (
              <SelectItem key={m.id} value={String(m.id)}>
                <span className="flex items-center gap-1">
                  <span className="font-medium">{m.localName}</span>
                  <span className="text-gray-400 font-mono text-[10px]">{m.dbName}:{m.dbPort}</span>
                  {m.isOfficial && <Star className="h-3 w-3 text-amber-400 fill-amber-300" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {targetMachine && (
          <span className="text-[10px] text-gray-400 font-mono hidden lg:inline">{targetMachine.domainName || targetMachine.lanIp || ""}</span>
        )}
        {!hasChanged && !isNone && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-purple-400 hover:text-purple-600 hover:bg-purple-50 shrink-0"
            onClick={handleTest}
            disabled={testStatus === "testing"}
            title="ทดสอบการเชื่อมต่อ"
            data-testid={`btn-retest-db-${machine.id}`}
          >
            {testStatus === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {!hasChanged && testStatus === "done" && (
        <div className="space-y-1 bg-white rounded border border-gray-200 p-2">
          {isIncomplete && testError && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{testError}</span>
            </div>
          )}
          {pathResults.length > 0 && (
            <>
              <div className="text-[10px] font-medium text-gray-500 mb-1">
                ผลทดสอบ ({pathResults.filter(p => p.alive).length}/{pathResults.length} เส้นทางเชื่อมต่อได้)
              </div>
              {pathResults.map((p, i) => (
                <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono ${p.alive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  {p.alive ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                  <span className={`font-semibold w-14 shrink-0 ${p.alive ? "text-green-700" : "text-red-600"}`}>{p.label}</span>
                  <span className="text-gray-600 truncate">{p.host}:{p.port}</span>
                  {p.alive ? (
                    <>
                      <span className="text-green-600 ml-auto shrink-0">{p.latency}ms</span>
                      <span className="text-green-500 text-[9px] hidden sm:inline">{p.version?.match(/PostgreSQL [\d.]+/)?.[0] || ""}</span>
                    </>
                  ) : (
                    <span className="text-red-400 text-[9px] ml-auto truncate max-w-[200px]" title={p.error}>{p.error}</span>
                  )}
                </div>
              ))}
            </>
          )}
          {skippedPaths.length > 0 && skippedPaths.map((s, i) => (
            <div key={`skip-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono bg-gray-100 border border-gray-200 text-gray-400">
              <span className="font-semibold w-14 shrink-0">{s.label}</span>
              <span className="truncate">{s.host}</span>
              <span className="text-[9px] ml-auto italic">{s.reason}</span>
            </div>
          ))}
          {!isIncomplete && testError && pathResults.length === 0 && (
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-gray-400" /> {testError}
            </div>
          )}
        </div>
      )}

      {hasChanged && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {!isNone && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 border-purple-300 text-purple-600 hover:bg-purple-50"
                onClick={handleTest}
                disabled={testStatus === "testing"}
                data-testid={`btn-test-db-${machine.id}`}
              >
                {testStatus === "testing" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                {testStatus === "testing" ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ"}
              </Button>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2 text-gray-500"
                onClick={handleCancel}
                data-testid={`btn-cancel-target-${machine.id}`}
              >
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="h-6 text-[11px] px-2 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleConfirm}
                disabled={isIncomplete || (!isNone && testStatus !== "done")}
                data-testid={`btn-confirm-target-${machine.id}`}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> ยืนยัน
              </Button>
            </div>
          </div>

          {testStatus === "done" && (
            <div className="space-y-1 bg-white rounded border border-gray-200 p-2">
              {isIncomplete && testError && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              {pathResults.length > 0 && (
                <>
                  <div className="text-[10px] font-medium text-gray-500 mb-1">
                    ผลทดสอบ ({pathResults.filter(p => p.alive).length}/{pathResults.length} เส้นทางเชื่อมต่อได้)
                  </div>
                  {pathResults.map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono ${p.alive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                      {p.alive ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                      <span className={`font-semibold w-14 shrink-0 ${p.alive ? "text-green-700" : "text-red-600"}`}>{p.label}</span>
                      <span className="text-gray-600 truncate">{p.host}:{p.port}</span>
                      {p.alive ? (
                        <>
                          <span className="text-green-600 ml-auto shrink-0">{p.latency}ms</span>
                          <span className="text-green-500 text-[9px] hidden sm:inline">{p.version?.match(/PostgreSQL [\d.]+/)?.[0] || ""}</span>
                        </>
                      ) : (
                        <span className="text-red-400 text-[9px] ml-auto truncate max-w-[200px]" title={p.error}>{p.error}</span>
                      )}
                    </div>
                  ))}
                </>
              )}

              {skippedPaths.length > 0 && (
                <>
                  {skippedPaths.map((s, i) => (
                    <div key={`skip-${i}`} className="flex items-center gap-2 px-2 py-1 rounded text-[11px] font-mono bg-gray-100 border border-gray-200 text-gray-400">
                      <span className="font-semibold w-14 shrink-0">{s.label}</span>
                      <span className="truncate">{s.host}</span>
                      <span className="text-[9px] ml-auto italic">{s.reason}</span>
                    </div>
                  ))}
                </>
              )}

              {!isIncomplete && !anyAlive && pathResults.length > 0 && (
                <div className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> ไม่มีเส้นทางที่เชื่อมต่อได้จากเซิร์ฟเวอร์นี้
                </div>
              )}

              {!isIncomplete && testError && pathResults.length === 0 && (
                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-gray-400" /> {testError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MachineCard({ machine, onEdit, expanded, onToggle, onToggleOfficial, allMachines, onChangeTarget, allNics, allRouters, locations, credentialsUnlocked }: {
  machine: MachineRecord;
  onEdit: (m: MachineRecord) => void;
  expanded: boolean;
  onToggle: () => void;
  onToggleOfficial: (id: number, val: boolean) => void;
  allMachines: MachineRecord[];
  onChangeTarget: (id: number, targetId: number | null) => void;
  allNics: NicRecord[];
  allRouters: RouterRecord[];
  locations: LocationRecord[];
  credentialsUnlocked: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const osConfig = OS_CONFIG[machine.os] || OS_CONFIG.linux;
  const roleConfig = ROLE_CONFIG[machine.role] || ROLE_CONFIG.testing;
  const serverTypeConfig = SERVER_TYPE_CONFIG[machine.serverType] || SERVER_TYPE_CONFIG.app_database;
  const OsIcon = osConfig.icon;
  const isOfficial = machine.isOfficial;
  const targetDb = machine.targetDbMachineId ? allMachines.find(m => m.id === machine.targetDbMachineId) : null;
  const isSelfTarget = machine.targetDbMachineId === machine.id;
  const targetLabel = isSelfTarget ? "local DB" : targetDb ? targetDb.localName : null;
  const nicCount = allNics.filter(n => n.machineId === machine.id).length;
  const hasForwarding = allNics.some(n => n.machineId === machine.id && n.forwardedFor);

  return (
    <div className={`border rounded-lg transition-all ${isOfficial ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300" : osConfig.color} ${expanded ? "shadow-md" : "hover:shadow-sm"}`} data-testid={`card-machine-${machine.id}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        data-testid={`btn-toggle-machine-${machine.id}`}
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        {isOfficial && <Star className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0" />}
        <OsIcon className="h-4 w-4 shrink-0" />
        <span className={`font-bold text-sm truncate ${isOfficial ? "text-amber-900" : ""}`}>{machine.localName}</span>
        {targetLabel && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
            <ArrowRight className="h-3 w-3" />
            <Database className="h-3 w-3" />
            <span className={`font-mono ${isSelfTarget ? "text-blue-500" : "text-purple-500"}`}>{targetLabel}</span>
          </span>
        )}
        <span className="text-xs text-gray-400 font-mono truncate hidden md:inline">{machine.domainName || machine.lanIp || ""}</span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Badge className={`${roleConfig.bgColor} ${roleConfig.color} text-[10px] px-1.5 py-0`}>
            {roleConfig.label}
          </Badge>
          {nicCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <Network className="h-3 w-3" />
              {nicCount}
              {hasForwarding && <Radio className="h-2.5 w-2.5 text-purple-400" />}
            </span>
          )}
          {isOfficial && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Official</Badge>}
          {machine.encContent && <Lock className="h-3 w-3 text-green-600" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            {machine.fqdn && (
              <div>
                <span className="text-gray-400 text-xs block">FQDN</span>
                <span className="font-mono text-xs">{machine.fqdn}</span>
              </div>
            )}
            {machine.windowsName && (
              <div>
                <span className="text-gray-400 text-xs block">Windows Name</span>
                <span className="font-mono text-xs">{machine.windowsName}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400 text-xs block">Domain</span>
              <span className="font-mono text-xs">{machine.domainName || "—"}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">WAN IP</span>
              <span className="font-mono text-xs">{machine.wanIp || "—"}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">Internet</span>
              <span className={`text-xs font-medium ${machine.internetType === "fixed" ? "text-green-600" : "text-orange-500"}`}>
                {machine.internetType === "fixed" ? "Fixed IP" : "Dynamic (DDNS)"}
              </span>
            </div>
            {(machine.serverType === "app" || machine.serverType === "app_database") && (
              <div>
                <span className="text-gray-400 text-xs block">App Port</span>
                <span className="font-mono text-xs">:{machine.appPort || "5000"}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400 text-xs block">DB</span>
              <span className="font-mono text-xs">{machine.dbName}:{machine.dbPort}</span>
            </div>
            {credentialsUnlocked && (
              <div>
                <span className="text-gray-400 text-xs block">DB User</span>
                <span className="font-mono text-xs">{machine.dbUser}</span>
              </div>
            )}
            {credentialsUnlocked && (
              <div>
                <span className="text-gray-400 text-xs block">DB Password</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{showPw ? machine.dbPassword : "••••••••"}</span>
                  <button onClick={e => { e.stopPropagation(); setShowPw(!showPw); }} className="p-0.5 hover:bg-gray-200 rounded" data-testid={`btn-toggle-pw-${machine.id}`}>
                    {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            )}
            {!credentialsUnlocked && (
              <div>
                <span className="text-gray-400 text-xs block">DB Credentials</span>
                <span className="text-xs text-amber-500 flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
              </div>
            )}
            {(() => {
              const loc = machine.locationId ? locations.find(l => l.id === machine.locationId) : null;
              const locLabel = loc
                ? (loc.parentId ? (() => { const p = locations.find(l => l.id === loc.parentId); return p ? `${p.name} > ${loc.name}` : loc.name; })() : loc.name)
                : machine.physicalLocation;
              return locLabel ? (
                <div>
                  <span className="text-gray-400 text-xs block">สถานที่ตั้ง</span>
                  <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-red-400" />{locLabel}</span>
                </div>
              ) : null;
            })()}
            {machine.sysadminEmail && (
              <div>
                <span className="text-gray-400 text-xs block">Sysadmin Email</span>
                <span className="text-xs font-mono">{machine.sysadminEmail}</span>
              </div>
            )}
            {machine.sysadminLineId && (
              <div>
                <span className="text-gray-400 text-xs block">Sysadmin LINE</span>
                <span className="text-xs font-mono truncate">{machine.sysadminLineId}</span>
              </div>
            )}
          </div>

          {(machine.machineModel || machine.cpuModel || machine.ramSize) && (
            <div className="flex gap-4 text-xs text-gray-500">
              {machine.machineModel && <span>{machine.machineModel}</span>}
              {machine.cpuModel && <span>CPU: {machine.cpuModel}</span>}
              {machine.ramSize && <span>RAM: {machine.ramSize}</span>}
            </div>
          )}

          <NicSection machineId={machine.id} allNics={allNics} allMachines={allMachines} allRouters={allRouters} />

          <TargetDbSelector machine={machine} allMachines={allMachines} onChangeTarget={onChangeTarget} />

          <div className="flex items-center gap-3">
            {machine.envContent && (
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">.env</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-50 text-green-700 border-green-300">
                  {machine.envContent.trim().split("\n").filter(Boolean).length} vars
                </Badge>
              </div>
            )}
            {machine.notes && (
              <span className="text-xs text-gray-400 italic truncate">{machine.notes}</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={`h-7 text-xs ${isOfficial ? "border-amber-400 text-amber-700 hover:bg-amber-100" : "border-gray-300 text-gray-500 hover:bg-gray-100"}`}
                onClick={(e) => { e.stopPropagation(); onToggleOfficial(machine.id, !isOfficial); }}
                data-testid={`btn-official-machine-${machine.id}`}
              >
                <Star className={`h-3 w-3 mr-1 ${isOfficial ? "fill-amber-400 text-amber-500" : ""}`} />
                {isOfficial ? "ยกเลิก Official" : "ตั้งเป็น Official"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(machine); }} data-testid={`btn-edit-machine-${machine.id}`}>
                <Pencil className="h-3 w-3 mr-1" /> แก้ไข
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditMachineDialog({
  machine,
  locations,
  onSave,
  onCancel,
  onDelete,
  saving,
}: {
  machine: MachineRecord | null;
  locations: LocationRecord[];
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
    appPort: machine?.appPort || "5000",
    dbPort: machine?.dbPort || "5432",
    dbName: machine?.dbName || "",
    dbUser: machine?.dbUser || "",
    dbPassword: machine?.dbPassword || "",
    notes: machine?.notes || "",
    envContent: machine?.envContent || "",
    sysadminEmail: machine?.sysadminEmail || "",
    sysadminLineId: machine?.sysadminLineId || "",
    physicalLocation: machine?.physicalLocation || "",
    locationId: machine?.locationId ? String(machine.locationId) : "",
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

          <div>
            <Label className="text-sm font-medium">สถานที่ตั้ง (Location)</Label>
            <Select value={form.locationId || "none"} onValueChange={v => setForm({ ...form, locationId: v === "none" ? "" : v })}>
              <SelectTrigger data-testid="select-machine-location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                {locations.filter(l => !l.parentId).map(parent => {
                  const children = locations.filter(c => c.parentId === parent.id);
                  return [
                    <SelectItem key={parent.id} value={String(parent.id)}>
                      {parent.name}
                    </SelectItem>,
                    ...children.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        &nbsp;&nbsp;└ {c.name}
                      </SelectItem>
                    )),
                  ];
                })}
              </SelectContent>
            </Select>
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

          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Node.js App Port</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">App Port *</Label>
                  <Input value={form.appPort} onChange={e => setForm({ ...form, appPort: e.target.value })} placeholder="5000" data-testid="input-app-port" />
                </div>
                <div className="col-span-2 flex items-end">
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 w-full">
                    <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      เปลี่ยน Port แล้วต้องแก้ Apache SSL ด้วย
                    </p>
                    <p className="text-[11px] text-amber-600 mt-1">
                      Sysadmin ต้องแก้ไฟล์ Apache config (httpd-ssl.conf / sites-enabled) ให้ ProxyPass ชี้ไปที่ port ใหม่ แล้ว restart Apache ด้วยตนเอง
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold flex items-center gap-1 mb-2">
                <Shield className="h-4 w-4" /> .env (Environment Variables)
              </Label>
              <textarea
                className="w-full font-mono text-sm border rounded-lg p-3 bg-gray-900 text-green-400 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-[#fb9678]"
                value={form.envContent}
                onChange={e => setForm({ ...form, envContent: e.target.value })}
                placeholder={`NODE_ENV=production\nPORT=5000\nMACHINE_NAME=etaxerp.com\nMACHINE_DB_PORT=15064\nDB_MAIN_HOST=server-e5\nDB_MAIN_LAN=true`}
                spellCheck={false}
                data-testid="textarea-env-content"
              />
              <p className="text-xs text-gray-400 mt-1">ใส่เฉพาะ non-secret variables (ห้ามใส่ password / connection string)</p>
            </div>
          )}

          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Sysadmin Alert (แจ้งเตือนเมื่อ DB ล่ม)
              </h3>
              <p className="text-xs text-gray-400 mb-3">ระบบจะแจ้งเตือน sysadmin ของเครื่องนี้เมื่อ DB connection ล่มนานเกิน 1 นาที (เครื่องละ 1 คน)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sysadmin Email</Label>
                  <Input value={form.sysadminEmail} onChange={e => setForm({ ...form, sysadminEmail: e.target.value })} placeholder="admin@example.com" data-testid="input-sysadmin-email" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Sysadmin LINE ID (userId)</Label>
                  <Input className="font-mono" value={form.sysadminLineId} onChange={e => setForm({ ...form, sysadminLineId: e.target.value })} placeholder="U1234567890abcdef..." data-testid="input-sysadmin-line-id" />
                </div>
              </div>
            </div>
          )}

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

function CloneHistoryTargetCard({ machines }: { machines: MachineRecord[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: targetInfo, isLoading } = useQuery<{ machineId: number; machineName: string | null; consecutiveFailDays: number; lastCheckDate: string | null }>({
    queryKey: ["/api/platform/clone-history-target"],
    queryFn: async () => {
      const r = await fetch("/api/platform/clone-history-target", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const dbMachines = machines.filter(m => m.serverType === "database" || m.serverType === "app_database");

  const changeMut = useMutation({
    mutationFn: async (machineId: number) => {
      const r = await fetch("/api/platform/clone-history-target", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ machineId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "เปลี่ยนเซิร์ฟเวอร์เก็บ Clone Log สำเร็จ", description: `ย้ายไป ${data.machineName}` });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/clone-history-target"] });
    },
    onError: (err: any) => {
      toast({ title: "ผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const currentId = targetInfo?.machineId || 0;
  const currentName = targetInfo?.machineName || "ยังไม่ได้กำหนด";
  const failDays = targetInfo?.consecutiveFailDays || 0;

  return (
    <Card className="border-2 border-purple-200" data-testid="card-clone-history-target">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-5 w-5 text-purple-600" />
          Clone History — เซิร์ฟเวอร์เก็บ Log กลาง
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm text-gray-500 mb-1">เซิร์ฟเวอร์ปัจจุบัน</div>
            <div className="flex items-center gap-2">
              {currentId > 0 ? (
                <>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200" data-testid="badge-clone-target-name">{currentName}</Badge>
                  {failDays > 0 && (
                    <Badge variant="destructive" className="text-xs" data-testid="badge-clone-fail-days">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      ส่งไม่ได้ {failDays} วัน
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-sm text-orange-600 font-medium" data-testid="text-clone-target-none">⚠ ยังไม่ได้กำหนด</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-sm mb-1.5 block">เปลี่ยนเซิร์ฟเวอร์เก็บ Clone Log</Label>
          <div className="flex items-center gap-2">
            <Select
              value={currentId > 0 ? String(currentId) : ""}
              onValueChange={(val) => {
                const newId = parseInt(val, 10);
                if (newId && newId !== currentId) {
                  if (confirm(`ย้าย Clone Log ไปเก็บที่ "${dbMachines.find(m => m.id === newId)?.localName}" ?\n\nค่านี้จะถูก push ไป GitHub ทันที — ทุก App Server จะอ่านค่าใหม่จาก GitHub เมื่อเปิดเครื่อง\nLog ที่ค้างอยู่จะถูกส่งไปเซิร์ฟเวอร์ใหม่โดยอัตโนมัติ`)) {
                    changeMut.mutate(newId);
                  }
                }
              }}
              data-testid="select-clone-target"
            >
              <SelectTrigger className="flex-1" data-testid="select-clone-target-trigger">
                <SelectValue placeholder="เลือกเซิร์ฟเวอร์..." />
              </SelectTrigger>
              <SelectContent>
                {dbMachines.map(m => (
                  <SelectItem key={m.id} value={String(m.id)} data-testid={`select-item-machine-${m.id}`}>
                    <span className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-purple-500" />
                      {m.localName}
                      {m.fqdn && <span className="text-xs text-gray-400">({m.fqdn})</span>}
                      {m.id === currentId && <Badge variant="outline" className="text-xs ml-1">ปัจจุบัน</Badge>}
                    </span>
                  </SelectItem>
                ))}
                {dbMachines.length === 0 && (
                  <div className="p-2 text-sm text-gray-500">ไม่มีเซิร์ฟเวอร์ Database</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          ค่านี้เก็บใน GitHub (clone-target.json) — ทุก App Server จะถาม GitHub ตอนเปิดเครื่อง ไม่ว่าจะใช้ code version ไหน
          <br />
          ระบบจะตรวจสอบวันละ 1 ครั้ง — หากส่งไม่ได้ 7 วันติดต่อกัน จะส่ง Email แจ้ง Platform Admin ทุกคน
        </p>
      </CardContent>
    </Card>
  );
}

function WhatIfBenchmark({ machines }: { machines: MachineRecord[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [benchTarget, setBenchTarget] = useState<number | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResult, setBenchResult] = useState<any>(null);
  const [rowCount, setRowCount] = useState("10000");

  const handleRunAll = async () => {
    setTesting(true);
    setResults([]);
    setBenchResult(null);
    try {
      const res = await fetch("/api/platform/machines/benchmark-all", { method: "POST" });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      console.error(err);
    }
    setTesting(false);
  };

  const handleBenchmark = async (machineId: number) => {
    setBenchTarget(machineId);
    setBenchRunning(true);
    setBenchResult(null);
    try {
      const res = await fetch(`/api/platform/machines/${machineId}/benchmark-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowCount: parseInt(rowCount) || 10000 }),
      });
      const data = await res.json();
      setBenchResult(data);
    } catch (err: any) {
      setBenchResult({ success: false, error: err.message });
    }
    setBenchRunning(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
        onClick={() => setIsOpen(true)}
        data-testid="btn-whatif"
      >
        <Database className="h-4 w-4 mr-2" /> What If — เปรียบเทียบ DB ทุกเครื่อง
      </Button>
    );
  }

  const aliveResults = results.filter(r => r.bestLatency !== null);
  const deadResults = results.filter(r => !r.incomplete && r.bestLatency === null && r.paths?.length > 0);
  const incompleteResults = results.filter(r => r.incomplete);
  const noPathResults = results.filter(r => !r.incomplete && r.bestLatency === null && (!r.paths || r.paths.length === 0));

  return (
    <Card className="border-indigo-200 bg-indigo-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-500" />
            What If — เปรียบเทียบ DB ทุกเครื่อง
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleRunAll}
              disabled={testing}
              data-testid="btn-run-whatif"
            >
              {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              {testing ? "กำลังทดสอบทุกเครื่อง..." : "ทดสอบทั้งหมด"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsOpen(false); setResults([]); setBenchResult(null); }} data-testid="btn-close-whatif">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.length === 0 && !testing && (
          <p className="text-sm text-gray-500 text-center py-4">กดปุ่ม "ทดสอบทั้งหมด" เพื่อเปรียบเทียบ connection speed ของทุกเครื่อง</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500">
              Ranking — เรียงตาม latency ต่ำสุด (จากเซิร์ฟเวอร์ที่ app รันอยู่)
            </div>

            {aliveResults.map((r, idx) => (
              <div key={r.machineId} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${idx === 0 ? "bg-green-50 border-green-300" : "bg-white border-gray-200"}`}>
                <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? "text-green-600" : idx === 1 ? "text-blue-500" : idx === 2 ? "text-amber-500" : "text-gray-400"}`}>
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{r.machineName}</span>
                    <Badge variant="outline" className="text-[10px]">{r.role}</Badge>
                    {idx === 0 && <Badge className="bg-green-500 text-white text-[10px]">Fastest</Badge>}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    via {r.bestPath?.label}: {r.bestPath?.host} — {r.bestPath?.version?.match(/PostgreSQL [\d.]+/)?.[0] || ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-lg font-bold ${idx === 0 ? "text-green-600" : "text-gray-700"}`}>{r.bestLatency}ms</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2 border-purple-300 text-purple-600 hover:bg-purple-50 shrink-0"
                  onClick={() => handleBenchmark(r.machineId)}
                  disabled={benchRunning}
                  data-testid={`btn-bench-${r.machineId}`}
                >
                  {benchRunning && benchTarget === r.machineId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-0.5" />}
                  Benchmark
                </Button>
              </div>
            ))}

            {deadResults.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <div className="text-[10px] text-red-500 font-medium mb-1">ไม่สามารถเชื่อมต่อได้</div>
                {deadResults.map(r => (
                  <div key={r.machineId} className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-50 border border-red-200 text-sm">
                    <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                    <span className="font-medium text-red-700">{r.machineName}</span>
                    <span className="text-[10px] text-red-400 ml-auto">
                      {r.paths?.map((p: any) => `${p.label}: ${p.error?.split(" ").slice(0, 3).join(" ")}`).join(" | ")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(incompleteResults.length > 0 || noPathResults.length > 0) && (
              <div className="border-t pt-2 mt-2">
                <div className="text-[10px] text-gray-400 font-medium mb-1">ข้อมูลไม่ครบ / ไม่มีเส้นทาง</div>
                {[...incompleteResults, ...noPathResults].map(r => (
                  <div key={r.machineId} className="flex items-center gap-2 px-3 py-1 text-xs text-gray-400">
                    <span>{r.machineName}</span>
                    <span className="text-[10px] italic">{r.incomplete ? "ไม่มี credentials" : "ไม่มีเส้นทางที่ทดสอบได้"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {benchResult && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Query Benchmark — {machines.find(m => m.id === benchTarget)?.localName}</span>
              {benchResult.success && (
                <Badge className="bg-purple-100 text-purple-700 text-[10px]">{benchResult.rowCount?.toLocaleString()} rows</Badge>
              )}
            </div>

            {!benchResult.success ? (
              <div className="text-sm text-red-500 bg-red-50 rounded p-2">{benchResult.error}</div>
            ) : (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 font-mono mb-1">
                  {benchResult.host}:{benchResult.port} — Connect: {benchResult.connectTime}ms — Total: {benchResult.totalTime}ms — {benchResult.version}
                </div>
                {benchResult.benchmarks?.map((b: any, i: number) => {
                  const maxDur = Math.max(...benchResult.benchmarks.map((x: any) => x.duration));
                  const pct = maxDur > 0 ? (b.duration / maxDur) * 100 : 0;
                  return (
                    <div key={i} className="relative">
                      <div className="absolute inset-0 rounded bg-purple-100" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center gap-2 px-2 py-1 text-[11px] font-mono">
                        <span className="w-48 font-semibold text-gray-700">{b.name}</span>
                        <div className="flex-1" />
                        <span className="font-bold text-purple-700">{b.duration}ms</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-gray-500">Row count:</span>
              {["1000", "10000", "100000"].map(rc => (
                <Button
                  key={rc}
                  size="sm"
                  variant={rowCount === rc ? "default" : "outline"}
                  className={`h-6 text-[10px] px-2 ${rowCount === rc ? "bg-purple-600 text-white" : ""}`}
                  onClick={() => setRowCount(rc)}
                  data-testid={`btn-rows-${rc}`}
                >
                  {parseInt(rc).toLocaleString()}
                </Button>
              ))}
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 bg-purple-600 hover:bg-purple-700 text-white ml-2"
                onClick={() => benchTarget && handleBenchmark(benchTarget)}
                disabled={benchRunning}
                data-testid="btn-rerun-bench"
              >
                {benchRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Run Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DbHealthEvent {
  id: number;
  event_type: string;
  event_time: string;
  consecutive_failures: number;
  cumulative_failures: number;
  down_seconds: number;
  recovery_method: string | null;
  error_message: string | null;
  database_label: string | null;
  notes: string | null;
}

function DbHealthLog() {
  const { data, isLoading } = useQuery<{ available: boolean; events: DbHealthEvent[]; message?: string }>({
    queryKey: ["/api/platform/db-health-events"],
  });
  const [showAll, setShowAll] = useState(false);

  const eventBadge = (type: string) => {
    const map: Record<string, { color: string; label: string }> = {
      FIRST_FAILURE: { color: "bg-yellow-100 text-yellow-800", label: "Fail เริ่มต้น" },
      RECOVERY_MODE_ENTER: { color: "bg-red-100 text-red-800", label: "เข้า Recovery" },
      POOL_RECYCLED: { color: "bg-blue-100 text-blue-800", label: "Recycle Pool" },
      POOL_VERIFY_OK: { color: "bg-green-100 text-green-800", label: "Verify OK" },
      POOL_VERIFY_FAIL: { color: "bg-orange-100 text-orange-800", label: "Verify Fail" },
      RECOVERED: { color: "bg-emerald-100 text-emerald-800", label: "กลับมาปกติ" },
      RECOVERY_MODE_EXIT: { color: "bg-emerald-100 text-emerald-800", label: "ออก Recovery" },
      FORCE_RESTART: { color: "bg-red-200 text-red-900", label: "Force Restart" },
    };
    const m = map[type] || { color: "bg-gray-100 text-gray-700", label: type };
    return <Badge className={`${m.color} text-[10px] px-1.5 py-0`}>{m.label}</Badge>;
  };

  const formatTime = (t: string) => {
    try {
      return new Date(t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
    } catch { return t; }
  };

  const events = data?.events || [];
  const visible = showAll ? events : events.slice(0, 20);

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/30" data-testid="card-db-health-log">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-600" />
          DB Connection Health Log
        </CardTitle>
        <p className="text-xs text-gray-500">
          บันทึกเหตุการณ์ connection ของเครื่องนี้ — เก็บใน config DB ของ server
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
          </div>
        ) : !data?.available ? (
          <div className="text-center py-6 text-gray-400 border rounded-lg border-dashed">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">ยังไม่มี db_health_events table</p>
            <p className="text-xs mt-1">{data?.message || "สร้าง table ผ่าน Encryption Config setup"}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6 text-gray-400 border rounded-lg border-dashed">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-green-400" />
            <p className="text-sm">ไม่มีเหตุการณ์ — connection ปกติ</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[140px_110px_80px_80px_80px_1fr] gap-1 text-[10px] font-semibold text-gray-500 border-b pb-1 mb-1">
              <span>เวลา</span>
              <span>เหตุการณ์</span>
              <span>Fails</span>
              <span>Cumul.</span>
              <span>Down (s)</span>
              <span>Error</span>
            </div>
            {visible.map(ev => (
              <div key={ev.id} className="grid grid-cols-[140px_110px_80px_80px_80px_1fr] gap-1 text-[11px] py-0.5 border-b border-gray-100 items-center" data-testid={`health-event-${ev.id}`}>
                <span className="font-mono text-gray-600 text-[10px]">{formatTime(ev.event_time)}</span>
                {eventBadge(ev.event_type)}
                <span className="font-mono">{ev.consecutive_failures || "—"}</span>
                <span className="font-mono">{ev.cumulative_failures || "—"}</span>
                <span className="font-mono">{ev.down_seconds || "—"}</span>
                <span className="text-[10px] text-gray-500 truncate" title={ev.error_message || ""}>{ev.error_message || ev.recovery_method || "—"}</span>
              </div>
            ))}
            {events.length > 20 && (
              <button className="text-xs text-blue-500 hover:text-blue-700 mt-2" onClick={() => setShowAll(!showAll)} data-testid="btn-show-all-health">
                {showAll ? "แสดงน้อยลง" : `แสดงทั้งหมด (${events.length} รายการ)`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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

CREATE TABLE IF NOT EXISTS db_health_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(30) NOT NULL,
  event_time TIMESTAMP NOT NULL DEFAULT NOW(),
  consecutive_failures INTEGER DEFAULT 0,
  cumulative_failures INTEGER DEFAULT 0,
  down_seconds INTEGER DEFAULT 0,
  recovery_method VARCHAR(20),
  error_message TEXT,
  database_label VARCHAR(100),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_db_health_event_time ON db_health_events(event_time DESC);

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

export default function AllServers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingMachine, setEditingMachine] = useState<MachineRecord | null | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: machines = [], isLoading } = useQuery<MachineRecord[]>({
    queryKey: ["/api/platform/machines"],
  });

  const { data: allNics = [] } = useQuery<NicRecord[]>({
    queryKey: ["/api/platform/all-nics"],
  });

  const { data: routersList = [] } = useQuery<RouterRecord[]>({
    queryKey: ["/api/platform/routers"],
  });

  const { data: platformDomains = [] } = useQuery<PlatformDomainRecord[]>({
    queryKey: ["/api/platform/domains"],
  });

  const { data: allPortForwards = [] } = useQuery<PortForwardRecord[]>({
    queryKey: ["/api/platform/all-port-forwards"],
  });

  const { data: locations = [] } = useQuery<LocationRecord[]>({
    queryKey: ["/api/platform/locations"],
  });

  interface ServerIdentity {
    machineName: string;
    hostname: string;
    localIps: { iface: string; ip: string; mac: string; family: string; internal: boolean }[];
    matchedMachineId: number | null;
    matchedMachineName: string | null;
    matchMethod: string | null;
    isCloud: boolean;
  }

  const { data: serverIdentity } = useQuery<ServerIdentity>({
    queryKey: ["/api/platform/server-identity"],
  });

  const [editingRouter, setEditingRouter] = useState<RouterRecord | null | undefined>(undefined);
  const [expandedRouterId, setExpandedRouterId] = useState<number | null>(null);
  const [editingDomain, setEditingDomain] = useState<PlatformDomainRecord | null | undefined>(undefined);
  const [expandedDomainId, setExpandedDomainId] = useState<number | null>(null);
  const [credentialsUnlocked, setCredentialsUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [masterPwInput, setMasterPwInput] = useState("");

  const verifyPasswordMut = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch("/api/platform/verify-infra-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { setCredentialsUnlocked(true); setShowPasswordPrompt(false); setMasterPwInput(""); toast({ title: "ปลดล็อค Credentials สำเร็จ" }); },
    onError: (err: any) => toast({ title: "รหัสผ่านไม่ถูกต้อง", variant: "destructive" }),
  });

  const [editingLocation, setEditingLocation] = useState<LocationRecord | null | undefined>(undefined);

  const createLocationMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/platform/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/locations"] }); setEditingLocation(undefined); toast({ title: "เพิ่ม Location สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateLocationMut = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/platform/locations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/locations"] }); setEditingLocation(undefined); toast({ title: "บันทึก Location สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteLocationMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/locations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/locations"] }); queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] }); queryClient.invalidateQueries({ queryKey: ["/api/platform/routers"] }); toast({ title: "ลบ Location สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSaveLocation = (data: any) => {
    const cleaned = { ...data, parentId: data.parentId ? Number(data.parentId) : null };
    if (editingLocation === null) {
      createLocationMut.mutate(cleaned);
    } else if (editingLocation) {
      updateLocationMut.mutate({ id: editingLocation.id, ...cleaned });
    }
  };

  const createRouterMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/platform/routers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/routers"] }); setEditingRouter(undefined); toast({ title: "เพิ่ม Router สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateRouterMut = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/platform/routers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/routers"] }); setEditingRouter(undefined); toast({ title: "บันทึก Router สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteRouterMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/routers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/routers"] }); toast({ title: "ลบ Router สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const createDomainMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/platform/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/domains"] }); setEditingDomain(undefined); toast({ title: "เพิ่ม Domain สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateDomainMut = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/platform/domains/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/domains"] }); setEditingDomain(undefined); toast({ title: "บันทึก Domain สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteDomainMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platform/domains/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/domains"] }); toast({ title: "ลบ Domain สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSaveRouter = (data: any) => {
    const cleaned = { ...data, locationId: data.locationId ? Number(data.locationId) : null };
    if (editingRouter === null) {
      createRouterMut.mutate(cleaned);
    } else if (editingRouter) {
      updateRouterMut.mutate({ id: editingRouter.id, ...cleaned });
    }
  };

  const handleSaveDomain = (data: any) => {
    if (editingDomain === null) {
      createDomainMut.mutate(data);
    } else if (editingDomain) {
      updateDomainMut.mutate({ id: editingDomain.id, ...data });
    }
  };

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

  const targetDbMut = useMutation({
    mutationFn: async ({ id, targetDbMachineId }: { id: number; targetDbMachineId: number | null }) => {
      const res = await fetch(`/api/platform/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDbMachineId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      const target = vars.targetDbMachineId ? machines.find(m => m.id === vars.targetDbMachineId) : null;
      const label = vars.targetDbMachineId === vars.id ? "local DB" : target ? target.localName : "ยกเลิก";
      toast({ title: `เปลี่ยน Target DB เป็น ${label}` });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const officialMut = useMutation({
    mutationFn: async ({ id, isOfficial }: { id: number; isOfficial: boolean }) => {
      const res = await fetch(`/api/platform/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOfficial }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      toast({ title: vars.isOfficial ? "ตั้งเป็น Official แล้ว" : "ยกเลิก Official แล้ว" });
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
    const cleaned = { ...data, locationId: data.locationId ? Number(data.locationId) : null };
    if (editingMachine === null) {
      createMut.mutate(cleaned);
    } else if (editingMachine) {
      updateMut.mutate({ id: editingMachine.id, ...cleaned });
    }
  };

  const getLocationLabel = (m: MachineRecord) => {
    if (m.locationId) {
      const loc = locations.find(l => l.id === m.locationId);
      if (loc) {
        if (loc.parentId) {
          const parent = locations.find(p => p.id === loc.parentId);
          return parent ? `${parent.name} > ${loc.name}` : loc.name;
        }
        return loc.name;
      }
    }
    return m.physicalLocation || "ไม่ระบุสถานที่";
  };

  const locationGroups = (() => {
    const devCloud = machines.filter(m => m.role === "dev_source");
    const nonDev = machines.filter(m => m.role !== "dev_source");
    const groups: Record<string, MachineRecord[]> = {};
    nonDev.forEach(m => {
      const loc = getLocationLabel(m);
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(m);
    });
    return { devCloud, locationGroups: groups };
  })();

  const renderMachineGroup = (icon: React.ReactNode, label: string, items: MachineRecord[]) => {
    const officialCount = items.filter(m => m.isOfficial).length;
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
          {icon} {label} ({items.length})
          {officialCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 normal-case tracking-normal font-medium">
              <Star className="h-3 w-3 fill-amber-400" /> {officialCount} official
            </span>
          )}
        </h2>
        <div className="space-y-1">
          {[...items].sort((a, b) => (b.isOfficial ? 1 : 0) - (a.isOfficial ? 1 : 0)).map(m => (
            <MachineCard
              key={m.id}
              machine={m}
              onEdit={setEditingMachine}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onToggleOfficial={(id, val) => officialMut.mutate({ id, isOfficial: val })}
              allMachines={machines}
              onChangeTarget={(id, targetId) => targetDbMut.mutate({ id, targetDbMachineId: targetId })}
              allNics={allNics}
              allRouters={routersList}
              locations={locations}
              credentialsUnlocked={credentialsUnlocked}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto" data-testid="page-all-servers">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="h-7 w-7 text-[#fb9678]" />
              โครงสร้างพื้นฐาน
              {(machines.length + routersList.length + platformDomains.length + locations.length) > 0 && <Badge variant="outline" className="text-xs ml-1">{machines.length + routersList.length + platformDomains.length + locations.length} รายการ</Badge>}
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการเครื่อง, Router, Domain, Location และ Network ทั้งหมดในระบบ</p>
          </div>
          <div className="flex items-center gap-2">
            {credentialsUnlocked ? (
              <Button size="sm" variant="outline" className="h-8 text-xs border-green-400 text-green-700 bg-green-50" onClick={() => setCredentialsUnlocked(false)} data-testid="btn-lock-credentials">
                <Unlock className="h-3.5 w-3.5 mr-1" /> Credentials Unlocked
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => setShowPasswordPrompt(true)} data-testid="btn-unlock-credentials">
                <Lock className="h-3.5 w-3.5 mr-1" /> Unlock Credentials
              </Button>
            )}
            <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => setEditingMachine(null)} data-testid="button-add-machine">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มเครื่อง
            </Button>
          </div>
        </div>

        {serverIdentity && (
          <div className={`mb-4 p-3 rounded-lg border flex items-center gap-3 ${serverIdentity.isCloud ? "bg-purple-50 border-purple-200" : serverIdentity.matchedMachineId ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`} data-testid="server-identity-banner">
            <Monitor className={`h-4 w-4 shrink-0 ${serverIdentity.isCloud ? "text-purple-600" : "text-blue-600"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">
                <span className="text-gray-500">กำลังดูจากเครื่อง:</span>{" "}
                <span className={`font-bold ${serverIdentity.isCloud ? "text-purple-700" : "text-blue-700"}`}>
                  {serverIdentity.matchedMachineName || serverIdentity.machineName}
                </span>
                {serverIdentity.isCloud && <Badge className="ml-1.5 bg-purple-600 text-white text-[9px] px-1 py-0">Cloud</Badge>}
                {serverIdentity.matchedMachineId && (
                  <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300">
                    Machine #{serverIdentity.matchedMachineId}
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {serverIdentity.localIps.filter(i => !i.internal).map(i => i.ip).join(", ") || "no external IPs"}
                {serverIdentity.matchMethod && <span className="ml-2 text-green-500">(ตรวจพบโดย: {serverIdentity.matchMethod})</span>}
                {!serverIdentity.matchedMachineId && <span className="ml-2 text-red-400">(ไม่พบเครื่องนี้ในระบบ)</span>}
              </div>
            </div>
            <div className="text-[10px] text-amber-600 flex items-center gap-1 shrink-0">
              <AlertTriangle className="h-3 w-3" />
              <span>LAN connectivity แสดงจากข้อมูลที่บันทึกไว้ — ต้องดูจากเครื่องนั้นจึงจะทดสอบจริงได้</span>
            </div>
          </div>
        )}

        {showPasswordPrompt && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Master Password
            </h3>
            <p className="text-xs text-amber-600 mb-3">ใส่รหัสผ่านเพื่อดู Credentials ของ Router, Domain และ Machine</p>
            <div className="flex gap-2 max-w-md">
              <Input
                type="password"
                className="h-8 text-sm"
                placeholder="Master password"
                value={masterPwInput}
                onChange={e => setMasterPwInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && masterPwInput) verifyPasswordMut.mutate(masterPwInput); }}
                data-testid="input-master-password"
              />
              <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => verifyPasswordMut.mutate(masterPwInput)} disabled={!masterPwInput || verifyPasswordMut.isPending} data-testid="btn-verify-password">
                <Unlock className="h-3.5 w-3.5 mr-1" /> ปลดล็อค
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowPasswordPrompt(false); setMasterPwInput(""); }}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {machines.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg">ยังไม่มีเครื่องในระบบ</p>
                <p className="text-sm">กด "เพิ่มเครื่อง" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="space-y-6">
                {locationGroups.devCloud.length > 0 && renderMachineGroup(<Cloud className="h-4 w-4" />, "Dev / Cloud", locationGroups.devCloud)}
                {Object.entries(locationGroups.locationGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([location, items]) => (
                    <div key={location}>
                      {renderMachineGroup(<MapPin className="h-4 w-4 text-red-400" />, location, items)}
                    </div>
                  ))}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Locations ({locations.length})
                </h2>
                <Button size="sm" variant="outline" className="h-7 text-xs border-purple-400 text-purple-700 hover:bg-purple-50" onClick={() => setEditingLocation(null)} data-testid="button-add-location">
                  <Plus className="h-3 w-3 mr-1" /> เพิ่ม Location
                </Button>
              </div>
              {locations.length === 0 ? (
                <div className="text-center py-4 text-gray-400 border rounded-lg border-dashed">
                  <MapPin className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  <p className="text-sm">ยังไม่มี Location — เพิ่มบริษัท/สาขาก่อน</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {locations.filter(l => !l.parentId).map(parent => {
                    const children = locations.filter(c => c.parentId === parent.id);
                    const linkedRouters = routersList.filter(r => r.locationId === parent.id);
                    const linkedMachineCount = machines.filter(m => m.locationId === parent.id).length;
                    return (
                      <div key={parent.id} className="border border-purple-200 rounded-lg bg-purple-50/30">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <MapPin className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="font-bold text-sm text-purple-900">{parent.name}</span>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-[10px] px-1.5 py-0">
                            {parent.locationType === "company" ? "บริษัท" : parent.locationType === "branch" ? "สาขา" : parent.locationType}
                          </Badge>
                          {linkedRouters.length > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-teal-50 text-teal-700 border-teal-300">
                              <Router className="h-2.5 w-2.5 mr-0.5" />{linkedRouters.length}
                            </Badge>
                          )}
                          {linkedMachineCount > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-300">
                              <Server className="h-2.5 w-2.5 mr-0.5" />{linkedMachineCount}
                            </Badge>
                          )}
                          {parent.address && <span className="text-[10px] text-gray-400 truncate ml-auto hidden md:inline">{parent.address}</span>}
                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-500 hover:bg-purple-100" onClick={() => setEditingLocation(parent)} data-testid={`btn-edit-loc-${parent.id}`}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:bg-red-50" onClick={() => { if (confirm(`ลบ Location "${parent.name}"?`)) deleteLocationMut.mutate(parent.id); }} data-testid={`btn-del-loc-${parent.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {children.length > 0 && (
                          <div className="px-3 pb-2 space-y-0.5">
                            {children.map(child => {
                              const childRouters = routersList.filter(r => r.locationId === child.id);
                              const childMachines = machines.filter(m => m.locationId === child.id).length;
                              return (
                                <div key={child.id} className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-purple-100 ml-4">
                                  <span className="text-gray-300 text-xs">└</span>
                                  <span className="text-sm font-medium text-purple-800">{child.name}</span>
                                  <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-[9px] px-1 py-0">
                                    {child.locationType === "branch" ? "สาขา" : child.locationType}
                                  </Badge>
                                  {childRouters.length > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-teal-50 text-teal-600 border-teal-200">
                                      <Router className="h-2 w-2 mr-0.5" />{childRouters.length}
                                    </Badge>
                                  )}
                                  {childMachines > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200">
                                      <Server className="h-2 w-2 mr-0.5" />{childMachines}
                                    </Badge>
                                  )}
                                  {child.address && <span className="text-[9px] text-gray-400 truncate hidden md:inline">{child.address}</span>}
                                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-purple-500 hover:bg-purple-100" onClick={() => setEditingLocation(child)} data-testid={`btn-edit-loc-${child.id}`}>
                                      <Pencil className="h-2.5 w-2.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-400 hover:bg-red-50" onClick={() => { if (confirm(`ลบ Location "${child.name}"?`)) deleteLocationMut.mutate(child.id); }} data-testid={`btn-del-loc-${child.id}`}>
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Router className="h-4 w-4" /> Routers ({routersList.length})
                </h2>
                <Button size="sm" variant="outline" className="h-7 text-xs border-teal-400 text-teal-700 hover:bg-teal-50" onClick={() => setEditingRouter(null)} data-testid="button-add-router">
                  <Plus className="h-3 w-3 mr-1" /> เพิ่ม Router
                </Button>
              </div>
              {routersList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 border rounded-lg border-dashed">
                  <Router className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มี Router ในระบบ</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {routersList.map(r => (
                    <RouterCard
                      key={r.id}
                      router={r}
                      domains={platformDomains}
                      allNics={allNics}
                      machines={machines}
                      portForwards={allPortForwards}
                      locations={locations}
                      expanded={expandedRouterId === r.id}
                      onToggle={() => setExpandedRouterId(expandedRouterId === r.id ? null : r.id)}
                      onEdit={setEditingRouter}
                      onDelete={(id) => deleteRouterMut.mutate(id)}
                      credentialsUnlocked={credentialsUnlocked}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Domains ({platformDomains.length})
                </h2>
                <Button size="sm" variant="outline" className="h-7 text-xs border-indigo-400 text-indigo-700 hover:bg-indigo-50" onClick={() => setEditingDomain(null)} data-testid="button-add-domain">
                  <Plus className="h-3 w-3 mr-1" /> เพิ่ม Domain
                </Button>
              </div>
              {platformDomains.length === 0 ? (
                <div className="text-center py-6 text-gray-400 border rounded-lg border-dashed">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ยังไม่มี Domain ในระบบ</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {platformDomains.map(d => (
                    <DomainCard
                      key={d.id}
                      domain={d}
                      routers={routersList}
                      machines={machines}
                      expanded={expandedDomainId === d.id}
                      onToggle={() => setExpandedDomainId(expandedDomainId === d.id ? null : d.id)}
                      onEdit={setEditingDomain}
                      onDelete={(id) => deleteDomainMut.mutate(id)}
                      credentialsUnlocked={credentialsUnlocked}
                    />
                  ))}
                </div>
              )}
            </div>

            <CloneHistoryTargetCard machines={machines} />

            <WhatIfBenchmark machines={machines} />

            <DbHealthLog />

            <EncryptionKeyGenerator machines={machines} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] })} />
          </div>
        )}

        {editingMachine !== undefined && (
          <EditMachineDialog
            machine={editingMachine}
            locations={locations}
            onSave={handleSave}
            onCancel={() => setEditingMachine(undefined)}
            onDelete={(id) => deleteMut.mutate(id)}
            saving={createMut.isPending || updateMut.isPending}
          />
        )}

        {editingLocation !== undefined && (
          <EditLocationDialog
            location={editingLocation}
            allLocations={locations}
            onSave={handleSaveLocation}
            onCancel={() => setEditingLocation(undefined)}
            saving={createLocationMut.isPending || updateLocationMut.isPending}
          />
        )}

        {editingRouter !== undefined && (
          <EditRouterDialog
            router={editingRouter}
            locations={locations}
            onSave={handleSaveRouter}
            onCancel={() => setEditingRouter(undefined)}
            saving={createRouterMut.isPending || updateRouterMut.isPending}
          />
        )}

        {editingDomain !== undefined && (
          <EditDomainDialog
            domain={editingDomain}
            routers={routersList}
            machines={machines}
            onSave={handleSaveDomain}
            onCancel={() => setEditingDomain(undefined)}
            saving={createDomainMut.isPending || updateDomainMut.isPending}
          />
        )}
      </div>
    </PlatformLayout>
  );
}
