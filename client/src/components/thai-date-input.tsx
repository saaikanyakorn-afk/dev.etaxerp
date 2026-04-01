import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ThaiDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  dateEra?: string;
  dateFmt?: string;
  className?: string;
  "data-testid"?: string;
}

const MONTH_NAMES_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_NAMES_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function parseTypedDate(text: string, dateFmt: string, dateEra: string): string | null {
  const sep = dateFmt.includes("/") ? "/" : dateFmt.includes("-") ? "-" : ".";
  const parts = text.split(/[/\-\.]/);
  if (parts.length !== 3) return null;

  const fmtParts = dateFmt.split(/[/\-\.]/);
  let dd = "", mm = "", yyyy = "";
  for (let i = 0; i < 3; i++) {
    const p = fmtParts[i]?.toUpperCase() || "";
    if (p.startsWith("D")) dd = parts[i];
    else if (p.startsWith("M")) mm = parts[i];
    else if (p.startsWith("Y")) yyyy = parts[i];
  }

  let day = parseInt(dd, 10);
  let month = parseInt(mm, 10);
  let year = parseInt(yyyy, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  if (dateEra === "BE") year -= 543;
  if (year < 1900 || year > 2200) return null;

  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function ThaiDateInput({
  value,
  onChange,
  dateEra = "CE",
  dateFmt = "DD/MM/YYYY",
  className = "",
  ...props
}: ThaiDateInputProps) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "year" | "month">("calendar");
  const [navMonth, setNavMonth] = useState<Date>(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [pickingYear, setPickingYear] = useState(() => navMonth.getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = value ? formatDate(value, dateEra, dateFmt) : "";

  useEffect(() => {
    if (!typing) {
      setText(displayValue);
    }
  }, [displayValue, typing]);

  useEffect(() => {
    if (open) {
      setViewMode("calendar");
      if (value) {
        const d = new Date(value + "T00:00:00");
        if (!isNaN(d.getTime())) {
          setNavMonth(d);
          setPickingYear(d.getFullYear());
        }
      }
    }
  }, [open, value]);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const handleFocus = () => {
    setTyping(true);
    setText(displayValue);
  };

  const handleBlur = () => {
    setTyping(false);
    if (text === "") {
      onChange("");
      return;
    }
    const iso = parseTypedDate(text, dateFmt, dateEra);
    if (iso) {
      onChange(iso);
    } else {
      setText(displayValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      onChange(iso);
    } else {
      onChange("");
    }
    setOpen(false);
  };

  const goPrevMonth = () => {
    setNavMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setNavMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleYearClick = () => {
    setPickingYear(navMonth.getFullYear());
    setViewMode("year");
  };

  const handleYearSelect = (year: number) => {
    setPickingYear(year);
    setViewMode("month");
  };

  const handleMonthSelect = (monthIdx: number) => {
    setNavMonth(new Date(pickingYear, monthIdx, 1));
    setViewMode("calendar");
  };

  const currentYear = new Date().getFullYear();
  const yearStart = Math.floor(pickingYear / 12) * 12;
  const yearRange = Array.from({ length: 12 }, (_, i) => yearStart + i);

  const placeholder = dateFmt.replace("YYYY", dateEra === "BE" ? "พ.ศ." : "ค.ศ.");

  return (
    <div className={`inline-flex items-center gap-0 ${className || "w-[180px]"}`}>
      <Input
        ref={inputRef}
        type="text"
        value={typing ? text : displayValue}
        onChange={(e) => setText(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 flex-1 min-w-0 rounded-r-none border-r-0 tabular-nums text-sm"
        data-testid={props["data-testid"]}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 w-9 rounded-r-lg border border-input bg-background hover:bg-accent/50 transition-colors flex-shrink-0"
            aria-label="เปิดปฏิทิน"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" sideOffset={4}>
          {viewMode === "year" && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setPickingYear(prev => prev - 12)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-700">
                  {dateEra === "BE" ? `${yearStart + 543} - ${yearStart + 11 + 543}` : `${yearStart} - ${yearStart + 11}`}
                </span>
                <button
                  type="button"
                  onClick={() => setPickingYear(prev => prev + 12)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {yearRange.map(year => {
                  const isCurrentYear = year === currentYear;
                  const isSelected = year === navMonth.getFullYear();
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => handleYearSelect(year)}
                      className={cn(
                        "py-2 px-1 rounded-md text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-[#fb9678] text-white"
                          : isCurrentYear
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      {dateEra === "BE" ? year + 543 : year}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "month" && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setPickingYear(prev => prev - 1)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("year")}
                  className="text-sm font-bold text-slate-700 hover:text-[#fb9678] hover:underline"
                >
                  {dateEra === "BE" ? pickingYear + 543 : pickingYear}
                </button>
                <button
                  type="button"
                  onClick={() => setPickingYear(prev => prev + 1)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_NAMES_SHORT.map((name, idx) => {
                  const isCurrentMonth = pickingYear === currentYear && idx === new Date().getMonth();
                  const isSelected = pickingYear === navMonth.getFullYear() && idx === navMonth.getMonth();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleMonthSelect(idx)}
                      className={cn(
                        "py-2.5 px-1 rounded-md text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-[#fb9678] text-white"
                          : isCurrentMonth
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "calendar" && (
            <div className="p-0">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleYearClick}
                  className="text-sm font-bold text-slate-700 hover:text-[#fb9678] hover:underline transition-colors"
                >
                  {MONTH_NAMES_FULL[navMonth.getMonth()]} {dateEra === "BE" ? navMonth.getFullYear() + 543 : navMonth.getFullYear()}
                </button>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Calendar
                mode="single"
                captionLayout="label"
                month={navMonth}
                onMonthChange={setNavMonth}
                selected={selectedDate}
                onSelect={handleCalendarSelect}
                fixedWeeks
                classNames={{
                  month_caption: "hidden",
                  nav: "hidden",
                }}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
