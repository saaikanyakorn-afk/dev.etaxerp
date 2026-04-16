import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "DD.MM.YYYY" | "YY-MM-DD";
type DateEra = "BE" | "CE";

function toDisplayDate(isoDate: string, dateFormat: DateFormat = "DD/MM/YYYY", dateEra: DateEra = "BE"): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate + "T00:00:00");
    if (isNaN(d.getTime())) return isoDate;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const ceYear = d.getFullYear();
    const displayYear = dateEra === "BE" ? ceYear + 543 : ceYear;
    const yyyy = String(displayYear);
    const yy = yyyy.slice(-2);
    switch (dateFormat) {
      case "DD/MM/YYYY": return `${dd}/${mm}/${yyyy}`;
      case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
      case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
      case "DD-MM-YYYY": return `${dd}-${mm}-${yyyy}`;
      case "DD.MM.YYYY": return `${dd}.${mm}.${yyyy}`;
      case "YY-MM-DD": return `${yy}-${mm}-${dd}`;
      default: return `${dd}/${mm}/${yyyy}`;
    }
  } catch {
    return isoDate;
  }
}

function parseDisplayDate(text: string, dateFormat: DateFormat, dateEra: DateEra): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/[\/\-.\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map(p => parseInt(p, 10));
  if (nums.some(n => isNaN(n))) return null;
  let dd: number, mm: number, yyyy: number;
  switch (dateFormat) {
    case "MM/DD/YYYY":
      mm = nums[0]; dd = nums[1]; yyyy = nums[2]; break;
    case "YYYY-MM-DD":
      yyyy = nums[0]; mm = nums[1]; dd = nums[2]; break;
    case "YY-MM-DD": {
      const yy = nums[0];
      yyyy = yy < 50 ? 2000 + yy : (yy < 100 ? 1900 + yy : yy);
      mm = nums[1]; dd = nums[2]; break;
    }
    default:
      dd = nums[0]; mm = nums[1]; yyyy = nums[2]; break;
  }
  if (yyyy < 100) {
    yyyy = yyyy < 50 ? 2000 + yyyy : 1900 + yyyy;
  }
  if (dateEra === "BE" && yyyy > 2400) yyyy -= 543;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime()) || d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

const MONTH_NAMES_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_NAMES_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

interface DatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  dateFormat?: DateFormat;
  dateEra?: DateEra;
  className?: string;
  placeholder?: string;
  "data-testid"?: string;
}

export function DatePicker({
  value,
  onChange,
  dateFormat = "DD/MM/YYYY",
  dateEra = "CE",
  className,
  placeholder = "วว/ดด/ปปปป",
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"calendar" | "year" | "month">("calendar");
  const [navMonth, setNavMonth] = React.useState<Date>(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [pickingYear, setPickingYear] = React.useState(() => navMonth.getFullYear());

  const displayValue = value ? toDisplayDate(value, dateFormat, dateEra) : "";
  const [inputValue, setInputValue] = React.useState(displayValue);

  React.useEffect(() => {
    setInputValue(displayValue);
  }, [displayValue]);

  React.useEffect(() => {
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

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const goPrevMonth = () => {
    setNavMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setNavMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleHeaderClick = () => {
    setPickingYear(navMonth.getFullYear());
    setViewMode("month");
  };

  const handleYearSelect = (year: number) => {
    setPickingYear(year);
    setViewMode("month");
  };

  const handleMonthSelect = (monthIdx: number) => {
    setNavMonth(new Date(pickingYear, monthIdx, 1));
    setViewMode("calendar");
  };

  const commitInput = () => {
    const iso = parseDisplayDate(inputValue, dateFormat, dateEra);
    if (iso === null) {
      setInputValue(displayValue);
    } else if (iso !== value) {
      onChange(iso);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearStart = Math.floor(pickingYear / 12) * 12;
  const yearRange = Array.from({ length: 12 }, (_, i) => yearStart + i);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <Input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={commitInput}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitInput();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          className="h-7 text-xs border-dashed pr-7"
          data-testid={props["data-testid"]}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-slate-700 hover:bg-slate-100"
            aria-label="เปิดปฏิทิน"
          >
            <CalendarIcon className="h-3 w-3" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        {viewMode === "year" && (
          <div className="p-3 w-[270px]">
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
            <div className="grid grid-cols-4 gap-2">
              {yearRange.map(year => {
                const isCurrentYear = year === currentYear;
                const isSelected = year === navMonth.getFullYear();
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearSelect(year)}
                    className={cn(
                      "py-2.5 px-1.5 rounded-md text-sm font-medium transition-colors",
                      isSelected
                        ? "text-white [background:var(--theme-primary)]"
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
          <div className="p-3 w-[270px]">
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
                className="text-sm font-bold text-slate-700 hover:[color:var(--theme-primary)] hover:underline"
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
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES_SHORT.map((name, idx) => {
                const isCurrentMonth = pickingYear === currentYear && idx === new Date().getMonth();
                const isSelected = pickingYear === navMonth.getFullYear() && idx === navMonth.getMonth();
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMonthSelect(idx)}
                    className={cn(
                      "py-3 px-1.5 rounded-md text-sm font-medium transition-colors",
                      isSelected
                        ? "text-white [background:var(--theme-primary)]"
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
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleHeaderClick}
                className="text-sm font-bold text-slate-700 hover:[color:var(--theme-primary)] hover:underline transition-colors"
              >
                {MONTH_NAMES_FULL[navMonth.getMonth()]} {dateEra === "BE" ? navMonth.getFullYear() + 543 : navMonth.getFullYear()}
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
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
              onSelect={(date) => {
                if (date) {
                  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  onChange(iso);
                } else {
                  onChange("");
                }
                setOpen(false);
              }}
              classNames={{
                month_caption: "hidden",
                nav: "hidden",
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { toDisplayDate };
export type { DateFormat, DateEra };
