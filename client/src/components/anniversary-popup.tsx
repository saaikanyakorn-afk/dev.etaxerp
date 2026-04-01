import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { Award, Star, Heart } from "lucide-react";

interface AnniversaryPopupProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  years: number;
}

function Sparkles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ["#fec90f", "#fb9678", "#03c9d7", "#05b187", "#ffd700", "#ff8c00"];
    const stars: Array<{
      x: number; y: number; size: number; color: string;
      speed: number; angle: number; spin: number; opacity: number; pulse: number;
    }> = [];

    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 0.5 + 0.2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.04,
        opacity: Math.random() * 0.5 + 0.5,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    let animId: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.angle += s.spin;
        s.pulse += 0.03;
        s.y += s.speed;
        s.opacity = 0.4 + Math.sin(s.pulse) * 0.4;
        if (s.y > canvas.height + 10) {
          s.y = -10;
          s.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.color;
        const spikes = 5;
        const outerR = s.size;
        const innerR = s.size * 0.4;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = (i * Math.PI) / spikes - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      animId = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}

function getAnniversaryMessage(years: number): string {
  if (years === 1) return "ครบ 1 ปีแล้วค่ะ! ขอบคุณที่เป็นส่วนหนึ่งของทีมเรา";
  if (years <= 3) return `ครบ ${years} ปีแล้วค่ะ! ขอบคุณที่ร่วมเดินทางมาด้วยกัน`;
  if (years <= 5) return `ครบ ${years} ปีแล้วค่ะ! คุณคือกำลังสำคัญของทีม`;
  if (years <= 10) return `ครบ ${years} ปีแล้วค่ะ! ขอบคุณที่เป็นเสาหลักของสำนักงาน`;
  return `ครบ ${years} ปีแล้วค่ะ! คุณคือตำนานของเราเลย`;
}

function getMilestoneEmoji(years: number): string {
  if (years >= 10) return "🏆";
  if (years >= 5) return "🌟";
  if (years >= 3) return "💎";
  return "⭐";
}

export default function AnniversaryPopup({ open, onClose, employeeName, years }: AnniversaryPopupProps) {
  if (!open) return null;

  const msg = getAnniversaryMessage(years);
  const emoji = getMilestoneEmoji(years);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 border-0 overflow-hidden bg-transparent shadow-none [&>button]:hidden">
        <div className="relative rounded-2xl overflow-hidden">
          <Sparkles />
          <div className="relative z-10 bg-gradient-to-b from-amber-50/95 via-yellow-50/95 to-white/95 backdrop-blur-sm p-8 text-center">
            <div className="flex justify-center gap-3 mb-4">
              <Star className="h-10 w-10 text-amber-500 animate-bounce" style={{ animationDelay: "0s" }} fill="currentColor" />
              <Award className="h-12 w-12 text-[#fb9678] animate-bounce" style={{ animationDelay: "0.2s" }} />
              <Star className="h-10 w-10 text-amber-500 animate-bounce" style={{ animationDelay: "0.4s" }} fill="currentColor" />
            </div>

            <h2 className="text-2xl font-bold text-[#fb9678] mb-2">
              ครบรอบการทำงาน
            </h2>

            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-5xl font-extrabold text-amber-500">{years}</span>
              <span className="text-2xl font-bold text-gray-700">ปี</span>
              <span className="text-4xl">{emoji}</span>
            </div>

            <p className="text-xl font-semibold text-gray-800 mb-4">
              คุณ{employeeName}
            </p>

            <div className="bg-white/70 rounded-xl p-4 mb-5 mx-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                {msg}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-1">
                ขอให้มีความสุขกับการทำงานตลอดไป
              </p>
              <p className="text-sm text-gray-500 mt-2 italic flex items-center justify-center gap-1">
                — ด้วยรักจากทีมงานสำนักงานบัญชี E-Tax Center <Heart className="h-3.5 w-3.5 text-pink-400 inline" fill="currentColor" />
              </p>
            </div>

            <div className="flex justify-center gap-2 text-3xl mb-4">
              {"🎊🏅✨🎉🌟".split("").map((e, i) => (
                <span key={i} className="animate-bounce inline-block" style={{ animationDelay: `${i * 0.15}s` }}>
                  {e === "✨" ? "✨" : e}
                </span>
              ))}
            </div>

            <Button
              onClick={onClose}
              className="bg-[#fb9678] hover:bg-[#e8875a] text-white px-8 py-2 rounded-full text-sm font-medium shadow-lg"
              data-testid="button-close-anniversary"
            >
              ขอบคุณค่ะ / ครับ 🙏
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
