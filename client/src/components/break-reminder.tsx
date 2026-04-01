import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const BREAK_INTERVAL = 60 * 60 * 1000;
const MASCOT_MESSAGES = [
  "ทำงานมานานแล้วนะ! พักสายตาสักครู่ไหม? 👀",
  "เฮ้! อย่าลืมยืดเส้นยืดสายด้วยล่ะ 💪",
  "ดื่มน้ำสักแก้วไหม? ร่างกายต้องการน้ำนะ 💧",
  "พักผ่อนบ้างนะ สุขภาพสำคัญที่สุด ❤️",
  "ลุกเดินเปลี่ยนอิริยาบถกันเถอะ! 🚶",
];

export default function BreakReminder() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  const dismiss = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setShow(false);
      setFadeOut(false);
    }, 400);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const msg = MASCOT_MESSAGES[Math.floor(Math.random() * MASCOT_MESSAGES.length)];
      setMessage(msg);
      setShow(true);
      setFadeOut(false);
    }, BREAK_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (show) {
      const autoHide = setTimeout(dismiss, 15000);
      return () => clearTimeout(autoHide);
    }
  }, [show, dismiss]);

  if (!show) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-400 print:!hidden ${
        fadeOut ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 animate-bounce-in"
      }`}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-[#03c9d7]/20 p-4 max-w-xs relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 text-gray-400 hover:text-gray-600"
          onClick={dismiss}
          data-testid="button-dismiss-break"
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-start gap-3">
          <img
            src="/mascot-break.png"
            alt="E-Tax Mascot"
            className="w-16 h-16 rounded-full flex-shrink-0 shadow-lg object-cover"
          />
          <div className="pt-1">
            <div className="text-xs font-bold text-[#03c9d7] mb-1">E-Tax Center</div>
            <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end mt-3 gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 h-7"
            onClick={dismiss}
            data-testid="button-break-later"
          >
            เดี๋ยวก่อน
          </Button>
          <Button
            size="sm"
            className="text-xs bg-[#03c9d7] hover:bg-[#02a8b3] text-white h-7"
            onClick={dismiss}
            data-testid="button-break-ok"
          >
            รับทราบ ขอบคุณ!
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3) translateY(20px); }
          50% { opacity: 1; transform: scale(1.05) translateY(-5px); }
          70% { transform: scale(0.95) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        .animate-bounce-in {
          animation: bounceIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
