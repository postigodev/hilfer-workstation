import { escapeHTML as h, label } from './shared.js';

// A projection, never a second save: no rules or supported answers are read here.
export function deriveReport(cases, state, getRecord) {
  const sections = cases.map(definition => {
    const attached = (state.attachedEvidence[definition.id] ?? []).map(getRecord).filter(Boolean);
    const committed = state.completedCaseIds.includes(definition.id) ? state.resolutions[definition.id] : null;
    const authority = committed ? getRecord(committed.sourceId) : null;
    const metadata = definition.report ?? {};
    const draft = definition.provisional;
    const draftSource = draft ? getRecord(draft.sourceId) : null;
    const provisional = !committed && draftSource && draftSource.fields[draft.field] === draft.value
      ? { label: label(draft.field), value: draft.value, sourceId: draft.sourceId } : null;
    return {
      id: definition.id, title: metadata.heading ?? definition.category ?? definition.title,
      subject: metadata.subject ?? definition.subjectId ?? '',
      status: committed ? 'RECONCILED' : definition.placeholder ? 'RESERVED' : attached.length ? 'UNDER REVIEW' : 'PENDING',
      unlocked: state.unlockedCaseIds.includes(definition.id), placeholder: Boolean(definition.placeholder),
      references: attached.map(record => ({ id: record.id, title: record.title })),
      determination: committed ? { label: label(committed.field), value: committed.value, sourceId: committed.sourceId } : null,
      provisional,
      // Context fields are explicitly sourced assertions, not additional resolved questions.
      context: authority ? (metadata.contextFields ?? []).filter(field => authority.fields[field.field] !== undefined)
        .map(field => ({ label: field.label, value: authority.fields[field.field], sourceId: authority.id })) : [],
      disposition: committed ? metadata.disposition ?? 'Administrative entry reconciled.' : '',
      pendingText: definition.placeholder ? metadata.pendingText ?? 'Awaiting departmental records.' : 'Determination not filed.'
    };
  });
  return {
    status: sections.some(section => section.status !== 'RECONCILED') ? 'IN PROGRESS' : 'CONSOLIDATED',
    completed: sections.filter(section => section.status === 'RECONCILED').length,
    pending: sections.filter(section => !section.placeholder && section.status !== 'RECONCILED').length,
    reserved: sections.filter(section => section.placeholder).length,
    sections
  };
}

const reference = (id, text = id) => `<button type="button" class="source-reference" data-open-record="${h(id)}" aria-label="Open record ${h(id)}">${h(text)}</button>`;
export function renderReport(report) {
  return `<div class="report-scroll"><article class="incident-report" aria-label="Consolidated Incident Report">
    <header class="report-letterhead"><b>HILFER</b><span>IR / CONSOLIDATED RECORD / 01</span></header>
    <h1>Incident Reconciliation Report</h1><div class="report-control"><b>${h(report.status)}</b><span>CONTROLLED INTERNAL RECORD</span></div>
    <p class="report-progress">${report.completed} determination${report.completed === 1 ? '' : 's'} filed · ${report.pending} under review · ${report.reserved} reserved</p>
    ${report.sections.map((section, index) => `<section class="report-section ${section.determination ? 'report-filed' : 'report-pending'}" id="report-${h(section.id)}" data-report-section="${h(section.id)}" tabindex="-1">
      <div class="report-section-heading"><h2>${String(index + 1).padStart(3, '0')} / ${h(section.title)}</h2><span class="report-stamp">${h(section.status)}</span></div>
      ${section.subject ? `<p class="report-subject">${h(section.subject)}</p>` : ''}
      ${section.determination ? `<dl class="report-findings"><dt>${h(section.determination.label)}</dt><dd><strong>${h(section.determination.value)}</strong></dd><dt>Source of authority</dt><dd>${reference(section.determination.sourceId)}</dd>${section.context.map(field => `<dt>${h(field.label)}</dt><dd>${h(field.value)} <span class="context-source">[${h(field.sourceId)}]</span></dd>`).join('')}<dt>Disposition</dt><dd>${h(section.disposition)}</dd></dl>` : `<div class="report-unfiled">${section.provisional ? `<div class="report-provisional"><small>UNVERIFIED</small><div><span>${h(section.provisional.label)}</span><b>${h(section.provisional.value)}</b></div><p>Current source: ${reference(section.provisional.sourceId)}</p></div>` : `<p>${h(section.pendingText)}</p>`}</div>`}
      ${section.references.length ? `<div class="report-references"><span>${section.determination ? 'Supporting references' : 'Provisional references'}</span><div>${section.references.map(record => reference(record.id)).join(' · ')}</div></div>` : ''}
      <button type="button" class="report-case-link" data-report-case="${h(section.id)}">${h(section.id)} / ${section.placeholder ? (section.unlocked ? 'View pending assignment' : 'View reserved assignment') : 'Review case'}</button>
    </section>`).join('')}
    <footer class="report-footer"><span>END OF CURRENT ENTRIES</span><span>${report.pending + report.reserved} section${report.pending + report.reserved === 1 ? '' : 's'} outstanding</span></footer>
  </article></div>`;
}
