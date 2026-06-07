import { useState } from "react";
import { api } from "../lib/api";

type Quadrant = "q1" | "q2" | "q3" | "q4";

interface TaskItem {
  title: string;
  description: string;
  quadrant: Quadrant;
  due_date: string;
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

const emptyTask = (): TaskItem => ({
  title: "",
  description: "",
  quadrant: "q2",
  due_date: "",
});

export default function QuickNoteForm({ token, onUnauthorized }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([emptyTask()]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const update = <K extends keyof TaskItem>(
    i: number,
    field: K,
    value: TaskItem[K],
  ) => {
    setTasks((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    );
  };

  const add = () => setTasks((p) => [...p, emptyTask()]);
  const remove = (i: number) =>
    setTasks((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const submit = async () => {
    const valid = tasks.filter((t) => t.title.trim());
    if (!valid.length) {
      setError("请至少输入一个任务标题");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api<{ data: { created: number } }>(
        "/api/notes/quick-add",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: {
            tasks: valid.map((t) => ({
              title: t.title,
              description: t.description || undefined,
              quadrant: t.quadrant,
              due_date: t.due_date || today(),
            })),
          },
        },
      );
      setSuccess(`已创建 ${res.data.created} 个任务`);
      setTasks([emptyTask()]);
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

  return (
    <>
      {success && <div className="toast toast-success">{success}</div>}
      {error && <div className="toast toast-error">{error}</div>}
      {tasks.map((task, i) => (
        <div className="task-card" key={i}>
          <div className="task-card-header">
            <span>任务 {i + 1}</span>
            {tasks.length > 1 && (
              <button onClick={() => remove(i)}>删除</button>
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
            rows={2}
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
          <input
            type="date"
            className="input"
            value={task.due_date}
            onChange={(e) => update(i, "due_date", e.target.value)}
          />
        </div>
      ))}
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={add}>
          + 添加任务
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "提交中…" : "确认"}
        </button>
      </div>
    </>
  );
}
