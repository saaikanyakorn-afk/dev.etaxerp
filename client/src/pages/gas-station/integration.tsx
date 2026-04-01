import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import GasStationLayout from "@/components/gas-station-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Wifi, WifiOff, CheckCircle2, AlertCircle, Clock, Plug, Server, RefreshCw, FileText, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const POS_SYSTEMS = [
  { value: "manual", label: "บันทึกแบบ Manual", description: "ป้อนยอดขายด้วยมือจากมิเตอร์" },
  { value: "gilbarco", label: "Gilbarco Veeder-Root", description: "เชื่อมต่อผ่าน Passport POS / Insite360" },
  { value: "wayne", label: "Wayne (Dover Fueling)", description: "เชื่อมต่อผ่าน iX Pay / ProGauge" },
  { value: "tokheim", label: "Tokheim", description: "เชื่อมต่อผ่าน QuantiumTM" },
  { value: "tatsuno", label: "Tatsuno", description: "เชื่อมต่อผ่าน Tatsuno POS" },
  { value: "lanfeng", label: "Lanfeng / Censtar", description: "เชื่อมต่อระบบจีน (Censtar / Lanfeng)" },
  { value: "ptt_or", label: "PTT OR (Pump Connect)", description: "เชื่อมต่อผ่านระบบ PTT OR Pump Connect" },
  { value: "bangchak", label: "Bangchak iService", description: "เชื่อมต่อผ่านระบบ Bangchak iService" },
  { value: "custom_api", label: "API กำหนดเอง", description: "เชื่อมต่อผ่าน REST API / TCP Socket" },
];

export default function GasStationIntegration() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["/api/gas-station/integration-config", selectedCompanyId],
    queryFn: () => apiRequest("GET", `/api/gas-station/integration-config?companyId=${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  });

  const [selectedSystem, setSelectedSystem] = useState(config?.posSystem || "manual");
  const [apiUrl, setApiUrl] = useState(config?.apiUrl || "");
  const [apiKey, setApiKey] = useState(config?.apiKey || "");
  const [autoSync, setAutoSync] = useState(config?.autoSync ?? false);
  const [syncInterval, setSyncInterval] = useState(config?.syncIntervalMinutes?.toString() || "30");

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/gas-station/integration-config?companyId=${selectedCompanyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gas-station/integration-config"] });
      toast({ title: "บันทึกการตั้งค่าสำเร็จ" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    saveMutation.mutate({
      posSystem: selectedSystem,
      apiUrl,
      apiKey,
      autoSync,
      syncIntervalMinutes: Number(syncInterval) || 30,
    });
  };

  const isManual = selectedSystem === "manual";
  const systemInfo = POS_SYSTEMS.find(s => s.value === selectedSystem);

  return (
    <GasStationLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Plug className="h-7 w-7 text-[#05b187]" />
          เชื่อมต่อระบบปั๊มน้ำมัน
        </h1>
      </div>

      <Card data-testid="card-connection-status">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            สถานะการเชื่อมต่อ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-gray-50/50">
            {isManual ? (
              <>
                <div className="p-3 rounded-full bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">โหมด Manual</span>
                    <Badge variant="outline" className="text-blue-600 border-blue-300">Manual</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    กำลังใช้งานโหมดบันทึกด้วยมือ — ป้อนข้อมูลมิเตอร์เปิด/ปิดในหน้า "ยอดขายรายวัน"
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-full bg-amber-100">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{systemInfo?.label}</span>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">ยังไม่ได้เชื่อมต่อ</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    ตั้งค่าข้อมูลการเชื่อมต่อด้านล่าง แล้วกดทดสอบเพื่อเชื่อมต่อ
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-pos-system">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5" />
            เลือกระบบ POS ปั๊มน้ำมัน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {POS_SYSTEMS.map(sys => (
              <button
                key={sys.value}
                onClick={() => setSelectedSystem(sys.value)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  selectedSystem === sys.value
                    ? "border-[#05b187] bg-[#05b187]/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                data-testid={`btn-system-${sys.value}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {sys.value === "manual" ? (
                    <FileText className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Plug className="h-4 w-4 text-[#05b187]" />
                  )}
                  <span className="font-medium text-sm">{sys.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{sys.description}</p>
                {selectedSystem === sys.value && (
                  <div className="mt-2">
                    <Badge className="bg-[#05b187] text-white text-xs">เลือกอยู่</Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isManual && (
        <Card data-testid="card-connection-settings">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              ตั้งค่าการเชื่อมต่อ — {systemInfo?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API URL / IP Address</Label>
                <Input
                  placeholder="เช่น https://pos.example.com/api หรือ 192.168.1.100:8080"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  data-testid="input-api-url"
                />
                <p className="text-xs text-muted-foreground">URL หรือ IP ของระบบ POS ปั๊มน้ำมัน</p>
              </div>
              <div className="space-y-2">
                <Label>API Key / Token</Label>
                <Input
                  type="password"
                  placeholder="กรอก API Key หรือ Access Token"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  data-testid="input-api-key"
                />
                <p className="text-xs text-muted-foreground">รหัส API สำหรับยืนยันตัวตน</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">ดึงข้อมูลอัตโนมัติ</Label>
                <p className="text-sm text-muted-foreground">ดึงยอดขายจาก POS เข้าระบบโดยอัตโนมัติ</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} data-testid="switch-auto-sync" />
            </div>

            {autoSync && (
              <div className="space-y-2 pl-4 border-l-2 border-[#05b187]/30">
                <Label>ความถี่ในการดึงข้อมูล (นาที)</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger className="w-[200px]" data-testid="select-sync-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">ทุก 5 นาที</SelectItem>
                    <SelectItem value="15">ทุก 15 นาที</SelectItem>
                    <SelectItem value="30">ทุก 30 นาที</SelectItem>
                    <SelectItem value="60">ทุก 1 ชั่วโมง</SelectItem>
                    <SelectItem value="360">ทุก 6 ชั่วโมง</SelectItem>
                    <SelectItem value="1440">วันละครั้ง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="border-[#05b187] text-[#05b187]"
                data-testid="btn-test-connection"
                onClick={() => toast({ title: "ฟีเจอร์ทดสอบการเชื่อมต่อ", description: "อยู่ระหว่างการพัฒนา — กรุณาใช้โหมด Manual ไปก่อน" })}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                ทดสอบการเชื่อมต่อ
              </Button>
              <Button
                variant="outline"
                data-testid="btn-import-manual"
                onClick={() => toast({ title: "นำเข้าข้อมูลจาก POS", description: "อยู่ระหว่างการพัฒนา — กรุณาใช้โหมด Manual ไปก่อน" })}
              >
                <Upload className="h-4 w-4 mr-2" />
                นำเข้าข้อมูลครั้งเดียว
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isManual && (
        <Card data-testid="card-manual-guide">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              วิธีใช้งานโหมด Manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                <div className="w-7 h-7 rounded-full bg-[#05b187] text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
                <div>
                  <p className="font-medium text-sm">ตั้งค่าชนิดน้ำมัน ถัง และตู้จ่าย</p>
                  <p className="text-xs text-muted-foreground">ไปที่ ตั้งค่า → ชนิดน้ำมัน / ตู้จ่าย / ถัง เพื่อเพิ่มข้อมูลพื้นฐาน</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                <div className="w-7 h-7 rounded-full bg-[#05b187] text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
                <div>
                  <p className="font-medium text-sm">บันทึกยอดขายรายวัน</p>
                  <p className="text-xs text-muted-foreground">ไปที่ ยอดขาย → ยอดขายรายวัน แล้วป้อนมิเตอร์เปิด/ปิดของแต่ละหัวจ่ายและเลือกช่องทางชำระเงิน</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                <div className="w-7 h-7 rounded-full bg-[#05b187] text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
                <div>
                  <p className="font-medium text-sm">บันทึกการรับน้ำมันและจุ่มถัง</p>
                  <p className="text-xs text-muted-foreground">ไปที่ สต็อกน้ำมัน เพื่อบันทึกน้ำมันที่รับเข้าและผลการจุ่มถัง</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                <div className="w-7 h-7 rounded-full bg-[#05b187] text-white flex items-center justify-center text-sm font-bold shrink-0">4</div>
                <div>
                  <p className="font-medium text-sm">ดูรายงานและภาพรวม</p>
                  <p className="text-xs text-muted-foreground">ไปที่ ภาพรวม หรือ รายงาน เพื่อดูสรุปยอดขาย, สต็อก, Oil Loss/Gain</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-[#05b187] hover:bg-[#05b187]/90"
          data-testid="btn-save-integration"
        >
          บันทึกการตั้งค่า
        </Button>
      </div>
    </div>
    </GasStationLayout>
  );
}
