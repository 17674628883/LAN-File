import type { ReactElement } from "react";

export function App(): ReactElement {
  return (
    <main className="appShell">
      <aside className="sidebar">
        <h1>局域网快传</h1>
        <button>附近设备</button>
        <button>传输</button>
        <button>共享文件夹</button>
        <button>手机扫码</button>
      </aside>
      <section className="content">
        <h2>附近设备</h2>
        <p>打开同一局域网内其他电脑上的软件后，会自动显示在这里。</p>
      </section>
    </main>
  );
}
