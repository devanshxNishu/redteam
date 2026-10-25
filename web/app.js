const token = document.querySelector('meta[name="redteam-token"]').content;
const $ = id => document.getElementById(id);
let data = null;
let timer;
let toastTimer;
const imageUrls = [];
let openedActorRun = null;
let openedCodeRun = null;
let codeCatalog = null;
let actionCatalog = null;
let detailGeneration = 0;
let detailController = null;
let expiryTimer;
let expectedCloseEvents = 0;
let refreshGeneration = 0;
let refreshController = null;
const activeStates = new Set(["queued", "running", "verifying", "reporting"]);

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
async function api(path, options = {}) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
  const response = await fetch(path, { ...options, signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed." }));
    throw Object.assign(new Error(error.error || "Request failed."), { status: response.status });
  }
  return response.json();
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").className = error ? "error" : "";
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 5000);
}
function date(value) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function jobTitle(job) { return job.variant === "broken" ? "Signup readiness · broken build" : "Signup readiness · fixed build"; }
function stateLabel(job) {
  if (job.status === "completed") return job.findingCount ? "Finding reproduced" : "Requirement passed";
  return job.status.replaceAll("_", " ");
}
function stateClass(job) { return activeStates.has(job.status) ? "state running" : job.status === "completed" && !job.findingCount ? "state" : "state failure"; }
function setView() {
  const view = ["overview", "reviews", "access", "research", "terminal"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  for (const panel of document.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== view;
  for (const link of document.querySelectorAll("[data-view]")) {
    link.classList.toggle("selected", link.dataset.view === view);
    if (link.dataset.view === view) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  }
  $("breadcrumb").textContent = { overview: "Overview", reviews: "Reviews", access: "Access", research: "Stakeholder models", terminal: "Terminal" }[view];
}
function render() {
  $("workspace-path").textContent = data.workspace;
  for (const key of ["reviews", "findings", "artifacts"]) $(`metric-${key}`).textContent = data.metrics[key];
  $("metric-access").textContent = data.metrics.accessGrants;
  $("nav-count").textContent = data.jobs.length;
  $("active-count").textContent = `${data.jobs.filter(job => activeStates.has(job.status)).length} active`;
  const activity = data.jobs.slice(0, 4).map(job => {
    const row = node("div", undefined, "activity-item");
    const warning = job.findingCount > 0 || !activeStates.has(job.status) && job.status !== "completed";
    row.append(node("span", activeStates.has(job.status) ? "◌" : warning ? "!" : "✓", `activity-symbol${warning ? " broken" : ""}`));
    const copy = node("div", undefined, "activity-copy");
    copy.append(node("strong", jobTitle(job)), node("p", stateLabel(job)));
    row.append(copy, node("span", date(job.createdAt), "activity-time"));
    return row;
  });
  $("activity-list").replaceChildren(...(activity.length ? activity : [node("p", "Your first review will appear here. Start with the controlled demo.", "empty")]));
  const rows = data.jobs.map(job => {
    const row = node("tr");
    const title = node("td"); title.append(node("strong", jobTitle(job)), node("small", job.id.slice(0, 8)));
    const state = node("td"); state.append(node("span", stateLabel(job), stateClass(job)));
    const action = node("td");
    const button = node("button", "Inspect →", "small-button");
    button.disabled = !["completed", "limited_coverage"].includes(job.status);
    button.addEventListener("click", () => showReview(job)); action.append(button);
    row.append(title, state, node("td", job.findingCount), node("td", job.artifactCount), node("td", date(job.createdAt)), action);
    return row;
  });
  if (!rows.length) { const row = node("tr"); const cell = node("td", "No reviews recorded yet.", "empty"); cell.colSpan = 6; row.append(cell); rows.push(row); }
  $("reviews-body").replaceChildren(...rows);
  const grants = data.grants.map(grant => {
    const row = node("div", undefined, "grant-item");
    const copy = node("div", undefined, "grant-main");
    copy.append(node("strong", grant.name), node("p", grant.target), node("small", `${grant.capabilities.join(" · ")}${grant.hasSession ? " · encrypted session" : ""}`));
    const label = node("span", grant.revokedAt ? "Revoked" : grant.active ? "Active" : "Expired", grant.active ? "state" : "state failure");
    row.append(copy, label);
    if (!grant.revokedAt) {
      const revoke = node("button", "Revoke", "small-button");
      revoke.addEventListener("click", async () => { try { await api(`/api/access/${grant.id}/revoke`, { method: "POST" }); toast("Access revoked. Stored session removed."); await refresh(); } catch (error) { toast(error.message, true); } });
      row.append(revoke);
    }
    return row;
  });
  $("grant-list").replaceChildren(...(grants.length ? grants : [node("p", "No access grants. Add a target here or use redteam access grant.", "empty")]));
  $("research-summary").textContent = data.research.status;
  $("research-sources").textContent = data.research.sources;
  $("research-grounded").textContent = data.research.groundedModels;
  $("research-validated").textContent = data.research.validatedModels;
  $("model-list").replaceChildren(...data.research.models.map(model => {
    const card = node("article", undefined, "card model-card");
    const heading = node("div", undefined, "card-title");
    heading.append(node("h2", `${model.id} · ${model.version}`), node("span", model.status.replaceAll("_", " "), model.status === "research_grounded" ? "state" : "state running"));
    card.append(heading, node("p", `${model.domain} · ${model.scope.country} · ${model.scope.segment}`, "muted"), node("p", model.scope.decision, "muted"));
    for (const limitation of model.limitations) card.append(node("p", limitation, "fine-print"));
    card.append(node("p", `${model.sourceIds.length} source references · ${model.hash.slice(0, 16)}…`, "mono fine-print"));
    return card;
  }));
  $("actor-run-list").replaceChildren(...data.actorRuns.slice(0, 10).map(run => {
    const row = node("div", undefined, "grant-item");
    const copy = node("div", undefined, "grant-main");
    copy.append(node("strong", run.kind === "model_actor_run" ? "Configured model simulation" : "Scripted consumer + investor"), node("p", run.restricted ? "Research permission changed. Report restricted." : run.decisions.map(decision => `${decision.domain ?? "actor"}: ${(decision.action ?? decision.outcome).replaceAll("_", " ")}`).join(" · ")), node("small", `${date(run.createdAt)} · ${run.artifacts} artifacts`));
    const inspect = node("button", "Inspect actor report →", "small-button");
    inspect.disabled = run.restricted;
    inspect.addEventListener("click", () => showActorReport(run.runId));
    row.append(copy, inspect); return row;
  }));
  if (openedActorRun && data.actorRuns.some(run => run.runId === openedActorRun && run.restricted)) {
    closeDetail(); toast("Research permissions changed. The actor report is now restricted.", true);
  }
}
async function refresh() {
  clearTimeout(timer);
  const generation = ++refreshGeneration;
  refreshController?.abort(); refreshController = new AbortController();
  const signal = refreshController.signal;
  try {
    const [workspace, catalog, actions] = await Promise.all([api("/api/workspace", { signal }), api("/api/code-runs", { signal }), api("/api/actions", { signal })]);
    if (generation !== refreshGeneration) return;
    data = workspace; codeCatalog = catalog; actionCatalog = actions;
    $("connection-status").textContent = "Local service connected";
    $("connection-dot").style.background = "#7ba595";
    render(); renderCodeCatalog(); renderActionCatalog();
    if (openedCodeRun) {
      if (!codeEntry(openedCodeRun.kind, openedCodeRun.id)) clearCodeState("Code access changed. The record was closed.");
      else {
        armCodeExpiry();
        if (!openedCodeRun.pending) {
          const attempt = { generation: detailGeneration, signal: detailController.signal }, current = openedCodeRun;
          try {
            const checked = await api(detailRoute(current.kind, current.id), { signal: AbortSignal.any([signal, attempt.signal]) });
            if (generation === refreshGeneration && ownsDetail(attempt) && current.kind === "actions" && checked.record.revision !== current.revision) {
              if (current.editing) { $("action-form-status").textContent = "A newer revision is available. Read it before deliberately applying an update."; $("action-reload").hidden = false; }
              else { $("detail-content").replaceChildren(...actionSections(checked)); current.revision = checked.record.revision; }
            }
          }
          catch (error) {
            if (generation === refreshGeneration && ownsDetail(attempt)) {
              if (current.kind === "actions" && error.status === 409) {
                if (current.editing) { $("action-form-status").textContent = "The revision changed while checking. Read the latest action before deliberately updating. Your draft is preserved."; $("action-reload").hidden = false; }
                else toast("The action changed while checking. Open it again before editing.", true);
              } else { closeDetail(); toast("Record unavailable. Access or integrity checks failed.", true); }
            }
          }
        }
      }
    }
  } catch (error) {
    if (generation !== refreshGeneration) return;
    $("connection-status").textContent = "Service disconnected";
    $("connection-dot").style.background = "#c93938";
    clearCodeState("Current access cannot be refreshed. The record was closed.");
    if (!data) toast(error.message, true);
  } finally {
    if (generation === refreshGeneration) timer = setTimeout(refresh, data?.jobs.some(job => activeStates.has(job.status)) ? 1500 : 10000);
  }
}
function resetDetail() {
  detailGeneration++;
  detailController?.abort(); detailController = null;
  clearTimeout(expiryTimer);
  openedActorRun = null; openedCodeRun = null;
  for (const url of imageUrls.splice(0)) URL.revokeObjectURL(url);
  $("detail-content").replaceChildren();
  $("detail-title").textContent = "Review";
  $("review-dialog").scrollTop = 0;
}
function closeDetail() {
  resetDetail();
  if ($("review-dialog").open) { expectedCloseEvents++; $("review-dialog").close(); }
}
function beginDetail() {
  resetDetail();
  detailController = new AbortController();
  return { generation: detailGeneration, signal: detailController.signal };
}
function ownsDetail(attempt) { return detailGeneration === attempt.generation && !attempt.signal.aborted; }
function codeEntry(kind, id) {
  if (kind === "browser-source") { const job = data?.jobs.find(item => item.id === id && ["completed", "limited_coverage"].includes(item.status)); return job ? { entry: job, grant: null } : null; }
  if (kind === "actions") {
    const action = actionCatalog?.actions.find(item => item.id === id);
    const parent = action && codeEntry(action.origin.kind === "engineering_observation" ? "observations" : "browser-source", action.origin.runId);
    return parent ? { entry: action, grant: parent.grant } : null;
  }
  const entry = (kind === "repositories" ? codeCatalog?.repositoryRuns : codeCatalog?.engineeringRuns)?.find(run => run.runId === id);
  const grant = entry && data?.grants.find(item => item.id === entry.grantId);
  return entry && grant?.kind === "directory" && grant.target === entry.target && grant.capabilities.includes("code:read") && !grant.revokedAt && Date.parse(grant.expiresAt) > Date.now() ? { entry, grant } : null;
}
function renderCodeCatalog() {
  $("code-state").textContent = codeCatalog ? "Catalog entries are unverified. Opening a record checks current access and saved evidence hashes." : "Code records unavailable. Reconnect to refresh access.";
  for (const [kind, id, runs] of [["repositories", "repository-run-list", codeCatalog?.repositoryRuns], ["observations", "engineering-run-list", codeCatalog?.engineeringRuns]]) {
    const rows = (runs ?? []).filter(run => codeEntry(kind, run.runId)).map(run => {
      const row = node("div", undefined, "grant-item code-record"); row.dataset.codeRun = run.runId;
      const copy = node("div", undefined, "grant-main");
      copy.append(node("strong", kind === "repositories" ? "Local source snapshot" : "Operator-supplied source notes"), node("p", run.target), node("small", `${date(run.createdAt)} · ${kind === "repositories" ? `${run.fileCount} files · ${run.totalBytes} bytes` : `${run.observationCount} notes`} · Cataloged, unverified`));
      const inspect = node("button", kind === "repositories" ? "Inspect snapshot →" : "Inspect source notes →", "small-button");
      inspect.addEventListener("click", () => showCodeReport(kind, run.runId)); row.append(copy, inspect); return row;
    });
    $(id).replaceChildren(...(rows.length ? rows : [node("p", codeCatalog ? "No permitted records. Create an owned snapshot or note record through the terminal." : "Current code access cannot be established.", "empty")]));
  }
}
function clearCodeState(message) {
  codeCatalog = null; actionCatalog = null; renderCodeCatalog(); renderActionCatalog();
  if (openedCodeRun || openedActorRun) { closeDetail(); if (message) toast(message, true); }
}
function armCodeExpiry() {
  clearTimeout(expiryTimer);
  if (!openedCodeRun) return;
  const access = codeEntry(openedCodeRun.kind, openedCodeRun.id);
  if (!access) { clearCodeState("Code access changed. The record was closed."); return; }
  if (!access.grant) return;
  expiryTimer = setTimeout(() => {
    if (openedCodeRun && codeEntry(openedCodeRun.kind, openedCodeRun.id)) armCodeExpiry();
    else clearCodeState("Code access expired. The record was closed.");
  }, Math.min(2_147_000_000, Math.max(1, Date.parse(access.grant.expiresAt) - Date.now())));
}
function codeSections(kind, report) {
  if (kind === "actions") return actionSections(report);
  const scope = section(kind === "repositories" ? "Captured source scope" : "Operator-supplied notes");
  scope.append(node("p", "Limited coverage. No source code, app test, or model was executed by this workflow."), node("p", `Captured: ${date(report.createdAt)} · Run: ${report.runId}`), node("p", `Target: ${report.target}`), node("p", "Saved evidence hashes checked for this request. This is not semantic verification or an approved finding."));
  const sections = [scope];
  if (kind === "repositories") {
    scope.append(node("p", `Collection ended: ${date(report.capturedUntil)}. This is not an atomic repository revision.`));
    const coverage = section("Coverage and exclusions");
    coverage.append(node("p", `${report.coverage.fileCount} files · ${report.coverage.totalBytes} bytes · ${report.coverage.entriesExamined} entries examined.`), node("p", `Bounded traversal finished: ${report.coverage.traversalFinished ? "yes" : "no"}. Excluded descendants remain unreviewed.`), node("p", `Policy ${report.policy.version}: ${report.policy.maxFiles} files, ${report.policy.maxFileBytes} bytes per file, ${report.policy.maxTotalBytes} total bytes, ${report.policy.maxEntries} entries, depth ${report.policy.maxDepth}, and ${report.policy.maxDurationMs} ms between-operation deadline.`));
    for (const [reason, count] of Object.entries(report.coverage.skipped)) coverage.append(node("p", `${reason.replaceAll("_", " ")}: ${count}`));
    const files = section("Captured files and hashes");
    for (const file of report.files) { files.append(node("p", `${file.sourcePath} · ${file.bytes} bytes`), node("code", file.sha256, "code-hash")); }
    if (!report.files.length) files.append(node("p", "No eligible text file was captured."));
    sections.push(coverage, files);
  } else {
    const requirements = section("Supplied requirements · unverified");
    for (const requirement of report.requirements) requirements.append(node("h4", requirement.id), node("p", requirement.statement), node("p", `Operator-supplied reference: ${requirement.source.reference}`));
    if (!report.requirements.length) requirements.append(node("p", "No expected-result requirement was supplied."));
    sections.push(requirements);
    for (const observation of report.observations) {
      const notes = section(`${observation.id} · source observation`);
      notes.append(node("p", observation.statement), node("p", `Expectation: ${observation.requirementId ? `supplied, unverified (${observation.requirementId})` : "unknown"}.`), node("p", "Semantic review: unreviewed. Execution: not executed. Defect: not assessed."), node("p", "Citation integrity: matched saved bytes. This does not establish that the note is correct."));
      for (const citation of observation.citations) notes.append(node("p", `${citation.sourcePath} · lines ${citation.startLine}–${citation.endLine} · ${citation.rangeBytes} bytes`), node("p", "File SHA-256"), node("code", citation.fileSha256, "code-hash"), node("p", "Range SHA-256"), node("code", citation.rangeSha256, "code-hash"));
      notes.append(planButton({ kind: "engineering_observation", runId: report.runId, itemId: observation.id }));
      sections.push(notes);
    }
  }
  const limitations = section("Limits and current access");
  for (const limitation of report.limitations) limitations.append(node("p", limitation));
  limitations.append(node("p", "Access and integrity are checked again during refresh, at most ten seconds between idle polls plus request time. Known expiry is checked locally. Data already delivered cannot be recalled."));
  return [...sections, limitations];
}
async function showCodeReport(kind, id) {
  const attempt = beginDetail();
  if (!codeEntry(kind, id)) { closeDetail(); toast("Current code access is unavailable.", true); return; }
  openedCodeRun = { kind, id, pending: true }; armCodeExpiry();
  try {
    const report = await api(detailRoute(kind, id), { signal: attempt.signal });
    if (!ownsDetail(attempt)) return;
    if (!codeEntry(kind, id)) { clearCodeState("Code access changed. The record was closed."); return; }
    $("detail-title").textContent = kind === "actions" ? "Tracked follow-up action" : kind === "repositories" ? "Local repository snapshot" : "Engineering source notes";
    $("detail-content").replaceChildren(...codeSections(kind, report));
    openedCodeRun.pending = false; if (kind === "actions") openedCodeRun.revision = report.record.revision;
    if (!$("review-dialog").open) $("review-dialog").showModal(); $("detail-title").focus({ preventScroll: true }); armCodeExpiry();
  } catch (error) {
    if (ownsDetail(attempt)) { closeDetail(); toast(error.message, true); }
  }
}

function detailRoute(kind, id) { return kind === "actions" ? `/api/actions/${id}` : kind === "browser-source" ? `/api/reviews/${id}` : `/api/code-runs/${kind}/${id}`; }
function renderActionCatalog() {
  const rows = (actionCatalog?.actions ?? []).filter(action => codeEntry("actions", action.id)).map(action => {
    const row = node("div", undefined, "grant-item action-record"); row.dataset.actionId = action.id;
    const copy = node("div", undefined, "grant-main");
    copy.append(node("strong", action.title), node("p", `Owner label: ${action.owner}`), node("small", `${date(action.updatedAt)} · ${action.status.replaceAll("_", " ")} · revision ${action.revision} · Operator declaration · Cataloged, unverified`));
    const inspect = node("button", "Inspect action →", "small-button"); inspect.addEventListener("click", () => showCodeReport("actions", action.id)); row.append(copy, inspect); return row;
  });
  $("action-run-list").replaceChildren(...(rows.length ? rows : [node("p", actionCatalog ? "No permitted recent actions. Open a source note or browser finding to plan a next step." : "Current action access cannot be established.", "empty")]));
}
function actionSections(result) {
  const record = result.record, scope = section(record.title);
  scope.append(node("p", `Owner label: ${record.owner}. This does not assign or notify an external person.`), node("p", `Progress: ${record.status.replaceAll("_", " ")} · revision ${record.revision}.`), node("p", "Operator supplied. Not independently verified. Tracking did not perform this work."));
  const plan = section("Next step and validation method"); plan.append(node("p", record.nextStep), node("h4", "Separate validation method"), node("p", record.validationMethod));
  const origin = section("Pinned source"); origin.append(node("p", `${record.origin.kind.replaceAll("_", " ")}: ${record.origin.runId} · ${record.origin.itemId}`), node("p", `Evidence run: ${record.origin.evidenceRunId}. Original source status: ${record.origin.sourceStatus.replaceAll("_", " ")}.`), node("code", record.origin.reportSha256, "code-hash"));
  const history = section("Declared revision history"), details = node("details"); details.append(node("summary", `${result.events.length} recorded revisions`));
  for (const event of result.events) details.append(node("h4", `Revision ${event.revision} · ${event.after.status.replaceAll("_", " ")}`), node("p", `Recorded: ${date(event.at)}`), node("p", event.note), node("p", `Owner label: ${event.after.owner}`), node("p", event.after.nextStep), node("p", `Validation method: ${event.after.validationMethod}`));
  history.append(details);
  const limits = section("Tracking limits"); for (const limitation of result.limitations) limits.append(node("p", limitation));
  const edit = node("button", "Edit declared action", "primary"); edit.addEventListener("click", () => showActionForm(null, record));
  const actions = node("div", undefined, "detail-actions"); actions.append(edit);
  return [scope, plan, origin, history, limits, actions];
}
function planButton(origin) { const button = node("button", "Plan a next step", "small-button"); button.addEventListener("click", () => showActionForm(origin)); return button; }
function showActionForm(origin, record = null) {
  const attempt = beginDetail();
  const kind = record ? "actions" : origin.kind === "engineering_observation" ? "observations" : "browser-source", id = record ? record.id : origin.runId;
  if (!codeEntry(kind, id)) { closeDetail(); toast("Current source access is unavailable.", true); return; }
  openedCodeRun = { kind, id, pending: false, editing: true, revision: record?.revision }; armCodeExpiry();
  $("detail-title").textContent = record ? "Edit declared action" : "Plan a next step";
  const form = node("form"); form.id = "action-form";
  form.append(node("p", "Plans and progress are operator declarations. Saving does not execute work, send a message, or verify a result.", "fine-print"));
  const fields = {};
  for (const [key, label, maximum, multiline] of [["title", "Action title", 200, false], ["owner", "Owner label · no external assignment", 120, false], ["nextStep", "Next step", 2000, true], ["validationMethod", "Separate validation method", 2000, true]]) {
    const caption = node("label", label); caption.htmlFor = `action-${key}`;
    const input = node(multiline ? "textarea" : "input"); input.id = `action-${key}`; input.name = key; input.required = true; input.maxLength = maximum; input.autocomplete = "off"; input.value = record?.[key] ?? "";
    if (multiline) input.rows = 3; fields[key] = input; form.append(caption, input);
  }
  if (record) {
    const caption = node("label", `Declared progress · editing revision ${record.revision}`); caption.htmlFor = "action-status";
    const status = node("select"); status.id = "action-status";
    for (const value of ["proposed", "in_progress", "blocked", "completed_declared", "cancelled"]) { const option = node("option", value.replaceAll("_", " ")); option.value = value; status.append(option); }
    status.value = record.status; fields.status = status; form.append(caption, status);
    const noteLabel = node("label", "Why are you changing this record?"); noteLabel.htmlFor = "action-note";
    const note = node("textarea"); note.id = "action-note"; note.required = true; note.maxLength = 1000; note.rows = 2; fields.note = note; form.append(noteLabel, note);
  }
  const message = node("p", "", "fine-print"); message.id = "action-form-status"; message.setAttribute("role", "alert");
  const reload = node("button", "Read latest action · discard this draft", "small-button"); reload.type = "button"; reload.id = "action-reload"; reload.hidden = true; reload.addEventListener("click", () => { if (record) void showCodeReport("actions", record.id); });
  const save = node("button", record ? "Save declared update" : "Save proposed action", "primary"); save.type = "submit";
  form.append(message, reload, save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || save.disabled) return;
    const values = Object.fromEntries(["title", "owner", "nextStep", "validationMethod"].map(key => [key, fields[key].value]));
    if (record && Object.entries({ ...values, status: fields.status.value }).every(([key, value]) => record[key] === value)) { message.textContent = "Change a tracked field before saving."; return; }
    save.disabled = true;
    try {
      const payload = record ? { schemaVersion: "1.0", kind: "action_update", expectedRevision: record.revision, ...values, status: fields.status.value, note: fields.note.value } : { schemaVersion: "1.0", kind: "action_input", origin, ...values };
      const result = await api(record ? `/api/actions/${record.id}` : "/api/actions", { method: record ? "PATCH" : "POST", body: JSON.stringify(payload), signal: attempt.signal });
      if (!ownsDetail(attempt)) return;
      await refresh(); if (!ownsDetail(attempt)) return;
      await showCodeReport("actions", result.id);
    } catch (error) {
      if (!ownsDetail(attempt)) return;
      if (error.status === 409) { message.textContent = "This action changed. Read its latest revision before deliberately applying an update. Your draft was not submitted again."; reload.hidden = false; }
      else { closeDetail(); toast(`Save could not be confirmed. Read recent actions before retrying. ${error.message}`, true); }
    } finally { if (ownsDetail(attempt)) save.disabled = false; }
  });
  $("detail-content").replaceChildren(form); if (!$("review-dialog").open) $("review-dialog").showModal(); fields.title.focus({ preventScroll: true });
}

function section(title) { const element = node("section", undefined, "detail-section"); element.append(node("h3", title)); return element; }
async function showActorReport(id) {
  const attempt = beginDetail(); openedActorRun = id;
  try {
    const report = await api(`/api/actors/${id}`, { signal: attempt.signal });
    if (!ownsDetail(attempt)) return;
    $("detail-title").textContent = report.kind === "model_actor_run" ? "Configured model simulation" : "Scripted stakeholder decisions";
    const summary = section(report.kind === "model_actor_run" ? "Simulation scope" : "Software demonstration"); summary.append(node("p", report.note));
    summary.append(node("p", `Run outcome: ${report.outcome.replaceAll("_", " ")}.`));
    if (report.task) summary.append(node("p", `Task state: ${report.task.record.state.replaceAll("_", " ")}.`));
    if (report.recovery?.reason === "publication_missing") summary.append(node("p", "Decision publication: unavailable. No stakeholder decision is included."));
    if (report.budget) {
      const pending = report.budget.invocations.filter(item => ["reserved", "in_flight", "uncertain"].includes(item.state)).length;
      summary.append(node("p", pending ? `${pending} ${pending === 1 ? "request has" : "requests have"} unsettled usage. Reported cost is incomplete.` : "All recorded inference usage is settled."));
    }
    const sections = report.reports.map(actor => {
      const result = section(actor.decision ? `${actor.decision.domain} · ${actor.decision.action.replaceAll("_", " ")}` : actor.outcome.replaceAll("_", " "));
      if (actor.decision) {
        result.append(node("p", actor.decision.rationale));
        for (const constraint of actor.decision.constraints) result.append(node("p", `${constraint.key}: ${constraint.state}. Evidence: ${constraint.evidenceRefs.join(", ") || "not supplied"}.`));
        if (actor.decision.domain === "investor") for (const condition of actor.decision.conditions) result.append(node("p", `Condition: ${condition}`));
        for (const missing of actor.decision.missingInformation) result.append(node("p", `Missing information: ${missing}`));
        for (const condition of actor.decision.changeConditions) result.append(node("p", `Would change if: ${condition}`));
      }
      const details = node("details"); details.append(node("summary", "Execution details and limits"));
      details.append(node("p", `${actor.backend.mode} · ${actor.usage.steps} steps · ${actor.usage.reads} reads · ${actor.usage.inputTokens + actor.usage.outputTokens} reported tokens`));
      for (const limitation of actor.limitations) details.append(node("p", limitation));
      result.append(details);
      for (const error of actor.errors) result.append(node("p", error));
      return result;
    });
    const evidence = section("Evidence artifacts");
    for (const artifact of report.artifacts) evidence.append(node("p", `${artifact.owner}: ${artifact.sha256}`));
    const verify = node("button", "Verify actor artifacts", "primary");
    verify.addEventListener("click", async () => {
      try { const checked = await api(`/api/actors/${id}/verify`, { method: "POST" }); toast(checked.valid ? `${checked.artifacts} actor artifact hashes verified.` : checked.errors.join("; "), !checked.valid); }
      catch (error) { toast(error.message, true); }
    });
    const actions = node("div", undefined, "detail-actions"); actions.append(verify);
    $("detail-content").replaceChildren(summary, ...sections, evidence, actions);
    openedActorRun = id;
    if (!$("review-dialog").open) $("review-dialog").showModal();
  } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(error.message, true); } }
}
async function showReview(job) {
  const attempt = beginDetail();
  try {
    const report = await api(`/api/reviews/${job.id}`, { signal: attempt.signal });
    if (!ownsDetail(attempt)) return;
    $("detail-title").textContent = jobTitle(job);
    const summary = section("Recorded result");
    const definition = node("dl");
    for (const [key, value] of [["Outcome", report.outcome], ["Run", report.runId], ["Requirement", report.manifest.requirement.id], ["Mode", "Deterministic local fixture"]]) definition.append(node("dt", key), node("dd", value));
    summary.append(definition);
    const executions = section("Fresh executions");
    for (const execution of report.executions) {
      executions.append(node("p", `${execution.role}: ${execution.status} · ${execution.assertion?.verdict ?? "not evaluated"} · Browser ${execution.browserVersion ?? "unavailable"}`));
      if (execution.assertion) executions.append(node("p", `Expected: “${execution.assertion.expected}”. Observed: “${execution.assertion.actual ?? "absent"}”.`));
    }
    const findings = section("Findings and next action");
    if (!report.findings.length) findings.append(node("p", report.outcome === "completed" ? "The tested requirement passed in both fresh executions." : "Coverage is incomplete. No verified defect can be concluded."));
    for (const finding of report.findings) findings.append(node("h3", finding.title), node("p", `Verification: ${finding.status}. ${finding.proposedAction}`), node("p", `Business hypothesis: ${finding.businessHypothesis}`), planButton({ kind: "browser_finding", runId: job.id, itemId: finding.id }));
    const artifacts = section("Evidence artifacts");
    for (const artifact of report.artifacts) {
      const row = node("div", undefined, "artifact-row"); row.append(node("span", artifact.mediaType), node("code", `${artifact.sha256.slice(0, 16)}…`));
      artifacts.append(row);
    }
    const limitations = section("Scope and limitations");
    for (const limitation of report.limitations) limitations.append(node("p", limitation));
    const actions = node("div", undefined, "detail-actions");
    const verify = node("button", "Verify captured artifacts", "primary");
    verify.addEventListener("click", async () => { try { const result = await api(`/api/reviews/${job.id}/verify`, { method: "POST" }); toast(result.valid ? `${result.artifacts} artifact hashes verified.` : result.errors.join("; "), !result.valid); } catch (error) { toast(error.message, true); } });
    actions.append(verify);
    $("detail-content").replaceChildren(summary, executions, findings, artifacts, limitations, actions);
    if (!$("review-dialog").open) $("review-dialog").showModal();
    const screenshot = report.artifacts.find(artifact => artifact.mediaType === "image/png");
    if (screenshot) {
      const response = await fetch(`/api/reviews/${job.id}/artifacts/${screenshot.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok && ownsDetail(attempt) && $("review-dialog").open) {
        const image = node("img"); image.alt = "Screenshot captured during the primary review execution";
        const blob = await response.blob();
        if (!ownsDetail(attempt)) return;
        const url = URL.createObjectURL(blob); imageUrls.push(url); image.src = url; artifacts.append(image);
      }
    }
  } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(error.message, true); } }
}
$("run-review").addEventListener("click", async () => {
  const button = $("run-review"); button.disabled = true;
  try { await api("/api/reviews", { method: "POST", body: JSON.stringify({ variant: $("fixture-variant").value }) }); toast("Review queued. Browser evidence will appear in Reviews."); await refresh(); }
  catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$("access-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.target.querySelector("button"); button.disabled = true;
  try {
    await api("/api/access", { method: "POST", body: JSON.stringify({ name: $("access-name").value, target: $("access-target").value, kind: "web", capabilities: ["browser:read", "browser:interact"], expiresInHours: Number($("access-hours").value) }) });
    event.target.reset(); toast("Access grant created. No external actions were started."); await refresh();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$("run-actor-demo").addEventListener("click", async () => {
  const button = $("run-actor-demo"); button.disabled = true;
  try { const result = await api("/api/actors/demo", { method: "POST" }); await refresh(); await showActorReport(result.runId); }
  catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$("close-dialog").addEventListener("click", closeDetail);
$("review-dialog").addEventListener("cancel", event => { event.preventDefault(); closeDetail(); });
$("review-dialog").addEventListener("close", () => { if (expectedCloseEvents) expectedCloseEvents--; else if (!$("review-dialog").open) resetDetail(); });
window.addEventListener("hashchange", () => { closeDetail(); setView(); void refresh(); });
window.addEventListener("focus", () => { if (openedCodeRun) armCodeExpiry(); void refresh(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (openedCodeRun) armCodeExpiry(); void refresh(); } });
setView();
void refresh();
