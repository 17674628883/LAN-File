export type TransferDirection = "send" | "receive";
export type TransferStatus = "active" | "completed" | "failed" | "canceled";

export type TransferTask = {
  id: string;
  name: string;
  direction: TransferDirection;
  totalBytes: number;
  transferredBytes: number;
  status: TransferStatus;
  startedAt: number;
  updatedAt: number;
  error?: string;
};

export type StartTransferInput = {
  id: string;
  name: string;
  direction: TransferDirection;
  totalBytes: number;
};
