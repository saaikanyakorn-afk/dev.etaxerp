import { useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface VatClosingResult {
  closed: boolean;
  closedAt?: string;
  pastDeadline?: boolean;
  deadlineMonth?: number;
  deadlineYear?: number;
}

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export function useVatClosingCheck() {
  const checkVatClosed = useCallback(async (companyId: number, docDate: string): Promise<VatClosingResult | null> => {
    if (!companyId || !docDate) return null;
    try {
      const res = await apiRequest("GET", `/api/vat-closing-check?companyId=${companyId}&docDate=${docDate}`);
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const buildWarningMessage = useCallback((result: VatClosingResult, docDate: string): { title: string; description: string } => {
    const d = new Date(docDate);
    const m = d.getMonth() + 1;
    const y = d.getFullYear() + 543;
    const monthName = THAI_MONTHS[m] || "";

    if (result.pastDeadline) {
      return {
        title: "⚠️ เกินกำหนดยื่น VAT",
        description: `เดือน${monthName} ${y} ปิด VAT แล้ว และเลยกำหนดยื่นวันที่ 23 แล้ว ภาษีซื้อจะถูกนำไปใส่รายงานเดือนถัดไป และอาจมีภาษีที่ต้องจ่ายเพิ่มเติม ต้องการบันทึกต่อหรือไม่?`
      };
    }
    return {
      title: "⚠️ เดือนนี้ปิด VAT แล้ว",
      description: `เดือน${monthName} ${y} ปิด VAT แล้ว ภาษีซื้อจะถูกนำไปใส่รายงานเดือนถัดไปให้อัตโนมัติ ต้องการบันทึกต่อหรือไม่?`
    };
  }, []);

  return { checkVatClosed, buildWarningMessage };
}
