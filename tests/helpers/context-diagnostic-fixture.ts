import {mkdtempSync, realpathSync, rmSync, mkdirSync, writeFileSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {TaskStore} from "../../src/tasks.ts";
export function diagnosticFixture(work: (f: {root: string; state: string; run: string; id: string; runId: string; tasks: TaskStore}) => void) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "redteam-context-diagnostic-"))), state = resolve(root, ".redteam"), tasks = new TaskStore(root), id = randomUUID(), runId = randomUUID(), run = resolve(state, "context-analyst-runs", runId);
  const close = tasks.close.bind(tasks); let closed = false; tasks.close = () => {if (!closed) {close(); closed = true;}};
  tasks.create({id, runId, kind: "analyst", questionKey: "supplied-brief-context-analysis", manifestHash: "a".repeat(64), maximumAttempts: 1, deadlineAt: new Date(Date.now() + 60000).toISOString()});
  mkdirSync(run, {recursive: true, mode: 0o700});
  try { work({root, state, run, id, runId, tasks}); } finally { tasks.close(); rmSync(root, {recursive: true, force: true}); }
}
export function changeTask(state: string, id: string, change: (r: any) => void) {
  const db = new DatabaseSync(resolve(state, "tasks.sqlite"));
  try {const r = JSON.parse(String(db.prepare("SELECT document FROM tasks WHERE id=?").get(id)!.document)); change(r); db.prepare("UPDATE tasks SET document=? WHERE id=?").run(JSON.stringify(r), id);} finally {db.close();}
}
export function taskRows(state: string) {const db = new DatabaseSync(resolve(state, "tasks.sqlite"), {readOnly: true}); try {return {tasks: db.prepare("SELECT * FROM tasks ORDER BY rowid").all(), events: db.prepare("SELECT * FROM task_events ORDER BY id").all()};} finally {db.close();}}
export function authoredFiles(run: string) {for (const name of ["manifest.json", "generation.json", "candidate.json", "report.json"]) writeFileSync(resolve(run, name), "AUTHORED_PRIVATE_INVALID_JSON_MUST_NOT_BE_READ", {mode: 0o600}); return ["manifest.json", "generation.json", "candidate.json", "report.json"].map(name => ({path: resolve(run, name), bytes: readFileSync(resolve(run, name))}));}
