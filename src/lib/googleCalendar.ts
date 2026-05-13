type BuildGoogleCalendarLinkInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
};

function formatGoogleDate(dateValue: string) {
  return new Date(dateValue)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, "");
}

export function buildGoogleCalendarLink(input: BuildGoogleCalendarLinkInput) {
  const start = formatGoogleDate(input.startsAt);

  const fallbackEnd = new Date(input.startsAt);
  fallbackEnd.setHours(fallbackEnd.getHours() + 1);

  const end = input.endsAt
    ? formatGoogleDate(input.endsAt)
    : formatGoogleDate(fallbackEnd.toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${start}/${end}`,
    details: input.description || "",
    location: input.location || "",
    ctz: "Asia/Ho_Chi_Minh",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
