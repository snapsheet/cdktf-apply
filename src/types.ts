export type ApplyMode = "plan" | "validate" | "apply";

export interface ApplyInputs {
  mode: ApplyMode;
  ref?: string;
  workingDirectory: string;
  previousPlanJson?: string;
  environment: string;
  stackName: string;
}

export interface PlanResult {
  result: Result;
  planJson: string;
  noChanges?: boolean;
}

export interface ValidateResult {
  driftDetected?: boolean;
  diffMarkdown?: string;
  result?: Result;
}

export interface ApplyResult {
  result: Result;
}

export interface Result {
  success: boolean;
  output?: string;
  error?: string;
}


export interface ResourceChange {
  address: string;
  change: {
    actions: string[];
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

export interface FlatTerraformResourceChange {
  address: string;
  actions: string[];
  before: Record<string, any>;
  after: Record<string, any>;
}