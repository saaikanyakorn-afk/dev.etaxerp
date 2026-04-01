import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Layers, Plus, Zap, Loader2, Package, CheckCircle2, Clock, FileText, User, Play, Check, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

export default function EcommerceWavePicking() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignPicker, setAssignPicker] = useState("");
  const [createForm, setCreateForm] = useState({
    waveType: "manual",
    carrier: "",
    shippingCutoff: "",
  });

  const { data: waves = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/picking/waves", selectedCompanyId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (statusFilter !== "all") params.append("status", statusFilter);
      const r = await fetch(`/api/ecommerce/picking/waves?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: waveDetail } = useQuery<any>({
    queryKey: ["/api/ecommerce/picking/waves", selectedWaveId, selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/picking/waves/${selectedWaveId}?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedWaveId && !!selectedCompanyId,
  });

  const { data: waveItems = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/picking/waves", selectedWaveId, "items", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/picking/waves/${selectedWaveId}/items?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedWaveId && !!selectedCompanyId && showDetailDialog,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ecommerce/picking/waves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "สร้างคลื่นสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
      setShowCreateDialog(false);
      setCreateForm({ waveType: "manual", carrier: "", shippingCutoff: "" });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const autoCreateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ecommerce/picking/waves/auto-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "สร้างคลื่นอัตโนมัติสำเร็จ", description: `สร้างแล้ว ${data.count || 0} คลื่น` });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ waveId, picker }: { waveId: number; picker: string }) => {
      const r = await fetch(`/api/ecommerce/picking/waves/${waveId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ picker, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "กำหนดผู้จัดเก็บสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
      setShowAssignDialog(false);
      setAssignPicker("");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: async (waveId: number) => {
      const r = await fetch(`/api/ecommerce/picking/waves/${waveId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "เริ่มจัดเก็บสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async (waveId: number) => {
      const r = await fetch(`/api/ecommerce/picking/waves/${waveId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "จัดเก็บเสร็จสิ้น" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const pickItemMutation = useMutation({
    mutationFn: async ({ waveId, itemId }: { waveId: number; itemId: number }) => {
      const r = await fetch(`/api/ecommerce/picking/waves/${waveId}/items/${itemId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "จัดเก็บรายการสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves", selectedWaveId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs" data-testid="badge-status-draft">ร่าง</Badge>;
      case "picking":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs" data-testid="badge-status-picking">กำลังจัดเก็บ</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs" data-testid="badge-status-completed">เสร็จสิ้น</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs" data-testid="badge-status-cancelled">ยกเลิก</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs">{status}</Badge>;
    }
  };

  const totalWaves = waves.length;
  const pickingCount = waves.filter((w: any) => w.status === "picking").length;
  const completedCount = waves.filter((w: any) => w.status === "completed").length;
  const draftCount = waves.filter((w: any) => w.status === "draft").length;

  const openWaveDetail = (wave: any) => {
    setSelectedWaveId(wave.id);
    setShowDetailDialog(true);
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-wave-picking">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">จัดการคลื่น/ล็อตจัดเก็บ (Wave Picking)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">จัดกลุ่มออเดอร์เป็นคลื่นเพื่อจัดเก็บสินค้าอย่างมีประสิทธิภาพ</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-1 text-[#03c9d7] border-[#03c9d7] hover:bg-[#03c9d7]/10"
              onClick={() => autoCreateMutation.mutate()}
              disabled={autoCreateMutation.isPending}
              data-testid="button-auto-create"
            >
              {autoCreateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              สร้างอัตโนมัติ
            </Button>
            <Button
              className="bg-[#fb9678] hover:bg-[#e8866a] text-white gap-1"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-wave"
            >
              <Plus className="h-4 w-4" />สร้างคลื่นใหม่
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rounded-xl shadow-sm" data-testid="card-stat-total">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">คลื่นทั้งหมด</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-stat-total">{totalWaves}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-[#fb9678]/10">
                  <Layers className="h-5 w-5 text-[#fb9678]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-stat-picking">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">กำลังจัดเก็บ</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600" data-testid="text-stat-picking">{pickingCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-stat-completed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">เสร็จสิ้น</p>
                  <p className="text-2xl font-bold mt-1 text-green-600" data-testid="text-stat-completed">{completedCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm" data-testid="card-stat-draft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">รออนุมัติ</p>
                  <p className="text-2xl font-bold mt-1 text-gray-600" data-testid="text-stat-draft">{draftCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#fb9678]" />
                รายการคลื่นจัดเก็บ
              </CardTitle>
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-2">
              <TabsList className="h-8" data-testid="tabs-status-filter">
                <TabsTrigger value="all" className="text-xs h-7" data-testid="tab-all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs h-7" data-testid="tab-draft">ร่าง</TabsTrigger>
                <TabsTrigger value="picking" className="text-xs h-7" data-testid="tab-picking">กำลังจัดเก็บ</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs h-7" data-testid="tab-completed">เสร็จสิ้น</TabsTrigger>
                <TabsTrigger value="cancelled" className="text-xs h-7" data-testid="tab-cancelled">ยกเลิก</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : waves.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">ยังไม่มีคลื่นจัดเก็บ</p>
                <p className="text-xs mt-1">กดปุ่ม "สร้างคลื่นใหม่" หรือ "สร้างอัตโนมัติ" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">เลขที่คลื่น</TableHead>
                      <TableHead className="text-xs">ประเภท</TableHead>
                      <TableHead className="text-xs">ขนส่ง</TableHead>
                      <TableHead className="text-xs text-center">จำนวนออเดอร์</TableHead>
                      <TableHead className="text-xs text-center">รายการ</TableHead>
                      <TableHead className="text-xs">จัดเก็บแล้ว</TableHead>
                      <TableHead className="text-xs">ผู้จัดเก็บ</TableHead>
                      <TableHead className="text-xs text-center">สถานะ</TableHead>
                      <TableHead className="text-xs">วันที่สร้าง</TableHead>
                      <TableHead className="text-xs text-center">เครื่องมือ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waves.map((wave: any) => {
                      const totalItems = wave.totalItems || 0;
                      const pickedItems = wave.pickedItems || 0;
                      const progressPct = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;
                      return (
                        <TableRow
                          key={wave.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => openWaveDetail(wave)}
                          data-testid={`row-wave-${wave.id}`}
                        >
                          <TableCell className="text-sm font-medium text-[#fb9678]" data-testid={`text-wave-number-${wave.id}`}>
                            {wave.waveNumber || `W-${wave.id}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline" className="text-xs">
                              {wave.waveType === "auto" ? "อัตโนมัติ" : "กำหนดเอง"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{wave.carrier || "-"}</TableCell>
                          <TableCell className="text-sm text-center" data-testid={`text-order-count-${wave.id}`}>{wave.orderCount || 0}</TableCell>
                          <TableCell className="text-sm text-center">{totalItems}</TableCell>
                          <TableCell className="min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <Progress value={progressPct} className="h-2 flex-1" data-testid={`progress-wave-${wave.id}`} />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{pickedItems}/{totalItems}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{wave.picker || "-"}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(wave.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {wave.createdAt ? new Date(wave.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {wave.status === "draft" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => { setSelectedWaveId(wave.id); setShowAssignDialog(true); }}
                                    data-testid={`button-assign-${wave.id}`}
                                  >
                                    <User className="h-3 w-3" />กำหนด
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                                    onClick={() => startMutation.mutate(wave.id)}
                                    disabled={startMutation.isPending}
                                    data-testid={`button-start-${wave.id}`}
                                  >
                                    <Play className="h-3 w-3" />เริ่ม
                                  </Button>
                                </>
                              )}
                              {wave.status === "picking" && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1 bg-green-500 hover:bg-green-600 text-white"
                                  onClick={() => completeMutation.mutate(wave.id)}
                                  disabled={completeMutation.isPending}
                                  data-testid={`button-complete-${wave.id}`}
                                >
                                  <Check className="h-3 w-3" />เสร็จ
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>สร้างคลื่นจัดเก็บใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ประเภทคลื่น *</label>
                <Select value={createForm.waveType} onValueChange={(v) => setCreateForm(f => ({ ...f, waveType: v }))} data-testid="select-wave-type">
                  <SelectTrigger className="mt-1" data-testid="select-wave-type-trigger">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual" data-testid="option-manual">กำหนดเอง (Manual)</SelectItem>
                    <SelectItem value="auto" data-testid="option-auto">อัตโนมัติ (Auto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ขนส่ง (ตัวกรอง)</label>
                <Input
                  value={createForm.carrier}
                  onChange={e => setCreateForm(f => ({ ...f, carrier: e.target.value }))}
                  placeholder="เช่น Kerry, Flash, J&T"
                  className="mt-1"
                  data-testid="input-carrier"
                />
              </div>
              <div>
                <label className="text-sm font-medium">กำหนดส่งภายใน</label>
                <ThaiDateInput
                  value={createForm.shippingCutoff}
                  onChange={(v: string) => setCreateForm(f => ({ ...f, shippingCutoff: v }))}
                  dateEra={dateEra} dateFmt={dateFmt}
                  className="mt-1"
                  data-testid="input-shipping-cutoff"
                />
              </div>
              <Button
                className="w-full bg-[#fb9678] hover:bg-[#e8866a] text-white"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(createForm)}
                data-testid="button-save-wave"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                สร้างคลื่น
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>กำหนดผู้จัดเก็บ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ชื่อผู้จัดเก็บ *</label>
                <Input
                  value={assignPicker}
                  onChange={e => setAssignPicker(e.target.value)}
                  placeholder="เช่น สมชาย, พนักงาน A"
                  className="mt-1"
                  data-testid="input-picker-name"
                />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!assignPicker || assignMutation.isPending}
                onClick={() => selectedWaveId && assignMutation.mutate({ waveId: selectedWaveId, picker: assignPicker })}
                data-testid="button-save-assign"
              >
                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#fb9678]" />
                รายละเอียดคลื่น {waveDetail?.waveNumber || (selectedWaveId ? `W-${selectedWaveId}` : "")}
              </DialogTitle>
            </DialogHeader>
            {waveDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">สถานะ</p>
                    <div className="mt-1">{getStatusBadge(waveDetail.status)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">ประเภท</p>
                    <p className="text-sm font-medium mt-1">{waveDetail.waveType === "auto" ? "อัตโนมัติ" : "กำหนดเอง"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">ขนส่ง</p>
                    <p className="text-sm font-medium mt-1">{waveDetail.carrier || "-"}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground">ผู้จัดเก็บ</p>
                    <p className="text-sm font-medium mt-1">{waveDetail.picker || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Progress
                    value={waveDetail.totalItems > 0 ? Math.round((waveDetail.pickedItems / waveDetail.totalItems) * 100) : 0}
                    className="h-3 flex-1"
                    data-testid="progress-detail"
                  />
                  <span className="text-sm font-medium" data-testid="text-progress-detail">
                    {waveDetail.pickedItems || 0}/{waveDetail.totalItems || 0}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {waveDetail.status === "draft" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => { setShowAssignDialog(true); }}
                        data-testid="button-detail-assign"
                      >
                        <User className="h-4 w-4" />กำหนดผู้จัดเก็บ
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => startMutation.mutate(waveDetail.id)}
                        disabled={startMutation.isPending}
                        data-testid="button-detail-start"
                      >
                        {startMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-4 w-4" />}
                        เริ่มจัดเก็บ
                      </Button>
                    </>
                  )}
                  {waveDetail.status === "picking" && (
                    <Button
                      size="sm"
                      className="gap-1 bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => completeMutation.mutate(waveDetail.id)}
                      disabled={completeMutation.isPending}
                      data-testid="button-detail-complete"
                    >
                      {completeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      จัดเก็บเสร็จ
                    </Button>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4 text-[#03c9d7]" />
                    รายการสินค้า ({waveItems.length})
                  </h3>
                  {waveItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs">ไม่มีรายการสินค้า</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">SKU</TableHead>
                            <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                            <TableHead className="text-xs">ตำแหน่ง</TableHead>
                            <TableHead className="text-xs text-center">จำนวน</TableHead>
                            <TableHead className="text-xs text-center">จัดเก็บแล้ว</TableHead>
                            <TableHead className="text-xs text-center">สถานะ</TableHead>
                            <TableHead className="text-xs text-center">จัดเก็บ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {waveItems.map((item: any) => (
                            <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                              <TableCell className="text-xs font-mono" data-testid={`text-sku-${item.id}`}>{item.sku || "-"}</TableCell>
                              <TableCell className="text-sm">{item.productName || "-"}</TableCell>
                              <TableCell className="text-xs">
                                {item.binLocation ? (
                                  <span className="flex items-center gap-1 text-[#03c9d7]">
                                    <MapPin className="h-3 w-3" />{item.binLocation}
                                  </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-sm text-center">{item.quantity || 0}</TableCell>
                              <TableCell className="text-sm text-center">{item.pickedQty || 0}</TableCell>
                              <TableCell className="text-center">
                                {item.picked ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">จัดเก็บแล้ว</Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs">รอจัดเก็บ</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {!item.picked && waveDetail.status === "picking" && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-[#fb9678] hover:bg-[#e8866a] text-white"
                                    onClick={() => pickItemMutation.mutate({ waveId: waveDetail.id, itemId: item.id })}
                                    disabled={pickItemMutation.isPending}
                                    data-testid={`button-pick-item-${item.id}`}
                                  >
                                    {pickItemMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Pick
                                  </Button>
                                )}
                                {item.picked && <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
