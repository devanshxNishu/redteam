export type ActionStatus = "proposed" | "in_progress" | "blocked" | "completed_declared" | "cancelled";
export class ActionConflictError extends Error {}
export interface ActionOrigin {
  kind: "browser_finding" | "engineering_observation";
  runId: string;
  itemId: string;
}
export interface ActionOriginPin extends ActionOrigin {
  evidenceRunId: string;
  directory: string;
  reportSha256: string;
  sourceStatus: string;
  access: { grantId: string; target: string } | null;
}
export interface ActionInput {
  schemaVersion: "1.0";
  kind: "action_input";
  origin: ActionOrigin;
  title: string;
  owner: string;
  nextStep: string;
  validationMethod: string;
}
export interface ActionRecord {
  schemaVersion: "1.0";
  kind: "tracked_action";
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  origin: ActionOriginPin;
  title: string;
  owner: string;
  nextStep: string;
  validationMethod: string;
  status: ActionStatus;
  authorship: "operator_supplied";
  verificationStatus: "not_independently_verified";
  execution: "not_performed_by_tracking";
}
export interface ActionEvent {
  actionId: string;
  revision: number;
  at: string;
  operation: "created" | "updated";
  note: string;
  after: ActionRecord;
}
