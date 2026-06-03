import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Cake, ChevronRight, Loader2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  onOpenCustomer: (id: string) => void;
}

interface BirthdayContact {
  id: string;
  customer_id: string;
  full_name: string;
  role_title: string | null;
  birthday_day: number;
  birthday_month: number;
  birthday_year: number | null;
  customer: {
    id: string;
    name: string;
    facility_name: string | null;
    owner_sale_id: string | null;
    owner_tele_id: string | null;
  } | null;
  daysRemaining: number;
  birthdayDateThisYear: Date;
}

export const WorkspaceBirthdayWidget: React.FC<Props> = ({ onOpenCustomer }) => {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayContact[]>([]);

  useEffect(() => {
    async function fetchBirthdays() {
      if (!user) return;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("customer_contacts")
          .select("*, customer:customers(id, name, facility_name, owner_sale_id, owner_tele_id)")
          .eq("birthday_reminder_enabled", true)
          .not("birthday_month", "is", null)
          .not("birthday_day", "is", null);

        if (error) throw error;

        // Date calculations in Asia/Ho_Chi_Minh or local timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const formattedContacts: BirthdayContact[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).forEach((c: any) => {
          // Ownership check
          if (!isAdmin && !isSubAdmin) {
            const ownerSaleId = c.customer?.owner_sale_id;
            const ownerTeleId = c.customer?.owner_tele_id;
            if (ownerSaleId !== user.id && ownerTeleId !== user.id) {
              return; // Skip if not owner
            }
          }

          const bMonth = c.birthday_month;
          const bDay = c.birthday_day;
          const bYear = today.getFullYear();

          // Construct birthday date this year
          let birthdayDate = new Date(bYear, bMonth - 1, bDay);
          birthdayDate.setHours(0, 0, 0, 0);

          // Leap year adjustment
          const isLeapYear = bYear % 4 === 0 && (bYear % 100 !== 0 || bYear % 400 === 0);
          if (bMonth === 2 && bDay === 29 && !isLeapYear) {
            birthdayDate = new Date(bYear, 1, 28); // Feb 28
          }

          // If birthday has already passed this year, check next year
          if (birthdayDate.getTime() < today.getTime()) {
            const nextYear = bYear + 1;
            const isNextLeapYear =
              nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0);
            if (bMonth === 2 && bDay === 29 && !isNextLeapYear) {
              birthdayDate = new Date(nextYear, 1, 28);
            } else {
              birthdayDate = new Date(nextYear, bMonth - 1, bDay);
            }
          }

          const diffTime = birthdayDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Filter: birthdays in the next 7 days (including today)
          if (diffDays >= 0 && diffDays <= 7) {
            formattedContacts.push({
              ...c,
              daysRemaining: diffDays,
              birthdayDateThisYear: birthdayDate,
            });
          }
        });

        // Sort by days remaining ascending
        formattedContacts.sort((a, b) => a.daysRemaining - b.daysRemaining);
        setUpcomingBirthdays(formattedContacts);
      } catch (err) {
        console.error("Error loading upcoming birthdays:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBirthdays();
  }, [user, isAdmin, isSubAdmin]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-xs h-full animate-pulse flex flex-col justify-between">
        <div className="h-5 w-1/2 bg-slate-200 rounded mb-4"></div>
        <div className="space-y-3 flex-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-2xl w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-xs h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Cake className="w-5 h-5 text-indigo-500" />
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">
          Sinh nhật sắp tới (7 ngày)
        </h3>
      </div>

      {upcomingBirthdays.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <span className="text-2xl mb-1.5">🎉</span>
          <p className="text-[11px] font-bold text-slate-400 uppercase">
            Không có sinh nhật nào sắp diễn ra
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mr-2 pr-2">
          <div className="space-y-2.5">
            {upcomingBirthdays.map((c) => {
              const bDayStr = c.birthday_day.toString().padStart(2, "0");
              const bMonthStr = c.birthday_month.toString().padStart(2, "0");
              const dateLabel = `${bDayStr}/${bMonthStr}`;

              let relativeLabel = "";
              if (c.daysRemaining === 0) relativeLabel = "Hôm nay 🎂";
              else if (c.daysRemaining === 1) relativeLabel = "Ngày mai";
              else relativeLabel = `Còn ${c.daysRemaining} ngày`;

              return (
                <div
                  key={c.id}
                  onClick={() => c.customer?.id && onOpenCustomer(c.customer.id)}
                  className="flex items-center justify-between p-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900 truncate max-w-[130px]">
                        {c.full_name}
                      </span>
                      {c.role_title && (
                        <span className="text-[9px] font-bold bg-white text-slate-500 border border-slate-100 px-1.5 py-0.2 rounded-full">
                          {c.role_title}
                        </span>
                      )}
                    </div>
                    {c.customer && (
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        🏢 {c.customer.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-700">{dateLabel}</p>
                      <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">
                        {relativeLabel}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
