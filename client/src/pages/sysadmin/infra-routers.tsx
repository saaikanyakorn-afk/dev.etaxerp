import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SysAdminLayout from "@/components/sysadmin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Router, Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle,
  MapPin, Wifi, WifiOff, Globe, ChevronDown, ChevronRight,
} from "lucide-react";

interface Location {
  id: number;
  name: string;
  locationType: string;
  parentId: number | null;
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
}

const INTERNET_TYPES = [
  { value: "dynamic", label: "Dynamic IP",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  { value: "static",  label: "Static IP",   color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { value: "fiber",   label: "Fiber",       color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "4g",      label: "4G/Mobile",   color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
];

function internetTypeMeta(t: string) {
  return INTERNET_TYPES.find(x => x.value === t) ?? INTERNET_TYPES[0];
}

const EMPTY: Partial<RouterRecord> = {
  name: "", model: "", lanIp: "", adminUrl: "", adminUsername: "", adminPassword: "",
  wanIp: "", internetType: "dynamic", ispName: "", ispPackage: "",
  ispRegisteredCompany: "", ispAccountNumber: "", ispLinkId: "", ispCallCenter: "",
  ispSupportUrl: "", physicalLocation: "", locationId: null, notes: "",
};

function RouterDialog({
  mode, initial, locations, onClose, onSave, saving,
}: {
  mode: "add" | "edit";
  initial: Partial<RouterRecord>;
  locations: Location[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [showIsp, setShowIsp] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    const payload = {
      name: form.name?.trim(),
      model: form.model?.trim() || null,
      lanIp: form.lanIp?.trim() || null,
      adminUrl: form.adminUrl?.trim() || null,
      adminUsername: form.adminUsername?.trim() || null,
      adminPassword: form.adminPassword?.trim() || null,
      wanIp: form.wanIp?.trim() || null,
      internetType: form.internetType ?? "dynamic",
      ispName: form.ispName?.trim() || null,
      ispPackage: form.ispPackage?.trim() || null,
      ispRegisteredCompany: form.ispRegisteredCompany?.trim() || null,
      ispAccountNumber: form.ispAccountNumber?.trim() || null,
      ispLinkId: form.ispLinkId?.trim() || null,
      ispCallCenter: form.ispCallCenter?.trim() || null,
      ispSupportUrl: form.ispSupportUrl?.trim() || null,
      physicalLocation: form.physicalLocation?.trim() || null,
      locationId: form.locationId ? Number(form.locationId) : null,
      notes: form.notes?.trim() || null,
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" data-testid="dialog-router">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Router className="h-4 w-4 text-red-400" />
            {mode === "add" ? "เพิ่ม Router" : "แก้ไข Router"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="btn-close-router-dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-gray-300 text-sm">ชื่อ Router <span className="text-red-400">*</span></Label>
              <Input value={form.name ?? ""} onChange={e => set("name", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="เช่น DeepImpact-Main-Router" autoFocus required data-testid="input-router-name" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Model</Label>
              <Input value={form.model ?? ""} onChange={e => set("model", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="เช่น Mikrotik hAP ac3" data-testid="input-router-model" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">LAN IP</Label>
              <Input value={form.lanIp ?? ""} onChange={e => set("lanIp", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="192.168.x.1" data-testid="input-router-lan-ip" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">WAN IP (ถ้ามี)</Label>
              <Input value={form.wanIp ?? ""} onChange={e => set("wanIp", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="Dynamic หรือ Static IP" data-testid="input-router-wan-ip" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">ประเภทอินเตอร์เน็ต</Label>
              <Select value={form.internetType ?? "dynamic"} onValueChange={v => set("internetType", v)}>
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-internet-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {INTERNET_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-gray-200 focus:bg-gray-700">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-gray-300 text-sm">Location</Label>
              <Select
                value={form.locationId?.toString() ?? "none"}
                onValueChange={v => set("locationId", v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-router-location">
                  <SelectValue placeholder="— ไม่ระบุ —" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400 focus:bg-gray-700">— ไม่ระบุ —</SelectItem>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id.toString()} className="text-gray-200 focus:bg-gray-700">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-gray-300 text-sm">Admin URL</Label>
              <Input value={form.adminUrl ?? ""} onChange={e => set("adminUrl", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="http://192.168.x.1 หรือ https://..." data-testid="input-router-admin-url" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Admin Username</Label>
              <Input value={form.adminUsername ?? ""} onChange={e => set("adminUsername", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                autoComplete="off" data-testid="input-router-admin-user" />
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Admin Password</Label>
              <Input type="password" value={form.adminPassword ?? ""} onChange={e => set("adminPassword", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                autoComplete="new-password" data-testid="input-router-admin-pass" />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowIsp(o => !o)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              data-testid="btn-toggle-isp"
            >
              {showIsp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              ข้อมูล ISP (Internet Service Provider)
            </button>

            {showIsp && (
              <div className="mt-3 grid grid-cols-2 gap-3 pl-3 border-l border-gray-700">
                <div className="col-span-2">
                  <Label className="text-gray-300 text-sm">ISP / ผู้ให้บริการ</Label>
                  <Input value={form.ispName ?? ""} onChange={e => set("ispName", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    placeholder="เช่น AIS, TRUE, 3BB..." data-testid="input-isp-name" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Package</Label>
                  <Input value={form.ispPackage ?? ""} onChange={e => set("ispPackage", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    placeholder="1Gbps / 500Mbps..." data-testid="input-isp-package" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">เลขบัญชี / Account</Label>
                  <Input value={form.ispAccountNumber ?? ""} onChange={e => set("ispAccountNumber", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    data-testid="input-isp-account" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Link ID</Label>
                  <Input value={form.ispLinkId ?? ""} onChange={e => set("ispLinkId", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    data-testid="input-isp-link-id" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Call Center</Label>
                  <Input value={form.ispCallCenter ?? ""} onChange={e => set("ispCallCenter", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    placeholder="1111, 02-xxx-xxxx" data-testid="input-isp-callcenter" />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">บริษัทที่ลงทะเบียน</Label>
                  <Input value={form.ispRegisteredCompany ?? ""} onChange={e => set("ispRegisteredCompany", e.target.value)}
                    className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    data-testid="input-isp-company" />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-gray-300 text-sm">หมายเหตุ</Label>
            <Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 resize-none"
              rows={2} data-testid="input-router-notes" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-router">
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving || !form.name?.trim()}
              className="bg-red-600 hover:bg-red-700 text-white" data-testid="btn-save-router">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              {mode === "add" ? "เพิ่ม" : "บันทึก"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ name, onClose, onConfirm, deleting }: {
  name: string; onClose: () => void; onConfirm: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="dialog-delete-router">
      <div className="bg-gray-800 border border-red-800/50 rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">ลบ Router</h3>
            <p className="text-sm text-gray-400 mt-1">ยืนยันลบ <span className="text-white font-medium">"{name}"</span>?</p>
            <p className="text-xs text-gray-500 mt-1">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-delete-router">ยกเลิก</Button>
          <Button onClick={onConfirm} disabled={deleting}
            className="bg-red-700 hover:bg-red-800 text-white" data-testid="btn-confirm-delete-router">
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InfraRouters() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | { mode: "add" | "edit"; data: Partial<RouterRecord> }>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouterRecord | null>(null);

  const { data: routers = [], isLoading } = useQuery<RouterRecord[]>({
    queryKey: ["/api/sysadmin/infra/routers"],
    queryFn: () => fetch("/api/sysadmin/infra/routers", { credentials: "include" }).then(r => r.json()),
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/sysadmin/infra/locations"],
    queryFn: () => fetch("/api/sysadmin/infra/locations", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { mode: "add" | "edit"; id?: number; data: any }) => {
      const url = payload.mode === "add" ? "/api/sysadmin/infra/routers" : `/api/sysadmin/infra/routers/${payload.id}`;
      const res = await fetch(url, {
        method: payload.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sysadmin/infra/routers"] });
      toast({ title: dialog?.mode === "add" ? "เพิ่ม Router สำเร็จ" : "บันทึกสำเร็จ" });
      setDialog(null);
    },
    onError: (err: Error) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/infra/routers/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sysadmin/infra/routers"] });
      toast({ title: "ลบ Router สำเร็จ" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

  return (
    <SysAdminLayout>
      <div className="max-w-4xl mx-auto space-y-4" data-testid="page-infra-routers">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Router className="h-5 w-5 text-red-500" />
              Routers
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">อุปกรณ์เครือข่าย — Router, Switch, Access Point</p>
          </div>
          <Button onClick={() => setDialog({ mode: "add", data: {} })}
            className="bg-red-600 hover:bg-red-700 text-white" data-testid="btn-add-router">
            <Plus className="h-4 w-4 mr-1.5" /> เพิ่ม Router
          </Button>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">ทั้งหมด {routers.length} เครื่อง</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
              </div>
            ) : routers.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">ยังไม่มี Router</div>
            ) : (
              <div className="space-y-0.5">
                {routers.map(r => {
                  const iMeta = internetTypeMeta(r.internetType);
                  return (
                    <div key={r.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 rounded-lg group transition-colors"
                      data-testid={`row-router-${r.id}`}
                    >
                      <Router className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-100 text-sm">{r.name}</span>
                          {r.model && <span className="text-xs text-gray-500">{r.model}</span>}
                          <Badge className={`text-[10px] px-1.5 py-0 border ${iMeta.color}`}>{iMeta.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {r.lanIp && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Wifi className="h-3 w-3" /> LAN: {r.lanIp}
                            </span>
                          )}
                          {r.wanIp && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Globe className="h-3 w-3" /> WAN: {r.wanIp}
                            </span>
                          )}
                          {r.locationId && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {locMap[r.locationId] ?? r.locationId}
                            </span>
                          )}
                          {r.ispName && (
                            <span className="text-xs text-gray-600">{r.ispName}{r.ispPackage ? ` — ${r.ispPackage}` : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <button onClick={() => setDialog({ mode: "edit", data: r })}
                          className="p-1.5 rounded text-gray-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                          data-testid={`btn-edit-router-${r.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          data-testid={`btn-delete-router-${r.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog && (
        <RouterDialog
          mode={dialog.mode}
          initial={dialog.data}
          locations={locations}
          onClose={() => setDialog(null)}
          onSave={data => saveMutation.mutate({ mode: dialog.mode, id: (dialog.data as RouterRecord).id, data })}
          saving={saveMutation.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          deleting={deleteMutation.isPending}
        />
      )}
    </SysAdminLayout>
  );
}
