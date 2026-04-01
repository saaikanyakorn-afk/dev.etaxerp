import { useRef, useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, PenTool, RotateCcw, FileText, AlertCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

function formatBEDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height: 200 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          data-testid="canvas-signature"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm">เซ็นชื่อที่นี่ (ใช้เมาส์หรือนิ้ววาด)</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="gap-1" data-testid="button-clear-sig">
          <RotateCcw className="w-3.5 h-3.5" /> ล้าง
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={!hasDrawn}
          className="bg-[#05b187] hover:bg-[#049a75] text-white gap-1 ml-auto"
          data-testid="button-confirm-sig"
        >
          <PenTool className="w-3.5 h-3.5" /> ยืนยันลายเซ็น
        </Button>
      </div>
    </div>
  );
}

export default function ContractSignPage() {
  const [, params] = useRoute("/sign/:token");
  const token = params?.token || "";
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signed, setSigned] = useState(false);

  const { data: contract, isLoading, error } = useQuery<any>({
    queryKey: ["/api/public/contracts", token],
    queryFn: async () => {
      const r = await fetch(`/api/public/contracts/${token}`);
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "ไม่พบสัญญา");
      }
      return r.json();
    },
    enabled: !!token,
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/public/contracts/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl, signerName, signerPosition }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "ลงนามไม่สำเร็จ");
      }
      return r.json();
    },
    onSuccess: () => {
      setSigned(true);
    },
  });

  const handleSignatureCapture = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  };

  const handleSubmit = () => {
    if (!signerName.trim()) return;
    if (!signatureDataUrl) return;
    signMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#fb9678]" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-xl shadow-lg border-0">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-[#f94d4d] mx-auto" />
            <h2 className="text-lg font-bold text-gray-800">ไม่สามารถเปิดสัญญาได้</h2>
            <p className="text-sm text-gray-500">{(error as any)?.message || "ลิงก์สัญญาไม่ถูกต้องหรือหมดอายุ"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-xl shadow-lg border-0">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-[#05b187]/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#05b187]" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">ลงนามสัญญาเรียบร้อยแล้ว</h2>
            <p className="text-sm text-gray-500">ขอบคุณที่ลงนามในสัญญา สำนักงานบัญชีจะได้รับแจ้งโดยอัตโนมัติ</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <div className="text-white py-4 px-6 shadow-sm" style={{ background: "var(--theme-primary)" }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <div>
            <h1 className="text-lg font-bold">ลงนามสัญญาออนไลน์</h1>
            <p className="text-sm opacity-80">เลขที่ {contract.contractNo}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">{contract.title}</h2>
              <p className="text-sm text-gray-500 mt-1">เลขที่ {contract.contractNo}</p>
            </div>

            <div className="space-y-4 text-sm leading-relaxed">
              <p className="indent-8">
                สัญญาบริการฉบับนี้ทำขึ้นเมื่อวันที่ {formatBEDate(contract.contractStartDate)} ที่สำนักงาน{contract.clientName} ระหว่าง{" "}
                <strong>{contract.clientName}</strong>{" "}
                {contract.clientTaxId && <>เลขทะเบียนนิติบุคคลเลขที่ {contract.clientTaxId}</>}{" "}
                สำนักงานตั้งอยู่เลขที่ {contract.clientAddress}{" "}
                โดย<strong>{contract.clientRepName}</strong> กรรมการผู้มีอำนาจกระทำการแทนบริษัท ซึ่งต่อไปในสัญญาฉบับนี้เรียกว่า <strong>"ผู้รับบริการ"</strong> ฝ่ายหนึ่ง
              </p>
              <p className="indent-8">
                กับ <strong>{contract.firmName}</strong>{" "}
                {contract.firmTaxId && <>เลขทะเบียนนิติบุคคลเลขที่ {contract.firmTaxId}</>}{" "}
                สำนักงานตั้งอยู่เลขที่ {contract.firmAddress}{" "}
                โดย<strong>{contract.firmRepName}</strong> กรรมการผู้มีอำนาจกระทำการแทนบริษัท ซึ่งต่อไปในสัญญาฉบับนี้เรียกว่า <strong>"ผู้ให้บริการ"</strong> อีกฝ่ายหนึ่ง
              </p>

              <p className="indent-8">โดยที่ ผู้ให้บริการเป็นผู้ให้บริการด้านกิจกรรมการบัญชี การทำบัญชี และที่ปรึกษาด้านภาษี โดยที่ผู้รับบริการได้ตกลงจะรับบริการดังกล่าวจากผู้ให้บริการ และผู้ให้บริการได้ตกลงจะจัดหาบริการดังกล่าวให้แก่ผู้รับบริการ</p>
              <p className="indent-8">คู่สัญญาทั้งสองฝ่ายจึงตกลงทำสัญญาฉบับนี้ โดยมีข้อความดังต่อไปนี้</p>

              <div className="space-y-4">
                <div>
                  <p className="font-bold">ข้อ 1. ขอบเขตการให้บริการ</p>
                  <p className="indent-8">ผู้ให้บริการตกลงจะให้บริการบัญชีและคำแนะนำทางด้านบัญชี โดยมีขอบเขตและรายละเอียดการให้บริการดังต่อไปนี้</p>
                  {contract.serviceScope ? (
                    <div className="indent-8 whitespace-pre-wrap">{contract.serviceScope}</div>
                  ) : (
                    <ol className="list-decimal pl-16 space-y-1">
                      <li>ให้คำปรึกษาเกี่ยวกับการวางแผนภาษีของผู้รับบริการ</li>
                      <li>บันทึกบัญชีรายเดือน และยื่นภาษีรายเดือน (ภงด.1, ภงด.3, ภงด.53, ภพ.30)</li>
                      <li>จัดทำเงินเดือนพนักงาน และยื่นแบบประกันสังคมพนักงาน (สปส.10-1)</li>
                      <li>ปิดบัญชีประจำปี ยื่นแบบบัญชีรายชื่อผู้ถือหุ้น (บ.อ.จ. 5) แบบ สบช.3 พร้อมนำส่งงบการเงินประจำปีต่อกรมพัฒนาธุรกิจการค้า</li>
                      <li>ยื่นภาษีเงินได้นิติบุคคล ภงด.50, ภงด.51 และ ภงด.1 ก</li>
                      <li>บริหารภาษีและยื่นแบบภาษีบุคคลธรรมดา ภงด.94 และ ภงด.90 (สำหรับผู้บริหาร)</li>
                      <li>จัดทำรายละเอียดประกอบงบการเงินที่สำคัญ เช่น ทะเบียนสินทรัพย์ รายละเอียดลูกหนี้ รายละเอียดเจ้าหนี้ เป็นต้น</li>
                      <li>รายงานงบประมาณที่สำคัญกับผู้บริหาร เพื่อช่วยการบริหารต้นทุน</li>
                      <li>ติดต่อประสานงานกับพนักงานของบริษัท ผู้รวบรวมเอกสารที่เกี่ยวข้องกับการบันทึกบัญชีเพื่อให้การทำงานราบรื่น</li>
                    </ol>
                  )}
                </div>

                <div>
                  <p className="font-bold">ข้อ 2. ความรับผิดชอบของผู้บริหาร</p>
                  <p className="indent-8">ผู้บริหารมีหน้าที่ความรับผิดชอบหลักตามกฎหมาย (พ.ร.บ. บัญชี พ.ศ. 2543) ในการจัดให้มีการทำบัญชี จัดทำงบการเงินให้ถูกต้องตามมาตรฐานการรายงานทางการเงิน การควบคุมภายในที่เพียงพอ และการนำส่งงบการเงินภายในเวลาที่กำหนด</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 3. ความรับผิดชอบของผู้ทำบัญชี</p>
                  <p className="indent-8">ความรับผิดชอบหลักของผู้ทำบัญชี คือการจัดทำบัญชีให้ถูกต้อง ครบถ้วน ตามมาตรฐานการบัญชีและกฎหมายที่เกี่ยวข้อง (พ.ร.บ. บัญชี 2543)</p>
                  <ul className="list-disc pl-16 space-y-1">
                    <li>รวบรวมและตรวจสอบเอกสารการค้าทั้งหมด</li>
                    <li>บันทึกบัญชีสมุดรายวันทั้ง 5 เล่ม (สมุดรายวันซื้อ, ขาย, จ่าย, รับ, ทั่วไป)</li>
                    <li>จัดทำงบแยกประเภท, งบทดลอง และงบการเงิน</li>
                    <li>ตรวจสอบและคำนวณภาษีมูลค่าเพิ่ม (VAT), ภาษีหัก ณ ที่จ่าย (ภ.ง.ด. 1, 3, 53) และภาษีเงินได้นิติบุคคล</li>
                    <li>ประสานงานกับผู้สอบบัญชี</li>
                  </ul>
                </div>

                <div>
                  <p className="font-bold">ข้อ 4. ข้อจำกัดความรับผิด</p>
                  <p className="indent-8">4.1 ในกรณีที่ผู้ให้บริการกระทำผิดสัญญา หรือกระทำโดยประมาทเลินเล่อในการให้บริการตามสัญญาฉบับนี้ อันเป็นเหตุให้ผู้รับบริการได้รับความเสียหาย ผู้ให้บริการตกลงรับผิดชดใช้ค่าเสียหายเท่าที่เกิดขึ้นจริงและเป็นความเสียหายโดยตรงจากการให้บริการดังกล่าว</p>
                  <p className="indent-8 mt-1">4.2 ความรับผิดของผู้ให้บริการตามสัญญาฉบับนี้ ให้จำกัดอยู่ไม่เกินจำนวนค่าบริการที่ผู้รับบริการได้ชำระให้แก่ผู้ให้บริการเป็นระยะเวลา 3 (สาม) เดือน นับถึงวันที่เกิดเหตุแห่งความเสียหาย</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 5. ค่าธรรมเนียมวิชาชีพ</p>
                  <p className="indent-8">
                    ผู้รับบริการตกลงจะชำระค่าบริการให้แก่ผู้ให้บริการ โดยรายละเอียดดังต่อไปนี้ ชำระเต็มจำนวน{" "}
                    <strong>{Number(contract.serviceFee || 0).toLocaleString()} บาท</strong> ต่อเดือน{" "}
                    ราคาอ้างอิงใบเสนอราคาที่ผู้ให้บริการเสนอ และผู้รับบริการตกลง ซึ่งค่าบริการตามสัญญาฉบับนี้เป็นค่าบริการที่ยังไม่รวมภาษีมูลค่าเพิ่ม
                  </p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 6. ระยะเวลาและการชำระค่าบริการ</p>
                  <p className="indent-8">
                    ผู้รับบริการตกลงจะชำระค่าบริการให้แก่ผู้ให้บริการ ภายในระยะเวลาที่กำหนด ภายในวันสิ้นเดือนของทุกเดือน{" "}
                    {contract.paymentTerms && <>({contract.paymentTerms})</>}{" "}
                    หากผู้รับบริการผิดนัดไม่ชำระค่าบริการให้กับผู้ให้บริการตามกำหนดแล้ว ผู้ให้บริการมีสิทธิเรียกดอกเบี้ยในอัตราร้อยละ 7.5 (เจ็ดครึ่ง) ต่อปีของค่าบริการที่ค้างชำระ จนกว่าผู้รับบริการจะชำระเสร็จ
                  </p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 7. การเปลี่ยนแปลงค่าบริการ</p>
                  <p className="indent-8">คู่สัญญาเข้าใจและยอมรับว่าต้นทุนในการให้บริการอาจรับผลกระทบจากปัจจัยต่างๆ อย่างไรก็ดี ผู้ให้บริการตกลงจะไม่เปลี่ยนแปลงอัตราค่าบริการตลอดระยะเวลาสัญญาฉบับนี้ เว้นแต่จะได้รับความยินยอมจากผู้รับบริการเป็นลายลักษณ์อักษร</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 8. ระยะเวลาการให้บริการ</p>
                  <p className="indent-8">
                    ผู้รับบริการตกลงว่าจ้างผู้ให้บริการตามเงื่อนไขที่ระบุในสัญญาฉบับนี้ ตั้งแต่วันที่ {formatBEDate(contract.contractStartDate)} ถึงวันที่ {formatBEDate(contract.contractEndDate)}{" "}
                    หากครบกำหนดแล้ว ผู้ให้บริการยังคงให้บริการต่อเนื่อง โดยผู้รับบริการยินยอมและไม่ได้บอกเลิกสัญญา ให้ถือว่าผู้รับบริการยังตกลงจ้างและรับบริการต่อไป จนกว่าคู่สัญญาฝ่ายใดฝ่ายหนึ่งจะบอกเลิกสัญญา โดยการบอกเลิกสัญญาเป็นลายลักษณ์อักษรให้อีกฝ่ายหนึ่งทราบล่วงหน้าไม่น้อยกว่า 90 วัน
                  </p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 9. การรักษาความลับ</p>
                  <p className="indent-8">ในการให้บริการผู้ให้บริการอาจได้ล่วงรู้ หรือได้รับข้อมูลจากผู้รับบริการหรือจากบุคคลอื่นใดเพื่อให้บริการตามสัญญาฉบับนี้ ผู้ให้บริการตกลงจะรักษาข้อมูลของผู้รับบริการไว้เป็นความลับ และจะไม่เปิดเผยต่อบุคคลที่สาม เว้นแต่จะเป็นการกระทำตามกฎหมายหรือได้รับความยินยอมเป็นลายลักษณ์อักษรจากผู้รับบริการก่อนล่วงหน้า</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 10. การสิ้นสุดสัญญา</p>
                  <p className="indent-8">สัญญาฉบับนี้จะถือว่าสิ้นสุดลงในกรณีหนึ่ง กรณีใด ดังต่อไปนี้</p>
                  <p className="indent-8 mt-1">10.1 ผู้รับบริการได้แจ้งลายลักษณ์อักษรให้ผู้ให้บริการทราบถึงความประสงค์ที่จะเลิกสัญญาก่อนกำหนดล่วงหน้าเป็นเวลาอย่างน้อย 90 วัน</p>
                  <p className="indent-8 mt-1">10.2 ในกรณีที่คู่สัญญาฝ่ายหนึ่งฝ่ายใดทำผิดสัญญาข้อหนึ่งข้อใดในสาระสำคัญ</p>
                  <p className="indent-8 mt-1">10.3 ในกรณีที่คู่สัญญาฝ่ายหนึ่งฝ่ายใดถูกศาลสั่งพิทักษ์เด็ดขาดหรือเป็นบุคคลล้มละลาย</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 11. ความสัมพันธ์ของคู่สัญญา</p>
                  <p className="indent-8">ผู้ให้บริการและผู้รับบริการต่างเข้าใจดีว่าการให้บริการตามสัญญาฉบับนี้มุ่งเน้นที่ผลสำเร็จของการให้บริการเป็นสำคัญ สัญญาฉบับนี้ไม่ได้ก่อให้เกิดความสัมพันธ์ในฐานะนายจ้าง-ลูกจ้าง ระหว่างคู่สัญญาทั้งสองฝ่าย</p>
                </div>

                <div>
                  <p className="font-bold">ข้อ 12. กฎหมายที่ใช้บังคับ</p>
                  <p className="indent-8">สัญญาฉบับนี้ให้ใช้บังคับตามกฎหมายไทย</p>
                </div>

                {contract.additionalTerms && (
                  <div>
                    <p className="font-bold">ข้อ 13. เงื่อนไขเพิ่มเติม</p>
                    <p className="indent-8 whitespace-pre-wrap">{contract.additionalTerms}</p>
                  </div>
                )}
              </div>

              <p className="indent-8 mt-6">
                สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว
                จึงลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน
              </p>

              <div className="grid grid-cols-2 gap-8 mt-8 pt-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">ลงชื่อ ผู้ให้บริการ</p>
                  {contract.firmSignatureDataUrl ? (
                    <img src={contract.firmSignatureDataUrl} alt="ลายเซ็นผู้ให้บริการ" className="h-16 mx-auto" />
                  ) : (
                    <div className="border-b border-dotted border-gray-400 w-48 mx-auto mt-8" />
                  )}
                  <p className="text-sm">({contract.firmRepName})</p>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">ลงชื่อ ผู้รับบริการ</p>
                  <div className="border-b border-dotted border-gray-400 w-48 mx-auto mt-8" />
                  <p className="text-sm">({contract.clientRepName})</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-sm border-t-4 border-t-[#05b187]">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#05b187]" /> ลงนามสัญญา
            </h3>
            <p className="text-sm text-gray-500">กรุณากรอกชื่อ ตำแหน่ง และเซ็นชื่อด้านล่างเพื่อลงนามในสัญญา</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">ชื่อผู้ลงนาม *</Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  data-testid="input-signer-name"
                />
              </div>
              <div>
                <Label className="text-sm">ตำแหน่ง</Label>
                <Input
                  value={signerPosition}
                  onChange={(e) => setSignerPosition(e.target.value)}
                  placeholder="เช่น กรรมการผู้จัดการ"
                  data-testid="input-signer-position"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">ลายเซ็น *</Label>
              <SignaturePad onSave={handleSignatureCapture} />
              {signatureDataUrl && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#05b187]" />
                  <span className="text-sm text-[#05b187]">บันทึกลายเซ็นแล้ว</span>
                  <img src={signatureDataUrl} alt="preview" className="h-8 ml-auto border rounded" />
                </div>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!signerName.trim() || !signatureDataUrl || signMutation.isPending}
              className="w-full bg-[#05b187] hover:bg-[#049a75] text-white text-base py-6 gap-2"
              data-testid="button-submit-sign"
            >
              {signMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PenTool className="w-5 h-5" />
              )}
              ลงนามสัญญา
            </Button>
            {signMutation.isError && (
              <p className="text-sm text-[#f94d4d] text-center">{(signMutation.error as any)?.message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}