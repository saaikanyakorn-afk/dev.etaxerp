import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";
import Layout from "@/components/layout";

import { useDateSettings } from "@/hooks/use-date-settings";
const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  if (n === 0) return "";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORM_TYPE_LABELS: Record<string, string> = {
  pnd3: "ภ.ง.ด.3",
  pnd53: "ภ.ง.ด.53",
  pnd1: "ภ.ง.ด.1",
  pnd1a: "ภ.ง.ด.1ก",
  pnd2: "ภ.ง.ด.2",
};

const ROWS_PER_PAGE: Record<string, number> = {
  pnd1: 8,
  pnd1a: 7,
  pnd2: 7,
  pnd3: 6,
  pnd53: 6,
};

interface WhtRow {
  id: number;
  certNo: string;
  payeeName: string;
  payeeTaxId: string;
  payeeAddress: string;
  payeeBranch: string;
  paidDate: string;
  incomeType: string;
  incomeDescription: string;
  taxRate: string;
  amountPaid: string;
  taxWithheld: string;
  formType: string;
  condition: string;
}

const thS: React.CSSProperties = {
  border: "1px solid black", padding: "2px 3px", textAlign: "center",
  fontWeight: 700, fontSize: "8.5px", verticalAlign: "middle", lineHeight: 1.2,
};
const tdS: React.CSSProperties = {
  border: "1px solid black", padding: "1px 3px", verticalAlign: "top", fontSize: "8.5px", lineHeight: 1.3,
};
const dotLine = "....................................................................................";
const longDotLine = "....................................................................................................................................................................................................................................";

function TaxIdBoxes({ taxId, label }: { taxId: string; label?: string }) {
  const digits = (taxId || "").replace(/\D/g, "").padEnd(13, " ").split("").slice(0, 13);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "9px" }}>
      {label && <span style={{ marginRight: "2px", whiteSpace: "nowrap" }}>{label}</span>}
      <div style={{ display: "flex", gap: "0px" }}>
        {digits.map((d, i) => (
          <span key={i} style={{
            display: "inline-block", width: "14px", height: "16px", border: "1px solid black",
            textAlign: "center", lineHeight: "16px", fontSize: "10px", fontWeight: 600,
            marginLeft: (i === 1 || i === 5 || i === 10 || i === 12) ? "3px" : "0",
          }}>{d.trim()}</span>
        ))}
      </div>
    </div>
  );
}

function ConditionNotes({ formType }: { formType: string }) {
  if (formType === "pnd53") {
    return (
      <div style={{ fontSize: "8px", marginTop: "2px" }}>
        <div>เงื่อนไขการหักภาษี ณ ที่จ่ายให้กรอกดังนี้</div>
        <div style={{ marginLeft: "16px" }}>หัก ณ ที่จ่าย กรอก 1</div>
        <div style={{ marginLeft: "16px" }}>ออกภาษีให้ กรอก 2</div>
      </div>
    );
  }
  return (
    <div style={{ fontSize: "8px", marginTop: "2px" }}>
      <div>* เงื่อนไขการหักภาษีให้กรอกดังนี้</div>
      <div style={{ marginLeft: "16px" }}>หัก ณ ที่จ่าย กรอก 1</div>
      <div style={{ marginLeft: "16px" }}>ออกให้ตลอดไป กรอก 2</div>
      <div style={{ marginLeft: "16px" }}>ออกให้ครั้งเดียว กรอก 3</div>
    </div>
  );
}

function SignatureBlock({ formType }: { formType: string }) {
  return (
    <div style={{ textAlign: "right", fontSize: "8.5px", marginTop: "4px" }}>
      <div>ลงชื่อ {dotLine} ผู้จ่ายเงิน</div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px", marginTop: "2px" }}>
        <div style={{ border: "1px solid black", width: "60px", height: "40px", textAlign: "center", fontSize: "7px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div>ประทับตรา</div><div>นิติบุคคล</div><div>(ถ้ามี)</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div>({dotLine})</div>
          <div>ตำแหน่ง {dotLine}</div>
          <div>ยื่นวันที่ ......... เดือน ........................... พ.ศ. ............</div>
        </div>
      </div>
    </div>
  );
}

function IncomeTypeCheckboxes({ formType }: { formType: string }) {
  if (formType === "pnd1" || formType === "pnd1a") {
    return (
      <div style={{ fontSize: "8px", marginBottom: "3px", border: "0px", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, marginBottom: "1px" }}>(ให้แยกกรอกรายการในใบแนบนี้ตามเงินได้แต่ละประเภท โดยใส่เครื่องหมาย "✓" ลงใน "☐" หน้าข้อความแล้วแต่กรณี เพียงข้อเดียว)</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div>ประเภทเงินได้</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div>☐ (1) เงินได้ตามมาตรา 40 (1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป</div>
            <div>☐ (3) เงินได้ตามมาตรา 40 (1)(2) กรณีนายจ้างจ่ายให้ครั้งเดียวเพราะเหตุออกจากงาน</div>
            <div>☐ (2) เงินได้ตามมาตรา 40 (1) เงินเดือน ค่าจ้าง ฯลฯ กรณีได้รับอนุมัติจากกรมสรรพากรให้หักอัตราร้อยละ 3</div>
            <div>☐ (4) เงินได้ตามมาตรา 40 (2) กรณีผู้รับเงินได้เป็นผู้อยู่ในประเทศไทย</div>
            <div>&nbsp;</div>
            <div>☐ (5) เงินได้ตามมาตรา 40 (2) กรณีผู้รับเงินได้มิได้เป็นผู้อยู่ในประเทศไทย</div>
          </div>
        </div>
      </div>
    );
  }
  if (formType === "pnd2") {
    return (
      <div style={{ fontSize: "8px", marginBottom: "3px", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, marginBottom: "1px" }}>(ให้แยกกรอกรายการในใบแนบนี้ตามเงินได้แต่ละประเภท โดยใส่เครื่องหมาย "✓" ลงใน "☐" หน้าข้อความแล้วแต่กรณี เพียงข้อเดียว)</div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div>ประเภทเงินได้</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div>☐ (1) เงินได้ตามมาตรา 40 (3) ค่าแห่งลิขสิทธิ์ ค่าแห่งกู๊ดวิลล์ ฯลฯ</div>
            <div>☐ (3) เงินได้ตามมาตรา 40 (4)(ข) เงินปันผล ฯลฯ</div>
            <div>☐ (2) เงินได้ตามมาตรา 40 (4)(ก) ดอกเบี้ยเงินฝาก ดอกเบี้ยพันธบัตร ดอกเบี้ยตั๋วเงิน ฯลฯ</div>
            <div>☐ (4) เงินได้ตามมาตรา 40 (4)(ช) เงินผลประโยชน์ที่ได้จากการโอนหุ้น ฯลฯ</div>
            <div>&nbsp;</div>
            <div>☐ (5) เงินได้ตามมาตรา 40 (4) อื่นๆ</div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function FormNotes({ formType }: { formType: string }) {
  if (formType === "pnd3") {
    return (
      <div style={{ fontSize: "7.5px", marginTop: "2px" }}>
        <div><b>หมายเหตุ</b> ให้ระบุว่าจ่ายเป็นค่าอะไร เช่น ค่าเช่าอาคาร ค่าสอบบัญชี ค่าทนายความ ค่าวิชาชีพของแพทย์ ค่าก่อสร้าง รางวัล</div>
        <div style={{ marginLeft: "42px" }}>ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าจ้างแสดงภาพยนตร์ ร้องเพลงดนตรี ค่าจ้างทำของ ค่าจ้างโฆษณา ค่าขนส่งสินค้า ฯลฯ</div>
      </div>
    );
  }
  if (formType === "pnd53") {
    return (
      <div style={{ fontSize: "7.5px", marginTop: "2px" }}>
        <div><b>หมายเหตุ</b> ให้ระบุว่าจ่ายเป็นค่าอะไร เช่น ค่านายหน้า ค่าแห่งกู๊ดวิลล์ ดอกเบี้ยเงินฝาก ดอกเบี้ยตั๋วเงิน เงินปันผล เงินส่วนแบ่งกำไร</div>
        <div style={{ marginLeft: "42px" }}>ค่าเช่าอาคาร ค่าสอบบัญชี ค่าออกแบบ ค่าก่อสร้าง ค่าซื้อพืชผลทางการเกษตร ค่าจ้างทำของ ค่าจ้างโฆษณา รางวัล ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย ค่าขนส่งสินค้า ค่าเบี้ยประกันวินาศภัย</div>
      </div>
    );
  }
  if (formType === "pnd2") {
    return (
      <div style={{ fontSize: "7.5px", marginTop: "2px" }}>
        <div><b>หมายเหตุ</b> ให้กรอกเฉพาะกรณีจ่ายดอกเบี้ยเงินฝาก</div>
      </div>
    );
  }
  return null;
}

function renderPnd1Table(pageRows: WhtRow[], emptyCount: number, pageStart: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, dateEra: string = "CE", dateFmt: string = "DD/MM/YYYY") {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
      <thead>
        <tr>
          <th style={{ ...thS, width: "30px" }} rowSpan={2}>ลำดับ<br/>ที่</th>
          <th style={{ ...thS, width: "110px" }} rowSpan={2}>เลขประจำตัวผู้เสียภาษีอากร<br/>(ของผู้มีเงินได้)</th>
          <th style={{ ...thS }} rowSpan={2}>ชื่อผู้มีเงินได้<br/><span style={{ fontSize: "7.5px", fontWeight: 400 }}>(ให้ระบุชัดเจนว่าเป็น นาย นาง นางสาว หรือยศ)</span></th>
          <th style={{ ...thS, width: "70px" }} colSpan={1} rowSpan={2}>วัน เดือน ปี<br/>ที่จ่าย</th>
          <th style={{ ...thS, width: "90px" }} rowSpan={2}>จำนวนเงินได้<br/>ที่จ่ายในครั้งนี้</th>
          <th style={{ ...thS, width: "90px" }} rowSpan={2}>จำนวนเงินภาษีที่หัก<br/>และนำส่งในครั้งนี้</th>
          <th style={{ ...thS, width: "35px" }} rowSpan={2}>เงื่อน<br/>ไข *</th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((row, idx) => (
          <tr key={row.id}>
            <td style={{ ...tdS, textAlign: "center" }}>{pageStart + idx + 1}</td>
            <td style={{ ...tdS, fontSize: "8px" }}>{row.payeeTaxId}</td>
            <td style={tdS}>{row.payeeName}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{formatDate(row.paidDate, dateEra, dateFmt)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.amountPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.taxWithheld)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{row.condition || "1"}</td>
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`e-${i}`}>
            <td style={{ ...tdS, height: "20px" }}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
          </tr>
        ))}
        {renderTotalRows(7, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, "pnd1")}
      </tbody>
    </table>
  );
}

function renderPnd1aTable(pageRows: WhtRow[], emptyCount: number, pageStart: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, dateEra: string = "CE", dateFmt: string = "DD/MM/YYYY") {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
      <thead>
        <tr>
          <th style={{ ...thS, width: "30px" }} rowSpan={2}>ลำดับ<br/>ที่</th>
          <th style={{ ...thS, width: "100px" }} rowSpan={2}>เลขประจำตัวผู้เสียภาษีอากร<br/>(ของผู้มีเงินได้)</th>
          <th style={thS} rowSpan={2}>
            ชื่อผู้มีเงินได้ <span style={{ fontSize: "7.5px", fontWeight: 400 }}>(ให้ระบุให้ชัดเจนว่าเป็น นาย นาง นางสาว หรือยศ)</span>
            <br/>ที่อยู่ของผู้มีเงินได้ <span style={{ fontSize: "7.5px", fontWeight: 400 }}>(ให้ระบุเลขที่ ตรอก/ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</span>
          </th>
          <th style={{ ...thS, width: "90px" }} rowSpan={2}>จำนวนเงินได้<br/>ที่จ่ายทั้งปี</th>
          <th style={{ ...thS, width: "90px" }} rowSpan={2}>จำนวนเงินภาษีที่หัก<br/>และนำส่งทั้งปี</th>
          <th style={{ ...thS, width: "35px" }} rowSpan={2}>เงื่อน<br/>ไข *</th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((row, idx) => (
          <tr key={row.id}>
            <td style={{ ...tdS, textAlign: "center" }}>{pageStart + idx + 1}</td>
            <td style={{ ...tdS, fontSize: "8px" }}>{row.payeeTaxId}</td>
            <td style={tdS}>
              <div>ชื่อ {row.payeeName}</div>
              <div style={{ fontSize: "8px", color: "#333" }}>ที่อยู่ {row.payeeAddress || ""}</div>
            </td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.amountPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.taxWithheld)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{row.condition || "1"}</td>
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`e-${i}`}>
            <td style={{ ...tdS, height: "28px" }}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>
              <div style={{ borderBottom: "1px dotted #999", marginBottom: "2px" }}>ชื่อ {dotLine} ชื่อสกุล {dotLine}</div>
              <div style={{ borderBottom: "1px dotted #999" }}>ที่อยู่ {longDotLine}</div>
            </td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
          </tr>
        ))}
        {renderTotalRows(6, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, "pnd1a")}
      </tbody>
    </table>
  );
}

function renderPnd2Table(pageRows: WhtRow[], emptyCount: number, pageStart: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, dateEra: string = "CE", dateFmt: string = "DD/MM/YYYY") {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
      <thead>
        <tr>
          <th style={{ ...thS, width: "28px" }} rowSpan={2}>ลำดับ<br/>ที่</th>
          <th style={{ ...thS, width: "100px" }} rowSpan={2}>
            เลขประจำตัวผู้เสียภาษีอากร<br/>(ของผู้มีเงินได้)
            <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid black" }} />
            เลขที่บัญชีเงินฝาก<br/>(ของผู้มีเงินได้)
          </th>
          <th style={thS} rowSpan={2}>ชื่อผู้มีเงินได้<br/><span style={{ fontSize: "7.5px", fontWeight: 400 }}>(ให้ระบุให้ชัดเจนว่าเป็น นาย นาง นางสาว หรือยศ)</span></th>
          <th style={{ ...thS }} colSpan={4}>รายละเอียดเกี่ยวกับการจ่ายเงิน</th>
          <th style={{ ...thS, width: "80px" }} rowSpan={2}>จำนวนเงินภาษีที่หัก<br/>และนำส่งในครั้งนี้</th>
          <th style={{ ...thS, width: "32px" }} rowSpan={2}>เงื่อน<br/>ไข</th>
        </tr>
        <tr>
          <th style={{ ...thS, width: "65px" }}>วัน เดือน ปี<br/>ที่จ่าย</th>
          <th style={{ ...thS, width: "35px" }}>อัตรา<br/>ภาษี<br/>ร้อยละ</th>
          <th style={{ ...thS, width: "80px" }}>จำนวนเงินได้<br/>ที่จ่ายในครั้งนี้</th>
          <th style={{ ...thS, width: "1px", padding: 0, border: "none" }}></th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((row, idx) => (
          <tr key={row.id}>
            <td style={{ ...tdS, textAlign: "center" }}>{pageStart + idx + 1}</td>
            <td style={{ ...tdS, fontSize: "8px" }}>{row.payeeTaxId}</td>
            <td style={tdS}>{row.payeeName}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{formatDate(row.paidDate, dateEra, dateFmt)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{Number(row.taxRate || 0) > 0 ? Number(row.taxRate).toFixed(0) : ""}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.amountPaid)}</td>
            <td style={{ ...tdS, border: "none" }}></td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.taxWithheld)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{row.condition || "1"}</td>
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`e-${i}`}>
            <td style={{ ...tdS, height: "22px" }}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={{ ...tdS, border: "none" }}></td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
          </tr>
        ))}
        {renderTotalRows2(6, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, "pnd2")}
      </tbody>
    </table>
  );
}

function renderPnd3Table(pageRows: WhtRow[], emptyCount: number, pageStart: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, dateEra: string = "CE", dateFmt: string = "DD/MM/YYYY") {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
      <thead>
        <tr>
          <th style={{ ...thS, width: "25px" }} rowSpan={3}>ลำดับ<br/>ที่</th>
          <th style={{ ...thS, width: "90px" }} rowSpan={3}>
            เลขประจำตัวผู้เสียภาษีอากร<br/>(ของผู้มีเงินได้)
            <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid black" }} />
            ชื่อผู้มีเงินได้<br/><span style={{ fontSize: "7px", fontWeight: 400 }}>(ให้ระบุชัดเจนว่าเป็น นาย นาง นางสาว หรือยศ)</span>
            <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid black" }} />
            ที่อยู่ของผู้มีเงินได้<br/><span style={{ fontSize: "7px", fontWeight: 400 }}>(ให้ระบุเลขที่ ตรอก/ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</span>
          </th>
          <th style={{ ...thS, width: "40px" }} rowSpan={3}>สาขา<br/>ที่</th>
          <th style={thS} colSpan={6}>รายละเอียดเกี่ยวกับการจ่ายเงิน</th>
          <th style={{ ...thS, width: "70px" }} rowSpan={3}>รวมเงินภาษี<br/>ที่หักและนำส่ง<br/>ในครั้งนี้</th>
          <th style={{ ...thS, width: "30px" }} rowSpan={3}>เงื่อน<br/>ไข</th>
        </tr>
        <tr>
          <th style={{ ...thS, width: "60px" }} rowSpan={2}>วัน เดือน ปี<br/>ที่จ่าย</th>
          <th style={thS} colSpan={2}>ประเภทเงินได้<br/><span style={{ fontSize: "7px", fontWeight: 400 }}>(ถ้ามากกว่าหนึ่งประเภทให้กรอกเรียงลงไป)</span></th>
          <th style={{ ...thS, width: "32px" }} rowSpan={2}>อัตรา<br/>ภาษี<br/>ร้อยละ</th>
          <th style={{ ...thS, width: "70px" }} colSpan={2}>จำนวนเงินที่จ่าย<br/>แต่ละประเภท<br/>เฉพาะคนหนึ่งๆ<br/>ในครั้งนี้</th>
        </tr>
        <tr>
          <th style={thS}>มาตรา</th>
          <th style={thS}>รายละเอียด</th>
          <th style={thS} colSpan={2}>&nbsp;</th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((row, idx) => (
          <tr key={row.id} style={{ borderBottom: "1px solid black" }}>
            <td style={{ ...tdS, textAlign: "center" }}>{pageStart + idx + 1}</td>
            <td style={tdS}>
              <div style={{ fontSize: "8px" }}>{row.payeeTaxId}</div>
              <div style={{ borderTop: "1px dotted #aaa", paddingTop: "1px" }}>ชื่อ {row.payeeName}</div>
              <div style={{ borderTop: "1px dotted #aaa", paddingTop: "1px", fontSize: "7.5px" }}>ที่อยู่ {row.payeeAddress || ""}</div>
            </td>
            <td style={{ ...tdS, textAlign: "center", fontSize: "8px" }}>{row.payeeBranch || "00000"}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{formatDate(row.paidDate, dateEra, dateFmt)}</td>
            <td style={{ ...tdS, textAlign: "center", fontSize: "8px" }}>{row.incomeType || ""}</td>
            <td style={{ ...tdS, fontSize: "7.5px" }}>{row.incomeDescription || ""}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{Number(row.taxRate || 0) > 0 ? Number(row.taxRate).toFixed(0) : ""}</td>
            <td style={{ ...tdS, textAlign: "right" }} colSpan={2}>{fmt(row.amountPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.taxWithheld)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{row.condition || "1"}</td>
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`e-${i}`} style={{ borderBottom: "1px solid black" }}>
            <td style={{ ...tdS, height: "30px" }}>&nbsp;</td>
            <td style={tdS}>
              <div style={{ borderBottom: "1px dotted #ccc", marginBottom: "1px" }}>&nbsp;</div>
              <div style={{ borderBottom: "1px dotted #ccc", marginBottom: "1px" }}>ชื่อ {dotLine} ชื่อสกุล {dotLine}</div>
              <div>ที่อยู่ {longDotLine}</div>
            </td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS} colSpan={2}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
          </tr>
        ))}
        {renderTotalRows3(9, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, "pnd3")}
      </tbody>
    </table>
  );
}

function renderPnd53Table(pageRows: WhtRow[], emptyCount: number, pageStart: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, dateEra: string = "CE", dateFmt: string = "DD/MM/YYYY") {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5px" }}>
      <thead>
        <tr>
          <th style={{ ...thS, width: "25px" }} rowSpan={3}>ลำดับ<br/>ที่</th>
          <th style={{ ...thS, width: "120px" }} rowSpan={3}>
            เลขประจำตัวผู้เสียภาษีอากร<br/>(ของผู้มีเงินได้)
            <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid black" }} />
            ชื่อและที่อยู่ของผู้มีเงินได้<br/><span style={{ fontSize: "7px", fontWeight: 400 }}>(ให้ระบุชัดเจนว่าเป็น บริษัทจำกัด ห้างหุ้นส่วนจำกัด<br/>หรือห้างหุ้นส่วนสามัญนิติบุคคล<br/>และให้ระบุเลขที่ ตรอก/ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</span>
          </th>
          <th style={{ ...thS, width: "40px" }} rowSpan={3}>สาขา<br/>ที่</th>
          <th style={thS} colSpan={4}>รายละเอียดเกี่ยวกับการจ่ายเงิน</th>
          <th style={{ ...thS, width: "70px" }} rowSpan={3}>จำนวนเงินภาษี<br/>ที่หักและนำส่ง<br/>ในครั้งนี้</th>
          <th style={{ ...thS, width: "30px" }} rowSpan={3}>เงื่อน<br/>ไข</th>
        </tr>
        <tr>
          <th style={{ ...thS, width: "60px" }} rowSpan={2}>วัน เดือน ปี<br/>ที่จ่าย</th>
          <th style={thS} rowSpan={2}>ประเภทเงินได้<br/>พึงประเมินที่จ่าย</th>
          <th style={{ ...thS, width: "32px" }} rowSpan={2}>อัตรา<br/>ภาษี<br/>ร้อยละ</th>
          <th style={{ ...thS, width: "70px" }} rowSpan={2}>จำนวนเงิน<br/>ที่จ่ายในครั้งนี้</th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((row, idx) => (
          <tr key={row.id} style={{ borderBottom: "1px solid black" }}>
            <td style={{ ...tdS, textAlign: "center" }}>{pageStart + idx + 1}</td>
            <td style={tdS}>
              <div style={{ fontSize: "8px" }}>{row.payeeTaxId}</div>
              <div style={{ borderTop: "1px dotted #aaa", paddingTop: "1px" }}>ชื่อ {row.payeeName}</div>
              <div style={{ borderTop: "1px dotted #aaa", paddingTop: "1px", fontSize: "7.5px" }}>ที่อยู่ {row.payeeAddress || ""}</div>
            </td>
            <td style={{ ...tdS, textAlign: "center", fontSize: "8px" }}>{row.payeeBranch || "00000"}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{formatDate(row.paidDate, dateEra, dateFmt)}</td>
            <td style={{ ...tdS, fontSize: "7.5px" }}>{row.incomeDescription || row.incomeType || ""}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{Number(row.taxRate || 0) > 0 ? Number(row.taxRate).toFixed(0) : ""}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.amountPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(row.taxWithheld)}</td>
            <td style={{ ...tdS, textAlign: "center" }}>{row.condition || "1"}</td>
          </tr>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <tr key={`e-${i}`} style={{ borderBottom: "1px solid black" }}>
            <td style={{ ...tdS, height: "36px" }}>&nbsp;</td>
            <td style={tdS}>
              <div style={{ borderBottom: "1px dotted #ccc", marginBottom: "1px" }}>&nbsp;</div>
              <div style={{ borderBottom: "1px dotted #ccc", marginBottom: "1px" }}>ชื่อ {dotLine}</div>
              <div>ที่อยู่ {longDotLine}</div>
            </td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
            <td style={tdS}>&nbsp;</td>
          </tr>
        ))}
        {renderTotalRows(7, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, "pnd53")}
      </tbody>
    </table>
  );
}

function renderTotalRows(colSpan: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, formType: string) {
  const label = FORM_TYPE_LABELS[formType] || formType;
  return (
    <>
      <tr style={{ fontWeight: 700 }}>
        <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", fontSize: "8px" }}>
          รวมยอดเงินได้และภาษีที่นำส่ง (นำไปรวมกับใบแนบ {label} แผ่นอื่น (ถ้ามี))
        </td>
        <td style={{ ...tdS, textAlign: "right" }}>{fmt(pageTotalPaid)}</td>
        <td style={{ ...tdS, textAlign: "right" }}>{fmt(pageTotalTax)}</td>
      </tr>
      {totalPages > 1 && (
        <>
          <tr style={{ fontWeight: 600, fontSize: "8px" }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>ยอดยกมา</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(prevPagesTotalPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(prevPagesTotalTax)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>รวมทั้งสิ้น</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(runningTotalPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(runningTotalTax)}</td>
          </tr>
        </>
      )}
    </>
  );
}

function renderTotalRows2(colSpan: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, formType: string) {
  const label = FORM_TYPE_LABELS[formType] || formType;
  return (
    <>
      <tr style={{ fontWeight: 700 }}>
        <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", fontSize: "8px" }}>
          รวมยอดเงินได้และภาษีที่นำส่ง (นำไปรวมกับใบแนบ {label} แผ่นอื่น (ถ้ามี))
        </td>
        <td style={{ ...tdS, border: "none" }}></td>
        <td style={{ ...tdS, textAlign: "right" }}>{fmt(pageTotalPaid)}</td>
        <td style={{ ...tdS, textAlign: "right" }}>{fmt(pageTotalTax)}</td>
      </tr>
      {totalPages > 1 && (
        <>
          <tr style={{ fontWeight: 600, fontSize: "8px" }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>ยอดยกมา</td>
            <td style={{ ...tdS, border: "none" }}></td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(prevPagesTotalPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(prevPagesTotalTax)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>รวมทั้งสิ้น</td>
            <td style={{ ...tdS, border: "none" }}></td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(runningTotalPaid)}</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(runningTotalTax)}</td>
          </tr>
        </>
      )}
    </>
  );
}

function renderTotalRows3(colSpan: number, pageTotalPaid: number, pageTotalTax: number, totalPages: number, runningTotalPaid: number, runningTotalTax: number, prevPagesTotalPaid: number, prevPagesTotalTax: number, grandTotalPaid: number, grandTotalTax: number, formType: string) {
  const label = FORM_TYPE_LABELS[formType] || formType;
  return (
    <>
      <tr style={{ fontWeight: 700 }}>
        <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", fontSize: "8px" }}>
          รวมยอดเงินได้และภาษีที่นำส่ง (นำไปรวมกับใบแนบ {label} แผ่นอื่น (ถ้ามี))
        </td>
        <td style={{ ...tdS, textAlign: "right" }}>{fmt(pageTotalTax)}</td>
        <td style={{ ...tdS, textAlign: "center" }}>&nbsp;</td>
      </tr>
      {totalPages > 1 && (
        <>
          <tr style={{ fontWeight: 600, fontSize: "8px" }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>ยอดยกมา</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(prevPagesTotalTax)}</td>
            <td style={{ ...tdS, border: "none" }}>&nbsp;</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={colSpan} style={{ ...tdS, textAlign: "right", paddingRight: "6px", border: "none" }}>รวมทั้งสิ้น</td>
            <td style={{ ...tdS, textAlign: "right" }}>{fmt(runningTotalTax)}</td>
            <td style={{ ...tdS, border: "none" }}>&nbsp;</td>
          </tr>
        </>
      )}
    </>
  );
}

export default function WhtAttachmentPrint() {
  const [, navigate] = useLocation();
  const [rows, setRows] = useState<WhtRow[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const params = new URLSearchParams(window.location.search);
  const companyId = params.get("companyId");
  const month = params.get("month") || "";
  const year = params.get("year") || "";
  const formType = params.get("formType") || "pnd3";

  const formLabel = FORM_TYPE_LABELS[formType] || formType;
  const monthIdx = parseInt(month) - 1;
  const monthLabel = THAI_MONTHS[monthIdx] || month;
  const rowsPerPage = ROWS_PER_PAGE[formType] || 6;

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      try {
        const [certRes, companyRes] = await Promise.all([
          fetch(`/api/reports/wht/summary?companyId=${companyId}&month=${month}&year=${year}&formType=${formType}`, { credentials: "include" }),
          fetch(`/api/companies/${companyId}`, { credentials: "include" }),
        ]);
        if (certRes.ok) setRows(await certRes.json());
        if (companyRes.ok) setCompany(await companyRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [companyId, month, year, formType]);

  const { dateEra, dateFmt } = useDateSettings();
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
  const handlePrint = () => window.print();

  const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;
  const pages: WhtRow[][] = [];
  for (let i = 0; i < totalPages; i++) {
    pages.push(rows.slice(i * rowsPerPage, (i + 1) * rowsPerPage));
  }

  const grandTotalPaid = rows.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
  const grandTotalTax = rows.reduce((s, r) => s + Number(r.taxWithheld || 0), 0);

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">กำลังโหลด...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="print:hidden flex items-center gap-3 mb-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/purchases/wht")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
        <Button onClick={handlePrint} className="bg-[#03c9d7] hover:bg-[#02b0bd] text-white" data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> พิมพ์ / บันทึก PDF
        </Button>
        <span className="text-sm text-muted-foreground">ใบแนบ {formLabel} เดือน {monthLabel} พ.ศ. {year}</span>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          body * { visibility: hidden; }
          #wht-attachment-print, #wht-attachment-print * { visibility: visible; }
          #wht-attachment-print { position: absolute; left: 0; top: 0; width: 100%; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <div id="wht-attachment-print" ref={printRef}>
        {pages.map((pageRows, pageIdx) => {
          const pageStart = pageIdx * rowsPerPage;
          const pageTotalPaid = pageRows.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
          const pageTotalTax = pageRows.reduce((s, r) => s + Number(r.taxWithheld || 0), 0);
          const prevPagesTotalPaid = rows.slice(0, pageStart).reduce((s, r) => s + Number(r.amountPaid || 0), 0);
          const prevPagesTotalTax = rows.slice(0, pageStart).reduce((s, r) => s + Number(r.taxWithheld || 0), 0);
          const runningTotalPaid = prevPagesTotalPaid + pageTotalPaid;
          const runningTotalTax = prevPagesTotalTax + pageTotalTax;
          const emptyCount = rowsPerPage - pageRows.length;

          return (
            <div key={pageIdx} className="print-page" style={{
              width: "297mm", minHeight: "210mm", fontFamily: "'Sarabun', sans-serif",
              fontSize: "9px", padding: "5mm 7mm", background: "white", color: "black",
              boxSizing: "border-box", margin: "0 auto 16px", lineHeight: 1.25,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>ใบแนบ</span>
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>{formLabel}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <TaxIdBoxes taxId={company?.taxId || ""} label="เลขประจำตัวผู้เสียภาษีอากร (ของผู้มีหน้าที่หักภาษี ณ ที่จ่าย)" />
                  <div style={{ marginTop: "2px", fontSize: "9px" }}>
                    สาขาที่ <span style={{ borderBottom: "1px dotted black", display: "inline-block", minWidth: "50px", textAlign: "center" }}>{company?.branch || "สำนักงานใหญ่"}</span>
                    &nbsp;&nbsp;&nbsp;แผ่นที่ <b>{pageIdx + 1}</b> ในจำนวน <b>{totalPages}</b> แผ่น
                  </div>
                </div>
              </div>

              <IncomeTypeCheckboxes formType={formType} />

              {formType === "pnd1" && renderPnd1Table(pageRows, emptyCount, pageStart, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, dateEra, dateFmt)}
              {formType === "pnd1a" && renderPnd1aTable(pageRows, emptyCount, pageStart, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, dateEra, dateFmt)}
              {formType === "pnd2" && renderPnd2Table(pageRows, emptyCount, pageStart, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, dateEra, dateFmt)}
              {formType === "pnd3" && renderPnd3Table(pageRows, emptyCount, pageStart, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, dateEra, dateFmt)}
              {formType === "pnd53" && renderPnd53Table(pageRows, emptyCount, pageStart, pageTotalPaid, pageTotalTax, totalPages, runningTotalPaid, runningTotalTax, prevPagesTotalPaid, prevPagesTotalTax, grandTotalPaid, grandTotalTax, dateEra, dateFmt)}

              {(formType === "pnd1" || formType === "pnd1a" || formType === "pnd2") && (
                <div style={{ fontSize: "7.5px", marginTop: "1px" }}>(ให้กรอกลำดับที่ต่อเนื่องกันไปทุกแผ่นตามเงินได้แต่ละประเภท)</div>
              )}
              {(formType === "pnd3" || formType === "pnd53") && (
                <div style={{ fontSize: "7.5px", marginTop: "1px" }}>(ให้กรอกลำดับที่ต่อเนื่องกันไปทุกแผ่น)</div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", alignItems: "flex-start" }}>
                <div>
                  <FormNotes formType={formType} />
                  <ConditionNotes formType={formType} />
                  <div style={{ fontSize: "7px", marginTop: "4px", color: "#666" }}>สอบถามข้อมูลเพิ่มเติมได้ที่ศูนย์สารนิเทศสรรพากร โทร. 1161</div>
                </div>
                <SignatureBlock formType={formType} />
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
