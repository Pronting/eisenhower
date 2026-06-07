import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openShell } from "@tauri-apps/plugin-shell";
import {
  pollForToken,
  requestDeviceCode,
  storeToken,
  buildAuthorizeUrl,
} from "../lib/desktop-auth";

interface Props {
  onAuthorized: (token: string) => void;
}

export default function QrAuthPanel({ onAuthorized }: Props) {
  const [userCode, setUserCode] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await requestDeviceCode();
      setUserCode(data.user_code);

      const url = buildAuthorizeUrl(data.user_code);
      try {
        const svg = await invoke<string>("generate_qrcode", { text: url });
        setQrSrc(svg);
      } catch (e) {
        console.warn("qr render failed:", e);
      }

      try {
        await openShell(url);
      } catch {
        window.open(url, "_blank", "noopener");
      }

      const interval = (data.interval || 5) * 1000;
      pollRef.current = window.setInterval(async () => {
        try {
          const token = await pollForToken(data.device_code);
          if (token) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            storeToken(token.access_token);
            onAuthorized(token.access_token);
          }
        } catch (e: any) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setError(e?.message || "授权失败");
          setBusy(false);
        }
      }, interval);
    } catch (e: any) {
      setError(e?.message || "无法连接服务器");
      setBusy(false);
    }
  };

  useEffect(() => {
    void start();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyCode = async () => {
    if (!userCode) return;
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  if (userCode) {
    return (
      <div className="auth-screen">
        <h2>浏览器中完成授权</h2>
        <p>在打开的页面中点击「确认授权」即可</p>
        {qrSrc && (
          <div className="qr-box">
            <img src={qrSrc} alt="QR" />
          </div>
        )}
        <p>或手动输入验证码：</p>
        <div className="user-code">
          <span>{userCode}</span>
          <button className="titlebar-action" onClick={copyCode} title="复制">
            {copied ? "✓" : "📋"}
          </button>
        </div>
        <div className="spinner" style={{ marginTop: 12 }} />
        <p>等待授权中…</p>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <h2>正在准备授权…</h2>
      {error ? (
        <>
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <button className="btn btn-primary" onClick={start}>
            重试
          </button>
        </>
      ) : (
        <div className="spinner" />
      )}
    </div>
  );
}
