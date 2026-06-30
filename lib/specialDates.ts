import type { SpecialDate } from "./types";

// ─── Raw special dates data (July 2026) ─────────────────────────────────────
// Birthdays / (wedding & dating) anniversaries for both Queendoms. Dating
// anniversaries are mapped to `anniversary` (same Heart styling).
// The year component is ignored — getSpecialDates() rebuilds every event in the
// current calendar year, so only month-day matters. 2025 is a placeholder.
// One June entry (Nesara B S, 30 June) is retained intentionally.
interface SpecialDateRaw {
  fullName: string;
  dateOfBirth?: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD
  queendom: "ananyshree" | "anishqa";
  isExpired?: boolean;
}

const SPECIAL_DATES_RAW: SpecialDateRaw[] = [
  // ── Retained June entry (today is 30 June) ──
  {
    fullName: "Nesara B S",
    dateOfBirth: "1985-06-30",
    anniversary: "2013-06-16",
    queendom: "anishqa",
  },

  // ── Ananyshree — July birthdays ──
  { fullName: "Neha Bhangay", dateOfBirth: "2025-07-01", queendom: "ananyshree" },
  { fullName: "Gulzar", dateOfBirth: "2025-07-01", queendom: "ananyshree" },
  { fullName: "Vybhav", dateOfBirth: "2025-07-02", queendom: "ananyshree" },
  { fullName: "Neel Gogia", dateOfBirth: "2025-07-07", queendom: "ananyshree" },
  { fullName: "Anmol Swarup", dateOfBirth: "2025-07-08", queendom: "ananyshree" },
  {
    fullName: "Kamala V (Kamal V's wife)",
    dateOfBirth: "2025-07-11",
    queendom: "ananyshree",
  },
  {
    fullName: "Dhanvi (Anuj Monty's daughter)",
    dateOfBirth: "2025-07-12",
    queendom: "ananyshree",
  },
  { fullName: "Shikha", dateOfBirth: "2025-07-13", queendom: "ananyshree" },
  { fullName: "Shah Akshat", dateOfBirth: "2025-07-14", queendom: "ananyshree" },
  { fullName: "Vijay Nirani", dateOfBirth: "2025-07-15", queendom: "ananyshree" },
  { fullName: "Mr. Pintu", dateOfBirth: "2025-07-15", queendom: "ananyshree" },
  { fullName: "Manugopal", dateOfBirth: "2025-07-21", queendom: "ananyshree" },
  { fullName: "Jayesh's friend", dateOfBirth: "2025-07-25", queendom: "ananyshree" },
  { fullName: "Divya Kothamasu", dateOfBirth: "2025-07-28", queendom: "ananyshree" },
  { fullName: "Ankit Agarwal", dateOfBirth: "2025-07-28", queendom: "ananyshree" },
  { fullName: "Prince", dateOfBirth: "2025-07-30", queendom: "ananyshree" },

  // ── Ananyshree — July anniversaries ──
  { fullName: "Bhavin", anniversary: "2025-07-13", queendom: "ananyshree" },
  { fullName: "Girish Chitale", anniversary: "2025-07-29", queendom: "ananyshree" },

  // ── Anishqa — July birthdays ──
  { fullName: "Mr Sandeep", dateOfBirth: "2025-07-04", queendom: "anishqa" },
  { fullName: "Ayush & Parima", dateOfBirth: "2025-07-12", queendom: "anishqa" },
  { fullName: "Aniruddha Khopde", dateOfBirth: "2025-07-15", queendom: "anishqa" },
  {
    fullName: "Gursimran Singh Kochhar",
    dateOfBirth: "2025-07-17",
    queendom: "anishqa",
  },
  { fullName: "Ayush Atul Mishra", dateOfBirth: "2025-07-19", queendom: "anishqa" },
  { fullName: "Nakul Dandona", dateOfBirth: "2025-07-26", queendom: "anishqa" },
  { fullName: "Mehul Mehta", dateOfBirth: "2025-07-26", queendom: "anishqa" },
  { fullName: "Aarav Gupta", dateOfBirth: "2025-07-29", queendom: "anishqa" },
  { fullName: "Abhishek Jain", dateOfBirth: "2025-07-29", queendom: "anishqa" },
  { fullName: "Vrajendra Pande", dateOfBirth: "2025-07-29", queendom: "anishqa" },
  { fullName: "Raj Shamani", dateOfBirth: "2025-07-30", queendom: "anishqa" },
  {
    fullName: "Ramu Rao Jupally's Concierge",
    dateOfBirth: "2025-07-30",
    queendom: "anishqa",
  },

  // ── Anishqa — July anniversaries (wedding + dating) ──
  { fullName: "Shweta Kedia", anniversary: "2025-07-07", queendom: "anishqa" },
  { fullName: "Sandesh Cadabam", anniversary: "2025-07-10", queendom: "anishqa" },
  { fullName: "Sathya Murthy", anniversary: "2025-07-22", queendom: "anishqa" },
  { fullName: "Jitesh Rawal", anniversary: "2025-07-27", queendom: "anishqa" },
];

// ─── Builder ─────────────────────────────────────────────────────────────────
// Converts raw dates to SpecialDate[] using the current calendar year for each event.
function toMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${m}-${d}`;
}

export function getSpecialDates(): SpecialDate[] {
  const year = new Date().getFullYear();
  const result: SpecialDate[] = [];
  let id = 0;

  for (const raw of SPECIAL_DATES_RAW) {
    const isExpired = raw.isExpired === true;

    if (raw.dateOfBirth) {
      const monthDayDob = toMonthDay(raw.dateOfBirth);
      result.push({
        id: `sd-${++id}`,
        clientName: raw.fullName,
        date: `${year}-${monthDayDob}`,
        type: "birthday",
        queendom: raw.queendom,
        isExpired,
      });
    }

    if (raw.anniversary) {
      const monthDayAnniv = toMonthDay(raw.anniversary);
      result.push({
        id: `sd-${++id}`,
        clientName: raw.fullName,
        date: `${year}-${monthDayAnniv}`,
        type: "anniversary",
        queendom: raw.queendom,
        isExpired,
      });
    }
  }

  return result;
}
