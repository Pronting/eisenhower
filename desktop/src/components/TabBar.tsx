interface Tab {
  key: string;
  label: string;
  icon: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function TabBar({ tabs, active, onChange }: Props) {
  return (
    <div
      className="flex gap-1 mb-4 p-1 rounded-xl"
      style={{ backgroundColor: "var(--bg-card-hover)" }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor:
              active === t.key ? "var(--bg-primary)" : "transparent",
            color:
              active === t.key
                ? "var(--text-primary)"
                : "var(--text-muted)",
            border:
              active === t.key
                ? "1px solid var(--border-medium)"
                : "1px solid transparent",
          }}
        >
          <span style={{ marginRight: 4 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
