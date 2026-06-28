// gestational.js
// Pregnancy dating math, ported faithfully from the native Bloom app.
// Ultrasound dating, when present, takes precedence over the last menstrual
// period because it is the more accurate clinical reference. Dates are compared
// at midnight to avoid time-of-day drift.

const GESTATION_DAYS = 280;

function atMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a, b) {
  // Whole days from a to b (b - a), using midnight-normalized dates.
  const ms = atMidnight(b).getTime() - atMidnight(a).getTime();
  return Math.round(ms / 86400000);
}

// dating: { lmp: Date|null, ultrasoundDueDate: Date|null }
function dueDate(dating) {
  if (dating.ultrasoundDueDate) return atMidnight(dating.ultrasoundDueDate);
  if (dating.lmp) {
    const d = new Date(dating.lmp);
    d.setDate(d.getDate() + GESTATION_DAYS);
    return atMidnight(d);
  }
  return null;
}

// Returns { days, weeks, remainderDays, trimester } or null.
function ageAt(dating, asOf) {
  const due = dueDate(dating);
  if (!due) return null;

  const reference = atMidnight(asOf || new Date());
  const daysUntilDue = daysBetween(reference, due);
  let elapsed = GESTATION_DAYS - daysUntilDue;
  if (elapsed < 0) elapsed = 0;

  const weeks = Math.floor(elapsed / 7);
  let trimester = 1;
  if (weeks >= 27) trimester = 3;
  else if (weeks >= 13) trimester = 2;

  return {
    days: elapsed,
    weeks: weeks,
    remainderDays: elapsed % 7,
    trimester: trimester,
  };
}

// Whole days remaining until the due date, or null.
function daysRemaining(dating, asOf) {
  const due = dueDate(dating);
  if (!due) return null;
  const reference = atMidnight(asOf || new Date());
  return daysBetween(reference, due);
}

// Formatting helpers for the size figures (metric/imperial), mirroring the
// native WeekInfo getters.
function formatLength(lengthCm, imperial) {
  if (lengthCm == null) return null;
  return imperial
    ? (lengthCm / 2.54).toFixed(1) + ' in'
    : lengthCm.toFixed(1) + ' cm';
}

function formatWeight(weightG, imperial) {
  if (weightG == null) return null;
  if (imperial) {
    const oz = weightG / 28.3495;
    return oz >= 16 ? (oz / 16).toFixed(2) + ' lb' : oz.toFixed(1) + ' oz';
  }
  return weightG >= 1000
    ? (weightG / 1000).toFixed(2) + ' kg'
    : Math.round(weightG) + ' g';
}
