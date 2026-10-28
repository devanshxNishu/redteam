import {inspectContextAnalystReport, consumeContextAnalystInspection} from "./context-analyst-inspection.ts";
import {ContextDataError, fields, freeze, uuid} from "./context-data.ts";
const tracks = ["product", "engineering", "customer_buyer", "commercial", "investor_preparation", "verification"] as const;
const views = new WeakMap<object, {workspace: string; taskId: string; checked: Awaited<ReturnType<typeof inspectContextAnalystReport>>}>();

/** Fixed data projection. The original inspection remains private until final response encoding. */
export async function prepareContextAnalystReportResponse(workspace: string, suppliedTaskId: string, options: unknown = {}) {
  try {
    const taskId = uuid(suppliedTaskId), checked = await inspectContextAnalystReport(workspace, taskId, options), report = checked.report;
    const result = report.candidate?.candidate.result, check = result?.check;
    const concerns = check?.response.concerns.map(c => ({id: c.id, track: c.track, type: c.type, statement: c.statement,
      basis: c.basis.map(b => b.kind === "brief_field" ? {kind: b.kind, fieldId: b.fieldId, fieldSha256: b.fieldSha256} : {kind: b.kind, sourceId: b.sourceId, recordSha256: b.recordSha256, contentSha256: b.contentSha256, use: b.use}),
      whyItMatters: c.whyItMatters, priority: c.priority, priorityReason: c.priorityReason,
      nextCheck: {question: c.nextCheck.question, method: c.nextCheck.method, successRule: c.nextCheck.successRule, protocolStatus: "unreviewed"}})) ?? [];
    const failure = report.failure === null ? null : fields(report.failure, ["phase", "reason", "requestsStarted"]);
    const requests = failure ? fields(failure.requestsStarted, ["count", "generation"]) : null;
    const view = freeze({schemaVersion: "1.0", kind: "context_analyst_report_view", policyVersion: "context-report-api-v1", taskId: checked.taskId, runId: checked.runId, reportSha256: checked.sha256,
      recordedAt: report.recordedAt, outcome: report.outcome, briefId: report.brief.id,
      context: {snapshotId: report.context.snapshotId, asOf: report.context.asOf, timeBasis: report.context.timeBasis},
      analysis: {mode: "analytical_only", status: check ? "unreviewed" : "unavailable", reason: result?.reason ?? null, concerns, abstention: check?.response.abstention ?? null,
        tracksNotCovered: check ? [...check.tracksNotCovered] : [...tracks], structure: check ? "passed" : "not_available", citations: check ? "matched_to_exact_brief_fields_and_source_versions" : "not_available", sourceUse: "metadata_only_at_snapshot"},
      failure: failure && requests ? {phase: failure.phase, reason: failure.reason, requestsStarted: {count: requests.count, generation: requests.generation}} : null,
      budget: {asOf: report.budget.asOf, basis: "configured_rate_estimate_not_provider_invoice", currentLedgerMayChange: true,
        pools: report.budget.snapshot.pools.map(p => ({pool: p.pool, cap: {...p.cap}, spent: {...p.spent}, held: {...p.held}, available: {...p.available}}))},
      boundaries: {semanticReview: "unreviewed", suppliedBasis: "unverified", sourceSupport: "not_semantically_verified", researchValidity: "not_established", appExecution: "not_performed", stakeholderDecisions: "not_performed", globalAwareness: "not_established", providerCompatibility: "not_checked", executionAuthority: "not_granted", recovery: "not_performed", billing: "recorded_snapshot_not_new_receipt"}});
    views.set(view, {workspace, taskId, checked}); return view;
  } catch { throw new ContextDataError(); }
}
/** Encode one original view in the response frame; check current witnesses AFTER serialization. */
export function encodeContextAnalystReportResponse(workspace: string, taskId: string, value: unknown): string {
  try {
    if (!value || typeof value !== "object") throw new ContextDataError();
    const selected = views.get(value); views.delete(value);
    if (!selected || selected.workspace !== workspace || selected.taskId !== uuid(taskId)) throw new ContextDataError();
    const encoded = JSON.stringify(value); if (Buffer.byteLength(encoded) > 64000) throw new ContextDataError();
    consumeContextAnalystInspection(selected.checked); return encoded;
  } catch { throw new ContextDataError(); }
}
