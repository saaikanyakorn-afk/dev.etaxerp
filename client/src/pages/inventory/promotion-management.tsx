import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Tag } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type PromotionType = "buy_x_get_y" | "percentage" | "fixed_amount";
type PromotionStatus = "active" | "inactive" | "scheduled";
type Promotion = { id: number; companyId: number; name: string; description?: string; type: PromotionType; status: PromotionStatus; startDate?: string; endDate?: string; rules?: Record<string, any>[] };

const TYPE_LABELS: Record<PromotionType, string> = { buy_x_get_y: "ซื้อ X แถม Y", percentage: "ส่วนลด %", fixed_amount: "ส่วนลดคงที่" };
const STATUS_LABELS: Record<PromotionStatus, string> = { active: "ใช้งาน", inactive: "ปิดใช้งาน", scheduled: "ตั้งเวลา" };
const STATUS_COLORS: Record<PromotionStatus, string> = { active: "bg-[#e6f7f2] text-[#05b187]", inactive: "bg-gray-100 text-gray-700", scheduled: "bg-[#fffcf0] text-[#fec90f]" };

export default function PromotionManagement(props: { Wrapper?: React.ComponentType<{ children: React.ReactNode }>; basePath?: string } & Record<string, any>) {
  const LayoutComponent = props.Wrapper || Layout;
  const promoBasePath = props.basePath ? `${props.basePath}/promotions` : "/inventory/promotions";
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/promotions", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/promotions?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/promotions/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message || "เกิดข้อผิดพลาด");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: "ลบโปรโมชันสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  return (
    <LayoutComponent>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">จัดการโปรโมชัน</h1>
          </div>
          <Button onClick={() => navigate(`${promoBasePath}/new`)} data-testid="button-create-promotion"><Plus className="h-4 w-4 mr-1" />สร้างโปรโมชัน</Button>
        </div>

        <Card>
          <CardHeader className="pb-3"><h3 className="font-semibold text-lg" data-testid="text-promotion-count">โปรโมชันทั้งหมด ({promotions.length})</h3></CardHeader>
          <CardContent>
            {isLoading ? <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div> : promotions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">ยังไม่มีโปรโมชัน</div>
            ) : (
              <Table data-testid="table-promotions">
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันเริ่มต้น</TableHead>
                    <TableHead>วันสิ้นสุด</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map(p => (
                    <TableRow key={p.id} data-testid={`row-promotion-${p.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${p.id}`}>{p.name}</TableCell>
                      <TableCell data-testid={`text-type-${p.id}`}>{TYPE_LABELS[p.type]}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[p.status]} data-testid={`badge-status-${p.id}`}>{STATUS_LABELS[p.status]}</Badge></TableCell>
                      <TableCell data-testid={`text-start-${p.id}`}>{p.startDate || "-"}</TableCell>
                      <TableCell data-testid={`text-end-${p.id}`}>{p.endDate || "-"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`${promoBasePath}/edit/${p.id}`)} data-testid={`button-edit-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("ต้องการลบโปรโมชันนี้?")) deleteMutation.mutate(p.id); }} data-testid={`button-delete-${p.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutComponent>
  );
}