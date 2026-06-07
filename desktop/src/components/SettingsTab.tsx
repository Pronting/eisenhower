import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../lib/api";

interface Props {
  token: string;
  onUnauthorized: () => void;
}

interface Schedule {
  id: number;
  cron_expression: string;
  push_type: string;
  address: string;
  label: string;
  enabled: boolean;
  next_fire_at?: string | null;
}

interface CronCandidate {
  cron: string;
  human_readable: string;
  next_runs: string[];
}

const SHORTCUT_KEY = "ishwe.qn.shortcut";
const NOTIF_KEY = "ishwe.qn.notifications";

export default function SettingsTab({ token, onUnauthorized }: Props) {
  return (
    <div>
      <ShortcutSection />
      <NotificationSection />
      <SchedulesSection token={token} onUnauthorized={onUnauthorized} />
    </div>
  );
}

function ShortcutSection() {
  const [shortcut, setShortcut] = useState(() => {
    if (typeof window === "undefined") return "Ctrl+Shift+N";
    return localStorage.getItem(SHORTCUT_KEY) || "Ctrl+Shift+N";
  });
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!recording) return;
    const handler = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");
      if (e.metaKey) parts.push("Super");
      let key = e.key;
      if (key === " ") key = "Space";
      if (
        key === "Control" ||
        key === "Shift" ||
        key === "Alt" ||
        key === "Meta"
      )
        return;
      if (key.length === 1) key = key.toUpperCase();
      parts.push(key);
      if (parts.length < 2) return;
      const combo = parts.join("+");
      setRecording(false);
      setMessage("保存中…");
      try {
        const msg = await invoke<string>("register_shortcut", {
          combination: combo,
        });
        localStorage.setItem(SHORTCUT_KEY, combo);
        setShortcut(combo);
        setMessage(msg);
      } catch (err: any) {
        setMessage(err?.message || "保存失败");
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording]);

  return (
    <div className="task-card">
      <div className="task-card-header">
        <span style={{ color: "var(--neon-blue)" }}>⌨️ 全局快捷键</span>
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        按下后立即唤起 / 隐藏桌面窗
      </p>
      <div
        className="text-center py-3 rounded-lg mb-2"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: `1px solid ${recording ? "var(--neon-purple)" : "var(--border-medium)"}`,
          fontFamily: "ui-monospace, monospace",
          fontSize: 14,
          color: recording ? "var(--neon-purple)" : "var(--text-primary)",
        }}
      >
        {recording ? "请按下新组合键…" : shortcut}
      </div>
      <div className="btn-row">
        <button
          className="btn btn-secondary"
          onClick={() => {
            setRecording(true);
            setMessage("");
          }}
          disabled={recording}
        >
          {recording ? "录制中…" : "修改快捷键"}
        </button>
      </div>
      {message && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

function NotificationSection() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(NOTIF_KEY) !== "false";
  });
  const [message, setMessage] = useState("");

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(NOTIF_KEY, String(next));
  };

  const test = async () => {
    setMessage("发送中…");
    try {
      const ok = await invoke<boolean>("send_notification", {
        title: "ISHWE QuickNote",
        body: "通知测试成功！推送配置生效。",
      });
      setMessage(ok ? "✓ 通知已发送" : "✗ 平台拒绝（检查权限）");
    } catch (err: any) {
      setMessage("✗ " + (err?.message || "发送失败"));
    }
  };

  return (
    <div className="task-card">
      <div className="task-card-header">
        <span style={{ color: "var(--neon-blue)" }}>🔔 系统通知</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">启用推送通知</span>
        <button
          onClick={toggle}
          className="px-3 py-1 rounded-lg text-xs"
          style={{
            backgroundColor: enabled
              ? "var(--neon-blue)"
              : "var(--bg-card-hover)",
            color: enabled ? "var(--bg-primary)" : "var(--text-muted)",
            border: "1px solid var(--border-medium)",
          }}
        >
          {enabled ? "开" : "关"}
        </button>
      </div>
      <button className="btn btn-secondary" onClick={test}>
        发送测试通知
      </button>
      {message && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

function SchedulesSection({ token, onUnauthorized }: Props) {
  const [items, setItems] = useState<Schedule[]>([]);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const reload = async () => {
    try {
      const res = await api<Schedule[]>("/api/schedules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res || []);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "加载失败");
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (sid: number) => {
    if (!confirm("确定删除该定时推送？")) return;
    try {
      await api(`/api/schedules/${sid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await reload();
    } catch (e: any) {
      setError(e?.message || "删除失败");
    }
  };

  return (
    <div className="task-card">
      <div className="task-card-header">
        <span style={{ color: "var(--neon-blue)" }}>⏰ 定时推送（Cron）</span>
      </div>
      {error && <div className="toast toast-error">{error}</div>}
      {items.length === 0 && !creating && (
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          还没有定时推送。新建一个用 AI 生成或手动填 cron 表达式。
        </p>
      )}
      {items.map((s) => (
        <div
          key={s.id}
          className="mb-2 p-2 rounded-lg"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-medium)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-sm font-mono"
                style={{ color: "var(--neon-blue)" }}
              >
                {s.cron_expression}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {s.label || s.push_type} → {s.address}
                {s.next_fire_at &&
                  ` · 下次 ${new Date(s.next_fire_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                className="text-xs px-2 py-1 rounded"
                onClick={() => setEditing(s)}
                style={{ color: "var(--text-muted)" }}
              >
                编辑
              </button>
              <button
                className="text-xs px-2 py-1 rounded"
                onClick={() => handleDelete(s.id)}
                style={{ color: "var(--danger)" }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        className="btn btn-primary mt-2"
        onClick={() => {
          setEditing(null);
          setCreating(true);
        }}
        style={{ backgroundColor: "var(--neon-purple)" }}
      >
        + 新建定时推送
      </button>

      {(creating || editing) && (
        <ScheduleEditor
          token={token}
          schedule={editing}
          onUnauthorized={onUnauthorized}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

interface EditorProps {
  token: string;
  schedule: Schedule | null;
  onUnauthorized: () => void;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function ScheduleEditor({
  token,
  schedule,
  onUnauthorized,
  onClose,
  onSaved,
}: EditorProps) {
  const [cronExpr, setCronExpr] = useState(schedule?.cron_expression || "");
  const [pushType, setPushType] = useState(schedule?.push_type || "email");
  const [address, setAddress] = useState(schedule?.address || "");
  const [label, setLabel] = useState(schedule?.label || "");
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [candidates, setCandidates] = useState<CronCandidate[]>([]);
  const [reasoning, setReasoning] = useState("");

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      if (schedule) {
        await api(`/api/schedules/${schedule.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: {
            cron_expression: cronExpr,
            push_type: pushType,
            address,
            label,
            enabled,
          },
        });
      } else {
        await api("/api/schedules", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: {
            cron_expression: cronExpr,
            push_type: pushType,
            address,
            label,
            enabled,
          },
        });
      }
      await onSaved();
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError("请输入自然语言描述");
      return;
    }
    setBusy(true);
    setError("");
    setCandidates([]);
    setReasoning("");
    try {
      const res = await api<{
        candidates: CronCandidate[];
        reasoning: string;
      }>("/api/cron/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: { description: aiPrompt },
      });
      setCandidates(res.candidates || []);
      setReasoning(res.reasoning || "");
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "AI 生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-3 p-3 rounded-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--neon-purple)",
      }}
    >
      <p className="text-xs mb-2" style={{ color: "var(--neon-purple)" }}>
        {schedule ? "编辑定时推送" : "新建定时推送"}
      </p>

      <label className="text-xs" style={{ color: "var(--text-muted)" }}>
        标签
      </label>
      <input
        className="input"
        placeholder="如：每日工作总结"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />

      <label className="text-xs" style={{ color: "var(--text-muted)" }}>
        Cron 表达式
      </label>
      <input
        className="input"
        placeholder="0 9 * * 1-5"
        value={cronExpr}
        onChange={(e) => setCronExpr(e.target.value)}
        style={{ fontFamily: "ui-monospace, monospace" }}
      />

      <div
        className="p-2 rounded-lg mb-2"
        style={{
          backgroundColor: "var(--bg-card-hover)",
          border: "1px dashed var(--neon-purple)",
        }}
      >
        <p className="text-xs mb-1" style={{ color: "var(--neon-purple)" }}>
          ✨ 用自然语言生成
        </p>
        <input
          className="input"
          placeholder="如：每个工作日早上 9 点"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
        <div className="btn-row mt-1">
          <button
            className="btn btn-secondary"
            onClick={handleAiGenerate}
            disabled={busy}
            style={{ padding: 6, fontSize: 12 }}
          >
            {busy ? "生成中…" : "AI 生成"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleAiGenerate}
            disabled={busy}
            style={{ padding: 6, fontSize: 12 }}
            title="同一描述重新生成候选"
          >
            重新生成
          </button>
        </div>
        {candidates.length > 0 && (
          <div className="mt-2">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              {reasoning || "候选："}（点选填入表达式）
            </p>
            {candidates.map((c, i) => (
              <button
                key={i}
                className="block w-full text-left p-2 rounded mb-1 text-xs"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-medium)",
                }}
                onClick={() => setCronExpr(c.cron)}
              >
                <span
                  style={{
                    color: "var(--neon-blue)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {c.cron}
                </span>
                <span
                  style={{ color: "var(--text-secondary)", marginLeft: 8 }}
                >
                  {c.human_readable}
                </span>
                {c.next_runs[0] && (
                  <span
                    style={{ color: "var(--text-muted)", marginLeft: 8 }}
                  >
                    · 下次 {new Date(c.next_runs[0]).toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="text-xs" style={{ color: "var(--text-muted)" }}>
        推送类型
      </label>
      <select
        className="input"
        value={pushType}
        onChange={(e) => setPushType(e.target.value)}
      >
        <option value="email">Email</option>
        <option value="webhook">Webhook</option>
        <option value="desktop">Desktop 通知</option>
      </select>

      <label className="text-xs" style={{ color: "var(--text-muted)" }}>
        {pushType === "email"
          ? "邮箱地址"
          : pushType === "webhook"
            ? "Webhook URL"
            : "占位（self）"}
      </label>
      <input
        className="input"
        placeholder={
          pushType === "email"
            ? "you@example.com"
            : pushType === "webhook"
              ? "https://..."
              : "self"
        }
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        disabled={pushType === "desktop"}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        启用
      </label>

      {error && <div className="toast toast-error">{error}</div>}

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
