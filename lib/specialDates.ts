import type { SpecialDate } from "./types";

// ─── Raw special dates data ─────────────────────────────────────────────────
// Date of Birth and Anniversary stored as YYYY-MM-DD (year used for month-day extraction).
// Queendom alternates: odd index = ananyshree, even = anishqa (adjust as needed).
interface SpecialDateRaw {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  anniversary?: string; // YYYY-MM-DD
  queendom: "ananyshree" | "anishqa";
}

const SPECIAL_DATES_RAW: SpecialDateRaw[] = [
  {
    fullName: "Janhavi Pawar",
    dateOfBirth: "2000-03-30",
    queendom: "ananyshree",
  },
  {
    fullName: "Jagdish Ladi",
    dateOfBirth: "1999-03-28",
    queendom: "ananyshree",
  },
  {
    fullName: "Anuj Mehta",
    dateOfBirth: "1979-03-30",
    anniversary: "2010-11-18",
    queendom: "ananyshree",
  },
  {
    fullName: "Shradha Lohia",
    dateOfBirth: "1979-03-03",
    anniversary: "2002-11-30",
    queendom: "ananyshree",
  },
  {
    fullName: "Uzma Irfan",
    dateOfBirth: "1979-03-01",
    anniversary: "2001-10-28",
    queendom: "ananyshree",
  },
  { fullName: "Ravi Kailas", dateOfBirth: "1966-03-20", queendom: "anishqa" },
  {
    fullName: "Sunita Mankani",
    dateOfBirth: "1960-03-24",
    anniversary: "2003-09-09",
    queendom: "anishqa",
  },
  {
    fullName: "Bhavin Gupta",
    dateOfBirth: "1997-03-04",
    anniversary: "2021-07-15",
    queendom: "ananyshree",
  },
  {
    fullName: "Paridhi Agarwal",
    dateOfBirth: "1994-08-11",
    anniversary: "2015-03-10",
    queendom: "anishqa",
  },
  {
    fullName: "Ankit Maheshwari",
    dateOfBirth: "1986-10-15",
    anniversary: "2018-03-08",
    queendom: "anishqa",
  },
  {
    fullName: "Aman Kedia",
    dateOfBirth: "1992-05-03",
    anniversary: "2017-12-10",
    queendom: "ananyshree",
  },
  {
    fullName: "Krishna Dhanuka",
    dateOfBirth: "1991-03-20",
    anniversary: "2019-01-25",
    queendom: "ananyshree",
  },
  {
    fullName: "Shikha Mohan Gupta",
    dateOfBirth: "1990-07-13",
    anniversary: "2015-03-12",
    queendom: "ananyshree",
  },
  {
    fullName: "Santhosh Reddy",
    dateOfBirth: "1990-03-17",
    anniversary: "2016-02-19",
    queendom: "ananyshree",
  },
  {
    fullName: "Dharanish Dhanekula",
    dateOfBirth: "1989-06-02",
    anniversary: "2018-03-10",
    queendom: "ananyshree",
  },
  {
    fullName: "Snehil Saraf",
    dateOfBirth: "1988-03-31",
    anniversary: "2011-11-29",
    queendom: "ananyshree",
  },
  {
    fullName: "Kartikeya Kaji",
    dateOfBirth: "1983-03-22",
    anniversary: "2013-11-26",
    queendom: "anishqa",
  },
  {
    fullName: "Nishant Khetan",
    dateOfBirth: "1983-03-22",
    anniversary: "2009-06-02",
    queendom: "anishqa",
  },
];

// ─── Builder ─────────────────────────────────────────────────────────────────
// Converts raw dates to SpecialDate[] using current year for proper filtering.
// (Component filters by "this month" and requires year to match.)
function toMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${m}-${d}`;
}

export function getSpecialDates(): SpecialDate[] {
  const year = new Date().getFullYear();
  const result: SpecialDate[] = [];
  let id = 0;

  for (const raw of SPECIAL_DATES_RAW) {
    const monthDayDob = toMonthDay(raw.dateOfBirth);
    result.push({
      id: `sd-${++id}`,
      clientName: raw.fullName,
      date: `${year}-${monthDayDob}`,
      type: "birthday",
      queendom: raw.queendom,
    });

    if (raw.anniversary) {
      const monthDayAnniv = toMonthDay(raw.anniversary);
      result.push({
        id: `sd-${++id}`,
        clientName: raw.fullName,
        date: `${year}-${monthDayAnniv}`,
        type: "anniversary",
        queendom: raw.queendom,
      });
    }
  }

  return result;
}
