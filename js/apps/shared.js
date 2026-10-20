export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const label = value => value.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

export const RECORD_MIME = 'application/x-hilfer-record-id';
