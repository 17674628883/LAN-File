import type { StartTransferInput, TransferTask } from "./transferTypes";

export type TransferStore = {
  list(): TransferTask[];
  start(input: StartTransferInput): TransferTask;
  progress(id: string, transferredBytes: number): void;
  complete(id: string): void;
  fail(id: string, error: string): void;
  cancel(id: string): void;
};

export function createTransferStore(now: () => number = Date.now): TransferStore {
  const tasks = new Map<string, TransferTask>();

  return {
    list() {
      return [...tasks.values()]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(cloneTask);
    },

    start(input) {
      const timestamp = now();
      const task: TransferTask = {
        ...input,
        totalBytes: Math.max(0, input.totalBytes),
        transferredBytes: 0,
        status: "active",
        startedAt: timestamp,
        updatedAt: timestamp
      };

      tasks.set(task.id, cloneTask(task));
      return cloneTask(task);
    },

    progress(id, transferredBytes) {
      updateTask(tasks, id, (task) => {
        task.transferredBytes = clampTransferredBytes(transferredBytes, task.totalBytes);
        task.updatedAt = now();
      });
    },

    complete(id) {
      updateTask(tasks, id, (task) => {
        task.transferredBytes = task.totalBytes;
        task.status = "completed";
        task.updatedAt = now();
      });
    },

    fail(id, error) {
      updateTask(tasks, id, (task) => {
        task.status = "failed";
        task.error = error;
        task.updatedAt = now();
      });
    },

    cancel(id) {
      updateTask(tasks, id, (task) => {
        task.status = "canceled";
        task.updatedAt = now();
      });
    }
  };
}

function updateTask(tasks: Map<string, TransferTask>, id: string, update: (task: TransferTask) => void): void {
  const task = tasks.get(id);

  if (task === undefined || task.status !== "active") {
    return;
  }

  update(task);
}

function clampTransferredBytes(transferredBytes: number, totalBytes: number): number {
  return Math.max(0, Math.min(transferredBytes, totalBytes));
}

function cloneTask(task: TransferTask): TransferTask {
  return { ...task };
}
