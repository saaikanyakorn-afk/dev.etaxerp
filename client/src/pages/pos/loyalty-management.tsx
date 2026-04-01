import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import PosLayout from "@/components/pos-layout";
import { Plus, Edit2, Trash2, Gift, Star, Users, History, Award, Search, QrCode, X, Download, Copy } from "lucide-react";

export default function LoyaltyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId") ? Number(params.get("companyId")) : (user as any)?.companyId;

  const [programDialog, setProgramDialog] = useState(false);
  const [rewardDialog, setRewardDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; member: any | null }>({ open: false, member: null });
  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; member: any | null }>({ open: false, member: null });
  const [editProgram, setEditProgram] = useState<any>(null);
  const [editReward, setEditReward] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [qrDialog, setQrDialog] = useState(false);

  const [programForm, setProgramForm] = useState({ name: "", pointsPerSpend: "1", spendAmount: "100", minSpendPerTxn: "0", pointExpireDays: "" });
  const [rewardForm, setRewardForm] = useState({ programId: "", name: "", pointsCost: "", rewardType: "discount", discountAmount: "", discountPercent: "", maxDiscount: "" });
  const [memberForm, setMemberForm] = useState({ programId: "", name: "", phone: "", email: "" });
  const [adjustForm, setAdjustForm] = useState({ points: "", description: "" });

  const { data: programs = [] } = useQuery<any[]>({
    queryKey: ["/api/loyalty/programs", companyId],
    queryFn: async () => { const r = await fetch(`/api/loyalty/programs?companyId=${companyId}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: !!companyId,
  });

  const { data: rewards = [] } = useQuery<any[]>({
    queryKey: ["/api/loyalty/rewards", companyId],
    queryFn: async () => { const r = await fetch(`/api/loyalty/rewards?companyId=${companyId}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: !!companyId,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/loyalty/members", companyId, memberSearch],
    queryFn: async () => { const r = await fetch(`/api/loyalty/members?companyId=${companyId}${memberSearch ? `&search=${encodeURIComponent(memberSearch)}` : ""}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: !!companyId,
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/loyalty/history", historyDialog.member?.id],
    queryFn: async () => { const r = await fetch(`/api/loyalty/history/${historyDialog.member?.id}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    enabled: !!historyDialog.member?.id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/loyalty/programs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/loyalty/rewards"] });
    queryClient.invalidateQueries({ queryKey: ["/api/loyalty/members"] });
  };

  const saveProgramMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editProgram ? `/api/loyalty/programs/${editProgram.id}` : "/api/loyalty/programs";
      const r = await fetch(url, { method: editProgram ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, companyId }), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); } return r.json();
    },
    onSuccess: () => { invalidateAll(); setProgramDialog(false); setEditProgram(null); toast({ title: "บันทึกโปรแกรมสำเร็จ" }); },
    onError: (e: any) => toast({ title: "ผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/loyalty/programs/${id}`, { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("ลบไม่สำเร็จ"); },
    onSuccess: () => { invalidateAll(); toast({ title: "ลบโปรแกรมสำเร็จ" }); },
  });

  const saveRewardMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editReward ? `/api/loyalty/rewards/${editReward.id}` : "/api/loyalty/rewards";
      const r = await fetch(url, { method: editReward ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, companyId }), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); } return r.json();
    },
    onSuccess: () => { invalidateAll(); setRewardDialog(false); setEditReward(null); toast({ title: "บันทึกรางวัลสำเร็จ" }); },
    onError: (e: any) => toast({ title: "ผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/loyalty/rewards/${id}`, { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("ลบไม่สำเร็จ"); },
    onSuccess: () => { invalidateAll(); toast({ title: "ลบรางวัลสำเร็จ" }); },
  });

  const saveMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/loyalty/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, companyId }), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); } return r.json();
    },
    onSuccess: () => { invalidateAll(); setMemberDialog(false); toast({ title: "เพิ่มสมาชิกสำเร็จ" }); },
    onError: (e: any) => toast({ title: "ผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/loyalty/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); } return r.json();
    },
    onSuccess: () => { invalidateAll(); setAdjustDialog({ open: false, member: null }); toast({ title: "ปรับคะแนนสำเร็จ" }); },
    onError: (e: any) => toast({ title: "ผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const openEditProgram = (p: any) => {
    setEditProgram(p);
    setProgramForm({ name: p.name, pointsPerSpend: p.pointsPerSpend || "1", spendAmount: p.spendAmount || "100", minSpendPerTxn: p.minSpendPerTxn || "0", pointExpireDays: p.pointExpireDays ? String(p.pointExpireDays) : "" });
    setProgramDialog(true);
  };

  const openNewProgram = () => {
    setEditProgram(null);
    setProgramForm({ name: "", pointsPerSpend: "1", spendAmount: "100", minSpendPerTxn: "0", pointExpireDays: "" });
    setProgramDialog(true);
  };

  const openEditReward = (r: any) => {
    setEditReward(r);
    setRewardForm({ programId: String(r.programId), name: r.name, pointsCost: String(r.pointsCost), rewardType: r.rewardType, discountAmount: r.discountAmount || "", discountPercent: r.discountPercent || "", maxDiscount: r.maxDiscount || "" });
    setRewardDialog(true);
  };

  const openNewReward = () => {
    setEditReward(null);
    setRewardForm({ programId: programs[0]?.id ? String(programs[0].id) : "", name: "", pointsCost: "", rewardType: "discount", discountAmount: "", discountPercent: "", maxDiscount: "" });
    setRewardDialog(true);
  };

  const openNewMember = () => {
    setMemberForm({ programId: programs[0]?.id ? String(programs[0].id) : "", name: "", phone: "", email: "" });
    setMemberDialog(true);
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });

  return (
    <PosLayout>
      <div className="p-4 w-full overflow-x-hidden space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2"><Star className="h-6 w-6" style={{ color: "#fec90f" }} />ระบบสะสมคะแนน</h1>
          <Button onClick={() => setQrDialog(true)} disabled={programs.length === 0} variant="outline" className="border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7]/10" data-testid="button-loyalty-qr">
            <QrCode className="h-4 w-4 mr-2" />QR สมัครสมาชิก
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold" style={{ color: "#fb9678" }}>{programs.filter((p: any) => p.active).length}</div><div className="text-sm text-muted-foreground">โปรแกรมที่ใช้งาน</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold" style={{ color: "#03c9d7" }}>{members.length}</div><div className="text-sm text-muted-foreground">สมาชิกทั้งหมด</div></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold" style={{ color: "#05b187" }}>{members.reduce((s: number, m: any) => s + (m.totalPoints || 0), 0).toLocaleString()}</div><div className="text-sm text-muted-foreground">คะแนนรวมทั้งหมด</div></CardContent></Card>
        </div>

        <Tabs defaultValue="programs">
          <TabsList>
            <TabsTrigger value="programs" data-testid="tab-programs"><Award className="h-4 w-4 mr-1" />โปรแกรม</TabsTrigger>
            <TabsTrigger value="rewards" data-testid="tab-rewards"><Gift className="h-4 w-4 mr-1" />รางวัลแลกคะแนน</TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members"><Users className="h-4 w-4 mr-1" />สมาชิก</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewProgram} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-new-program"><Plus className="h-4 w-4 mr-2" />สร้างโปรแกรม</Button>
            </div>
            {programs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">ยังไม่มีโปรแกรมสะสมคะแนน<br/>กดปุ่ม "สร้างโปรแกรม" เพื่อเริ่มต้น</CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {programs.map((p: any) => (
                  <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Star className="h-5 w-5" style={{ color: "#fec90f" }} />{p.name}
                          {p.active ? <Badge className="bg-green-100 text-green-700">ใช้งาน</Badge> : <Badge variant="secondary">ปิดใช้งาน</Badge>}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditProgram(p)} data-testid={`button-edit-program-${p.id}`}><Edit2 className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("ลบโปรแกรมนี้?")) deleteProgramMutation.mutate(p.id); }} data-testid={`button-delete-program-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-muted-foreground">อัตราสะสม:</span><div className="font-medium">ทุก ฿{fmt(p.spendAmount)} ได้ {Number(p.pointsPerSpend)} คะแนน</div></div>
                        <div><span className="text-muted-foreground">ยอดซื้อขั้นต่ำ/บิล:</span><div className="font-medium">฿{fmt(p.minSpendPerTxn)}</div></div>
                        <div><span className="text-muted-foreground">คะแนนหมดอายุ:</span><div className="font-medium">{p.pointExpireDays ? `${p.pointExpireDays} วัน` : "ไม่หมดอายุ"}</div></div>
                        <div><span className="text-muted-foreground">สมาชิก:</span><div className="font-medium">{members.filter((m: any) => m.programId === p.id).length} คน</div></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewReward} disabled={programs.length === 0} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90" data-testid="button-new-reward"><Plus className="h-4 w-4 mr-2" />สร้างรางวัล</Button>
            </div>
            {rewards.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">ยังไม่มีรางวัลแลกคะแนน<br/>{programs.length === 0 ? "กรุณาสร้างโปรแกรมก่อน" : "กดปุ่ม \"สร้างรางวัล\" เพื่อเพิ่ม"}</CardContent></Card>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ชื่อรางวัล</TableHead>
                  <TableHead>โปรแกรม</TableHead>
                  <TableHead className="text-right">คะแนนที่ใช้</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">มูลค่า</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>จัดการ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rewards.map((r: any) => {
                    const prog = programs.find((p: any) => p.id === r.programId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium"><Gift className="h-4 w-4 inline mr-1" style={{ color: "#fec90f" }} />{r.name}</TableCell>
                        <TableCell>{prog?.name || "-"}</TableCell>
                        <TableCell className="text-right font-medium" style={{ color: "#fb9678" }}>{r.pointsCost?.toLocaleString()}</TableCell>
                        <TableCell>{r.rewardType === "discount" ? "ส่วนลด (บาท)" : r.rewardType === "percent" ? "ส่วนลด (%)" : r.rewardType}</TableCell>
                        <TableCell className="text-right">{r.discountAmount ? `฿${fmt(r.discountAmount)}` : r.discountPercent ? `${r.discountPercent}%` : "-"}{r.maxDiscount ? ` (สูงสุด ฿${fmt(r.maxDiscount)})` : ""}</TableCell>
                        <TableCell>{r.active ? <Badge className="bg-green-100 text-green-700">ใช้งาน</Badge> : <Badge variant="secondary">ปิด</Badge>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditReward(r)} data-testid={`button-edit-reward-${r.id}`}><Edit2 className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => { if (confirm("ลบรางวัลนี้?")) deleteRewardMutation.mutate(r.id); }} data-testid={`button-delete-reward-${r.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="ค้นหาชื่อ, เบอร์โทร, รหัสสมาชิก..." className="pl-10" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} data-testid="input-member-search" />
              </div>
              <Button onClick={openNewMember} disabled={programs.length === 0} style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="button-new-member"><Plus className="h-4 w-4 mr-2" />เพิ่มสมาชิก</Button>
            </div>
            {members.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">ยังไม่มีสมาชิก<br/>{programs.length === 0 ? "กรุณาสร้างโปรแกรมก่อน" : "กดปุ่ม \"เพิ่มสมาชิก\" เพื่อลงทะเบียน"}</CardContent></Card>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead>โปรแกรม</TableHead>
                  <TableHead className="text-right">คะแนนสะสม</TableHead>
                  <TableHead className="text-right">ยอดซื้อรวม</TableHead>
                  <TableHead className="text-right">จำนวนครั้ง</TableHead>
                  <TableHead>จัดการ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {members.map((m: any) => {
                    const prog = programs.find((p: any) => p.id === m.programId);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{m.memberCode}</TableCell>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell>{m.phone || "-"}</TableCell>
                        <TableCell>{prog?.name || "-"}</TableCell>
                        <TableCell className="text-right font-bold" style={{ color: "#fec90f" }}>{(m.totalPoints || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">฿{fmt(m.totalSpent)}</TableCell>
                        <TableCell className="text-right">{m.visitCount || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" title="ประวัติคะแนน" onClick={() => setHistoryDialog({ open: true, member: m })} data-testid={`button-history-${m.id}`}><History className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" title="ปรับคะแนน" onClick={() => { setAdjustForm({ points: "", description: "" }); setAdjustDialog({ open: true, member: m }); }} data-testid={`button-adjust-${m.id}`}><Edit2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={programDialog} onOpenChange={setProgramDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editProgram ? "แก้ไขโปรแกรม" : "สร้างโปรแกรมสะสมคะแนน"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">ชื่อโปรแกรม</label><Input value={programForm.name} onChange={e => setProgramForm(p => ({ ...p, name: e.target.value }))} placeholder="เช่น สะสมคะแนน Gold Member" data-testid="input-program-name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">ยอดซื้อ (บาท)</label><Input type="number" value={programForm.spendAmount} onChange={e => setProgramForm(p => ({ ...p, spendAmount: e.target.value }))} data-testid="input-spend-amount" /></div>
                <div><label className="text-sm font-medium mb-1 block">ได้คะแนน</label><Input type="number" value={programForm.pointsPerSpend} onChange={e => setProgramForm(p => ({ ...p, pointsPerSpend: e.target.value }))} data-testid="input-points-per-spend" /></div>
              </div>
              <p className="text-xs text-muted-foreground">ตัวอย่าง: ทุก ฿{programForm.spendAmount || "100"} ได้ {programForm.pointsPerSpend || "1"} คะแนน → ซื้อ ฿{Number(programForm.spendAmount || 100) * 5} ได้ {Number(programForm.pointsPerSpend || 1) * 5} คะแนน</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">ยอดซื้อขั้นต่ำ/บิล</label><Input type="number" value={programForm.minSpendPerTxn} onChange={e => setProgramForm(p => ({ ...p, minSpendPerTxn: e.target.value }))} placeholder="0 = ไม่มีขั้นต่ำ" data-testid="input-min-spend" /></div>
                <div><label className="text-sm font-medium mb-1 block">คะแนนหมดอายุ (วัน)</label><Input type="number" value={programForm.pointExpireDays} onChange={e => setProgramForm(p => ({ ...p, pointExpireDays: e.target.value }))} placeholder="ว่าง = ไม่หมดอายุ" data-testid="input-expire-days" /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setProgramDialog(false)}>ยกเลิก</Button>
                <Button onClick={() => saveProgramMutation.mutate(programForm)} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-save-program">บันทึก</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editReward ? "แก้ไขรางวัล" : "สร้างรางวัลแลกคะแนน"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">โปรแกรม</label>
                <Select value={rewardForm.programId} onValueChange={v => setRewardForm(f => ({ ...f, programId: v }))}>
                  <SelectTrigger data-testid="select-reward-program"><SelectValue placeholder="เลือกโปรแกรม" /></SelectTrigger>
                  <SelectContent>{programs.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">ชื่อรางวัล</label><Input value={rewardForm.name} onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ส่วนลด 50 บาท" data-testid="input-reward-name" /></div>
                <div><label className="text-sm font-medium mb-1 block">คะแนนที่ใช้แลก</label><Input type="number" value={rewardForm.pointsCost} onChange={e => setRewardForm(f => ({ ...f, pointsCost: e.target.value }))} data-testid="input-points-cost" /></div>
              </div>
              <div><label className="text-sm font-medium mb-1 block">ประเภทรางวัล</label>
                <Select value={rewardForm.rewardType} onValueChange={v => setRewardForm(f => ({ ...f, rewardType: v }))}>
                  <SelectTrigger data-testid="select-reward-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">ส่วนลด (บาท)</SelectItem>
                    <SelectItem value="percent">ส่วนลด (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rewardForm.rewardType === "discount" && (
                <div><label className="text-sm font-medium mb-1 block">จำนวนส่วนลด (บาท)</label><Input type="number" value={rewardForm.discountAmount} onChange={e => setRewardForm(f => ({ ...f, discountAmount: e.target.value }))} data-testid="input-discount-amount" /></div>
              )}
              {rewardForm.rewardType === "percent" && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-medium mb-1 block">เปอร์เซ็นต์ส่วนลด</label><Input type="number" value={rewardForm.discountPercent} onChange={e => setRewardForm(f => ({ ...f, discountPercent: e.target.value }))} data-testid="input-discount-percent" /></div>
                  <div><label className="text-sm font-medium mb-1 block">ส่วนลดสูงสุด (บาท)</label><Input type="number" value={rewardForm.maxDiscount} onChange={e => setRewardForm(f => ({ ...f, maxDiscount: e.target.value }))} placeholder="ไม่จำกัด" data-testid="input-max-discount" /></div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRewardDialog(false)}>ยกเลิก</Button>
                <Button onClick={() => saveRewardMutation.mutate(rewardForm)} style={{ background: "#03c9d7" }} className="text-white hover:opacity-90" data-testid="button-save-reward">บันทึก</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>เพิ่มสมาชิกใหม่</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1 block">โปรแกรม</label>
                <Select value={memberForm.programId} onValueChange={v => setMemberForm(f => ({ ...f, programId: v }))}>
                  <SelectTrigger data-testid="select-member-program"><SelectValue placeholder="เลือกโปรแกรม" /></SelectTrigger>
                  <SelectContent>{programs.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium mb-1 block">ชื่อสมาชิก</label><Input value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อ-นามสกุล" data-testid="input-member-name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">เบอร์โทร</label><Input value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} placeholder="0812345678" data-testid="input-member-phone" /></div>
                <div><label className="text-sm font-medium mb-1 block">Email</label><Input value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" data-testid="input-member-email" /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMemberDialog(false)}>ยกเลิก</Button>
                <Button onClick={() => saveMemberMutation.mutate(memberForm)} style={{ background: "#05b187" }} className="text-white hover:opacity-90" data-testid="button-save-member">บันทึก</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDialog.open} onOpenChange={o => setHistoryDialog({ open: o, member: o ? historyDialog.member : null })}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>ประวัติคะแนน — {historyDialog.member?.name} ({historyDialog.member?.memberCode})</DialogTitle></DialogHeader>
            <div className="mb-2 text-sm">คะแนนปัจจุบัน: <span className="font-bold text-lg" style={{ color: "#fec90f" }}>{(historyDialog.member?.totalPoints || 0).toLocaleString()}</span> คะแนน</div>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">คะแนน</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">{h.createdAt ? new Date(h.createdAt).toLocaleDateString("th-TH") : "-"}</TableCell>
                      <TableCell>
                        {h.type === "earn" && <Badge className="bg-green-100 text-green-700">สะสม</Badge>}
                        {h.type === "redeem" && <Badge className="bg-red-100 text-red-700">แลก</Badge>}
                        {h.type === "adjust_add" && <Badge className="bg-blue-100 text-blue-700">เพิ่ม</Badge>}
                        {h.type === "adjust_deduct" && <Badge className="bg-orange-100 text-orange-700">หัก</Badge>}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${h.points > 0 ? "text-green-600" : "text-red-600"}`}>{h.points > 0 ? "+" : ""}{h.points}</TableCell>
                      <TableCell className="text-right">{h.balanceAfter?.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{h.description || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติ</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={adjustDialog.open} onOpenChange={o => setAdjustDialog({ open: o, member: o ? adjustDialog.member : null })}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>ปรับคะแนน — {adjustDialog.member?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="text-sm">คะแนนปัจจุบัน: <span className="font-bold" style={{ color: "#fec90f" }}>{(adjustDialog.member?.totalPoints || 0).toLocaleString()}</span></div>
              <div><label className="text-sm font-medium mb-1 block">จำนวนคะแนน (+ เพิ่ม / - ลด)</label><Input type="number" value={adjustForm.points} onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))} placeholder="เช่น 100 หรือ -50" data-testid="input-adjust-points" /></div>
              <div><label className="text-sm font-medium mb-1 block">หมายเหตุ</label><Input value={adjustForm.description} onChange={e => setAdjustForm(f => ({ ...f, description: e.target.value }))} placeholder="เหตุผล" data-testid="input-adjust-description" /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAdjustDialog({ open: false, member: null })}>ยกเลิก</Button>
                <Button onClick={() => adjustMutation.mutate({ companyId, memberId: adjustDialog.member?.id, ...adjustForm, points: Number(adjustForm.points) })} style={{ background: "#fb9678" }} className="text-white hover:opacity-90" data-testid="button-confirm-adjust">บันทึก</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={qrDialog} onOpenChange={setQrDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-center">QR สมัครสมาชิก</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-xl border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/loyalty/signup?c=${companyId}`)}`}
                  alt="QR Code สมัครสมาชิก"
                  className="w-[250px] h-[250px]"
                  data-testid="img-loyalty-qr"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">ให้ลูกค้าสแกน QR Code นี้<br/>เพื่อสมัครสมาชิกสะสมคะแนน</p>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 border-[#03c9d7] text-[#03c9d7]" onClick={() => {
                  const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/loyalty/signup?c=${companyId}`)}`;
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `loyalty-qr-${companyId}.png`;
                  a.target = "_blank";
                  a.click();
                }} data-testid="btn-download-qr">
                  <Download className="h-4 w-4 mr-1" />ดาวน์โหลด
                </Button>
                <Button variant="outline" className="flex-1 border-[#05b187] text-[#05b187]" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/loyalty/signup?c=${companyId}`);
                  toast({ title: "คัดลอกลิงก์แล้ว" });
                }} data-testid="btn-copy-link">
                  <Copy className="h-4 w-4 mr-1" />คัดลอกลิงก์
                </Button>
              </div>
              <Button variant="outline" onClick={() => setQrDialog(false)} className="w-full">ปิด</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PosLayout>
  );
}
