import { useState, useCallback } from "react";
import LegacyLayout from "@/components/legacy-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLegacyCompany } from "@/lib/legacy-company-context";
import {
  Building2,
  Download,
  Trash2,
  Loader2,
  Archive,
  BookOpen,
  Users,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Hash,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CompanyStats {
  accounts: number;
  contacts: number;
  documents: number;
  glEntries: number;
  glLines: number;
}

interface LegacyCompany {
  id: number;
  name: string;
  sourceId: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  dateRangeFrom: string;
  dateRangeTo: string;
  importedAt: string;
  tableCount: number;
  totalRows: number;
}

export default function CompanyManagerPage() {
  const { toast } = useToast();
  const { colors: themeColors } = useThemeColor();
  const queryClient = useQueryClient();
  const { selectedCompany } = useLegacyCompany();
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: companies = [], isLoading } = useQuery<LegacyCompany[]>({
    queryKey: ["/api/legacy-import/companies"],
    queryFn: async () => {
      const res = await fetch("/api/legacy-import/companies", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: stats } = useQuery<CompanyStats>({
    queryKey: ["/api/legacy-import/companies", expandedId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/legacy-import/companies/${expandedId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!expandedId,
  });

  const handleArchive = useCallback(async (id: number, name: string) => {
    setArchivingId(id);
    try {
      const res = await fetch(`/api/legacy-import/companies/${id}/archive`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `Archive_${name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setArchivedIds(prev => new Set(prev).add(id));
      toast({ title: `ดาวน์โหลด Archive สำเร็จ`, description: name });
    } catch (err: any) {
      toast({ title: "ไม่สามารถสร้าง Archive ได้", description: err.message, variant: "destructive" });
    } finally {
      setArchivingId(null);
    }
  }, [toast]);

  const handleDelete = useCallback(async (id: number, name: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/legacy-import/companies/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ["/api/legacy-import/companies"] });
      toast({ title: `ลบบริษัทสำเร็จ`, description: name });
    } catch (err: any) {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }, [toast, queryClient]);

  const filteredCompanies = selectedCompany
    ? companies.filter(c => c.id === selectedCompany.id)
    : companies;

  return (
    <LegacyLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg text-white" style={{ background: themeColors.primary }}>
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">จัดการบริษัท — Archive & ลบข้อมูล</h1>
            <p className="text-sm text-gray-500">ดาวน์โหลด ZIP เก็บข้อมูลเดิม หรือลบบริษัทที่ไม่ใช้แล้ว</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">ยังไม่มีบริษัทที่นำเข้า</p>
              <p className="text-sm text-slate-400 mt-1">นำเข้าข้อมูลจาก "นำเข้า ZIP → ฐานข้อมูล" ก่อน</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-slate-500">
              พบ {filteredCompanies.length} บริษัท
            </div>

            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className={`transition-all ${expandedId === company.id ? "ring-2" : ""}`}
                style={expandedId === company.id ? { ringColor: themeColors.primary + "40" } : undefined}
                data-testid={`card-company-${company.id}`}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-800" data-testid={`text-company-name-${company.id}`}>
                            {company.name}
                          </h3>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                            {company.sourceId && (
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                {company.sourceId}
                              </span>
                            )}
                            {company.taxId && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {company.taxId}
                              </span>
                            )}
                            {company.dateRangeFrom && company.dateRangeFrom !== "-" && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {company.dateRangeFrom} — {company.dateRangeTo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-400 ml-8">
                        <span>{company.tableCount || 0} ตาราง</span>
                        <span>{(company.totalRows || 0).toLocaleString()} แถว</span>
                        {company.importedAt && (
                          <span>นำเข้า: {new Date(company.importedAt).toLocaleDateString("th-TH")}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        disabled={archivingId === company.id}
                        onClick={() => handleArchive(company.id, company.name)}
                        data-testid={`button-archive-${company.id}`}
                      >
                        {archivingId === company.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Download className="h-4 w-4 mr-1.5" />
                        )}
                        Archive ZIP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={archivedIds.has(company.id)
                          ? "text-red-600 border-red-300 hover:bg-red-50"
                          : "text-slate-400 border-slate-200"
                        }
                        disabled={deletingId === company.id || !archivedIds.has(company.id)}
                        onClick={() => setDeleteConfirmId(company.id)}
                        title={!archivedIds.has(company.id) ? "กรุณา Archive ก่อนลบ" : ""}
                        data-testid={`button-delete-${company.id}`}
                      >
                        {deletingId === company.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1.5" />
                        )}
                        {archivedIds.has(company.id) ? "ลบ" : "Archive ก่อนลบ"}
                      </Button>
                    </div>
                  </div>

                  {expandedId === company.id && stats && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <BookOpen className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                          <div className="text-lg font-bold text-slate-800">{stats.accounts.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">ผังบัญชี</div>
                        </div>
                        <div className="bg-violet-50 rounded-lg p-3 text-center">
                          <Users className="h-4 w-4 mx-auto text-violet-500 mb-1" />
                          <div className="text-lg font-bold text-slate-800">{stats.contacts.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">คู่ค้า</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <FileText className="h-4 w-4 mx-auto text-green-500 mb-1" />
                          <div className="text-lg font-bold text-slate-800">{stats.documents.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">เอกสาร</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <FileSpreadsheet className="h-4 w-4 mx-auto text-amber-500 mb-1" />
                          <div className="text-lg font-bold text-slate-800">{stats.glEntries.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">GL Entries</div>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-3 text-center">
                          <FileSpreadsheet className="h-4 w-4 mx-auto text-cyan-500 mb-1" />
                          <div className="text-lg font-bold text-slate-800">{stats.glLines.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">GL Lines</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">คำแนะนำ</p>
                <ul className="list-disc ml-4 space-y-1 text-amber-700">
                  <li><strong>Archive ZIP</strong> — ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ ZIP (สามารถ Import กลับเข้ามาได้ในภายหลัง)</li>
                  <li><strong>ลบ</strong> — ลบข้อมูลออกจากฐานข้อมูลถาวร (แนะนำให้ Archive ก่อนลบ)</li>
                  <li>ไฟล์ ZIP ที่ดาวน์โหลดใช้ Format เดียวกันกับ "นำเข้า ZIP → ฐานข้อมูล" สามารถ Import กลับได้ทันที</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ยืนยันการลบบริษัท
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                คุณต้องการลบ <strong>{companies.find(c => c.id === deleteConfirmId)?.name}</strong> ออกจากฐานข้อมูลหรือไม่?
              </p>
              <p className="text-red-600 font-medium">
                ข้อมูลทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้
              </p>
              <p className="text-slate-500">
                แนะนำให้กด "Archive ZIP" ดาวน์โหลดเก็บไว้ก่อนลบ
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmId) {
                  const company = companies.find(c => c.id === deleteConfirmId);
                  handleDelete(deleteConfirmId, company?.name || "");
                }
              }}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LegacyLayout>
  );
}
