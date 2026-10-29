/* Managed saved data only. No inference, semantic approval, or persisted report body. */
(() => {
  const $ = id => document.getElementById(id), dialog = $("context-dialog"), content = $("context-content");
  const token = document.querySelector('meta[name="redteam-token"]').content;
  const tracks = ["product", "engineering", "customer_buyer", "commercial", "investor_preparation", "verification"];
  const labels = {product: "Product", engineering: "Engineering", customer_buyer: "Customer and buyer questions", commercial: "Commercial questions", investor_preparation: "Investor preparation", verification: "Verification"};
  let generation = 0, active = null, selection = null, expiryTimer, catalog = [], cursor = "0", next = null, expectedCloses = 0;
  const fail = () => { throw new Error("Unavailable"); };
  const obj = (v, keys) => { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join("|") !== [...keys].sort().join("|")) fail(); return v; };
  const str = (v, max = 1000) => { if (typeof v !== "string" || !v.trim() || v.length > max || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(v)) fail(); return v; };
  const id = v => { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(str(v, 36))) fail(); return v; };
  const hash = v => { if (!/^[a-f0-9]{64}$/.test(str(v, 64))) fail(); return v; };
  const time = v => { str(v, 24); const n = Date.parse(v); if (!Number.isSafeInteger(n) || new Date(n).toISOString() !== v) fail(); return n; };
  const integer = v => { if (!Number.isSafeInteger(v) || v < 0) fail(); return v; };
  const list = (v, max) => { if (!Array.isArray(v) || v.length > max) fail(); return v; };
  const same = (v, expected) => { if (v !== expected) fail(); };
  const pick = (v, values) => { if (!values.includes(v)) fail(); };
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = String(text); if (cls) el.className = cls; return el; };
  function section(title) { const el = node("section", undefined, "detail-section"); el.append(node("h3", title)); return el; }
  function clear(message = "") {
    ++generation; active?.abort(); selection = null; clearTimeout(expiryTimer); content.replaceChildren(); $("context-recheck").disabled = true;
    $("context-detail-state").textContent = ""; if (dialog.open) { expectedCloses++; dialog.close(); }
    if (message) $("context-state").textContent = message;
  }
  // Keep the local slot until the original fetch settles, even after abort/navigation.
  async function request(path, max, controller) {
    const response = await fetch(path, {cache: "no-store", headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)])});
    if (!response.ok || !response.headers.get("content-type")?.startsWith("application/json") || !response.body) { await response.body?.cancel(); fail(); }
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > max) fail(); chunks.push(part.value); } }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (controller.signal.aborted) fail(); const all = new Uint8Array(bytes); let offset = 0; for (const part of chunks) { all.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(all));
  }
  function metadata(v, after) {
    obj(v, ["schemaVersion", "kind", "policyVersion", "entries", "inspectedRows", "skipped", "hasMoreRows", "nextAfterRowId", "bounds", "boundaries"]);
    same(v.schemaVersion, "2.0"); same(v.kind, "context_analyst_task_metadata_window"); same(v.policyVersion, "context-task-metadata-v1");
    obj(v.boundaries, ["coverage", "sourceRights", "sourceFiles", "reportValidity", "taskHistory", "executionAuthority", "taskRows", "sqliteCoordination", "billing", "recovery"]);
    same(v.boundaries.sourceRights, "not_checked"); same(v.boundaries.reportValidity, "not_checked"); same(v.boundaries.executionAuthority, "not_granted");
    if (integer(v.inspectedRows) > 50) fail(); obj(v.skipped, ["nonContext", "unsupportedContextMetadata"]); integer(v.skipped.nonContext); integer(v.skipped.unsupportedContextMetadata);
    obj(v.bounds, ["mainBytes", "walBytes", "shmBytes", "documentBytes", "rowLimit", "lookaheadRows"]); same(v.bounds.rowLimit, 50);
    const seen = new Set(); for (const e of list(v.entries, 50)) { obj(e, ["id", "runId", "recordedState", "createdAt", "updatedAt", "status"]); id(e.id); id(e.runId); same(e.status, "recorded_metadata_unverified"); pick(e.recordedState, ["queued", "leased", "running", "sealed", "completed", "failed", "cancelled", "interrupted"]); if (time(e.updatedAt) < time(e.createdAt) || seen.has(e.id)) fail(); seen.add(e.id); }
    if (v.entries.length + v.skipped.nonContext + v.skipped.unsupportedContextMetadata !== v.inspectedRows) fail();
    if (v.hasMoreRows === true) { if (!/^[1-9][0-9]{0,18}$/.test(v.nextAfterRowId) || BigInt(v.nextAfterRowId) <= BigInt(after) || BigInt(v.nextAfterRowId) > 9223372036854775807n) fail(); } else if (v.hasMoreRows !== false || v.nextAfterRowId !== null) fail();
    return v;
  }
  function checked(v, target) {
    obj(v, ["schemaVersion", "kind", "policyVersion", "taskId", "runId", "reportSha256", "recordedAt", "outcome", "briefId", "context", "analysis", "failure", "budget", "boundaries", "access"]);
    same(v.schemaVersion, "2.0"); same(v.kind, "context_analyst_report_view"); same(v.policyVersion, "context-report-api-v2"); same(id(v.taskId), target.id); same(id(v.runId), target.runId); hash(v.reportSha256); if (target.hash) same(v.reportSha256, target.hash); id(v.briefId); time(v.recordedAt); pick(v.outcome, ["checked_unreviewed", "limited_coverage"]);
    obj(v.context, ["snapshotId", "asOf", "timeBasis"]); id(v.context.snapshotId); time(v.context.asOf); same(v.context.timeBasis, "frozen_snapshot_not_live_freshness");
    const a = obj(v.access, ["checkedAt", "effectiveExpiresAt", "displayUntil", "maximumDisplayMs", "revalidation", "revocation", "deliveredCopies"]), at = time(a.checkedAt), expiry = time(a.effectiveExpiresAt), until = time(a.displayUntil), now = Date.now();
    same(a.maximumDisplayMs, 30000); same(a.revalidation, "explicit_request"); same(a.revocation, "detected_on_recheck_or_local_expiry"); same(a.deliveredCopies, "not_recallable");
    if (at > now || now >= until || until !== Math.min(expiry, at + 30000) || at < time(v.recordedAt)) fail();
    const boundaries = {semanticReview: "unreviewed", suppliedBasis: "unverified", sourceSupport: "not_semantically_verified", researchValidity: "not_established", appExecution: "not_performed", stakeholderDecisions: "not_performed", globalAwareness: "not_established", providerCompatibility: "not_checked", executionAuthority: "not_granted", recovery: "not_performed", billing: "recorded_snapshot_not_new_receipt"};
    obj(v.boundaries, Object.keys(boundaries)); for (const [k, value] of Object.entries(boundaries)) same(v.boundaries[k], value);
    const r = obj(v.analysis, ["mode", "status", "reason", "concerns", "abstention", "tracksNotCovered", "structure", "citations", "sourceUse"]);
    same(r.mode, "analytical_only"); same(r.sourceUse, "metadata_only_at_snapshot"); pick(r.status, ["unreviewed", "unavailable"]); if (r.reason !== null) pick(r.reason, ["refused", "incomplete", "provider_failed", "provider_model_mismatch", "usage_unavailable", "preflight_mismatch", "invalid_output"]);
    const ids = new Set(); for (const c of list(r.concerns, 12)) {
      obj(c, ["id", "track", "type", "statement", "basis", "whyItMatters", "priority", "priorityReason", "nextCheck"]); if (!/^C[0-9]{2}$/.test(c.id) || ids.has(c.id)) fail(); ids.add(c.id); pick(c.track, tracks); pick(c.type, ["assumption_risk", "evidence_gap", "consistency_question"]); pick(c.priority, ["now", "next", "later"]); str(c.statement); str(c.whyItMatters); str(c.priorityReason, 500);
      const refs = new Set(); for (const b of list(c.basis, 6)) { let key; if (b.kind === "brief_field") { obj(b, ["kind", "fieldId", "fieldSha256"]); str(b.fieldId, 200); hash(b.fieldSha256); key = "brief:" + b.fieldId; } else { obj(b, ["kind", "sourceId", "recordSha256", "contentSha256", "use"]); same(b.kind, "context_source"); id(b.sourceId); hash(b.recordSha256); hash(b.contentSha256); pick(b.use, ["context_at_snapshot", "background_only", "coverage_gap"]); key = "source:" + b.sourceId; } if (refs.has(key)) fail(); refs.add(key); }
      if (!c.basis.some(b => b.kind === "brief_field")) fail(); obj(c.nextCheck, ["question", "method", "successRule", "protocolStatus"]); same(c.nextCheck.protocolStatus, "unreviewed"); for (const key of ["question", "method", "successRule"]) str(c.nextCheck[key]);
    }
    list(r.tracksNotCovered, 6); same(JSON.stringify(r.tracksNotCovered), JSON.stringify(tracks.filter(t => !r.concerns.some(c => c.track === t))));
    if (r.abstention !== null) str(r.abstention);
    if (r.status === "unreviewed") { same(v.outcome, "checked_unreviewed"); same(r.reason, null); same(v.failure, null); same(r.structure, "passed"); same(r.citations, "matched_to_exact_brief_fields_and_source_versions"); if (!r.concerns.length && r.abstention === null) fail(); }
    else { same(v.outcome, "limited_coverage"); same(r.structure, "not_available"); same(r.citations, "not_available"); same(r.concerns.length, 0); same(r.abstention, null); if (r.reason === null && v.failure === null) fail(); }
    if (v.failure !== null) { const f = obj(v.failure, ["phase", "reason", "requestsStarted"]); pick(f.phase, ["count", "generation"]); pick(f.reason, ["phase_denied", "interrupted", "request_failed", "redirect_denied", "http_error", "response_too_large", "invalid_utf8", "invalid_json", "invalid_envelope", "invalid_count", "budget_overrun"]); obj(f.requestsStarted, ["count", "generation"]); if (typeof f.requestsStarted.count !== "boolean" || typeof f.requestsStarted.generation !== "boolean" || f.requestsStarted.generation && !f.requestsStarted.count || f.phase === "count" && f.requestsStarted.generation || r.reason !== null) fail(); }
    obj(v.budget, ["asOf", "basis", "currentLedgerMayChange", "pools"]); time(v.budget.asOf); same(v.budget.basis, "configured_rate_estimate_not_provider_invoice"); same(v.budget.currentLedgerMayChange, true); same(list(v.budget.pools, 3).length, 3);
    v.budget.pools.forEach((p, i) => { obj(p, ["pool", "cap", "spent", "held", "available"]); same(p.pool, ["investigation", "verification", "report"][i]); for (const k of ["cap", "spent", "held", "available"]) { obj(p[k], ["tokens", "costMicrousd"]); for (const resource of ["tokens", "costMicrousd"]) { if (["cap", "available"].includes(k)) integer(p[k][resource]); else if (typeof p[k][resource] !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(p[k][resource])) fail(); } } });
    return v;
  }
  function render(v) {
    const scope = section("Checked saved data; reasoning unreviewed");
    scope.append(node("p", "These are analytical tracks, not researched consumers or investors. No app test, purchase, investment or human validation is established."), node("p", `Task: ${v.taskId} · Run: ${v.runId}`), node("p", `Brief: ${v.briefId} · Recorded: ${v.recordedAt}`), node("p", "Saved report SHA-256"), node("code", v.reportSha256, "code-hash"), node("p", `Frozen snapshot: ${v.context.snapshotId} · As of: ${v.context.asOf}. This is not live global awareness.`));
    const result = section(v.analysis.status === "unavailable" ? "Analysis unavailable; limited coverage" : "Unreviewed analytical concerns");
    if (v.analysis.reason) result.append(node("p", `Recorded reason: ${v.analysis.reason}`)); if (v.failure) result.append(node("p", `Recorded ${v.failure.phase} phase failure: ${v.failure.reason}`)); if (v.analysis.abstention) result.append(node("p", `Abstention: ${v.analysis.abstention}`));
    if (!v.analysis.concerns.length) result.append(node("p", "No concern is available here. This does not mean the idea or app has no issues."));
    for (const c of v.analysis.concerns) { const concern = section(`${c.id} · ${labels[c.track]} · ${c.priority}`); concern.append(node("p", c.statement), node("p", `Type: ${c.type}`), node("p", `Why it matters: ${c.whyItMatters}`), node("p", `Priority reason: ${c.priorityReason}`), node("h4", "Exact supplied basis; support not semantically verified")); for (const b of c.basis) { if (b.kind === "brief_field") concern.append(node("p", `Brief field: ${b.fieldId}`), node("code", b.fieldSha256, "code-hash")); else concern.append(node("p", `Source: ${b.sourceId} · Use: ${b.use}`), node("p", "Source record SHA-256"), node("code", b.recordSha256, "code-hash"), node("p", "Source content SHA-256"), node("code", b.contentSha256, "code-hash")); } concern.append(node("h4", "Proposed next check; protocol unreviewed"), node("p", c.nextCheck.question), node("p", `Method: ${c.nextCheck.method}`), node("p", `Success rule: ${c.nextCheck.successRule}`)); result.append(concern); }
    result.append(node("p", `Tracks not covered: ${v.analysis.tracksNotCovered.map(t => labels[t]).join(", ") || "None listed; all reasoning remains unreviewed."}`));
    const costs = section("Recorded budget; configured estimates"); costs.append(node("p", `Snapshot: ${v.budget.asOf}. This is not a provider invoice or current ledger. Held amounts can remain uncertain liabilities.`)); for (const p of v.budget.pools) { costs.append(node("h4", p.pool)); for (const key of ["cap", "spent", "held", "available"]) costs.append(node("p", `${key}: ${p[key].tokens} tokens · ${p[key].costMicrousd} micro-USD`)); }
    const access = section("Access and display window"); access.append(node("p", `Checked at: ${v.access.checkedAt}`), node("p", `Effective source/processing permission expiry: ${v.access.effectiveExpiresAt}`), node("p", `This managed display clears at: ${v.access.displayUntil}`), node("p", "Rechecks are manual. They clear old text before a full read. Revocation or changed bytes are detected on recheck; local display clears within 30 seconds or at earlier known permission expiry. No background report polling occurs. Delivered copies cannot be recalled."), node("p", "Basis truth, source support, research validity, provider compatibility and usefulness remain unverified. Reading grants no execution, recovery or semantic approval."));
    content.replaceChildren(scope, result, costs, access);
  }
  function currentAccess() {
    if (!selection || !selection.until) return;
    if (Date.now() < selection.wallStart || Date.now() >= selection.until || performance.now() >= selection.monotonicUntil) clear("Managed display expired or its local clock changed. Open the report for a new full check.");
    else { clearTimeout(expiryTimer); expiryTimer = setTimeout(currentAccess, Math.max(1, Math.min(selection.until - Date.now(), selection.monotonicUntil - performance.now()) + 1)); }
  }
  function arm(v) { const now = Date.now(); selection.until = time(v.access.displayUntil); selection.wallStart = now; selection.monotonicUntil = performance.now() + Math.max(0, selection.until - now); clearTimeout(expiryTimer); expiryTimer = setTimeout(currentAccess, Math.max(1, selection.until - now)); }
  async function inspect(entry, recheck = false) {
    if (active) return;
    const prior = recheck ? selection : null; clear(); const target = {id: entry.id, runId: entry.runId, hash: prior?.hash ?? null}; selection = target;
    const attempt = generation, controller = new AbortController(); active = controller; $("context-detail-state").textContent = "Checking current source access and saved bytes…"; dialog.showModal(); $("context-title").focus();
    try { const v = checked(await request(`/api/context-runs/${target.id}/managed`, 64000, controller), target); if (attempt !== generation || selection !== target || controller.signal.aborted || !dialog.open) return; target.hash = v.reportSha256; render(v); arm(v); currentAccess(); if (selection !== target) return; $("context-detail-state").textContent = "Checked saved data. Analytical reasoning remains unreviewed."; $("context-recheck").disabled = false; }
    catch { if (attempt === generation) clear("Analytical report unavailable. The response, current access or saved integrity check failed. Refresh metadata or open again explicitly."); }
    finally { if (active === controller) active = null; }
  }
  async function load(after = "0") {
    if (active) return;
    clear(); catalog = []; next = null; cursor = after; $("context-run-list").replaceChildren(); $("context-next").hidden = true; $("context-state").textContent = "Reading a bounded metadata window…";
    const attempt = generation, controller = new AbortController(); active = controller; $("context-refresh").disabled = true;
    try { const v = metadata(await request(`/api/context-runs?afterRowId=${after}&rowLimit=50`, 64000, controller), after); if (attempt !== generation || controller.signal.aborted) return; catalog = v.entries; next = v.nextAfterRowId; const rows = catalog.map(e => { const row = node("div", undefined, "grant-item context-record"); row.dataset.contextTask = e.id; const copy = node("div", undefined, "grant-main"); copy.append(node("strong", `Recorded task ${e.id}`), node("p", `${e.recordedState} · ${e.createdAt}`), node("small", "Unverified metadata; opening checks source rights and the saved report.")); const button = node("button", "Inspect analysis", "small-button"); button.addEventListener("click", () => inspect(e)); row.append(copy, button); return row; }); $("context-run-list").replaceChildren(...(rows.length ? rows : [node("p", "No supported context task in this window.", "empty")])); $("context-next").hidden = next === null; $("context-state").textContent = `${v.inspectedRows} task rows inspected after cursor ${cursor}. Metadata is unverified; this window is not a complete catalog.`; }
    catch { if (attempt === generation) $("context-state").textContent = "Context metadata unavailable. Run a configured terminal analysis before opening the UI, or refresh explicitly. No report access is inferred."; }
    finally { if (active === controller) active = null; $("context-refresh").disabled = false; }
  }
  $("context-refresh").addEventListener("click", () => load()); $("context-next").addEventListener("click", () => { if (next) void load(next); });
  $("context-close").addEventListener("click", () => clear()); $("context-recheck").addEventListener("click", () => { if (selection) void inspect(selection, true); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); clear(); }); dialog.addEventListener("close", () => { if (expectedCloses) { expectedCloses--; return; } if (selection) clear(); });
  window.addEventListener("hashchange", () => { clear(); if (location.hash === "#reviews") void load(); });
  window.addEventListener("pagehide", () => clear()); window.addEventListener("pageshow", currentAccess); window.addEventListener("focus", currentAccess);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clear("Managed display cleared while the page was hidden. Open again for a full check."); else currentAccess(); });
  if (location.hash === "#reviews") void load();
})();
