import type { ReactElement } from "react";

type MobileQrPanelProps = {
  mobileUrl: string;
};

export function MobileQrPanel({ mobileUrl }: MobileQrPanelProps): ReactElement {
  return (
    <section className="panel" aria-labelledby="mobile-qr-title">
      <header className="panelHeader">
        <h2 id="mobile-qr-title">手机扫码</h2>
      </header>

      <div className="qrLayout">
        <div className="qrBox" aria-label="二维码占位">
          QR
        </div>
        <div className="mobileAddress">
          <span className="fieldLabel">手机访问地址</span>
          <p>{mobileUrl || "服务启动后会显示手机访问地址。"}</p>
        </div>
      </div>
    </section>
  );
}
