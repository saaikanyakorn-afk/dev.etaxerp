import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Layout from "@/components/layout";
import {
  Download, Search, Building2, FileText, CheckCircle2,
  AlertCircle, Loader2, Shield, Calendar, Users,
  ChevronDown, ChevronRight, X, BookOpen, Save, FolderOpen
} from "lucide-react";

interface BoardClient {
  itemId: number;
  name: string;
  taxId: string;
  rdPassword: string;
  ssoUsername: string;
  ssoPassword: string;
  hasRd: boolean;
  hasSso: boolean;
}

interface ReceiptFile {
  name: string;
  url: string;
  formCode: string;
  taxMonthYear: string;
  refNo: string;
  docType: string;
  data?: string;
}

interface DownloadResult {
  clientName: string;
  clientTaxId?: string;
  agency: string;
  status: "success" | "error" | "pending" | "downloading";
  message: string;
  files?: ReceiptFile[];
}

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  exists?: boolean;
  description?: string;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const currentYear = new Date().getFullYear() + 543;
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function GovReceiptDownloader() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();

  const [searchFilter, setSearchFilter] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [agencies, setAgencies] = useState<{ rd: boolean; sso: boolean }>({ rd: true, sso: true });
  const [monthFrom, setMonthFrom] = useState(String(new Date().getMonth()));
  const [monthTo, setMonthTo] = useState(String(new Date().getMonth()));
  const [year, setYear] = useState(String(currentYear));
  const [results, setResults] = useState<DownloadResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const [journalDialog, setJournalDialog] = useState<{
    open: boolean;
    file?: ReceiptFile;
    clientName?: string;
    lines?: JournalLine[];
    amount: string;
    docDate: string;
    description: string;
    loading: boolean;
  }>({ open: false, amount: "0.00", docDate: new Date().toISOString().substring(0, 10), description: "", loading: false });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["/api/tools/gov-receipt/clients", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/tools/gov-receipt/clients?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ clients: BoardClient[] }>;
    },
    enabled: !!selectedCompanyId,
  });

  const clients = useMemo(() => {
    const all = clientsData?.clients || [];
    if (!searchFilter) return all;
    const q = searchFilter.toLowerCase();
    return all.filter(c => c.name.toLowerCase().includes(q) || c.taxId.includes(q));
  }, [clientsData, searchFilter]);

  const toggleClient = (id: number) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(clients.map(c => c.itemId)));
    }
  };

  const downloadMut = useMutation({
    mutationFn: async (params: {
      clients: BoardClient[];
      agencies: string[];
      monthFrom: number;
      monthTo: number;
      year: number;
    }) => {
      const initialResults: DownloadResult[] = [];
      for (const client of params.clients) {
        for (const agency of params.agencies) {
          initialResults.push({
            clientName: client.name,
            clientTaxId: client.taxId,
            agency: agency === "rd" ? "กรมสรรพากร" : "ประกันสังคม",
            status: "pending",
            message: "รอคิว...",
          });
        }
      }
      setResults(initialResults);

      const finalResults: DownloadResult[] = [];

      for (const client of params.clients) {
        for (const agency of params.agencies) {
          setResults(prev => prev.map(r =>
            r.clientName === client.name && r.agency === (agency === "rd" ? "กรมสรรพากร" : "ประกันสังคม")
              ? { ...r, status: "downloading" as const, message: "กำลังเข้าสู่ระบบ..." }
              : r
          ));

          try {
            const resp = await fetch("/api/tools/gov-receipt/download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                companyId: selectedCompanyId,
                itemId: client.itemId,
                agency,
                monthFrom: params.monthFrom,
                monthTo: params.monthTo,
                year: params.year,
              }),
            });
            const data = await resp.json();

            const result: DownloadResult = {
              clientName: client.name,
              clientTaxId: client.taxId,
              agency: agency === "rd" ? "กรมสรรพากร" : "ประกันสังคม",
              status: data.success ? "success" : "error",
              message: data.message || (data.success ? "ดาวน์โหลดสำเร็จ" : "เกิดข้อผิดพลาด"),
              files: data.files,
            };
            finalResults.push(result);

            setResults(prev => prev.map(r =>
              r.clientName === client.name && r.agency === result.agency ? result : r
            ));
          } catch (err: any) {
            const result: DownloadResult = {
              clientName: client.name,
              clientTaxId: client.taxId,
              agency: agency === "rd" ? "กรมสรรพากร" : "ประกันสังคม",
              status: "error",
              message: err.message || "เชื่อมต่อไม่ได้",
            };
            finalResults.push(result);
            setResults(prev => prev.map(r =>
              r.clientName === client.name && r.agency === result.agency ? result : r
            ));
          }
        }
      }

      const successCount = finalResults.filter(r => r.status === "success").length;
      toast({
        title: "ดึงใบเสร็จเสร็จสิ้น",
        description: successCount > 0
          ? `สำเร็จ ${successCount}/${finalResults.length} รายการ — ไฟล์ถูกเก็บเข้าคลังเอกสารแล้ว`
          : `ไม่สำเร็จ ${finalResults.length} รายการ — กรุณาตรวจสอบรหัสผ่าน`,
        variant: successCount === 0 ? "destructive" : undefined,
      });

      return finalResults;
    },
  });

  const handleDownload = (agencyFilter?: "rd" | "sso") => {
    const selected = clients.filter(c => selectedClients.has(c.itemId));
    if (selected.length === 0) {
      toast({ title: "กรุณาเลือกลูกค้า", variant: "destructive" });
      return;
    }

    let agenciesToFetch: string[] = [];
    if (agencyFilter) {
      agenciesToFetch = [agencyFilter];
    } else {
      if (agencies.rd) agenciesToFetch.push("rd");
      if (agencies.sso) agenciesToFetch.push("sso");
    }

    if (agenciesToFetch.length === 0) {
      toast({ title: "กรุณาเลือกหน่วยงาน", variant: "destructive" });
      return;
    }

    downloadMut.mutate({
      clients: selected,
      agencies: agenciesToFetch,
      monthFrom: parseInt(monthFrom),
      monthTo: parseInt(monthTo),
      year: parseInt(year) - 543,
    });
  };

  const openJournalDialog = async (file: ReceiptFile, clientName: string) => {
    setJournalDialog({
      open: true,
      file,
      clientName,
      amount: "0.00",
      docDate: new Date().toISOString().substring(0, 10),
      description: `ชำระภาษี ${file.formCode} ${file.taxMonthYear || ""} - ${clientName}`.trim(),
      loading: true,
      lines: undefined,
    });

    try {
      const resp = await fetch("/api/tools/gov-receipt/journal-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          formCode: file.formCode,
          taxMonthYear: file.taxMonthYear,
          refNo: file.refNo,
        }),
      });
      const data = await resp.json();
      setJournalDialog(prev => ({
        ...prev,
        lines: data.lines || [],
        loading: false,
      }));
    } catch {
      setJournalDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const saveJournalEntry = async () => {
    if (!journalDialog.file || !journalDialog.lines) return;
    const amount = parseFloat(journalDialog.amount);
    if (!amount || amount <= 0) {
      toast({ title: "กรุณาระบุจำนวนเงิน", variant: "destructive" });
      return;
    }

    const lines = journalDialog.lines.map(l => ({
      ...l,
      debit: l.debit !== "0" && l.debit !== "0.00" ? String(amount) : "0",
      credit: l.credit !== "0" && l.credit !== "0.00" ? String(amount) : "0",
    }));

    try {
      const resp = await fetch("/api/tools/gov-receipt/journal-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          formCode: journalDialog.file.formCode,
          taxMonthYear: journalDialog.file.taxMonthYear,
          refNo: journalDialog.file.refNo,
          amount,
          docDate: journalDialog.docDate,
          lines,
          description: journalDialog.description,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        toast({
          title: "บันทึกบัญชีสำเร็จ",
          description: `เลขที่ ${data.entryNo}`,
        });
        setJournalDialog(prev => ({ ...prev, open: false }));
      } else {
        toast({ title: data.message || "เกิดข้อผิดพลาด", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "downloading": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-100 text-green-700 border-green-200">สำเร็จ</Badge>;
      case "error": return <Badge className="bg-red-100 text-red-700 border-red-200">ผิดพลาด</Badge>;
      case "downloading": return <Badge className="bg-blue-100 text-blue-700 border-blue-200">กำลังดึง...</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-500 border-gray-200">รอคิว</Badge>;
    }
  };

  return (
    <Layout>
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-xl">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900" data-testid="text-page-title">
                ดึงใบเสร็จหน่วยงานราชการ
              </h1>
              <p className="text-sm text-gray-500">ดาวน์โหลดใบเสร็จจากกรมสรรพากรและประกันสังคม → เก็บเข้าคลังเอกสาร → บันทึกบัญชี</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    เลือกลูกค้า ({selectedClients.size}/{clients.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={selectAll} data-testid="btn-select-all">
                    {selectedClients.size === clients.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                  </Button>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ค้นหาชื่อบริษัท / เลขผู้เสียภาษี..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-client"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingClients ? (
                  <div className="text-center py-8 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูลลูกค้า...
                  </div>
                ) : clients.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Building2 className="h-8 w-8 mx-auto mb-2" />
                    <p>ไม่พบลูกค้าที่มีข้อมูลรหัสผ่านในบอร์ด</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-1">
                    {clients.map(client => (
                      <label
                        key={client.itemId}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                          selectedClients.has(client.itemId)
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                        data-testid={`client-row-${client.itemId}`}
                      >
                        <Checkbox
                          checked={selectedClients.has(client.itemId)}
                          onCheckedChange={() => toggleClient(client.itemId)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{client.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 font-mono">{client.taxId || "-"}</span>
                            <div className="flex gap-1">
                              {client.hasRd && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">RD</span>
                              )}
                              {client.hasSso && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">SSO</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  หน่วยงาน
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={agencies.rd}
                    onCheckedChange={(v) => setAgencies(prev => ({ ...prev, rd: !!v }))}
                    data-testid="chk-agency-rd"
                  />
                  <div>
                    <p className="text-sm font-medium">กรมสรรพากร</p>
                    <p className="text-xs text-gray-400">efiling.rd.go.th</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={agencies.sso}
                    onCheckedChange={(v) => setAgencies(prev => ({ ...prev, sso: !!v }))}
                    data-testid="chk-agency-sso"
                  />
                  <div>
                    <p className="text-sm font-medium">ประกันสังคม</p>
                    <p className="text-xs text-gray-400">sso.go.th</p>
                  </div>
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  เดือนภาษี
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">ปี พ.ศ.</label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">เดือนเริ่ม</label>
                    <Select value={monthFrom} onValueChange={setMonthFrom}>
                      <SelectTrigger data-testid="select-month-from"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {THAI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">ถึงเดือน</label>
                    <Select value={monthTo} onValueChange={setMonthTo}>
                      <SelectTrigger data-testid="select-month-to"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {THAI_MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11"
                disabled={downloadMut.isPending || selectedClients.size === 0}
                onClick={() => handleDownload()}
                data-testid="btn-download-all"
              >
                <Download className="h-4 w-4" />
                {downloadMut.isPending ? "กำลังดึงใบเสร็จ..." : `ดึงใบเสร็จทั้งหมด (${selectedClients.size} ราย)`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1"
                  disabled={downloadMut.isPending || selectedClients.size === 0}
                  onClick={() => handleDownload("rd")}
                  data-testid="btn-download-rd"
                >
                  <FileText className="h-3 w-3" />
                  เฉพาะสรรพากร
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                  disabled={downloadMut.isPending || selectedClients.size === 0}
                  onClick={() => handleDownload("sso")}
                  data-testid="btn-download-sso"
                >
                  <Shield className="h-3 w-3" />
                  เฉพาะประกันสังคม
                </Button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="text-xs text-amber-700">
                <strong>หมายเหตุ:</strong> รหัสผ่านดึงจากบอร์ด "ลูกค้าของฉัน" เท่านั้น ไม่มีการเก็บรหัสผ่านเพิ่มเติม
              </p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                ไฟล์ที่ดึงสำเร็จจะถูกเก็บเข้าคลังเอกสารอัตโนมัติ
              </p>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  ผลการดึงใบเสร็จ ({results.filter(r => r.status === "success").length}/{results.length} สำเร็จ)
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setResults([])} data-testid="btn-clear-results">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((result, idx) => {
                  const key = `${result.clientName}-${result.agency}-${idx}`;
                  const isExpanded = expandedResults.has(key);
                  const hasFiles = result.files && result.files.length > 0;
                  return (
                    <div
                      key={key}
                      className={`border rounded-lg p-3 transition-all ${
                        result.status === "success" ? "border-green-200 bg-green-50/30" :
                        result.status === "error" ? "border-red-200 bg-red-50/30" :
                        result.status === "downloading" ? "border-blue-200 bg-blue-50/30" :
                        "border-gray-200"
                      }`}
                      data-testid={`result-row-${idx}`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.clientName}</p>
                          <p className="text-xs text-gray-500">{result.agency}</p>
                        </div>
                        {getStatusBadge(result.status)}
                        {hasFiles && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExpandedResults(prev => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {result.message && (result.status === "error" || result.status === "success") && (
                        <p className={`text-xs mt-1 ml-7 ${result.status === "error" ? "text-red-500" : "text-green-600"}`}>{result.message}</p>
                      )}
                      {isExpanded && result.files && result.files.length > 0 && (
                        <div className="mt-3 ml-7 space-y-1.5">
                          {result.files.map((file, fi) => {
                            const downloadUrl = file.data
                              ? `/api/tools/gov-receipt/file/${result.clientTaxId || "unknown"}/${encodeURIComponent(file.name)}`
                              : file.url;
                            const isReceipt = file.docType === "TAX_RECEIPT" || file.docType === "RECEIPT" || file.name.includes("RECEIPT");
                            const docLabel = file.docType === "TAX_FORM" ? "แบบ" : isReceipt ? "ใบเสร็จ" : file.docType;
                            return (
                              <div key={fi} className="flex items-center gap-2 group">
                                <a
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline py-0.5 flex-1 min-w-0"
                                  data-testid={`file-link-${idx}-${fi}`}
                                >
                                  <Download className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{file.name}</span>
                                </a>
                                {file.formCode && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">
                                    {file.formCode}
                                  </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                                  isReceipt ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                  {docLabel}
                                </span>
                                {file.taxMonthYear && (
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{file.taxMonthYear}</span>
                                )}
                                {isReceipt && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 gap-1 flex-shrink-0"
                                    onClick={() => openJournalDialog(file, result.clientName)}
                                    data-testid={`btn-journal-${idx}-${fi}`}
                                  >
                                    <BookOpen className="h-3 w-3" />
                                    บันทึกบัญชี
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={journalDialog.open} onOpenChange={(v) => setJournalDialog(prev => ({ ...prev, open: v }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-500" />
              บันทึกบัญชีจากใบเสร็จราชการ
            </DialogTitle>
          </DialogHeader>

          {journalDialog.loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-gray-500">กำลังเตรียมรายการบัญชี...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{journalDialog.clientName}</p>
                <div className="flex gap-2 text-xs text-gray-500">
                  <span>{journalDialog.file?.formCode}</span>
                  <span>•</span>
                  <span>{journalDialog.file?.taxMonthYear}</span>
                  <span>•</span>
                  <span>Ref: {journalDialog.file?.refNo}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">วันที่บันทึก</label>
                  <Input
                    type="date"
                    value={journalDialog.docDate}
                    onChange={e => setJournalDialog(prev => ({ ...prev, docDate: e.target.value }))}
                    data-testid="input-journal-date"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">จำนวนเงิน (บาท)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={journalDialog.amount}
                    onChange={e => setJournalDialog(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    data-testid="input-journal-amount"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">คำอธิบาย</label>
                <Input
                  value={journalDialog.description}
                  onChange={e => setJournalDialog(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-journal-desc"
                />
              </div>

              {journalDialog.lines && journalDialog.lines.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">รายการบัญชี (Preview)</label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">รหัสบัญชี</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">ชื่อบัญชี</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">เดบิต</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">เครดิต</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalDialog.lines.map((line, i) => {
                          const amt = parseFloat(journalDialog.amount) || 0;
                          const isDebit = line.debit !== "0" && line.debit !== "0.00";
                          return (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">
                                {line.accountCode}
                                {!line.exists && (
                                  <span className="ml-1 text-[10px] text-amber-500" title="ยังไม่มีในผังบัญชี">⚠</span>
                                )}
                              </td>
                              <td className="px-3 py-2">{line.accountName}</td>
                              <td className="px-3 py-2 text-right font-mono">{isDebit && amt > 0 ? amt.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</td>
                              <td className="px-3 py-2 text-right font-mono">{!isDebit && amt > 0 ? amt.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {journalDialog.lines.some(l => !l.exists) && (
                    <p className="text-xs text-amber-500 mt-1">⚠ บางรหัสบัญชียังไม่มีในผังบัญชีของบริษัทนี้ — ระบบจะใช้รหัสเริ่มต้น</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setJournalDialog(prev => ({ ...prev, open: false }))} data-testid="btn-journal-cancel">
              ยกเลิก
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              onClick={saveJournalEntry}
              disabled={journalDialog.loading || !journalDialog.amount || parseFloat(journalDialog.amount) <= 0}
              data-testid="btn-journal-save"
            >
              <Save className="h-4 w-4" />
              บันทึกบัญชี (Draft)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
