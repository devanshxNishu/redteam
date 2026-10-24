const token = document.querySelector('meta[name="redteam-token"]').content;
const $ = id => document.getElementById(id);
let data = null;
let timer;
let toastTimer;
const imageUrls = [];
let openedActorRun = null;
const activeStates = new Set(["queued", "running", "verifying", "reporting"]);

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(error.error || "Request failed.");
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
    $("review-dialog").close(); toast("Research permissions changed. The actor report is now restricted.", true);
  }
}
async function refresh() {
  clearTimeout(timer);
  try {
    data = await api("/api/workspace");
    $("connection-status").textContent = "Local service connected";
    $("connection-dot").style.background = "#7ba595";
    render();
  } catch (error) {
    $("connection-status").textContent = "Service disconnected";
    $("connection-dot").style.background = "#c93938";
    if (!data) toast(error.message, true);
  }
  timer = setTimeout(refresh, data?.jobs.some(job => activeStates.has(job.status)) ? 1500 : 10000);
}
function section(title) { const element = node("section", undefined, "detail-section"); element.append(node("h3", title)); return element; }
async function showActorReport(id) {
  try {
    const report = await api(`/api/actors/${id}`);
    $("detail-title").textContent = report.kind === "model_actor_run" ? "Configured model simulation" : "Scripted stakeholder decisions";
    const summary = section(report.kind === "model_actor_run" ? "Simulation scope" : "Software demonstration"); summary.append(node("p", report.note));
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
    $("review-dialog").showModal();
  } catch (error) { toast(error.message, true); }
}
async function showReview(job) {
  try {
    const report = await api(`/api/reviews/${job.id}`);
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
    for (const finding of report.findings) findings.append(node("h3", finding.title), node("p", `Verification: ${finding.status}. ${finding.proposedAction}`), node("p", `Business hypothesis: ${finding.businessHypothesis}`));
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
    $("review-dialog").showModal();
    const screenshot = report.artifacts.find(artifact => artifact.mediaType === "image/png");
    if (screenshot) {
      const response = await fetch(`/api/reviews/${job.id}/artifacts/${screenshot.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok && $("review-dialog").open) {
        const image = node("img"); image.alt = "Screenshot captured during the primary review execution";
        const url = URL.createObjectURL(await response.blob()); imageUrls.push(url); image.src = url; artifacts.append(image);
      }
    }
  } catch (error) { toast(error.message, true); }
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
$("close-dialog").addEventListener("click", () => $("review-dialog").close());
$("review-dialog").addEventListener("close", () => { for (const url of imageUrls.splice(0)) URL.revokeObjectURL(url); openedActorRun = null; $("detail-content").replaceChildren(); });
window.addEventListener("hashchange", setView);
setView();
void refresh();
