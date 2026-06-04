import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Cake, ChevronRight, Loader2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";

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
      <CRMCard className="h-full">
        <CRMLoadingState type="list" rows={2} />
      </CRMCard>
    );
  }

  return (
    <CRMCard className="h-full flex flex-col p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Cake className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
          Sinh nhật sắp tới (7 ngày)
        </h3>
      </div>

      {upcomingBirthdays.length === 0 ? (
        <CRMEmptyState
          title="Không có sinh nhật nào sắp diễn ra"
          icon={<span className="text-2xl">🎉</span>}
        />
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
                  className="flex items-center justify-between p-4 rounded-2xl border border-indigo-50 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-900/5 transition-all group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900 truncate max-w-[130px]">
                        {c.full_name}
                      </span>
                      {c.role_title && (
                        <span className="text-[9px] font-bold bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full">
                          {c.role_title}
                        </span>
                      )}
                    </div>
                    {c.customer && (
                      <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                        <User className="w-3 h-3" /> {c.customer.name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-700">{dateLabel}</p>
                      <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">
                        {relativeLabel}
                      </p>
                    </div>
                    <button
                      onClick={() => c.customer?.id && onOpenCustomer(c.customer.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95"
                    >
                      Mở
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </CRMCard>
  );
};
