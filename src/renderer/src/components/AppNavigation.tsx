import { ArrowLeftRight, FolderOpen, Home, Inbox, Monitor, QrCode, Settings } from "lucide-react";
import type { ReactElement } from "react";

export type AppPage = "home" | "devices" | "transfers" | "shared" | "received" | "mobile" | "settings";

type AppNavigationProps = {
  activePage: AppPage;
  deviceName: string;
  onNavigate(page: AppPage): void;
};

const pages = [
  { id: "home", label: "首页", icon: Home },
  { id: "devices", label: "附近设备", icon: Monitor },
  { id: "transfers", label: "传输", icon: ArrowLeftRight },
  { id: "shared", label: "共享文件", icon: FolderOpen },
  { id: "received", label: "接收文件", icon: Inbox },
  { id: "mobile", label: "手机扫码", icon: QrCode },
  { id: "settings", label: "设置", icon: Settings }
] satisfies Array<{ id: AppPage; label: string; icon: typeof Home }>;

export function AppNavigation({ activePage, deviceName, onNavigate }: AppNavigationProps): ReactElement {
  return (
    <aside className="sidebar">
      <div className="brandBlock">
        <h1>局域网快传</h1>
        <span>{deviceName || "本机设备"}</span>
      </div>
      <nav className="tabList" aria-label="主导航">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <button
              aria-current={activePage === page.id ? "page" : undefined}
              className={activePage === page.id ? "active" : ""}
              key={page.id}
              type="button"
              onClick={() => onNavigate(page.id)}
            >
              <Icon size={18} aria-hidden={true} />
              <span>{page.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
