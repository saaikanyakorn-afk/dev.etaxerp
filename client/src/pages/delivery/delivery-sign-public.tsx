import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MapPin, Package, Truck, Camera, RotateCcw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function SignaturePad({ onSave, disabled }: { onSave: (dataUrl: string) => void; disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: any) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [disabled]);

  const draw = useCallback((e: any) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, disabled]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      setHasDrawn(false);
    }
  };

  const save = () => {
    if (!hasDrawn) return;
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">กรุณาเซ็นชื่อรับสินค้าในกรอบด้านล่าง</p>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none"
        style={{ maxHeight: "200px" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        data-testid="canvas-signature"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} disabled={disabled}>
          <RotateCcw className="h-4 w-4 mr-1" /> ล้าง
        </Button>
        <Button size="sm" onClick={save} disabled={!hasDrawn || disabled} style={{ background: "#05b187" }}>
          <CheckCircle className="h-4 w-4 mr-1" /> ยืนยันลายเซ็น
        </Button>
      </div>
    </div>
  );
}

export default function DeliverySignPublicPage() {
  const params = useParams<{ token: string }>();
  const { toast } = useToast();

  const [signedByName, setSignedByName] = useState("");
  const [deliveryRemarks, setDeliveryRemarks] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/public/delivery", params.token],
    queryFn: async () => {
      const r = await fetch(`/api/public/delivery/${params.token}`);
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    enabled: !!params.token,
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude); },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/public/delivery/${params.token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "เซ็นรับของสำเร็จ!" });
    },
    onError: (e: any) => toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!signatureDataUrl) return toast({ title: "กรุณาเซ็นชื่อก่อน", variant: "destructive" });
    submitMutation.mutate({
      signatureDataUrl,
      signedByName,
      deliveryRemarks,
      deliveryGpsLat: gpsLat,
      deliveryGpsLng: gpsLng,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-[#fb9678] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="p-6 text-center max-w-sm">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">{(error as any).message}</p>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "delivered" || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="p-8 text-center max-w-sm">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-bold text-green-700 mb-2">รับสินค้าเรียบร้อย!</h2>
          <p className="text-gray-500 text-sm">ใบส่งของเลขที่ {data.deliveryNo}</p>
          {(data.signedByName || signedByName) && (
            <p className="text-sm text-gray-400 mt-1">ผู้รับ: {data.signedByName || signedByName}</p>
          )}
          {(data.signatureDataUrl || signatureDataUrl) && (
            <img src={data.signatureDataUrl || signatureDataUrl!} alt="ลายเซ็น" className="max-h-20 mx-auto mt-3 border rounded p-1" />
          )}
          <p className="text-xs text-gray-400 mt-4">ขอบคุณที่ใช้บริการ {data.companyName}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "#fb9678" }}>
            <Truck className="h-5 w-5 text-white" />
            <span className="text-white font-semibold">ใบส่งของ</span>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-bold text-lg" style={{ color: "#fb9678" }}>{data.deliveryNo}</h2>
              <p className="text-xs text-gray-500">จาก: {data.companyName}</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700"><Truck className="h-3 w-3 mr-1" /> กำลังจัดส่ง</Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{data.customerName}</p>
                <p className="text-gray-500">{data.deliveryAddress}</p>
              </div>
            </div>
            {data.latitude && data.longitude && (
              <a href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-600">
                <MapPin className="h-3 w-3" /> เปิด Google Maps
              </a>
            )}
            {data.driverName && (
              <div className="flex items-center gap-2 text-gray-600">
                <Truck className="h-4 w-4 text-gray-400" />
                <span>คนส่ง: {data.driverName}</span>
              </div>
            )}
            {data.notes && <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">{data.notes}</p>}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> รายการสินค้า ({data.items?.length || 0} รายการ)</h3>
          <div className="space-y-1">
            {(data.items || []).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium">{item.productName}</span>
                  {item.productCode && <span className="text-xs text-gray-400 ml-1">({item.productCode})</span>}
                  {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                </div>
                <Badge variant="secondary">{item.qty} {item.unit}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: "#05b187" }} />
            เซ็นรับสินค้า
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">ชื่อผู้รับสินค้า</label>
              <Input value={signedByName} onChange={(e) => setSignedByName(e.target.value)}
                placeholder="ชื่อ-สกุล ผู้รับสินค้า" data-testid="input-signed-by" />
            </div>

            <SignaturePad onSave={(url) => setSignatureDataUrl(url)} disabled={submitMutation.isPending} />

            {signatureDataUrl && (
              <div className="text-center">
                <p className="text-xs text-green-600 mb-1">ลายเซ็นของคุณ:</p>
                <img src={signatureDataUrl} alt="ลายเซ็น" className="max-h-16 mx-auto border rounded" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">หมายเหตุ (ถ้ามี)</label>
              <Textarea value={deliveryRemarks} onChange={(e) => setDeliveryRemarks(e.target.value)}
                placeholder="เช่น ของครบ, ขาด 1 ชิ้น..." rows={2} data-testid="input-remarks" />
            </div>

            {gpsLat && gpsLng && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> GPS: {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}
              </p>
            )}

            <Button className="w-full" size="lg" onClick={handleSubmit}
              disabled={!signatureDataUrl || submitMutation.isPending}
              style={{ background: "#05b187" }} data-testid="btn-confirm-delivery">
              <Send className="h-5 w-5 mr-2" />
              {submitMutation.isPending ? "กำลังบันทึก..." : "ยืนยันรับสินค้า"}
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400">Powered by E-Tax Center</p>
      </div>
    </div>
  );
}
