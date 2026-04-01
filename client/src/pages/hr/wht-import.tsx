import HRLayout from "@/components/hr-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, Printer, FileSpreadsheet, Trash2, Eye, FileText, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useState, useRef, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";

type ImportedRow = {
  seq: number;
  taxId: string;
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  building: string;
  room: string;
  floor: string;
  village: string;
  houseNo: string;
  moo: string;
  soi: string;
  yaek: string;
  road: string;
  tambon: string;
  amphoe: string;
  province: string;
  postalCode: string;
  address: string;
  annualEarnings: number;
  annualTax: number;
  ssoAmount: number;
  incomeType: string;
  condition: string;
};

function getYearOptions() {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1].map(y => ({ value: String(y), label: String(y + 543) }));
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtZero(val: string | number | null | undefined): string {
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
  const groups = [[digits[0]], [digits[1], digits[2], digits[3], digits[4]], [digits[5], digits[6], digits[7], digits[8], digits[9]], [digits[10], digits[11]], [digits[12]]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
      {groups.map((group, gi) => (
        <div key={gi} style={{ display: "flex", alignItems: "center" }}>
          {gi > 0 && <span style={{ margin: "0 1px", fontSize: "9px", fontWeight: "bold" }}>-</span>}
          {group.map((d, di) => (
            <div key={di} style={{ width: "16px", height: "18px", border: "1px solid black", textAlign: "center", fontSize: "11px", lineHeight: "18px", fontWeight: 500 }}>{d.trim()}</div>
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

function FiftyTawiA4({ company, row, yearBE }: { company: { taxId?: string; name?: string; branch?: string; address?: string } | null; row: ImportedRow; yearBE: number }) {
  const todayParts = (() => {
    const d = new Date();
    const thaiMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    return { day: String(d.getDate()), month: thaiMonths[d.getMonth()], year: String(d.getFullYear() + 543) };
  })();

  const tdLStyle: React.CSSProperties = { border: "1px solid black", padding: "2px 4px", textAlign: "left", fontSize: "10.5px" };
  const tdCStyle: React.CSSProperties = { border: "1px solid black", padding: "2px", textAlign: "center", fontSize: "10.5px" };
  const tdRStyle: React.CSSProperties = { border: "1px solid black", padding: "2px 4px", textAlign: "right", fontSize: "10.5px" };

  const incType = row.incomeType || "1";

  return (
    <div style={S.page} className="fifty-tawi-page">
      <style>{`@media print { @page { size: A4 portrait; margin: 5mm; } body { background: white !important; } .fifty-tawi-page { width: 100% !important; min-height: auto !important; padding: 4mm 6mm !important; border: none !important; } }`}</style>

      <div style={{ textAlign: "center", marginBottom: "2px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
        <div style={{ fontSize: "12px" }}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "20px", fontSize: "11px", marginBottom: "4px" }}>
        <span>เล่มที่ <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span></span>
        <span>เลขที่ <span style={{ ...S.dotline, display: "inline-block", minWidth: "80px", textAlign: "center", fontWeight: 600 }}></span></span>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxes taxId={company?.taxId || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...S.dotline, display: "inline-block", minWidth: "350px" }}>{company?.name || ""}</span> <span style={{ fontSize: "9px", color: "#666" }}>(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
        <div>สาขา <span style={{ ...S.dotline, display: "inline-block", minWidth: "300px" }}>{company?.branch || "สำนักงานใหญ่"}</span></div>
        <div>ที่อยู่ <span style={{ ...S.dotline, display: "inline-block", minWidth: "95%" }}>{company?.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2px" }}>
          <b>ผู้ถูกหักภาษี ณ ที่จ่าย :-</b>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
            <span>เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)*</span>
            <TaxIdBoxes taxId={row.taxId || ""} />
          </div>
        </div>
        <div>ชื่อ <span style={{ ...S.dotline, display: "inline-block", minWidth: "350px" }}>{row.fullName || `${row.prefix}${row.firstName} ${row.lastName}`}</span></div>
        <div>สาขา <span style={{ ...S.dotline, display: "inline-block", minWidth: "300px" }}></span></div>
        <div>ที่อยู่ <span style={{ ...S.dotline, display: "inline-block", minWidth: "95%" }}>{row.address || ""}</span></div>
        <div style={{ fontSize: "9px", color: "#666", paddingLeft: "28px" }}>(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
      </div>

      <div style={{ ...S.section, display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
            <b>ลำดับที่</b>
            <span style={{ ...S.dotline, display: "inline-block", width: "50px", textAlign: "center" }}>{row.seq}</span>
            <b>ในแบบ</b>
          </div>
          <div style={{ fontSize: "9px", color: "#666" }}>
            (ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่าง<br/>ลำดับที่ตามหนังสือรับรองฯ กับแบบยื่น<br/>รายการภาษีหัก ณ ที่จ่าย)
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: "4px 16px", alignItems: "center" }}>
          <span><CB checked={false} /> ภ.ง.ด.1</span>
          <span><CB checked={true} /> ภ.ง.ด.1ก</span>
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
            <th style={{ ...tdLStyle, width: "54%", fontWeight: "bold" }}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th style={{ ...tdCStyle, width: "14%", fontWeight: "bold" }}>วัน เดือน<br/>หรือปีภาษี ที่จ่าย</th>
            <th style={{ ...tdCStyle, width: "16%", fontWeight: "bold" }}>จำนวนเงินที่จ่าย</th>
            <th style={{ ...tdCStyle, width: "16%", fontWeight: "bold" }}>ภาษีที่หัก<br/>และนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdLStyle}>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
            <td style={tdCStyle}>{incType === "1" ? yearBE : ""}</td>
            <td style={tdRStyle}>{incType === "1" ? fmtZero(row.annualEarnings) : ""}</td>
            <td style={tdRStyle}>{incType === "1" ? fmtZero(row.annualTax) : ""}</td>
          </tr>
          <tr>
            <td style={tdLStyle}>2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</td>
            <td style={tdCStyle}>{incType === "2" ? yearBE : ""}</td>
            <td style={tdRStyle}>{incType === "2" ? fmtZero(row.annualEarnings) : ""}</td>
            <td style={tdRStyle}>{incType === "2" ? fmtZero(row.annualTax) : ""}</td>
          </tr>
          <tr><td style={tdLStyle}>3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={tdLStyle}>4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, paddingLeft: "12px" }}>(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "20px" }} colSpan={4}><div>(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้</div></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(1.4) อัตราอื่นๆ (ระบุ) .................. ของกำไรสุทธิ</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "20px" }} colSpan={4}><div>(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก</div></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี ก่อนรอบระยะเวลาบัญชีปีปัจจุบัน</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr><td style={{ ...tdLStyle, fontSize: "10px", paddingLeft: "40px" }}>(2.5) อื่นๆ (ระบุ) ......................................................</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr>
            <td style={tdLStyle}>
              <div>5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา</div>
              <div style={{ paddingLeft: "12px", fontSize: "10px" }}>3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ</div>
            </td>
            <td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td>
          </tr>
          <tr><td style={tdLStyle}>6. อื่นๆ (ระบุ) ...........................................................</td><td style={tdCStyle}></td><td style={tdRStyle}></td><td style={tdRStyle}></td></tr>
          <tr style={{ fontWeight: "bold" }}>
            <td style={{ ...tdRStyle }} colSpan={2}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
            <td style={tdRStyle}>{fmtZero(row.annualEarnings)}</td>
            <td style={tdRStyle}>{fmtZero(row.annualTax)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: "11px", marginBottom: "2px" }}>
        <b>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</b>
        <span style={{ ...S.dotline, minWidth: "320px", marginLeft: "4px", fontWeight: 600 }}>{numberToThaiWords(row.annualTax)}</span>
      </div>

      <div style={{ fontSize: "10px", marginBottom: "3px" }}>
        เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
        {" "}กองทุนประกันสังคม <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}>{row.ssoAmount > 0 ? fmtAlways(row.ssoAmount) : ""}</span> บาท
        {" "}กองทุนสำรองเลี้ยงชีพ <span style={{ ...S.dotline, display: "inline-block", minWidth: "60px", textAlign: "center" }}></span> บาท
      </div>

      <div style={{ ...S.section, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px", fontSize: "11px" }}>
        <b>ผู้จ่ายเงิน</b>
        <span><CB checked={row.condition === "1"} /> (1) หัก ณ ที่จ่าย</span>
        <span><CB checked={row.condition === "2"} /> (2) ออกให้ตลอดไป</span>
        <span><CB checked={row.condition === "3"} /> (3) ออกให้ครั้งเดียว</span>
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
                <td style={{ textAlign: "center", width: "170px", borderBottom: "1px dotted black", border: "none" }}>&nbsp;</td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "4px", border: "none" }}>ผู้จ่ายเงิน</td>
                <td style={{ textAlign: "left", whiteSpace: "nowrap", paddingLeft: "8px", fontSize: "10px", border: "none" }}>ประทับตรา</td>
              </tr>
              <tr>
                <td style={{ border: "none" }}></td>
                <td style={{ textAlign: "center", fontSize: "10px", border: "none", paddingTop: "2px" }}>({company?.name || ""})</td>
                <td colSpan={2} style={{ border: "none" }}></td>
              </tr>
              <tr>
                <td style={{ border: "none" }}></td>
                <td style={{ textAlign: "center", fontSize: "10px", border: "none" }}>วันที่ {todayParts.day} {todayParts.month} {todayParts.year}</td>
                <td colSpan={2} style={{ border: "none" }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function WhtImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { companyId } = useCompany();
  const fileRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const singlePrintRef = useRef<HTMLDivElement>(null);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const yearBE = Number(year) + 543;
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [previewRow, setPreviewRow] = useState<ImportedRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [payerOpen, setPayerOpen] = useState(false);

  const [payerTaxId, setPayerTaxId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerBranch, setPayerBranch] = useState("สำนักงานใหญ่");
  const [payerAddress, setPayerAddress] = useState("");
  const [lastCompanyId, setLastCompanyId] = useState<number | null>(null);

  const { data: company } = useQuery({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const r = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (company && company.id !== lastCompanyId) {
      setPayerTaxId(company.taxId || "");
      setPayerName(company.name || "");
      setPayerBranch(company.branch || "สำนักงานใหญ่");
      setPayerAddress(company.address || "");
      setLastCompanyId(company.id);
    }
  }, [company, lastCompanyId]);

  const payerData = useMemo(() => ({
    taxId: payerTaxId,
    name: payerName,
    branch: payerBranch,
    address: payerAddress,
  }), [payerTaxId, payerName, payerBranch, payerAddress]);

  const grandTotalEarnings = useMemo(() => rows.reduce((s, r) => s + r.annualEarnings, 0), [rows]);
  const grandTotalTax = useMemo(() => rows.reduce((s, r) => s + r.annualTax, 0), [rows]);

  const CSV_HEADERS = [
    "ลำดับที่", "เลขประจำตัวผู้เสียภาษี", "คำนำหน้าชื่อ", "ชื่อ", "ชื่อกลาง", "นามสกุล",
    "อาคาร", "เลขห้อง", "ชั้น", "หมู่บ้าน", "เลขที่", "หมู่ที่", "ซอย", "แยก", "ถนน",
    "ตำบล", "อำเภอ", "จังหวัด", "รหัสไปรษณีย์",
    "เงินได้ตามมาตรา", "จำนวนเงินที่จ่าย", "จำนวนเงินภาษีที่หัก", "เงื่อนไขการหัก"
  ];

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const exampleRow = [1, "1234567890123", "นาย", "สมชาย", "", "ใจดี", "", "", "", "", "123", "4", "", "", "สุขุมวิท", "คลองเตย", "คลองเตย", "กรุงเทพมหานคร", "10110", "401N", 360000, 5400, 1];
    const ws = XLSX.utils.aoa_to_sheet([CSV_HEADERS, exampleRow]);
    ws["!cols"] = [
      { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
      { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "ข้อมูล");
    XLSX.writeFile(wb, `template_50tawi_${yearBE}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });

        const parseNum = (v: any): number => {
          if (v === null || v === undefined || v === "") return 0;
          const s = String(v).replace(/,/g, "").trim();
          const n = Number(s);
          return isNaN(n) ? 0 : n;
        };
        const parseTaxId = (v: any): string => {
          const raw = String(v || "").replace(/\D/g, "");
          if (raw.length === 0) return "";
          return raw.padStart(13, "0").slice(-13);
        };

        const str = (v: any) => String(v || "").trim();
        const imported: ImportedRow[] = jsonData.map((r: any, i: number) => {
          const taxId = parseTaxId(r["เลขประจำตัวผู้เสียภาษี"] || r["taxId"] || r["เลขประจำตัว"] || r["เลขบัตรประชาชน"] || "");
          const prefix = str(r["คำนำหน้าชื่อ"] || r["คำนำหน้า"] || r["prefix"]);
          const firstName = str(r["ชื่อ"] || r["firstName"] || r["first_name"]);
          const middleName = str(r["ชื่อกลาง"] || r["middleName"]);
          const lastName = str(r["นามสกุล"] || r["สกุล"] || r["lastName"] || r["last_name"]);
          const fullNameRaw = str(r["ชื่อ-นามสกุล"] || r["fullName"] || r["ชื่อเต็ม"]);
          const fullName = fullNameRaw || `${prefix}${firstName} ${lastName}`.trim();

          const building = str(r["อาคาร"] || r["building"]);
          const room = str(r["เลขห้อง"] || r["room"]);
          const floor = str(r["ชั้น"] || r["floor"]);
          const village = str(r["หมู่บ้าน"] || r["village"]);
          const houseNo = str(r["เลขที่"] || r["houseNo"]);
          const moo = str(r["หมู่ที่"] || r["moo"]);
          const soi = str(r["ซอย"] || r["soi"]);
          const yaek = str(r["แยก"] || r["yaek"]);
          const road = str(r["ถนน"] || r["road"]);
          const tambon = str(r["ตำบล"] || r["tambon"]);
          const amphoe = str(r["อำเภอ"] || r["amphoe"]);
          const province = str(r["จังหวัด"] || r["province"]);
          const postalCode = str(r["รหัสไปรษณีย์"] || r["postalCode"]);

          const addressParts = [
            houseNo && `เลขที่ ${houseNo}`,
            moo && `หมู่ ${moo}`,
            building && `อาคาร ${building}`,
            soi && `ซอย ${soi}`,
            road && `ถนน ${road}`,
            tambon && `ต.${tambon}`,
            amphoe && `อ.${amphoe}`,
            province,
            postalCode,
          ].filter(Boolean).join(" ");
          const addressRaw = str(r["ที่อยู่"] || r["address"]);
          const address = addressRaw || addressParts;

          const incomeTypeRaw = str(r["เงินได้ตามมาตรา"] || r["ประเภทเงินได้ (1=40(1), 2=40(2))"] || r["ประเภทเงินได้"] || r["incomeType"]);
          const incomeType = incomeTypeRaw.includes("402") ? "2" : "1";

          const annualEarnings = parseNum(r["จำนวนเงินที่จ่าย"] || r["เงินได้ทั้งปี"] || r["รายได้ทั้งปี"] || r["annualEarnings"] || r["earnings"]);
          const annualTax = parseNum(r["จำนวนเงินภาษีที่หัก"] || r["ภาษีหัก ณ ที่จ่ายทั้งปี"] || r["ภาษีทั้งปี"] || r["annualTax"] || r["tax"]);
          const ssoAmount = parseNum(r["ประกันสังคมทั้งปี"] || r["ประกันสังคม"] || r["ssoAmount"] || r["sso"]);
          const conditionRaw = str(r["เงื่อนไขการหัก"] || r["เงื่อนไข (1=หัก ณ ที่จ่าย)"] || r["เงื่อนไข"] || r["condition"] || "1");
          const condition = ["1", "2", "3"].includes(conditionRaw) ? conditionRaw : "1";

          return {
            seq: i + 1, taxId, prefix, firstName, middleName, lastName, fullName,
            building, room, floor, village, houseNo, moo, soi, yaek, road,
            tambon, amphoe, province, postalCode, address,
            annualEarnings, annualTax, ssoAmount, incomeType, condition,
          };
        }).filter((r: ImportedRow) => r.fullName.trim() && (r.annualEarnings > 0 || r.annualTax > 0));

        if (imported.length === 0) {
          toast({ title: "ไม่พบข้อมูลที่ใช้ได้", description: "กรุณาตรวจสอบหัวคอลัมน์ในไฟล์ Excel", variant: "destructive" });
          return;
        }

        setRows(imported);
        toast({ title: "นำเข้าสำเร็จ", description: `พบข้อมูล ${imported.length} รายการ` });
      } catch (err: any) {
        toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const csvEscape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const lines: string[] = [];
    lines.push(CSV_HEADERS.join(","));
    for (const r of rows) {
      const incCode = r.incomeType === "2" ? "402I" : "401N";
      lines.push([
        String(r.seq), r.taxId, csvEscape(r.prefix), csvEscape(r.firstName), csvEscape(r.middleName), csvEscape(r.lastName),
        csvEscape(r.building), csvEscape(r.room), csvEscape(r.floor), csvEscape(r.village),
        csvEscape(r.houseNo), csvEscape(r.moo), csvEscape(r.soi), csvEscape(r.yaek), csvEscape(r.road),
        csvEscape(r.tambon), csvEscape(r.amphoe), csvEscape(r.province), csvEscape(r.postalCode),
        incCode, String(Math.round(r.annualEarnings)), String(Math.round(r.annualTax)), r.condition,
      ].join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PND1A_${yearBE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "ดาวน์โหลด CSV สำเร็จ", description: `PND1A_${yearBE}.csv` });
  };

  const handleExportExcel = () => {
    if (rows.length === 0) return;
    const wb = XLSX.utils.book_new();
    const data = rows.map((r) => {
      const incCode = r.incomeType === "2" ? "402I" : "401N";
      return [
        r.seq, r.taxId, r.prefix, r.firstName, r.middleName, r.lastName,
        r.building, r.room, r.floor, r.village, r.houseNo, r.moo, r.soi, r.yaek, r.road,
        r.tambon, r.amphoe, r.province, r.postalCode,
        incCode, r.annualEarnings, r.annualTax, Number(r.condition),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([CSV_HEADERS, ...data]);
    ws["!cols"] = [
      { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
      { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "data");
    XLSX.writeFile(wb, `PND1A_${yearBE}.xlsx`);
    toast({ title: "ดาวน์โหลด Excel สำเร็จ", description: `PND1A_${yearBE}.xlsx` });
  };

  const handlePrintAll50Tawi = () => {
    if (!printRef.current || rows.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>50 ทวิ ทั้งหมด - ปี ${yearBE}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', sans-serif; }
        .fifty-tawi-page { width: 210mm; min-height: 297mm; padding: 8mm 10mm; page-break-after: always; }
        .fifty-tawi-page:last-child { page-break-after: auto; }
        @media print { @page { size: A4 portrait; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .fifty-tawi-page { width: 100% !important; min-height: auto !important; padding: 4mm 6mm !important; border: none !important; } }
      </style>
      </head><body>${printRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handlePrintSingle50Tawi = () => {
    if (!singlePrintRef.current || !previewRow) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>50 ทวิ - ${previewRow.fullName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', sans-serif; }
        .fifty-tawi-page { width: 210mm; min-height: 297mm; padding: 8mm 10mm; }
        @media print { @page { size: A4 portrait; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .fifty-tawi-page { width: 100% !important; min-height: auto !important; padding: 4mm 6mm !important; border: none !important; } }
      </style>
      </head><body>${singlePrintRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handlePrintPnd1a = () => {
    if (rows.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const pageSize = 7;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

    let pagesHtml = "";
    for (let page = 0; page < totalPages; page++) {
      const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
      let tableRows = "";
      pageRows.forEach((r, i) => {
        tableRows += `<tr>
          <td style="border:1px solid #333;padding:4px;text-align:center;vertical-align:top">${page * pageSize + i + 1}</td>
          <td style="border:1px solid #333;padding:4px;text-align:center;vertical-align:top;font-size:10px">${r.taxId || "-"}</td>
          <td style="border:1px solid #333;padding:4px;vertical-align:top"><div>${r.fullName}</div><div style="font-size:9px;color:#666">${r.address || ""}</div></td>
          <td style="border:1px solid #333;padding:4px;text-align:right;vertical-align:top">${fmt(r.annualEarnings)}</td>
          <td style="border:1px solid #333;padding:4px;text-align:right;vertical-align:top">${fmt(r.annualTax)}</td>
          <td style="border:1px solid #333;padding:4px;text-align:center;vertical-align:top">${r.condition}</td>
        </tr>`;
      });

      if (page === totalPages - 1) {
        tableRows += `<tr style="font-weight:bold;background:#f8f9fa">
          <td colspan="3" style="border:1px solid #333;padding:6px 8px;text-align:right;font-size:10px">รวมยอดเงินได้และภาษีที่นำส่ง (${rows.length} ราย)</td>
          <td style="border:1px solid #333;padding:6px 4px;text-align:right">${fmt(grandTotalEarnings)}</td>
          <td style="border:1px solid #333;padding:6px 4px;text-align:right">${fmt(grandTotalTax)}</td>
          <td style="border:1px solid #333;padding:0"></td>
        </tr>`;
      }

      pagesHtml += `
        <div style="page-break-after:${page < totalPages - 1 ? "always" : "auto"};margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <span style="font-size:16px;font-weight:bold">ใบแนบ</span>
              <span style="font-size:18px;font-weight:bold;color:#03c9d7;margin-left:12px">ภ.ง.ด.1ก</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:10px">
              <span>เลขประจำตัวผู้เสียภาษีอากร (ของผู้มีหน้าที่หักภาษี ณ ที่จ่าย)</span>
              <span style="font-weight:bold">${payerData.taxId || ""}</span>
            </div>
          </div>
          <div style="font-size:10px;margin-bottom:6px;border:1px solid #999;padding:6px 8px">
            <div style="margin-bottom:4px">(ให้แยกกรอกรายการในใบแนบนี้ตามเงินได้แต่ละประเภท โดยใส่เครื่องหมาย "✓" ลงใน "☐" หน้าข้อความแล้วแต่กรณี เพียงข้อเดียว)</div>
            <div>ประเภทเงินได้ ☑ (1) เงินได้ตามมาตรา 40 (1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป</div>
          </div>
          <div style="text-align:right;font-size:10px;margin-bottom:4px">
            แผ่นที่ <span style="border-bottom:1px dotted black;display:inline-block;min-width:30px;text-align:center">${page + 1}</span>
            ในจำนวน <span style="border-bottom:1px dotted black;display:inline-block;min-width:30px;text-align:center">${totalPages}</span> แผ่น
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;width:35px;background:#f8f9fa">ลำดับ<br/>ที่</th>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;width:130px;background:#f8f9fa">เลขประจำตัวผู้เสียภาษีอากร</th>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;background:#f8f9fa">ชื่อผู้มีเงินได้<br/><span style="font-size:9px">ที่อยู่ของผู้มีเงินได้</span></th>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;width:100px;background:#f8f9fa">จำนวนเงินได้<br/>ที่จ่ายทั้งปี</th>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;width:100px;background:#f8f9fa">จำนวนเงินภาษี<br/>ที่หักและนำส่งทั้งปี</th>
                <th style="border:1px solid #333;padding:4px;font-weight:bold;text-align:center;width:45px;background:#f8f9fa">เงื่อนไข<br/>*</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          ${page === totalPages - 1 ? `
            <div style="font-size:9px;margin-top:4px;margin-bottom:8px">(ให้กรอกลำดับที่ต่อเนื่องกันไปทุกแผ่นตามเงินได้แต่ละประเภท)</div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:10px;margin-top:8px">
              <div>
                <div>หมายเหตุ * เงื่อนไขการหักภาษีให้กรอกดังนี้</div>
                <div style="padding-left:16px">หัก ณ ที่จ่าย กรอก 1</div>
                <div style="padding-left:16px">ออกให้ตลอดไป กรอก 2</div>
                <div style="padding-left:16px">ออกให้ครั้งเดียว กรอก 3</div>
              </div>
              <div style="text-align:center;font-size:11px;width:50%">
                <div>ลงชื่อ .......................... ผู้จ่ายเงิน</div>
                <div style="margin-top:4px">(${payerData.name || ""})</div>
              </div>
            </div>
          ` : ""}
        </div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>ใบแนบ ภงด.1ก - ปี ${yearBE}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', sans-serif; font-size: 11px; line-height: 1.4; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        @media print { @page { size: A4 portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; } }
      </style>
      </head><body>${pagesHtml}</body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  return (
    <HRLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <Card className="shadow-sm border-none">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">ปีภาษี:</span>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[130px]" data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => fileRef.current?.click()} variant="outline" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} data-testid="button-import-excel">
                <Upload className="h-4 w-4 mr-2" />นำเข้า Excel
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" data-testid="input-import-file" />

              <Button onClick={handleDownloadTemplate} variant="outline" data-testid="button-download-template">
                <FileSpreadsheet className="h-4 w-4 mr-2" />ดาวน์โหลดแบบฟอร์ม
              </Button>

              {rows.length > 0 && (
                <>
                  <div className="border-l border-gray-300 h-6 mx-1"></div>
                  <Button onClick={handleExportCSV} variant="outline" style={{ borderColor: "#05b187", color: "#05b187" }} data-testid="button-export-csv">
                    <Download className="h-4 w-4 mr-2" />CSV ภงด.1ก (RD Prep)
                  </Button>
                  <Button onClick={handleExportExcel} variant="outline" style={{ borderColor: "var(--theme-primary)", color: "var(--theme-primary)" }} data-testid="button-export-excel">
                    <Download className="h-4 w-4 mr-2" />Excel ภงด.1ก
                  </Button>
                  <Button onClick={handlePrintPnd1a} variant="outline" data-testid="button-print-pnd1a">
                    <Printer className="h-4 w-4 mr-2" />พิมพ์ใบแนบ ภงด.1ก
                  </Button>
                  <Button onClick={handlePrintAll50Tawi} variant="outline" style={{ borderColor: "#fb9678", color: "#fb9678" }} data-testid="button-print-all-50tawi">
                    <Printer className="h-4 w-4 mr-2" />พิมพ์ 50 ทวิ ทั้งหมด
                  </Button>
                  <Button onClick={() => setRows([])} variant="outline" className="text-red-500 border-red-300" data-testid="button-clear-data">
                    <Trash2 className="h-4 w-4 mr-2" />ล้างข้อมูล
                  </Button>
                </>
              )}
            </div>

            <div className="border rounded-lg mb-4">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setPayerOpen(!payerOpen)}
                data-testid="button-toggle-payer-info"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" style={{ color: "#fb9678" }} />
                  <span className="font-medium text-sm">ข้อมูลผู้มีหน้าที่หักภาษี ณ ที่จ่าย</span>
                  {payerTaxId && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({payerName} | {payerTaxId})
                    </span>
                  )}
                </div>
                {payerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {payerOpen && (
                <div className="px-4 pb-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label className="text-sm">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)</Label>
                      <Input
                        value={payerTaxId}
                        onChange={e => setPayerTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                        placeholder="0000000000000"
                        maxLength={13}
                        className="mt-1 font-mono"
                        data-testid="input-payer-tax-id"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">ชื่อ (บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</Label>
                      <Input
                        value={payerName}
                        onChange={e => setPayerName(e.target.value)}
                        placeholder="ชื่อผู้มีหน้าที่หักภาษี"
                        className="mt-1"
                        data-testid="input-payer-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">สาขา / สำนักงานใหญ่</Label>
                      <Input
                        value={payerBranch}
                        onChange={e => setPayerBranch(e.target.value)}
                        placeholder="สำนักงานใหญ่"
                        className="mt-1"
                        data-testid="input-payer-branch"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">ที่อยู่ (ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</Label>
                      <Input
                        value={payerAddress}
                        onChange={e => setPayerAddress(e.target.value)}
                        placeholder="ที่อยู่ผู้หักภาษี"
                        className="mt-1"
                        data-testid="input-payer-address"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (company) {
                          setPayerTaxId(company.taxId || "");
                          setPayerName(company.name || "");
                          setPayerBranch(company.branch || "สำนักงานใหญ่");
                          setPayerAddress(company.address || "");
                        }
                      }}
                      style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
                      data-testid="button-reset-payer"
                    >
                      ดึงจากข้อมูลบริษัทปัจจุบัน
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
                <p className="text-lg mb-2">ยังไม่มีข้อมูล</p>
                <p className="text-sm">กด "นำเข้า Excel" เพื่ออัปโหลดข้อมูลเงินเดือนจากภายนอก</p>
                <p className="text-sm mt-1">หรือกด "ดาวน์โหลดแบบฟอร์ม" เพื่อดูตัวอย่างรูปแบบไฟล์ที่รองรับ</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <span>จำนวน: <b>{rows.length}</b> ราย</span>
                  <span>รวมเงินได้: <b className="text-blue-600">{fmt(grandTotalEarnings)}</b></span>
                  <span>รวมภาษี: <b className="text-red-600">{fmt(grandTotalTax)}</b></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse" data-testid="table-imported-data">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border px-3 py-2 text-center w-12">ลำดับ</th>
                        <th className="border px-3 py-2 text-center w-36">เลขผู้เสียภาษี</th>
                        <th className="border px-3 py-2 text-left">ชื่อ-นามสกุล</th>
                        <th className="border px-3 py-2 text-left">ที่อยู่</th>
                        <th className="border px-3 py-2 text-right w-28">เงินได้ทั้งปี</th>
                        <th className="border px-3 py-2 text-right w-28">ภาษีทั้งปี</th>
                        <th className="border px-3 py-2 text-right w-24">ประกันสังคม</th>
                        <th className="border px-3 py-2 text-center w-20">50 ทวิ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.seq} className="hover:bg-gray-50" data-testid={`row-imported-${r.seq}`}>
                          <td className="border px-3 py-2 text-center">{r.seq}</td>
                          <td className="border px-3 py-2 text-center font-mono text-xs">{r.taxId || "-"}</td>
                          <td className="border px-3 py-2">{r.fullName}</td>
                          <td className="border px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">{r.address || "-"}</td>
                          <td className="border px-3 py-2 text-right">{fmt(r.annualEarnings)}</td>
                          <td className="border px-3 py-2 text-right">{fmt(r.annualTax)}</td>
                          <td className="border px-3 py-2 text-right">{r.ssoAmount > 0 ? fmt(r.ssoAmount) : "-"}</td>
                          <td className="border px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              style={{ borderColor: "#fb9678", color: "#fb9678" }}
                              onClick={() => { setPreviewRow(r); setPreviewOpen(true); }}
                              data-testid={`button-preview-50tawi-${r.seq}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />ดู
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={4} className="border px-3 py-2 text-right">รวมทั้งสิ้น ({rows.length} ราย)</td>
                        <td className="border px-3 py-2 text-right">{fmt(grandTotalEarnings)}</td>
                        <td className="border px-3 py-2 text-right">{fmt(grandTotalTax)}</td>
                        <td className="border px-3 py-2 text-right">{rows.reduce((s, r) => s + r.ssoAmount, 0) > 0 ? fmt(rows.reduce((s, r) => s + r.ssoAmount, 0)) : "-"}</td>
                        <td className="border px-3 py-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <div ref={printRef}>
            {rows.map(r => (
              <FiftyTawiA4 key={r.seq} company={payerData} row={r} yearBE={yearBE} />
            ))}
          </div>
        </div>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[240mm] max-h-[90vh] overflow-auto p-4" data-testid="dialog-preview-50tawi">
            <DialogHeader>
              <DialogTitle>50 ทวิ - {previewRow?.fullName}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-3">
              <Button onClick={handlePrintSingle50Tawi} variant="outline" style={{ borderColor: "#fb9678", color: "#fb9678" }} data-testid="button-print-single-50tawi">
                <Printer className="h-4 w-4 mr-2" />พิมพ์
              </Button>
            </div>
            {previewRow && (
              <div ref={singlePrintRef}>
                <FiftyTawiA4 company={payerData} row={previewRow} yearBE={yearBE} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </HRLayout>
  );
}