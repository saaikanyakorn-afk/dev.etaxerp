import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function TableSettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [editArea, setEditArea] = useState<any>(null);
  const [editTable, setEditTable] = useState<any>(null);
  const [areaName, setAreaName] = useState("");
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const [tableAreaId, setTableAreaId] = useState<string>("");

  const { data: areas } = useQuery<any[]>({
    queryKey: ["/api/restaurant/areas", companyId],
    queryFn: async () => { const res = await fetch(`/api/restaurant/areas?companyId=${companyId}`, { credentials: "include" }); return res.json(); },
    enabled: !!companyId,
  });

  const { data: tables } = useQuery<any[]>({
    queryKey: ["/api/restaurant/tables", companyId],
    queryFn: async () => { const res = await fetch(`/api/restaurant/tables?companyId=${companyId}`, { credentials: "include" }); return res.json(); },
    enabled: !!companyId,
  });

  const saveArea = useMutation({
    mutationFn: async () => {
      const url = editArea ? `/api/restaurant/areas/${editArea.id}` : "/api/restaurant/areas";
      const method = editArea ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ companyId, name: areaName, sortOrder: (areas?.length || 0) + 1 }) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/areas"] }); setShowAreaForm(false); setAreaName(""); setEditArea(null); toast({ title: "บันทึกแล้ว" }); },
  });

  const deleteArea = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/restaurant/areas/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/areas"] }); toast({ title: "ลบแล้ว" }); },
  });

  const saveTable = useMutation({
    mutationFn: async () => {
      const url = editTable ? `/api/restaurant/tables/${editTable.id}` : "/api/restaurant/tables";
      const method = editTable ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ companyId, name: tableName, capacity: Number(tableCapacity), areaId: tableAreaId ? Number(tableAreaId) : null, sortOrder: (tables?.length || 0) + 1 }) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] }); setShowTableForm(false); setTableName(""); setTableCapacity("4"); setTableAreaId(""); setEditTable(null); toast({ title: "บันทึกแล้ว" }); },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/restaurant/tables/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/tables"] }); toast({ title: "ลบแล้ว" }); },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/restaurant-pos")} data-testid="btn-back"><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
          <h1 className="text-xl font-heading font-bold">จัดการโต๊ะ / โซน</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="font-medium">โซน (Area)</p>
              <Button size="sm" onClick={() => { setEditArea(null); setAreaName(""); setShowAreaForm(true); }} data-testid="btn-add-area"><Plus className="h-4 w-4 mr-1" /> เพิ่มโซน</Button>
            </div>
          </CardHeader>
          <CardContent>
            {areas?.length ? (
              <div className="space-y-2">
                {areas.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{a.name}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditArea(a); setAreaName(a.name); setShowAreaForm(true); }} data-testid={`btn-edit-area-${a.id}`}><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteArea.mutate(a.id)} data-testid={`btn-del-area-${a.id}`}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-sm">ยังไม่มีโซน</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="font-medium">โต๊ะ</p>
              <Button size="sm" onClick={() => { setEditTable(null); setTableName(""); setTableCapacity("4"); setTableAreaId(""); setShowTableForm(true); }} data-testid="btn-add-table"><Plus className="h-4 w-4 mr-1" /> เพิ่มโต๊ะ</Button>
            </div>
          </CardHeader>
          <CardContent>
            {tables?.length ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">โซน</th><th className="text-center p-2">ที่นั่ง</th><th className="text-center p-2">สถานะ</th><th className="text-center p-2">จัดการ</th></tr></thead>
                <tbody>
                  {tables.map(t => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-2 font-medium">{t.name}</td>
                      <td className="p-2">{areas?.find(a => a.id === t.areaId)?.name || "-"}</td>
                      <td className="p-2 text-center">{t.capacity}</td>
                      <td className="p-2 text-center">{t.status}</td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="ghost" onClick={() => { setEditTable(t); setTableName(t.name); setTableCapacity(String(t.capacity)); setTableAreaId(t.areaId ? String(t.areaId) : ""); setShowTableForm(true); }} data-testid={`btn-edit-table-${t.id}`}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTable.mutate(t.id)} data-testid={`btn-del-table-${t.id}`}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-muted-foreground text-sm">ยังไม่มีโต๊ะ</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAreaForm} onOpenChange={setShowAreaForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editArea ? "แก้ไขโซน" : "เพิ่มโซน"}</DialogTitle></DialogHeader>
          <Input value={areaName} onChange={e => setAreaName(e.target.value)} placeholder="ชื่อโซน" data-testid="input-area-name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAreaForm(false)}>ยกเลิก</Button>
            <Button onClick={() => saveArea.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-area"><Save className="h-4 w-4 mr-1" /> บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTableForm} onOpenChange={setShowTableForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTable ? "แก้ไขโต๊ะ" : "เพิ่มโต๊ะ"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="ชื่อโต๊ะ" data-testid="input-table-name" />
            <Input type="number" value={tableCapacity} onChange={e => setTableCapacity(e.target.value)} placeholder="จำนวนที่นั่ง" data-testid="input-table-capacity" />
            <Select value={tableAreaId} onValueChange={setTableAreaId}>
              <SelectTrigger data-testid="select-table-area"><SelectValue placeholder="เลือกโซน (ไม่บังคับ)" /></SelectTrigger>
              <SelectContent>
                {areas?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTableForm(false)}>ยกเลิก</Button>
            <Button onClick={() => saveTable.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-table"><Save className="h-4 w-4 mr-1" /> บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
