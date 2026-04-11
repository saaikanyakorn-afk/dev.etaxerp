import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Play, AlertTriangle, CheckCircle, Package, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function BundleStockFix() {
  const [, navigate] = useLocation();
  const companyId = localStorage.getItem("selectedCompanyId");
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [executeResult, setExecuteResult] = useState<any>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bundle-fix/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: Number(companyId) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setSelectedIds(new Set(data.items.map((i: any) => i.movementId)));
      setExecuteResult(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bundle-fix/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(companyId),
          movementIds: [...selectedIds],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data) => {
      setExecuteResult(data);
      setPreviewData(null);
    },
  });

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (!previewData?.items) return;
    if (selectedIds.size === previewData.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previewData.items.map((i: any) => i.movementId)));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="btn-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">แก้ไขสต็อก Bundle ย้อนหลัง</h1>
          <p className="text-sm text-muted-foreground">ตรวจสอบและแก้ไขสต็อกที่ตัดผิดที่ตัว Bundle แทน Component</p>
        </div>
      </div>

      {executeResult && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-800" data-testid="text-success-title">แก้ไขสำเร็จ!</h3>
                <div className="mt-2 text-sm text-green-700 space-y-1">
                  <p>รายการที่แก้ไข: <strong>{executeResult.fixed}</strong> รายการ</p>
                  <p>Reverse movements: <strong>{executeResult.reversedMovements}</strong></p>
                  <p>Component movements ใหม่: <strong>{executeResult.newMovements}</strong></p>
                  <p>สินค้าที่อัพเดทสต็อก: <strong>{executeResult.productsUpdated}</strong> รายการ</p>
                  <p>GL ที่แก้ไข: <strong>{executeResult.glFixed}</strong> เอกสาร</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex-1 min-w-[300px]">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">เครื่องมือนี้จะ:</p>
                <ol className="list-decimal ml-4 text-amber-700 mt-1">
                  <li>คืนสต็อกที่ตัดผิดที่สินค้าจัดชุด (bundle)</li>
                  <li>ตัดสต็อกใหม่ที่สินค้าตัวเลือก (component) ทุกตัว</li>
                  <li>คำนวณสต็อกรวมใหม่ให้ถูกต้อง</li>
                  <li>ลบ Journal Entry เดิม + สร้างใหม่ให้ถูกต้อง</li>
                </ol>
              </div>
            </div>
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending || !companyId}
              className="bg-[#539BFF] hover:bg-[#4489e6]"
              data-testid="btn-preview"
            >
              <Search className="h-4 w-4 mr-2" />
              {previewMutation.isPending ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล (Preview)"}
            </Button>
          </div>
          {previewMutation.isError && (
            <p className="text-red-500 text-sm mt-2">{(previewMutation.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {previewData && (
        <>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">สรุปผลตรวจสอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-[#fb9678]" data-testid="text-total-movements">{previewData.summary.totalMovements}</p>
                  <p className="text-sm text-muted-foreground">รายการที่ต้องแก้ไข</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-[#03c9d7]" data-testid="text-total-bundles">{previewData.summary.totalBundleProducts}</p>
                  <p className="text-sm text-muted-foreground">สินค้าจัดชุด</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-[#05b187]" data-testid="text-total-docs">{previewData.summary.affectedDocuments}</p>
                  <p className="text-sm text-muted-foreground">เอกสารที่เกี่ยวข้อง</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {previewData.items.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium">ไม่พบรายการที่ต้องแก้ไข</p>
                <p className="text-sm text-muted-foreground mt-1">สต็อกทั้งหมดถูกต้องแล้ว</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">รายการที่ต้องแก้ไข ({previewData.items.length} รายการ)</CardTitle>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedIds.size === previewData.items.length}
                          onCheckedChange={toggleAll}
                          data-testid="checkbox-select-all"
                        />
                        เลือกทั้งหมด
                      </label>
                      <Badge variant="outline">{selectedIds.size} เลือกแล้ว</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {previewData.items.map((item: any) => (
                      <div
                        key={item.movementId}
                        className={`border rounded-lg p-3 ${selectedIds.has(item.movementId) ? "border-[#fb9678] bg-orange-50/50" : "border-gray-200"}`}
                        data-testid={`card-movement-${item.movementId}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedIds.has(item.movementId)}
                            onCheckedChange={() => toggleSelect(item.movementId)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Package className="h-4 w-4 text-[#fb9678]" />
                              <span className="font-medium text-sm">{item.bundleProductName}</span>
                              {item.bundleProductCode && <Badge variant="secondary" className="text-xs">{item.bundleProductCode}</Badge>}
                              <span className="text-sm text-red-600 font-medium">ตัดสต็อก: {item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {item.referenceNo && <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{item.referenceNo}</span>}
                              <span>{item.referenceType}</span>
                              {item.createdAt && <span>{new Date(item.createdAt).toLocaleDateString("th-TH")}</span>}
                            </div>
                            {item.components.length > 0 && (
                              <div className="mt-2 pl-4 border-l-2 border-[#03c9d7]">
                                <p className="text-xs font-medium text-[#03c9d7] mb-1">จะตัดสต็อกใหม่ที่:</p>
                                {item.components.map((comp: any, idx: number) => (
                                  <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                    <span>• {comp.componentProductName}</span>
                                    {comp.componentProductCode && <Badge variant="outline" className="text-[10px] h-4">{comp.componentProductCode}</Badge>}
                                    <span className="text-green-600 font-medium">x{comp.componentQty} = ตัด {comp.deductQty.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPreviewData(null)} data-testid="btn-cancel">
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => {
                    if (window.confirm(`ยืนยันแก้ไข ${selectedIds.size} รายการ? (สต็อก + GL จะถูกอัพเดท)`)) {
                      executeMutation.mutate();
                    }
                  }}
                  disabled={selectedIds.size === 0 || executeMutation.isPending}
                  className="bg-[#fb9678] hover:bg-[#e8856a]"
                  data-testid="btn-execute"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {executeMutation.isPending ? "กำลังแก้ไข..." : `แก้ไข ${selectedIds.size} รายการ`}
                </Button>
              </div>
              {executeMutation.isError && (
                <p className="text-red-500 text-sm mt-2 text-right">{(executeMutation.error as Error).message}</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
