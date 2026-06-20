import { useEffect, useState, type ReactElement } from "react";
import { api, type AppStatus } from "./api";
import { MobileQrPanel } from "./components/MobileQrPanel";
import { NearbyDevices } from "./components/NearbyDevices";
import { PairingDialog } from "./components/PairingDialog";
import { SharedFolderPanel } from "./components/SharedFolderPanel";
import { Transfers } from "./components/Transfers";

type TabId = "nearby" | "transfers" | "shared" | "mobile";

const STATUS_POLL_INTERVAL_MS = 2_000;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "nearby", label: "附近设备" },
  { id: "transfers", label: "传输" },
  { id: "shared", label: "共享文件夹" },
  { id: "mobile", label: "手机扫码" }
];

const initialStatus: AppStatus = {
  deviceName: "",
  lanUrl: "",
  mobileUrl: "",
  peers: [],
  transfers: []
};

export function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>("nearby");
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [sendStatusMessage, setSendStatusMessage] = useState<string | undefined>();

  useEffect(() => {
    let canceled = false;

    const loadStatus = (): void => {
      api
        .getStatus()
        .then((nextStatus) => {
          if (!canceled) {
            setStatus(nextStatus);
          }
        })
        .catch((error: unknown) => {
          console.error("Failed to load app status", error);
        });
    };

    loadStatus();
    const intervalId = window.setInterval(loadStatus, STATUS_POLL_INTERVAL_MS);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const chooseSharedFolder = (): void => {
    api
      .chooseSharedFolder()
      .then((selectedPath) => {
        if (selectedPath) {
          setStatus((current) => ({ ...current, sharedFolder: selectedPath }));
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to choose shared folder", error);
      });
  };

  const requestPairing = (deviceId: string): void => {
    setSendStatusMessage("正在等待对方确认配对...");
    api
      .requestPairing(deviceId)
      .then((accepted) => {
        if (!accepted) {
          setSendStatusMessage("对方拒绝了配对请求。");
          return;
        }

        setStatus((current) => ({
          ...current,
          peers: current.peers.map((peer) => (peer.deviceId === deviceId ? { ...peer, paired: true } : peer))
        }));
        setSendStatusMessage("配对成功，可以发送文件了。");
      })
      .catch((error: unknown) => {
        console.error("Failed to pair with device", error);
        setSendStatusMessage("配对失败，请确认两台电脑在同一局域网内。");
      });
  };

  const sendFileToPeer = (deviceId: string): void => {
    setSendStatusMessage("正在发送文件...");
    api
      .sendFileToPeer(deviceId)
      .then(() => {
        setSendStatusMessage(undefined);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "发送文件失败。";
        console.error("Failed to send file", error);
        setSendStatusMessage(message);
      });
  };

  const browsePeerSharedFolder = (deviceId: string): void => {
    api.browsePeerSharedFolder(deviceId).catch((error: unknown) => {
      console.error("Failed to browse peer shared folder", error);
      setSendStatusMessage("无法打开对方的共享文件夹。");
    });
  };

  const sendFolderToPeer = (deviceId: string): void => {
    setSendStatusMessage("正在发送文件夹...");
    api
      .sendFolderToPeer(deviceId)
      .then(() => {
        setSendStatusMessage(undefined);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "发送文件夹失败。";
        console.error("Failed to send folder", error);
        setSendStatusMessage(message);
      });
  };

  const cancelTransfer = (transferId: string): void => {
    api.cancelTransfer(transferId).catch((error: unknown) => {
      console.error("Failed to cancel transfer", error);
    });
  };

  const openReceiveFolder = (): void => {
    api.openReceiveFolder().catch((error: unknown) => {
      console.error("Failed to open receive folder", error);
      setSendStatusMessage("无法打开接收文件夹。");
    });
  };

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <h1>局域网快传</h1>
          <span>{status.deviceName || "本机设备"}</span>
        </div>
        <nav className="tabList" aria-label="主导航">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="content">
        {sendStatusMessage ? (
          <p className="fieldLabel" role="status" aria-live="polite">
            {sendStatusMessage}
          </p>
        ) : null}
        {activeTab === "nearby" ? (
          <NearbyDevices
            peers={status.peers}
            onPair={requestPairing}
            onBrowseShared={browsePeerSharedFolder}
            onSendFile={sendFileToPeer}
            onSendFolder={sendFolderToPeer}
          />
        ) : null}
        {activeTab === "transfers" ? (
          <Transfers transfers={status.transfers} onCancel={cancelTransfer} onOpenReceiveFolder={openReceiveFolder} />
        ) : null}
        {activeTab === "shared" ? <SharedFolderPanel sharedFolder={status.sharedFolder} onChooseFolder={chooseSharedFolder} /> : null}
        {activeTab === "mobile" ? <MobileQrPanel mobileUrl={status.mobileUrl} /> : null}
      </section>
      <PairingDialog />
    </main>
  );
}
