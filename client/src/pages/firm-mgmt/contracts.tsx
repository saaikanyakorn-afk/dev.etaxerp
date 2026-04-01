import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Send, Copy, Eye, Trash2, ExternalLink, CheckCircle2, Clock, PenTool, RotateCcw, Upload, X } from "lucide-react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useLocation } from "wouter";
import { getShareBaseUrl } from "@/lib/queryClient";
import { useRef, useCallback } from "react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "ร่าง", color: "bg-gray-100 text-gray-700" },
  sent: { label: "ส่งให้ลูกค้าแล้ว", color: "bg-[#fec90f]/20 text-[#b8920b]" },
  signed: { label: "ลงนามแล้ว", color: "bg-[#05b187]/20 text-[#05b187]" },
  void: { label: "ยกเลิก", color: "bg-[#f94d4d]/20 text-[#f94d4d]" },
};

function formatBEDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function FirmSignaturePad({ onSave, initialDataUrl }: { onSave: (dataUrl: string) => void; initialDataUrl?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<"draw" | "upload">(initialDataUrl ? "upload" : "draw");
  const [uploadedUrl, setUploadedUrl] = useState<string>(initialDataUrl || "");
  const fileRef = useRef<HTMLInputElement>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => { setIsDrawing(false); }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedUrl(result);
      onSave(result);
    };
    reader.readAsDataURL(file);
  };

  const removeUpload = () => {
    setUploadedUrl("");
    onSave("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" variant={mode === "draw" ? "default" : "outline"} size="sm" onClick={() => { setMode("draw"); setTimeout(initCanvas, 100); }} className={mode === "draw" ? "bg-[#fb9678] hover:bg-[#e8876a] text-white" : ""}>
          <PenTool className="w-3.5 h-3.5 mr-1" /> วาดลายเซ็น
        </Button>
        <Button type="button" variant={mode === "upload" ? "default" : "outline"} size="sm" onClick={() => setMode("upload")} className={mode === "upload" ? "bg-[#fb9678] hover:bg-[#e8876a] text-white" : ""}>
          <Upload className="w-3.5 h-3.5 mr-1" /> อัปโหลดรูป
        </Button>
      </div>

      {mode === "draw" && (
        <>
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white" style={{ touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: 150 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
              data-testid="canvas-firm-signature"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-xs">เซ็นชื่อที่นี่</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearCanvas} className="gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> ล้าง
            </Button>
            <Button type="button" size="sm" onClick={saveDrawing} disabled={!hasDrawn} className="bg-[#05b187] hover:bg-[#049a75] text-white gap-1 ml-auto">
              <CheckCircle2 className="w-3.5 h-3.5" /> ใช้ลายเซ็นนี้
            </Button>
          </div>
        </>
      )}

      {mode === "upload" && (
        <div className="space-y-2">
          {uploadedUrl ? (
            <div className="relative border rounded-lg p-3 bg-gray-50 flex items-center gap-3">
              <img src={uploadedUrl} alt="ลายเซ็นผู้รับจ้าง" className="h-16 border rounded" />
              <span className="text-sm text-[#05b187] flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> อัปโหลดแล้ว</span>
              <Button type="button" variant="ghost" size="sm" onClick={removeUpload} className="ml-auto h-8 w-8 p-0">
                <X className="w-4 h-4 text-[#f94d4d]" />
              </Button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#fb9678] transition-colors">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">คลิกเพื่ออัปโหลดรูปลายเซ็น</span>
              <span className="text-xs text-gray-400">PNG, JPG (พื้นหลังขาว)</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} data-testid="input-firm-sig-upload" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  firmClientId: "",
  title: "สัญญาจ้างทำบัญชี",
  firmName: "",
  firmAddress: "",
  firmTaxId: "",
  firmRepName: "",
  clientName: "",
  clientAddress: "",
  clientTaxId: "",
  clientRepName: "",
  serviceScope: "จัดทำบัญชี ยื่นภาษี และจัดทำงบการเงิน",
  serviceFee: "0",
  contractStartDate: "",
  contractEndDate: "",
  paymentTerms: "ชำระเป็นรายเดือน ภายในวันที่ 5 ของเดือนถัดไป",
  additionalTerms: "",
  firmSignatureDataUrl: "",
};

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const [, navigate] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterClient, setFilterClient] = useState("all");

  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/companies/primary"],
    queryFn: async () => {
      const r = await fetch("/api/companies/primary", { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
  });
  const primaryCompanyId = companyData?.id;

  const { data: contractsData } = useQuery<any[]>({
    queryKey: ["/api/contracts", primaryCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/contracts?companyId=${primaryCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!primaryCompanyId,
  });
  const contractsList = Array.isArray(contractsData) ? contractsData : [];

  const { data: clientsData } = useQuery<any[]>({
    queryKey: ["/api/firm-clients"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const clients = Array.isArray(clientsData) ? clientsData : [];
  const { data: generalSettingsData } = useQuery<any>({
    queryKey: ["/api/settings/general", primaryCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/settings/general?companyId=${primaryCompanyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!primaryCompanyId,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlClientId = params.get("clientId");
    if (urlClientId && clients.length > 0 && companyData && !showForm) {
      const client = clients.find((c: any) => String(c.id) === urlClientId);
      if (client) {
        setForm({
          ...emptyForm,
          firmClientId: urlClientId,
          firmName: companyData?.name || "",
          firmAddress: companyData?.address || "",
          firmTaxId: companyData?.taxId || "",
          firmRepName: generalSettingsData?.authorizedSignerName || companyData?.ownerName || "",
          clientName: client.name || "",
          clientAddress: client.address || "",
          clientTaxId: client.taxId || "",
          clientRepName: client.ownerName || client.contactPerson || "",
          firmSignatureDataUrl: generalSettingsData?.authorizedSignerSignatureUrl || "",
        });
        setShowForm(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [clients, companyData, generalSettingsData]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "สร้างสัญญาไม่สำเร็จ" }));
        throw new Error(err.message || "สร้างสัญญาไม่สำเร็จ");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setShowForm(false);
      setForm({ ...emptyForm });
      toast({ title: "สร้างสัญญาเรียบร้อย" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/contracts/${id}/send`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("ส่งสัญญาไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "เปลี่ยนสถานะเป็น 'ส่งให้ลูกค้าแล้ว'" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("ลบสัญญาไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "ลบสัญญาเรียบร้อย" });
    },
  });

  const updateFirmSigMutation = useMutation({
    mutationFn: async ({ id, firmSignatureDataUrl }: { id: number; firmSignatureDataUrl: string | null }) => {
      const r = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ firmSignatureDataUrl }),
      });
      if (!r.ok) throw new Error("บันทึกลายเซ็นไม่สำเร็จ");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "บันทึกลายเซ็นผู้รับจ้างเรียบร้อย" });
    },
  });

  const handleCreateNew = () => {
    const company = companyData;
    setForm({
      ...emptyForm,
      firmName: company?.name || "",
      firmAddress: company?.address || "",
      firmTaxId: company?.taxId || "",
      firmRepName: generalSettingsData?.authorizedSignerName || company?.ownerName || "",
      firmSignatureDataUrl: generalSettingsData?.authorizedSignerSignatureUrl || "",
    });
    setShowForm(true);
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find((c: any) => String(c.id) === clientId);
    if (client) {
      setForm((f) => ({
        ...f,
        firmClientId: clientId,
        clientName: client.name || "",
        clientAddress: client.address || "",
        clientTaxId: client.taxId || "",
        clientRepName: client.ownerName || client.contactPerson || "",
        serviceFee: client.serviceFee && Number(client.serviceFee) > 0 ? client.serviceFee : f.serviceFee,
      }));
    } else {
      setForm((f) => ({ ...f, firmClientId: clientId }));
    }
  };

  const handleSubmit = () => {
    if (!form.firmClientId) {
      toast({ title: "กรุณาเลือกลูกค้า", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      companyId: primaryCompanyId,
      firmClientId: Number(form.firmClientId),
      title: form.title,
      firmName: form.firmName,
      firmAddress: form.firmAddress,
      firmTaxId: form.firmTaxId,
      firmRepName: form.firmRepName,
      clientName: form.clientName,
      clientAddress: form.clientAddress,
      clientTaxId: form.clientTaxId,
      clientRepName: form.clientRepName,
      serviceScope: form.serviceScope,
      serviceFee: form.serviceFee,
      contractStartDate: form.contractStartDate || null,
      contractEndDate: form.contractEndDate || null,
      paymentTerms: form.paymentTerms,
      additionalTerms: form.additionalTerms,
      firmSignatureDataUrl: form.firmSignatureDataUrl || null,
    });
  };

  const copySigningLink = async (token: string) => {
    const baseUrl = await getShareBaseUrl();
    const url = `${baseUrl}/sign/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "คัดลอกลิงก์แล้ว", description: "ส่งลิงก์นี้ให้ลูกค้าเพื่อลงนามสัญญา" });
  };

  const previewContract = contractsList.find((c: any) => c.id === previewId);
  const filtered = filterClient === "all" ? contractsList : contractsList.filter((c: any) => String(c.firmClientId) === filterClient);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">สัญญาจ้างทำบัญชี</h1>
            <p className="text-sm text-gray-500">สร้างสัญญา ส่งให้ลูกค้าเซ็นออนไลน์</p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="bg-[#fb9678] hover:bg-[#e8876a] text-white gap-2"
            data-testid="button-new-contract"
          >
            <Plus className="w-4 h-4" /> สร้างสัญญาใหม่
          </Button>
        </div>

        <Card className="rounded-xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#fb9678]" /> รายการสัญญาทั้งหมด ({filtered.length})
              </CardTitle>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[200px]" data-testid="select-filter-client">
                  <SelectValue placeholder="กรองตามลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">เลขที่สัญญา</TableHead>
                  <TableHead className="text-sm">ลูกค้า</TableHead>
                  <TableHead className="text-sm">ชื่อสัญญา</TableHead>
                  <TableHead className="text-sm">ค่าบริการ</TableHead>
                  <TableHead className="text-sm">สถานะ</TableHead>
                  <TableHead className="text-sm">วันที่ลงนาม</TableHead>
                  <TableHead className="text-sm text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                      ยังไม่มีสัญญา
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c: any) => {
                  const client = clients.find((cl: any) => cl.id === c.firmClientId);
                  const st = STATUS_MAP[c.status] || STATUS_MAP.draft;
                  return (
                    <TableRow key={c.id} data-testid={`row-contract-${c.id}`}>
                      <TableCell className="text-sm font-medium">{c.contractNo}</TableCell>
                      <TableCell className="text-sm">{c.clientName || client?.name || "-"}</TableCell>
                      <TableCell className="text-sm">{c.title}</TableCell>
                      <TableCell className="text-sm">{Number(c.serviceFee || 0).toLocaleString()} ฿</TableCell>
                      <TableCell>
                        <Badge className={`${st.color} text-xs`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatBEDate(c.signedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewId(c.id)}
                            className="h-8 w-8 p-0"
                            title="ดูสัญญา"
                            data-testid={`button-preview-${c.id}`}
                          >
                            <Eye className="w-4 h-4 text-[var(--theme-primary)]" />
                          </Button>
                          {(c.status === "draft" || c.status === "sent") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copySigningLink(c.publicToken)}
                              className="h-8 w-8 p-0"
                              title="คัดลอกลิงก์ลงนาม"
                              data-testid={`button-copy-link-${c.id}`}
                            >
                              <Copy className="w-4 h-4 text-[#03c9d7]" />
                            </Button>
                          )}
                          {c.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendMutation.mutate(c.id)}
                              className="h-8 w-8 p-0"
                              title="ส่งให้ลูกค้า"
                              data-testid={`button-send-${c.id}`}
                            >
                              <Send className="w-4 h-4 text-[#fec90f]" />
                            </Button>
                          )}
                          {c.status === "signed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewId(c.id)}
                              className="h-8 w-8 p-0"
                              title="ดูลายเซ็น"
                              data-testid={`button-view-sig-${c.id}`}
                            >
                              <PenTool className="w-4 h-4 text-[#05b187]" />
                            </Button>
                          )}
                          {c.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { if (confirm("ลบสัญญานี้?")) deleteMutation.mutate(c.id); }}
                              className="h-8 w-8 p-0"
                              title="ลบ"
                              data-testid={`button-delete-${c.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-[#f94d4d]" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Contract Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">สร้างสัญญาจ้างทำบัญชี</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">เลือกลูกค้า *</Label>
                <Select value={form.firmClientId} onValueChange={handleSelectClient}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="เลือกลูกค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700">ข้อมูลผู้รับจ้าง (สำนักงานบัญชี)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">ชื่อสำนักงาน</Label>
                    <div className="text-sm font-medium text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[36px]" data-testid="text-firm-name">
                      {form.firmName || <span className="text-gray-400 italic">ยังไม่มีข้อมูล — กรุณาตั้งค่าข้อมูลบริษัทก่อน</span>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">เลขประจำตัวผู้เสียภาษี</Label>
                    <div className="text-sm font-medium text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[36px] font-mono" data-testid="text-firm-tax-id">
                      {form.firmTaxId || <span className="text-gray-400 italic">—</span>}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">ที่อยู่</Label>
                  <div className="text-sm text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[52px] whitespace-pre-wrap" data-testid="text-firm-address">
                    {form.firmAddress || <span className="text-gray-400 italic">ยังไม่มีข้อมูล</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">ผู้มีอำนาจลงนาม</Label>
                  <Input value={form.firmRepName} onChange={(e) => setForm((f) => ({ ...f, firmRepName: e.target.value }))} data-testid="input-firm-rep" placeholder="ระบุชื่อผู้ลงนาม" />
                </div>
                <div>
                  <Label className="text-xs">ลายเซ็นผู้รับจ้าง</Label>
                  <FirmSignaturePad
                    onSave={(dataUrl) => setForm((f) => ({ ...f, firmSignatureDataUrl: dataUrl }))}
                    initialDataUrl={form.firmSignatureDataUrl}
                  />
                  {form.firmSignatureDataUrl && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#05b187]" />
                      <span className="text-xs text-[#05b187]">บันทึกลายเซ็นผู้รับจ้างแล้ว</span>
                      <img src={form.firmSignatureDataUrl} alt="ลายเซ็นผู้รับจ้าง" className="h-8 ml-auto border rounded" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700">ข้อมูลผู้รับบริการ (ลูกค้า)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">ชื่อกิจการ</Label>
                    <div className="text-sm font-medium text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[36px]" data-testid="text-client-name">
                      {form.clientName || <span className="text-gray-400 italic">เลือกลูกค้าด้านบน</span>}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">เลขประจำตัวผู้เสียภาษี</Label>
                    <div className="text-sm font-medium text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[36px] font-mono" data-testid="text-client-tax-id">
                      {form.clientTaxId || <span className="text-gray-400 italic">—</span>}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">ที่อยู่</Label>
                  <div className="text-sm text-gray-800 bg-white border rounded-md px-3 py-2 min-h-[52px] whitespace-pre-wrap" data-testid="text-client-address">
                    {form.clientAddress || <span className="text-gray-400 italic">—</span>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">ผู้มีอำนาจลงนาม</Label>
                  <Input value={form.clientRepName} onChange={(e) => setForm((f) => ({ ...f, clientRepName: e.target.value }))} data-testid="input-client-rep" />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700">รายละเอียดสัญญา</h3>
                <div>
                  <Label className="text-xs">ขอบเขตการให้บริการ</Label>
                  <Textarea value={form.serviceScope} onChange={(e) => setForm((f) => ({ ...f, serviceScope: e.target.value }))} rows={3} data-testid="input-scope" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">ค่าบริการ (บาท/เดือน)</Label>
                    <Input type="number" value={form.serviceFee} onChange={(e) => setForm((f) => ({ ...f, serviceFee: e.target.value }))} data-testid="input-fee" />
                  </div>
                  <div>
                    <Label className="text-xs">วันเริ่มสัญญา</Label>
                    <ThaiDateInput value={form.contractStartDate} onChange={(v: string) => setForm((f) => ({ ...f, contractStartDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-start-date" />
                  </div>
                  <div>
                    <Label className="text-xs">วันสิ้นสุดสัญญา</Label>
                    <ThaiDateInput value={form.contractEndDate} onChange={(v: string) => setForm((f) => ({ ...f, contractEndDate: v }))} dateEra={dateEra} dateFmt={dateFmt} data-testid="input-end-date" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">เงื่อนไขการชำระเงิน</Label>
                  <Input value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} data-testid="input-payment-terms" />
                </div>
                <div>
                  <Label className="text-xs">เงื่อนไขเพิ่มเติม</Label>
                  <Textarea value={form.additionalTerms} onChange={(e) => setForm((f) => ({ ...f, additionalTerms: e.target.value }))} rows={2} data-testid="input-additional" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel">ยกเลิก</Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-[#fb9678] hover:bg-[#e8876a] text-white gap-2"
                  disabled={createMutation.isPending}
                  data-testid="button-save-contract"
                >
                  <FileText className="w-4 h-4" /> สร้างสัญญา
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Contract Dialog */}
        <Dialog open={!!previewContract} onOpenChange={() => setPreviewId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#fb9678]" />
                {previewContract?.contractNo} - {previewContract?.title}
              </DialogTitle>
            </DialogHeader>
            {previewContract && (
              <div className="space-y-4">
                <div className="border rounded-lg p-6 bg-white" style={{ fontFamily: "'Sarabun', sans-serif" }}>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold">{previewContract.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">เลขที่ {previewContract.contractNo}</p>
                  </div>

                  <div className="space-y-4 text-sm leading-relaxed">
                    <p className="indent-8">
                      สัญญาบริการฉบับนี้ทำขึ้นเมื่อวันที่ {formatBEDate(previewContract.contractStartDate)} ที่สำนักงาน{previewContract.clientName} ระหว่าง{" "}
                      <strong>{previewContract.clientName}</strong>{" "}
                      {previewContract.clientTaxId && <>เลขทะเบียนนิติบุคคลเลขที่ {previewContract.clientTaxId}</>}{" "}
                      สำนักงานตั้งอยู่เลขที่ {previewContract.clientAddress}{" "}
                      โดย<strong>{previewContract.clientRepName}</strong> กรรมการผู้มีอำนาจกระทำการแทนบริษัท ซึ่งต่อไปในสัญญาฉบับนี้เรียกว่า <strong>"ผู้รับบริการ"</strong> ฝ่ายหนึ่ง
                    </p>
                    <p className="indent-8">
                      กับ <strong>{previewContract.firmName}</strong>{" "}
                      {previewContract.firmTaxId && <>เลขทะเบียนนิติบุคคลเลขที่ {previewContract.firmTaxId}</>}{" "}
                      สำนักงานตั้งอยู่เลขที่ {previewContract.firmAddress}{" "}
                      โดย<strong>{previewContract.firmRepName}</strong> กรรมการผู้มีอำนาจกระทำการแทนบริษัท ซึ่งต่อไปในสัญญาฉบับนี้เรียกว่า <strong>"ผู้ให้บริการ"</strong> อีกฝ่ายหนึ่ง
                    </p>

                    <p className="indent-8">โดยที่ ผู้ให้บริการเป็นผู้ให้บริการด้านกิจกรรมการบัญชี การทำบัญชี และที่ปรึกษาด้านภาษี โดยที่ผู้รับบริการได้ตกลงจะรับบริการดังกล่าวจากผู้ให้บริการ และผู้ให้บริการได้ตกลงจะจัดหาบริการดังกล่าวให้แก่ผู้รับบริการ</p>
                    <p className="indent-8">คู่สัญญาทั้งสองฝ่ายจึงตกลงทำสัญญาฉบับนี้ โดยมีข้อความดังต่อไปนี้</p>

                    <div className="space-y-4">
                      <div>
                        <p className="font-bold">ข้อ 1. ขอบเขตการให้บริการ</p>
                        <p className="indent-8">ผู้ให้บริการตกลงจะให้บริการบัญชีและคำแนะนำทางด้านบัญชี โดยมีขอบเขตและรายละเอียดการให้บริการดังต่อไปนี้</p>
                        {previewContract.serviceScope ? (
                          <div className="indent-8 whitespace-pre-wrap">{previewContract.serviceScope}</div>
                        ) : (
                          <ol className="list-decimal pl-16 space-y-1">
                            <li>ให้คำปรึกษาเกี่ยวกับการวางแผนภาษีของผู้รับบริการ</li>
                            <li>บันทึกบัญชีรายเดือน และยื่นภาษีรายเดือน (ภงด.1, ภงด.3, ภงด.53, ภพ.30)</li>
                            <li>จัดทำเงินเดือนพนักงาน และยื่นแบบประกันสังคมพนักงาน (สปส.10-1)</li>
                            <li>ปิดบัญชีประจำปี ยื่นแบบบัญชีรายชื่อผู้ถือหุ้น (บ.อ.จ. 5) แบบ สบช.3 พร้อมนำส่งงบการเงินประจำปีต่อกรมพัฒนาธุรกิจการค้า</li>
                            <li>ยื่นภาษีเงินได้นิติบุคคล ภงด.50, ภงด.51 และ ภงด.1 ก</li>
                            <li>บริหารภาษีและยื่นแบบภาษีบุคคลธรรมดา ภงด.94 และ ภงด.90 (สำหรับผู้บริหาร)</li>
                            <li>จัดทำรายละเอียดประกอบงบการเงินที่สำคัญ เช่น ทะเบียนสินทรัพย์ รายละเอียดลูกหนี้ รายละเอียดเจ้าหนี้ เป็นต้น</li>
                            <li>รายงานงบประมาณที่สำคัญกับผู้บริหาร เพื่อช่วยการบริหารต้นทุน</li>
                            <li>ติดต่อประสานงานกับพนักงานของบริษัท ผู้รวบรวมเอกสารที่เกี่ยวข้องกับการบันทึกบัญชีเพื่อให้การทำงานราบรื่น</li>
                          </ol>
                        )}
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 2. ความรับผิดชอบของผู้บริหาร</p>
                        <p className="indent-8">ผู้บริหารมีหน้าที่ความรับผิดชอบหลักตามกฎหมาย (พ.ร.บ. บัญชี พ.ศ. 2543) ในการจัดให้มีการทำบัญชี จัดทำงบการเงินให้ถูกต้องตามมาตรฐานการรายงานทางการเงิน การควบคุมภายในที่เพียงพอ และการนำส่งงบการเงินภายในเวลาที่กำหนด เพื่อแสดงฐานะการเงินตามจริงและป้องกันข้อผิดพลาดหรือการทุจริต</p>
                        <p className="indent-8 mt-1">ความรับผิดชอบหลักของผู้บริหารต่องานบัญชี:</p>
                        <ul className="list-disc pl-16 space-y-1">
                          <li><strong>จัดทำบัญชีและงบการเงินให้ถูกต้อง:</strong> ผู้บริหารต้องรับผิดชอบให้มีการทำบัญชีตั้งแต่เริ่มประกอบธุรกิจ บันทึกรายการค้าให้ถูกต้อง และจัดทำงบการเงินที่ปราศจากการแสดงข้อมูลที่ขัดต่อข้อเท็จจริงอันเป็นสาระสำคัญ</li>
                          <li><strong>การควบคุมภายใน:</strong> จัดวางระบบการควบคุมภายในที่เหมาะสม เพื่อดูแลให้การดำเนินงานเป็นไปตามมาตรฐานการบัญชีและปกป้องสินทรัพย์ของกิจการ</li>
                          <li><strong>การดำเนินงานต่อเนื่อง:</strong> ประเมินและรับผิดชอบความสามารถในการดำเนินงานต่อเนื่องของกิจการในการจัดทำงบการเงิน</li>
                          <li><strong>การนำส่งงบการเงิน:</strong> จัดทำงบการเงินผ่านการตรวจสอบจากผู้สอบบัญชีรับอนุญาต และนำส่งต่อกรมพัฒนาธุรกิจการค้าภายในเวลาที่กฎหมายกำหนด</li>
                          <li><strong>การเก็บรักษาเอกสาร:</strong> รับผิดชอบจัดเก็บสมุดบัญชีและเอกสารประกอบการลงบัญชีไว้ไม่น้อยกว่า 5 ปี</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 3. ความรับผิดชอบของผู้ทำบัญชี</p>
                        <p className="indent-8">ความรับผิดชอบหลักของผู้ทำบัญชี คือการจัดทำบัญชีให้ถูกต้อง ครบถ้วน ตามมาตรฐานการบัญชีและกฎหมายที่เกี่ยวข้อง (พ.ร.บ. บัญชี 2543) ได้แก่ การลงบันทึกรายการประจำวัน, ทำงบการเงิน, ยื่นภาษีรายเดือน/รายปี, และลงลายมือชื่อรับรองความถูกต้อง พร้อมทั้งรักษาจรรยาบรรณวิชาชีพ และพัฒนาความรู้ต่อเนื่อง (CPD)</p>
                        <p className="indent-8 mt-1">รายละเอียดความรับผิดชอบของผู้ทำบัญชีที่สำคัญ:</p>
                        <ul className="list-disc pl-16 space-y-1">
                          <li>ปฏิบัติหน้าที่ตามกฎหมาย (พ.ร.บ. การบัญชี 2543)</li>
                          <li>จัดทำบัญชีและงบการเงินให้ถูกต้อง เป็นไปตามความเป็นจริงและมาตรฐานการบัญชี</li>
                          <li>บันทึกรายการในสมุดบัญชีเป็นภาษาไทย หรือมีคำแปลภาษาไทยหากบันทึกเป็นภาษาต่างประเทศ</li>
                          <li>ลงลายมือชื่อรับรองความถูกต้องของผู้ทำบัญชีในสมุดบัญชีหรือสื่ออิเล็กทรอนิกส์</li>
                          <li>เก็บรักษาเอกสารประกอบการลงบัญชีให้ครบถ้วนและถูกต้องตามกฎหมาย</li>
                          <li>แจ้งรายละเอียดการทำบัญชีต่อกรมพัฒนาธุรกิจการค้า (e-Accountant) ภายใน 30 วัน นับแต่วันเริ่มทำบัญชีหรือแจ้งรายละเอียดการทำบัญชีก่อนนำส่งงบการเงิน</li>
                        </ul>
                        <p className="indent-8 mt-1">หน้าที่ปฏิบัติงานด้านบัญชี:</p>
                        <ul className="list-disc pl-16 space-y-1">
                          <li>รวบรวมและตรวจสอบเอกสารการค้าทั้งหมด</li>
                          <li>บันทึกบัญชีสมุดรายวันทั้ง 5 เล่ม (สมุดรายวันซื้อ, ขาย, จ่าย, รับ, ทั่วไป)</li>
                          <li>จัดทำงบแยกประเภท, งบทดลอง และงบการเงิน</li>
                          <li>ตรวจสอบและคำนวณภาษีมูลค่าเพิ่ม (VAT), ภาษีหัก ณ ที่จ่าย (ภ.ง.ด. 1, 3, 53) และภาษีเงินได้นิติบุคคล</li>
                          <li>ประสานงานกับผู้สอบบัญชี</li>
                        </ul>
                        <p className="indent-8 mt-1">หน้าที่ตามจรรยาบรรณวิชาชีพบัญชี:</p>
                        <ul className="list-disc pl-16 space-y-1">
                          <li><strong>ความซื่อสัตย์สุจริต (Integrity):</strong> ปฏิบัติงานด้วยความโปร่งใส ไม่ปลอมแปลงบัญชี</li>
                          <li><strong>ความเที่ยงธรรม (Objectivity):</strong> มีความเป็นอิสระ ไม่ลำเอียง</li>
                          <li><strong>ความรู้ความสามารถ:</strong> พัฒนาความรู้ต่อเนื่อง (CPD) ไม่น้อยกว่า 12 ชั่วโมงต่อปี</li>
                          <li><strong>การรักษาความลับ (Confidentiality):</strong> ไม่เปิดเผยข้อมูลลูกค้าแก่บุคคลภายนอกโดยมิชอบ</li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 4. ข้อจำกัดความรับผิด</p>
                        <p className="indent-8">4.1 ในกรณีที่ผู้ให้บริการกระทำผิดสัญญา หรือกระทำโดยประมาทเลินเล่อในการให้บริการตามสัญญาฉบับนี้ อันเป็นเหตุให้ผู้รับบริการได้รับความเสียหาย ผู้ให้บริการตกลงรับผิดชดใช้ค่าเสียหายเท่าที่เกิดขึ้นจริงและเป็นความเสียหายโดยตรงจากการให้บริการดังกล่าว ทั้งนี้ ไม่รวมถึงความเสียหายทางอ้อม ความเสียหายพิเศษ ผลกำไรที่สูญเสียไป โอกาสทางธุรกิจที่สูญเสียไป หรือความเสียหายเชิงลงโทษ เว้นแต่กฎหมายจะบัญญัติไว้เป็นอย่างอื่น</p>
                        <p className="indent-8 mt-1">4.2 ความรับผิดของผู้ให้บริการตามสัญญาฉบับนี้ ไม่ว่าด้วยเหตุผิดสัญญา ละเมิด หรือเหตุอื่นใดอันเกี่ยวเนื่องกับการให้บริการตามสัญญาฉบับนี้ ให้จำกัดอยู่ไม่เกินจำนวนค่าบริการที่ผู้รับบริการได้ชำระให้แก่ผู้ให้บริการตามสัญญาฉบับนี้เป็นระยะเวลา 3 (สาม) เดือน นับถึงวันที่เกิดเหตุแห่งความเสียหาย</p>
                        <p className="indent-8 mt-1">4.3 ข้อจำกัดความรับผิดตามข้อ 4.2 ไม่ใช้บังคับ ในกรณีที่ความเสียหายเกิดจากการกระทำโดยทุจริต ฉ้อฉล หรือประมาทเลินเล่ออย่างร้ายแรงของผู้ให้บริการ หรือกรณีที่กฎหมายห้ามมิให้จำกัดความรับผิดไว้ล่วงหน้า การไม่ต้องรับผิดต่อเบี้ยปรับ เงินเพิ่ม ภาษีอากร หรือความเสียหายใด ๆ ที่เกิดขึ้นจาก (1) การที่ผู้รับบริการหรือบุคคลซึ่งผู้รับบริการมอบหมาย นำส่งข้อมูล เอกสาร หรือคำชี้แจงไม่ครบถ้วน ไม่ถูกต้อง หรือไม่ทันกำหนดเวลา (2) การที่ผู้รับบริการปกปิดข้อเท็จจริงอันเป็นสาระสำคัญ (3) การที่ผู้รับบริการไม่ปฏิบัติตามคำแนะนำของผู้ให้บริการเป็นลายลักษณ์อักษร (4) การเปลี่ยนแปลงกฎหมาย แนวปฏิบัติ หรือคำวินิจฉัยของหน่วยงานราชการภายหลังวันที่ผู้ให้บริการได้ดำเนินการให้บริการหรือยื่นแบบภาษีนั้นแล้ว เว้นแต่ความเสียหายดังกล่าวเกิดขึ้นโดยตรงจากการกระทำโดยทุจริต ฉ้อฉล หรือประมาทเลินเล่ออย่างร้ายแรงของผู้ให้บริการ</p>
                        <p className="indent-8 mt-1">ผู้รับบริการประสงค์จะเรียกร้องค่าเสียหายจากผู้ให้บริการ ผู้รับบริการจะต้องแจ้งเป็นหนังสือให้ผู้ให้บริการทราบภายใน 30 วันนับแต่วันที่ผู้รับบริการทราบ หรือควรจะได้ทราบถึงเหตุแห่งการเรียกร้องนั้น พร้อมแสดงรายละเอียดข้อเท็จจริงและเอกสารหลักฐานที่เกี่ยวข้องโดยครบถ้วน</p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 5. ค่าธรรมเนียมวิชาชีพ</p>
                        <p className="indent-8">
                          ผู้รับบริการตกลงจะชำระค่าบริการให้แก่ผู้ให้บริการ โดยรายละเอียดดังต่อไปนี้ ชำระเต็มจำนวน{" "}
                          <strong>{Number(previewContract.serviceFee || 0).toLocaleString()} บาท</strong> ต่อเดือน{" "}
                          ราคาอ้างอิงใบเสนอราคาที่ผู้ให้บริการเสนอ และผู้รับบริการตกลง ซึ่งค่าบริการตามสัญญาฉบับนี้เป็นค่าบริการที่ยังไม่รวมภาษีมูลค่าเพิ่ม
                        </p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 6. ระยะเวลาและการชำระค่าบริการ</p>
                        <p className="indent-8">
                          ผู้รับบริการตกลงจะชำระค่าบริการให้แก่ผู้ให้บริการ ภายในระยะเวลาที่กำหนด ภายในวันสิ้นเดือนของทุกเดือน{" "}
                          {previewContract.paymentTerms && <>({previewContract.paymentTerms})</>}{" "}
                          หากผู้รับบริการผิดนัดไม่ชำระค่าบริการให้กับผู้ให้บริการตามกำหนดแล้ว ผู้ให้บริการมีสิทธิเรียกดอกเบี้ยในอัตราร้อยละ 7.5 (เจ็ดครึ่ง) ต่อปีของค่าบริการที่ค้างชำระ จนกว่าผู้รับบริการจะชำระเสร็จ
                        </p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 7. การเปลี่ยนแปลงค่าบริการ</p>
                        <p className="indent-8">คู่สัญญาเข้าใจและยอมรับว่าต้นทุนในการให้บริการอาจรับผลกระทบจากปัจจัยต่างๆ รวมถึงเหตุผลความจำเป็นทางเศรษฐกิจ อย่างไรก็ดี ผู้ให้บริการตกลงจะไม่เปลี่ยนแปลงอัตราค่าบริการตลอดระยะเวลาสัญญาฉบับนี้ เว้นแต่จะได้รับความยินยอมจากผู้รับบริการเป็นลายลักษณ์อักษร</p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 8. ระยะเวลาการให้บริการ</p>
                        <p className="indent-8">
                          ผู้รับบริการตกลงว่าจ้างผู้ให้บริการตามเงื่อนไขที่ระบุในสัญญาฉบับนี้ ตั้งแต่วันที่ {formatBEDate(previewContract.contractStartDate)} ถึงวันที่ {formatBEDate(previewContract.contractEndDate)}{" "}
                          หากครบกำหนดแล้ว ผู้ให้บริการยังคงให้บริการต่อเนื่อง โดยผู้รับบริการยินยอมและไม่ได้บอกเลิกสัญญา ให้ถือว่าผู้รับบริการยังตกลงจ้างและรับบริการตามขอบเขตวัตถุประสงค์ของสัญญานี้ต่อไป จนกว่าคู่สัญญาฝ่ายใดฝ่ายหนึ่งจะบอกเลิกสัญญา โดยการบอกเลิกสัญญาเป็นลายลักษณ์อักษรให้อีกฝ่ายหนึ่งทราบล่วงหน้าไม่น้อยกว่า 90 วัน
                        </p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 9. การรักษาความลับ</p>
                        <p className="indent-8">ในการให้บริการผู้ให้บริการอาจได้ล่วงรู้ หรือได้รับข้อมูลจากผู้รับบริการหรือจากบุคคลอื่นใดเพื่อให้บริการตามสัญญาฉบับนี้ ผู้ให้บริการตกลงจะรักษาข้อมูลของผู้รับบริการไว้เป็นความลับ ไม่ว่าจะเป็นข้อมูลส่วนบุคคลหรือข้อมูลทางการค้า และไม่ว่าจะมีมูลค่าหรือไม่ก็ตาม และจะไม่เปิดเผยตีพิมพ์ประกาศ หรือเผยแพร่ต่อบุคคลที่สาม ไม่ว่า ณ เวลาใด และไม่ว่าสัญญาฉบับนี้จะสิ้นสุดลงหรือไม่ก็ตาม รวมตลอดทั้งจะดำเนินการให้พนักงานของผู้รับจ้างช่วงปฏิบัติตามข้อตกลงในการรักษาความลับนี้ด้วย เว้นแต่จะเป็นการกระทำตามกฎหมายหรือได้รับความยินยอมเป็นลายลักษณ์อักษรจากผู้รับบริการก่อนล่วงหน้า</p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 10. การสิ้นสุดสัญญา</p>
                        <p className="indent-8">สัญญาฉบับนี้จะถือว่าสิ้นสุดลงในกรณีหนึ่ง กรณีใด ดังต่อไปนี้</p>
                        <p className="indent-8 mt-1">10.1 ผู้รับบริการได้แจ้งลายลักษณ์อักษรให้ผู้ให้บริการทราบถึงความประสงค์ที่จะเลิกสัญญาก่อนกำหนดล่วงหน้าเป็นเวลาอย่างน้อย 90 วัน</p>
                        <p className="indent-8 mt-1">10.2 ในกรณีที่คู่สัญญาฝ่ายหนึ่งฝ่ายใดทำผิดสัญญานี้ ข้อหนึ่งข้อใดในสาระสำคัญ และคู่สัญญาฝ่ายที่ไม่ผิดสัญญานั้นได้ใช้สิทธิบอกเลิกสัญญาโดยแจ้งเป็นลายลักษณ์อักษรให้อีกฝ่ายหนึ่งทราบ</p>
                        <p className="indent-8 mt-1">10.3 ในกรณีที่คู่สัญญาฝ่ายหนึ่งฝ่ายใดถูกศาลสั่งพิทักษ์เด็ดขาดหรือเป็นบุคคลล้มละลาย</p>
                        <p className="indent-8 mt-1">10.4 กรณีเกิดเหตุสุดวิสัย อันเป็นเหตุให้ผู้ให้บริการไม่สามารถให้บริการได้ตามวัตถุประสงค์แห่งสัญญาฉบับนี้ได้อีกต่อไป</p>
                        <p className="indent-8 mt-1">10.5 ในกรณีที่ผู้ให้บริการดำเนินการให้บริการใดๆ ตามสัญญาโดยประมาท หรือให้คำแนะนำหรือดำเนินการตามข้อ 1 ผิดพลาดในสาระสำคัญ</p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 11. ความสัมพันธ์ของคู่สัญญา</p>
                        <p className="indent-8">ผู้ให้บริการและผู้รับบริการต่างเข้าใจดีว่าการให้บริการตามสัญญาฉบับนี้มุ่งเน้นที่ผลสำเร็จของการให้บริการเป็นสำคัญ โดยที่ผู้รับบริการไม่มีอำนาจบังคับเหนือผู้ให้บริการ โดยที่คู่สัญญาทั้งสองฝ่ายต่างเข้าใจและทราบดีว่า สัญญาฉบับนี้ไม่ได้ก่อให้เกิดความสัมพันธ์ในฐานะนายจ้าง-ลูกจ้าง ระหว่างคู่สัญญาทั้งสองฝ่าย</p>
                      </div>

                      <div>
                        <p className="font-bold">ข้อ 12. กฎหมายที่ใช้บังคับ</p>
                        <p className="indent-8">สัญญาฉบับนี้ให้ใช้บังคับตามกฎหมายไทย</p>
                      </div>

                      {previewContract.additionalTerms && (
                        <div>
                          <p className="font-bold">ข้อ 13. เงื่อนไขเพิ่มเติม</p>
                          <p className="indent-8">{previewContract.additionalTerms}</p>
                        </div>
                      )}
                    </div>

                    <p className="indent-8 mt-6">
                      สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว
                      จึงลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน
                    </p>

                    <div className="grid grid-cols-2 gap-8 mt-8 pt-4">
                      <div className="text-center space-y-2">
                        <p className="text-sm text-gray-500">ลงชื่อ ผู้ให้บริการ</p>
                        {previewContract.firmSignatureDataUrl ? (
                          <img src={previewContract.firmSignatureDataUrl} alt="ลายเซ็นผู้ให้บริการ" className="h-16 mx-auto" />
                        ) : (
                          <div className="border-b border-dotted border-gray-400 w-48 mx-auto mt-8" />
                        )}
                        <p className="text-sm">({previewContract.firmRepName})</p>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-sm text-gray-500">ลงชื่อ ผู้รับบริการ</p>
                        {previewContract.signatureDataUrl ? (
                          <img src={previewContract.signatureDataUrl} alt="ลายเซ็นผู้รับบริการ" className="h-16 mx-auto" />
                        ) : (
                          <div className="border-b border-dotted border-gray-400 w-48 mx-auto mt-8" />
                        )}
                        <p className="text-sm">({previewContract.signerName || previewContract.clientRepName})</p>
                        {previewContract.signerPosition && (
                          <p className="text-xs text-gray-500">{previewContract.signerPosition}</p>
                        )}
                        {previewContract.signedAt && (
                          <p className="text-xs text-gray-400">ลงนามเมื่อ {formatBEDate(previewContract.signedAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!previewContract.firmSignatureDataUrl && (
                  <Card className="rounded-lg border shadow-sm border-t-2 border-t-[#fb9678]">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-[#fb9678]" /> แนบลายเซ็นผู้ให้บริการ
                      </h4>
                      <FirmSignaturePad
                        onSave={(dataUrl) => {
                          if (dataUrl && previewContract) {
                            updateFirmSigMutation.mutate({ id: previewContract.id, firmSignatureDataUrl: dataUrl });
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {previewContract.firmSignatureDataUrl && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-[#05b187]" />
                    <span className="text-sm text-[#05b187] font-medium">แนบลายเซ็นผู้ให้บริการแล้ว</span>
                    <img src={previewContract.firmSignatureDataUrl} alt="ลายเซ็นผู้ให้บริการ" className="h-10 ml-2 border rounded" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-[#f94d4d] hover:text-[#f94d4d]"
                      onClick={() => updateFirmSigMutation.mutate({ id: previewContract.id, firmSignatureDataUrl: null })}
                      data-testid="button-remove-firm-sig"
                    >
                      <X className="w-4 h-4 mr-1" /> ลบลายเซ็น
                    </Button>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <Badge className={`${STATUS_MAP[previewContract.status]?.color} text-sm`}>
                    {STATUS_MAP[previewContract.status]?.label}
                  </Badge>
                  <div className="flex gap-2">
                    {(previewContract.status === "draft" || previewContract.status === "sent") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copySigningLink(previewContract.publicToken)}
                        className="gap-2"
                        data-testid="button-preview-copy-link"
                      >
                        <ExternalLink className="w-4 h-4" /> คัดลอกลิงก์ลงนาม
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>ปิด</Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}