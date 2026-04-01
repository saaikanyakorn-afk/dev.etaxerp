import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, Copy, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Server } from "lucide-react";
import { notifyDbSwitch } from "@/components/dev-menu";

interface DbStatus {
  devMode: boolean;
  target: "usa" | "thailand";
  label: string;
  connected: boolean;
  dbName: string;
  dbHost: string;
  testDbConfigured: boolean;
  testDbOnline: boolean;
}

interface CloneProgress {
  status: string;
  percent: number;
  error?: string;
}

export default function DatabaseSwitch() {
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloning, setCloning] = useState(false);

  const { data: status, isError, refetch } = useQuery<DbStatus>({
    queryKey: ["/api/dev/db-status"],
    queryFn: async () => {
      const res = await fetch("/api/dev/db-status");
      if (!res.ok) throw new Error("Not available");
      return res.json();
    },
    retry: false,
    refetchInterval: 15000,
  });

  const { data: cloneStatus } = useQuery<CloneProgress>({
    queryKey: ["/api/dev/clone-progress"],
    queryFn: async () => {
      const res = await fetch("/api/dev/clone-progress");
      return res.json();
    },
    enabled: cloning,
    refetchInterval: cloning ? 2000 : false,
  });

  useEffect(() => {
    if (cloneStatus?.status === "complete" || cloneStatus?.status === "error") {
      setCloning(false);
    }
  }, [cloneStatus]);

  const handleSwitch = useCallback(async (target: "usa" | "thailand") => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/dev/switch-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (res.ok) {
        notifyDbSwitch();
        setTimeout(() => {
          window.location.href = "/landing";
        }, 1000);
      } else {
        alert(data.message || "ไม่สามารถสลับฐานข้อมูลได้");
        setSwitching(false);
      }
    } catch {
      setSwitching(false);
      alert("เกิดข้อผิดพลาดในการสลับฐานข้อมูล");
    }
  }, [switching]);

  const handleClone = useCallback(async () => {
    if (cloning) return;
    setCloning(true);
    setShowCloneDialog(false);
    try {
      await fetch("/api/dev/clone-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
      setCloning(false);
    }
  }, [cloning]);

  if (isError || !status?.devMode) {
    return (
      <PlatformLayout>
        <div>
          <Card>
            <CardContent className="p-12 text-center">
              <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600">ไม่สามารถใช้งานได้</h3>
              <p className="text-sm text-gray-400 mt-2">ฟีเจอร์นี้ใช้ได้เฉพาะในโหมด Development เท่านั้น</p>
            </CardContent>
          </Card>
        </div>
      </PlatformLayout>
    );
  }

  const isUsa = status.target === "usa";

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">สลับฐานข้อมูล</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการเชื่อมต่อฐานข้อมูลสำหรับการทดสอบ (Dev Mode เท่านั้น)</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className={`border-2 transition-all ${isUsa ? "border-blue-500 shadow-blue-100 shadow-lg" : "border-gray-200"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5 text-blue-600" />
                  USA (Primary)
                </CardTitle>
                {isUsa && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full" data-testid="badge-active-usa">
                    กำลังใช้งาน
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                <p>ฐานข้อมูลหลักบน Replit (DATABASE_URL)</p>
                {isUsa && status.dbName && (
                  <p className="text-xs text-gray-400 mt-1">Database: {status.dbName}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {(isUsa && status.connected) ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-700">เชื่อมต่อแล้ว</span>
                  </>
                ) : isUsa ? (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-700">ไม่สามารถเชื่อมต่อ</span>
                  </>
                ) : (
                  <span className="text-gray-400">ไม่ได้เลือกใช้งาน</span>
                )}
              </div>
              {!isUsa && (
                <Button
                  onClick={() => handleSwitch("usa")}
                  disabled={switching}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="btn-switch-usa"
                >
                  {switching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  สลับไปใช้ USA
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={`border-2 transition-all ${!isUsa ? "border-amber-500 shadow-amber-100 shadow-lg" : "border-gray-200"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5 text-amber-600" />
                  Thailand (Test)
                </CardTitle>
                {!isUsa && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full" data-testid="badge-active-th">
                    กำลังใช้งาน
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                {status.testDbConfigured ? (
                  <>
                    <p>ฐานข้อมูลทดสอบ (DATABASE_URL_TEST)</p>
                    {!isUsa && status.dbName && (
                      <p className="text-xs text-gray-400 mt-1">Database: {status.dbName}</p>
                    )}
                  </>
                ) : (
                  <p className="text-amber-600">DATABASE_URL_TEST ยังไม่ได้ตั้งค่า</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {!status.testDbConfigured ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-600">ยังไม่ได้กำหนดค่า</span>
                  </>
                ) : status.testDbOnline ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-700">ออนไลน์</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-700">ออฟไลน์</span>
                  </>
                )}
              </div>
              {isUsa && (
                <Button
                  onClick={() => handleSwitch("thailand")}
                  disabled={switching || !status.testDbConfigured || !status.testDbOnline}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  data-testid="btn-switch-thailand"
                >
                  {switching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  สลับไปใช้ Thailand
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Copy className="h-5 w-5 text-gray-600" />
              คัดลอกข้อมูล (Clone Database)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm font-semibold text-blue-700">USA</div>
                <div className="text-xs text-gray-400">ต้นทาง</div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <div className="text-center">
                <div className="text-sm font-semibold text-amber-700">Thailand</div>
                <div className="text-xs text-gray-400">ปลายทาง</div>
              </div>
            </div>

            {cloning && cloneStatus && (
              <div className="space-y-2" data-testid="clone-progress">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  <span>กำลังคัดลอก... {cloneStatus.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${cloneStatus.percent}%` }}
                  />
                </div>
              </div>
            )}

            {cloneStatus?.status === "complete" && !cloning && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" data-testid="clone-complete">
                <CheckCircle2 className="h-4 w-4" />
                คัดลอกข้อมูลสำเร็จ!
              </div>
            )}

            {cloneStatus?.status === "error" && !cloning && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="clone-error">
                <XCircle className="h-4 w-4" />
                คัดลอกผิดพลาด: {cloneStatus.error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowCloneDialog(true)}
                disabled={cloning || !status.testDbConfigured || !status.testDbOnline}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                data-testid="btn-clone-db"
              >
                <Copy className="h-4 w-4 mr-2" />
                เริ่มคัดลอก USA → Thailand
              </Button>
              <Button
                onClick={() => refetch()}
                variant="ghost"
                size="icon"
                title="รีเฟรชสถานะ"
                data-testid="btn-refresh-status"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">คำแนะนำ</h4>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>การสลับฐานข้อมูลจะทำให้ Session ทั้งหมดถูกยกเลิก ผู้ใช้ทุกคนต้อง Login ใหม่</li>
              <li>แถบแสดงตำแหน่งฐานข้อมูล (สีน้ำเงิน/ส้ม) จะปรากฏให้ผู้ใช้ทุกคนเห็น รวมถึงหน้า Landing Page</li>
              <li>ฐานข้อมูลทดสอบ Thailand (deep-main) เปิดใช้งาน 8:00-23:59 เวลาไทย</li>
              <li>การคัดลอกข้อมูลเป็นทิศทางเดียว: USA → Thailand เท่านั้น</li>
              <li>ทุกฟีเจอร์ในหน้านี้จะไม่ปรากฏในโหมด Production</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {switching && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" data-testid="switching-overlay">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#fb9678]" />
            <p className="text-lg font-semibold text-gray-800">กำลังสลับฐานข้อมูล...</p>
            <p className="text-sm text-gray-500 text-center">ระบบกำลังเปลี่ยนการเชื่อมต่อ กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {showCloneDialog && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center" data-testid="clone-dialog">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">คัดลอกข้อมูล USA → Thailand</h3>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600">
                ระบบจะคัดลอกข้อมูล <strong>ทั้งหมด</strong> จากฐานข้อมูลหลัก <strong>(USA)</strong> ไปยังฐานข้อมูลทดสอบ <strong>(Thailand)</strong>
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">ข้อมูลเดิมทั้งหมดใน Thailand จะถูกลบและแทนที่</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700 font-medium">การคัดลอกเป็นทิศทางเดียว ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCloneDialog(false)}
                className="flex-1"
                data-testid="btn-clone-cancel"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleClone}
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                data-testid="btn-clone-confirm"
              >
                <Copy className="h-4 w-4 mr-2" />
                เริ่มคัดลอก
              </Button>
            </div>
          </div>
        </div>
      )}
    </PlatformLayout>
  );
}
