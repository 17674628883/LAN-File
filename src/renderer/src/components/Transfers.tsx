import type { ReactElement } from "react";
import type { Transfer } from "../api";

type TransfersProps = {
  transfers: Transfer[];
  onCancel: (transferId: string) => void;
};

const directionLabels: Record<Transfer["direction"], string> = {
  send: "发送",
  receive: "接收"
};

const statusLabels: Record<Transfer["status"], string> = {
  active: "进行中",
  completed: "已完成",
  failed: "失败",
  canceled: "已取消"
};

export function Transfers({ transfers, onCancel }: TransfersProps): ReactElement {
  return (
    <section className="panel" aria-labelledby="transfers-title">
      <header className="panelHeader">
        <h2 id="transfers-title">传输</h2>
        <span className="countBadge">{transfers.length}</span>
      </header>

      {transfers.length === 0 ? (
        <div className="emptyState">
          <p>暂无传输任务。</p>
        </div>
      ) : (
        <div className="rowList">
          {transfers.map((transfer) => {
            const progress = transfer.totalBytes > 0 ? Math.round((transfer.transferredBytes / transfer.totalBytes) * 100) : 0;

            return (
              <div className="transferRow" key={transfer.id}>
                <div className="transferSummary">
                  <strong>{transfer.name}</strong>
                  <span>
                    {directionLabels[transfer.direction]} · {statusLabels[transfer.status]}
                  </span>
                </div>
                <div className="progressTrack" aria-label={`${transfer.name} ${progress}%`}>
                  <div className="progressFill" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <span className="progressValue">{progress}%</span>
                <div className="transferActions">
                  {transfer.status === "active" ? (
                    <button className="secondaryButton" type="button" onClick={() => onCancel(transfer.id)}>
                      取消
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
