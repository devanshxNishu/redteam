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
let experimentCatalog = null;
let reportExportCatalog = null;
let exportSelection = null;
let outcomeCatalog = null;
let briefCatalog = null;
let outcomeSelection = null;
let comparisonCatalog = null;
let openedComparison = null;
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
    const [workspace, catalog, actions, comparisons, experiments, exports, outcomes, briefs] = await Promise.all([api("/api/workspace", { signal }), api("/api/code-runs", { signal }), api("/api/actions", { signal }), api("/api/comparisons", { signal }), api("/api/experiments", { signal }), api("/api/report-exports", { signal }), api("/api/outcome-evidence", { signal }), api("/api/review-briefs", { signal })]);
    if (generation !== refreshGeneration) return;
    data = workspace; codeCatalog = catalog; actionCatalog = actions; comparisonCatalog = comparisons; experimentCatalog = experiments; reportExportCatalog = exports; outcomeCatalog = outcomes; briefCatalog = briefs;
    $("connection-status").textContent = "Local service connected";
    $("connection-dot").style.background = "#7ba595";
    render(); renderCodeCatalog(); renderActionCatalog(); renderComparisonCatalog(); renderExperimentCatalog(); renderReportExportCatalog(); renderExportOptions(); renderOutcomeCatalog(); renderOutcomeOptions(); renderBriefCatalog();
    if (openedCodeRun) {
      if (!codeEntry(openedCodeRun.kind, openedCodeRun.id)) clearCodeState("Code access changed. The record was closed.");
      else {
        armCodeExpiry();
        if (!openedCodeRun.pending) {
          const attempt = { generation: detailGeneration, signal: detailController.signal }, current = openedCodeRun;
          try {
            const checked = await api(detailRoute(current.kind, current.id), { signal: AbortSignal.any([signal, attempt.signal]) });
            if (current.kind === "review-briefs" && !await briefReportMatches(checked, current.id)) throw new Error("The checked brief does not match current metadata.");
            if (generation === refreshGeneration && ownsDetail(attempt) && current.kind === "outcome-selection" && outcomeSelection?.comparisonId) {
              const selected = outcomeSelection.comparisonId;
              try { await api(`/api/comparisons/${selected}`, { signal: AbortSignal.any([signal, attempt.signal]) }); }
              catch (error) { if (ownsDetail(attempt) && outcomeSelection?.comparisonId === selected) throw error; }
            }
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
    if (generation !== refreshGeneration) return;
    if (openedComparison) {
      const current = openedComparison, attempt = { generation: detailGeneration, signal: detailController.signal };
      if (current.kind === "form") {
        if ([current.baselineReviewId, current.candidateReviewId].some(id => id && !codeEntry("browser-source", id))) { closeDetail(); toast("A selected review is unavailable. The comparison form was closed.", true); }
        else refreshComparisonOptions();
      } else if (!comparisonEntry(current.id)) { closeDetail(); toast("Comparison sources are unavailable. The record was closed.", true); }
      else if (!current.pending) {
        try { await api(`/api/comparisons/${current.id}`, { signal: AbortSignal.any([signal, attempt.signal]) }); }
        catch { if (generation === refreshGeneration && ownsDetail(attempt)) { closeDetail(); toast("Comparison unavailable. Current source or publication checks failed.", true); } }
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
  openedActorRun = null; openedCodeRun = null; openedComparison = null; exportSelection = null; outcomeSelection = null;
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
  document.dispatchEvent(new CustomEvent("redteam:managed-detail-open", {detail: "review"}));
  resetDetail();
  detailController = new AbortController();
  return { generation: detailGeneration, signal: detailController.signal };
}
function ownsDetail(attempt) { return detailGeneration === attempt.generation && !attempt.signal.aborted; }
function codeEntry(kind, id) {
  if (kind === "brief-intake") return briefCatalog ? { entry: {}, grant: null } : null;
  if (kind === "review-briefs") {
    const entry = briefCatalog?.reviewBriefs.find(item => item.id === id);
    const pin = openedCodeRun?.kind === kind && openedCodeRun.id === id ? openedCodeRun.briefPin : null;
    return entry && ["idea", "app"].includes(entry.subjectType) && (!pin || ["id", "title", "subjectType", "createdAt", "inputSha256", "reportSha256"].every(key => pin[key] === entry[key])) ? { entry, grant: null } : null;
  }
  if (kind === "outcome-selection") {
    const plan = outcomeSelection && outcomeCatalog && outcomePlanAccess(outcomeSelection.planId);
    return plan && (!outcomeSelection.comparisonId || outcomeComparison(outcomeSelection.planId, outcomeSelection.comparisonId)) ? plan : null;
  }
  if (kind === "outcome-evidence") {
    const entry = outcomeCatalog?.outcomeEvidence.find(item => item.id === id), comparison = entry && outcomeComparison(entry.planId, entry.comparisonId);
    return comparison && comparison.verdict === entry.verdict ? { entry, grant: null } : null;
  }
  if (kind === "export-selection") {
    const scope = exportSelection && reportExportCatalog && exportAccess(exportSelection.items);
    return scope ? { entry: exportSelection, grant: scope.grant } : null;
  }
  if (kind === "report-exports") {
    const entry = reportExportCatalog?.reportExports.find(item => item.id === id), scope = entry && exportAccess(entry.sources);
    return scope ? { entry, grant: scope.grant } : null;
  }
  if (kind === "browser-source") { const job = data?.jobs.find(item => item.id === id && ["completed", "limited_coverage"].includes(item.status)); return job ? { entry: job, grant: null } : null; }
  if (kind === "experiments") {
    const plan = experimentCatalog?.experimentPlans.find(item => item.id === id);
    const parent = plan && codeEntry(plan.origin.kind === "engineering_observation" ? "observations" : "browser-source", plan.origin.runId);
    return parent ? { entry: plan, grant: parent.grant } : null;
  }
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
  codeCatalog = null; actionCatalog = null; comparisonCatalog = null; experimentCatalog = null; reportExportCatalog = null; outcomeCatalog = null; briefCatalog = null; renderBriefCatalog(); renderCodeCatalog(); renderActionCatalog(); renderComparisonCatalog(); renderExperimentCatalog(); renderReportExportCatalog(); renderOutcomeCatalog();
  if (openedCodeRun || openedActorRun || openedComparison) { closeDetail(); if (message) toast(message, true); }
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
  if (kind === "review-briefs") return briefSections(report);
  if (kind === "outcome-evidence") return outcomeEvidenceSections(report);
  if (kind === "report-exports") return reportExportSections(report);
  if (kind === "actions") return actionSections(report);
  if (kind === "experiments") return experimentSections(report);
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
  openedCodeRun = { kind, id, pending: true }; if (kind === "review-briefs") openedCodeRun.briefPin = { ...codeEntry(kind, id).entry }; armCodeExpiry();
  try {
    const report = await api(detailRoute(kind, id), { signal: attempt.signal });
    if (!ownsDetail(attempt)) return;
    if (kind === "review-briefs" && !await briefReportMatches(report, id)) throw new Error("The checked brief does not match current metadata.");
    if (!ownsDetail(attempt)) return;
    if (!codeEntry(kind, id)) { clearCodeState("Code access changed. The record was closed."); return; }
    $("detail-title").textContent = kind === "review-briefs" ? "Idea/app review brief" : kind === "outcome-evidence" ? "Linked controlled evidence" : kind === "report-exports" ? "Checked local report export" : kind === "experiments" ? "Frozen experiment plan" : kind === "actions" ? "Tracked follow-up action" : kind === "repositories" ? "Local repository snapshot" : "Engineering source notes";
    $("detail-content").replaceChildren(...codeSections(kind, report));
    openedCodeRun.pending = false; if (kind === "actions") openedCodeRun.revision = report.record.revision;
    if (!$("review-dialog").open) $("review-dialog").showModal(); $("detail-title").focus({ preventScroll: true }); armCodeExpiry();
  } catch (error) {
    if (ownsDetail(attempt)) { closeDetail(); toast(error.message, true); }
  }
}

function detailRoute(kind, id) { return kind === "review-briefs" ? `/api/review-briefs/${id}` : kind === "outcome-evidence" ? `/api/outcome-evidence/${id}` : kind === "report-exports" ? `/api/report-exports/${id}` : ["experiments", "outcome-selection"].includes(kind) ? `/api/experiments/${id}` : kind === "actions" ? `/api/actions/${id}` : kind === "browser-source" ? `/api/reviews/${id}` : `/api/code-runs/${kind}/${id}`; }
function renderBriefCatalog() {
  $("create-review-brief").disabled = !briefCatalog;
  const rows = (briefCatalog?.reviewBriefs ?? []).filter(item => codeEntry("review-briefs", item.id)).map(item => {
    const row = node("div", undefined, "grant-item brief-record"); row.dataset.briefId = item.id;
    const copy = node("div", undefined, "grant-main"); copy.append(node("strong", `${item.subjectType} · ${item.title}`), node("small", `${date(item.createdAt)} · Review not started · Cataloged, unverified`));
    const inspect = node("button", "Inspect brief →", "small-button"); inspect.addEventListener("click", () => showCodeReport("review-briefs", item.id)); row.append(copy, inspect); return row;
  });
  $("review-brief-list").replaceChildren(...(rows.length ? rows : [node("p", briefCatalog ? "No saved idea or app briefs." : "Brief metadata unavailable. Reconnect before adding or inspecting intake.", "empty")]));
}
async function briefReportMatches(report, id) {
  const bytes = new TextEncoder().encode(JSON.stringify(report, null, 2) + "\n"); if (bytes.length > 100000) return false;
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
  const entry = codeEntry("review-briefs", id)?.entry;
  return entry && report.id === id && report.kind === "review_brief" && report.reviewStatus === "not_started" && report.state === "intake_saved" && report.input.subjectType === entry.subjectType && report.input.title === entry.title && report.inputSha256 === entry.inputSha256 && report.createdAt === entry.createdAt && digest === entry.reportSha256;
}
function briefLabel(key) { return ({ users: "Target users", buyers: "Buyer or payer", market: "Country or market", language: "Language", problem: "Problem", solution: "Proposed solution", alternatives: "Current alternatives", valueProposition: "Value proposition", businessModel: "Business model", distribution: "Distribution", differentiation: "Differentiation", purpose: "App purpose", journey: "Critical journey", expectedBehavior: "Expected result", url: "App URL", suppliedEvidence: "Supplied evidence", product: "Product", engineering: "Engineering", customer_buyer: "Customer and buyer", commercial: "Commercial", investor_preparation: "Investor preparation", verification: "Verification" })[key.split(".").at(-1)] ?? key; }
function briefSections(report) {
  const scope = section("Saved intake · review not started"); scope.append(node("p", `${report.input.subjectType} · ${report.input.title}`), node("p", "Input is supplied and unverified. The preview lists analytical questions. Review work and stakeholder decisions have not started."), node("p", `Decision supplied: ${report.input.decision}`));
  const context = section("Audience · supplied context"); for (const [key, value] of Object.entries(report.input.audience)) context.append(node("h4", briefLabel(key)), node("p", value ?? "Unknown · not supplied"));
  const subject = section(report.input.subjectType === "idea" ? "Idea · supplied claims" : "App · supplied context, access separate"); for (const [key, value] of Object.entries(report.input[report.input.subjectType])) subject.append(node("h4", briefLabel(key)), node("p", value ?? "Unknown · not supplied"));
  const claims = section("Assumptions and operator unknowns"); for (const [label, values] of [["Assumptions", report.input.assumptions], ["Unknowns", report.input.unknowns]]) { claims.append(node("h4", label)); for (const value of values.length ? values : ["None supplied; this does not establish certainty."]) claims.append(node("p", value)); }
  const evidence = section("Supplied evidence references · unopened and unverified"); for (const item of report.input.suppliedEvidence) evidence.append(node("h4", item.label), node("p", item.description), node("p", item.reference ?? "No reference supplied")); if (!report.input.suppliedEvidence.length) evidence.append(node("p", "No evidence supplied."));
  const preview = section("Scope preview · questions only"); preview.append(node("p", `Missing inputs: ${report.preview.missingInputs.map(briefLabel).join(", ") || "No explicit null fields; supplied claims still need verification."}`)); for (const track of report.preview.tracks) { preview.append(node("h4", `${briefLabel(track.id)} · not started`)); for (const question of track.questions) preview.append(node("p", question)); }
  const limits = section("Record and limits"); limits.append(node("p", `Brief: ${report.id} · Saved: ${report.createdAt}`), node("code", report.inputSha256, "code-hash")); for (const limitation of report.limitations) limits.append(node("p", limitation)); const raw = node("details"); raw.append(node("summary", "Show literal intake JSON"), node("pre", JSON.stringify(report, null, 2), "export-record-json")); limits.append(raw);
  return [scope, context, subject, claims, evidence, preview, limits];
}
function showBriefIntake() {
  const attempt = beginDetail(); if (!briefCatalog) { closeDetail(); toast("Brief metadata unavailable.", true); return; }
  openedCodeRun = { kind: "brief-intake", id: "new", pending: true }; $("detail-title").textContent = "Add review brief";
  const form = node("form"); form.id = "review-brief-form"; form.noValidate = true;
  form.append(node("p", "Save supplied context for a review. The preview lists questions to investigate. App access and execution are separate steps. Leave optional fields blank when unknown. Your draft clears when you close or leave this form.", "fine-print"));
  function field(parent, key, label, max, required = false, multiline = true) { const caption = node("label", label); caption.htmlFor = `brief-${key}`; const control = node(multiline ? "textarea" : "input"); control.id = caption.htmlFor; control.maxLength = max; control.required = required; if (multiline) control.rows = 3; else control.autocomplete = "off"; parent.append(caption, control); return control; }
  const kindLabel = node("label", "Subject"); kindLabel.htmlFor = "brief-subject"; const kind = node("select"); kind.id = kindLabel.htmlFor; for (const [value, label] of [["idea", "Idea"], ["app", "App"]]) { const option = node("option", label); option.value = value; kind.append(option); } form.append(kindLabel, kind);
  const title = field(form, "title", "Title · required", 200, true, false), decision = field(form, "decision", "Decision to support · required", 1000, true), audience = {};
  for (const [key, label, max, multiline] of [["users", "Target users", 1000, true], ["buyers", "Buyer or payer", 1000, true], ["market", "Country or market · supplied context", 200, false], ["language", "Language", 100, false]]) audience[key] = field(form, key, label, max, false, multiline);
  const subjects = {};
  for (const [type, fields] of [["idea", [["problem", "Problem · supplied claim", true], ["solution", "Proposed solution", true], ["alternatives", "Current alternatives", false], ["valueProposition", "Value proposition", false], ["businessModel", "Business model", false], ["distribution", "Distribution", false], ["differentiation", "Differentiation", false]]], ["app", [["purpose", "App purpose", true], ["journey", "One critical journey", true], ["expectedBehavior", "Expected result", true], ["url", "App URL · optional, not opened", false]]]]) {
    const group = node("fieldset", undefined, "export-option-group"); group.append(node("legend", type === "idea" ? "Idea context" : "App context")); const controls = {}; for (const [key, label, required] of fields) controls[key] = field(group, key, label + (required ? " · required" : ""), key === "url" ? 2048 : 2000, required, key !== "url"); subjects[type] = { group, controls }; form.append(group);
  }
  const switchSubject = () => { for (const [type, subject] of Object.entries(subjects)) { subject.group.hidden = type !== kind.value; for (const control of Object.values(subject.controls)) control.disabled = subject.group.hidden; } }; kind.addEventListener("change", switchSubject); switchSubject();
  const assumptions = field(form, "assumptions", "Assumptions · one per line, up to 12", 6012), unknowns = field(form, "unknowns", "Unknowns · one per line, up to 12", 6012), evidence = node("fieldset", undefined, "export-option-group"); evidence.append(node("legend", "Supplied evidence · optional, unverified"), node("p", "Describe the source or claim. References stay as text and are not opened.", "fine-print")); form.append(evidence);
  const evidenceRows = [], addEvidence = node("button", "Add evidence reference", "small-button"); addEvidence.type = "button";
  addEvidence.addEventListener("click", () => { if (evidenceRows.length >= 10) return; const index = evidenceRows.length, row = node("div"); const controls = { label: field(row, `evidence-${index}-label`, "Evidence label", 160, false, false), description: field(row, `evidence-${index}-description`, "Supplied description", 1000), reference: field(row, `evidence-${index}-reference`, "Reference · optional", 2048, false, false) }; evidenceRows.push(controls); evidence.insertBefore(row, addEvidence); if (evidenceRows.length === 10) addEvidence.disabled = true; }); evidence.append(addEvidence);
  const message = node("p", "", "fine-print"); message.id = "brief-form-status"; message.setAttribute("role", "alert"); const save = node("button", "Save supplied brief", "primary"); save.type = "submit"; form.append(message, save);
  const nullable = control => control.value.trim() ? control.value : null;
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || save.disabled) return;
    if (!codeEntry("brief-intake", "new")) { closeDetail(); return; }
    const selected = subjects[kind.value].controls; if (!title.value.trim() || !decision.value.trim() || Object.values(selected).some(control => control.required && !control.value.trim())) { message.textContent = "Complete the title, decision and required subject fields."; return; }
    const lines = control => control.value.split("\n").filter(line => line.trim()), suppliedEvidence = evidenceRows.map(row => ({ label: row.label.value, description: row.description.value, reference: nullable(row.reference) })).filter(row => row.label.trim() || row.description.trim() || row.reference);
    if (suppliedEvidence.some(row => !row.label.trim() || !row.description.trim())) { message.textContent = "Each supplied evidence entry needs a label and description, or clear all its fields."; return; }
    const lists = { assumptions: lines(assumptions), unknowns: lines(unknowns) }; if (Object.values(lists).some(values => values.length > 12 || values.some(value => value.length > 500))) { message.textContent = "Use at most 12 assumptions and 12 unknowns, each at most 500 characters."; return; }
    const subject = Object.fromEntries(Object.entries(selected).map(([key, control]) => [key, control.required ? control.value : nullable(control)]));
    if (kind.value === "app" && subject.url) { try { const parsed = new URL(subject.url); if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error(); } catch { message.textContent = "Use an absolute HTTP/HTTPS app URL without embedded credentials, or leave it unknown."; return; } }
    const payload = { schemaVersion: "1.0", kind: "review_brief_input", subjectType: kind.value, title: title.value, decision: decision.value, audience: Object.fromEntries(Object.entries(audience).map(([key, control]) => [key, nullable(control)])), ...lists, suppliedEvidence, [kind.value]: subject };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 65536) { message.textContent = "Reduce the brief to at most 64 KiB of supplied text."; return; }
    for (const control of form.querySelectorAll("input,textarea,select,button")) control.disabled = true;
    try { const created = await api("/api/review-briefs", { method: "POST", body: JSON.stringify(payload), signal: attempt.signal }); if (!ownsDetail(attempt)) return; await refresh(); if (!ownsDetail(attempt)) return; await showCodeReport("review-briefs", created.id); }
    catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(`Brief creation could not be confirmed. Inspect recent briefs before retrying. ${error.message}`, true); } }
  });
  $("detail-content").replaceChildren(form); if (!$("review-dialog").open) $("review-dialog").showModal(); title.focus({ preventScroll: true });
}
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
  const experiment = node("button", "Freeze an experiment plan", "small-button"); experiment.addEventListener("click", () => showExperimentForm(record));
  const experimentActions = node("div", undefined, "detail-actions"); experimentActions.append(experiment);
  return [scope, plan, origin, history, limits, actions, experimentActions];
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

function comparisonEntry(id) {
  const entry = comparisonCatalog?.comparisons.find(item => item.id === id);
  return entry && codeEntry("browser-source", entry.baselineReviewId) && codeEntry("browser-source", entry.candidateReviewId) ? entry : null;
}
function eligibleReviews() { return (data?.jobs ?? []).filter(job => codeEntry("browser-source", job.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
function comparisonLabel(verdict) { return verdict.replaceAll("_", " "); }
function renderComparisonCatalog() {
  $("compare-reviews").disabled = !comparisonCatalog || eligibleReviews().length < 2;
  const rows = (comparisonCatalog?.comparisons ?? []).filter(item => comparisonEntry(item.id)).map(item => {
    const row = node("div", undefined, "grant-item comparison-record"); row.dataset.comparisonId = item.id;
    const copy = node("div", undefined, "grant-main");
    copy.append(node("strong", comparisonLabel(item.verdict)), node("p", `Baseline ${item.baselineReviewId.slice(0, 8)} → candidate ${item.candidateReviewId.slice(0, 8)}`), node("small", `${date(item.createdAt)} · Cataloged, unverified`));
    const inspect = node("button", "Inspect comparison →", "small-button"); inspect.addEventListener("click", () => showComparison(item.id)); row.append(copy, inspect); return row;
  });
  $("comparison-run-list").replaceChildren(...(rows.length ? rows : [node("p", comparisonCatalog ? "No recent comparisons. Save two local signup reviews, then choose their order." : "Current comparison records are unavailable.", "empty")]));
}
function refreshComparisonOptions() {
  if (openedComparison?.kind !== "form") return;
  for (const [role, key] of [["baseline", "baselineReviewId"], ["candidate", "candidateReviewId"]]) {
    const select = $(`comparison-${role}`); if (!select) return;
    const placeholder = node("option", `Choose ${role} review`); placeholder.value = "";
    const options = eligibleReviews().map(job => { const option = node("option", `${job.variant} signup · ${date(job.createdAt)} · ${job.id.slice(0, 8)}`); option.value = job.id; return option; });
    select.replaceChildren(placeholder, ...options); select.value = openedComparison[key];
  }
}
function showComparisonForm() {
  const attempt = beginDetail();
  if (!comparisonCatalog || eligibleReviews().length < 2) { closeDetail(); toast("Save two available controlled signup reviews first.", true); return; }
  openedComparison = { kind: "form", baselineReviewId: "", candidateReviewId: "" };
  $("detail-title").textContent = "Compare saved reviews";
  const form = node("form"); form.id = "comparison-form";
  form.append(node("p", "Choose a baseline, then a later candidate. Only saved controlled signup evidence is compared. This starts no test, app action, or model call. It does not change action progress.", "fine-print"));
  for (const [role, key] of [["baseline", "baselineReviewId"], ["candidate", "candidateReviewId"]]) {
    const label = node("label", role === "baseline" ? "Baseline review" : "Candidate review"); label.htmlFor = `comparison-${role}`;
    const select = node("select"); select.id = `comparison-${role}`; select.required = true;
    select.addEventListener("change", () => { if (ownsDetail(attempt)) openedComparison[key] = select.value; }); form.append(label, select);
  }
  const message = node("p", "", "fine-print"); message.id = "comparison-form-status"; message.setAttribute("role", "alert");
  const save = node("button", "Create comparison", "primary"); save.type = "submit";
  form.append(message, save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || save.disabled) return;
    const current = openedComparison;
    if (!current.baselineReviewId || !current.candidateReviewId || current.baselineReviewId === current.candidateReviewId) { message.textContent = "Choose two different reviews."; return; }
    if ([current.baselineReviewId, current.candidateReviewId].some(id => !codeEntry("browser-source", id))) { closeDetail(); toast("A selected review is unavailable.", true); return; }
    save.disabled = true; message.textContent = "Checking saved source evidence. No tests are running.";
    try {
      const result = await api("/api/comparisons", { method: "POST", body: JSON.stringify({ baselineReviewId: current.baselineReviewId, candidateReviewId: current.candidateReviewId }), signal: attempt.signal });
      if (!ownsDetail(attempt)) return;
      await refresh(); if (!ownsDetail(attempt)) return;
      await showComparison(result.id);
    } catch (error) {
      if (ownsDetail(attempt)) { closeDetail(); toast(`Save could not be confirmed. Read recent comparisons before retrying. ${error.message}`, true); }
    } finally { if (ownsDetail(attempt)) save.disabled = false; }
  });
  $("detail-content").replaceChildren(form); refreshComparisonOptions();
  if (!$("review-dialog").open) $("review-dialog").showModal(); $("comparison-baseline").focus({ preventScroll: true });
}
function comparisonSections(report) {
  const result = section(comparisonLabel(report.verdict));
  result.append(node("p", `Outcome: ${comparisonLabel(report.outcome)}.`), node("p", `Baseline: ${comparisonLabel(report.baselineState)}. Candidate: ${comparisonLabel(report.candidateState)}.`), node("p", "Saved source and publication hashes checked for this request. This is not a causal fix or an independently verified outcome."));
  const scope = section("Matched requirement and study scope");
  for (const [label, value] of [["Requirement", report.scope.requirementId], ["Requirement SHA-256", report.scope.requirementHash], ["Study SHA-256", report.scope.studyHash]]) scope.append(node("p", label), node("code", value ?? "Not matched or unavailable", "code-hash"));
  const sections = [result, scope];
  for (const role of ["baseline", "candidate"]) {
    const pin = report[role], source = section(role === "baseline" ? "Pinned baseline evidence" : "Pinned candidate evidence");
    source.append(node("p", `Review job: ${pin.reviewId}`), node("p", `Evidence run: ${pin.evidenceRunId}`), node("p", `Fixture: ${pin.variant}`), node("p", "Saved report SHA-256"), node("code", pin.reportSha256, "code-hash"), node("p", "Recorded build SHA-256"), node("code", report.scope[`${role}BuildHash`] ?? "Unavailable", "code-hash"));
    sections.push(source);
  }
  const reasons = section("Coverage and consistency reasons");
  if (!report.reasons.length) reasons.append(node("p", "The recorded scope and coverage checks passed for this saved pair."));
  for (const reason of report.reasons) reasons.append(node("p", reason.replaceAll("_", " ")));
  const limits = section("Comparison limits"); limits.append(node("p", "No tests, app code, or models were executed by comparison. Action progress and history are unchanged."));
  for (const limitation of report.limitations) limits.append(node("p", limitation));
  limits.append(node("p", "Source integrity is checked again during refresh, at most ten seconds between idle polls plus request time. Data already delivered cannot be recalled."));
  return [result, reasons, ...sections.slice(1), limits];
}
async function showComparison(id) {
  const attempt = beginDetail();
  if (!comparisonEntry(id)) { closeDetail(); toast("Current comparison sources are unavailable.", true); return; }
  openedComparison = { kind: "report", id, pending: true };
  try {
    const report = await api(`/api/comparisons/${id}`, { signal: attempt.signal });
    if (!ownsDetail(attempt)) return;
    if (!comparisonEntry(id)) { closeDetail(); toast("Comparison sources changed. The record was closed.", true); return; }
    $("detail-title").textContent = "Saved controlled-review comparison";
    $("detail-content").replaceChildren(...comparisonSections(report)); openedComparison.pending = false;
    if (!$("review-dialog").open) $("review-dialog").showModal(); $("detail-title").focus({ preventScroll: true });
  } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(error.message, true); } }
}
$("compare-reviews").addEventListener("click", showComparisonForm);

function renderExperimentCatalog() {
  const rows = (experimentCatalog?.experimentPlans ?? []).filter(item => codeEntry("experiments", item.id)).map(item => {
    const row = node("div", undefined, "grant-item experiment-record"); row.dataset.experimentId = item.id;
    const copy = node("div", undefined, "grant-main"); copy.append(node("strong", item.title), node("p", `Owner label: ${item.owner} · action revision ${item.actionRevision}`), node("small", `${date(item.frozenAt)} · Supplied plan · Outcome not collected · Cataloged, unverified`));
    const inspect = node("button", "Inspect experiment plan →", "small-button"); inspect.addEventListener("click", () => showCodeReport("experiments", item.id)); row.append(copy, inspect); return row;
  });
  $("experiment-plan-list").replaceChildren(...(rows.length ? rows : [node("p", experimentCatalog ? "No permitted recent experiment plans. Open an action to freeze a supplied plan." : "Current experiment plan access cannot be established.", "empty")]));
}
function experimentSections(report) {
  const plan = report.plan, summary = section(plan.title);
  summary.append(node("p", `Owner label: ${plan.owner}. No external person is assigned or notified.`), node("p", "Supplied plan frozen. Semantic review: unreviewed. Protocol review: not assessed."), node("p", "Execution: not started by tracking. Outcome: not collected. Independent outcome verification: not assessed."));
  const hypothesis = section("Supplied hypothesis and intervention"); hypothesis.append(node("h4", "Hypothesis"), node("p", plan.hypothesis), node("h4", "Planned intervention"), node("p", plan.intervention));
  const outcome = section("Planned measurement · no result collected"); outcome.append(node("h4", "Measure"), node("p", plan.outcome.measure), node("h4", "Success rule chosen in the plan"), node("p", plan.outcome.successRule), node("h4", "Separate collection method"), node("p", plan.outcome.collectionMethod));
  const sample = section("Intended sample · unreviewed"); sample.append(node("p", plan.samplePlan.population), node("p", plan.samplePlan.recruitment), node("p", `Intended count: ${plan.samplePlan.targetCount}. This is not a participant or observation count.`));
  const window = section("Frozen record and planned window"); window.append(node("p", `Frozen: ${report.frozenAt}`), node("p", `Planned start (UTC): ${plan.horizon.startsAt}`), node("p", `Planned end (UTC): ${plan.horizon.endsAt}`), node("p", "Chronology: local clock only. This does not prove that outcomes were unknown or that independent research was registered."));
  const source = section("Pinned historical action and source"); source.append(node("p", `Action: ${report.actionVersion.id} · revision ${report.actionVersion.revision}`), node("code", report.actionVersion.sha256, "code-hash"), node("p", `${report.actionVersion.origin.kind.replaceAll("_", " ")}: ${report.actionVersion.origin.runId} · ${report.actionVersion.origin.itemId}`), node("p", `Evidence run: ${report.actionVersion.origin.evidenceRunId}`), node("code", report.actionVersion.origin.reportSha256, "code-hash"));
  const limits = section("Plan limits and current access"); for (const limitation of report.limitations) limits.append(node("p", limitation));
  limits.append(node("p", "Source permission and saved bytes are checked again during refresh, at most ten seconds between idle polls plus request time. Known access expiry clears managed detail locally. Data already delivered cannot be recalled."));
  if (report.actionVersion.origin.kind === "browser_finding") {
    const link = node("button", "Link controlled evidence", "small-button"); link.disabled = !outcomeCatalog || !outcomePlanAccess(report.id);
    link.addEventListener("click", () => showOutcomeEvidenceForm({ id: report.id, baselineId: report.actionVersion.origin.runId, findingId: report.actionVersion.origin.itemId, startsAt: plan.horizon.startsAt, endsAt: plan.horizon.endsAt })); summary.append(link);
  }
  return [summary, hypothesis, outcome, sample, window, source, limits];
}
function showExperimentForm(record) {
  const attempt = beginDetail();
  if (!codeEntry("actions", record.id)) { closeDetail(); toast("Current action source access is unavailable.", true); return; }
  openedCodeRun = { kind: "actions", id: record.id, pending: false, editing: true, revision: record.revision }; armCodeExpiry();
  $("detail-title").textContent = "Freeze a supplied experiment plan";
  const form = node("form"); form.id = "experiment-form";
  form.append(node("p", `Freezing preserves this supplied plan against action revision ${record.revision}. No intervention, recruitment, or outcome collection occurs. Semantic and protocol review remain unassessed.`, "fine-print"));
  const fields = {};
  for (const [key, label, max, multiline] of [["title", "Plan title", 200, false], ["owner", "Owner label · no external assignment", 120, false], ["hypothesis", "Testable hypothesis", 2000, true], ["intervention", "Planned intervention", 2000, true], ["measure", "Outcome measure", 1000, true], ["successRule", "Success rule chosen before collection", 1000, true], ["collectionMethod", "Separate collection method", 2000, true], ["population", "Intended population or fixture scope", 1000, true], ["recruitment", "Planned selection or recruitment method", 1000, true]]) {
    const labelNode = node("label", label); labelNode.htmlFor = `experiment-${key}`;
    const input = node(multiline ? "textarea" : "input"); input.id = `experiment-${key}`; input.name = key; input.required = true; input.maxLength = max; input.autocomplete = "off"; if (multiline) input.rows = 2;
    if (key === "owner") input.value = record.owner;
    fields[key] = input; form.append(labelNode, input);
  }
  const countLabel = node("label", "Intended sample count · not observed participants"); countLabel.htmlFor = "experiment-targetCount";
  const count = node("input"); count.id = "experiment-targetCount"; count.type = "number"; count.min = "1"; count.max = "100000"; count.step = "1"; count.required = true; fields.targetCount = count; form.append(countLabel, count);
  for (const [key, label] of [["startsAt", "Planned start · your local time"], ["endsAt", "Planned end · your local time"]]) {
    const labelNode = node("label", label); labelNode.htmlFor = `experiment-${key}`;
    const input = node("input"); input.id = `experiment-${key}`; input.type = "datetime-local"; input.step = "1"; input.required = true; fields[key] = input; form.append(labelNode, input);
  }
  const windowPreview = node("p", "Choose a future start and later end. Saved timestamps use UTC. The local clock cannot establish independent research chronology.", "fine-print");
  const preview = () => { const start = new Date(fields.startsAt.value), end = new Date(fields.endsAt.value); windowPreview.textContent = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) ? `UTC to be saved: ${start.toISOString()} → ${end.toISOString()}. Local clock only; no independent registration or outcome is established.` : "Choose a future start and later end. Saved timestamps use UTC. The local clock cannot establish independent research chronology."; };
  fields.startsAt.addEventListener("input", preview); fields.endsAt.addEventListener("input", preview);
  const message = node("p", "", "fine-print"); message.id = "action-form-status"; message.setAttribute("role", "alert");
  const reload = node("button", "Read latest action · discard this plan draft", "small-button"); reload.type = "button"; reload.id = "action-reload"; reload.hidden = true; reload.addEventListener("click", () => showCodeReport("actions", record.id));
  const save = node("button", "Freeze supplied plan", "primary"); save.type = "submit"; form.append(windowPreview, message, reload, save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || save.disabled) return;
    const starts = new Date(fields.startsAt.value), ends = new Date(fields.endsAt.value);
    if (Object.values(fields).some(input => !input.value.trim())) { message.textContent = "Complete each supplied plan field before freezing."; return; }
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || starts.getTime() <= Date.now() || starts.getTime() - Date.now() > 730 * 86400000 || ends <= starts || ends - starts > 366 * 86400000) { message.textContent = "Choose a future start within 730 days and a later end no more than 366 days after it."; return; }
    save.disabled = true; for (const input of Object.values(fields)) input.disabled = true;
    try {
      const payload = { schemaVersion: "1.0", kind: "experiment_plan_input", actionId: record.id, expectedActionRevision: record.revision, title: fields.title.value, owner: fields.owner.value, hypothesis: fields.hypothesis.value, intervention: fields.intervention.value, outcome: { measure: fields.measure.value, successRule: fields.successRule.value, collectionMethod: fields.collectionMethod.value }, samplePlan: { population: fields.population.value, recruitment: fields.recruitment.value, targetCount: Number(fields.targetCount.value) }, horizon: { startsAt: starts.toISOString(), endsAt: ends.toISOString() } };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 32768) { message.textContent = "Shorten the supplied text. The plan must fit within 32 KiB."; return; }
      const result = await api("/api/experiments", { method: "POST", body: JSON.stringify(payload), signal: attempt.signal });
      if (!ownsDetail(attempt)) return;
      await refresh(); if (!ownsDetail(attempt)) return;
      await showCodeReport("experiments", result.id);
    } catch (error) {
      if (!ownsDetail(attempt)) return;
      if (error.status === 409) { message.textContent = "This action changed. Read its latest revision before deliberately freezing another plan. Your draft was not submitted again."; reload.hidden = false; }
      else { closeDetail(); toast(`Freeze could not be confirmed. Read recent plans before retrying. ${error.message}`, true); }
    } finally { if (ownsDetail(attempt)) { save.disabled = false; for (const input of Object.values(fields)) input.disabled = false; } }
  });
  $("detail-content").replaceChildren(form); if (!$("review-dialog").open) $("review-dialog").showModal(); fields.title.focus({ preventScroll: true });
}

function outcomePlanAccess(planId) {
  const access = codeEntry("experiments", planId);
  return access?.entry.origin.kind === "browser_finding" && data?.jobs.some(job => job.id === access.entry.origin.runId && job.status === "completed") ? access : null;
}
function outcomeComparison(planId, comparisonId) {
  const plan = outcomePlanAccess(planId), comparison = comparisonCatalog?.comparisons.find(item => item.id === comparisonId);
  return plan && comparison?.outcome === "compared" && comparison.baselineReviewId === plan.entry.origin.runId && [comparison.baselineReviewId, comparison.candidateReviewId].every(id => data?.jobs.some(job => job.id === id && job.status === "completed")) ? comparison : null;
}
function renderOutcomeCatalog() {
  const rows = (outcomeCatalog?.outcomeEvidence ?? []).filter(item => codeEntry("outcome-evidence", item.id)).map(item => {
    const row = node("div", undefined, "grant-item outcome-record"); row.dataset.outcomeId = item.id;
    const copy = node("div", undefined, "grant-main"); copy.append(node("strong", comparisonLabel(item.verdict)), node("p", `Plan: ${item.planId}`), node("small", `${date(item.registeredAt)} · Evidence linked · Unadjudicated · Cataloged, unverified`));
    const inspect = node("button", "Inspect linked evidence →", "small-button"); inspect.addEventListener("click", () => showCodeReport("outcome-evidence", item.id)); row.append(copy, inspect); return row;
  });
  $("outcome-evidence-list").replaceChildren(...(rows.length ? rows : [node("p", outcomeCatalog ? "No available recent evidence links. Open a frozen browser-finding plan to select a saved comparison." : "Current linked evidence access cannot be established.", "empty")]));
}
function renderOutcomeOptions() {
  if (openedCodeRun?.kind !== "outcome-selection" || !outcomeSelection || !$("outcome-comparison")) return;
  const selected = outcomeSelection.comparisonId, options = (comparisonCatalog?.comparisons ?? []).filter(item => outcomeComparison(outcomeSelection.planId, item.id)).filter((item, index) => index < 25 || item.id === selected), control = $("outcome-comparison");
  const placeholder = node("option", "Choose a saved comparison"); placeholder.value = "";
  control.replaceChildren(placeholder, ...options.map(item => { const option = node("option", `${comparisonLabel(item.verdict)} · candidate ${item.candidateReviewId.slice(0, 8)} · comparison ${item.id.slice(0, 8)}`); option.value = item.id; return option; }));
  control.value = selected; control.disabled = !!outcomeSelection.saving;
  const comparison = selected && outcomeComparison(outcomeSelection.planId, selected);
  $("outcome-selected-source").textContent = comparison ? `Selected comparison: ${comparison.id} · Candidate review: ${comparison.candidateReviewId}. Server time-window and full source checks still apply.` : options.length ? "Choose explicitly from up to 25 recent available comparisons, plus a selection still in current catalogs. No comparison is chosen automatically." : "No comparable completed capture for this baseline is known in current catalogs. Create a separate comparison or refresh; no source is substituted.";
}
function showOutcomeEvidenceForm(scope) {
  const attempt = beginDetail();
  if (!outcomeCatalog || !outcomePlanAccess(scope.id)) { closeDetail(); toast("The frozen browser-finding plan is currently unavailable.", true); return; }
  outcomeSelection = { planId: scope.id, comparisonId: "", saving: false }; openedCodeRun = { kind: "outcome-selection", id: scope.id, pending: false }; armCodeExpiry();
  $("detail-title").textContent = "Link controlled evidence to a frozen plan";
  const form = node("form"); form.id = "outcome-evidence-form"; form.noValidate = true;
  form.append(node("p", "Register saved evidence only. Hypothesis, sample adequacy, independent outcome, planned intervention, and causality are not adjudicated. The plan and action stay unchanged.", "fine-print"), node("p", `Plan: ${scope.id}`), node("p", `Exact baseline review: ${scope.baselineId} · Finding: ${scope.findingId}`), node("p", `Frozen window (UTC): ${scope.startsAt} → ${scope.endsAt}. Local clock only. The server checks the exact compared requirement and all capture times.`));
  const label = node("label", "Saved comparable capture for this baseline"); label.htmlFor = "outcome-comparison";
  const comparison = node("select"); comparison.id = "outcome-comparison";
  comparison.addEventListener("change", () => { if (!ownsDetail(attempt) || !outcomeSelection || outcomeSelection.saving) return; outcomeSelection.comparisonId = comparison.value; renderOutcomeOptions(); });
  const selected = node("p", "", "fine-print"); selected.id = "outcome-selected-source";
  const noteLabel = node("label", "Optional supplied note · unreviewed, up to 2000 characters"); noteLabel.htmlFor = "outcome-note";
  const note = node("textarea"); note.id = "outcome-note"; note.maxLength = 2000; note.rows = 3; note.autocomplete = "off";
  const message = node("p", "", "fine-print"); message.id = "outcome-form-status"; message.setAttribute("role", "alert");
  const save = node("button", "Register controlled evidence", "primary"); save.type = "submit";
  form.append(label, comparison, selected, noteLabel, note, message, save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || !outcomeSelection || outcomeSelection.saving) return;
    if (!outcomeSelection.comparisonId || !outcomeComparison(scope.id, outcomeSelection.comparisonId)) { message.textContent = "Choose one currently available comparable capture for the exact baseline."; return; }
    if (note.value.length > 2000 || note.value && (!note.value.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(note.value))) { message.textContent = "Use an optional nonempty note of at most 2000 characters without unsupported control characters."; return; }
    if (!codeEntry("outcome-selection", scope.id)) { closeDetail(); toast("A selected source is unavailable. The evidence form was closed.", true); return; }
    const payload = { schemaVersion: "1.0", kind: "controlled_outcome_evidence_input", planId: scope.id, comparisonId: outcomeSelection.comparisonId, ...(note.value ? { note: note.value } : {}) };
    outcomeSelection.saving = true; save.disabled = true; note.disabled = true; comparison.disabled = true;
    try {
      const result = await api("/api/outcome-evidence", { method: "POST", body: JSON.stringify(payload), signal: attempt.signal });
      if (!ownsDetail(attempt)) return; await refresh(); if (!ownsDetail(attempt)) return; await showCodeReport("outcome-evidence", result.id);
    } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(`Registration not confirmed. Inspect recent evidence links before retrying. ${error.message}`, true); } }
    finally { if (ownsDetail(attempt) && outcomeSelection) { outcomeSelection.saving = false; save.disabled = false; note.disabled = false; comparison.disabled = false; } }
  });
  $("detail-content").replaceChildren(form); renderOutcomeOptions(); if (!$("review-dialog").open) $("review-dialog").showModal(); comparison.focus({ preventScroll: true });
}
function outcomeEvidenceSections(report) {
  const summary = section("Evidence linked · unadjudicated"); summary.append(node("p", "Scope: controlled local signup only. No intervention, participant collection, app test, or model runs through registration."), node("p", "Hypothesis resolution: not assessed. Sample adequacy: not assessed. Independent outcome verification: not established. Planned intervention: not verified. Causal attribution: not assessed."), node("p", "Semantic review: unreviewed. Protocol review: not assessed. The original plan remains uncollected; action declarations stay unchanged."));
  const observation = section("Saved controlled observation"); observation.append(node("p", comparisonLabel(report.observation.verdict)), node("p", `Baseline: ${report.observation.baselineState.replaceAll("_", " ")} · Candidate: ${report.observation.candidateState.replaceAll("_", " ")}`), node("p", `Requirement: ${report.observation.requirementId}`), node("code", report.observation.requirementHash, "code-hash"), node("p", "Study SHA-256"), node("code", report.observation.studyHash, "code-hash"));
  const note = section("Supplied note · unreviewed"); note.append(node("p", report.input.note ?? "No supplied note."));
  const alignment = section("Recorded local time alignment");
  for (const [key, label] of [["baselineGeneratedAt", "Baseline report"], ["frozenAt", "Plan frozen"], ["startsAt", "Planned start"], ["candidateCreatedAt", "Candidate created"], ["candidateGeneratedAt", "Candidate report"], ["endsAt", "Planned end"], ["comparisonCreatedAt", "Comparison created"]]) alignment.append(node("p", `${label} (UTC): ${report.alignment[key]}`));
  for (const execution of report.alignment.candidateExecutions) alignment.append(node("p", `Candidate execution ${execution.id}: ${execution.startedAt} → ${execution.finishedAt}`));
  alignment.append(node("p", `Evidence registered: ${report.registeredAt}. Local clock only; no independent prospective registration or unknown-outcome proof.`));
  const sources = section("Checked source identities and hashes");
  for (const [label, pin] of [["Frozen plan", report.sources.plan], ["Comparison", report.sources.comparison]]) sources.append(node("p", `${label}: ${pin.id}`), node("code", pin.reportSha256, "code-hash"));
  sources.append(node("p", `Historical action: ${report.sources.actionVersion.id} · revision ${report.sources.actionVersion.revision}`), node("code", report.sources.actionVersion.sha256, "code-hash"));
  for (const [label, pin] of [["Baseline", report.sources.comparison.baseline], ["Candidate", report.sources.comparison.candidate]]) sources.append(node("p", `${label} review: ${pin.reviewId} · Evidence: ${pin.evidenceRunId}`), node("code", pin.reportSha256, "code-hash"));
  const artifacts = section("Checked link artifact metadata · no download"); for (const artifact of report.artifacts) artifacts.append(node("p", `${artifact.owner} · ${artifact.bytes} bytes · ${artifact.mediaType} · ${artifact.id}`), node("code", artifact.sha256, "code-hash"));
  const raw = node("details"), title = node("summary", "Show literal public record JSON"), body = node("pre", JSON.stringify(report, null, 2), "export-record-json"); raw.append(title, body);
  const limits = section("Evidence limits and current sources"); for (const limitation of report.limitations) limits.append(node("p", limitation)); limits.append(node("p", "Current known parents and completed jobs are checked on refresh; full source/file checks repeat at most ten seconds between idle polls plus bounded request time. Absent catalog parents are unavailable. Delivered copies cannot be recalled."));
  return [summary, observation, note, alignment, sources, artifacts, raw, limits];
}

function exportSourceAccess(source) {
  if (source.kind === "comparison") { const entry = comparisonEntry(source.id); return entry ? { entry, grant: null } : null; }
  const kind = { review: "browser-source", action: "actions", experiment: "experiments", outcome_evidence: "outcome-evidence" }[source.kind];
  return kind ? codeEntry(kind, source.id) : null;
}
function exportAccess(items) {
  let grant = null;
  for (const item of items) {
    const access = exportSourceAccess(item); if (!access) return null;
    if (access.grant && (!grant || Date.parse(access.grant.expiresAt) < Date.parse(grant.expiresAt))) grant = access.grant;
  }
  return { grant };
}
function exportReviewScope(items) {
  const references = [];
  for (const item of items) {
    const access = exportSourceAccess(item); if (!access) return null;
    if (item.kind === "review") references.push(item.id);
    else if (["action", "experiment"].includes(item.kind)) { if (access.entry.origin.kind === "browser_finding") references.push(access.entry.origin.runId); }
    else {
      const comparison = item.kind === "comparison" ? access.entry : outcomeComparison(access.entry.planId, access.entry.comparisonId);
      if (!comparison) return null; references.push(comparison.baselineReviewId, comparison.candidateReviewId);
    }
  }
  return { distinct: new Set(references).size, references: references.length };
}
function exportOptions() {
  return [
    ...(data?.jobs ?? []).map(item => ({ kind: "review", id: item.id, label: `${jobTitle(item)} · ${item.id.slice(0, 8)}` })),
    ...(actionCatalog?.actions ?? []).map(item => ({ kind: "action", id: item.id, label: `${item.title} · revision ${item.revision} · ${item.id.slice(0, 8)}` })),
    ...(experimentCatalog?.experimentPlans ?? []).map(item => ({ kind: "experiment", id: item.id, label: `${item.title} · outcome not collected · ${item.id.slice(0, 8)}` })),
    ...(comparisonCatalog?.comparisons ?? []).map(item => ({ kind: "comparison", id: item.id, label: `${comparisonLabel(item.verdict)} · ${item.id.slice(0, 8)}` })),
    ...(outcomeCatalog?.outcomeEvidence ?? []).map(item => ({ kind: "outcome_evidence", id: item.id, label: `Linked controlled evidence · unadjudicated · ${item.id.slice(0, 8)}` })),
  ].filter(item => exportSourceAccess(item));
}
function renderReportExportCatalog() {
  $("create-report-export").disabled = !reportExportCatalog || !exportOptions().length;
  const rows = (reportExportCatalog?.reportExports ?? []).filter(item => codeEntry("report-exports", item.id)).map(item => {
    const row = node("div", undefined, "grant-item report-export-record"); row.dataset.reportExportId = item.id;
    const copy = node("div", undefined, "grant-main"); copy.append(node("strong", item.title), node("p", `${item.records} selected records · ${date(item.createdAt)}`), node("small", "Cataloged, unverified · Current source access required"));
    const inspect = node("button", "Inspect report export →", "small-button"); inspect.addEventListener("click", () => showCodeReport("report-exports", item.id)); row.append(copy, inspect); return row;
  });
  $("report-export-list").replaceChildren(...(rows.length ? rows : [node("p", reportExportCatalog ? "No permitted recent report exports. Select checked local records to create a bundle." : "Current report export access cannot be established.", "empty")]));
}
function renderExportOptions() {
  if (openedCodeRun?.kind !== "export-selection" || !exportSelection || !$("export-options")) return;
  const generation = detailGeneration, key = item => `${item.kind}:${item.id}`, selected = new Set(exportSelection.items.map(key)), options = exportOptions(), groups = [];
  for (const [kind, title] of [["review", "Controlled review results"], ["action", "Operator-declared actions"], ["experiment", "Supplied experiment plans"], ["comparison", "Saved controlled comparisons"], ["outcome_evidence", "Linked controlled evidence · unadjudicated"]]) {
    const eligible = options.filter(item => item.kind === kind), shown = eligible.filter((item, index) => index < 25 || selected.has(key(item))), group = node("fieldset", undefined, "export-option-group");
    group.append(node("legend", title), node("p", "Up to 25 recent available options, plus selected records still in the current catalog. Source integrity is checked before export.", "fine-print"));
    for (const option of shown) {
      const label = node("label", undefined, "export-option"), input = node("input"); input.type = "checkbox"; input.value = key(option); input.checked = selected.has(key(option)); input.disabled = !!exportSelection.saving; input.dataset.exportKind = kind; input.dataset.exportId = option.id;
      input.addEventListener("change", () => {
        if (generation !== detailGeneration || openedCodeRun?.kind !== "export-selection" || !exportSelection || exportSelection.saving) return;
        const next = exportSelection.items.filter(item => key(item) !== key(option)); if (input.checked) next.push({ kind, id: option.id });
        if (next.length > 10 || next.filter(item => item.kind === "review").length > 5) { input.checked = false; $("export-form-status").textContent = "Choose at most ten records, including no more than five reviews."; return; }
        const scope = exportReviewScope(next);
        if (!scope || scope.distinct > 5 || scope.references > 10) { input.checked = !input.checked; $("export-form-status").textContent = "Select at most five distinct underlying reviews and ten review references, including linked records."; return; }
        exportSelection.items = next; $("export-selection-count").textContent = `${next.length} selected · maximum 10 records and 5 reviews`; armCodeExpiry();
      });
      label.append(input, node("span", option.label)); group.append(label);
    }
    if (!shown.length) group.append(node("p", "No currently available records of this kind.", "empty")); groups.push(group);
  }
  $("export-options").replaceChildren(...groups);
}
function showReportExportForm() {
  const attempt = beginDetail();
  if (!reportExportCatalog || !exportOptions().length) { closeDetail(); toast("No currently available local records to export.", true); return; }
  exportSelection = { items: [] }; openedCodeRun = { kind: "export-selection", id: "selection", pending: true }; armCodeExpiry();
  $("detail-title").textContent = "Select local records for export";
  const form = node("form"); form.id = "report-export-form";
  form.append(node("p", "Select one to ten local records, using at most five distinct underlying reviews and ten review references across all selections. Linked evidence stays unadjudicated. Supplied text is included. Source permissions and saved bytes are checked before export. No raw code, research, session, or credential store is copied automatically. Downloaded copies cannot be recalled.", "fine-print"));
  const label = node("label", "Report title · operator supplied"); label.htmlFor = "export-title";
  const title = node("input"); title.id = "export-title"; title.required = true; title.maxLength = 200; title.autocomplete = "off";
  const count = node("p", "0 selected · maximum 10 records and 5 reviews", "fine-print"); count.id = "export-selection-count";
  const options = node("div"); options.id = "export-options";
  const message = node("p", "", "fine-print"); message.id = "export-form-status"; message.setAttribute("role", "alert");
  const save = node("button", "Create checked report export", "primary"); save.type = "submit";
  form.append(label, title, count, options, message, save);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!ownsDetail(attempt) || save.disabled) return;
    if (!title.value.trim() || /[\x00-\x1f\x7f-\x9f]/u.test(title.value) || !exportSelection.items.length) { message.textContent = "Supply a title without control characters and select at least one record."; return; }
    if (!codeEntry("export-selection", "selection")) { clearCodeState("A selected source is unavailable. The export form was closed."); return; }
    const scope = exportReviewScope(exportSelection.items);
    if (!scope || scope.distinct > 5 || scope.references > 10) { message.textContent = "Select at most five distinct underlying reviews and ten review references, including linked records."; return; }
    const payload = { schemaVersion: "1.0", kind: "report_export_input", title: title.value, items: exportSelection.items.map(item => ({ ...item })) };
    exportSelection.saving = true; save.disabled = true; title.disabled = true; for (const input of options.querySelectorAll("input")) input.disabled = true;
    try {
      const result = await api("/api/report-exports", { method: "POST", body: JSON.stringify(payload), signal: attempt.signal });
      if (!ownsDetail(attempt)) return;
      await refresh(); if (!ownsDetail(attempt)) return;
      await showCodeReport("report-exports", result.id);
    } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(`Export could not be confirmed. Read recent exports before retrying. ${error.message}`, true); } }
    finally { if (ownsDetail(attempt)) { exportSelection.saving = false; save.disabled = false; title.disabled = false; for (const input of options.querySelectorAll("input")) input.disabled = false; } }
  });
  $("detail-content").replaceChildren(form); renderExportOptions(); if (!$("review-dialog").open) $("review-dialog").showModal(); title.focus({ preventScroll: true });
}
function reportExportSections(report) {
  const id = report.id, summary = section(report.title);
  summary.append(node("p", `${report.records.length} selected local records · Created: ${report.createdAt}`), node("p", "Saved source and export hashes checked for this request. Recorded claims and operator declarations are not independently adjudicated or promoted."), node("p", "No test, model, intervention, recruitment, or outcome collection occurs. Downloaded copies cannot be recalled after source access changes."));
  const sources = section("Selected source references");
  for (const source of report.sourceRefs) sources.append(node("p", `${source.kind}: ${source.id}${source.actionRevision ? ` · action revision ${source.actionRevision}` : ""}`), node("code", source.hash, "code-hash"));
  const records = section("Recorded bodies · supplied labels preserved");
  for (const record of report.records) { const details = node("details"); details.append(node("summary", `${record.kind} · ${record.id}`), node("pre", JSON.stringify(record.body, null, 2), "export-record-json")); records.append(details); }
  const limits = section("Export limits"); for (const limitation of report.limitations) limits.append(node("p", limitation));
  limits.append(node("p", "Managed detail checks current source rights and saved bytes during refresh. Known expiry clears it locally. Already delivered or saved copies remain outside managed revocation."));
  const actions = node("div", undefined, "detail-actions export-download-actions");
  for (const [format, label] of [["json", "Download checked JSON"], ["md", "Download checked Markdown"]]) { const button = node("button", label, "primary report-download"); button.addEventListener("click", () => downloadReportExport(id, format)); actions.append(button); }
  return [summary, sources, records, limits, actions];
}
async function downloadReportExport(id, format) {
  if (openedCodeRun?.kind !== "report-exports" || openedCodeRun.id !== id || openedCodeRun.downloading || !codeEntry("report-exports", id)) return;
  const attempt = { generation: detailGeneration, signal: detailController.signal }, current = openedCodeRun;
  const allowed = () => ownsDetail(attempt) && openedCodeRun === current && !!codeEntry("report-exports", id);
  current.downloading = true; const buttons = [...document.querySelectorAll(".report-download")]; for (const button of buttons) button.disabled = true;
  try {
    const response = await fetch(`/api/report-exports/${id}/download.${format}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([attempt.signal, AbortSignal.timeout(10000)]) });
    if (!response.ok) throw new Error("Current source or saved integrity checks failed.");
    const length = Number(response.headers.get("content-length")), hash = response.headers.get("x-content-sha256");
    if (!Number.isSafeInteger(length) || length <= 0 || length > 2200000 || !/^[a-f0-9]{64}$/.test(hash ?? "") || !response.body) throw new Error("Download integrity metadata is unavailable.");
    const reader = response.body.getReader(), chunks = []; let total = 0;
    for (;;) { const next = await reader.read(); if (!allowed()) { await reader.cancel(); return; } if (next.done) break; total += next.value.length; if (total > length || total > 2200000) { await reader.cancel(); throw new Error("Download exceeds its declared size."); } chunks.push(next.value); }
    if (total !== length) throw new Error("Download length changed.");
    const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    if (digest !== hash) throw new Error("Download hash did not match."); if (!allowed()) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: format === "json" ? "application/json" : "text/markdown" })); imageUrls.push(url);
    const link = node("a"); link.href = url; link.download = `redteam-report-${id}.${format}`; link.hidden = true; document.body.append(link); link.click(); link.remove();
    setTimeout(() => { const index = imageUrls.indexOf(url); if (index !== -1) imageUrls.splice(index, 1); URL.revokeObjectURL(url); }, 1000);
    toast("Download requested. Already saved copies cannot be recalled.");
  } catch (error) { if (ownsDetail(attempt)) { closeDetail(); toast(`Download unavailable. ${error.message}`, true); } }
  finally { if (ownsDetail(attempt)) { current.downloading = false; for (const button of buttons) button.disabled = false; } }
}
$("create-report-export").addEventListener("click", showReportExportForm);

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
$("create-review-brief").addEventListener("click", showBriefIntake);
$("close-dialog").addEventListener("click", closeDetail);
$("review-dialog").addEventListener("cancel", event => { event.preventDefault(); closeDetail(); });
$("review-dialog").addEventListener("close", () => { if (expectedCloseEvents) expectedCloseEvents--; else if (!$("review-dialog").open) resetDetail(); });
window.addEventListener("hashchange", () => { closeDetail(); setView(); void refresh(); });
window.addEventListener("focus", () => { if (openedCodeRun) armCodeExpiry(); void refresh(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (openedCodeRun) armCodeExpiry(); void refresh(); } });
setView();
void refresh();

document.addEventListener("redteam:managed-detail-open", event => { if (event.detail !== "review") closeDetail(); });
