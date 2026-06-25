import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { validateToken, getStoredToken } from "./lib/desktop-auth";
import QrAuthPanel from "./components/QrAuthPanel";
import QuickNoteForm from "./components/QuickNoteForm";
import Titlebar from "./components/Titlebar";

type AppState =
  | { kind: "loading" }
  | { kind: "unauthorized" }
  | { kind: "authorized"; token: string };

export default function App() {
  const [state, setState] = useState<AppState>({ kind: "loading" });

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
          <QuickNoteForm
            token={state.token}
            onUnauthorized={handleLogout}
          />
        )}
      </div>
    </div>
  );
}
