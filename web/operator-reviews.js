/* Saved operator declarations only. No inference, writes or persisted note content. */
(() => {
  const $ = id => document.getElementById(id), dialog = $("operator-note-dialog"), content = $("operator-note-content");
  const token = document.querySelector('meta[name="redteam-token"]').content;
  let generation = 0, active = null, selection = null, expiryTimer, next = null, expectedCloses = 0;
  const fail = () => { throw new Error("Unavailable"); };
  const same = (v, expected) => { if (v !== expected) fail(); };
  const obj = (v, keys) => { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join("|") !== [...keys].sort().join("|")) fail(); return v; };
  const str = (v, max = 1000) => { if (typeof v !== "string" || !v.trim() || v.length > max || /[\x00-\x08\x0b-\x1f\x7f-\x9f]/u.test(v)) fail(); return v; };
  const id = v => { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(str(v, 36))) fail(); return v; };
  const hash = v => { if (!/^[a-f0-9]{64}$/.test(str(v, 64))) fail(); return v; };
  const time = v => { str(v, 24); const n = Date.parse(v); if (!Number.isSafeInteger(n) || new Date(n).toISOString() !== v) fail(); return n; };
  const integer = v => { if (!Number.isSafeInteger(v) || v < 0) fail(); return v; };
  const list = (v, max) => { if (!Array.isArray(v) || v.length > max) fail(); return v; };
  const pick = (v, values) => { if (!values.includes(v)) fail(); };
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = String(text); if (cls) el.className = cls; return el; };
  function section(title) { const el = node("section", undefined, "detail-section"); el.append(node("h3", title)); return el; }
  function clear(message = "") {
    ++generation; active?.abort(); selection = null; clearTimeout(expiryTimer); content.replaceChildren(); $("operator-note-recheck").disabled = true; $("operator-note-detail-state").textContent = "";
    if (dialog.open) { expectedCloses++; dialog.close(); } if (message) $("operator-note-state").textContent = message;
  }
  async function request(path, controller) {
    const response = await fetch(path, {cache: "no-store", headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)])});
    if (!response.ok || !response.headers.get("content-type")?.startsWith("application/json") || !response.body) { await response.body?.cancel(); fail(); }
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 120000) fail(); chunks.push(part.value); } }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (controller.signal.aborted) fail(); const all = new Uint8Array(bytes); let offset = 0; for (const part of chunks) { all.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(all));
  }
  function metadata(v, after) {
    obj(v, ["schemaVersion", "kind", "policyVersion", "entries", "inspectedRows", "skipped", "hasMoreRows", "nextAfterRowId", "bounds", "boundaries"]);
    same(v.schemaVersion, "1.0"); same(v.kind, "context_operator_declaration_catalog_view"); same(v.policyVersion, "operator-declaration-api-v1");
    const boundary = {coverage:"bounded_rowid_window_not_complete_catalog",declarationContent:"not_read",sourceRights:"not_checked",sourceReport:"not_checked",semanticApproval:"not_granted",executionAuthority:"not_granted",catalog:"not_written",sqliteCoordination:"read_only_connection_not_a_no_filesystem_activity_claim"};
    obj(v.boundaries, Object.keys(boundary)); for (const [k, value] of Object.entries(boundary)) same(v.boundaries[k], value);
    obj(v.bounds, ["mainBytes", "walBytes", "shmBytes", "rowLimit", "lookaheadRows", "maximumReadMs"]); for (const [k, value] of Object.entries({mainBytes:8388608,walBytes:8388608,shmBytes:1048576,rowLimit:50,lookaheadRows:1,maximumReadMs:2000})) same(v.bounds[k], value);
    if (integer(v.inspectedRows) > 50 || integer(v.skipped) > v.inspectedRows) fail();
    const seen = new Set(); for (const e of list(v.entries, 50)) { obj(e, ["id", "createdAt", "taskId", "runId", "reportSha256", "recordSha256", "normalizedInputSha256", "status"]); id(e.id); id(e.taskId); id(e.runId); time(e.createdAt); hash(e.reportSha256); hash(e.recordSha256); hash(e.normalizedInputSha256); same(e.status, "recorded_metadata_unverified"); if (seen.has(e.id)) fail(); seen.add(e.id); }
    same(v.entries.length + v.skipped, v.inspectedRows);
    if (v.hasMoreRows === true) { if (!/^[1-9][0-9]{0,18}$/.test(v.nextAfterRowId) || BigInt(v.nextAfterRowId) <= BigInt(after) || BigInt(v.nextAfterRowId) > 9223372036854775807n) fail(); } else if (v.hasMoreRows !== false || v.nextAfterRowId !== null) fail();
    return v;
  }
  function checked(v, target) {
    obj(v, ["schemaVersion", "kind", "policyVersion", "id", "recordSha256", "createdAt", "status", "normalizedInputSha256", "source", "review", "access", "boundaries"]);
    same(v.schemaVersion, "2.0"); same(v.kind, "context_operator_declaration_view"); same(v.policyVersion, "operator-declaration-api-v2"); same(id(v.id), target.id); same(hash(v.recordSha256), target.recordSha256); same(hash(v.normalizedInputSha256), target.normalizedInputSha256); same(v.createdAt, target.createdAt); time(v.createdAt); same(v.status, "operator_declaration_saved_unverified");
    const s = obj(v.source, ["taskId", "runId", "briefId", "reportSha256", "outcome", "analysisStatus", "abstention"]); same(id(s.taskId), target.taskId); same(id(s.runId), target.runId); same(hash(s.reportSha256), target.reportSha256); id(s.briefId); pick(s.outcome, ["checked_unreviewed", "limited_coverage"]); pick(s.analysisStatus, ["unreviewed", "unavailable"]); if (s.abstention !== null) str(s.abstention);
    const a = obj(v.access, ["checkedAt", "effectiveExpiresAt", "displayUntil", "maximumDisplayMs", "revalidation", "revocation", "deliveredCopies"]), at = time(a.checkedAt), expiry = time(a.effectiveExpiresAt), until = time(a.displayUntil), now = Date.now();
    same(a.maximumDisplayMs, 30000); same(a.revalidation, "explicit_request"); same(a.revocation, "detected_on_recheck_or_local_expiry"); same(a.deliveredCopies, "not_recallable"); if (at > now || now >= until || until !== Math.min(expiry, at + 30000) || at < time(v.createdAt)) fail();
    const boundary = {reviewerIdentity:"operator_declared_not_authenticated",basis:"operator_declared_not_independently_verified",sourceReport:"unchanged_unreviewed",semanticApproval:"not_granted",researchValidity:"not_established",appExecution:"not_performed",stakeholderDecisions:"not_performed",providerInference:"not_performed",executionAuthority:"not_granted",actionsAndExperiments:"not_created",managedDisplay:"explicit_recheck_and_local_expiry",deliveredCopies:"not_recallable"};
    obj(v.boundaries, Object.keys(boundary)); for (const [k, value] of Object.entries(boundary)) same(v.boundaries[k], value);
    const r = obj(v.review, ["reviewerLabel", "identity", "coverage", "reportNote", "items"]); str(r.reviewerLabel, 120); same(r.identity, "operator_declared_not_authenticated"); pick(r.coverage, ["selected_concerns", "report_limits"]); str(r.reportNote);
    const seen = new Set(); for (const item of list(r.items, 12)) {
      obj(item, ["concernId", "disposition", "reason", "basisInspected", "original"]); if (!/^C[0-9]{2}$/.test(item.concernId) || seen.has(item.concernId)) fail(); seen.add(item.concernId); pick(item.disposition, ["operator_declared_supported", "operator_declared_unsupported", "needs_more_evidence"]); str(item.reason, 500); str(item.basisInspected);
      const c = obj(item.original, ["id", "concernSha256", "track", "type", "statement", "basis", "whyItMatters", "priority", "priorityReason", "nextCheck"]); same(c.id, item.concernId); hash(c.concernSha256); pick(c.track, ["product", "engineering", "customer_buyer", "commercial", "investor_preparation", "verification"]); pick(c.type, ["assumption_risk", "evidence_gap", "consistency_question"]); pick(c.priority, ["now", "next", "later"]); str(c.statement); str(c.whyItMatters); str(c.priorityReason, 500);
      const refs = new Set(); for (const b of list(c.basis, 6)) { let key; if (b.kind === "brief_field") { obj(b, ["kind", "fieldId", "fieldSha256"]); str(b.fieldId, 200); hash(b.fieldSha256); key = "brief:" + b.fieldId; } else { obj(b, ["kind", "sourceId", "recordSha256", "contentSha256", "use"]); same(b.kind, "context_source"); id(b.sourceId); hash(b.recordSha256); hash(b.contentSha256); pick(b.use, ["context_at_snapshot", "background_only", "coverage_gap"]); key = "source:" + b.sourceId; } if (refs.has(key)) fail(); refs.add(key); }
      if (!c.basis.some(b => b.kind === "brief_field")) fail(); obj(c.nextCheck, ["question", "method", "successRule", "protocolStatus"]); same(c.nextCheck.protocolStatus, "unreviewed"); for (const k of ["question", "method", "successRule"]) str(c.nextCheck[k]);
    }
    if (r.coverage === "selected_concerns" ? !r.items.length || s.analysisStatus !== "unreviewed" || s.outcome !== "checked_unreviewed" : r.items.length) fail();
    if (s.analysisStatus === "unavailable" && (s.outcome !== "limited_coverage" || s.abstention !== null)) fail();
    return v;
  }
  function render(v) {
    const note = section("Operator declaration — unverified"); note.append(node("p", `Declared by: ${v.review.reviewerLabel}`), node("p", v.review.reportNote), node("p", "Reviewer identity, inspected basis and dispositions are operator statements. Original analytical reasoning remains unreviewed."));
    if (v.source.abstention) note.append(node("p", `Original report abstention: ${v.source.abstention}`));
    const declarations = section(v.review.coverage === "report_limits" ? "Report limits" : "Selected concern declarations");
    if (!v.review.items.length) declarations.append(node("p", "No selected concern is recorded. This does not establish that the idea or app has no risks."));
    for (const item of v.review.items) {
      const c = item.original; declarations.append(node("h4", `${item.concernId} · ${item.disposition.replaceAll("_", " ")}`), node("p", item.reason), node("p", `Declared basis inspected: ${item.basisInspected}`), node("h4", "Original unreviewed concern"), node("p", c.statement), node("p", `Why it matters: ${c.whyItMatters}`), node("p", `Original priority: ${c.priority} · ${c.priorityReason}`));
      const refs = node("details"); refs.append(node("summary", "Original citations and proposed check")); for (const b of c.basis) { refs.append(node("p", b.kind === "brief_field" ? `Brief field ${b.fieldId}` : `Context source ${b.sourceId} · ${b.use}`)); for (const k of b.kind === "brief_field" ? ["fieldSha256"] : ["recordSha256", "contentSha256"]) refs.append(node("code", b[k], "code-hash")); }
      refs.append(node("p", `Proposed question: ${c.nextCheck.question}`), node("p", `Unreviewed method: ${c.nextCheck.method}`), node("p", `Unreviewed success rule: ${c.nextCheck.successRule}`), node("p", "Protocol unreviewed. No action or experiment is created.")); declarations.append(refs);
    }
    const access = section("Current inspection"); access.append(node("p", `Checked: ${v.access.checkedAt}`), node("p", `This display clears at: ${v.access.displayUntil}`), node("p", "Recheck clears old text before reading current sources again. Revocation is detected on recheck or local expiry. Delivered copies cannot be recalled."));
    const pins = node("details"); pins.append(node("summary", "Saved record references"), node("p", `Note: ${v.id} · Created: ${v.createdAt}`), node("p", `Task: ${v.source.taskId} · Run: ${v.source.runId} · Brief: ${v.source.briefId}`)); for (const h of [v.recordSha256, v.normalizedInputSha256, v.source.reportSha256]) pins.append(node("code", h, "code-hash")); access.append(pins); content.replaceChildren(note, declarations, access);
  }
  function currentAccess() { if (!selection?.until) return; if (Date.now() < selection.wallStart || Date.now() >= selection.until || performance.now() >= selection.monotonicUntil) clear("Review note display expired or its local clock changed. Open again for a full check."); else { clearTimeout(expiryTimer); expiryTimer = setTimeout(currentAccess, Math.max(1, Math.min(selection.until - Date.now(), selection.monotonicUntil - performance.now()) + 1)); } }
  function arm(v) { const now = Date.now(); selection.until = time(v.access.displayUntil); selection.wallStart = now; selection.monotonicUntil = performance.now() + Math.max(0, selection.until - now); clearTimeout(expiryTimer); expiryTimer = setTimeout(currentAccess, Math.max(1, selection.until - now)); }
  async function inspect(entry) {
    if (active || location.hash !== "#reviews" || document.hidden) return;
    clear(); document.dispatchEvent(new CustomEvent("redteam:managed-detail-open", {detail:"operator-note"})); const target = {id:entry.id,recordSha256:entry.recordSha256,createdAt:entry.createdAt,normalizedInputSha256:entry.normalizedInputSha256,taskId:entry.taskId,runId:entry.runId,reportSha256:entry.reportSha256}; selection = target; const attempt = generation, controller = new AbortController(); active = controller; $("operator-note-detail-state").textContent = "Checking saved data and current source access…"; dialog.showModal(); $("operator-note-title").focus();
    try { const v = checked(await request(`/api/context-operator-reviews/${target.id}/managed`, controller), target); if (attempt !== generation || selection !== target || controller.signal.aborted || !dialog.open || document.hidden || location.hash !== "#reviews") return; render(v); arm(v); currentAccess(); if (selection !== target) return; $("operator-note-detail-state").textContent = "Saved data checked. Operator statements remain unverified."; $("operator-note-recheck").disabled = false; }
    catch { if (attempt === generation) clear("Review note unavailable. Current access, saved bytes or response checks failed. Open again or refresh metadata explicitly."); }
    finally { if (active === controller) active = null; }
  }
  async function load(after = "0") {
    if (active || location.hash !== "#reviews" || document.hidden) return;
    clear(); next = null; $("operator-note-list").replaceChildren(); $("operator-note-next").hidden = true; $("operator-note-state").textContent = "Reading saved note metadata…"; const attempt = generation, controller = new AbortController(); active = controller; $("operator-note-refresh").disabled = true;
    try { const v = metadata(await request(`/api/context-operator-reviews?afterRowId=${after}&rowLimit=50`, controller), after); if (attempt !== generation || controller.signal.aborted || document.hidden || location.hash !== "#reviews") return; next = v.nextAfterRowId; const rows = v.entries.map(e => { const row = node("div", undefined, "grant-item operator-note-record"); row.dataset.operatorNote = e.id; const copy = node("div", undefined, "grant-main"); copy.append(node("strong", "Saved review note"), node("p", e.createdAt), node("small", `Note ${e.id} · Unverified metadata`)); const button = node("button", "Inspect note", "small-button"); button.addEventListener("click", () => inspect(e)); row.append(copy, button); return row; }); $("operator-note-list").replaceChildren(...(rows.length ? rows : [node("p", "No saved review note in this window.", "empty")])); $("operator-note-next").hidden = next === null; $("operator-note-state").textContent = `${v.inspectedRows} rows inspected after cursor ${after}. Metadata is unverified; this is a bounded window.`; }
    catch { if (attempt === generation) $("operator-note-state").textContent = "Review note metadata unavailable. Save a note through the terminal or refresh explicitly. No retry was made."; }
    finally { if (active === controller) active = null; $("operator-note-refresh").disabled = false; }
  }
  $("operator-note-refresh").addEventListener("click", () => load()); $("operator-note-next").addEventListener("click", () => { if (next) void load(next); }); $("operator-note-close").addEventListener("click", () => clear()); $("operator-note-recheck").addEventListener("click", () => { if (selection) void inspect(selection); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); clear(); }); dialog.addEventListener("close", () => { if (expectedCloses) expectedCloses--; else if (selection) clear(); });
  document.addEventListener("redteam:managed-detail-open", event => { if (event.detail !== "operator-note") clear(); });
  window.addEventListener("hashchange", () => { clear(); $("operator-note-list").replaceChildren(); next = null; $("operator-note-next").hidden = true; $("operator-note-state").textContent = "Load metadata to inspect saved terminal review notes."; });
  window.addEventListener("pagehide", () => clear()); window.addEventListener("pageshow", currentAccess); window.addEventListener("focus", currentAccess); document.addEventListener("visibilitychange", () => { if (document.hidden) clear("Review note display cleared while the page was hidden. Open again for a full check."); else currentAccess(); });
})();
