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
import { MapPin, Plus, Pencil, Trash2, Building2, Server, Cloud, ChevronRight, X, Check, Loader2, AlertTriangle } from "lucide-react";

interface Location {
  id: number;
  name: string;
  locationType: string;
  parentId: number | null;
  address: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const LOCATION_TYPES = [
  { value: "company",    label: "บริษัท",      icon: Building2, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "datacenter", label: "ห้องเซิร์ฟเวอร์", icon: Server,   color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "cloud",      label: "Cloud",       icon: Cloud,    color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "office",     label: "สำนักงาน",    icon: Building2, color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { value: "branch",     label: "สาขา",        icon: Building2, color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
];

function typeMeta(t: string) {
  return LOCATION_TYPES.find(x => x.value === t) ?? LOCATION_TYPES[0];
}

const EMPTY_FORM = { name: "", locationType: "company", parentId: "" as string, address: "", notes: "" };

function LocationDialog({
  mode,
  initial,
  locations,
  onClose,
  onSave,
  saving,
}: {
  mode: "add" | "edit";
  initial: Partial<Location>;
  locations: Location[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    locationType: initial.locationType ?? "company",
    parentId: initial.parentId?.toString() ?? "",
    address: initial.address ?? "",
    notes: initial.notes ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      locationType: form.locationType,
      parentId: form.parentId ? Number(form.parentId) : null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  const parents = locations.filter(l => l.id !== initial.id && !l.parentId);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="dialog-location">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-400" />
            {mode === "add" ? "เพิ่ม Location" : "แก้ไข Location"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="btn-close-dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label className="text-gray-300 text-sm">ชื่อ Location <span className="text-red-400">*</span></Label>
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              placeholder="เช่น Deep Impact Head Office"
              autoFocus
              required
              data-testid="input-location-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 text-sm">ประเภท</Label>
              <Select value={form.locationType} onValueChange={v => set("locationType", v)}>
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-location-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {LOCATION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-gray-200 focus:bg-gray-700">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">สังกัด (Parent)</Label>
              <Select value={form.parentId || "none"} onValueChange={v => set("parentId", v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1 bg-gray-700 border-gray-600 text-white" data-testid="select-location-parent">
                  <SelectValue placeholder="— ไม่มี —" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-gray-400 focus:bg-gray-700">— ไม่มี —</SelectItem>
                  {parents.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} className="text-gray-200 focus:bg-gray-700">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-300 text-sm">ที่อยู่</Label>
            <Input
              value={form.address}
              onChange={e => set("address", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              placeholder="เลขที่ ถนน ซอย..."
              data-testid="input-location-address"
            />
          </div>

          <div>
            <Label className="text-gray-300 text-sm">หมายเหตุ</Label>
            <Textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 resize-none"
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม..."
              data-testid="input-location-notes"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-location">
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}
              className="bg-red-600 hover:bg-red-700 text-white" data-testid="btn-save-location">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              {mode === "add" ? "เพิ่ม" : "บันทึก"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ location, onClose, onConfirm, deleting }: {
  location: Location;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" data-testid="dialog-delete-location">
      <div className="bg-gray-800 border border-red-800/50 rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">ลบ Location</h3>
            <p className="text-sm text-gray-400 mt-1">
              ยืนยันลบ <span className="text-white font-medium">"{location.name}"</span>?
            </p>
            <p className="text-xs text-gray-500 mt-1">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-700" data-testid="btn-cancel-delete">
            ยกเลิก
          </Button>
          <Button onClick={onConfirm} disabled={deleting}
            className="bg-red-700 hover:bg-red-800 text-white" data-testid="btn-confirm-delete">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}

function LocationRow({ loc, allLocations, children, onEdit, onDelete }: {
  loc: Location;
  allLocations: Location[];
  children?: Location[];
  onEdit: (l: Location) => void;
  onDelete: (l: Location) => void;
}) {
  const meta = typeMeta(loc.locationType);
  const Icon = meta.icon;
  const [childOpen, setChildOpen] = useState(true);
  const hasChildren = children && children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 rounded-lg group transition-colors"
        data-testid={`row-location-${loc.id}`}
      >
        {hasChildren ? (
          <button onClick={() => setChildOpen(o => !o)} className="text-gray-500 hover:text-gray-300 shrink-0">
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${childOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <Icon className="h-4 w-4 text-gray-400 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-100 text-sm">{loc.name}</span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${meta.color}`}>{meta.label}</Badge>
          </div>
          {loc.address && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.address}</p>
          )}
        </div>

        {loc.notes && (
          <span className="text-xs text-gray-600 hidden lg:block max-w-[200px] truncate">{loc.notes}</span>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
          <button
            onClick={() => onEdit(loc)}
            className="p-1.5 rounded text-gray-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
            data-testid={`btn-edit-location-${loc.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(loc)}
            className="p-1.5 rounded text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            data-testid={`btn-delete-location-${loc.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && childOpen && (
        <div className="ml-6 pl-3 border-l border-gray-700/50 mt-0.5 space-y-0.5">
          {children!.map(child => (
            <LocationRow
              key={child.id}
              loc={child}
              allLocations={allLocations}
              children={allLocations.filter(l => l.parentId === child.id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InfraLocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<null | { mode: "add" | "edit"; data: Partial<Location> }>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["/api/sysadmin/infra/locations"],
    queryFn: () => fetch("/api/sysadmin/infra/locations", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { mode: "add" | "edit"; id?: number; data: any }) => {
      const url = payload.mode === "add"
        ? "/api/sysadmin/infra/locations"
        : `/api/sysadmin/infra/locations/${payload.id}`;
      const method = payload.mode === "add" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload.data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/infra/locations"] });
      toast({ title: dialog?.mode === "add" ? "เพิ่ม Location สำเร็จ" : "บันทึกสำเร็จ" });
      setDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sysadmin/infra/locations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sysadmin/infra/locations"] });
      toast({ title: "ลบ Location สำเร็จ" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const roots = locations.filter(l => !l.parentId);

  return (
    <SysAdminLayout>
      <div className="max-w-3xl mx-auto space-y-4" data-testid="page-infra-locations">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              Locations
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              สถานที่ตั้งทางกายภาพ — บริษัท, ห้องเซิร์ฟเวอร์, Cloud
            </p>
          </div>
          <Button
            onClick={() => setDialog({ mode: "add", data: {} })}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="btn-add-location"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            เพิ่ม Location
          </Button>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
              <span>ทั้งหมด {locations.length} รายการ</span>
              <div className="flex gap-3 text-xs text-gray-400 font-normal">
                {LOCATION_TYPES.map(t => (
                  <span key={t.value} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.color.split(" ")[0]}`} />
                    {t.label}
                  </span>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
              </div>
            ) : locations.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">ยังไม่มี Location</div>
            ) : (
              <div className="space-y-0.5">
                {roots.map(loc => (
                  <LocationRow
                    key={loc.id}
                    loc={loc}
                    allLocations={locations}
                    children={locations.filter(l => l.parentId === loc.id)}
                    onEdit={l => setDialog({ mode: "edit", data: l })}
                    onDelete={l => setDeleteTarget(l)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dialog && (
        <LocationDialog
          mode={dialog.mode}
          initial={dialog.data}
          locations={locations}
          onClose={() => setDialog(null)}
          onSave={data => saveMutation.mutate({ mode: dialog.mode, id: (dialog.data as Location).id, data })}
          saving={saveMutation.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          location={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          deleting={deleteMutation.isPending}
        />
      )}
    </SysAdminLayout>
  );
}
