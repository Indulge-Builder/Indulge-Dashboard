import type { SpecialDate } from "./types";

// ─── Raw special dates data ─────────────────────────────────────────────────
// Birthdays / (wedding & dating) anniversaries for both Queendoms. Dating
// anniversaries are mapped to `anniversary` (same Heart styling).
// The year component is ignored — getSpecialDates() rebuilds every event in the
// current calendar year, so only month-day matters. 2025 is a placeholder.
// Both queendoms refreshed to August 2026.
interface SpecialDateRaw {
  fullName: string;
  dateOfBirth?: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD
  queendom: "ananyshree" | "anishqa";
  isExpired?: boolean;
}

const SPECIAL_DATES_RAW: SpecialDateRaw[] = [
  // ── Ananyshree — August birthdays ──
  // Puneet Kothapa has both a birthday (01.08) and an anniversary (11.08).
  {
    fullName: "Puneet Kothapa",
    dateOfBirth: "2025-08-01",
    anniversary: "2025-08-11",
    queendom: "ananyshree",
  },
  { fullName: "Samir Nerurkar", dateOfBirth: "2025-08-02", queendom: "ananyshree" },
  {
    fullName: "Avya (Lakshit's daughter)",
    dateOfBirth: "2025-08-03",
    queendom: "ananyshree",
  },
  { fullName: "Harshil Limbasiya", dateOfBirth: "2025-08-03", queendom: "ananyshree" },
  {
    fullName: "Mahendra's wife (turning 35)",
    dateOfBirth: "2025-08-05",
    queendom: "ananyshree",
  },
  { fullName: "Kamal V.", dateOfBirth: "2025-08-07", queendom: "ananyshree" },
  { fullName: "Ravi Machani", dateOfBirth: "2025-08-08", queendom: "ananyshree" },
  {
    fullName: "Siddharth Reddy (Anuj Jhun.'s friend)",
    dateOfBirth: "2025-08-09",
    queendom: "ananyshree",
  },
  { fullName: "Ayush Choudhary", dateOfBirth: "2025-08-11", queendom: "ananyshree" },
  { fullName: "Aahana Swarup", dateOfBirth: "2025-08-14", queendom: "ananyshree" },
  {
    fullName: "Shweta (Vishal Agarwal)",
    dateOfBirth: "2025-08-15",
    queendom: "ananyshree",
  },
  { fullName: "Akanksha", dateOfBirth: "2025-08-19", queendom: "ananyshree" },
  { fullName: "Jeet's Dad", dateOfBirth: "2025-08-19", queendom: "ananyshree" },
  { fullName: "Ashutosh", dateOfBirth: "2025-08-22", queendom: "ananyshree" },
  { fullName: "Ankush Agrawal", dateOfBirth: "2025-08-23", queendom: "ananyshree" },
  {
    fullName: "Noor (Ribhav & Simrit's daughter, turning 1)",
    dateOfBirth: "2025-08-25",
    queendom: "ananyshree",
  },
  { fullName: "Rajesh Nigam", dateOfBirth: "2025-08-25", queendom: "ananyshree" },
  { fullName: "Advita", dateOfBirth: "2025-08-26", queendom: "ananyshree" },
  {
    fullName: "Aarushi (Lakshit's wife)",
    dateOfBirth: "2025-08-31",
    queendom: "ananyshree",
  },

  // ── Ananyshree — August anniversaries ──
  {
    fullName: "Karan Virwani & Mithila",
    anniversary: "2025-08-06",
    queendom: "ananyshree",
  },

  // ── Anishqa — August birthdays ──
  { fullName: "Raj Patel", dateOfBirth: "2025-08-06", queendom: "anishqa" },
  { fullName: "Paridhi Agarwal", dateOfBirth: "2025-08-11", queendom: "anishqa" },
  {
    fullName: "Rohini Manian's Concierge",
    dateOfBirth: "2025-08-12",
    queendom: "anishqa",
  },
  { fullName: "Shweta Kedia", dateOfBirth: "2025-08-12", queendom: "anishqa" },
  { fullName: "Malay Parekh", dateOfBirth: "2025-08-17", queendom: "anishqa" },
  { fullName: "Manish Agrawal", dateOfBirth: "2025-08-25", queendom: "anishqa" },
  { fullName: "Prajodh Rajan", dateOfBirth: "2025-08-27", queendom: "anishqa" },
  { fullName: "Niraj Sharma", dateOfBirth: "2025-08-28", queendom: "anishqa" },

  // ── Anishqa — August wedding anniversaries ──
  { fullName: "Sandeep Mehta", anniversary: "2025-08-01", queendom: "anishqa" },
  {
    fullName: "Ramu Rao Jupally's Concierge",
    anniversary: "2025-08-06",
    queendom: "anishqa",
  },
  { fullName: "Abhinaya", anniversary: "2025-08-15", queendom: "anishqa" },
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
