// [sys-k7x9] Dedicated Machines page — shows machines ONLY (no Locations / Routers / Domains).
// Part of the /sys-k7x9 SysAdmin portal.  Route is registered in app-extra.tsx via matchInfraMachines().
// DO NOT import this from App.tsx — use app-extra.tsx pattern.

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SysAdminLayout from "@/components/sysadmin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Plus, Eye, EyeOff, Pencil, Trash2, Check, X,
  MonitorSmartphone, Cloud, Monitor, RefreshCw,
  ArrowRight, Database, MapPin,
  Shield, Lock, Unlock, AlertTriangle,
  ChevronDown, ChevronRight, Star, Network, Radio,
  Globe, Cpu, GitBranch, UserCog,
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
  subnetMask: string;
  forwardedFor: string | null;
  routerId: number | null;
  notes: string | null;
}

interface NicIpRecord {
  id: number;
  nicId: number;
  ipAddress: string;
  subnetMask: string;
  label: string | null;
  isPrimary: boolean;
}

type DraftIp = { _key: string; id?: number; ipAddress: string; subnetMask: string; label: string };
type DraftNic = {
  _key: string;
  id?: number;
  nicName: string;
  macAddress: string;
  routerId: string;
  notes: string;
  primaryIp: string;
  primarySubnet: string;
  extraIps: DraftIp[];
};

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

type TabId = "network" | "database" | "hardware" | "sysadmin";

// ─── MachineCard ──────────────────────────────────────────────────────────────

function MachineCard({
  machine, expanded, onToggle, onEdit, onToggleOfficial,
  allMachines, allNics, credentialsUnlocked,
}: {
  machine: MachineRecord;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (m: MachineRecord, tab: TabId) => void;
  onToggleOfficial: (id: number, val: boolean) => void;
  allMachines: MachineRecord[];
  allNics: NicRecord[];
  credentialsUnlocked: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const [activeTab, setActiveTab] = useState<"network" | "database" | "hardware" | "sysadmin">("network");
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
  const hasHardware = !!(machine.machineModel || machine.cpuModel || machine.ramSize);
  const hasSysadmin = !!(machine.sysadminEmail || machine.sysadminLineId || machine.notes || machine.repoName || machine.envContent);

  const tabs = [
    { id: "network" as const,  icon: Globe,    label: "Network" },
    { id: "database" as const, icon: Database, label: "Database" },
    { id: "hardware" as const, icon: Cpu,      label: "Hardware", dim: !hasHardware },
    { id: "sysadmin" as const, icon: UserCog,  label: "Sysadmin", dim: !hasSysadmin },
  ];

  const Field = ({ label, value, mono = false, color }: { label: string; value: React.ReactNode; mono?: boolean; color?: string }) => (
    <div>
      <span className="text-gray-400 text-[10px] uppercase tracking-wide block mb-0.5">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : ""} ${color || "text-gray-800"}`}>{value}</span>
    </div>
  );

  return (
    <div
      className={`border rounded-lg transition-all ${isOfficial ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-300" : osConfig.color} ${expanded ? "shadow-md" : "hover:shadow-sm"}`}
      data-testid={`card-machine-${machine.id}`}
    >
      {/* ── Card header row ── */}
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
              <Network className="h-3 w-3" />{myNics.length}
              {hasForwarding && <Radio className="h-2.5 w-2.5 text-purple-400" />}
            </span>
          )}
          {isOfficial && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Official</Badge>}
          {machine.encContent && <Lock className="h-3 w-3 text-green-600" />}
        </div>
      </button>

      {/* ── Expanded tabbed panel ── */}
      {expanded && (
        <div className="border-t">
          {/* Tab bar + action buttons on same row */}
          <div className="flex items-center justify-between px-3 pt-2 pb-0 gap-2">
            <div className="flex gap-1">
              {tabs.map(({ id, icon: Icon, label, dim }) => (
                <button
                  key={id}
                  onClick={e => { e.stopPropagation(); setActiveTab(id); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    activeTab === id
                      ? "bg-[#fb9678] text-white shadow-sm"
                      : dim
                        ? "text-gray-300 hover:text-gray-400 hover:bg-gray-100"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                  data-testid={`tab-${id}-machine-${machine.id}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            {/* Actions always visible */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className={`h-6 text-[11px] px-2 ${isOfficial ? "border-amber-400 text-amber-700 hover:bg-amber-100" : "border-gray-300 text-gray-500 hover:bg-gray-100"}`}
                onClick={e => { e.stopPropagation(); onToggleOfficial(machine.id, !isOfficial); }}
                data-testid={`btn-official-machine-${machine.id}`}
              >
                <Star className={`h-3 w-3 mr-0.5 ${isOfficial ? "fill-amber-400 text-amber-500" : ""}`} />
                {isOfficial ? "ยกเลิก" : "Official"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2"
                onClick={e => { e.stopPropagation(); onEdit(machine, activeTab); }}
                data-testid={`btn-edit-machine-${machine.id}`}
              >
                <Pencil className="h-3 w-3 mr-0.5" /> แก้ไข
              </Button>
            </div>
          </div>

          {/* Tab content — fixed-height, no scroll */}
          <div className="px-4 py-3">

            {/* ── Network tab ── */}
            {activeTab === "network" && (
              <div className="grid grid-cols-3 gap-x-8 gap-y-2.5">
                <Field label="Domain" value={machine.domainName || "—"} mono />
                <Field label="LAN IP" value={machine.lanIp || "—"} mono />
                <Field label="WAN IP" value={machine.wanIp || "—"} mono />
                <Field label="Internet" value={
                  machine.internetType === "fixed"
                    ? <span className="text-green-600 font-medium">Fixed IP</span>
                    : <span className="text-orange-500 font-medium">Dynamic (DDNS)</span>
                } />
                {machine.fqdn && <Field label="FQDN" value={machine.fqdn} mono />}
                {machine.windowsName && <Field label="Windows Name" value={machine.windowsName} mono />}
                {myNics.length > 0 && (
                  <Field label="NICs" value={
                    <span className="flex items-center gap-1">
                      <Network className="h-3 w-3 text-gray-400" /> {myNics.length} NIC{myNics.length > 1 ? "s" : ""}
                      {hasForwarding && <span className="text-purple-500 text-[10px]">• forwarding</span>}
                    </span>
                  } />
                )}
              </div>
            )}

            {/* ── Database tab ── */}
            {activeTab === "database" && (
              <div className="grid grid-cols-3 gap-x-8 gap-y-2.5">
                <Field label="Database" value={machine.dbName || "—"} mono />
                <Field label="Port" value={machine.dbPort} mono />
                {targetLabel && (
                  <Field label="Target DB" value={
                    <span className={`flex items-center gap-1 font-mono ${isSelfTarget ? "text-blue-500" : "text-purple-500"}`}>
                      <Database className="h-3 w-3" />{targetLabel}
                    </span>
                  } />
                )}
                {credentialsUnlocked ? (
                  <>
                    <Field label="DB User" value={machine.dbUser} mono />
                    <div className="col-span-2">
                      <span className="text-gray-400 text-[10px] uppercase tracking-wide block mb-0.5">DB Password</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{showPw ? machine.dbPassword : "••••••••••"}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setShowPw(!showPw); }}
                          className="p-0.5 hover:bg-gray-200 rounded"
                          data-testid={`btn-toggle-pw-${machine.id}`}
                        >
                          {showPw ? <EyeOff className="h-3 w-3 text-gray-400" /> : <Eye className="h-3 w-3 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-3 flex items-center gap-2 text-xs text-amber-500 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Credentials locked — ใช้ "Unlock Credentials" ที่หน้าหลักเพื่อดูข้อมูล</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Hardware tab ── */}
            {activeTab === "hardware" && (
              hasHardware ? (
                <div className="grid grid-cols-3 gap-x-8 gap-y-2.5">
                  {machine.machineModel && <Field label="Model" value={machine.machineModel} />}
                  {machine.cpuModel && <Field label="CPU" value={machine.cpuModel} />}
                  {machine.ramSize && <Field label="RAM" value={machine.ramSize} />}
                  <Field label="OS" value={osConfig.label} />
                  <Field label="Server Type" value={
                    machine.serverType === "app" ? "App Server"
                    : machine.serverType === "database" ? "Database Server"
                    : "App + Database"
                  } />
                  <Field label="Role" value={
                    <span className={`${roleConfig.color} font-medium`}>{roleConfig.label}</span>
                  } />
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-2">ยังไม่ได้บันทึกข้อมูลฮาร์ดแวร์ — กด แก้ไข เพื่อเพิ่ม</p>
              )
            )}

            {/* ── Sysadmin tab ── */}
            {activeTab === "sysadmin" && (
              hasSysadmin ? (
                <div className="grid grid-cols-3 gap-x-8 gap-y-2.5">
                  {machine.sysadminEmail && <Field label="Sysadmin Email" value={machine.sysadminEmail} mono />}
                  {machine.sysadminLineId && <Field label="LINE ID" value={machine.sysadminLineId} mono />}
                  {machine.repoName && (
                    <Field label="Repo" value={
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3 text-gray-400" />
                        {machine.repoName}
                        {machine.repoBranch && machine.repoBranch !== "main" && (
                          <span className="text-gray-400">({machine.repoBranch})</span>
                        )}
                      </span>
                    } />
                  )}
                  {machine.envContent && (
                    <Field label=".env vars" value={
                      <span className="flex items-center gap-1 text-green-600">
                        <Shield className="h-3 w-3" />
                        {machine.envContent.trim().split("\n").filter(Boolean).length} variables
                      </span>
                    } />
                  )}
                  {machine.notes && (
                    <div className="col-span-3">
                      <span className="text-gray-400 text-[10px] uppercase tracking-wide block mb-0.5">Notes</span>
                      <p className="text-xs text-gray-600 italic">{machine.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-2">ยังไม่ได้บันทึกข้อมูล Sysadmin — กด แก้ไข เพื่อเพิ่ม</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NicCard ──────────────────────────────────────────────────────────────────

function NicCard({ nic, routers, onChange, onRemove }: {
  nic: DraftNic;
  routers: RouterRecord[];
  onChange: (n: DraftNic) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof DraftNic, v: any) => onChange({ ...nic, [k]: v });
  const newKey = () => Math.random().toString(36).slice(2);

  return (
    <div className="border rounded-lg p-3 bg-gray-50 space-y-2.5">
      {/* Row 1: name + MAC + delete */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600">NIC Name *</Label>
          <Input value={nic.nicName} onChange={e => set("nicName", e.target.value)} placeholder="eth0, LAN1, Wi-Fi" className="h-8 text-sm" />
        </div>
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-600">MAC Address</Label>
          <Input value={nic.macAddress} onChange={e => set("macAddress", e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className="h-8 text-sm font-mono" />
        </div>
        <div className="w-36">
          <Label className="text-xs font-medium text-gray-600">Router</Label>
          <Select value={nic.routerId || "none"} onValueChange={v => set("routerId", v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-- ไม่ระบุ --" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
              {routers.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}{r.lanIp ? ` (${r.lanIp})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button onClick={onRemove} className="mb-0.5 p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded" title="Remove NIC">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* IP list */}
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1.5 block">IP Addresses</Label>
        <div className="space-y-1">
          {/* Primary IP */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold w-14 text-center shrink-0">Primary</span>
            <Input
              value={nic.primaryIp}
              onChange={e => set("primaryIp", e.target.value)}
              placeholder="192.168.1.100"
              className="h-7 text-xs font-mono flex-1"
            />
            <span className="text-gray-400 text-xs shrink-0">/</span>
            <Input
              value={nic.primarySubnet}
              onChange={e => set("primarySubnet", e.target.value)}
              placeholder="255.255.255.0"
              className="h-7 text-xs font-mono w-32 shrink-0"
            />
            <div className="w-5 shrink-0" />
          </div>

          {/* Extra IPs */}
          {nic.extraIps.map((ip, idx) => (
            <div key={ip._key} className="flex items-center gap-1.5">
              <Input
                value={ip.label}
                onChange={e => { const u = [...nic.extraIps]; u[idx] = { ...ip, label: e.target.value }; onChange({ ...nic, extraIps: u }); }}
                placeholder="label"
                className="h-7 text-xs w-14 shrink-0 text-center"
              />
              <Input
                value={ip.ipAddress}
                onChange={e => { const u = [...nic.extraIps]; u[idx] = { ...ip, ipAddress: e.target.value }; onChange({ ...nic, extraIps: u }); }}
                placeholder="IP Address"
                className="h-7 text-xs font-mono flex-1"
              />
              <span className="text-gray-400 text-xs shrink-0">/</span>
              <Input
                value={ip.subnetMask}
                onChange={e => { const u = [...nic.extraIps]; u[idx] = { ...ip, subnetMask: e.target.value }; onChange({ ...nic, extraIps: u }); }}
                placeholder="255.255.255.0"
                className="h-7 text-xs font-mono w-32 shrink-0"
              />
              <button
                onClick={() => onChange({ ...nic, extraIps: nic.extraIps.filter((_, i) => i !== idx) })}
                className="text-gray-300 hover:text-red-500 shrink-0 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Add IP */}
          <button
            onClick={() => onChange({ ...nic, extraIps: [...nic.extraIps, { _key: newKey(), ipAddress: "", subnetMask: "255.255.255.0", label: "" }] })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 pl-[3.9rem] mt-0.5 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add IP
          </button>
        </div>
      </div>

      {/* ── Pending: Gateway + DNS ── */}
      <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <span className="mt-0.5 shrink-0 rounded bg-amber-200 px-1.5 py-0.5 font-bold uppercase tracking-wide text-amber-800 text-[10px]">TODO</span>
        <span>
          <span className="font-semibold">Gateway</span> และ <span className="font-semibold">DNS</span> ยังขาดอยู่ใน schema{" "}
          — ต้องเพิ่ม column <code className="bg-amber-100 px-1 rounded">gateway</code>,{" "}
          <code className="bg-amber-100 px-1 rounded">dns_primary</code>,{" "}
          <code className="bg-amber-100 px-1 rounded">dns_secondary</code> ใน <code className="bg-amber-100 px-1 rounded">machine_nics</code> table
          (backend task)
        </span>
      </div>
    </div>
  );
}

// ─── AddMachineDialog ─────────────────────────────────────────────────────────

function generatePortalPath() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `/sys-${s}`;
}

function AddMachineDialog({
  locations, onSave, onCancel, saving,
}: {
  locations: LocationRecord[];
  onSave: (data: any) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState({
    localName: "",
    displayName: "",
    locationId: "",
    internetType: "fixed",
  });
  const [portalPath] = useState(() => generatePortalPath());
  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#fb9678]" />
            <h2 className="text-lg font-semibold">เพิ่มเครื่องใหม่</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Portal path — auto-generated, permanent */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-gray-400" /> Portal Path
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-gray-700 select-all">
                {portalPath}
              </div>
              <span className="text-[10px] bg-gray-100 text-gray-500 border rounded px-2 py-1 shrink-0">
                ถาวร · แก้ไขไม่ได้
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              path นี้จะถูกสร้างให้อัตโนมัติและล็อคถาวร แม้แต่ Master ก็เปลี่ยนไม่ได้
            </p>
            {/* TODO */}
            <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 mt-2">
              <span className="mt-0.5 shrink-0 rounded bg-amber-200 px-1.5 py-0.5 font-bold uppercase tracking-wide text-amber-800 text-[10px]">TODO</span>
              <span>
                ต้องเพิ่ม column <code className="bg-amber-100 px-1 rounded">portal_path</code> ใน <code className="bg-amber-100 px-1 rounded">machines</code> table
                เพื่อบันทึก path นี้ลง DB (backend task)
              </span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            {/* Name */}
            <div>
              <Label className="text-sm font-medium">ชื่อเครื่อง (ชื่อเรียก) *</Label>
              <Input
                value={form.localName}
                onChange={e => f("localName", e.target.value)}
                placeholder="เช่น server-e5, etaxerp"
                className="mt-1"
                data-testid="input-add-local-name"
              />
            </div>

            {/* Display name */}
            <div>
              <Label className="text-sm font-medium">ชื่อแสดงผล (สำหรับผู้ใช้)</Label>
              <Input
                value={form.displayName}
                onChange={e => f("displayName", e.target.value)}
                placeholder="เช่น etax1, etax2"
                className="mt-1"
                data-testid="input-add-display-name"
              />
              <p className="text-xs text-muted-foreground mt-0.5">ชื่อที่ผู้ใช้เห็นเมื่อเลือกเซิร์ฟเวอร์</p>
            </div>

            {/* Location */}
            <div>
              <Label className="text-sm font-medium">สถานที่ตั้ง (Location)</Label>
              <Select value={form.locationId || "none"} onValueChange={v => f("locationId", v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1" data-testid="select-add-location">
                  <SelectValue>
                    {form.locationId
                      ? (locations.find(l => String(l.id) === form.locationId)?.name ?? "—")
                      : "— ยังไม่กำหนด"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                  {locations.filter(l => !l.parentId).map(parent => {
                    const children = locations.filter(c => c.parentId === parent.id);
                    return children.length > 0 ? (
                      <SelectGroup key={parent.id}>
                        <SelectLabel className="text-xs font-semibold text-gray-500">{parent.name}</SelectLabel>
                        {children.map(c => (
                          <SelectItem key={c.id} value={String(c.id)} className="pl-5">{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ) : (
                      <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Internet type */}
            <div>
              <Label className="text-sm font-medium">Internet Type</Label>
              <Select value={form.internetType} onValueChange={v => f("internetType", v)}>
                <SelectTrigger className="mt-1" data-testid="select-add-internet-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed IP</SelectItem>
                  <SelectItem value="dynamic">Dynamic (DDNS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-add">ยกเลิก</Button>
          <Button
            className="bg-[#fb9678] hover:bg-[#e8855a] text-white"
            onClick={() => {
              if (!form.localName.trim()) return;
              onSave({ ...form, locationId: form.locationId ? Number(form.locationId) : null });
            }}
            disabled={!form.localName.trim() || saving}
            data-testid="button-confirm-add"
          >
            <Plus className="h-4 w-4 mr-1" /> {saving ? "กำลังบันทึก..." : "เพิ่มเครื่อง"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── EditMachineDialog ────────────────────────────────────────────────────────

const EDIT_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "network",  label: "Network",  icon: <Globe className="h-3.5 w-3.5" /> },
  { id: "database", label: "Database", icon: <Database className="h-3.5 w-3.5" /> },
  { id: "hardware", label: "Hardware", icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: "sysadmin", label: "Sysadmin", icon: <UserCog className="h-3.5 w-3.5" /> },
];

function EditMachineDialog({
  machine, initialTab, allNics, locations, routers, onSave, onCancel, onDelete, saving,
}: {
  machine: MachineRecord | null;
  initialTab: TabId;
  allNics: NicRecord[];
  locations: LocationRecord[];
  routers: RouterRecord[];
  onSave: (data: any) => void;
  onCancel: () => void;
  onDelete?: (id: number) => void;
  saving?: boolean;
}) {
  const isNew = !machine;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [showDbPw, setShowDbPw] = useState(false);
  const [savingNics, setSavingNics] = useState(false);

  // ── NIC draft state ────────────────────────────────────────────────────────
  const newKey = () => Math.random().toString(36).slice(2);
  const [draftNics, setDraftNics] = useState<DraftNic[]>([]);

  useEffect(() => {
    if (isNew || !machine) { setDraftNics([]); return; }
    const myNics = allNics.filter(n => n.machineId === machine.id);
    if (myNics.length === 0) { setDraftNics([]); return; }
    // Load extra IPs for each NIC
    (async () => {
      const allIps: NicIpRecord[] = await fetch("/api/platform/all-nic-ips", { credentials: "include" })
        .then(r => r.ok ? r.json() : []).catch(() => []);
      setDraftNics(myNics.map(n => ({
        _key: newKey(),
        id: n.id,
        nicName: n.nicName,
        macAddress: n.macAddress || "",
        routerId: n.routerId ? String(n.routerId) : "",
        notes: n.notes || "",
        primaryIp: n.ipAddress,
        primarySubnet: n.subnetMask || "255.255.255.0",
        extraIps: allIps.filter(ip => ip.nicId === n.id).map(ip => ({
          _key: newKey(),
          id: ip.id,
          ipAddress: ip.ipAddress,
          subnetMask: ip.subnetMask,
          label: ip.label || "",
        })),
      })));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machine?.id]);

  const saveNics = async (machineId: number) => {
    for (const nic of draftNics) {
      let nicId = nic.id;
      if (!nicId) {
        if (!nic.nicName.trim() || !nic.primaryIp.trim()) continue;
        const r = await fetch(`/api/platform/machines/${machineId}/nics`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ nicName: nic.nicName, macAddress: nic.macAddress || null, ipAddress: nic.primaryIp, subnetMask: nic.primarySubnet || "255.255.255.0", routerId: nic.routerId ? Number(nic.routerId) : null }),
        });
        if (r.ok) nicId = (await r.json()).id;
      } else {
        await fetch(`/api/platform/machine-nics/${nicId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ nicName: nic.nicName, macAddress: nic.macAddress || null, ipAddress: nic.primaryIp, subnetMask: nic.primarySubnet || "255.255.255.0", routerId: nic.routerId ? Number(nic.routerId) : null }),
        });
      }
      if (nicId) {
        for (const ip of nic.extraIps) {
          if (!ip.ipAddress.trim()) continue;
          if (!ip.id) {
            await fetch(`/api/platform/nics/${nicId}/ips`, {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({ ipAddress: ip.ipAddress, subnetMask: ip.subnetMask || "255.255.255.0", label: ip.label || null }),
            });
          } else {
            await fetch(`/api/platform/nic-ips/${ip.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({ ipAddress: ip.ipAddress, subnetMask: ip.subnetMask || "255.255.255.0", label: ip.label || null }),
            });
          }
        }
      }
    }
  };

  const handleSaveAll = async () => {
    if (!isNew && machine?.id) {
      setSavingNics(true);
      try { await saveNics(machine.id); } catch {}
      setSavingNics(false);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/all-nics"] });
    }
    onSave(form);
  };
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
  const f = (field: string, val: any) => setForm(prev => ({ ...prev, [field]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" data-testid="dialog-edit-machine">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 700, height: 930 }}>

        {/* Header + tab bar */}
        <div className="px-6 pt-5 pb-0 border-b shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">
              {isNew ? "เพิ่มเครื่องใหม่" : `แก้ไข: ${machine.localName}`}
            </h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" data-testid="button-close-dialog">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-0">
            {EDIT_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? "border-[#fb9678] text-[#fb9678]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
                data-testid={`edit-tab-${t.id}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── Network ── */}
          {activeTab === "network" && (
            <div className="space-y-4">
              {/* Identity fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">ชื่อเครื่อง (ชื่อเรียก) *</Label>
                  <Input value={form.localName} onChange={e => f("localName", e.target.value)} placeholder="เช่น server-e5, etaxerp" data-testid="input-local-name" />
                </div>
                <div>
                  <Label className="text-sm font-medium">ชื่อแสดงผล (สำหรับผู้ใช้)</Label>
                  <Input value={form.displayName} onChange={e => f("displayName", e.target.value)} placeholder="เช่น etax1, etax2" data-testid="input-display-name" />
                  <p className="text-xs text-muted-foreground mt-0.5">ชื่อที่ผู้ใช้เห็นเมื่อเลือกเซิร์ฟเวอร์</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Domain Name</Label>
                  <Input value={form.domainName} onChange={e => f("domainName", e.target.value)} placeholder="เช่น deep-main.hopto.org" data-testid="input-domain-name" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Windows Computer Name</Label>
                  <Input value={form.windowsName} onChange={e => f("windowsName", e.target.value)} placeholder="เช่น ETAXERP-PC" data-testid="input-windows-name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">FQDN</Label>
                  <Input value={form.fqdn} onChange={e => f("fqdn", e.target.value)} placeholder="เช่น etaxerp.com" data-testid="input-fqdn" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Internet Type</Label>
                  <Select value={form.internetType} onValueChange={v => f("internetType", v)}>
                    <SelectTrigger data-testid="select-internet-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed IP</SelectItem>
                      <SelectItem value="dynamic">Dynamic (DDNS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">สถานที่ตั้ง (Location)</Label>
                  <Select value={form.locationId || "none"} onValueChange={v => f("locationId", v === "none" ? "" : v)}>
                    <SelectTrigger data-testid="select-machine-location">
                      <SelectValue>
                        {form.locationId
                          ? (locations.find(l => String(l.id) === form.locationId)?.name ?? "—")
                          : "— ยังไม่กำหนด"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— ยังไม่กำหนด</SelectItem>
                      {locations.filter(l => !l.parentId).map(parent => {
                        const children = locations.filter(c => c.parentId === parent.id);
                        return children.length > 0 ? (
                          <SelectGroup key={parent.id}>
                            <SelectLabel className="text-xs font-semibold text-gray-500 px-2">{parent.name}</SelectLabel>
                            {children.map(c => (
                              <SelectItem key={c.id} value={String(c.id)} className="pl-5">{c.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        ) : (
                          <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* NIC cards */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Network className="h-4 w-4 text-gray-400" /> Network Cards (NICs)
                  </span>
                  {isNew && (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                      บันทึกเครื่องก่อน แล้วค่อยเพิ่ม NIC
                    </span>
                  )}
                </div>
                {isNew ? (
                  <p className="text-xs text-gray-400 italic py-2">NICs จะสามารถเพิ่มได้หลังจากสร้างเครื่องเสร็จแล้ว</p>
                ) : (
                  <div className="space-y-2">
                    {draftNics.map((nic, idx) => (
                      <NicCard
                        key={nic._key}
                        nic={nic}
                        routers={routers}
                        onChange={updated => setDraftNics(prev => prev.map((n, i) => i === idx ? updated : n))}
                        onRemove={() => setDraftNics(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                    <button
                      onClick={() => setDraftNics(prev => [...prev, {
                        _key: newKey(), nicName: "", macAddress: "", routerId: "",
                        notes: "", primaryIp: "", primarySubnet: "255.255.255.0", extraIps: [],
                      }])}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-[#fb9678] hover:text-[#fb9678] transition-colors"
                      data-testid="btn-add-nic"
                    >
                      <Plus className="h-4 w-4" /> Add Network Card
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Database ── */}
          {activeTab === "database" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Port</Label>
                  <Input value={form.dbPort} onChange={e => f("dbPort", e.target.value)} placeholder="5432" data-testid="input-db-port" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Database Name</Label>
                  <Input className="font-mono" value={form.dbName} onChange={e => f("dbName", e.target.value)} placeholder="เช่น db_rp_pdt" data-testid="input-db-name" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <Input className="font-mono" value={form.dbUser} onChange={e => f("dbUser", e.target.value)} placeholder="เช่น replit_pdt" data-testid="input-db-user" />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Password</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono flex-1"
                    type={showDbPw ? "text" : "password"}
                    value={form.dbPassword}
                    onChange={e => f("dbPassword", e.target.value)}
                    placeholder="รหัสผ่าน"
                    data-testid="input-db-password"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowDbPw(!showDbPw)} data-testid="btn-toggle-password">
                    {showDbPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Hardware ── */}
          {activeTab === "hardware" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">รุ่นเครื่อง</Label>
                  <Input value={form.machineModel} onChange={e => f("machineModel", e.target.value)} placeholder="เช่น Dell OptiPlex 7060" data-testid="input-machine-model" />
                </div>
                <div>
                  <Label className="text-sm font-medium">CPU</Label>
                  <Input value={form.cpuModel} onChange={e => f("cpuModel", e.target.value)} placeholder="เช่น Xeon E3-1280 V2" data-testid="input-cpu-model" />
                </div>
                <div>
                  <Label className="text-sm font-medium">RAM</Label>
                  <Input value={form.ramSize} onChange={e => f("ramSize", e.target.value)} placeholder="เช่น 32GB DDR3" data-testid="input-ram-size" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">ระบบปฏิบัติการ *</Label>
                  <Select value={form.os} onValueChange={v => f("os", v)}>
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
                  <Select value={form.serverType} onValueChange={v => f("serverType", v)}>
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
                  <Select value={form.role} onValueChange={v => f("role", v)}>
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
            </div>
          )}

          {/* ── Sysadmin ── */}
          {activeTab === "sysadmin" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sysadmin Email</Label>
                  <Input value={form.sysadminEmail} onChange={e => f("sysadminEmail", e.target.value)} placeholder="admin@example.com" data-testid="input-sysadmin-email" />
                </div>
                <div>
                  <Label className="text-sm font-medium">Sysadmin LINE ID</Label>
                  <Input className="font-mono" value={form.sysadminLineId} onChange={e => f("sysadminLineId", e.target.value)} placeholder="U1234567890abcdef..." data-testid="input-sysadmin-line-id" />
                </div>
              </div>
              {(form.serverType === "app" || form.serverType === "app_database") && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Repo Name</Label>
                    <Select value={form.repoName || "none"} onValueChange={v => f("repoName", v === "none" ? "" : v)}>
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
                    <Input className="font-mono text-xs" value={form.repoUrl} onChange={e => f("repoUrl", e.target.value)} placeholder="https://github.com/..." data-testid="input-repo-url" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Branch</Label>
                    <Input className="font-mono" value={form.repoBranch} onChange={e => f("repoBranch", e.target.value)} placeholder="main" data-testid="input-repo-branch" />
                  </div>
                </div>
              )}
              {(form.serverType === "app" || form.serverType === "app_database") && (
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1 mb-2">
                    <Shield className="h-4 w-4" /> .env (Environment Variables)
                  </Label>
                  <textarea
                    className="w-full font-mono text-sm border rounded-lg p-3 bg-gray-900 text-green-400 min-h-[140px] resize-y focus:outline-none focus:ring-2 focus:ring-[#fb9678]"
                    value={form.envContent}
                    onChange={e => f("envContent", e.target.value)}
                    placeholder={"NODE_ENV=production\nPORT=5000\nMACHINE_NAME=etaxerp.com"}
                    spellCheck={false}
                    data-testid="textarea-env-content"
                  />
                  <p className="text-xs text-gray-400 mt-1">ใส่เฉพาะ non-secret variables (ห้ามใส่ password / connection string)</p>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">หมายเหตุ</Label>
                <Input value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="ข้อมูลเพิ่มเติม" data-testid="input-notes" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0">
          <div>
            {!isNew && onDelete && (
              <Button variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onDelete(machine.id)} data-testid="button-delete-machine">
                <Trash2 className="h-4 w-4 mr-1" /> ลบเครื่องนี้
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-edit">
              ยกเลิก
            </Button>
            <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={handleSaveAll} disabled={saving || savingNics} data-testid="button-save-machine">
              <Check className="h-4 w-4 mr-1" /> {saving || savingNics ? "กำลังบันทึก..." : isNew ? "เพิ่มเครื่อง" : "บันทึก"}
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
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineRecord | null | undefined>(undefined);
  const [editingTab, setEditingTab] = useState<TabId>("network");
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
      setShowAddMachine(false);
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
              onEdit={(m, tab) => { setEditingMachine(m); setEditingTab(tab); }}
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
            <Button className="bg-[#fb9678] hover:bg-[#e8855a] text-white" onClick={() => setShowAddMachine(true)} data-testid="button-add-machine">
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

      {/* Add Machine Dialog */}
      {showAddMachine && (
        <AddMachineDialog
          locations={locations}
          onSave={data => createMut.mutate(data)}
          onCancel={() => setShowAddMachine(false)}
          saving={createMut.isPending}
        />
      )}

      {/* Edit Dialog */}
      {editingMachine !== undefined && (
        <EditMachineDialog
          machine={editingMachine}
          initialTab={editingTab}
          allNics={allNics}
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
