import QRCode from "qrcode";
import { useEffect, useState, type ReactElement } from "react";

type MobileQrPanelProps = {
  mobileUrl: string;
};

export function MobileQrPanel({ mobileUrl }: MobileQrPanelProps): ReactElement {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let ignore = false;

    setQrDataUrl("");

    if (!mobileUrl) {
      return;
    }

    QRCode.toDataURL(mobileUrl, { margin: 1, width: 176 })
      .then((dataUrl) => {
        if (!ignore) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!ignore) {
          setQrDataUrl("");
        }
      });

    return () => {
      ignore = true;
    };
  }, [mobileUrl]);

  return (
    <section className="panel" aria-labelledby="mobile-qr-title">
      <header className="panelHeader">
        <h2 id="mobile-qr-title">手机扫码</h2>
      </header>

      <div className="qrLayout">
        <div className="qrBox">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="手机访问二维码" style={{ width: "100%", height: "100%", display: "block" }} />
          ) : (
            <span>未启动</span>
          )}
        </div>
        <div className="mobileAddress">
          <span className="fieldLabel">手机访问地址</span>
          <p>{mobileUrl || "服务启动后会显示手机访问地址。"}</p>
        </div>
      </div>
    </section>
  );
}
