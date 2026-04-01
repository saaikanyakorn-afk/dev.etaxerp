import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import SettingsTabs from "@/components/settings-tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { Plus, Pencil, Trash2, Check, X, Building2, GitBranch } from "lucide-react";

export default function DeptBranchPage() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"dept" | "branch">("branch");

  const { data: deptList = [] } = useQuery<any[]>({
    queryKey: ["/api/departments", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const r = await fetch(`/api/departments?companyId=${companyId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!companyId,
  });

  const { data: branchList = [] } = useQuery<any[]>({
    queryKey: ["/api/branches", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const r = await fetch(`/api/branches?companyId=${companyId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!companyId,
  });

  const [newDept, setNewDept] = useState({ name: "", description: "" });
  const [editDept, setEditDept] = useState<any>(null);
  const [newBranch, setNewBranch] = useState({ code: "", name: "", address: "", taxId: "" });
  const [editBranch, setEditBranch] = useState<any>(null);

  const createDept = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...newDept, companyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setNewDept({ name: "", description: "" });
      toast({ title: "เพิ่มแผนกสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const updateDept = useMutation({
    mutationFn: async (dept: any) => {
      const r = await fetch(`/api/departments/${dept.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: dept.name, description: dept.description }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditDept(null);
      toast({ title: "แก้ไขแผนกสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/departments/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "ลบแผนกสำเร็จ" });
    },
  });

  const createBranch = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/branches", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...newBranch, companyId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setNewBranch({ code: "", name: "", address: "", taxId: "" });
      toast({ title: "เพิ่มสาขาสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const updateBranch = useMutation({
    mutationFn: async (branch: any) => {
      const r = await fetch(`/api/branches/${branch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ code: branch.code, name: branch.name, address: branch.address, taxId: branch.taxId }) });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setEditBranch(null);
      toast({ title: "แก้ไขสาขาสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deleteBranch = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/branches/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "ลบสาขาสำเร็จ" });
    },
  });

  return (
    <Layout>
      <SettingsTabs />
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold mb-6" data-testid="text-page-title">จัดการแผนกและสาขา</h1>

        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === "branch" ? "default" : "outline"}
            onClick={() => setTab("branch")}
            className={tab === "branch" ? "bg-[#fb9678] hover:bg-[#e8856a]" : ""}
            data-testid="tab-branch"
          >
            <GitBranch className="h-4 w-4 mr-1.5" /> สาขา ({branchList.length})
          </Button>
          <Button
            variant={tab === "dept" ? "default" : "outline"}
            onClick={() => setTab("dept")}
            className={tab === "dept" ? "bg-[#fb9678] hover:bg-[#e8856a]" : ""}
            data-testid="tab-dept"
          >
            <Building2 className="h-4 w-4 mr-1.5" /> แผนก ({deptList.length})
          </Button>
        </div>

        {tab === "branch" && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="font-semibold text-sm mb-3">เพิ่มสาขาใหม่</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input data-testid="input-new-branch-code" placeholder="รหัสสาขา (เช่น 00000, 00001)" value={newBranch.code} onChange={e => setNewBranch(p => ({ ...p, code: e.target.value }))} className="text-sm" />
                <Input data-testid="input-new-branch-name" placeholder="ชื่อสาขา (เช่น สำนักงานใหญ่)" value={newBranch.name} onChange={e => setNewBranch(p => ({ ...p, name: e.target.value }))} className="text-sm" />
                <Input data-testid="input-new-branch-address" placeholder="ที่อยู่ (ไม่บังคับ)" value={newBranch.address} onChange={e => setNewBranch(p => ({ ...p, address: e.target.value }))} className="text-sm" />
                <div className="flex gap-2">
                  <Input data-testid="input-new-branch-taxid" placeholder="เลขผู้เสียภาษี" value={newBranch.taxId} onChange={e => setNewBranch(p => ({ ...p, taxId: e.target.value }))} className="text-sm flex-1" />
                  <Button data-testid="btn-add-branch" onClick={() => createBranch.mutate()} disabled={!newBranch.code || !newBranch.name || createBranch.isPending} className="bg-[#05b187] hover:bg-[#049a75] shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">รหัสสาขา: 00000 = สำนักงานใหญ่, 00001-99999 = สาขาลำดับที่ (ตามแบบ ภ.พ.20 สรรพากร)</p>
            </div>
            <div className="divide-y">
              {branchList.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">ยังไม่มีสาขา กรุณาเพิ่มสาขาด้านบน</div>
              )}
              {branchList.map((b: any) => (
                <div key={b.id} className="px-4 py-3 flex items-center gap-3" data-testid={`branch-row-${b.id}`}>
                  {editBranch?.id === b.id ? (
                    <>
                      <Input value={editBranch.code} onChange={e => setEditBranch((p: any) => ({ ...p, code: e.target.value }))} className="text-sm w-28" />
                      <Input value={editBranch.name} onChange={e => setEditBranch((p: any) => ({ ...p, name: e.target.value }))} className="text-sm flex-1" />
                      <Input value={editBranch.address || ""} onChange={e => setEditBranch((p: any) => ({ ...p, address: e.target.value }))} className="text-sm flex-1" placeholder="ที่อยู่" />
                      <Input value={editBranch.taxId || ""} onChange={e => setEditBranch((p: any) => ({ ...p, taxId: e.target.value }))} className="text-sm w-36" placeholder="เลขผู้เสียภาษี" />
                      <Button size="icon" variant="ghost" onClick={() => updateBranch.mutate(editBranch)} data-testid={`btn-save-branch-${b.id}`}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditBranch(null)} data-testid={`btn-cancel-branch-${b.id}`}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded w-20 text-center shrink-0">{b.code}</span>
                      <span className="text-sm font-medium flex-1">{b.name}</span>
                      <span className="text-xs text-slate-400 flex-1 truncate">{b.address || "-"}</span>
                      <span className="text-xs text-slate-400 w-36 truncate">{b.taxId || "-"}</span>
                      <Button size="icon" variant="ghost" onClick={() => setEditBranch({ ...b })} data-testid={`btn-edit-branch-${b.id}`}><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("ต้องการลบสาขานี้?")) deleteBranch.mutate(b.id); }} data-testid={`btn-delete-branch-${b.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "dept" && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="font-semibold text-sm mb-3">เพิ่มแผนกใหม่</h2>
              <div className="flex gap-2">
                <Input data-testid="input-new-dept-name" placeholder="ชื่อแผนก" value={newDept.name} onChange={e => setNewDept(p => ({ ...p, name: e.target.value }))} className="text-sm flex-1" />
                <Input data-testid="input-new-dept-desc" placeholder="หมายเหตุ (ไม่บังคับ)" value={newDept.description} onChange={e => setNewDept(p => ({ ...p, description: e.target.value }))} className="text-sm flex-1" />
                <Button data-testid="btn-add-dept" onClick={() => createDept.mutate()} disabled={!newDept.name || createDept.isPending} className="bg-[#05b187] hover:bg-[#049a75] shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> เพิ่ม
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {deptList.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">ยังไม่มีแผนก กรุณาเพิ่มแผนกด้านบน</div>
              )}
              {deptList.map((d: any) => (
                <div key={d.id} className="px-4 py-3 flex items-center gap-3" data-testid={`dept-row-${d.id}`}>
                  {editDept?.id === d.id ? (
                    <>
                      <Input value={editDept.name} onChange={e => setEditDept((p: any) => ({ ...p, name: e.target.value }))} className="text-sm flex-1" />
                      <Input value={editDept.description || ""} onChange={e => setEditDept((p: any) => ({ ...p, description: e.target.value }))} className="text-sm flex-1" placeholder="หมายเหตุ" />
                      <Button size="icon" variant="ghost" onClick={() => updateDept.mutate(editDept)} data-testid={`btn-save-dept-${d.id}`}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditDept(null)} data-testid={`btn-cancel-dept-${d.id}`}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium flex-1">{d.name}</span>
                      <span className="text-xs text-slate-400 flex-1">{d.description || "-"}</span>
                      <Button size="icon" variant="ghost" onClick={() => setEditDept({ ...d })} data-testid={`btn-edit-dept-${d.id}`}><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("ต้องการลบแผนกนี้?")) deleteDept.mutate(d.id); }} data-testid={`btn-delete-dept-${d.id}`}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
