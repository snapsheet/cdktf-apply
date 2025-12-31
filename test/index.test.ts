jest.mock("@actions/core");
jest.mock("../src/modes/plan");
jest.mock("../src/modes/validate");
jest.mock("../src/modes/apply");

type Mode = "plan" | "validate" | "apply" | "unknown";

interface SetupTestOptions {
  mode: Mode;
  inputOverrides?: Partial<Record<string, string>>;
}

function setupIndexTest({ mode, inputOverrides = {} }: SetupTestOptions) {
  jest.resetModules();
  jest.resetAllMocks();

  // Set up process.env
  process.env.STACK_NAME = inputOverrides.STACK_NAME ?? "stack";

  const defaults: Record<string, string> = {
    mode,
    working_directory: "/cdktf",
    environment: "release",
    ref: "main",
    ...inputOverrides,
  };
  const core = require("@actions/core");
  (core.getInput as jest.Mock).mockImplementation(
    (name: string) => defaults[name] ?? ""
  );

  // Create the proper mock based on the mode.
  // Also, allow unknown mode to be tested.
  if (mode === "plan" || mode === "unknown") {
    const plan = require("../src/modes/plan");
    return { executorMock: plan.executePlan as jest.Mock, core };
  }
  if (mode === "validate") {
    const validate = require("../src/modes/validate");
    return { executorMock: validate.executeValidate as jest.Mock, core };
  }
  if (mode === "apply") {
    const apply = require("../src/modes/apply");
    return { executorMock: apply.executeApply as jest.Mock, core };
  }
  return { executorMock: null, core };
}

describe("index.ts", () => {
  afterEach(() => {
    delete process.env.STACK_NAME;
  });

  it("runs plan mode and sets output", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "plan" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: true },
      noChanges: false,
    });
    await import("../src/index");
    expect(executorMock).toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("no_changes", "false");
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("runs plan mode and fails if plan fails", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "plan" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: false, error: "fail" },
      noChanges: false,
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith("fail");
  });

  it("runs validate mode and sets output", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "validate" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: true },
      driftDetected: false,
    });
    await import("../src/index");
    expect(executorMock).toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("drift_detected", "false");
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("runs validate mode and fails if drift detected", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "validate" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: true },
      driftDetected: true,
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith(
      "Terraform plans do NOT match. See the plan diff artifact for details."
    );
  });

  it("runs validate mode and fails if validate fails", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "validate" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: false, error: "validate fail" },
      driftDetected: false,
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith("validate fail");
  });

  it("runs apply mode and succeeds", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "apply" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: true },
    });
    await import("../src/index");
    expect(executorMock).toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("runs apply mode and fails if apply fails", async () => {
    const { executorMock, core } = setupIndexTest({ mode: "apply" });
    (executorMock as jest.Mock).mockResolvedValue({
      result: { success: false, error: "apply fail" },
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith("apply fail");
  });

  it("throws if STACK_NAME is missing", async () => {
    const { core } = setupIndexTest({
      mode: "apply",
      inputOverrides: { STACK_NAME: "" },
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith(
      "STACK_NAME environment variable is required but was not provided."
    );
  });

  it("throws on unknown mode", async () => {
    const { core } = setupIndexTest({
      mode: "unknown",
      inputOverrides: { STACK_NAME: "stack" },
    });
    await import("../src/index");
    expect(core.setFailed).toHaveBeenCalledWith("Unknown mode: unknown");
  });
});
