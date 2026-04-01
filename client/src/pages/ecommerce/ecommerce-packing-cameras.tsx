import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Camera, Plus, Pencil, Trash2, Loader2, CheckCircle2, XCircle, Wifi } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

export default function EcommercePackingCameras() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", rtspUrl: "", snapshotUrl: "", stationName: "" });

  const { data: cameras = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/packing/cameras", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/packing/cameras?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editId ? `/api/ecommerce/packing/cameras/${editId}` : "/api/ecommerce/packing/cameras";
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editId ? "แก้ไขกล้องสำเร็จ" : "เพิ่มกล้องสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/packing/cameras"] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/packing/cameras/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบกล้องสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/packing/cameras"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/packing/cameras/${id}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: data.status === "ok" ? "ทดสอบสำเร็จ" : "ทดสอบล้มเหลว", description: data.message });
    },
    onError: (err: any) => toast({ title: "ทดสอบล้มเหลว", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`/api/ecommerce/packing/cameras/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ isActive, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/packing/cameras"] }),
  });

  const resetForm = () => { setForm({ name: "", rtspUrl: "", snapshotUrl: "", stationName: "" }); setEditId(null); };

  const openEdit = (cam: any) => {
    setEditId(cam.id);
    setForm({ name: cam.name, rtspUrl: cam.rtspUrl, snapshotUrl: cam.snapshotUrl || "", stationName: cam.stationName || "" });
    setShowForm(true);
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-packing-cameras">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">ตั้งค่ากล้องวงจรปิด (CCTV)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">เชื่อมต่อกล้องวงจรปิดกับสถานีแพ็คสินค้า เพื่อบันทึกวิดีโอการแพ็คแต่ละออเดอร์</p>
          </div>
          <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-camera">
            <Plus className="h-4 w-4" />เพิ่มกล้อง
          </Button>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Camera className="h-4 w-4 text-[#03c9d7]" />
              รายการกล้อง ({cameras.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : cameras.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">ยังไม่มีกล้องวงจรปิด</p>
                <p className="text-xs mt-1">กดปุ่ม "เพิ่มกล้อง" เพื่อเริ่มตั้งค่า</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ชื่อกล้อง</TableHead>
                    <TableHead className="text-xs">สถานีแพ็ค</TableHead>
                    <TableHead className="text-xs">RTSP URL</TableHead>
                    <TableHead className="text-xs">Snapshot URL</TableHead>
                    <TableHead className="text-xs text-center">สถานะ</TableHead>
                    <TableHead className="text-xs text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((cam: any) => (
                    <TableRow key={cam.id} data-testid={`row-camera-${cam.id}`}>
                      <TableCell className="text-sm font-medium">{cam.name}</TableCell>
                      <TableCell className="text-sm">{cam.stationName || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cam.rtspUrl}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cam.snapshotUrl || "-"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={cam.isActive}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: cam.id, isActive: v })}
                            data-testid={`switch-camera-${cam.id}`}
                          />
                          {cam.isActive ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">เปิด</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">ปิด</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => testMutation.mutate(cam.id)} disabled={testMutation.isPending} data-testid={`button-test-${cam.id}`}>
                            {testMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                            ทดสอบ
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEdit(cam)} data-testid={`button-edit-${cam.id}`}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบกล้องนี้?")) deleteMutation.mutate(cam.id); }} data-testid={`button-delete-${cam.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">วิธีการตั้งค่า</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p><strong>1. RTSP URL:</strong> ใส่ URL ของกล้อง เช่น <code>rtsp://admin:password@192.168.1.100:554/stream1</code></p>
            <p><strong>2. Snapshot URL:</strong> URL สำหรับถ่ายภาพนิ่ง เช่น <code>http://192.168.1.100/cgi-bin/snapshot.cgi</code> (ถ้ามี)</p>
            <p><strong>3. สถานีแพ็ค:</strong> ตั้งชื่อสถานีแพ็คสินค้า เช่น "สถานี A", "โต๊ะแพ็ค 1"</p>
            <p><strong>4. ทดสอบ:</strong> กดปุ่มทดสอบเพื่อตรวจสอบการเชื่อมต่อ</p>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-700">กล้องที่รองรับ:</p>
              <p className="mt-1 text-blue-600">Hikvision, Dahua, TP-Link VIGI, Reolink, UniFi Protect และกล้อง IP ที่รองรับ RTSP/ONVIF</p>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editId ? "แก้ไขกล้อง" : "เพิ่มกล้องใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ชื่อกล้อง *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น กล้องสถานี A" className="mt-1" data-testid="input-camera-name" />
              </div>
              <div>
                <label className="text-sm font-medium">RTSP URL *</label>
                <Input value={form.rtspUrl} onChange={e => setForm(f => ({ ...f, rtspUrl: e.target.value }))} placeholder="rtsp://admin:pass@192.168.1.100:554/stream1" className="mt-1 font-mono text-xs" data-testid="input-rtsp-url" />
              </div>
              <div>
                <label className="text-sm font-medium">Snapshot URL (ไม่บังคับ)</label>
                <Input value={form.snapshotUrl} onChange={e => setForm(f => ({ ...f, snapshotUrl: e.target.value }))} placeholder="http://192.168.1.100/cgi-bin/snapshot.cgi" className="mt-1 font-mono text-xs" data-testid="input-snapshot-url" />
              </div>
              <div>
                <label className="text-sm font-medium">สถานีแพ็ค</label>
                <Input value={form.stationName} onChange={e => setForm(f => ({ ...f, stationName: e.target.value }))} placeholder="เช่น โต๊ะแพ็ค 1" className="mt-1" data-testid="input-station-name" />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!form.name || !form.rtspUrl || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}
                data-testid="button-save-camera"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editId ? "บันทึกการแก้ไข" : "เพิ่มกล้อง"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
