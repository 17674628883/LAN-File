export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version?: string }
  | { status: "not-available" }
  | { status: "downloading"; percent: number }
  | { status: "downloaded"; version?: string }
  | { status: "error"; message: string };

export function createInitialUpdateState(): UpdateState {
  return { status: "idle" };
}

export function createUpdateStatusMessage(state: UpdateState): string {
  if (state.status === "idle") return "尚未检查更新。";
  if (state.status === "checking") return "正在检查更新...";
  if (state.status === "available") return state.version ? `发现新版本 ${state.version}，正在下载...` : "发现新版本，正在下载...";
  if (state.status === "not-available") return "当前已经是最新版本。";
  if (state.status === "downloading") return `正在下载更新 ${Math.round(state.percent)}%`;
  if (state.status === "downloaded") {
    return state.version ? `新版本 ${state.version} 已下载，重启后完成安装。` : "新版本已下载，重启后完成安装。";
  }
  return `更新失败：${state.message}`;
}
