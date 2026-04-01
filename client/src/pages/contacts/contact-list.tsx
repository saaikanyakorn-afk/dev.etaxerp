import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Users, Pencil, Trash2, Phone, Mail, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Download, Eye, Ban, ShoppingCart, Receipt, BookOpen, History, Copy, Merge, ArrowUpDown, ArrowUp, ArrowDown, X, Archive, FileDown } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import ImportBatchHistory from "@/components/import-batch-history";
import { useShowMore } from "@/hooks/use-show-more";
import { useLocation } from "wouter";
import type { Contact } from "@shared/schema";

type SortKey = "code" | "name" | "type" | "taxId" | "phone" | "email" | "contactPerson" | "creditDays";
type SortDir = "asc" | "desc";

export default function ContactList() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dupeDialogOpen, setDupeDialogOpen] = useState(false);
  const [dupeGroups, setDupeGroups] = useState<any[][]>([]);
  const [dupeLoading, setDupeLoading] = useState(false);
  const [dupeKeepIds, setDupeKeepIds] = useState<Record<string, number>>({});
  const [merging, setMerging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showInactive, setShowInactive] = useState(false);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts", selectedCompanyId, showInactive],
    queryFn: async () => {
      const r = await fetch(`/api/contacts?companyId=${selectedCompanyId}${showInactive ? "&showInactive=true" : ""}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/contacts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "ลบคู่ค้าสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/contacts/reset-all?companyId=${selectedCompanyId}&type=customer`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message || "Reset ไม่สำเร็จ");
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: data.message || "Reset สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const r = await fetch(`/api/contacts/bulk-delete?companyId=${selectedCompanyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message || "ลบไม่สำเร็จ");
      return (await r.json()).deleted;
    },
    onSuccess: (deleted) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setSelectedIds(new Set());
      toast({ title: `ลบคู่ค้า ${deleted} รายการสำเร็จ`, variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let list = contacts
      .filter(c => showInactive ? true : c.active)
      .filter(c => typeFilter === "all" || c.type === typeFilter)
      .filter(c => {
        if (!search) return true;
        const s = search.toLowerCase();
        return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s) || (c.taxId || "").includes(s) || (c.phone || "").includes(s);
      });

    if (sortKey) {
      list = [...list].sort((a, b) => {
        let va = "", vb = "";
        switch (sortKey) {
          case "code": va = a.code || ""; vb = b.code || ""; break;
          case "name": va = a.name || ""; vb = b.name || ""; break;
          case "type": va = a.type || ""; vb = b.type || ""; break;
          case "taxId": va = a.taxId || ""; vb = b.taxId || ""; break;
          case "phone": va = a.phone || ""; vb = b.phone || ""; break;
          case "email": va = a.email || ""; vb = b.email || ""; break;
          case "contactPerson": va = a.contactPerson || ""; vb = b.contactPerson || ""; break;
          case "creditDays": return sortDir === "asc" ? (a.creditDays || 0) - (b.creditDays || 0) : (b.creditDays || 0) - (a.creditDays || 0);
        }
        const cmp = va.localeCompare(vb, "th");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [contacts, typeFilter, search, sortKey, sortDir]);

  const { visibleItems, hasMore, remainingCount, totalCount, showMore } = useShowMore(filtered);

  const stats = {
    total: contacts.filter(c => c.active).length,
    customers: contacts.filter(c => c.active && c.type === "customer").length,
    vendors: contacts.filter(c => c.active && c.type === "vendor").length,
    both: contacts.filter(c => c.active && c.type === "both").length,
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-[#03c9d7]" /> : <ArrowDown className="h-3 w-3 ml-1 text-[#03c9d7]" />;
  };

  const allFilteredIds = filtered.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case "customer": return "ลูกค้า";
      case "vendor": return "ผู้ขาย";
      case "both": return "ลูกค้า/ผู้ขาย";
      default: return t;
    }
  };

  const typeBadge = (t: string) => {
    switch (t) {
      case "customer": return <Badge data-testid={`badge-type-${t}`} className="bg-[#e5f9fa] text-[#03c9d7] hover:bg-[#e5f9fa]">ลูกค้า</Badge>;
      case "vendor": return <Badge data-testid={`badge-type-${t}`} className="bg-orange-100 text-orange-700 hover:bg-orange-100">ผู้ขาย</Badge>;
      case "both": return <Badge data-testid={`badge-type-${t}`} className="bg-purple-100 text-purple-700 hover:bg-purple-100">ลูกค้า/ผู้ขาย</Badge>;
      default: return <Badge>{t}</Badge>;
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", String(selectedCompanyId));
      const r = await fetch("/api/contacts/import/preview", { method: "POST", credentials: "include", body: formData });
      if (!r.ok) { const body = await r.json(); throw new Error(body.message); }
      const data = await r.json();
      setImportPreview(data);
      setImportStep("preview");
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleImportExecute() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const okItems = importPreview.preview.filter((p: any) => p.status === "ok" || p.status === "warning").map((p: any) => p.data);
      const r = await fetch("/api/contacts/import/execute", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, contacts: okItems }),
      });
      if (!r.ok) { const body = await r.json(); throw new Error(body.message); }
      const result = await r.json();
      setImportResult(result);
      setImportStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: `นำเข้าสำเร็จ ${result.imported} รายการ`, variant: "success" as any });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setImportStep("upload");
    setImportPreview(null);
    setImportResult(null);
    setImportDialogOpen(false);
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = "/api/contacts/import/template";
    a.download = "template_contacts.xlsx";
    a.click();
  }

  async function loadDuplicates() {
    setDupeLoading(true);
    try {
      const r = await fetch(`/api/contacts/duplicates?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) { const body = await r.json(); throw new Error(body.message); }
      const data = await r.json();
      setDupeGroups(data.groups || []);
      const defaults: Record<string, number> = {};
      for (const group of data.groups) {
        if (group.length > 0) defaults[group[0].tax_id] = group[0].id;
      }
      setDupeKeepIds(defaults);
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setDupeLoading(false);
    }
  }

  async function handleMergeGroup(taxId: string, group: any[]) {
    const keepId = dupeKeepIds[taxId];
    if (!keepId) return;
    const removeIds = group.filter(c => c.id !== keepId).map(c => c.id);
    if (removeIds.length === 0) return;
    const keepContact = group.find(c => c.id === keepId);
    if (!confirm(`ยืนยันรวมคู่ค้า: เก็บ ${keepContact?.code} "${keepContact?.name}" และลบอีก ${removeIds.length} รายการ?\n\nเอกสารทั้งหมดจะถูกย้ายไปยังรายการที่เก็บไว้`)) return;
    setMerging(true);
    try {
      const r = await fetch("/api/contacts/merge", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, removeIds, companyId: selectedCompanyId }),
      });
      if (!r.ok) { const body = await r.json(); throw new Error(body.message); }
      const result = await r.json();
      toast({ title: "รวมคู่ค้าสำเร็จ", description: result.message, variant: "success" as any });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      loadDuplicates();
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }

  async function handleMergeAll() {
    if (dupeGroups.length === 0) return;
    if (!confirm(`ยืนยันรวมคู่ค้าซ้ำทั้งหมด ${dupeGroups.length} กลุ่ม?\n\nเอกสารทั้งหมดจะถูกย้ายไปยังรายการแรกในแต่ละกลุ่ม`)) return;
    setMerging(true);
    let merged = 0;
    try {
      for (const group of dupeGroups) {
        const taxId = group[0].tax_id;
        const keepId = dupeKeepIds[taxId] || group[0].id;
        const removeIds = group.filter(c => c.id !== keepId).map(c => c.id);
        if (removeIds.length === 0) continue;
        const r = await fetch("/api/contacts/merge", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keepId, removeIds, companyId: selectedCompanyId }),
        });
        if (r.ok) merged++;
      }
      toast({ title: "รวมคู่ค้าสำเร็จ", description: `รวม ${merged} กลุ่มเรียบร้อย`, variant: "success" as any });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      loadDuplicates();
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">รายชื่อคู่ค้า</h1>
          </div>
          <div className="flex items-center gap-2">
          <Button data-testid="button-export-contacts" variant="outline" className="gap-2"
            onClick={() => { window.open(`/api/contacts/export?companyId=${selectedCompanyId}`, "_blank"); }}>
            <Download className="h-4 w-4" /> ดาวน์โหลด
          </Button>
          {contacts.length > 0 && contacts.length <= 20 && (
            <Button data-testid="button-reset-contacts" variant="outline" className="gap-2 border-red-400 text-red-600 hover:bg-red-50"
              disabled={resetAllMutation.isPending}
              onClick={() => {
                if (confirm(`⚠️ ลบคู่ค้า (ลูกค้า) ทั้งหมด ${contacts.filter((c: Contact) => c.type === "customer").length} ราย แล้ว Reset รหัสเริ่มที่ C0001\n\nดำเนินการ?`)) {
                  resetAllMutation.mutate();
                }
              }}>
              <Trash2 className="h-4 w-4" /> {resetAllMutation.isPending ? "กำลัง Reset..." : "Reset ลูกค้า"}
            </Button>
          )}
          <Dialog open={dupeDialogOpen} onOpenChange={setDupeDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-check-duplicates" variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => { setDupeDialogOpen(true); loadDuplicates(); }}>
                <Copy className="h-4 w-4" /> ตรวจซ้ำ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Copy className="h-5 w-5 text-amber-500" />
                  ตรวจสอบคู่ค้าซ้ำ (เลขภาษีเดียวกัน)
                </DialogTitle>
              </DialogHeader>
              {dupeLoading ? (
                <div className="py-8 text-center text-muted-foreground">กำลังตรวจสอบ...</div>
              ) : dupeGroups.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                  <p className="font-medium text-green-700">ไม่พบคู่ค้าซ้ำ</p>
                  <p className="text-sm text-muted-foreground">ข้อมูลคู่ค้าไม่มีเลขภาษีซ้ำกัน</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md bg-amber-50 border border-amber-200 p-3">
                    <div className="text-sm">
                      <span className="font-medium text-amber-800">พบ {dupeGroups.length} กลุ่มที่มีเลขภาษีซ้ำ</span>
                      <span className="text-amber-600 ml-2">({dupeGroups.reduce((s, g) => s + g.length, 0)} รายการ)</span>
                    </div>
                    <Button data-testid="button-merge-all" size="sm" className="bg-amber-500 hover:bg-amber-600 gap-1" onClick={handleMergeAll} disabled={merging}>
                      {merging ? "กำลังรวม..." : "รวมทั้งหมด"}
                    </Button>
                  </div>
                  {dupeGroups.map((group, gi) => (
                    <div key={gi} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">เลขภาษี: {group[0].tax_id} <span className="text-muted-foreground ml-1">({group.length} รายการ)</span></div>
                        <Button data-testid={`button-merge-group-${gi}`} size="sm" variant="outline" className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => handleMergeGroup(group[0].tax_id, group)} disabled={merging}>
                          รวมกลุ่มนี้
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">เก็บ</TableHead>
                            <TableHead className="w-20">รหัส</TableHead>
                            <TableHead>ชื่อ</TableHead>
                            <TableHead className="w-20">ประเภท</TableHead>
                            <TableHead>สาขา</TableHead>
                            <TableHead>โทร</TableHead>
                            <TableHead>อีเมล</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.map((c: any) => (
                            <TableRow key={c.id} className={dupeKeepIds[c.tax_id] === c.id ? "bg-green-50/50" : "bg-red-50/30"}>
                              <TableCell>
                                <input
                                  type="radio"
                                  name={`keep-${c.tax_id}`}
                                  checked={dupeKeepIds[c.tax_id] === c.id}
                                  onChange={() => setDupeKeepIds(prev => ({ ...prev, [c.tax_id]: c.id }))}
                                  className="w-4 h-4 accent-green-600"
                                  data-testid={`radio-keep-${c.id}`}
                                />
                              </TableCell>
                              <TableCell className="text-sm font-mono">{c.code}</TableCell>
                              <TableCell className="text-sm font-medium">{c.name}</TableCell>
                              <TableCell className="text-xs">{c.type === "customer" ? "ลูกค้า" : c.type === "vendor" ? "ผู้ขาย" : "ทั้งสอง"}</TableCell>
                              <TableCell className="text-xs">{c.branch || "-"}</TableCell>
                              <TableCell className="text-xs">{c.phone || "-"}</TableCell>
                              <TableCell className="text-xs">{c.email || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300"></span> เก็บไว้
                        <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300 ml-2"></span> จะลบ (ย้ายเอกสารไปรายการที่เก็บ)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) resetImport(); setImportDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-import-contact" variant="outline" className="gap-2" onClick={() => { resetImport(); setImportDialogOpen(true); }}>
                <Upload className="h-4 w-4" /> นำเข้าจากไฟล์
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  นำเข้ารายชื่อคู่ค้าจากไฟล์
                </DialogTitle>
              </DialogHeader>

              {importStep === "upload" && (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium mb-1">เลือกไฟล์ CSV หรือ Excel (.xlsx, .xls)</p>
                    <p className="text-xs text-muted-foreground mb-4">รองรับสูงสุด 5,000 รายการ ขนาดไฟล์ไม่เกิน 50MB</p>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} data-testid="input-import-file" />
                    <Button data-testid="button-select-file" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2">
                      {importing ? "กำลังอ่านไฟล์..." : "เลือกไฟล์"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                    <div className="text-sm">
                      <p className="font-medium">ดาวน์โหลดแบบฟอร์มตัวอย่าง</p>
                      <p className="text-xs text-muted-foreground">ไฟล์ CSV พร้อมหัวคอลัมน์ภาษาไทยที่ระบบรองรับ</p>
                    </div>
                    <Button data-testid="button-download-template" variant="outline" size="sm" className="gap-1" onClick={downloadTemplate}>
                      <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">คอลัมน์ที่รองรับ:</p>
                    <p>รหัสคู่ค้า, ชื่อคู่ค้า, ชื่ออังกฤษ, ประเภท (ลูกค้า/ผู้ขาย/ทั้งสอง), เลขภาษี, สาขา, ที่อยู่, โทรศัพท์, อีเมล, ผู้ติดต่อ, เครดิต, หมายเหตุ</p>
                    <p>หรือใช้ชื่อคอลัมน์ภาษาอังกฤษ: code, name, name_en, type, tax_id, branch, address, phone, email, contact_person, credit_days, notes</p>
                  </div>
                </div>
              )}

              {importStep === "preview" && importPreview && (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-green-700 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-lg font-bold">{importPreview.stats.ok}</span>
                      </div>
                      <p className="text-xs text-green-600">พร้อมนำเข้า</p>
                    </div>
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-700 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-lg font-bold">{importPreview.stats.warning || 0}</span>
                      </div>
                      <p className="text-xs text-blue-600">มีข้อสังเกต (นำเข้าได้)</p>
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-700 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-lg font-bold">{importPreview.stats.duplicate}</span>
                      </div>
                      <p className="text-xs text-amber-600">รหัสซ้ำ (ข้าม)</p>
                    </div>
                    <div className="rounded-md bg-red-50 border border-red-200 p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-red-700 mb-1">
                        <XCircle className="h-4 w-4" />
                        <span className="text-lg font-bold">{importPreview.stats.error}</span>
                      </div>
                      <p className="text-xs text-red-600">ข้อมูลไม่ครบ (ข้าม)</p>
                    </div>
                  </div>

                  <div className="rounded-md border max-h-[40vh] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 sticky top-0 bg-background">แถว</TableHead>
                          <TableHead className="w-16 sticky top-0 bg-background">สถานะ</TableHead>
                          <TableHead className="sticky top-0 bg-background">รหัส</TableHead>
                          <TableHead className="sticky top-0 bg-background">ชื่อ</TableHead>
                          <TableHead className="sticky top-0 bg-background">ประเภท</TableHead>
                          <TableHead className="sticky top-0 bg-background">เลขภาษี</TableHead>
                          <TableHead className="sticky top-0 bg-background">หมายเหตุ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.preview.slice(0, 100).map((item: any) => (
                          <TableRow key={item.row} className={item.status === "ok" ? "" : item.status === "warning" ? "bg-blue-50/50" : item.status === "duplicate" ? "bg-amber-50/50" : "bg-red-50/50"}>
                            <TableCell className="text-xs">{item.row}</TableCell>
                            <TableCell>
                              {item.status === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                              {item.status === "warning" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                              {item.status === "duplicate" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                              {item.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                            </TableCell>
                            <TableCell className="text-xs">{item.data?.code || "-"}</TableCell>
                            <TableCell className="text-xs font-medium">{item.data?.name || "-"}</TableCell>
                            <TableCell className="text-xs">{item.data?.type === "customer" ? "ลูกค้า" : item.data?.type === "vendor" ? "ผู้ขาย" : item.data?.type || "-"}</TableCell>
                            <TableCell className="text-xs">{item.data?.taxId || "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.message || ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {importPreview.preview.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center">แสดง 100 จาก {importPreview.preview.length} รายการ (สรุปยอดด้านบนเป็นทั้งหมด)</p>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <Button variant="outline" onClick={() => setImportStep("upload")}>เลือกไฟล์ใหม่</Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetImport}>ยกเลิก</Button>
                      <Button data-testid="button-execute-import" onClick={handleImportExecute} disabled={importing || (importPreview.stats.ok + (importPreview.stats.warning || 0)) === 0}>
                        {importing ? "กำลังนำเข้า..." : `นำเข้า ${importPreview.stats.ok + (importPreview.stats.warning || 0)} รายการ`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {importStep === "done" && importResult && (
                <div className="py-6 text-center space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                  <div>
                    <p className="text-lg font-medium">นำเข้าสำเร็จ</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      นำเข้า {importResult.imported} รายการ จากทั้งหมด {importResult.total} รายการ
                      {importResult.skipped > 0 && ` (ข้าม ${importResult.skipped} รายการ)`}
                    </p>
                  </div>
                  <Button data-testid="button-close-import" onClick={resetImport}>ปิด</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button data-testid="button-add-contact" className="gap-2" onClick={() => navigate("/contacts/new")}>
                <Plus className="h-4 w-4" /> เพิ่มคู่ค้า
          </Button>
          </div>
        </div>

        <ImportBatchHistory docType="contact" invalidateKeys={[["contacts"]]} />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-total" className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-muted-foreground">คู่ค้าทั้งหมด</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-customers" className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{stats.customers}</div>
              <div className="text-xs text-muted-foreground">ลูกค้า</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-vendors" className="text-2xl font-bold" style={{ color: "#fb9678" }}>{stats.vendors}</div>
              <div className="text-xs text-muted-foreground">ผู้ขาย</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div data-testid="text-stat-both" className="text-2xl font-bold" style={{ color: "#03c9d7" }}>{stats.both}</div>
              <div className="text-xs text-muted-foreground">ลูกค้า/ผู้ขาย</div>
            </CardContent>
          </Card>
        </div>

        

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                <TabsList>
                  <TabsTrigger data-testid="tab-all" value="all">ทั้งหมด ({stats.total})</TabsTrigger>
                  <TabsTrigger data-testid="tab-customer" value="customer">ลูกค้า ({stats.customers})</TabsTrigger>
                  <TabsTrigger data-testid="tab-vendor" value="vendor">ผู้ขาย ({stats.vendors})</TabsTrigger>
                  <TabsTrigger data-testid="tab-both" value="both">ทั้งสอง ({stats.both})</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-64 ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search" className="pl-9" placeholder="ค้นหาชื่อ, รหัส, เลขภาษี..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button
                data-testid="btn-show-inactive"
                variant={showInactive ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
                className={showInactive ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : "border-orange-400 text-orange-600 hover:bg-orange-50"}
              >
                <Archive className="h-4 w-4 mr-1" />
                {showInactive ? "ซ่อนรายการที่ลบ" : "แสดงรายการที่ลบ"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="w-24 cursor-pointer select-none" onClick={() => handleSort("code")} data-testid="sort-code">
                    <span className="flex items-center">รหัส <SortIcon col="code" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")} data-testid="sort-name">
                    <span className="flex items-center">ชื่อคู่ค้า <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="w-28 cursor-pointer select-none" onClick={() => handleSort("type")} data-testid="sort-type">
                    <span className="flex items-center">ประเภท <SortIcon col="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("taxId")} data-testid="sort-taxId">
                    <span className="flex items-center">เลขภาษี <SortIcon col="taxId" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("phone")} data-testid="sort-phone">
                    <span className="flex items-center">โทรศัพท์ <SortIcon col="phone" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")} data-testid="sort-email">
                    <span className="flex items-center">อีเมล <SortIcon col="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("contactPerson")} data-testid="sort-contactPerson">
                    <span className="flex items-center">ผู้ติดต่อ <SortIcon col="contactPerson" /></span>
                  </TableHead>
                  <TableHead className="w-16 cursor-pointer select-none" onClick={() => handleSort("creditDays")} data-testid="sort-creditDays">
                    <span className="flex items-center">เครดิต <SortIcon col="creditDays" /></span>
                  </TableHead>
                  <TableHead className="w-20 text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {contacts.length === 0 ? "ยังไม่มีข้อมูลคู่ค้า กด \"เพิ่มคู่ค้า\" เพื่อเริ่มต้น" : "ไม่พบข้อมูลที่ค้นหา"}
                    </TableCell>
                  </TableRow>
                ) : visibleItems.map(contact => (
                  <ContextMenu key={contact.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow data-testid={`row-contact-${contact.id}`} className={`cursor-context-menu ${!contact.active ? "bg-red-50 opacity-60" : selectedIds.has(contact.id) ? "bg-[#e5f9fa]/50" : ""}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                            data-testid={`checkbox-contact-${contact.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm">{contact.code}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {contact.name}
                            {!contact.active && <Badge variant="destructive" className="ml-2 text-[10px]">ลบแล้ว</Badge>}
                          </div>
                          {contact.nameEn && <div className="text-xs text-muted-foreground">{contact.nameEn}</div>}
                        </TableCell>
                        <TableCell>{typeBadge(contact.type)}</TableCell>
                        <TableCell className="text-sm">{contact.taxId || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {contact.phone ? (
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {contact.email ? (
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">{contact.contactPerson || "-"}</TableCell>
                        <TableCell className="text-center text-sm">{contact.creditDays || 0} วัน</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button data-testid={`button-edit-${contact.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/contacts/edit/${contact.id}`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button data-testid={`button-delete-${contact.id}`} variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                              if (confirm("ต้องการลบคู่ค้านี้?")) deleteMutation.mutate(contact.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem className="gap-2" onClick={() => navigate(`/contacts/edit/${contact.id}`)}>
                        <Pencil className="h-4 w-4" /> แก้ไขรายชื่อ
                      </ContextMenuItem>
                      <ContextMenuItem className="gap-2" onClick={() => navigate(`/contacts/edit/${contact.id}`)}>
                        <Eye className="h-4 w-4" /> รายละเอียดคู่ค้า
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="gap-2" disabled>
                        <History className="h-4 w-4" /> ดูประวัติย้อนหลัง
                      </ContextMenuItem>
                      <ContextMenuItem className="gap-2" disabled>
                        <ShoppingCart className="h-4 w-4" /> ยอดขาย - ตามคู่ค้า
                      </ContextMenuItem>
                      <ContextMenuItem className="gap-2" disabled>
                        <Receipt className="h-4 w-4" /> ยอดซื้อ - ตามคู่ค้า
                      </ContextMenuItem>
                      <ContextMenuItem className="gap-2" disabled>
                        <BookOpen className="h-4 w-4" /> สมุดบัญชี - ตามคู่ค้า
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem className="gap-2" onClick={() => {
                        if (confirm("ต้องการยกเลิกการใช้งานคู่ค้านี้?")) deleteMutation.mutate(contact.id);
                      }}>
                        <Ban className="h-4 w-4 text-destructive" /> <span className="text-destructive">ยกเลิกการใช้งาน</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
            {hasMore && (
              <div className="text-center py-3 border-t">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showMore(); }} className="text-sm font-medium hover:opacity-80 hover:underline cursor-pointer py-1 px-3" style={{ color: "var(--theme-primary)" }} data-testid="button-show-more">
                  แสดงเพิ่มเติม ({remainingCount} รายการ)
                </button>
              </div>
            )}
            {!hasMore && totalCount > 50 && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                แสดงทั้งหมด {totalCount} รายการ
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {someSelected && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center" data-testid="selection-bar">
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-[#292f4c] px-3 py-2 shadow-2xl">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0073ea] text-white text-sm font-bold mr-2" data-testid="text-selected-count">
              {selectedIds.size}
            </div>
            <span className="text-white text-sm font-medium mr-3">รายการที่เลือก</span>
            <div className="w-px h-7 bg-gray-600 mx-1" />
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              data-testid="button-bulk-export"
              onClick={() => {
                const ids = Array.from(selectedIds).join(",");
                window.open(`/api/contacts/export?companyId=${selectedCompanyId}&ids=${ids}`, "_blank");
              }}
            >
              <FileDown className="h-4.5 w-4.5" />
              <span className="text-[10px]">ส่งออก</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              data-testid="button-bulk-archive"
              onClick={() => {
                if (confirm(`ต้องการยกเลิกการใช้งานคู่ค้าที่เลือก ${selectedIds.size} รายการ?`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedIds));
                }
              }}
            >
              <Archive className="h-4.5 w-4.5" />
              <span className="text-[10px]">เก็บถาวร</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition-colors"
              data-testid="button-bulk-delete"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                if (confirm(`ต้องการลบคู่ค้าที่เลือก ${selectedIds.size} รายการ?`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedIds));
                }
              }}
            >
              <Trash2 className="h-4.5 w-4.5" />
              <span className="text-[10px]">{bulkDeleteMutation.isPending ? "กำลังลบ..." : "ลบ"}</span>
            </button>
            <div className="w-px h-7 bg-gray-600 mx-1" />
            <button
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              data-testid="button-clear-selection"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}