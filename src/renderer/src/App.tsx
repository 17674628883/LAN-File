import { useEffect, useState, type ReactElement } from "react";
import type { FileBrowserEntry } from "../../shared/fileBrowserTypes";
import { createInitialUpdateState, type UpdateState } from "../../shared/updateTypes";
import { api, type AppStatus } from "./api";
import { AppNavigation, type AppPage } from "./components/AppNavigation";
import { HomePanel } from "./components/HomePanel";
import { MobileQrPanel } from "./components/MobileQrPanel";
import { NearbyDevices } from "./components/NearbyDevices";
import { PairingDialog } from "./components/PairingDialog";
import { PeerSharedFilesPanel } from "./components/PeerSharedFilesPanel";
import { ReceivedFilesPanel } from "./components/ReceivedFilesPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SharedFilesPanel } from "./components/SharedFilesPanel";
import { Transfers } from "./components/Transfers";

const STATUS_POLL_INTERVAL_MS = 2_000;

const initialStatus: AppStatus = {
  deviceName: "",
  lanUrl: "",
  mobileUrl: "",
  peers: [],
  transfers: [],
  sharedFolderEnabled: false,
  receiveFolder: ""
};

export function App(): ReactElement {
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [recentReceived, setRecentReceived] = useState<FileBrowserEntry[]>([]);
  const [sharedEntries, setSharedEntries] = useState<FileBrowserEntry[]>([]);
  const [receivedEntries, setReceivedEntries] = useState<FileBrowserEntry[]>([]);
  const [peerEntries, setPeerEntries] = useState<FileBrowserEntry[]>([]);
  const [sharedPath, setSharedPath] = useState("");
  const [receivedPath, setReceivedPath] = useState("");
  const [peerPath, setPeerPath] = useState("");
  const [selectedPeerId, setSelectedPeerId] = useState<string | undefined>();
  const [sharedRefreshKey, setSharedRefreshKey] = useState(0);
  const [receivedRefreshKey, setReceivedRefreshKey] = useState(0);
  const [peerRefreshKey, setPeerRefreshKey] = useState(0);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [receivedLoading, setReceivedLoading] = useState(false);
  const [peerLoading, setPeerLoading] = useState(false);
  const [sendStatusMessage, setSendStatusMessage] = useState<string | undefined>();
  const [updateState, setUpdateState] = useState<UpdateState>(createInitialUpdateState());

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

  useEffect(() => {
    api.getUpdateState().then(setUpdateState).catch((error: unknown) => {
      console.error("Failed to load update state", error);
    });

    return api.onUpdateStateChanged(setUpdateState);
  }, []);

  useEffect(() => {
    setSharedLoading(true);
    api
      .listFiles({ source: "shared-local", relativePath: sharedPath })
      .then(setSharedEntries)
      .catch((error: unknown) => {
        console.error("Failed to load shared files", error);
        setSharedEntries([]);
      })
      .finally(() => setSharedLoading(false));
  }, [sharedPath, sharedRefreshKey, status.sharedFolder]);

  useEffect(() => {
    setReceivedLoading(true);
    api
      .listFiles({ source: "received-local", relativePath: receivedPath })
      .then(setReceivedEntries)
      .catch((error: unknown) => {
        console.error("Failed to load received files", error);
        setReceivedEntries([]);
      })
      .finally(() => setReceivedLoading(false));
  }, [receivedPath, receivedRefreshKey]);

  useEffect(() => {
    if (!selectedPeerId) {
      setPeerEntries([]);
      return;
    }

    setPeerLoading(true);
    api
      .listFiles({ source: "peer-shared", relativePath: peerPath, peerDeviceId: selectedPeerId })
      .then(setPeerEntries)
      .catch((error: unknown) => {
        console.error("Failed to load peer shared files", error);
        setPeerEntries([]);
        setSendStatusMessage("无法读取对方共享文件。");
      })
      .finally(() => setPeerLoading(false));
  }, [peerPath, peerRefreshKey, selectedPeerId]);

  const chooseSharedFolder = (): void => {
    api
      .chooseSharedFolder()
      .then((selectedPath) => {
        if (selectedPath) {
          setStatus((current) => ({ ...current, sharedFolder: selectedPath, sharedFolderEnabled: true }));
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to choose shared folder", error);
      });
  };

  const setSharedFolderEnabled = (enabled: boolean): void => {
    api
      .setSharedFolderEnabled(enabled)
      .then((nextEnabled) => {
        setStatus((current) => ({ ...current, sharedFolderEnabled: nextEnabled }));
      })
      .catch((error: unknown) => {
        console.error("Failed to change shared folder state", error);
        setSendStatusMessage("无法更改共享文件开关。");
      });
  };

  const openSharedFolder = (): void => {
    api.openSharedFolder().catch((error: unknown) => {
      console.error("Failed to open shared folder", error);
      setSendStatusMessage("无法打开共享文件夹。");
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

  const rescanPeers = async (): Promise<void> => {
    try {
      setSendStatusMessage("正在重新搜索附近设备...");
      const nextStatus = await api.rescanPeers();
      setStatus(nextStatus);
      setSendStatusMessage(nextStatus.peers.length > 0 ? `已找到 ${nextStatus.peers.length} 台设备。` : "暂时没有找到设备。");
    } catch (error: unknown) {
      console.error("Failed to rescan peers", error);
      const message = error instanceof Error ? error.message : "重新搜索失败，请确认两台电脑在同一网络。";
      setSendStatusMessage(message);
    }
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
    api
      .browsePeerSharedFolder(deviceId)
      .then(() => {
        setSelectedPeerId(deviceId);
        setPeerPath("");
        setPeerRefreshKey((current) => current + 1);
        setActivePage("peer-shared");
      })
      .catch((error: unknown) => {
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

  const sendPathsToPeer = (deviceId: string, paths: string[]): void => {
    setSendStatusMessage("正在发送拖拽文件...");
    api
      .sendPathsToPeer(deviceId, paths)
      .then(() => {
        setSendStatusMessage(undefined);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "拖拽发送失败。";
        console.error("Failed to send dropped paths", error);
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

  const chooseReceiveFolder = (): void => {
    api
      .chooseReceiveFolder()
      .then((selectedPath) => {
        if (selectedPath) {
          setStatus((current) => ({ ...current, receiveFolder: selectedPath }));
          setReceivedPath("");
          setReceivedRefreshKey((current) => current + 1);
          setSendStatusMessage("接收文件夹已更新。");
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to choose receive folder", error);
        setSendStatusMessage("无法更改接收文件夹。");
      });
  };

  const checkForUpdates = (): void => {
    api.checkForUpdates().then(setUpdateState).catch((error: unknown) => {
      console.error("Failed to check for updates", error);
      setSendStatusMessage("检查更新失败。");
    });
  };

  const installDownloadedUpdate = (): void => {
    api.installDownloadedUpdate().catch((error: unknown) => {
      console.error("Failed to install update", error);
      setSendStatusMessage("安装更新失败。");
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

  const downloadPeerFile = (entry: FileBrowserEntry): void => {
    if (!selectedPeerId) return;

    api
      .downloadPeerFile(selectedPeerId, entry.relativePath)
      .then(() => {
        setSendStatusMessage("已下载到接收文件夹。");
        setReceivedRefreshKey((current) => current + 1);
      })
      .catch((error: unknown) => {
        console.error("Failed to download peer file", error);
        setSendStatusMessage("下载对方文件失败。");
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
            onRescan={rescanPeers}
            onPair={requestPairing}
            onBrowseShared={browsePeerSharedFolder}
            onSendFile={sendFileToPeer}
            onSendFolder={sendFolderToPeer}
            onSendPaths={sendPathsToPeer}
          />
        ) : null}
        {activePage === "transfers" ? (
          <Transfers transfers={status.transfers} onCancel={cancelTransfer} onOpenReceiveFolder={openReceiveFolder} />
        ) : null}
        {activePage === "shared" ? (
          <SharedFilesPanel
            rootPath={status.sharedFolder}
            enabled={status.sharedFolderEnabled}
            entries={sharedEntries}
            loading={sharedLoading}
            onEnabledChange={setSharedFolderEnabled}
            onChooseRoot={chooseSharedFolder}
            onOpenRoot={openSharedFolder}
            onRefresh={() => setSharedRefreshKey((current) => current + 1)}
            onOpenDirectory={setSharedPath}
          />
        ) : null}
        {activePage === "received" ? (
          <ReceivedFilesPanel
            entries={receivedEntries}
            loading={receivedLoading}
            onRefresh={() => setReceivedRefreshKey((current) => current + 1)}
            onOpenFile={openReceivedFile}
            onShowFile={showReceivedFile}
            onDeleteFile={(relativePath) => {
              api
                .deleteReceivedFile(relativePath)
                .then(() => setReceivedEntries((current) => current.filter((entry) => entry.relativePath !== relativePath)))
                .catch((error: unknown) => {
                  console.error("Failed to delete received file", error);
                  setSendStatusMessage("删除接收文件失败。");
                });
            }}
            onOpenReceiveFolder={openReceiveFolder}
            onOpenDirectory={setReceivedPath}
          />
        ) : null}
        {activePage === "peer-shared" ? (
          <PeerSharedFilesPanel
            peer={status.peers.find((peer) => peer.deviceId === selectedPeerId)}
            entries={peerEntries}
            loading={peerLoading}
            relativePath={peerPath}
            onRefresh={() => setPeerRefreshKey((current) => current + 1)}
            onOpenDirectory={setPeerPath}
            onDownloadFile={downloadPeerFile}
          />
        ) : null}
        {activePage === "mobile" ? <MobileQrPanel mobileUrl={status.mobileUrl} /> : null}
        {activePage === "settings" ? (
          <SettingsPanel
            receiveFolder={status.receiveFolder}
            updateState={updateState}
            onChooseReceiveFolder={chooseReceiveFolder}
            onOpenReceiveFolder={openReceiveFolder}
            onCheckForUpdates={checkForUpdates}
            onInstallDownloadedUpdate={installDownloadedUpdate}
          />
        ) : null}
      </section>
      <PairingDialog />
    </main>
  );
}
