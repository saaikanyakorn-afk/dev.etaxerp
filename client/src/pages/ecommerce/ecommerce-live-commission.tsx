import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useDateSettings } from "@/hooks/use-date-settings";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Radio, Plus, Calculator, Trash2, Pencil, Users, DollarSign,
  ShoppingCart, Clock, TrendingUp, Eye, X,
} from "lucide-react";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", color: "#EE4D2D" },
  { value: "lazada", label: "Lazada", color: "#0F146D" },
  { value: "tiktok", label: "TikTok Shop", color: "#000000" },
  { value: "facebook", label: "Facebook", color: "#1877F2" },
  { value: "line", label: "LINE", color: "#06C755" },
  { value: "website", label: "Website", color: "#6366f1" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "bg-slate-100 text-slate-700" },
  active: { label: "กำลังไลฟ์", color: "bg-green-100 text-green-700" },
  closed: { label: "ปิดรอบ", color: "bg-yellow-100 text-yellow-700" },
  calculated: { label: "คำนวณแล้ว", color: "bg-blue-100 text-blue-700" },
};

function fmt(val: any) {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EcommerceLiveCommission() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateEra, dateFmt } = useDateSettings();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    platforms: [] as string[],
    hostUserIds: [] as number[],
    startedAt: "",
    endedAt: "",
    commissionRate: "3",
    notes: "",
  });

  const { data: shifts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/live-commission/shifts", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/live-commission/shifts?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: companyUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users/company", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/users?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/live-commission/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-commission/shifts"] });
      toast({ title: "สร้างรอบไลฟ์สำเร็จ" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await fetch(`/api/live-commission/shifts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-commission/shifts"] });
      toast({ title: "แก้ไขสำเร็จ" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/live-commission/shifts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-commission/shifts"] });
      toast({ title: "ลบรอบไลฟ์สำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const calculateMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/live-commission/shifts/${id}/calculate`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-commission/shifts"] });
      setShowDetail(data.shift);
      setDetailOrders(data.orders || []);
      toast({ title: `คำนวณคอมมิชชั่น ฿${fmt(data.commissionAmount)}` });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ title: "", platforms: [], hostUserIds: [], startedAt: "", endedAt: "", commissionRate: "3", notes: "" });
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      platforms: s.platforms || [],
      hostUserIds: s.hostUserIds || [],
      startedAt: s.startedAt ? new Date(s.startedAt).toISOString().slice(0, 16) : "",
      endedAt: s.endedAt ? new Date(s.endedAt).toISOString().slice(0, 16) : "",
      commissionRate: s.commissionRate || "3",
      notes: s.notes || "",
    });
    setShowForm(true);
  }

  function handleSave() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function togglePlatform(val: string) {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(val)
        ? prev.platforms.filter(p => p !== val)
        : [...prev.platforms, val],
    }));
  }

  function toggleUser(userId: number) {
    setForm(prev => ({
      ...prev,
      hostUserIds: prev.hostUserIds.includes(userId)
        ? prev.hostUserIds.filter(id => id !== userId)
        : [...prev.hostUserIds, userId],
    }));
  }

  const totalCommission = shifts.reduce((s: number, r: any) => s + parseFloat(r.commissionAmount || "0"), 0);

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="live-commission-page">
        <div className="rounded-lg p-6 shadow-sm border" style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Radio className="h-7 w-7 text-orange-600" />
                คอมมิชชั่นไลฟ์เซลส์
              </h1>
              <p className="text-sm text-orange-700 mt-1">จัดการรอบไลฟ์ และคำนวณค่าคอมจากยอดขายช่วงเวลาไลฟ์</p>
            </div>
            <Button
              data-testid="button-create-shift"
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-orange-500 hover:bg-orange-600 text-white h-9 font-medium"
            >
              <Plus className="h-4 w-4 mr-1" />
              สร้างรอบไลฟ์
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-orange-400">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">รอบไลฟ์ทั้งหมด</div>
              <div className="text-2xl font-bold" data-testid="text-total-shifts">{shifts.length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">คอมมิชชั่นรวม</div>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-commission">฿{fmt(totalCommission)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">คำนวณแล้ว</div>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-calculated-count">
                {shifts.filter((s: any) => s.status === "calculated").length} / {shifts.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>
            ) : shifts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Radio className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีรอบไลฟ์</p>
                <Button variant="outline" className="mt-3" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-1" /> สร้างรอบไลฟ์แรก
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อรอบไลฟ์</TableHead>
                    <TableHead>แพลตฟอร์ม</TableHead>
                    <TableHead>ผู้ไลฟ์</TableHead>
                    <TableHead>เวลาเริ่ม - จบ</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">คอมฯ %</TableHead>
                    <TableHead className="text-right">คอมมิชชั่น</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((s: any) => {
                    const st = STATUS_MAP[s.status] || STATUS_MAP.draft;
                    return (
                      <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(s.platforms || []).map((p: string) => {
                              const pf = PLATFORMS.find(x => x.value === p);
                              return (
                                <Badge key={p} variant="outline" className="text-xs" style={{ borderColor: pf?.color, color: pf?.color }}>
                                  {pf?.label || p}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(s.hostNames || []).map((n: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{n}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{s.startedAt ? formatDate(new Date(s.startedAt), dateFmt, dateEra) : "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.startedAt ? new Date(s.startedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}
                            {s.endedAt ? ` - ${new Date(s.endedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(s.totalRevenue)}</TableCell>
                        <TableCell className="text-right">{s.commissionRate}%</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-green-600">{fmt(s.commissionAmount)}</TableCell>
                        <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} data-testid={`button-edit-${s.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => calculateMutation.mutate(s.id)}
                            disabled={calculateMutation.isPending}
                            data-testid={`button-calc-${s.id}`}
                          >
                            <Calculator className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { if (confirm("ลบรอบไลฟ์นี้?")) deleteMutation.mutate(s.id); }}
                            data-testid={`button-delete-${s.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "แก้ไขรอบไลฟ์" : "สร้างรอบไลฟ์ใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อรอบไลฟ์ *</Label>
                <Input
                  data-testid="input-title"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="เช่น ไลฟ์เย็นวันศุกร์ 20:00"
                />
              </div>

              <div>
                <Label>แพลตฟอร์มที่ไลฟ์ * (เลือกได้หลายแพลตฟอร์ม)</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {PLATFORMS.map(p => (
                    <label key={p.value} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent"
                      style={{ borderColor: form.platforms.includes(p.value) ? p.color : undefined,
                               background: form.platforms.includes(p.value) ? `${p.color}10` : undefined }}>
                      <Checkbox
                        data-testid={`check-platform-${p.value}`}
                        checked={form.platforms.includes(p.value)}
                        onCheckedChange={() => togglePlatform(p.value)}
                      />
                      <span className="text-sm font-medium" style={{ color: p.color }}>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>ผู้ไลฟ์ * (เลือกได้หลายคน)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {companyUsers.map((u: any) => (
                    <label key={u.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent ${form.hostUserIds.includes(u.id) ? "border-orange-400 bg-orange-50" : ""}`}>
                      <Checkbox
                        data-testid={`check-user-${u.id}`}
                        checked={form.hostUserIds.includes(u.id)}
                        onCheckedChange={() => toggleUser(u.id)}
                      />
                      <span className="text-sm">{u.fullName || u.username}</span>
                    </label>
                  ))}
                  {companyUsers.length === 0 && <p className="text-sm text-muted-foreground col-span-2">ไม่พบผู้ใช้ในบริษัท</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>เวลาเริ่มไลฟ์ *</Label>
                  <Input
                    data-testid="input-started-at"
                    type="datetime-local"
                    value={form.startedAt}
                    onChange={e => setForm(p => ({ ...p, startedAt: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>เวลาจบไลฟ์</Label>
                  <Input
                    data-testid="input-ended-at"
                    type="datetime-local"
                    value={form.endedAt}
                    onChange={e => setForm(p => ({ ...p, endedAt: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>อัตราคอมมิชชั่น (%)</Label>
                <Input
                  data-testid="input-rate"
                  type="number"
                  step="0.01"
                  value={form.commissionRate}
                  onChange={e => setForm(p => ({ ...p, commissionRate: e.target.value }))}
                  placeholder="3"
                />
              </div>

              <div>
                <Label>หมายเหตุ</Label>
                <Textarea
                  data-testid="input-notes"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="หมายเหตุเพิ่มเติม"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>ยกเลิก</Button>
              <Button
                data-testid="button-save"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || !form.title || !form.platforms.length || !form.hostUserIds.length || !form.startedAt}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showDetail} onOpenChange={(open) => { if (!open) { setShowDetail(null); setDetailOrders([]); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                ผลคำนวณคอมมิชชั่น: {showDetail?.title}
              </DialogTitle>
            </DialogHeader>
            {showDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="border-l-4 border-l-blue-400">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" />ออเดอร์</div>
                      <div className="text-xl font-bold">{showDetail.totalOrders || 0}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-400">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />ยอดขาย</div>
                      <div className="text-xl font-bold text-green-600">฿{fmt(showDetail.totalRevenue)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-orange-400">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />อัตราคอม</div>
                      <div className="text-xl font-bold">{showDetail.commissionRate}%</div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-400">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />คอมมิชชั่น</div>
                      <div className="text-xl font-bold text-red-600">฿{fmt(showDetail.commissionAmount)}</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2 flex-wrap text-sm">
                  <span className="text-muted-foreground">แพลตฟอร์ม:</span>
                  {(showDetail.platforms || []).map((p: string) => {
                    const pf = PLATFORMS.find(x => x.value === p);
                    return <Badge key={p} variant="outline" style={{ borderColor: pf?.color, color: pf?.color }}>{pf?.label || p}</Badge>;
                  })}
                </div>

                {detailOrders.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">ออเดอร์ที่นับ ({detailOrders.length} รายการ)</h3>
                    <div className="border rounded max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>เลขออเดอร์</TableHead>
                            <TableHead>แพลตฟอร์ม</TableHead>
                            <TableHead>ลูกค้า</TableHead>
                            <TableHead className="text-right">ยอด</TableHead>
                            <TableHead>เวลา</TableHead>
                            <TableHead>สถานะ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailOrders.map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell className="text-sm font-mono">{o.orderNo || o.id}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs" style={{ borderColor: PLATFORMS.find(x => x.value === o.platform)?.color }}>
                                  {PLATFORMS.find(x => x.value === o.platform)?.label || o.platform}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{o.buyerName || "-"}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(o.totalAmount)}</TableCell>
                              <TableCell className="text-sm">{o.placedAt ? new Date(o.placedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-xs">{o.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
