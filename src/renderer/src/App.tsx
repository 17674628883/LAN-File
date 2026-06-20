import { useEffect, useState, type ReactElement } from "react";
import type { FileBrowserEntry } from "../../shared/fileBrowserTypes";
import { api, type AppStatus } from "./api";
import { AppNavigation, type AppPage } from "./components/AppNavigation";
import { HomePanel } from "./components/HomePanel";
import { MobileQrPanel } from "./components/MobileQrPanel";
import { NearbyDevices } from "./components/NearbyDevices";
import { PairingDialog } from "./components/PairingDialog";
import { RecentReceivedList } from "./components/RecentReceivedList";
import { SharedFolderPanel } from "./components/SharedFolderPanel";
import { Transfers } from "./components/Transfers";

const STATUS_POLL_INTERVAL_MS = 2_000;

const initialStatus: AppStatus = {
  deviceName: "",
  lanUrl: "",
  mobileUrl: "",
  peers: [],
  transfers: []
};

export function App(): ReactElement {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [recentReceived, setRecentReceived] = useState<FileBrowserEntry[]>([]);
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

    const loadRecentReceived = (): void => {
      api
        .listFiles({ source: "received-local", relativePath: "" })
        .then((entries) => {
          if (!canceled) {
            setRecentReceived(
              entries
                .filter((entry) => entry.kind !== "directory")
                .sort((left, right) => right.modifiedAt - left.modifiedAt)
                .slice(0, 5)
            );
          }
        })
        .catch((error: unknown) => {
          console.error("Failed to load received files", error);
        });
    };

    loadStatus();
    loadRecentReceived();
    const intervalId = window.setInterval(loadStatus, STATUS_POLL_INTERVAL_MS);
    const recentIntervalId = window.setInterval(loadRecentReceived, STATUS_POLL_INTERVAL_MS);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
      window.clearInterval(recentIntervalId);
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

  const openReceivedFile = (relativePath: string): void => {
    api.openLocalFile(relativePath).catch((error: unknown) => {
      console.error("Failed to open received file", error);
      setSendStatusMessage("无法打开接收文件。");
    });
  };

  const showReceivedFile = (relativePath: string): void => {
    api.showLocalFile(relativePath).catch((error: unknown) => {
      console.error("Failed to show received file", error);
      setSendStatusMessage("无法定位接收文件。");
    });
  };

  return (
    <main className="appShell">
      <AppNavigation activePage={activePage} deviceName={status.deviceName} onNavigate={setActivePage} />
      <section className="content">
        {sendStatusMessage ? (
          <p className="fieldLabel" role="status" aria-live="polite">
            {sendStatusMessage}
          </p>
        ) : null}
        {activePage === "home" ? (
          <HomePanel
            status={status}
            recentReceived={recentReceived}
            onOpenReceivedFile={openReceivedFile}
            onShowReceivedFile={showReceivedFile}
          />
        ) : null}
        {activePage === "devices" ? (
          <NearbyDevices
            peers={status.peers}
            onPair={requestPairing}
            onBrowseShared={browsePeerSharedFolder}
            onSendFile={sendFileToPeer}
            onSendFolder={sendFolderToPeer}
          />
        ) : null}
        {activePage === "transfers" ? (
          <Transfers transfers={status.transfers} onCancel={cancelTransfer} onOpenReceiveFolder={openReceiveFolder} />
        ) : null}
        {activePage === "shared" ? <SharedFolderPanel sharedFolder={status.sharedFolder} onChooseFolder={chooseSharedFolder} /> : null}
        {activePage === "received" ? (
          <section className="panel" aria-labelledby="received-title">
            <header className="panelHeader">
              <h2 id="received-title">接收文件</h2>
              <button className="secondaryButton" type="button" onClick={openReceiveFolder}>
                打开接收文件夹
              </button>
            </header>
            <section className="recentPanel" aria-labelledby="received-recent-title">
              <div className="panelHeader compact">
                <h3 id="received-recent-title">最近接收</h3>
              </div>
              <RecentReceivedList
                entries={recentReceived}
                emptyText="暂无接收文件"
                onOpenFile={openReceivedFile}
                onShowFile={showReceivedFile}
              />
            </section>
          </section>
        ) : null}
        {activePage === "mobile" ? <MobileQrPanel mobileUrl={status.mobileUrl} /> : null}
        {activePage === "settings" ? (
          <section className="panel" aria-labelledby="settings-title">
            <header className="panelHeader">
              <h2 id="settings-title">设置</h2>
            </header>
            <div className="emptyState">
              <p>暂无可配置项</p>
            </div>
          </section>
        ) : null}
      </section>
      <PairingDialog />
    </main>
  );
}
