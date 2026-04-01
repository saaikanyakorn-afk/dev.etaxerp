import { useState } from "react";
import { useToast } from "./use-toast";

interface DBDResult {
  name: string;
  address: string;
  branch: string;
  source?: string;
  contactId?: number;
  phone?: string;
  email?: string;
}

async function serverDBDLookup(taxId: string): Promise<{ result: DBDResult | null; status: "found" | "not_found" | "error" }> {
  try {
    const res = await fetch(`/api/dbd-lookup/${taxId}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return { result: data, status: "found" };
    }
    if (res.status === 404) {
      return { result: null, status: "not_found" };
    }
    return { result: null, status: "error" };
  } catch {
    return { result: null, status: "error" };
  }
}

async function serverDBDSearch(query: string): Promise<DBDResult[]> {
  try {
    const res = await fetch(`/api/dbd-search?q=${encodeURIComponent(query)}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
    return [];
  } catch {
    return [];
  }
}

export function useDbdLookup() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const lookup = async (taxId: string): Promise<DBDResult | null> => {
    const cleanId = taxId.replace(/\D/g, "");
    if (!cleanId || cleanId.length !== 13) {
      toast({ title: "เลขนิติบุคคลต้องมี 13 หลัก", variant: "destructive" });
      return null;
    }
    setLoading(true);
    try {
      toast({ title: "กำลังค้นหาข้อมูล..." });
      const serverResult = await serverDBDLookup(cleanId);
      if (serverResult.result) {
        const src = serverResult.result.source === "local" ? "จากรายชื่อในระบบ" : "จาก DBD";
        toast({ title: `พบข้อมูล ${src}: ${serverResult.result.name}` });
        return serverResult.result;
      }

      if (serverResult.status === "not_found") {
        toast({ title: "ไม่พบข้อมูลนิติบุคคลสำหรับเลขนี้", variant: "destructive" });
      } else {
        toast({ title: "ไม่สามารถค้นหาได้ กรุณาลองใหม่", variant: "destructive" });
      }
      return null;
    } catch {
      toast({ title: "เกิดข้อผิดพลาดในการค้นหา", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const search = async (query: string): Promise<DBDResult[]> => {
    if (!query || query.length < 2) return [];
    setLoading(true);
    try {
      const results = await serverDBDSearch(query);
      return results;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { lookup, search, loading };
}
