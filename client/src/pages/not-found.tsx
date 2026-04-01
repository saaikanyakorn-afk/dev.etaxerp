import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function NotFound() {
  const { lang } = useTranslation();
  const isZh = lang.startsWith("zh");
  const title = lang === "en" ? "404 Page Not Found" : isZh ? "404 页面未找到" : "404 ไม่พบหน้านี้";
  const desc = lang === "en" ? "The page you're looking for doesn't exist." : isZh ? "您访问的页面不存在。" : "ไม่พบหน้าที่คุณต้องการ";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-404-title">{title}</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600" data-testid="text-404-desc">
            {desc}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
