import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NativePdfViewerProps {
  docType: string;
  docId: number;
  printType?: string;
}

export default function NativePdfViewer({ docType, docId, printType }: NativePdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  const fetchPdf = async () => {
    setLoading(true);
    setError(null);
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    try {
      const params = new URLSearchParams();
      if (printType) params.set("printType", printType);
      params.set("inline", "1");
      const url = `/api/documents/${docType}/${docId}/pdf?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      prevUrlRef.current = objectUrl;
      setPdfUrl(objectUrl);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถโหลด PDF ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdf();
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, [docType, docId, printType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500" data-testid="pdf-loading">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <span className="text-sm">กำลังสร้าง PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500" data-testid="pdf-error">
        <AlertCircle className="h-8 w-8 mb-3" />
        <span className="text-sm mb-3">{error}</span>
        <Button variant="outline" size="sm" onClick={fetchPdf} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: "calc(100vh - 140px)", minHeight: "600px" }} data-testid="pdf-viewer">
      <iframe
        src={pdfUrl || ""}
        className="w-full h-full border rounded-lg shadow-sm"
        style={{ background: "#f1f5f9" }}
        title="PDF Preview"
      />
    </div>
  );
}
