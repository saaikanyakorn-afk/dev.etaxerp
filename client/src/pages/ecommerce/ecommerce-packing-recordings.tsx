import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Clock, Camera, Loader2, Play, ChevronLeft, ChevronRight, Video, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";

export default function EcommercePackingRecordings() {
  const { selectedCompanyId } = useCompany();


  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cameraFilter, setCameraFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [viewRecording, setViewRecording] = useState<any>(null);

  const { data: cameras = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/packing/cameras", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/packing/cameras?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const queryParams = new URLSearchParams();
  queryParams.set("companyId", String(selectedCompanyId || ""));
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));
  if (search) queryParams.set("search", search);
  if (cameraFilter !== "all") queryParams.set("cameraId", cameraFilter);

  const { data, isLoading } = useQuery<{ recordings: any[]; total: number }>({
    queryKey: ["/api/ecommerce/packing/recordings", queryParams.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/packing/recordings?${queryParams.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const recordings = data?.recordings || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-packing-recordings">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">ประวัติวิดีโอการแพ็ค</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ค้นหาและดูวิดีโอการแพ็คสินค้าย้อนหลัง จากหมายเลขออเดอร์</p>
        </div>

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาจากหมายเลขออเดอร์..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                  className="pl-8 h-8 text-xs"
                  data-testid="input-search-recording"
                />
              </div>
              <Select value={cameraFilter} onValueChange={v => { setCameraFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-camera-filter">
                  <SelectValue placeholder="กล้องทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">กล้องทั้งหมด</SelectItem>
                  {cameras.map((cam: any) => (
                    <SelectItem key={cam.id} value={String(cam.id)}>{cam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 bg-[#539BFF] hover:bg-[#4488ee] text-white text-xs px-4" onClick={handleSearch} data-testid="button-search">
                ค้นหา
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="h-4 w-4 text-[#03c9d7]" />
              รายการบันทึก ({total.toLocaleString()} รายการ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : recordings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">ไม่พบรายการบันทึก</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-12">#</TableHead>
                      <TableHead className="text-xs">หมายเลขออเดอร์</TableHead>
                      <TableHead className="text-xs">กล้อง</TableHead>
                      <TableHead className="text-xs">ผู้แพ็ค</TableHead>
                      <TableHead className="text-xs">เวลาเริ่ม</TableHead>
                      <TableHead className="text-xs text-center">ระยะเวลา</TableHead>
                      <TableHead className="text-xs text-center">สถานะ</TableHead>
                      <TableHead className="text-xs text-center">ดู</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordings.map((rec: any, idx: number) => (
                      <TableRow key={rec.id} data-testid={`row-recording-${rec.id}`}>
                        <TableCell className="text-xs text-muted-foreground">{(page - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{rec.orderNo || "-"}</TableCell>
                        <TableCell className="text-xs">{rec.cameraName || "-"}</TableCell>
                        <TableCell className="text-xs">{rec.operatorName || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {rec.startedAt ? new Date(rec.startedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" }) : "-"}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {rec.duration ? (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">{formatDuration(rec.duration)}</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {rec.status === "completed" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">เสร็จสิ้น</Badge>
                          ) : rec.status === "recording" ? (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs animate-pulse">กำลังบันทึก</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs">{rec.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setViewRecording(rec)}
                            data-testid={`button-view-${rec.id}`}
                          >
                            <Eye className="h-3 w-3" />ดู
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>แสดง {recordings.length} จาก {total.toLocaleString()} รายการ</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="px-2">หน้า {page} / {totalPages}</span>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* View Recording Dialog */}
        <Dialog open={!!viewRecording} onOpenChange={() => setViewRecording(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-[#03c9d7]" />
                วิดีโอการแพ็ค - ออเดอร์ {viewRecording?.orderNo || "-"}
              </DialogTitle>
            </DialogHeader>
            {viewRecording && (
              <div className="space-y-4">
                {/* Video/Snapshot area */}
                <div className="bg-gray-900 aspect-video rounded-lg flex items-center justify-center relative overflow-hidden">
                  {viewRecording.snapshotPath ? (
                    <div className="text-center text-gray-400">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Snapshot บันทึกแล้ว</p>
                      <p className="text-xs mt-1 text-gray-500">เปิดดูวิดีโอเต็มได้จาก NVR</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">วิดีโอบันทึกใน NVR</p>
                      <p className="text-xs mt-1 text-gray-500">ใช้ข้อมูลด้านล่างค้นหาวิดีโอในระบบ NVR</p>
                    </div>
                  )}
                  {viewRecording.status === "completed" && (
                    <div className="absolute bottom-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                      เสร็จสิ้น
                    </div>
                  )}
                </div>

                {/* Recording Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">หมายเลขออเดอร์</p>
                    <p className="font-medium mt-0.5">{viewRecording.orderNo || "-"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">กล้อง</p>
                    <p className="font-medium mt-0.5">{viewRecording.cameraName || "-"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">เวลาเริ่ม</p>
                    <p className="font-medium mt-0.5">{viewRecording.startedAt ? new Date(viewRecording.startedAt).toLocaleString("th-TH") : "-"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">เวลาสิ้นสุด</p>
                    <p className="font-medium mt-0.5">{viewRecording.endedAt ? new Date(viewRecording.endedAt).toLocaleString("th-TH") : "-"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">ระยะเวลา</p>
                    <p className="font-medium mt-0.5">{viewRecording.duration ? formatDuration(viewRecording.duration) : "-"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">ผู้แพ็ค</p>
                    <p className="font-medium mt-0.5">{viewRecording.operatorName || "-"}</p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  <p className="font-medium">วิธีเปิดดูวิดีโอเต็มใน NVR:</p>
                  <p className="mt-1">1. เปิดระบบ NVR หรือ CMS ของกล้อง</p>
                  <p>2. ค้นหาวิดีโอจากกล้อง "{viewRecording.cameraName}" ช่วงเวลา {viewRecording.startedAt ? new Date(viewRecording.startedAt).toLocaleString("th-TH") : "-"}</p>
                  <p>3. ดูวิดีโอช่วงนั้นเพื่อตรวจสอบการแพ็ค</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
