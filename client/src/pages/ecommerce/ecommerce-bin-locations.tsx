import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Warehouse, Plus, Pencil, Trash2, Loader2, MapPin, Layers, Package, Grid3X3, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

const ZONE_TYPES = [
  { value: "storage", label: "จัดเก็บ" },
  { value: "receiving", label: "รับสินค้า" },
  { value: "shipping", label: "จัดส่ง" },
  { value: "returns", label: "สินค้าคืน" },
  { value: "staging", label: "พักสินค้า" },
];

const BIN_TYPES = [
  { value: "storage", label: "จัดเก็บ" },
  { value: "picking", label: "หยิบสินค้า" },
  { value: "packing", label: "แพ็คสินค้า" },
  { value: "staging", label: "พักสินค้า" },
];

const ZONE_COLORS = ["#fb9678", "#03c9d7", "#4caf50", "#ff9800", "#9c27b0", "#2196f3", "#e91e63", "#607d8b"];

export default function EcommerceBinLocations() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("zones");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");

  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editZoneId, setEditZoneId] = useState<number | null>(null);
  const [zoneForm, setZoneForm] = useState({ code: "", name: "", zoneType: "storage", warehouseId: "", description: "" });

  const [showBinForm, setShowBinForm] = useState(false);
  const [editBinId, setEditBinId] = useState<number | null>(null);
  const [binForm, setBinForm] = useState({ code: "", zoneId: "", aisle: "", shelf: "", level: "", position: "", maxCapacity: "100", binType: "storage" });

  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkForm, setBulkForm] = useState({ zoneId: "", aisleFrom: "A", aisleTo: "D", shelfFrom: "1", shelfTo: "5", levelFrom: "1", levelTo: "3" });

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [editAssignId, setEditAssignId] = useState<number | null>(null);
  const [assignForm, setAssignForm] = useState({ productId: "", binId: "", quantity: "0", minQty: "0", maxQty: "0", isPrimary: false });

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouses", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/warehouses?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouse/zones", selectedCompanyId, selectedWarehouseId],
    queryFn: async () => {
      let url = `/api/ecommerce/warehouse/zones?companyId=${selectedCompanyId}`;
      if (selectedWarehouseId) url += `&warehouseId=${selectedWarehouseId}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: bins = [], isLoading: binsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouse/bins", selectedCompanyId, selectedZoneFilter],
    queryFn: async () => {
      let url = `/api/ecommerce/warehouse/bins?companyId=${selectedCompanyId}`;
      if (selectedZoneFilter && selectedZoneFilter !== "all") url += `&zoneId=${selectedZoneFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouse/bin-assignments", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/warehouse/bin-assignments?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/products", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/products?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: binMap = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouse/bin-map", selectedCompanyId, selectedWarehouseId],
    queryFn: async () => {
      let url = `/api/ecommerce/warehouse/bin-map?companyId=${selectedCompanyId}`;
      if (selectedWarehouseId) url += `&warehouseId=${selectedWarehouseId}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && activeTab === "map",
  });

  const saveZoneMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editZoneId ? `/api/ecommerce/warehouse/zones/${editZoneId}` : "/api/ecommerce/warehouse/zones";
      const method = editZoneId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editZoneId ? "แก้ไขโซนสำเร็จ" : "เพิ่มโซนสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/zones"] });
      setShowZoneForm(false);
      resetZoneForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/warehouse/zones/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบโซนสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/zones"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const toggleZoneMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`/api/ecommerce/warehouse/zones/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ isActive, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/zones"] }),
  });

  const saveBinMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editBinId ? `/api/ecommerce/warehouse/bins/${editBinId}` : "/api/ecommerce/warehouse/bins";
      const method = editBinId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editBinId ? "แก้ไขตำแหน่งสำเร็จ" : "เพิ่มตำแหน่งสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/bins"] });
      setShowBinForm(false);
      resetBinForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteBinMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/warehouse/bins/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบตำแหน่งสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/bins"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ecommerce/warehouse/bins/bulk-generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "สร้างตำแหน่งอัตโนมัติสำเร็จ", description: `สร้างแล้ว ${data.count || 0} ตำแหน่ง` });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/bins"] });
      setShowBulkForm(false);
      resetBulkForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const saveAssignMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editAssignId ? `/api/ecommerce/warehouse/bin-assignments/${editAssignId}` : "/api/ecommerce/warehouse/bin-assignments";
      const method = editAssignId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editAssignId ? "แก้ไขการกำหนดสำเร็จ" : "กำหนดสินค้าสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/bin-assignments"] });
      setShowAssignForm(false);
      resetAssignForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteAssignMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/warehouse/bin-assignments/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบการกำหนดสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/warehouse/bin-assignments"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const resetZoneForm = () => { setZoneForm({ code: "", name: "", zoneType: "storage", warehouseId: "", description: "" }); setEditZoneId(null); };
  const resetBinForm = () => { setBinForm({ code: "", zoneId: "", aisle: "", shelf: "", level: "", position: "", maxCapacity: "100", binType: "storage" }); setEditBinId(null); };
  const resetBulkForm = () => { setBulkForm({ zoneId: "", aisleFrom: "A", aisleTo: "D", shelfFrom: "1", shelfTo: "5", levelFrom: "1", levelTo: "3" }); };
  const resetAssignForm = () => { setAssignForm({ productId: "", binId: "", quantity: "0", minQty: "0", maxQty: "0", isPrimary: false }); setEditAssignId(null); };

  const openEditZone = (z: any) => {
    setEditZoneId(z.id);
    setZoneForm({ code: z.code || "", name: z.name || "", zoneType: z.zoneType || "storage", warehouseId: String(z.warehouseId || ""), description: z.description || "" });
    setShowZoneForm(true);
  };

  const openEditBin = (b: any) => {
    setEditBinId(b.id);
    setBinForm({ code: b.code || "", zoneId: String(b.zoneId || ""), aisle: b.aisle || "", shelf: b.shelf || "", level: b.level || "", position: b.position || "", maxCapacity: String(b.maxCapacity || 100), binType: b.binType || "storage" });
    setShowBinForm(true);
  };

  const openEditAssign = (a: any) => {
    setEditAssignId(a.id);
    setAssignForm({ productId: String(a.productId || ""), binId: String(a.binId || ""), quantity: String(a.quantity || 0), minQty: String(a.minQty || 0), maxQty: String(a.maxQty || 0), isPrimary: !!a.isPrimary });
    setShowAssignForm(true);
  };

  const getZoneTypeName = (type: string) => ZONE_TYPES.find(t => t.value === type)?.label || type;
  const getBinTypeName = (type: string) => BIN_TYPES.find(t => t.value === type)?.label || type;
  const getCapacityPercent = (current: number, max: number) => max > 0 ? Math.min(Math.round((current / max) * 100), 100) : 0;
  const getCapacityColor = (percent: number) => percent >= 90 ? "bg-red-500" : percent >= 50 ? "bg-yellow-500" : "bg-green-500";
  const getBinStatusColor = (bin: any) => {
    if (!bin.isActive) return "bg-gray-400";
    const pct = getCapacityPercent(bin.currentQty || 0, bin.maxCapacity || 100);
    if (pct >= 90) return "bg-red-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const previewBulkCount = () => {
    const af = bulkForm.aisleFrom.charCodeAt(0);
    const at = bulkForm.aisleTo.charCodeAt(0);
    const sf = parseInt(bulkForm.shelfFrom) || 1;
    const st = parseInt(bulkForm.shelfTo) || 1;
    const lf = parseInt(bulkForm.levelFrom) || 1;
    const lt = parseInt(bulkForm.levelTo) || 1;
    return Math.max(0, (at - af + 1)) * Math.max(0, (st - sf + 1)) * Math.max(0, (lt - lf + 1));
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-bin-locations">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">จัดการตำแหน่งจัดเก็บ (Bin Location)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">กำหนดโซน ตำแหน่งจัดเก็บ และจัดสรรสินค้าลงตำแหน่งในคลังสินค้า</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-warehouse-filter">
                <SelectValue placeholder="เลือกคลังสินค้า" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกคลัง</SelectItem>
                {warehouses.map((wh: any) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl" data-testid="tabs-list">
            <TabsTrigger value="zones" className="text-xs sm:text-sm" data-testid="tab-zones">
              <Layers className="h-3.5 w-3.5 mr-1 hidden sm:inline" />โซน
            </TabsTrigger>
            <TabsTrigger value="bins" className="text-xs sm:text-sm" data-testid="tab-bins">
              <Grid3X3 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />ตำแหน่งจัดเก็บ
            </TabsTrigger>
            <TabsTrigger value="assignments" className="text-xs sm:text-sm" data-testid="tab-assignments">
              <Package className="h-3.5 w-3.5 mr-1 hidden sm:inline" />กำหนดสินค้า
            </TabsTrigger>
            <TabsTrigger value="map" className="text-xs sm:text-sm" data-testid="tab-map">
              <MapPin className="h-3.5 w-3.5 mr-1 hidden sm:inline" />แผนผังคลัง
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="mt-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#03c9d7]" />
                  โซนในคลัง ({zones.length})
                </CardTitle>
                <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1 h-8 text-xs" onClick={() => { resetZoneForm(); setShowZoneForm(true); }} data-testid="button-add-zone">
                  <Plus className="h-3.5 w-3.5" />เพิ่มโซน
                </Button>
              </CardHeader>
              <CardContent>
                {zonesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : zones.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีโซนในคลังสินค้า</p>
                    <p className="text-xs mt-1">กดปุ่ม "เพิ่มโซน" เพื่อเริ่มกำหนดโซน</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">รหัส</TableHead>
                          <TableHead className="text-xs">ชื่อโซน</TableHead>
                          <TableHead className="text-xs">ประเภท</TableHead>
                          <TableHead className="text-xs">คลัง</TableHead>
                          <TableHead className="text-xs text-center">สถานะ</TableHead>
                          <TableHead className="text-xs text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zones.map((zone: any) => (
                          <TableRow key={zone.id} data-testid={`row-zone-${zone.id}`}>
                            <TableCell className="text-sm font-mono font-medium">{zone.code}</TableCell>
                            <TableCell className="text-sm">{zone.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{getZoneTypeName(zone.zoneType)}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{zone.warehouseName || "-"}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch checked={zone.isActive} onCheckedChange={(v) => toggleZoneMutation.mutate({ id: zone.id, isActive: v })} data-testid={`switch-zone-${zone.id}`} />
                                {zone.isActive ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">ใช้งาน</Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">ปิด</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditZone(zone)} data-testid={`button-edit-zone-${zone.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบโซนนี้?")) deleteZoneMutation.mutate(zone.id); }} data-testid={`button-delete-zone-${zone.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bins" className="mt-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-[#03c9d7]" />
                  ตำแหน่งจัดเก็บ ({bins.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}>
                    <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-zone-filter">
                      <SelectValue placeholder="กรองตามโซน" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกโซน</SelectItem>
                      {zones.map((z: any) => (
                        <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="gap-1 h-8 text-xs border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/10" onClick={() => { resetBulkForm(); setShowBulkForm(true); }} data-testid="button-bulk-generate">
                    <Zap className="h-3.5 w-3.5" />สร้างตำแหน่งอัตโนมัติ
                  </Button>
                  <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1 h-8 text-xs" onClick={() => { resetBinForm(); setShowBinForm(true); }} data-testid="button-add-bin">
                    <Plus className="h-3.5 w-3.5" />เพิ่มตำแหน่ง
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {binsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : bins.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีตำแหน่งจัดเก็บ</p>
                    <p className="text-xs mt-1">เพิ่มทีละตำแหน่ง หรือใช้ "สร้างตำแหน่งอัตโนมัติ"</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">รหัส</TableHead>
                          <TableHead className="text-xs">โซน</TableHead>
                          <TableHead className="text-xs">ทางเดิน</TableHead>
                          <TableHead className="text-xs">ชั้น</TableHead>
                          <TableHead className="text-xs">ระดับ</TableHead>
                          <TableHead className="text-xs">ความจุ</TableHead>
                          <TableHead className="text-xs">ปริมาณปัจจุบัน</TableHead>
                          <TableHead className="text-xs text-center">สถานะ</TableHead>
                          <TableHead className="text-xs text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bins.map((bin: any) => {
                          const pct = getCapacityPercent(bin.currentQty || 0, bin.maxCapacity || 100);
                          return (
                            <TableRow key={bin.id} data-testid={`row-bin-${bin.id}`}>
                              <TableCell className="text-sm font-mono font-medium">{bin.code}</TableCell>
                              <TableCell className="text-sm">{bin.zoneName || "-"}</TableCell>
                              <TableCell className="text-sm">{bin.aisle || "-"}</TableCell>
                              <TableCell className="text-sm">{bin.shelf || "-"}</TableCell>
                              <TableCell className="text-sm">{bin.level || "-"}</TableCell>
                              <TableCell className="text-sm">{bin.maxCapacity || 0}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{bin.currentQty || 0}/{bin.maxCapacity || 0}</span>
                                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${getCapacityColor(pct)}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {bin.isActive ? (
                                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">ว่าง</Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">ปิด</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditBin(bin)} data-testid={`button-edit-bin-${bin.id}`}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบตำแหน่งนี้?")) deleteBinMutation.mutate(bin.id); }} data-testid={`button-delete-bin-${bin.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
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
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#03c9d7]" />
                  กำหนดสินค้าลงตำแหน่ง ({assignments.length})
                </CardTitle>
                <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1 h-8 text-xs" onClick={() => { resetAssignForm(); setShowAssignForm(true); }} data-testid="button-add-assignment">
                  <Plus className="h-3.5 w-3.5" />กำหนดสินค้า
                </Button>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีการกำหนดสินค้าลงตำแหน่ง</p>
                    <p className="text-xs mt-1">กดปุ่ม "กำหนดสินค้า" เพื่อเริ่มจัดสรรสินค้า</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">ชื่อสินค้า</TableHead>
                          <TableHead className="text-xs">ตำแหน่ง</TableHead>
                          <TableHead className="text-xs text-right">จำนวน</TableHead>
                          <TableHead className="text-xs text-right">ต่ำสุด</TableHead>
                          <TableHead className="text-xs text-right">สูงสุด</TableHead>
                          <TableHead className="text-xs text-center">หลัก</TableHead>
                          <TableHead className="text-xs text-center">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((a: any) => (
                          <TableRow key={a.id} data-testid={`row-assignment-${a.id}`}>
                            <TableCell className="text-sm font-mono">{a.sku || "-"}</TableCell>
                            <TableCell className="text-sm">{a.productName || "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{a.binCode || "-"}</TableCell>
                            <TableCell className="text-sm text-right">{a.quantity || 0}</TableCell>
                            <TableCell className="text-sm text-right">{a.minQty || 0}</TableCell>
                            <TableCell className="text-sm text-right">{a.maxQty || 0}</TableCell>
                            <TableCell className="text-center">
                              {a.isPrimary ? (
                                <Badge className="bg-[#fb9678]/15 text-[#fb9678] hover:bg-[#fb9678]/15 text-xs">หลัก</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditAssign(a)} data-testid={`button-edit-assignment-${a.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบการกำหนดนี้?")) deleteAssignMutation.mutate(a.id); }} data-testid={`button-delete-assignment-${a.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#03c9d7]" />
                  แผนผังคลังสินค้า
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /><span>ว่าง</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500" /><span>มีสินค้าบางส่วน</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /><span>เต็ม</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-400" /><span>ปิดใช้งาน</span></div>
                </div>
                {Array.isArray(binMap) && binMap.length > 0 ? (
                  <TooltipProvider>
                    <div className="space-y-6">
                      {binMap.map((zone: any, zi: number) => (
                        <div key={zone.zoneId || zi} data-testid={`map-zone-${zone.zoneId || zi}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded" style={{ background: ZONE_COLORS[zi % ZONE_COLORS.length] }} />
                            <span className="text-sm font-medium">{zone.zoneName || `โซน ${zi + 1}`}</span>
                            <Badge variant="outline" className="text-xs">{zone.bins?.length || 0} ตำแหน่ง</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-lg border">
                            {(zone.bins || []).map((bin: any) => {
                              const pct = getCapacityPercent(bin.currentQty || 0, bin.maxCapacity || 100);
                              const colorClass = !bin.isActive ? "bg-gray-400" : pct >= 90 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-green-500";
                              return (
                                <Tooltip key={bin.id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`w-10 h-10 rounded flex items-center justify-center text-white text-[9px] font-mono cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
                                      data-testid={`map-bin-${bin.id}`}
                                    >
                                      {bin.code?.slice(-4) || "?"}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    <p className="font-medium">{bin.code}</p>
                                    <p>สินค้า: {bin.productName || "-"}</p>
                                    <p>จำนวน: {bin.currentQty || 0}/{bin.maxCapacity || 0}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {(!zone.bins || zone.bins.length === 0) && (
                              <p className="text-xs text-muted-foreground py-4 w-full text-center">ไม่มีตำแหน่งในโซนนี้</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TooltipProvider>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีข้อมูลแผนผัง</p>
                    <p className="text-xs mt-1">เพิ่มโซนและตำแหน่งจัดเก็บก่อน เพื่อดูแผนผังคลังสินค้า</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showZoneForm} onOpenChange={setShowZoneForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editZoneId ? "แก้ไขโซน" : "เพิ่มโซนใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">รหัสโซน *</label>
                <Input value={zoneForm.code} onChange={e => setZoneForm(f => ({ ...f, code: e.target.value }))} placeholder="เช่น Z-A, ZONE-01" className="mt-1" data-testid="input-zone-code" />
              </div>
              <div>
                <label className="text-sm font-medium">ชื่อโซน *</label>
                <Input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น โซนจัดเก็บหลัก" className="mt-1" data-testid="input-zone-name" />
              </div>
              <div>
                <label className="text-sm font-medium">ประเภทโซน *</label>
                <Select value={zoneForm.zoneType} onValueChange={v => setZoneForm(f => ({ ...f, zoneType: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-zone-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">คลังสินค้า</label>
                <Select value={zoneForm.warehouseId} onValueChange={v => setZoneForm(f => ({ ...f, warehouseId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-zone-warehouse">
                    <SelectValue placeholder="เลือกคลังสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh: any) => (
                      <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">คำอธิบาย</label>
                <Input value={zoneForm.description} onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดเพิ่มเติม" className="mt-1" data-testid="input-zone-description" />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!zoneForm.code || !zoneForm.name || saveZoneMutation.isPending}
                onClick={() => saveZoneMutation.mutate(zoneForm)}
                data-testid="button-save-zone"
              >
                {saveZoneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editZoneId ? "บันทึกการแก้ไข" : "เพิ่มโซน"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showBinForm} onOpenChange={setShowBinForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editBinId ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่งใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">รหัสตำแหน่ง *</label>
                <Input value={binForm.code} onChange={e => setBinForm(f => ({ ...f, code: e.target.value }))} placeholder="เช่น A-01-01" className="mt-1" data-testid="input-bin-code" />
              </div>
              <div>
                <label className="text-sm font-medium">โซน *</label>
                <Select value={binForm.zoneId} onValueChange={v => setBinForm(f => ({ ...f, zoneId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-bin-zone">
                    <SelectValue placeholder="เลือกโซน" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => (
                      <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ทางเดิน</label>
                  <Input value={binForm.aisle} onChange={e => setBinForm(f => ({ ...f, aisle: e.target.value }))} placeholder="A" className="mt-1" data-testid="input-bin-aisle" />
                </div>
                <div>
                  <label className="text-sm font-medium">ชั้น</label>
                  <Input value={binForm.shelf} onChange={e => setBinForm(f => ({ ...f, shelf: e.target.value }))} placeholder="01" className="mt-1" data-testid="input-bin-shelf" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ระดับ</label>
                  <Input value={binForm.level} onChange={e => setBinForm(f => ({ ...f, level: e.target.value }))} placeholder="01" className="mt-1" data-testid="input-bin-level" />
                </div>
                <div>
                  <label className="text-sm font-medium">ตำแหน่ง</label>
                  <Input value={binForm.position} onChange={e => setBinForm(f => ({ ...f, position: e.target.value }))} placeholder="01" className="mt-1" data-testid="input-bin-position" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">ความจุสูงสุด</label>
                <Input type="number" value={binForm.maxCapacity} onChange={e => setBinForm(f => ({ ...f, maxCapacity: e.target.value }))} className="mt-1" data-testid="input-bin-capacity" />
              </div>
              <div>
                <label className="text-sm font-medium">ประเภทตำแหน่ง</label>
                <Select value={binForm.binType} onValueChange={v => setBinForm(f => ({ ...f, binType: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-bin-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BIN_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!binForm.code || !binForm.zoneId || saveBinMutation.isPending}
                onClick={() => saveBinMutation.mutate(binForm)}
                data-testid="button-save-bin"
              >
                {saveBinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editBinId ? "บันทึกการแก้ไข" : "เพิ่มตำแหน่ง"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showBulkForm} onOpenChange={setShowBulkForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>สร้างตำแหน่งอัตโนมัติ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">โซน *</label>
                <Select value={bulkForm.zoneId} onValueChange={v => setBulkForm(f => ({ ...f, zoneId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-bulk-zone">
                    <SelectValue placeholder="เลือกโซน" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z: any) => (
                      <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ทางเดินเริ่มต้น</label>
                  <Input value={bulkForm.aisleFrom} onChange={e => setBulkForm(f => ({ ...f, aisleFrom: e.target.value.toUpperCase() }))} placeholder="A" className="mt-1" maxLength={1} data-testid="input-bulk-aisle-from" />
                </div>
                <div>
                  <label className="text-sm font-medium">ทางเดินสิ้นสุด</label>
                  <Input value={bulkForm.aisleTo} onChange={e => setBulkForm(f => ({ ...f, aisleTo: e.target.value.toUpperCase() }))} placeholder="D" className="mt-1" maxLength={1} data-testid="input-bulk-aisle-to" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ชั้นเริ่มต้น</label>
                  <Input type="number" value={bulkForm.shelfFrom} onChange={e => setBulkForm(f => ({ ...f, shelfFrom: e.target.value }))} className="mt-1" data-testid="input-bulk-shelf-from" />
                </div>
                <div>
                  <label className="text-sm font-medium">ชั้นสิ้นสุด</label>
                  <Input type="number" value={bulkForm.shelfTo} onChange={e => setBulkForm(f => ({ ...f, shelfTo: e.target.value }))} className="mt-1" data-testid="input-bulk-shelf-to" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ระดับเริ่มต้น</label>
                  <Input type="number" value={bulkForm.levelFrom} onChange={e => setBulkForm(f => ({ ...f, levelFrom: e.target.value }))} className="mt-1" data-testid="input-bulk-level-from" />
                </div>
                <div>
                  <label className="text-sm font-medium">ระดับสิ้นสุด</label>
                  <Input type="number" value={bulkForm.levelTo} onChange={e => setBulkForm(f => ({ ...f, levelTo: e.target.value }))} className="mt-1" data-testid="input-bulk-level-to" />
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  จะสร้างตำแหน่งทั้งหมด <strong>{previewBulkCount()}</strong> ตำแหน่ง
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ตัวอย่าง: {bulkForm.aisleFrom}-{String(parseInt(bulkForm.shelfFrom) || 1).padStart(2, "0")}-{String(parseInt(bulkForm.levelFrom) || 1).padStart(2, "0")}
                </p>
              </div>
              <Button
                className="w-full bg-[#fb9678] hover:bg-[#e88568] text-white"
                disabled={!bulkForm.zoneId || bulkGenerateMutation.isPending}
                onClick={() => bulkGenerateMutation.mutate(bulkForm)}
                data-testid="button-generate-bins"
              >
                {bulkGenerateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                สร้างตำแหน่งอัตโนมัติ ({previewBulkCount()} ตำแหน่ง)
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editAssignId ? "แก้ไขการกำหนดสินค้า" : "กำหนดสินค้าลงตำแหน่ง"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">สินค้า *</label>
                <Select value={assignForm.productId} onValueChange={v => setAssignForm(f => ({ ...f, productId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-assign-product">
                    <SelectValue placeholder="เลือกสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.sku ? `[${p.sku}] ` : ""}{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ตำแหน่งจัดเก็บ *</label>
                <Select value={assignForm.binId} onValueChange={v => setAssignForm(f => ({ ...f, binId: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-assign-bin">
                    <SelectValue placeholder="เลือกตำแหน่ง" />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.code} ({b.zoneName || "ไม่ระบุโซน"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">จำนวน</label>
                  <Input type="number" value={assignForm.quantity} onChange={e => setAssignForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1" data-testid="input-assign-qty" />
                </div>
                <div>
                  <label className="text-sm font-medium">ต่ำสุด</label>
                  <Input type="number" value={assignForm.minQty} onChange={e => setAssignForm(f => ({ ...f, minQty: e.target.value }))} className="mt-1" data-testid="input-assign-min" />
                </div>
                <div>
                  <label className="text-sm font-medium">สูงสุด</label>
                  <Input type="number" value={assignForm.maxQty} onChange={e => setAssignForm(f => ({ ...f, maxQty: e.target.value }))} className="mt-1" data-testid="input-assign-max" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={assignForm.isPrimary}
                  onCheckedChange={(v) => setAssignForm(f => ({ ...f, isPrimary: !!v }))}
                  data-testid="checkbox-assign-primary"
                />
                <label className="text-sm">ตำแหน่งหลัก (Primary Location)</label>
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!assignForm.productId || !assignForm.binId || saveAssignMutation.isPending}
                onClick={() => saveAssignMutation.mutate(assignForm)}
                data-testid="button-save-assignment"
              >
                {saveAssignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editAssignId ? "บันทึกการแก้ไข" : "กำหนดสินค้า"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
