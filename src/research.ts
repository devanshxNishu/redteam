import { DatabaseSync } from "node:sqlite";
import { chmodSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "./evidence.ts";
import { encryptLocal, decryptLocal } from "./vault.ts";
import { workspaceDirectory } from "./workspace.ts";

export interface ModelScope { country: string; language: string; segment: string; category: string; decision: string }
export interface SourceInput {
  id: string;
  kind: "human_observation" | "published_research" | "synthetic_fixture";
  title: string;
  reference: string;
  collectedAt: string;
  method: string;
  scope: ModelScope;
  partition: "grounding" | "held_out";
  participantRefs: string[];
  consentRef: string | null;
  permissions: { grounding: boolean; training: boolean; evaluation: boolean };
  expiresAt: string | null;
  limitations: string[];
  content: { text: string; observedAction?: string };
}
export interface ResearchSource extends Omit<SourceInput, "content"> {
  contentHash: string;
  createdAt: string;
  provenance: "operator_declared";
  revokedAt: string | null;
  revocationReason: string | null;
}
export interface ModelInput {
  id: string;
  version: string;
  domain: "consumer" | "investor";
  scope: ModelScope;
  sourceIds: string[];
  goals: string[];
  constraints: string[];
  knownInformation: string[];
  decisionRules: string[];
  limitations: string[];
}
export interface RegisteredModel extends ModelInput {
  hash: string;
  createdAt: string;
  status: "draft" | "research_grounded" | "restricted" | "retired";
}
export interface EvaluationInput {
  id: string;
  modelId: string;
  modelVersion: string;
  scope: ModelScope;
  cases: { id: string; sourceId: string; scenarioRef: string }[];
  thresholds: { minimumCases: number; minimumParticipants: number; minimumAccuracy: number; baselineAccuracy: number; minimumLift: number };
  protocolRef: string;
  outcomeHorizon: string;
}
export interface FrozenPrediction { caseId: string; action: string }
export interface EvaluationResult {
  caseCount: number;
  participantCount: number;
  correct: number;
  accuracy: number;
  baselineAccuracy: number;
  lift: number;
  thresholdsPassed: boolean;
  validated: false;
  limitations: string[];
}
export interface RegisteredEvaluation extends EvaluationInput {
  modelHash: string;
  sourceHashes: Record<string, string>;
  mode: "software_fixture" | "research_evaluation";
  registeredAt: string;
  predictions: FrozenPrediction[] | null;
  predictionHash: string | null;
  lockedAt: string | null;
  result: EvaluationResult | null;
}

const consumerActions = ["buy", "trial", "compare", "request_approval", "defer", "reject", "abandon", "renew", "cancel", "abstain"];
const investorActions = ["pass", "monitor", "request_information", "begin_diligence", "recommend_investment", "approve_investment", "conditional_investment", "abstain"];
const scopeKeys = ["country", "language", "segment", "category", "decision"] as const;
function scopeMatches(a: ModelScope, b: ModelScope): boolean { return scopeKeys.every(key => a[key] === b[key]); }

function object(input: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error(`${label} must be a plain object.`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some(key => typeof key !== "string" || !keys.includes(key)) || Object.values(descriptors).some(item => !("value" in item))) throw new Error(`${label} contains unsupported fields or accessors.`);
  return input as Record<string, unknown>;
}
function text(input: unknown, label: string): string {
  if (typeof input !== "string" || !input.trim() || input.length > 20000) throw new Error(`${label} requires nonempty text, at most 20000 characters.`);
  return input;
}
function identifier(input: unknown, label: string): string {
  const result = text(input, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(result)) throw new Error(`${label} requires a short identifier.`);
  return result;
}
function texts(input: unknown, label: string, minimum = 0): string[] {
  if (!Array.isArray(input) || input.length < minimum || input.length > 1000) throw new Error(`${label} requires an array with ${minimum} to 1000 items.`);
  const result = input.map((item, index) => text(item, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicates.`);
  return result;
}
function date(input: unknown, label: string): string {
  const value = text(input, label);
  if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${label} requires an ISO timestamp.`);
  return new Date(value).toISOString();
}
function scope(input: unknown): ModelScope {
  const value = object(input, [...scopeKeys], "scope");
  return Object.fromEntries(scopeKeys.map(key => [key, text(value[key], `scope.${key}`)])) as unknown as ModelScope;
}
function choice<T extends string>(input: unknown, choices: readonly T[], label: string): T {
  if (typeof input !== "string" || !choices.includes(input as T)) throw new Error(`${label} must be one of ${choices.join(", ")}.`);
  return input as T;
}
function number(input: unknown, label: string, minimum: number, maximum: number, integer = false): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input < minimum || input > maximum || integer && !Number.isInteger(input)) throw new Error(`${label} must be ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}.`);
  return input;
}
function parseSource(input: unknown): SourceInput {
  const value = object(input, ["id", "kind", "title", "reference", "collectedAt", "method", "scope", "partition", "participantRefs", "consentRef", "permissions", "expiresAt", "limitations", "content"], "source");
  const permissions = object(value.permissions, ["grounding", "training", "evaluation"], "permissions");
  for (const key of ["grounding", "training", "evaluation"]) if (typeof permissions[key] !== "boolean") throw new Error(`permissions.${key} must be boolean.`);
  const content = object(value.content, ["text", "observedAction"], "content");
  const result: SourceInput = {
    id: identifier(value.id, "id"), kind: choice(value.kind, ["human_observation", "published_research", "synthetic_fixture"], "kind"),
    title: text(value.title, "title"), reference: text(value.reference, "reference"), collectedAt: date(value.collectedAt, "collectedAt"),
    method: text(value.method, "method"), scope: scope(value.scope), partition: choice(value.partition, ["grounding", "held_out"], "partition"),
    participantRefs: texts(value.participantRefs, "participantRefs"), consentRef: value.consentRef === null ? null : text(value.consentRef, "consentRef"),
    permissions: { grounding: permissions.grounding as boolean, training: permissions.training as boolean, evaluation: permissions.evaluation as boolean },
    expiresAt: value.expiresAt === null ? null : date(value.expiresAt, "expiresAt"), limitations: texts(value.limitations, "limitations", 1),
    content: { text: text(content.text, "content.text"), ...(content.observedAction !== undefined ? { observedAction: text(content.observedAction, "content.observedAction") } : {}) },
  };
  if (result.partition === "held_out" && (result.permissions.grounding || result.permissions.training)) throw new Error("Held-out sources cannot permit grounding or training.");
  if (result.kind === "human_observation" && (!result.consentRef || result.participantRefs.length === 0)) throw new Error("Human observations require consent and participant references.");
  if (result.partition === "held_out" && (!result.permissions.evaluation || result.participantRefs.length !== 1 || !result.content.observedAction)) throw new Error("Held-out sources require evaluation permission, one participant reference, and an observed action.");
  return result;
}
function parseModel(input: unknown): ModelInput {
  const value = object(input, ["id", "version", "domain", "scope", "sourceIds", "goals", "constraints", "knownInformation", "decisionRules", "limitations"], "model");
  return {
    id: identifier(value.id, "id"), version: identifier(value.version, "version"), domain: choice(value.domain, ["consumer", "investor"], "domain"),
    scope: scope(value.scope), sourceIds: texts(value.sourceIds, "sourceIds", 1), goals: texts(value.goals, "goals", 1), constraints: texts(value.constraints, "constraints", 1),
    knownInformation: texts(value.knownInformation, "knownInformation"), decisionRules: texts(value.decisionRules, "decisionRules", 1), limitations: texts(value.limitations, "limitations", 1),
  };
}

export class ResearchRegistry {
  readonly directory: string;
  private readonly db: DatabaseSync;

  constructor(workspace: string) {
    this.directory = workspaceDirectory(workspace);
    const path = resolve(this.directory, "research.sqlite");
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("The research database must not be a symbolic link.");
    this.db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS research_sources (id TEXT PRIMARY KEY, document TEXT NOT NULL, content TEXT);
      CREATE TABLE IF NOT EXISTS stakeholder_models (id TEXT NOT NULL, version TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(id, version));
      CREATE TABLE IF NOT EXISTS evaluations (id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outcome_exposures (source_id TEXT PRIMARY KEY, evaluation_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research_audit (sequence INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL);
    `);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private audit(action: string, entity: string): void { this.db.prepare("INSERT INTO research_audit(at, action, entity) VALUES (?, ?, ?)").run(new Date().toISOString(), action, entity); }
  sources(): ResearchSource[] { return this.db.prepare("SELECT document FROM research_sources ORDER BY id").all().map(row => JSON.parse(String(row.document)) as ResearchSource); }
  source(id: string): ResearchSource {
    const row = this.db.prepare("SELECT document FROM research_sources WHERE id=?").get(id);
    if (!row) throw new Error("Research source not found.");
    return JSON.parse(String(row.document)) as ResearchSource;
  }
  addSource(input: unknown): ResearchSource {
    const parsed = parseSource(input);
    const { content, ...metadata } = parsed;
    const serialized = JSON.stringify(content);
    const source: ResearchSource = { ...metadata, contentHash: sha256(serialized), createdAt: new Date().toISOString(), provenance: "operator_declared", revokedAt: null, revocationReason: null };
    return this.transaction(() => {
      this.db.prepare("INSERT INTO research_sources(id, document, content) VALUES (?, ?, ?)").run(source.id, JSON.stringify(source), encryptLocal(this.directory, `research:${source.id}`, serialized));
      this.audit("source_added", source.id);
      return source;
    });
  }
  private permitted(id: string, purpose: "grounding" | "training" | "evaluation"): ResearchSource {
    const source = this.source(id);
    if (source.revokedAt || source.expiresAt !== null && Date.parse(source.expiresAt) <= Date.now() || !source.permissions[purpose]) throw new Error("Research use is missing, expired, or revoked.");
    if (purpose !== "evaluation" && source.partition === "held_out") throw new Error("Held-out content is unavailable to grounding and training.");
    return source;
  }
  private content(source: ResearchSource): SourceInput["content"] {
    const row = this.db.prepare("SELECT content FROM research_sources WHERE id=?").get(source.id);
    if (typeof row?.content !== "string") throw new Error("Source content is unavailable.");
    const serialized = decryptLocal(this.directory, `research:${source.id}`, row.content);
    if (sha256(serialized) !== source.contentHash) throw new Error("Research source failed its integrity check.");
    return JSON.parse(serialized) as SourceInput["content"];
  }
  readSource(id: string, purpose: "grounding" | "training"): SourceInput["content"] {
    // Runtime callers cannot bypass the evaluation lock through a forged purpose value.
    if (purpose !== "grounding" && purpose !== "training") throw new Error("Use locked evaluation access for outcomes.");
    const source = this.permitted(id, purpose);
    return this.content(source);
  }
  revokeSource(id: string, reason: string): void {
    text(reason, "reason");
    this.transaction(() => {
      const source = this.source(id);
      source.revokedAt ??= new Date().toISOString();
      source.revocationReason ??= reason;
      source.permissions = { grounding: false, training: false, evaluation: false };
      this.db.prepare("UPDATE research_sources SET document=?, content=NULL WHERE id=?").run(JSON.stringify(source), id);
      for (const model of this.models()) if (model.sourceIds.includes(id) && model.status !== "retired") this.saveModel({ ...model, status: "restricted" });
      this.audit("source_revoked", id);
    });
  }
  private saveModel(model: RegisteredModel): void { this.db.prepare("UPDATE stakeholder_models SET document=? WHERE id=? AND version=?").run(JSON.stringify(model), model.id, model.version); }
  models(): RegisteredModel[] { return this.db.prepare("SELECT document FROM stakeholder_models ORDER BY id, version").all().map(row => this.currentModel(JSON.parse(String(row.document)) as RegisteredModel)); }
  model(id: string, version: string): RegisteredModel {
    const row = this.db.prepare("SELECT document FROM stakeholder_models WHERE id=? AND version=?").get(id, version);
    if (!row) throw new Error("Stakeholder model version not found.");
    return this.currentModel(JSON.parse(String(row.document)) as RegisteredModel);
  }
  private currentModel(model: RegisteredModel): RegisteredModel {
    if (model.status === "retired") return model;
    try { for (const id of model.sourceIds) this.permitted(id, "grounding"); }
    catch { return { ...model, status: "restricted" }; }
    return model;
  }
  addModel(input: unknown): RegisteredModel {
    const value = parseModel(input);
    return this.transaction(() => {
      for (const id of value.sourceIds) {
        const source = this.permitted(id, "grounding");
        if (!scopeMatches(source.scope, value.scope)) throw new Error("Model sources must match its registered scope.");
      }
      const model: RegisteredModel = { ...value, hash: sha256(JSON.stringify(value)), createdAt: new Date().toISOString(), status: "draft" };
      this.db.prepare("INSERT INTO stakeholder_models(id, version, document) VALUES (?, ?, ?)").run(model.id, model.version, JSON.stringify(model));
      this.audit("model_added", `${model.id}:${model.version}`);
      return model;
    });
  }
  groundModel(id: string, version: string): RegisteredModel {
    return this.transaction(() => {
      const model = this.model(id, version);
      if (model.status !== "draft") throw new Error("Only an active draft model can be grounded.");
      const sources = model.sourceIds.map(sourceId => this.permitted(sourceId, "grounding"));
      if (sources.some(source => source.kind === "synthetic_fixture") || !sources.some(source => source.kind === "human_observation")) throw new Error("Research grounding requires declared human observations and excludes synthetic fixtures.");
      const grounded = { ...model, status: "research_grounded" as const };
      this.saveModel(grounded); this.audit("model_grounded", `${id}:${version}`);
      return grounded;
    });
  }
  authorizeModel(id: string, version: string, requestedScope: ModelScope, use: "exploratory" | "validated_within_scope"): RegisteredModel {
    const model = this.model(id, version);
    if (use !== "exploratory") throw new Error("Validated prediction requires independent research review; no validated models are available.");
    if (!scopeMatches(model.scope, scope(requestedScope))) throw new Error("Decision scope is outside the model version.");
    if (["restricted", "retired"].includes(model.status)) throw new Error("This model version is not permitted for use.");
    return model;
  }

  evaluation(id: string): RegisteredEvaluation {
    const row = this.db.prepare("SELECT document FROM evaluations WHERE id=?").get(id);
    if (!row) throw new Error("Evaluation not found.");
    return JSON.parse(String(row.document)) as RegisteredEvaluation;
  }
  evaluations(): RegisteredEvaluation[] { return this.db.prepare("SELECT document FROM evaluations ORDER BY id").all().map(row => JSON.parse(String(row.document)) as RegisteredEvaluation); }
  registerEvaluation(input: unknown): RegisteredEvaluation {
    const value = object(input, ["id", "modelId", "modelVersion", "scope", "cases", "thresholds", "protocolRef", "outcomeHorizon"], "evaluation");
    const model = this.model(identifier(value.modelId, "modelId"), identifier(value.modelVersion, "modelVersion"));
    const requestedScope = scope(value.scope);
    this.authorizeModel(model.id, model.version, requestedScope, "exploratory");
    if (!Array.isArray(value.cases) || !value.cases.length || value.cases.length > 10000) throw new Error("Register from one to 10000 evaluation cases.");
    const cases = value.cases.map(item => {
      const entry = object(item, ["id", "sourceId", "scenarioRef"], "case");
      return { id: identifier(entry.id, "case.id"), sourceId: identifier(entry.sourceId, "case.sourceId"), scenarioRef: identifier(entry.scenarioRef, "case.scenarioRef") };
    });
    if (new Set(cases.map(item => item.id)).size !== cases.length || new Set(cases.map(item => item.sourceId)).size !== cases.length) throw new Error("Evaluation cases and outcome sources must be unique.");
    const thresholds = object(value.thresholds, ["minimumCases", "minimumParticipants", "minimumAccuracy", "baselineAccuracy", "minimumLift"], "thresholds");
    const parsedThresholds = {
      minimumCases: number(thresholds.minimumCases, "minimumCases", 1, 10000, true), minimumParticipants: number(thresholds.minimumParticipants, "minimumParticipants", 1, 10000, true),
      minimumAccuracy: number(thresholds.minimumAccuracy, "minimumAccuracy", 0, 1), baselineAccuracy: number(thresholds.baselineAccuracy, "baselineAccuracy", 0, 1), minimumLift: number(thresholds.minimumLift, "minimumLift", 0, 1),
    };
    return this.transaction(() => {
      const grounding = model.sourceIds.map(id => this.permitted(id, "grounding"));
      const participants = new Set(grounding.flatMap(source => source.participantRefs));
      const sources = cases.map(item => this.permitted(item.sourceId, "evaluation"));
      this.assertUnexposed(sources);
      for (const source of sources) {
        if (source.partition !== "held_out" || source.kind === "published_research" || !scopeMatches(source.scope, requestedScope)) throw new Error("Evaluation requires held-out observation sources within the model scope.");
        if (source.participantRefs.some(id => participants.has(id))) throw new Error("Held-out participants overlap the model's grounding evidence.");
      }
      const record: RegisteredEvaluation = {
        id: identifier(value.id, "id"), modelId: model.id, modelVersion: model.version, scope: requestedScope, cases, thresholds: parsedThresholds, protocolRef: text(value.protocolRef, "protocolRef"), outcomeHorizon: text(value.outcomeHorizon, "outcomeHorizon"),
        modelHash: model.hash, sourceHashes: Object.fromEntries(sources.map(source => [source.id, source.contentHash])),
        mode: model.status !== "research_grounded" || sources.some(source => source.kind === "synthetic_fixture") ? "software_fixture" : "research_evaluation",
        registeredAt: new Date().toISOString(), predictions: null, predictionHash: null, lockedAt: null, result: null,
      };
      this.db.prepare("INSERT INTO evaluations(id, document) VALUES (?, ?)").run(record.id, JSON.stringify(record)); this.audit("evaluation_registered", record.id);
      return record;
    });
  }
  private saveEvaluation(record: RegisteredEvaluation): void { this.db.prepare("UPDATE evaluations SET document=? WHERE id=?").run(JSON.stringify(record), record.id); }
  private assertUnexposed(sources: ResearchSource[]): void {
    const exposed = this.db.prepare("SELECT source_id FROM outcome_exposures").all().map(row => this.source(String(row.source_id)));
    const participants = new Set(exposed.flatMap(source => source.participantRefs));
    const hashes = new Set(exposed.map(source => `${source.reference}\u0000${source.contentHash}`));
    if (sources.some(source => hashes.has(`${source.reference}\u0000${source.contentHash}`) || source.participantRefs.some(id => participants.has(id)))) {
      throw new Error("These outcomes or participant records have already been exposed. They cannot become a fresh held-out test.");
    }
  }
  private checkEvaluation(record: RegisteredEvaluation): RegisteredModel {
    const model = this.authorizeModel(record.modelId, record.modelVersion, record.scope, "exploratory");
    if (model.hash !== record.modelHash) throw new Error("Evaluation model hash changed.");
    for (const item of record.cases) {
      const source = this.permitted(item.sourceId, "evaluation");
      if (source.contentHash !== record.sourceHashes[source.id]) throw new Error("Evaluation source hash changed.");
    }
    return model;
  }
  lockPredictions(id: string, input: unknown): RegisteredEvaluation {
    return this.transaction(() => {
      const record = this.evaluation(id);
      const model = this.checkEvaluation(record);
      if (record.lockedAt) throw new Error("Predictions are already locked and cannot be overwritten.");
      this.assertUnexposed(record.cases.map(item => this.source(item.sourceId)));
      if (!Array.isArray(input) || input.length !== record.cases.length) throw new Error("Predictions must cover every registered case exactly once.");
      const predictions = input.map(item => {
        const entry = object(item, ["caseId", "action"], "prediction");
        return { caseId: identifier(entry.caseId, "caseId"), action: choice(entry.action, model.domain === "consumer" ? consumerActions : investorActions, "action") };
      }).sort((a, b) => a.caseId.localeCompare(b.caseId));
      const caseIds = new Set(record.cases.map(item => item.id));
      if (new Set(predictions.map(item => item.caseId)).size !== caseIds.size || predictions.some(item => !caseIds.has(item.caseId))) throw new Error("Predictions must cover every registered case exactly once.");
      record.predictions = predictions; record.predictionHash = sha256(JSON.stringify(predictions)); record.lockedAt = new Date().toISOString();
      this.saveEvaluation(record); this.audit("predictions_locked", id); return record;
    });
  }
  readEvaluationOutcomes(id: string): { caseId: string; observedAction: string }[] {
    return this.transaction(() => this.lockedOutcomes(id));
  }
  private lockedOutcomes(id: string): { caseId: string; observedAction: string }[] {
    const record = this.evaluation(id);
    const model = this.checkEvaluation(record);
    if (!record.lockedAt || !record.predictions || !record.predictionHash) throw new Error("Freeze all predictions before outcome access.");
    if (sha256(JSON.stringify(record.predictions)) !== record.predictionHash) throw new Error("Prediction integrity check failed.");
    const actions = model.domain === "consumer" ? consumerActions : investorActions;
    const outcomes = record.cases.map(item => ({ caseId: item.id, observedAction: choice(this.content(this.permitted(item.sourceId, "evaluation")).observedAction, actions, "observedAction") }));
    for (const item of record.cases) this.db.prepare("INSERT INTO outcome_exposures(source_id, evaluation_id) VALUES (?, ?) ON CONFLICT(source_id) DO NOTHING").run(item.sourceId, id);
    this.audit("locked_outcomes_read", id); return outcomes;
  }
  scoreEvaluation(id: string): EvaluationResult {
    return this.transaction(() => {
      const outcomes = this.lockedOutcomes(id);
      const record = this.evaluation(id);
      if (record.result) return record.result;
      const predictions = new Map(record.predictions!.map(item => [item.caseId, item.action]));
      const correct = outcomes.filter(item => predictions.get(item.caseId) === item.observedAction).length;
      const participantCount = new Set(record.cases.flatMap(item => this.source(item.sourceId).participantRefs)).size;
      const accuracy = correct / outcomes.length;
      const lift = accuracy - record.thresholds.baselineAccuracy;
      const result: EvaluationResult = {
        caseCount: outcomes.length, participantCount, correct, accuracy, baselineAccuracy: record.thresholds.baselineAccuracy, lift,
        thresholdsPassed: outcomes.length >= record.thresholds.minimumCases && participantCount >= record.thresholds.minimumParticipants && accuracy >= record.thresholds.minimumAccuracy && lift >= record.thresholds.minimumLift,
        validated: false, limitations: [record.mode === "software_fixture" ? "Synthetic or draft-model software evaluation; not human behavioral evidence." : "Agreement with operator-declared observation records; provenance requires independent verification.",
          "No automatic model validation. Sampling adequacy, clustered uncertainty, protocol quality, and independent research review remain required.",
          "Categorical agreement is not a purchase probability, investment probability, or population estimate."],
      };
      record.result = result; this.saveEvaluation(record); this.audit("evaluation_scored", id); return result;
    });
  }
  summary() {
    const models = this.models();
    return { sources: this.sources().length, models, evaluations: this.evaluations().length, groundedModels: models.filter(model => model.status === "research_grounded").length, validatedModels: 0,
      status: "Local registry. Model provenance is operator-declared. Independent behavioral validation is not available." };
  }
  close(): void { this.db.close(); }
}
