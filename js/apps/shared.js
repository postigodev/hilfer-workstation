export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const label = value => value.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

export const RECORD_MIME = 'application/x-hilfer-record-id';

// Presentation only: domain values and IDs remain unchanged in saves and validation.
export const displayValue = value => ({
  AVAILABLE: 'Available for duty', NOT_CLEARED: 'Not cleared for work',
  NOT_ESTABLISHED: 'Not established'
}[value] ?? String(value));
export const displayField = field => ({
  workEligibility: 'Work status', 'Work eligibility': 'Work status', 'Work Eligibility': 'Work status',
  occupationalCausation: 'Work-related cause', 'Occupational causation': 'Work-related cause'
}[field] ?? label(field));
export function displayDate(value, short = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value ?? '');
  if (!match) return String(value ?? '');
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  if (date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) return String(value);
  return new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', ...(short ? {} : {year:'numeric'}), timeZone:'UTC'}).format(date);
}
export function recordTitle(record) {
  const type = {personnel_status:'Personnel File', occupational_health_record:'Medical Clearance'}[record.type];
  return type ? `${record.employee} — ${type}` : record.title;
}
