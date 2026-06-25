import { invoke } from "@tauri-apps/api/core";

interface Props {
  onLogout?: () => void;
}

export default function Titlebar({ onLogout }: Props) {
  const hide = () => invoke("hide_window").catch(() => undefined);

  return (
    <div className="titlebar draggable">
      <h1>ISHWE QuickNote</h1>
      <div className="titlebar-actions">
        {onLogout && (
          <button onClick={onLogout} title="退出登录">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
        <button onClick={hide} title="最小化到托盘">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
