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
  Key, Shield, Copy, Download, Lock, Unlock, History, AlertTriangle,
  ChevronDown, ChevronRight, Star, Network, Plug, Radio,
  Router, ExternalLink, Phone, Link2,
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
  envContent: string | null;
  isOfficial: boolean;
  targetDbMachineId: number | null;
  routerId: number | null;
  internetType: string;
  physicalLocation: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RouterRecord {
  id: number;
  name: string;
  model: string | null;
  lanIp: string | null;
  adminUrl: string | null;
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
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RouterDomainRecord {
  id: number;
  routerId: number;
  domainName: string;
  noipManageUrl: string | null;
  noipUsername: string | null;
  noipPassword: string | null;
  notes: string | null;
  createdAt?: string;
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

function RouterCard({ router, domains, machines, expanded, onToggle, onEdit, onDelete, onAddDomain, onDeleteDomain }: {
  router: RouterRecord;
  domains: RouterDomainRecord[];
  machines: MachineRecord[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (r: RouterRecord) => void;
  onDelete: (id: number) => void;
  onAddDomain: (routerId: number, data: { domainName: string; noipManageUrl?: string; noipUsername?: string; noipPassword?: string }) => void;
  onDeleteDomain: (domainId: number) => void;
}) {
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainForm, setDomainForm] = useState({ domainName: "", noipManageUrl: "", noipUsername: "", noipPassword: "" });
  const [showPw, setShowPw] = useState<Record<number, boolean>>({});
  const connectedMachines = machines.filter(m => m.routerId === router.id);
  const myDomains = domains.filter(d => d.routerId === router.id);

  return (
    <div className={`border rounded-lg transition-all border-teal-300 bg-teal-50/30 ${expanded ? "shadow-md" : "hover:shadow-sm"}`} data-testid={`card-router-${router.id}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left" data-testid={`btn-toggle-router-${router.id}`}>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        <Router className="h-4 w-4 text-teal-600 shrink-0" />
        <span className="font-bold text-sm text-teal-900 truncate">{router.name}</span>
        {router.lanIp && <span className="text-xs font-mono text-teal-600 hidden sm:inline">{router.lanIp}</span>}
        {router.ispName && <span className="text-xs text-gray-400 hidden sm:inline">({router.ispName})</span>}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {myDomains.length > 0 && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-300 text-[10px] px-1.5 py-0">
              <Globe className="h-2.5 w-2.5 mr-0.5" />{myDomains.length} domain{myDomains.length > 1 ? "s" : ""}
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
            {router.physicalLocation && (
              <div>
                <span className="text-gray-400 text-xs block">สถานที่ตั้ง</span>
                <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-red-400" />{router.physicalLocation}</span>
              </div>
            )}
          </div>

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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><Globe className="h-3 w-3" /> DDNS Domains ({myDomains.length})</h5>
              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={e => { e.stopPropagation(); setAddingDomain(!addingDomain); }} data-testid={`btn-add-domain-${router.id}`}>
                <Plus className="h-2.5 w-2.5 mr-0.5" /> เพิ่ม Domain
              </Button>
            </div>
            {myDomains.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-1.5 bg-white border rounded text-xs group" data-testid={`domain-row-${d.id}`}>
                <Globe className="h-3 w-3 text-indigo-500 shrink-0" />
                <span className="font-mono font-medium text-indigo-700">{d.domainName}</span>
                {d.noipUsername && (
                  <span className="text-gray-400 hidden sm:inline">
                    user: <span className="font-mono">{d.noipUsername}</span>
                  </span>
                )}
                {d.noipPassword && (
                  <span className="text-gray-400 hidden sm:inline">
                    pw: <span className="font-mono">{showPw[d.id] ? d.noipPassword : "••••"}</span>
                    <button onClick={e => { e.stopPropagation(); setShowPw(p => ({ ...p, [d.id]: !p[d.id] })); }} className="ml-0.5 p-0.5 hover:bg-gray-200 rounded">
                      {showPw[d.id] ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    </button>
                  </span>
                )}
                {d.noipManageUrl && (
                  <a href={d.noipManageUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700" data-testid={`link-noip-${d.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); if (confirm(`ลบ domain ${d.domainName}?`)) onDeleteDomain(d.id); }} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-400 transition-opacity" data-testid={`btn-delete-domain-${d.id}`}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {addingDomain && (
              <div className="p-2 bg-indigo-50/50 border border-indigo-200 rounded space-y-2" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px] text-gray-500">Domain *</Label>
                    <Input className="h-7 text-xs font-mono" placeholder="deep-main.hopto.org" value={domainForm.domainName} onChange={e => setDomainForm({ ...domainForm, domainName: e.target.value })} data-testid={`input-domain-name-${router.id}`} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">noIP Username</Label>
                    <Input className="h-7 text-xs font-mono" value={domainForm.noipUsername} onChange={e => setDomainForm({ ...domainForm, noipUsername: e.target.value })} data-testid={`input-noip-user-${router.id}`} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">noIP Password</Label>
                    <Input className="h-7 text-xs font-mono" type="password" value={domainForm.noipPassword} onChange={e => setDomainForm({ ...domainForm, noipPassword: e.target.value })} data-testid={`input-noip-pw-${router.id}`} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">noIP Manage URL</Label>
                    <Input className="h-7 text-xs font-mono" placeholder="https://my.noip.com/..." value={domainForm.noipManageUrl} onChange={e => setDomainForm({ ...domainForm, noipManageUrl: e.target.value })} data-testid={`input-noip-url-${router.id}`} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setAddingDomain(false)}>ยกเลิก</Button>
                  <Button size="sm" className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700" onClick={() => { onAddDomain(router.id, domainForm); setAddingDomain(false); setDomainForm({ domainName: "", noipManageUrl: "", noipUsername: "", noipPassword: "" }); }} disabled={!domainForm.domainName} data-testid={`btn-save-domain-${router.id}`}>
                    <Check className="h-2.5 w-2.5 mr-0.5" /> บันทึก
                  </Button>
                </div>
              </div>
            )}
          </div>

          {connectedMachines.length > 0 && (
            <div className="p-2 bg-teal-50 border border-teal-200 rounded">
              <h5 className="text-[10px] font-semibold text-teal-700 mb-1 flex items-center gap-1"><Server className="h-3 w-3" /> เครื่องที่อยู่หลัง Router นี้</h5>
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

function EditRouterDialog({ router, onSave, onCancel, saving }: { router: RouterRecord | null; onSave: (data: any) => void; onCancel: () => void; saving?: boolean }) {
  const isNew = !router;
  const [form, setForm] = useState({
    name: router?.name || "",
    model: router?.model || "",
    lanIp: router?.lanIp || "",
    adminUrl: router?.adminUrl || "",
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
              <Label className="text-sm font-medium">สถานที่ตั้ง</Label>
              <Input value={form.physicalLocation} onChange={e => setForm({ ...form, physicalLocation: e.target.value })} placeholder="เช่น บ้านพี่ช้าง" data-testid="input-router-location" />
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

function NicSection({ machineId, allNics, allMachines }: { machineId: number; allNics: NicRecord[]; allMachines: MachineRecord[] }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nicName: "", macAddress: "", ipAddress: "", subnetMask: "255.255.255.0", forwardedFor: "", forwardedPort: "", notes: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const myNics = allNics.filter(n => n.machineId === machineId);
  const otherNics = allNics.filter(n => n.machineId !== machineId);

  const lanPeers = new Map<number, { machineName: string; viaIp: string; peerIp: string }>();
  for (const myNic of myNics) {
    for (const otherNic of otherNics) {
      if (!lanPeers.has(otherNic.machineId) && sameSubnet(myNic.ipAddress, otherNic.ipAddress, myNic.subnetMask, otherNic.subnetMask)) {
        const peer = allMachines.find(m => m.id === otherNic.machineId);
        if (peer) lanPeers.set(otherNic.machineId, { machineName: peer.localName, viaIp: myNic.ipAddress, peerIp: otherNic.ipAddress });
      }
    }
  }

  const addMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/platform/machines/${machineId}/nics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nics"] }); setAdding(false); setForm({ nicName: "", macAddress: "", ipAddress: "", subnetMask: "255.255.255.0", forwardedFor: "", forwardedPort: "", notes: "" }); toast({ title: "เพิ่ม NIC แล้ว" }); },
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
        const FwdIcon = fwd?.icon || Plug;
        return (
          <div key={nic.id} className="flex items-center gap-2 p-2 bg-white border rounded text-xs group" data-testid={`nic-row-${nic.id}`}>
            <Plug className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-medium text-gray-700 w-24 truncate">{nic.nicName}</span>
            <span className="font-mono text-blue-600 font-bold">{nic.ipAddress}</span>
            <span className="font-mono text-gray-400 text-[10px]">/{nic.subnetMask}</span>
            {nic.macAddress && <span className="font-mono text-gray-400 text-[10px] hidden lg:inline">{nic.macAddress}</span>}
            {fwd && (
              <Badge variant="outline" className={`${fwd.color} text-[10px] px-1.5 py-0 flex items-center gap-0.5`}>
                <Radio className="h-2.5 w-2.5" />
                Forwarded → {fwd.label}
                {nic.forwardedFor === "db" && nic.forwardedPort && <span className="font-mono">:{nic.forwardedPort}</span>}
              </Badge>
            )}
            {!fwd && <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300 text-[10px] px-1.5 py-0">LAN only</Badge>}
            {nic.notes && <span className="text-gray-400 italic truncate hidden md:inline">{nic.notes}</span>}
            <button onClick={(e) => { e.stopPropagation(); if (confirm("ลบ NIC นี้?")) deleteMut.mutate(nic.id); }} className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded text-red-400 transition-opacity" data-testid={`btn-delete-nic-${nic.id}`}>
              <Trash2 className="h-3 w-3" />
            </button>
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
          <div className="flex flex-wrap gap-1.5">
            {Array.from(lanPeers.entries()).map(([peerId, info]) => (
              <Badge key={peerId} variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] px-1.5 py-0.5">
                {info.machineName}
                <span className="font-mono ml-1 text-green-600">{info.peerIp}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MachineCard({ machine, onEdit, expanded, onToggle, onToggleOfficial, allMachines, onChangeTarget, allNics }: {
  machine: MachineRecord;
  onEdit: (m: MachineRecord) => void;
  expanded: boolean;
  onToggle: () => void;
  onToggleOfficial: (id: number, val: boolean) => void;
  allMachines: MachineRecord[];
  onChangeTarget: (id: number, targetId: number | null) => void;
  allNics: NicRecord[];
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
            <div>
              <span className="text-gray-400 text-xs block">DB</span>
              <span className="font-mono text-xs">{machine.dbName}:{machine.dbPort}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">DB User</span>
              <span className="font-mono text-xs">{machine.dbUser}</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs block">DB Password</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs">{showPw ? machine.dbPassword : "••••••••"}</span>
                <button onClick={e => { e.stopPropagation(); setShowPw(!showPw); }} className="p-0.5 hover:bg-gray-200 rounded" data-testid={`btn-toggle-pw-${machine.id}`}>
                  {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
            {machine.physicalLocation && (
              <div>
                <span className="text-gray-400 text-xs block">สถานที่ตั้ง</span>
                <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3 text-red-400" />{machine.physicalLocation}</span>
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

          <NicSection machineId={machine.id} allNics={allNics} allMachines={allMachines} />

          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <Database className="h-4 w-4 text-purple-500 shrink-0" />
            <span className="text-xs font-medium text-gray-600 shrink-0">Target DB:</span>
            <Select
              value={machine.targetDbMachineId ? String(machine.targetDbMachineId) : "none"}
              onValueChange={(val) => {
                const newTarget = val === "none" ? null : parseInt(val, 10);
                onChangeTarget(machine.id, newTarget);
              }}
            >
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
            {targetDb && !isSelfTarget && (
              <span className="text-[10px] text-gray-400 font-mono hidden lg:inline">{targetDb.domainName || targetDb.lanIp || ""}</span>
            )}
          </div>

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
    envContent: machine?.envContent || "",
    internetType: machine?.internetType || "dynamic",
    physicalLocation: machine?.physicalLocation || "",
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Internet Type</Label>
              <Select value={form.internetType} onValueChange={(v: any) => setForm({ ...form, internetType: v })}>
                <SelectTrigger data-testid="select-internet-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic IP (ใช้ DDNS)</SelectItem>
                  <SelectItem value="fixed">Fixed IP (คงที่)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">สถานที่ตั้ง</Label>
              <Input value={form.physicalLocation} onChange={e => setForm({ ...form, physicalLocation: e.target.value })} placeholder="เช่น บ้านพี่ช้าง ห้องเซิร์ฟเวอร์" data-testid="input-physical-location" />
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

  const { data: allDomains = [] } = useQuery<RouterDomainRecord[]>({
    queryKey: ["/api/platform/all-router-domains"],
  });

  const [editingRouter, setEditingRouter] = useState<RouterRecord | null | undefined>(undefined);
  const [expandedRouterId, setExpandedRouterId] = useState<number | null>(null);

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

  const addDomainMut = useMutation({
    mutationFn: async ({ routerId, ...data }: any) => {
      const res = await fetch(`/api/platform/routers/${routerId}/domains`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-router-domains"] }); toast({ title: "เพิ่ม Domain สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteDomainMut = useMutation({
    mutationFn: async (domainId: number) => {
      const res = await fetch(`/api/platform/router-domains/${domainId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/platform/all-router-domains"] }); toast({ title: "ลบ Domain สำเร็จ" }); },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSaveRouter = (data: any) => {
    if (editingRouter === null) {
      createRouterMut.mutate(data);
    } else if (editingRouter) {
      updateRouterMut.mutate({ id: editingRouter.id, ...data });
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
    if (editingMachine === null) {
      createMut.mutate(data);
    } else if (editingMachine) {
      updateMut.mutate({ id: editingMachine.id, ...data });
    }
  };

  return (
    <PlatformLayout>
      <div className="max-w-7xl mx-auto" data-testid="page-all-servers">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="h-7 w-7 text-[#fb9678]" />
              เซิร์ฟเวอร์ทั้งหมด
              {machines.length > 0 && <Badge variant="outline" className="text-xs ml-1">{machines.length} เครื่อง</Badge>}
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการเครื่อง App Server และ Database Server ทั้งหมดที่ใช้ในระบบ</p>
          </div>
          <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => setEditingMachine(null)} data-testid="button-add-machine">
            <Plus className="h-4 w-4 mr-1" /> เพิ่มเครื่องใหม่
          </Button>
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
        ) : (() => {
          const devCloud = machines.filter(m => m.role === "dev_source");
          const nonDev = machines.filter(m => m.role !== "dev_source");
          const dbServers = nonDev.filter(m => m.serverType === "database");
          const appServers = nonDev.filter(m => m.serverType === "app" || m.serverType === "app_database");
          const others = nonDev.filter(m => !dbServers.includes(m) && !appServers.includes(m));
          const renderGroup = (icon: React.ReactNode, label: string, items: MachineRecord[]) => {
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
                    />
                  ))}
                </div>
              </div>
            );
          };
          return (
            <div className="space-y-6">
              {devCloud.length > 0 && renderGroup(<Cloud className="h-4 w-4" />, "Dev / Cloud", devCloud)}
              {dbServers.length > 0 && renderGroup(<Database className="h-4 w-4" />, "Database Servers", dbServers)}
              {appServers.length > 0 && renderGroup(<Monitor className="h-4 w-4" />, "App Servers", appServers)}
              {others.length > 0 && renderGroup(<Server className="h-4 w-4" />, "อื่นๆ", others)}
            </div>
          );
        })()}

        <div className="mt-8">
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
                  domains={allDomains}
                  machines={machines}
                  expanded={expandedRouterId === r.id}
                  onToggle={() => setExpandedRouterId(expandedRouterId === r.id ? null : r.id)}
                  onEdit={setEditingRouter}
                  onDelete={(id) => deleteRouterMut.mutate(id)}
                  onAddDomain={(routerId, data) => addDomainMut.mutate({ routerId, ...data })}
                  onDeleteDomain={(domainId) => deleteDomainMut.mutate(domainId)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <CloneHistoryTargetCard machines={machines} />
        </div>

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

        {editingRouter !== undefined && (
          <EditRouterDialog
            router={editingRouter}
            onSave={handleSaveRouter}
            onCancel={() => setEditingRouter(undefined)}
            saving={createRouterMut.isPending || updateRouterMut.isPending}
          />
        )}
      </div>
    </PlatformLayout>
  );
}
