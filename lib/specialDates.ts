import type { SpecialDate } from "./types";

// ─── Raw special dates data (June 2026) ─────────────────────────────────────
// Sourced from June-Dates.csv. Only clients with a birthday or anniversary in June.
// `isExpired` mirrors CSV Status column (expired membership).
interface SpecialDateRaw {
  fullName: string;
  dateOfBirth?: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD
  queendom: "ananyshree" | "anishqa";
  isExpired?: boolean;
}

const SPECIAL_DATES_RAW: SpecialDateRaw[] = [
  { fullName: "Sathya Murthy", dateOfBirth: "2025-06-19", queendom: "anishqa" },
  { fullName: "Ahura", dateOfBirth: "2004-06-12", queendom: "anishqa" },
  { fullName: "Vinayak Mittal", dateOfBirth: "1986-06-05", queendom: "anishqa" },
  { fullName: "Mr Mahendra", anniversary: "2014-06-12", queendom: "anishqa" },
  {
    fullName: "Nesara B S",
    dateOfBirth: "1985-06-30",
    anniversary: "2013-06-16",
    queendom: "anishqa",
  },
  { fullName: "Subodh", dateOfBirth: "1984-06-25", queendom: "anishqa" },
  { fullName: "Preethi", anniversary: "2001-06-11", queendom: "anishqa" },
  { fullName: "Vybhava Srinivasan", anniversary: "2007-06-10", queendom: "ananyshree" },
  { fullName: "Ravi Machani", anniversary: "1997-06-21", queendom: "ananyshree" },
  { fullName: "Abhijit Pawar", anniversary: "1999-06-28", queendom: "ananyshree" },
  { fullName: "Vidyasagar Dontineni", dateOfBirth: "1963-06-01", queendom: "anishqa" },
  {
    fullName: "Tirumalasetty Raghav",
    dateOfBirth: "1994-06-08",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Nikhil Shettar",
    dateOfBirth: "1990-06-23",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Dharanish Dhanekula",
    dateOfBirth: "1989-06-02",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Navneet Singh",
    anniversary: "2012-06-08",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Shrenik Parakh",
    anniversary: "2012-06-29",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Pravin Jadhav",
    anniversary: "1988-06-04",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Pooja Sardana",
    dateOfBirth: "1980-06-08",
    queendom: "ananyshree",
    isExpired: true,
  },
  {
    fullName: "Nishant Khetan",
    anniversary: "2009-06-02",
    queendom: "anishqa",
    isExpired: true,
  },
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
