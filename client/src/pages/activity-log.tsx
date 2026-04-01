import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { formatDateTime } from "@/lib/format";
import Layout from "@/components/layout";
import { History, Filter, ChevronDown, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useDateSettings } from "@/hooks/use-date-settings";
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "สร้าง", color: "bg-green-100 text-green-700 border-green-200" },
  update: { label: "แก้ไข", color: "bg-blue-100 text-blue-700 border-blue-200" },
  delete: { label: "ลบ", color: "bg-red-100 text-red-700 border-red-200" },
  approve: { label: "อนุมัติ", color: "bg-green-100 text-green-700 border-green-200" },
  cancel: { label: "ยกเลิก", color: "bg-orange-100 text-orange-700 border-orange-200" },
  login: { label: "เข้าระบบ", color: "bg-gray-100 text-gray-700 border-gray-200" },
  print: { label: "พิมพ์", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  tax_invoice: "ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  expense: "ค่าใช้จ่าย",
  purchase_invoice: "ใบซื้อ",
  purchase_order: "ใบสั่งซื้อ",
  journal_entry: "รายการบัญชี",
  quotation: "ใบเสนอราคา",
  sales_order: "ใบสั่งขาย",
  ecommerce_order: "ออเดอร์",
  product: "สินค้า",
  contact: "ผู้ติดต่อ",
  user: "ผู้ใช้",
};

const PAGE_SIZE = 50;

export default function ActivityLogPage() {
  const { selectedCompanyId } = useCompany();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);

  const queryParams = new URLSearchParams();
  queryParams.set("companyId", String(selectedCompanyId));
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(offset));
  if (entityTypeFilter && entityTypeFilter !== "all") queryParams.set("entityType", entityTypeFilter);
  if (actionFilter && actionFilter !== "all") queryParams.set("action", actionFilter);

  const { data, isLoading } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/activity-logs", selectedCompanyId, entityTypeFilter, actionFilter, offset],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const logs = data?.logs || [];
  const total = data?.total || 0;
  const hasMore = offset + PAGE_SIZE < total;

  function handleFilterChange(type: "entityType" | "action", value: string) {
    setOffset(0);
    if (type === "entityType") setEntityTypeFilter(value);
    else setActionFilter(value);
  }

  function handleExcel() {
    if (logs.length === 0) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const rows = logs.map((log: any) => {
      const actionInfo = ACTION_LABELS[log.action];
      const entityLabel = ENTITY_TYPE_LABELS[log.entityType] || log.entityType;
      return {
        "วันที่เวลา": log.createdAt ? formatDateTime(log.createdAt, dateEra, dateFmt) : "-",
        "ผู้ใช้": log.userName || "-",
        "การกระทำ": actionInfo ? actionInfo.label : log.action,
        "ประเภท": entityLabel,
        "รายการ": log.entityName || "-",
        "รายละเอียด": log.details || "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ActivityLog");
    XLSX.writeFile(wb, `บันทึกกิจกรรม_${dateStr}.xlsx`);
  }


  return (
    <Layout>
      <div className="space-y-4" data-testid="activity-log-page">
        <div className="flex items-center gap-3">
          <History className="h-7 w-7 text-[#fb9678]" />
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">บันทึกกิจกรรม</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรอง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="w-48">
                <Select value={entityTypeFilter} onValueChange={(v) => handleFilterChange("entityType", v)}>
                  <SelectTrigger data-testid="filter-entity-type">
                    <SelectValue placeholder="ประเภททั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ประเภททั้งหมด</SelectItem>
                    {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Select value={actionFilter} onValueChange={(v) => handleFilterChange("action", v)}>
                  <SelectTrigger data-testid="filter-action">
                    <SelectValue placeholder="การกระทำทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">การกระทำทั้งหมด</SelectItem>
                    {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="h-9 text-xs gap-1.5 text-white ml-auto"
                style={{ background: "#03c9d7" }}
                onClick={handleExcel}
                disabled={logs.length === 0}
                data-testid="button-excel"
              >
                <FileDown className="h-3.5 w-3.5" />
                Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[160px]">วันที่เวลา</TableHead>
                    <TableHead className="w-[140px]">ผู้ใช้</TableHead>
                    <TableHead className="w-[100px]">การกระทำ</TableHead>
                    <TableHead className="w-[140px]">ประเภท</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                        กำลังโหลด...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12" data-testid="empty-state">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <History className="h-10 w-10" />
                          <p className="text-base">ยังไม่มีบันทึกกิจกรรม</p>
                          <p className="text-sm">กิจกรรมต่างๆ จะปรากฏที่นี่เมื่อมีการใช้งานระบบ</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => {
                      const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700 border-gray-200" };
                      const entityLabel = ENTITY_TYPE_LABELS[log.entityType] || log.entityType;
                      const detail = [log.entityName, log.details].filter(Boolean).join(" - ");
                      return (
                        <TableRow key={log.id} data-testid={`activity-log-row-${log.id}`}>
                          <TableCell className="text-sm text-gray-600" data-testid={`log-datetime-${log.id}`}>
                            {log.createdAt ? formatDateTime(log.createdAt, dateEra, dateFmt) : "-"}
                          </TableCell>
                          <TableCell className="text-sm font-medium" data-testid={`log-user-${log.id}`}>
                            {log.userName || "-"}
                          </TableCell>
                          <TableCell data-testid={`log-action-${log.id}`}>
                            <Badge variant="outline" className={`text-xs ${actionInfo.color}`}>
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`log-entity-type-${log.id}`}>
                            {entityLabel}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600" data-testid={`log-detail-${log.id}`}>
                            {detail || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {logs.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-500" data-testid="log-count">
                  แสดง {Math.min(offset + PAGE_SIZE, total)} จาก {total} รายการ
                </p>
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                    data-testid="button-load-more"
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    โหลดเพิ่มเติม
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
