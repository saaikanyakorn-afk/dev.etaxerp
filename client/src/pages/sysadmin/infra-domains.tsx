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
  Globe, Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle,
  Router, Server, ExternalLink,
} from "lucide-react";

interface RouterRecord { id: number; name: string; }
interface MachineRecord { id: number; localName: string; displayName: string | null; }

interface DomainRow {
  domain: {
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
  };
  routerName: string | null;
  machineName: string | null;
}

const PROVIDERS = [
  { value: "freedns",  label: "FreeDNS" },
  { value: "noip",     label: "No-IP" },
  { value: "duckdns",  label: "DuckDNS" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "Replit",   label: "Replit" },
  { value: "other",    label: "อื่นๆ" },
];

const PURPOSES = [
  { value: "app",   label: "App Server" },
  { value: "db",    label: "Database" },
  { value: "admin", label: "Admin" },
  { value: "api",   label: "API" },
  { value: "other", label: "อื่นๆ" },
];

const EMPTY_DOMAIN = {
  domainName: "", provider: "freedns", manageUrl: "", username: "", password: "",
  routerId: null as number | null, isRouterManaged: false,
  machineId: null as number | null, purpose: "app", port: null as number | null, notes: "",
};

function DomainDialog({
  mode, initial, routers, machines, onClose, onSave, saving,
}: {
  mode: "add" | "edit";
  initial: Partial<typeof EMPTY_DOMAIN & { id: number }>;
  routers: RouterRecord[];
  machines: MachineRecord[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_DOMAIN, ...initial });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domainName.trim()) return;
    onSave({
      domainName: form.domainName.trim(),
      provider: form.provider,
      manageUrl: form.manageUrl?.trim() || null,
      username: form.username?.trim() || null,
      password: form.password?.trim() || null,
      routerId: form.routerId ?? null,
      isRouterManaged: form.isRouterManaged,
      machineId: form.machineId ?? null,
      purpose: form.purpose?.trim() || null,
      port: form.port ? Number(form.port) : null,
      notes: form.notes?.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" data-testid="dialog-domain">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-xl">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-red-400" />
            {mode === "add" ? "เพิ่ม Domain" : "แก้ไข Domain"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="btn-close-domain-dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-gray-300 text-sm">Domain Name <span className="text-red-400">*</span></Label>
            <Input value={form.domainName} onChange={e => set("domainName", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 font-mono"
              placeholder="etaxerp.com หรือ subdomain.domain.com"
              autoFocus required data-testid="input-domain-name" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 text-sm">Provider / DNS</Label>
              <Select value={form.provider} onValueChange={v => set("provider", v)}>
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-domain-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-gray-200 focus:bg-gray-700">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Purpose</Label>
              <Select value={form.purpose ?? "app"} onValueChange={v => set("purpose", v)}>
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-domain-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {PURPOSES.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-gray-200 focus:bg-gray-700">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Router (ที่ชี้ไป)</Label>
              <Select
                value={form.routerId?.toString() ?? "none"}
                onValueChange={v => set("routerId", v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-domain-router">
                  <SelectValue placeholder="— ไม่ระบุ —" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400 focus:bg-gray-700">— ไม่ระบุ —</SelectItem>
                  {routers.map(r => (
                    <SelectItem key={r.id} value={r.id.toString()} className="text-gray-200 focus:bg-gray-700">{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Machine (App Server)</Label>
              <Select
                value={form.machineId?.toString() ?? "none"}
                onValueChange={v => set("machineId", v === "none" ? null : Number(v))}
              >
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-domain-machine">
                  <SelectValue placeholder="— ไม่ระบุ —" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400 focus:bg-gray-700">— ไม่ระบุ —</SelectItem>
                  {machines.map(m => (
                    <SelectItem key={m.id} value={m.id.toString()} className="text-gray-200 focus:bg-gray-700">
                      {m.displayName ?? m.localName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Port (ถ้ามี)</Label>
              <Input
                type="number" value={form.port ?? ""} onChange={e => set("port", e.target.value ? Number(e.target.value) : null)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="443, 80, 3000..." data-testid="input-domain-port" />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={form.isRouterManaged}
                  onChange={e => set("isRouterManaged", e.target.checked)}
                  className="w-4 h-4 accent-red-500" data-testid="check-router-managed" />
                <span className="text-sm text-gray-300">Router managed</span>
              </label>
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">Manage URL</Label>
            <Input value={form.manageUrl ?? ""} onChange={e => set("manageUrl", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 font-mono text-sm"
              placeholder="https://freedns.afraid.org/..." data-testid="input-domain-manage-url" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 text-sm">Username</Label>
              <Input value={form.username ?? ""} onChange={e => set("username", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                autoComplete="off" data-testid="input-domain-username" />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Password</Label>
              <Input type="password" value={form.password ?? ""} onChange={e => set("password", e.target.value)}
                className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                autoComplete="new-password" data-testid="input-domain-password" />
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">หมายเหตุ</Label>
            <Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 resize-none"
              rows={2} data-testid="input-domain-notes" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-domain">ยกเลิก</Button>
            <Button type="submit" disabled={saving || !form.domainName.trim()}
              className="bg-red-600 hover:bg-red-700 text-white" data-testid="btn-save-domain">
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="dialog-delete-domain">
      <div className="bg-gray-800 border border-red-800/50 rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">ลบ Domain</h3>
            <p className="text-sm text-gray-400 mt-1">ยืนยันลบ <span className="text-white font-medium">"{name}"</span>?</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-delete-domain">ยกเลิก</Button>
          <Button onClick={onConfirm} disabled={deleting}
            className="bg-red-700 hover:bg-red-800 text-white" data-testid="btn-confirm-delete-domain">
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InfraDomains() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | { mode: "add" | "edit"; data: any }>(null);
  const [deleteTarget, setDeleteTarget] = useState<DomainRow | null>(null);

  const { data: domainRows = [], isLoading } = useQuery<DomainRow[]>({
    queryKey: ["/api/sysadmin/infra/domains"],
    queryFn: () => fetch("/api/sysadmin/infra/domains", { credentials: "include" }).then(r => r.json()),
  });

  const { data: routers = [] } = useQuery<RouterRecord[]>({
    queryKey: ["/api/sysadmin/infra/routers"],
    queryFn: () => fetch("/api/sysadmin/infra/routers", { credentials: "include" }).then(r => r.json()),
  });

  const { data: machines = [] } = useQuery<MachineRecord[]>({
    queryKey: ["/api/sysadmin/infra/machines"],
    queryFn: () => fetch("/api/sysadmin/infra/machines", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { mode: "add" | "edit"; id?: number; data: any }) => {
      const url = payload.mode === "add" ? "/api/sysadmin/infra/domains" : `/api/sysadmin/infra/domains/${payload.id}`;
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
      qc.invalidateQueries({ queryKey: ["/api/sysadmin/infra/domains"] });
      toast({ title: dialog?.mode === "add" ? "เพิ่ม Domain สำเร็จ" : "บันทึกสำเร็จ" });
      setDialog(null);
    },
    onError: (err: Error) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/infra/domains/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sysadmin/infra/domains"] });
      toast({ title: "ลบ Domain สำเร็จ" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" }),
  });

  return (
    <SysAdminLayout>
      <div className="max-w-4xl mx-auto space-y-4" data-testid="page-infra-domains">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="h-5 w-5 text-red-500" />
              Domains
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Domain names, DNS providers, และการชี้ไป Server/Router</p>
          </div>
          <Button onClick={() => setDialog({ mode: "add", data: {} })}
            className="bg-red-600 hover:bg-red-700 text-white" data-testid="btn-add-domain">
            <Plus className="h-4 w-4 mr-1.5" /> เพิ่ม Domain
          </Button>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600">ทั้งหมด {domainRows.length} domain</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
              </div>
            ) : domainRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">ยังไม่มี Domain</div>
            ) : (
              <div className="space-y-0.5">
                {domainRows.map(row => {
                  const d = row.domain;
                  const purposeMeta = PURPOSES.find(p => p.value === d.purpose);
                  return (
                    <div key={d.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 rounded-lg group transition-colors"
                      data-testid={`row-domain-${d.id}`}
                    >
                      <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-gray-100 truncate max-w-xs">{d.domainName}</span>
                          <Badge className="text-[10px] px-1.5 py-0 border bg-gray-700/50 text-gray-400 border-gray-600">
                            {d.provider}
                          </Badge>
                          {purposeMeta && (
                            <Badge className="text-[10px] px-1.5 py-0 border bg-blue-500/10 text-blue-300 border-blue-500/30">
                              {purposeMeta.label}
                            </Badge>
                          )}
                          {d.port && (
                            <span className="text-xs text-gray-500">:{d.port}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {row.routerName && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Router className="h-3 w-3" /> {row.routerName}
                            </span>
                          )}
                          {row.machineName && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Server className="h-3 w-3" /> {row.machineName}
                            </span>
                          )}
                          {d.manageUrl && (
                            <a href={d.manageUrl} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors"
                              data-testid={`link-manage-domain-${d.id}`}>
                              <ExternalLink className="h-3 w-3" /> จัดการ
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <button onClick={() => setDialog({ mode: "edit", data: d })}
                          className="p-1.5 rounded text-gray-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                          data-testid={`btn-edit-domain-${d.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteTarget(row)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          data-testid={`btn-delete-domain-${d.id}`}>
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
        <DomainDialog
          mode={dialog.mode}
          initial={dialog.data}
          routers={routers}
          machines={machines}
          onClose={() => setDialog(null)}
          onSave={data => saveMutation.mutate({ mode: dialog.mode, id: dialog.data?.id, data })}
          saving={saveMutation.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.domain.domainName}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.domain.id)}
          deleting={deleteMutation.isPending}
        />
      )}
    </SysAdminLayout>
  );
}
