import { useState } from "react";
import { api } from "../lib/api";

type Quadrant = "q1" | "q2" | "q3" | "q4";

interface AiTask {
  title: string;
  description: string;
  quadrant: Quadrant;
  reason: string;
}

interface Props {
  token: string;
  onUnauthorized: () => void;
}

const QUADRANTS: { key: Quadrant; label: string; color: string }[] = [
  { key: "q1", label: "重要紧急", color: "var(--q1)" },
  { key: "q2", label: "重要不紧急", color: "var(--q2)" },
  { key: "q3", label: "紧急不重要", color: "var(--q3)" },
  { key: "q4", label: "不重要不紧急", color: "var(--q4)" },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AiSplitTab({ token, onUnauthorized }: Props) {
  const [input, setInput] = useState("");
  const [tasks, setTasks] = useState<AiTask[] | null>(null);
  const [applyDate, setApplyDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSplit = async () => {
    if (!input.trim()) {
      setError("请输入小记内容");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ data: { tasks: AiTask[] } }>(
        "/api/notes/process",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: { content: input },
        },
      );
      setTasks(res.data.tasks || []);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "AI 拆分失败");
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof AiTask>(
    i: number,
    field: K,
    value: AiTask[K],
  ) => {
    setTasks((prev) =>
      (prev || []).map((t, idx) =>
        idx === i ? { ...t, [field]: value } : t,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!tasks || !tasks.length) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const date = applyDate || today();
      const res = await api<{ data: { created: number } }>(
        "/api/notes/confirm",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: {
            content: input,
            tasks: tasks.map((t) => ({ ...t, due_date: date })),
          },
        },
      );
      setSuccess(`已创建 ${res.data.created} 个任务`);
      setInput("");
      setTasks(null);
      setApplyDate(today());
      setTimeout(() => setSuccess(""), 2000);
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) {
        onUnauthorized();
        return;
      }
      setError(e?.message || "入库失败");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setTasks(null);
    setError("");
    setSuccess("");
  };

  return (
    <>
      {success && <div className="toast toast-success">{success}</div>}
      {error && <div className="toast toast-error">{error}</div>}

      {!tasks ? (
        <>
          <textarea
            className="input"
            placeholder="输入待办内容，如：上午买菜，下午阅读，晚上健身…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            disabled={busy}
            style={{ minHeight: 100 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSplit}
            disabled={busy}
            style={{ backgroundColor: "var(--neon-purple)" }}
          >
            {busy ? "分析中…" : "✨ 智能拆分"}
          </button>
          <p
            className="text-xs mt-3 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            AI 会自动识别任务并分配象限
          </p>
        </>
      ) : (
        <>
          {/* Shared apply-date — applies to ALL tasks in this batch */}
          <div
            className="task-card"
            style={{ borderColor: "var(--neon-purple)" }}
          >
            <div className="task-card-header">
              <span style={{ color: "var(--neon-purple)" }}>
                📅 应用日期（所有任务）
              </span>
            </div>
            <input
              type="date"
              className="input"
              value={applyDate}
              onChange={(e) => setApplyDate(e.target.value)}
            />
            <p
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              此日期会应用到下方全部 {tasks.length} 个任务
            </p>
          </div>

          {tasks.map((task, i) => (
            <div className="task-card" key={i}>
              <div className="task-card-header">
                <span>任务 {i + 1}</span>
                {tasks.length > 1 && (
                  <button
                    onClick={() =>
                      setTasks((prev) =>
                        (prev || []).filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    删除
                  </button>
                )}
              </div>
              <input
                className="input"
                placeholder="任务标题"
                value={task.title}
                onChange={(e) => update(i, "title", e.target.value)}
              />
              <textarea
                className="input"
                placeholder="描述（可选）"
                value={task.description}
                onChange={(e) => update(i, "description", e.target.value)}
                rows={1}
              />
              <div className="quadrant-grid">
                {QUADRANTS.map((q) => (
                  <button
                    key={q.key}
                    className="quadrant-btn"
                    data-active={task.quadrant === q.key}
                    onClick={() => update(i, "quadrant", q.key)}
                    style={
                      task.quadrant === q.key
                        ? { borderColor: q.color, color: q.color }
                        : undefined
                    }
                  >
                    <span>{q.label}</span>
                  </button>
                ))}
              </div>
              {task.reason && (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)", marginTop: -4 }}
                >
                  💡 {task.reason}
                </p>
              )}
            </div>
          ))}

          <div className="btn-row">
            <button className="btn btn-secondary" onClick={reset}>
              重新输入
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={busy}
            >
              {busy ? "提交中…" : "确认"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
