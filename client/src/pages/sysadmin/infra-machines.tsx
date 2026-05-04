// [sys-k7x9] Dedicated Machines page — shows machines ONLY (no Locations / Routers / Domains).
// Part of the /sys-k7x9 SysAdmin portal.  Route is registered in app-extra.tsx via matchInfraMachines().
// DO NOT import this from App.tsx — use app-extra.tsx pattern.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SysAdminLayout from "@/components/sysadmin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Plus, Eye, EyeOff, Pencil, Trash2, Check, X,
  MonitorSmartphone, Cloud, Monitor, RefreshCw,
  ArrowRight, Database, MapPin,
  Shield, Lock, Unlock, AlertTriangle,
  ChevronDown, ChevronRight, Star, Network, Radio,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MachineRecord {
  id: number;
  localName: string;
  displayName: string | null;
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
  repoName: string | null;
  repoUrl: string | null;
  repoBranch: string | null;
  encContent: string | null;
  envContent: string | null;
  isOfficial: boolean;
  targetDbMachineId: number | null;
  routerId: number | null;
  internetType: string;
  sysadminEmail: string | null;
  sysadminLineId: string | null;
  sysadminFolder: string | null;
  physicalLocation: string | null;
  locationId: number | null;
}

interface LocationRecord {
  id: number;
  name: string;
  locationType: string;
  parentId: number | null;
  address: string | null;
  notes: string | null;
}

interface RouterRecord {
  id: number;
  name: string;
  lanIp: string | null;
}

interface NicRecord {
  id: number;
  machineId: number;
  nicName: string;
  macAddress: string | null;
  ipAddress: string;
  forwardedFor: string | null;
  routerId: number | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const OS_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  windows: { icon: Monitor,           label: "Windows",         color: "text-blue-600 bg-blue-50 border-blue-200" },
  linux:   { icon: MonitorSmartphone, label: "Linux (aaPanel)", color: "text-orange-600 bg-orange-50 border-orange-200" },
  cloud:   { icon: Cloud,             label: "Cloud",           color: "text-purple-600 bg-purple-50 border-purple-200" },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  dev_source: { label: "Dev Source", color: "text-cyan-700",   bgColor: "bg-cyan-100" },
  production: { label: "Production", color: "text-green-700",  bgColor: "bg-green-100" },
  testing:    { label: "Testing",    color: "text-yellow-700", bgColor: "bg-yellow-100" },
  backup:     { label: "Backup",     color: "text-gray-700",   bgColor: "bg-gray-100" },
};

// ─── MachineCard ──────────────────────────────────────────────────────────────

function MachineCard({
  machine, expanded, onToggle, onEdit, onToggleOfficial,
  allMachines, allNics, credentialsUnlocked,
}: {
  machine: MachineRecord;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (m: MachineRecord) => void;
  onToggleOfficial: (id: number, val: boolean) => void;
  allMachines: MachineRecord[];
  allNics: NicRecord[];
  credentialsUnlocked: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const osConfig = OS_CONFIG[machine.os] || OS_CONFIG.linux;
  const roleConfig = ROLE_CONFIG[machine.role] || ROLE_CONFIG.testing;
  const OsIcon = osConfig.icon;
  const isOfficial = machine.isOfficial;
  const targetDb = machine.targetDbMachineId
    ? allMachines.find(m => m.id === machine.targetDbMachineId)
    : null;
  const isSelfTarget = machine.targetDbMachineId === machine.id;
  const targetLabel = isSelfTarget ? "local DB" : targetDb ? targetDb.localName : null;
  const myNics = allNics.filter(n => n.machineId === machine.id);
  const hasForwarding = myNics.some(n => n.forwardedFor);

  return (
    <div
      className={`border rounded-lg transition-all ${isOfficial ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300" : osConfig.color} ${expanded ? "shadow-md" : "hover:shadow-sm"}`}
      data-testid={`card-machine-${machine.id}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        data-testid={`btn-toggle-machine-${machine.id}`}
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
        {isOfficial && <Star className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0" />}
        <OsIcon className="h-4 w-4 shrink-0" />
        <span className={`font-bold text-sm truncate ${isOfficial ? "text-amber-900" : ""}`}>
          {machine.localName}
        </span>
        {targetLabel && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
            <ArrowRight className="h-3 w-3" />
            <Database className="h-3 w-3" />
            <span className={`font-mono ${isSelfTarget ? "text-blue-500" : "text-purple-500"}`}>{targetLabel}</span>
          </span>
        )}
        <span className="text-xs text-gray-400 font-mono truncate hidden md:inline">
          {machine.domainName || machine.lanIp || ""}
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Badge className={`${roleConfig.bgColor} ${roleConfig.color} text-[10px] px-1.5 py-0`}>
            {roleConfig.label}
          </Badge>
          {myNics.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <Network className="h-3 w-3" />
              {myNics.length}
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
              <span className="text-gray-400 text-xs block">LAN IP</span>
              <span className="font-mono text-xs">{machine.lanIp || "—"}</span>
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
            {credentialsUnlocked ? (
              <>
                <div>
                  <span className="text-gray-400 text-xs block">DB User</span>
                  <span className="font-mono text-xs">{machine.dbUser}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">DB Password</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{showPw ? machine.dbPassword : "••••••••"}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setShowPw(!showPw); }}
                      className="p-0.5 hover:bg-gray-200 rounded"
                      data-testid={`btn-toggle-pw-${machine.id}`}
                    >
                      {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <span className="text-gray-400 text-xs block">DB Credentials</span>
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              </div>
            )}
            {machine.repoName && (
              <div>
                <span className="text-gray-400 text-xs block">Repo</span>
                <span className="text-xs font-mono">
                  {machine.repoName}{machine.repoBranch && machine.repoBranch !== "main" ? ` (${machine.repoBranch})` : ""}
                </span>
              </div>
            )}
            {machine.sysadminEmail && (
              <div>
                <span className="text-gray-400 text-xs block">Sysadmin Email</span>
                <span className="text-xs font-mono">{machine.sysadminEmail}</span>
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

          {machine.notes && (
            <p className="text-xs text-gray-400 italic">{machine.notes}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs ${isOfficial ? "border-amber-400 text-amber-700 hover:bg-amber-100" : "border-gray-300 text-gray-500 hover:bg-gray-100"}`}
              onClick={e => { e.stopPropagation(); onToggleOfficial(machine.id, !isOfficial); }}
              data-testid={`btn-official-machine-${machine.id}`}
            >
              <Star className={`h-3 w-3 mr-1 ${isOfficial ? "fill-amber-400 text-amber-500" : ""}`} />
              {isOfficial ? "ยกเลิก Official" : "ตั้งเป็น Official"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={e => { e.stopPropagation(); onEdit(machine); }}
              data-testid={`btn-edit-machine-${machine.id}`}
            >
              <Pencil className="h-3 w-3 mr-1" /> แก้ไข
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EditMachineDialog ────────────────────────────────────────────────────────

function EditMachineDialog({
  machine, locations, routers, onSave, onCancel, onDelete, saving,
}: {
  machine: MachineRecord | null;
  locations: LocationRecord[];
  routers: RouterRecord[];
  onSave: (data: any) => void;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  saving?: boolean;
}) {
  const isNew = !machine;
  const [showDbPw, setShowDbPw] = useState(false);
  const [form, setForm] = useState({
    localName:        machine?.localName        || "",
    displayName:      machine?.displayName      || "",
    windowsName:      machine?.windowsName      || "",
    fqdn:             machine?.fqdn             || "",
    domainName:       machine?.domainName       || "",
    lanIp:            machine?.lanIp            || "",
    wanIp:            machine?.wanIp            || "",
    os:               machine?.os               || "windows",
    serverType:       machine?.serverType       || "app_database",
    role:             machine?.role             || "testing",
    cpuModel:         machine?.cpuModel         || "",
    ramSize:          machine?.ramSize          || "",
    machineModel:     machine?.machineModel     || "",
    dbPort:           machine?.dbPort           || "5432",
    dbName:           machine?.dbName           || "",
    dbUser:           machine?.dbUser           || "",
    dbPassword:       machine?.dbPassword       || "",
    notes:            machine?.notes            || "",
    envContent:       machine?.envContent       || "",
    internetType:     machine?.internetType     || "dynamic",
    routerId:         machine?.routerId ? String(machine.routerId) : "",
    repoName:         machine?.repoName         || "",
    repoUrl:          machine?.repoUrl          || "",
    repoBranch:       machine?.repoBranch       || "main",
    sysadminEmail:    machine?.sysadminEmail    || "",
    sysadminLineId:   machine?.sysadminLineId   || "",
    physicalLocation: machine?.physicalLocation || "",
    locationId:       machine?.locationId ? String(machine.locationId) : "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="dialog-edit-machine">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">
            {isNew ? "เพิ่มเครื่องใหม่" : `แก้ไข: ${machine.localName}`}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* ชื่อเครื่อง */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ชื่อเครื่อง (ชื่อเรียก) *</Label>
              <Input value={form.localName} onChange={e => setForm({ ...form, localName: e.target.value })} placeholder="เช่น server-e5, etaxerp" data-testid="input-local-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">ชื่อแสดงผล (สำหรับผู้ใช้)</Label>
              <Input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="เช่น etax1, etax2" data-testid="input-display-name" />
              <p className="text-xs text-muted-foreground mt-0.5">ชื่อที่ผู้ใช้เห็นเมื่อเลือกเซิร์ฟเวอร์</p>
            </div>
          </div>

          {/* Network */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Domain Name</Label>
              <Input value={form.domainName} onChange={e => setForm({ ...form, domainName: e.target.value })} placeholder="เช่น deep-main.hopto.org" data-testid="input-domain-name" />
            </div>
            <div>
              <Label className="text-sm font-medium">Windows Computer Name</Label>
              <Input value={form.windowsName} onChange={e => setForm({ ...form, windowsName: e.target.value })} placeholder="เช่น ETAXERP-PC" data-testid="input-windows-name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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

          {/* Location */}
          <div>
            <Label className="text-sm font-medium">สถานที่ตั้ง (Location)</Label>
            <Select value={form.locationId || "none"} onValueChange={v => setForm({ ...form, locationId: v === "none" ? "" : v })}>
              <SelectTrigger data-testid="select-machine-location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                {locations.filter(l => !l.parentId).map(parent => {
                  const children = locations.filter(c => c.parentId === parent.id);
                  return [
                    <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>,
                    ...children.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>&nbsp;&nbsp;└ {c.name}</SelectItem>
                    )),
                  ];
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Hardware */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">ข้อมูลฮาร์ดแวร์</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">รุ่นเครื่อง</Label>
                <Input value={form.machineModel} onChange={e => setForm({ ...form, machineModel: e.target.value })} placeholder="เช่น Dell OptiPlex 7060" data-testid="input-machine-model" />
              </div>
              <div>
                <Label className="text-sm font-medium">CPU</Label>
                <Input value={form.cpuModel} onChange={e => setForm({ ...form, cpuModel: e.target.value })} placeholder="เช่น Xeon E3-1280 V2" data-testid="input-cpu-model" />
              </div>
              <div>
                <Label className="text-sm font-medium">RAM</Label>
                <Input value={form.ramSize} onChange={e => setForm({ ...form, ramSize: e.target.value })} placeholder="เช่น 32GB DDR3" data-testid="input-ram-size" />
              </div>
            </div>
          </div>

          {/* OS / Type / Role */}
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

          {/* Internet / Router */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Internet Type</Label>
              <Select value={form.internetType} onValueChange={(v: any) => setForm({ ...form, internetType: v })}>
                <SelectTrigger data-testid="select-internet-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed IP</SelectItem>
                  <SelectItem value="dynamic">Dynamic (DDNS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Router</Label>
              <Select value={form.routerId || "none"} onValueChange={v => setForm({ ...form, routerId: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="select-machine-router"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- ยังไม่กำหนด --</SelectItem>
                  {routers.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} {r.lanIp ? `(${r.lanIp})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Git */}
          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Git Repository</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Repo Name</Label>
                  <Select value={form.repoName || "none"} onValueChange={v => setForm({ ...form, repoName: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="select-repo-name"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- ยังไม่กำหนด --</SelectItem>
                      <SelectItem value="github-production">github-production</SelectItem>
                      <SelectItem value="github-dev">github-dev</SelectItem>
                      <SelectItem value="replit">replit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Repo URL</Label>
                  <Input className="font-mono text-xs" value={form.repoUrl} onChange={e => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/..." data-testid="input-repo-url" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Branch</Label>
                  <Input className="font-mono" value={form.repoBranch} onChange={e => setForm({ ...form, repoBranch: e.target.value })} placeholder="main" data-testid="input-repo-branch" />
                </div>
              </div>
            </div>
          )}

          {/* DB */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Local Config Database</h3>
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
                <Input className="font-mono flex-1" type={showDbPw ? "text" : "password"} value={form.dbPassword} onChange={e => setForm({ ...form, dbPassword: e.target.value })} placeholder="รหัสผ่าน" data-testid="input-db-password" />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowDbPw(!showDbPw)} data-testid="btn-toggle-password">
                  {showDbPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* .env */}
          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold flex items-center gap-1 mb-2">
                <Shield className="h-4 w-4" /> .env (Environment Variables)
              </Label>
              <textarea
                className="w-full font-mono text-sm border rounded-lg p-3 bg-gray-900 text-green-400 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-[#fb9678]"
                value={form.envContent}
                onChange={e => setForm({ ...form, envContent: e.target.value })}
                placeholder={"NODE_ENV=production\nPORT=5000\nMACHINE_NAME=etaxerp.com"}
                spellCheck={false}
                data-testid="textarea-env-content"
              />
              <p className="text-xs text-gray-400 mt-1">ใส่เฉพาะ non-secret variables (ห้ามใส่ password / connection string)</p>
            </div>
          )}

          {/* Sysadmin Alert */}
          {(form.serverType === "app" || form.serverType === "app_database") && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Sysadmin Alert
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sysadmin Email</Label>
                  <Input value={form.sysadminEmail} onChange={e => setForm({ ...form, sysadminEmail: e.target.value })} placeholder="admin@example.com" data-testid="input-sysadmin-email" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Sysadmin LINE ID</Label>
                  <Input className="font-mono" value={form.sysadminLineId} onChange={e => setForm({ ...form, sysadminLineId: e.target.value })} placeholder="U1234567890abcdef..." data-testid="input-sysadmin-line-id" />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">หมายเหตุ</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ข้อมูลเพิ่มเติม" data-testid="input-notes" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InfraMachinesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingMachine, setEditingMachine] = useState<MachineRecord | null | undefined>(undefined);
  const [credentialsUnlocked, setCredentialsUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [masterPwInput, setMasterPwInput] = useState("");
  const [showMasterPw, setShowMasterPw] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: machines = [], isLoading: loadingMachines } = useQuery<MachineRecord[]>({
    queryKey: ["/api/platform/machines"],
    queryFn: async () => {
      const r = await fetch("/api/platform/machines", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load machines");
      return r.json();
    },
  });

  const { data: allNics = [] } = useQuery<NicRecord[]>({
    queryKey: ["/api/platform/all-nics"],
    queryFn: async () => {
      const r = await fetch("/api/platform/all-nics", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: locations = [] } = useQuery<LocationRecord[]>({
    queryKey: ["/api/platform/locations"],
    queryFn: async () => {
      const r = await fetch("/api/platform/locations", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: routers = [] } = useQuery<RouterRecord[]>({
    queryKey: ["/api/platform/routers"],
    queryFn: async () => {
      const r = await fetch("/api/platform/routers", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const verifyPasswordMut = useMutation({
    mutationFn: async (pw: string) => {
      const r = await fetch("/api/platform/verify-master-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "รหัสผ่านไม่ถูกต้อง");
      return r.json();
    },
    onSuccess: () => {
      setCredentialsUnlocked(true);
      setShowPasswordPrompt(false);
      setMasterPwInput("");
      toast({ title: "ปลดล็อค Credentials แล้ว" });
    },
    onError: (err: any) => toast({ title: "รหัสผ่านผิด", description: err.message, variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/platform/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
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
      const r = await fetch(`/api/platform/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
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
      const r = await fetch(`/api/platform/machines/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      setEditingMachine(undefined);
      toast({ title: "ลบเครื่องสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const officialMut = useMutation({
    mutationFn: async ({ id, isOfficial }: { id: number; isOfficial: boolean }) => {
      const r = await fetch(`/api/platform/machines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isOfficial }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/machines"] });
      toast({ title: vars.isOfficial ? "ตั้งเป็น Official แล้ว" : "ยกเลิก Official แล้ว" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getLocationLabel = (m: MachineRecord): string => {
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

  const handleSave = (data: any) => {
    const cleaned = {
      ...data,
      locationId: data.locationId ? Number(data.locationId) : null,
      routerId: data.routerId ? Number(data.routerId) : null,
    };
    if (editingMachine === null) {
      createMut.mutate(cleaned);
    } else if (editingMachine) {
      updateMut.mutate({ id: editingMachine.id, ...cleaned });
    }
  };

  // Group: Dev/Cloud separate, rest by location
  const devCloud = machines.filter(m => m.role === "dev_source");
  const nonDev = machines.filter(m => m.role !== "dev_source");
  const byLocation: Record<string, MachineRecord[]> = {};
  nonDev.forEach(m => {
    const loc = getLocationLabel(m);
    if (!byLocation[loc]) byLocation[loc] = [];
    byLocation[loc].push(m);
  });

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
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onEdit={setEditingMachine}
              onToggleOfficial={(id, val) => officialMut.mutate({ id, isOfficial: val })}
              allMachines={machines}
              allNics={allNics}
              credentialsUnlocked={credentialsUnlocked}
            />
          ))}
        </div>
      </div>
    );
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <SysAdminLayout>
      <div className="max-w-5xl mx-auto" data-testid="page-infra-machines">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="h-7 w-7 text-[#fb9678]" />
              Machines
              {machines.length > 0 && (
                <Badge variant="outline" className="text-xs ml-1">{machines.length} เครื่อง</Badge>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการเซิร์ฟเวอร์ทั้งหมดในระบบ</p>
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

        {/* Master Password Prompt */}
        {showPasswordPrompt && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Master Password
            </h3>
            <p className="text-xs text-amber-600 mb-3">ใส่รหัสผ่านเพื่อดู Credentials ของเครื่อง</p>
            <div className="flex gap-2 max-w-md">
              <div className="relative flex-1">
                <Input
                  type={showMasterPw ? "text" : "password"}
                  className="h-8 text-sm pr-9"
                  placeholder="Master password"
                  value={masterPwInput}
                  onChange={e => setMasterPwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && masterPwInput) verifyPasswordMut.mutate(masterPwInput); }}
                  autoComplete="off"
                  data-testid="input-master-password"
                />
                <button type="button" onClick={() => setShowMasterPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" data-testid="btn-toggle-master-pw">
                  {showMasterPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => verifyPasswordMut.mutate(masterPwInput)} disabled={!masterPwInput || verifyPasswordMut.isPending} data-testid="btn-verify-password">
                <Unlock className="h-3.5 w-3.5 mr-1" /> ปลดล็อค
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowPasswordPrompt(false); setMasterPwInput(""); }}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {/* Machine List */}
        {loadingMachines ? (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">ยังไม่มีเครื่องในระบบ</p>
            <p className="text-sm mt-1">กด "เพิ่มเครื่อง" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="space-y-6">
            {devCloud.length > 0 && renderGroup(
              <Cloud className="h-4 w-4" />, "Dev / Cloud", devCloud
            )}
            {Object.entries(byLocation)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([loc, items]) => (
                <div key={loc}>
                  {renderGroup(<MapPin className="h-4 w-4 text-red-400" />, loc, items)}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Edit / Add Dialog */}
      {editingMachine !== undefined && (
        <EditMachineDialog
          machine={editingMachine}
          locations={locations}
          routers={routers}
          onSave={handleSave}
          onCancel={() => setEditingMachine(undefined)}
          onDelete={id => { if (confirm("ลบเครื่องนี้?")) deleteMut.mutate(id); }}
          saving={isSaving}
        />
      )}
    </SysAdminLayout>
  );
}
