import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { validateToken, getStoredToken } from "./lib/desktop-auth";
import QrAuthPanel from "./components/QrAuthPanel";
import QuickNoteForm from "./components/QuickNoteForm";
import AiSplitTab from "./components/AiSplitTab";
import Titlebar from "./components/Titlebar";
import TabBar from "./components/TabBar";

type AppState =
  | { kind: "loading" }
  | { kind: "unauthorized" }
  | { kind: "authorized"; token: string };

type TabKey = "quick" | "ai" | "settings";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "quick", label: "快速", icon: "✏️" },
  { key: "ai", label: "AI 拆分", icon: "✨" },
  { key: "settings", label: "设置", icon: "⚙️" },
];

export default function App() {
  const [state, setState] = useState<AppState>({ kind: "loading" });
  const [tab, setTab] = useState<TabKey>("quick");

  useEffect(() => {
    (async () => {
      const ok = await validateToken();
      const token = getStoredToken();
      if (ok && token) {
        setState({ kind: "authorized", token });
      } else {
        setState({ kind: "unauthorized" });
      }
      try {
        await invoke("show_main_window");
      } catch {
        /* web fallback */
      }
    })();
  }, []);

  const handleAuthorized = (token: string) =>
    setState({ kind: "authorized", token });
  const handleLogout = () => setState({ kind: "unauthorized" });

  return (
    <div className="app">
      <Titlebar
        onLogout={state.kind === "authorized" ? handleLogout : undefined}
      />
      <div className="content">
        {state.kind === "loading" && (
          <div className="auth-screen">
            <div className="spinner" />
            <p>验证登录状态…</p>
          </div>
        )}
        {state.kind === "unauthorized" && (
          <QrAuthPanel onAuthorized={handleAuthorized} />
        )}
        {state.kind === "authorized" && (
          <>
            <TabBar
              tabs={TABS}
              active={tab}
              onChange={(k) => setTab(k as TabKey)}
            />
            {tab === "quick" && (
              <QuickNoteForm
                token={state.token}
                onUnauthorized={handleLogout}
              />
            )}
            {tab === "ai" && (
              <AiSplitTab
                token={state.token}
                onUnauthorized={handleLogout}
              />
            )}
            {tab === "settings" && (
              <div className="auth-screen">
                <p style={{ color: "var(--text-muted)" }}>
                  设置 Tab（即将上线）
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
