import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Cake, PartyPopper, Gift, Star, Heart, Music, Volume2, VolumeX } from "lucide-react";

interface BirthdayPopupProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
}

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ["#fb9678", "#03c9d7", "#fec90f", "#05b187", "#f94d4d", "#539BFF", "#ff69b4", "#ffd700"];
    const particles: Array<{
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number; rotation: number; rotSpeed: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 4,
        h: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animId: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.vy += 0.05;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.vy = Math.random() * 3 + 2;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
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

function playHappyBirthdayMelody(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
    }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const notes: [number, number, number][] = [
      [262, 0, 0.3], [262, 0.3, 0.3],
      [294, 0.6, 0.6], [262, 1.2, 0.6],
      [349, 1.8, 0.6], [330, 2.4, 1.0],

      [262, 3.6, 0.3], [262, 3.9, 0.3],
      [294, 4.2, 0.6], [262, 4.8, 0.6],
      [392, 5.4, 0.6], [349, 6.0, 1.0],

      [262, 7.2, 0.3], [262, 7.5, 0.3],
      [523, 7.8, 0.6], [440, 8.4, 0.6],
      [349, 9.0, 0.6], [330, 9.6, 0.6],
      [294, 10.2, 1.0],

      [466, 11.4, 0.3], [466, 11.7, 0.3],
      [440, 12.0, 0.6], [349, 12.6, 0.6],
      [392, 13.2, 0.6], [349, 13.8, 1.2],
    ];
    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    }
  } catch {}
}

export default function BirthdayPopup({ open, onClose, employeeName }: BirthdayPopupProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    }
  }, [open]);

  const handlePlayMusic = () => {
    if (playing) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setPlaying(false);
    } else {
      playHappyBirthdayMelody(audioCtxRef);
      setPlaying(true);
      setTimeout(() => setPlaying(false), 15000);
    }
  };

  const handleClose = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setPlaying(false);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md p-0 border-0 overflow-hidden bg-transparent shadow-none [&>button]:hidden">
        <div className="relative rounded-2xl overflow-hidden">
          <Confetti />
          <div className="relative z-10 bg-gradient-to-b from-amber-50/95 via-pink-50/95 to-white/95 backdrop-blur-sm p-8 text-center">
            <div className="flex justify-center gap-3 mb-4">
              <PartyPopper className="h-10 w-10 text-amber-500 animate-bounce" style={{ animationDelay: "0s" }} />
              <Cake className="h-12 w-12 text-pink-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
              <PartyPopper className="h-10 w-10 text-cyan-500 animate-bounce" style={{ animationDelay: "0.4s" }} />
            </div>

            <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-amber-500 to-cyan-500 bg-clip-text text-transparent mb-2">
              Happy Birthday!
            </h2>
            <p className="text-2xl font-bold text-gray-800 mb-1">
              <Cake className="h-6 w-6 inline-block text-amber-500 mr-1 -mt-1" />
              สุขสันต์วันเกิด
              <Cake className="h-6 w-6 inline-block text-amber-500 ml-1 -mt-1" />
            </p>
            <p className="text-xl font-semibold text-[#fb9678] mb-4">
              คุณ{employeeName}
            </p>

            <div className="bg-white/70 rounded-xl p-4 mb-4 mx-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                ขอให้มีความสุขมาก ๆ สุขภาพแข็งแรง
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                ร่ำรวยเงินทอง ประสบความสำเร็จ
                <Star className="h-4 w-4 inline-block text-amber-400 ml-1 -mt-0.5" />
              </p>
              <p className="text-sm text-gray-500 mt-2 italic">
                — จากทีมงานสำนักงานบัญชี E-Tax Center
                <Heart className="h-3.5 w-3.5 inline-block text-pink-400 ml-1 -mt-0.5" />
              </p>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              <Gift className="h-7 w-7 text-red-400 animate-bounce" style={{ animationDelay: "0s" }} />
              <Star className="h-7 w-7 text-amber-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
              <PartyPopper className="h-7 w-7 text-pink-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
              <Heart className="h-7 w-7 text-red-400 animate-bounce" style={{ animationDelay: "0.45s" }} />
              <Gift className="h-7 w-7 text-cyan-400 animate-bounce" style={{ animationDelay: "0.6s" }} />
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={handlePlayMusic}
                variant="outline"
                className="rounded-full px-4 py-2 text-sm border-pink-300 text-pink-600 hover:bg-pink-50"
                data-testid="button-play-birthday-music"
              >
                {playing ? (
                  <><VolumeX className="h-4 w-4 mr-1.5" /> หยุดเพลง</>
                ) : (
                  <><Music className="h-4 w-4 mr-1.5" /> เปิดเพลง</>
                )}
              </Button>
              <Button
                onClick={handleClose}
                className="bg-gradient-to-r from-pink-400 to-amber-400 hover:from-pink-500 hover:to-amber-500 text-white px-8 py-2 rounded-full text-sm font-medium shadow-lg"
                data-testid="button-close-birthday"
              >
                ขอบคุณค่ะ / ครับ
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
