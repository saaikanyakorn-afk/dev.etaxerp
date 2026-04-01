import HRLayout from "@/components/hr-layout";
import { objectPathToUrl } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useHrCompanyId } from "@/lib/company-context";

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y) }));
}

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAlways(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToThaiWords(n: number): string {
  if (n === 0) return "ศูนย์บาทถ้วน";
  const units = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);
  function convert(num: number): string {
    if (num === 0) return "";
    const s = String(num);
    let result = "";
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(s[i]);
      const pos = len - i - 1;
      if (digit === 0) continue;
      if (pos === 1 && digit === 1) { result += "สิบ"; continue; }
      if (pos === 1 && digit === 2) { result += "ยี่สิบ"; continue; }
      if (pos === 0 && digit === 1 && len > 1) { result += "เอ็ด"; continue; }
      result += units[digit] + positions[pos];
    }
    return result;
  }
  let result = convert(intPart) + "บาท";
  if (decPart > 0) {
    result += convert(decPart) + "สตางค์";
  } else {
    result += "ถ้วน";
  }
  return result;
}

function TaxIdBoxes({ taxId }: { taxId: string }) {
  const digits = (taxId || "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groups = [
    [digits[0]],
    [digits[1], digits[2], digits[3], digits[4]],
    [digits[5], digits[6], digits[7], digits[8], digits[9]],
    [digits[10], digits[11]],
    [digits[12]],
  ];
  return (
    <div className="flex items-center gap-0">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center">
          {gi > 0 && <span className="mx-[2px] text-[9px] font-bold">-</span>}
          {group.map((d, di) => (
            <div key={di} style={{ width: "16px", height: "18px", border: "1px solid black", textAlign: "center", fontSize: "11px", lineHeight: "18px", fontWeight: 500 }}>
              {d.trim()}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function CB({ checked }: { checked: boolean }) {
  return (
    <span style={{ display: "inline-block", width: "12px", height: "12px", border: "1px solid black", textAlign: "center", lineHeight: "12px", fontSize: "10px", fontWeight: "bold", verticalAlign: "middle", marginRight: "2px" }}>
      {checked ? "✓" : "\u00A0"}
    </span>
  );
}

const S = {
  page: { width: "210mm", minHeight: "297mm", fontFamily: "'Sarabun', sans-serif", fontSize: "11px", padding: "8mm 10mm", lineHeight: 1.4, background: "white", color: "black", position: "relative" as const, boxSizing: "border-box" as const },
  section: { border: "1px solid black", padding: "4px 6px", marginBottom: "3px" },
  dotline: { borderBottom: "1px dotted black", display: "inline", paddingLeft: "2px", paddingRight: "2px" },
};

function FiftyTawiA4({ company, employee, annualEarnings, annualTax, yearBE, logoUrl, ssoAmount }: {
  company: any; employee: any; annualEarnings: number; annualTax: number; yearBE: number; logoUrl?: string; ssoAmount?: number;
}) {
  const todayParts = (() => {
    const d = new Date();
    const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return { day: String(d.getDate()), month: thaiMonths[d.getMonth()], year: String(d.getFullYear() + 543) };
  })();

  const tdL = "border border-black p-[2px] pl-[4px] text-left";
  const tdC = "border border-black p-[2px] text-center";
  const tdR = "border border-black p-[2px] pr-[4px] text-right";

  return (
    <div style={S.page} className="fifty-tawi-page">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          body { background: white !important; }
          .fifty-tawi-page { width: 100% !important; min-height: auto !important; padding: 4mm 6mm !important; border: none !important; }
        }
      `}</style>

      {logoUrl && (
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <img src={logoUrl} alt="Company Logo" style={{ maxHeight: "50px", objectFit: "contain" }} />
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: "2px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
        <div style={{ fontSize: "12px" }}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", fontSize: "11px", marginBottom: "4px" }}>
        <span>เล่มที่ <span style={{ ...S.dotline, minWidth: "50px" }}></span></span>
        <span>เลขที่ <span style={{ ...S.dotline, minWidth: "70px", fontWeight: 600 }}></span></span>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxes taxId={company?.taxId || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...S.dotline, minWidth: "250px" }}>{company?.name || ""}</span> <span style={{ fontSize: "9px", color: "#666" }}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
        <div>สาขา <span style={{ ...S.dotline, minWidth: "200px" }}>{company?.branch || "สำนักงานใหญ่"}</span></div>
        <div>ที่อยู่ <span style={{ ...S.dotline, minWidth: "500px" }}>{company?.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้ถูกหักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxes taxId={employee?.taxId || employee?.idCardNumber || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...S.dotline, minWidth: "250px" }}>{employee?.fullName || ""}</span> <span style={{ fontSize: "9px", color: "#666" }}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
        <div>สาขา <span style={{ ...S.dotline, minWidth: "200px" }}></span></div>
        <div>ที่อยู่ <span style={{ ...S.dotline, minWidth: "500px" }}>{employee?.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>

      <div style={{ ...S.section, display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
            <b>ลำดับที่</b>
            <span style={{ ...S.dotline, display: "inline-block", width: "50px", textAlign: "center" }}></span>
            <b>ในแบบ</b>
          </div>
          <div style={{ fontSize: "9px", color: "#666" }}>
            (ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่าง<br/>ลำดับที่ตามหนังสือรับรองฯ กับแบบยื่น<br/>รายการภาษีหัก ณ ที่จ่าย)
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "4px 16px", alignItems: "center" }}>
          <span><CB checked={true} /> ภ.ง.ด.1</span>
          <span><CB checked={false} /> ภ.ง.ด.1ก</span>
          <span><CB checked={false} /> ภ.ง.ด.1ก พิเศษ</span>
          <span><CB checked={false} /> ภ.ง.ด.2</span>
          <span><CB checked={false} /> ภ.ง.ด.3</span>
          <span><CB checked={false} /> ภ.ง.ด.2ก</span>
          <span><CB checked={false} /> ภ.ง.ด.3ก</span>
          <span><CB checked={false} /> ภ.ง.ด.53</span>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", marginBottom: "3px" }}>
        <thead>
          <tr>
            <th className={tdL} style={{ width: "54%" }}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className={tdC} style={{ width: "14%" }}>วัน เดือน<br/>หรือปีภาษี ที่จ่าย</th>
            <th className={tdC} style={{ width: "16%" }}>จำนวนเงินที่จ่าย</th>
            <th className={tdC} style={{ width: "16%" }}>ภาษีที่หัก<br/>และนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdL}>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
            <td className={tdC}>{(employee?.incomeType || "1") === "1" ? yearBE : ""}</td>
            <td className={tdR}>{(employee?.incomeType || "1") === "1" ? fmt(annualEarnings) : ""}</td>
            <td className={tdR}>{(employee?.incomeType || "1") === "1" ? fmt(annualTax) : ""}</td>
          </tr>
          <tr>
            <td className={tdL}>2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</td>
            <td className={tdC}>{(employee?.incomeType) === "2" ? yearBE : ""}</td>
            <td className={tdR}>{(employee?.incomeType) === "2" ? fmt(annualEarnings) : ""}</td>
            <td className={tdR}>{(employee?.incomeType) === "2" ? fmt(annualTax) : ""}</td>
          </tr>
          <tr>
            <td className={tdL}>3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL}>4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ paddingLeft: "12px" }}>(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} colSpan={4} style={{ fontSize: "10px", paddingLeft: "20px" }}>
              <div>(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้</div>
            </td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(1.4) อัตราอื่นๆ (ระบุ) .................. ของกำไรสุทธิ</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} colSpan={4} style={{ fontSize: "10px", paddingLeft: "20px" }}>
              <div>(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก</div>
            </td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี ก่อนรอบระยะเวลาบัญชีปีปัจจุบัน</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL} style={{ fontSize: "10px", paddingLeft: "40px" }}>(2.5) อื่นๆ (ระบุ) ......................................................</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL}>
              <div>5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา</div>
              <div style={{ paddingLeft: "12px", fontSize: "10px" }}>3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ</div>
            </td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr>
            <td className={tdL}>6. อื่นๆ (ระบุ) ...........................................................</td>
            <td className={tdC}></td><td className={tdR}></td><td className={tdR}></td>
          </tr>
          <tr style={{ fontWeight: "bold" }}>
            <td className={tdR} colSpan={2}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
            <td className={tdR}>{fmt(annualEarnings)}</td>
            <td className={tdR}>{fmt(annualTax)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: "11px", marginBottom: "2px" }}>
        <b>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</b>
        <span style={{ ...S.dotline, minWidth: "320px", marginLeft: "4px", fontWeight: 600 }}>
          {numberToThaiWords(annualTax)}
        </span>
      </div>

      <div style={{ fontSize: "10px", marginBottom: "3px" }}>
        เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
        {" "}กองทุนประกันสังคม <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}>{ssoAmount ? fmtAlways(ssoAmount) : ""}</span> บาท
        {" "}กองทุนสำรองเลี้ยงชีพ <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
      </div>

      <div style={{ ...S.section, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", fontSize: "11px" }}>
        <b>ผู้จ่ายเงิน</b>
        <span><CB checked={true} /> (1) หัก ณ ที่จ่าย</span>
        <span><CB checked={false} /> (2) ออกให้ตลอดไป</span>
        <span><CB checked={false} /> (3) ออกให้ครั้งเดียว</span>
        <span><CB checked={false} /> (4) อื่นๆ (ระบุ) ..................</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "10px", marginTop: "4px" }}>
        <div style={{ ...S.section, width: "44%", fontSize: "10px" }}>
          <b>คำเตือน</b>
          <div>ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div>
        </div>
        <div style={{ width: "52%", textAlign: "center", fontSize: "11px" }}>
          <div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "right", whiteSpace: "nowrap", paddingRight: "4px", border: "none" }}>ลงชื่อ</td>
                <td style={{ textAlign: "center", width: "170px", borderBottom: "1px dotted black", border: "none" }}>
                  <span style={{ display: "inline-block", width: "100%" }}>&nbsp;</span>
                </td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "4px", border: "none" }}>ผู้จ่ายเงิน</td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "8px", fontSize: "10px", border: "none" }}>ประทับตรา</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", border: "none", paddingTop: "4px" }}>
                  <span style={{ ...S.dotline, minWidth: "140px" }}>{company?.name || ""}</span>
                </td>
              </tr>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", border: "none", paddingTop: "4px", fontSize: "10px" }}>
                  วันที่ <span style={S.dotline}>{todayParts.day}</span> เดือน <span style={S.dotline}>{todayParts.month}</span> พ.ศ. <span style={S.dotline}>{todayParts.year}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function generateA4Html(company: any, employee: any, data: { totalEarnings: number; totalTax: number; totalSso?: number }, yearBE: number, logoUrl?: string): string {
  const today = new Date();
  const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const todayStr = `${today.getDate()} ${thaiMonths[today.getMonth()]} ${today.getFullYear() + 543}`;

  const taxIdBoxesHtml = (taxId: string) => {
    const digits = (taxId || "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
    const groups = [[digits[0]], digits.slice(1, 5), digits.slice(5, 10), digits.slice(10, 12), [digits[12]]];
    return groups.map((g, gi) =>
      (gi > 0 ? '<span style="margin:0 1px;font-size:9px;font-weight:bold;">-</span>' : '') +
      g.map(d => `<span style="display:inline-block;width:16px;height:18px;border:1px solid black;text-align:center;font-size:11px;line-height:18px;font-weight:500;">${d.trim()}</span>`).join('')
    ).join('');
  };

  const cbHtml = (checked: boolean) => `<span style="display:inline-block;width:12px;height:12px;border:1px solid black;text-align:center;line-height:12px;font-size:10px;font-weight:bold;vertical-align:middle;margin-right:2px;">${checked ? '✓' : '&nbsp;'}</span>`;

  const sec = "border:1px solid black;padding:4px 6px;margin-bottom:3px;";
  const dot = "border-bottom:1px dotted black;padding:0 2px;";
  const tdLs = "border:1px solid black;padding:2px 4px;text-align:left;font-size:10.5px;";
  const tdCs = "border:1px solid black;padding:2px;text-align:center;font-size:10.5px;";
  const tdRs = "border:1px solid black;padding:2px 4px;text-align:right;font-size:10.5px;";

  return `<div style="width:210mm;min-height:297mm;font-family:'Sarabun',sans-serif;font-size:11px;padding:8mm 10mm;line-height:1.4;background:white;color:black;box-sizing:border-box;page-break-after:always;">
    ${logoUrl ? `<div style="text-align:center;margin-bottom:4px;"><img src="${logoUrl}" style="max-height:50px;object-fit:contain;" /></div>` : ''}
    <div style="text-align:center;margin-bottom:2px;"><div style="font-size:16px;font-weight:bold;">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div><div style="font-size:12px;">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div></div>
    <div style="display:flex;justify-content:flex-end;gap:16px;font-size:11px;margin-bottom:4px;"><span>เล่มที่ <span style="${dot};min-width:50px;"></span></span><span>เลขที่ <span style="${dot};min-width:70px;font-weight:600;"></span></span></div>
    <div style="${sec}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;"><b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</b><div style="display:flex;align-items:center;gap:4px;font-size:10px;"><span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>${taxIdBoxesHtml(company?.taxId || '')}</div></div>
      <div>ชื่อ <span style="${dot};min-width:250px;">${company?.name || ''}</span></div>
      <div>สาขา <span style="${dot};min-width:200px;">${company?.branch || 'สำนักงานใหญ่'}</span></div>
      <div>ที่อยู่ <span style="${dot};min-width:500px;">${company?.address || ''}</span></div>
    </div>
    <div style="${sec}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;"><b>ผู้ถูกหักภาษี ณ ที่จ่าย :-</b><div style="display:flex;align-items:center;gap:4px;font-size:10px;"><span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>${taxIdBoxesHtml(employee?.taxId || employee?.idCardNumber || '')}</div></div>
      <div>ชื่อ <span style="${dot};min-width:250px;">${employee?.fullName || ''}</span></div>
      <div>สาขา <span style="${dot};min-width:200px;"></span></div>
      <div>ที่อยู่ <span style="${dot};min-width:500px;">${employee?.address || ''}</span></div>
    </div>
    <div style="${sec};display:flex;align-items:flex-start;gap:12px;">
      <div style="flex-shrink:0;"><div style="display:flex;align-items:baseline;gap:4px;margin-bottom:4px;"><b>ลำดับที่</b><span style="${dot};display:inline-block;width:50px;text-align:center;"></span><b>ในแบบ</b></div></div>
      <div style="display:grid;grid-template-columns:repeat(4,auto);gap:4px 16px;align-items:center;">
        <span>${cbHtml(true)} ภ.ง.ด.1</span><span>${cbHtml(false)} ภ.ง.ด.1ก</span><span>${cbHtml(false)} ภ.ง.ด.1ก พิเศษ</span><span>${cbHtml(false)} ภ.ง.ด.2</span>
        <span>${cbHtml(false)} ภ.ง.ด.3</span><span>${cbHtml(false)} ภ.ง.ด.2ก</span><span>${cbHtml(false)} ภ.ง.ด.3ก</span><span>${cbHtml(false)} ภ.ง.ด.53</span>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:3px;">
      <tr><th style="${tdLs};width:54%;">ประเภทเงินได้พึงประเมินที่จ่าย</th><th style="${tdCs};width:14%;">วัน เดือน<br/>หรือปีภาษี ที่จ่าย</th><th style="${tdCs};width:16%;">จำนวนเงินที่จ่าย</th><th style="${tdCs};width:16%;">ภาษีที่หัก<br/>และนำส่งไว้</th></tr>
      <tr><td style="${tdLs}">1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td><td style="${tdCs}">${(employee?.incomeType || "1") === "1" ? yearBE : ""}</td><td style="${tdRs}">${(employee?.incomeType || "1") === "1" ? fmt(data.totalEarnings) : ""}</td><td style="${tdRs}">${(employee?.incomeType || "1") === "1" ? fmt(data.totalTax) : ""}</td></tr>
      <tr><td style="${tdLs}">2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</td><td style="${tdCs}">${employee?.incomeType === "2" ? yearBE : ""}</td><td style="${tdRs}">${employee?.incomeType === "2" ? fmt(data.totalEarnings) : ""}</td><td style="${tdRs}">${employee?.incomeType === "2" ? fmt(data.totalTax) : ""}</td></tr>
      <tr><td style="${tdLs}">3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs}">4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};padding-left:12px;">(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:20px;" colspan="4">(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้</td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(1.4) อัตราอื่นๆ (ระบุ) .................. ของกำไรสุทธิ</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:20px;" colspan="4">(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก</td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้น</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs};font-size:10px;padding-left:40px;">(2.5) อื่นๆ (ระบุ) ......................................................</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs}"><div>5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา</div><div style="padding-left:12px;font-size:10px;">3 เตรส เช่น รางวัล ส่วนลดฯ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ</div></td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr><td style="${tdLs}">6. อื่นๆ (ระบุ) ...........................................................</td><td style="${tdCs}"></td><td style="${tdRs}"></td><td style="${tdRs}"></td></tr>
      <tr style="font-weight:bold;"><td style="${tdRs}" colspan="2">รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td><td style="${tdRs}">${fmt(data.totalEarnings)}</td><td style="${tdRs}">${fmt(data.totalTax)}</td></tr>
    </table>
    <div style="font-size:11px;margin-bottom:2px;"><b>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</b> <span style="${dot};min-width:320px;font-weight:600;">${numberToThaiWords(data.totalTax)}</span></div>
    <div style="font-size:10px;margin-bottom:3px;">เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <span style="${dot};min-width:60px;"></span> บาท กองทุนประกันสังคม <span style="${dot};min-width:60px;">${data.totalSso ? fmtAlways(data.totalSso) : ''}</span> บาท กองทุนสำรองเลี้ยงชีพ <span style="${dot};min-width:60px;"></span> บาท</div>
    <div style="${sec};display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:11px;">
      <b>ผู้จ่ายเงิน</b> ${cbHtml(true)} (1) หัก ณ ที่จ่าย ${cbHtml(false)} (2) ออกให้ตลอดไป ${cbHtml(false)} (3) ออกให้ครั้งเดียว ${cbHtml(false)} (4) อื่นๆ
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:10px;margin-top:4px;">
      <div style="${sec};width:44%;font-size:10px;"><b>คำเตือน</b><div>ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div></div>
      <div style="width:52%;text-align:center;font-size:11px;">
        <div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
        <div style="margin-top:20px;">ลงชื่อ <span style="${dot};min-width:170px;"></span> ผู้จ่ายเงิน <span style="font-size:10px;margin-left:8px;">ประทับตรา</span></div>
        <div style="margin-top:4px;"><span style="${dot};min-width:140px;">${company?.name || ''}</span></div>
        <div style="margin-top:4px;font-size:10px;">วันที่ ${todayStr}</div>
      </div>
    </div>
  </div>`;
}

export default function FiftyTawiPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = useHrCompanyId();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", companyId],
    queryFn: async () => {
      const r = await fetch(`/api/employees?companyId=${companyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && !!companyId,
  });

  const { data: yearRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-records/year", companyId, year],
    queryFn: async () => {
      const r = await fetch(`/api/payroll-records/year?companyId=${companyId}&year=${year}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!companyId,
  });

  const annualByEmployee = useMemo(() => {
    const grouped: Record<number, { employeeId: number; totalEarnings: number; totalTax: number; totalSso: number }> = {};
    for (const r of yearRecords) {
      const eid = r.employeeId;
      if (!grouped[eid]) grouped[eid] = { employeeId: eid, totalEarnings: 0, totalTax: 0, totalSso: 0 };
      grouped[eid].totalEarnings += Number(r.totalEarnings || 0);
      grouped[eid].totalTax += Number(r.withholdingTax || 0);
      grouped[eid].totalSso += Number(r.socialSecurity || 0);
    }
    return grouped;
  }, [yearRecords]);

  const yearBE = Number(year) + 543;
  const activeEmployees = employees.filter((e: any) => e.active);
  const logoUrl = docSettings?.showLogo !== false ? objectPathToUrl(docSettings?.logoUrl) || undefined : undefined;

  const selectedEmp = selectedEmployeeId ? employees.find((e: any) => e.id === Number(selectedEmployeeId)) : null;
  const selectedData = selectedEmployeeId ? annualByEmployee[Number(selectedEmployeeId)] : null;

  const handlePrintSingle = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>50 ทวิ - ${selectedEmp?.fullName || ""}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Sarabun', sans-serif; }
      @media print { @page { size: A4 portrait; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handlePrintAll = () => {
    const allCertsHtml = activeEmployees.map(emp => {
      const data = annualByEmployee[emp.id];
      if (!data) return "";
      return generateA4Html(company, emp, data, yearBE, logoUrl);
    }).join("");

    if (!allCertsHtml) {
      toast({ title: "ไม่พบข้อมูล", description: "ไม่มีข้อมูลเงินเดือนของพนักงานในปีที่เลือก", variant: "destructive" });
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>50 ทวิ ทั้งหมด - ปี ${yearBE}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Sarabun', sans-serif; }
      @media print { @page { size: A4 portrait; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
      </head><body>${allCertsHtml}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  return (
    <HRLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: "#fb9678" }} />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">50 ทวิ หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24" data-testid="select-year">
                <SelectValue placeholder="ปี" />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map(y => (
                  <SelectItem key={y.value} value={y.value} data-testid={`option-year-${y.value}`}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-52" data-testid="select-employee">
                <SelectValue placeholder="เลือกพนักงาน" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)} data-testid={`option-emp-${emp.id}`}>{emp.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handlePrintSingle} variant="outline" disabled={!selectedEmployeeId} data-testid="button-print-50tawi">
              <Printer className="h-4 w-4 mr-2" />พิมพ์ 50 ทวิ
            </Button>
            <Button onClick={handlePrintAll} variant="outline" style={{ borderColor: "#fb9678", color: "#fb9678" }} data-testid="button-print-all">
              <Printer className="h-4 w-4 mr-2" />พิมพ์ทั้งหมด
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-none">
          <CardContent className="p-6 overflow-x-auto">
            {selectedEmp && selectedData ? (
              <div ref={printRef}>
                <FiftyTawiA4
                  company={company}
                  employee={selectedEmp}
                  annualEarnings={selectedData.totalEarnings}
                  annualTax={selectedData.totalTax}
                  yearBE={yearBE}
                  logoUrl={logoUrl}
                  ssoAmount={selectedData.totalSso}
                />
              </div>
            ) : selectedEmployeeId && !selectedData ? (
              <div ref={printRef}>
                <p className="text-center py-12 text-muted-foreground">ไม่พบข้อมูลเงินเดือนของพนักงานคนนี้สำหรับปี พ.ศ. {yearBE}</p>
              </div>
            ) : (
              <div ref={printRef}>
                <p className="text-center py-12 text-muted-foreground">กรุณาเลือกพนักงานเพื่อออกหนังสือรับรอง 50 ทวิ</p>
              </div>
            )}

            {Object.keys(annualByEmployee).length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-bold text-sm mb-3" style={{ color: "#fb9678" }}>สรุปข้อมูลพนักงานทั้งหมด ปี พ.ศ. {yearBE}</h3>
                <div className="grid gap-2">
                  {Object.entries(annualByEmployee).map(([eid, data]) => {
                    const emp = employees.find((e: any) => e.id === Number(eid));
                    return (
                      <div key={eid} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm cursor-pointer hover:bg-gray-100" onClick={() => setSelectedEmployeeId(eid)} data-testid={`summary-emp-${eid}`}>
                        <span className="font-medium">{emp?.fullName || "-"}</span>
                        <div className="flex gap-4">
                          <span style={{ color: "#05b187" }}>฿{fmtAlways(data.totalEarnings)}</span>
                          <span style={{ color: "#f94d4d" }}>ภาษี ฿{fmtAlways(data.totalTax)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </HRLayout>
  );
}
