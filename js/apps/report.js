import { escapeHTML as h, label, displayValue, displayField } from './shared.js';

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
      employee: (authority ?? draftSource)?.employee ?? '',
      employeeId: (authority ?? draftSource)?.employeeId ?? definition.subjectId ?? '',
      sourceDepartment: (authority ?? draftSource)?.department ?? '',
      previous: draftSource ? {id:draftSource.id, department:draftSource.department, value:draft.value} : null,
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
  const sections = report.sections.filter(section => !section.placeholder);
  return `<div class="report-scroll"><article class="incident-report" aria-label="Consolidated Incident Report">
    <header class="report-letterhead"><b>HILFER</b><span>IR / CONSOLIDATED RECORD / 01</span></header>
    <h1>Incident Report</h1><div class="report-control"><b>${h(report.status)}</b></div>
    <p class="report-progress">${report.completed} ${report.completed === 1 ? 'entry' : 'entries'} filed${report.pending ? ` · ${report.pending} under review` : ''}</p>
    ${sections.map(section => {
      const finding = section.determination ?? section.provisional;
      return `<section class="report-section ${section.determination ? 'report-filed' : 'report-pending'}" id="report-${h(section.id)}" data-report-section="${h(section.id)}" tabindex="-1">
      <div class="report-section-heading"><h2>${h(section.employee ? `${section.employee} — ${displayField(finding?.label ?? section.title)}` : section.title)}</h2><span class="report-stamp">${section.determination ? 'Filed' : 'Unverified'}</span></div>
      ${finding ? `<p class="report-status-value">${h(displayValue(finding.value))}</p><p class="report-basis">Based on: ${reference(finding.sourceId, section.sourceDepartment || finding.sourceId)}</p>` : `<p>${h(section.pendingText)}</p>`}
      ${section.context.map(field => `<p class="report-context">${h(displayField(field.label))}: <strong>${h(displayValue(field.value))}</strong></p>`).join('')}
      <details class="record-details" data-audit-id="${h(section.id)}"><summary>Record details${section.references.length ? ` · ${section.references.length} source documents` : ''}</summary>
        <dl class="report-findings"><dt>Case ID</dt><dd>${h(section.id)}</dd><dt>Employee ID</dt><dd>${h(section.employeeId)}</dd>
        ${finding ? `<dt>Internal classification</dt><dd>${h(finding.value)}</dd><dt>Current source</dt><dd>${reference(finding.sourceId)}</dd>` : ''}
        ${section.context.map(field => `<dt>${h(field.label)}</dt><dd>${h(field.value)} · ${reference(field.sourceId)}</dd>`).join('')}
        ${section.determination && section.previous ? `<dt>Previous entry</dt><dd>${h(section.previous.department)} · ${h(displayValue(section.previous.value))} (${h(section.previous.value)}) · ${reference(section.previous.id)}</dd>` : ''}
        ${section.determination ? `<dt>Disposition</dt><dd>${h(section.disposition === 'Administrative discrepancy resolved.' ? 'Record discrepancy resolved' : section.disposition)}</dd>` : ''}</dl>
        ${section.references.length ? `<div class="report-references"><span>${section.determination ? 'Source documents' : 'Provisional references'} (${section.references.length})</span><div>${section.references.map(record => reference(record.id)).join(' · ')}</div></div>` : ''}
      </details>
      <button type="button" class="report-case-link" data-report-case="${h(section.id)}">${section.determination ? 'Review history' : 'Review case'}</button>
    </section>`;
    }).join('')}
    <footer class="report-footer"><span>END OF CURRENT ENTRIES</span><span>${report.pending ? 'Review in progress' : 'More records pending'}</span></footer>
  </article></div>`;
}
