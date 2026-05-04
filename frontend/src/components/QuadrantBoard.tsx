'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { useLang } from '@/i18n/LanguageContext'

interface Task {
  id: number
  title: string
  description: string
  quadrant: string
  status: string
  due_date?: string
  created_at: string
  ai_metadata: { reason?: string }
}

interface QuadrantConfig {
  labelKey: string
  descKey: string
  color: string
  glow: string
  icon: string
}

const QUADRANT_CONFIG: Record<string, QuadrantConfig> = {
  q1: {
    labelKey: 'quadrant.q1.label',
    descKey: 'quadrant.q1.desc',
    color: '#ef4444',
    glow: 'glow-q1',
    icon: '⚡',
  },
  q2: {
    labelKey: 'quadrant.q2.label',
    descKey: 'quadrant.q2.desc',
    color: '#f59e0b',
    glow: 'glow-q2',
    icon: '🎯',
  },
  q3: {
    labelKey: 'quadrant.q3.label',
    descKey: 'quadrant.q3.desc',
    color: '#3b82f6',
    glow: 'glow-q3',
    icon: '📤',
  },
  q4: {
    labelKey: 'quadrant.q4.label',
    descKey: 'quadrant.q4.desc',
    color: '#8b5cf6',
    glow: 'glow-q4',
    icon: '🗑',
  },
}

function todayStr(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

function dateAdd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function TaskCard({ task, isDragging, onDateChange }: {
  task: Task
  isDragging?: boolean
  onDateChange?: (id: number, date: string) => void
}) {
  const isCompleted = task.status === 'completed'
  const [showDatePicker, setShowDatePicker] = useState(false)
  const { t } = useLang()

  const datePresets = [
    { label: t['task.dueDate.today'], value: todayStr() },
    { label: t['task.dueDate.tomorrow'], value: dateAdd(1) },
    { label: t['task.dueDate.thisWeek'], value: dateAdd(7) },
    { label: t['task.dueDate.nextMonth'], value: dateAdd(30) },
    { label: t['task.dueDate.noDue'], value: '' },
  ]

  return (
    <div
      className={`group relative rounded-xl border p-3 transition-all duration-200 ${
        isDragging ? 'opacity-50' : ''
      } ${
        isCompleted
          ? 'opacity-50'
          : ''
      }`}
      style={{
        backgroundColor: isCompleted ? 'transparent' : 'var(--bg-card-hover)',
        borderColor: isCompleted ? 'var(--border-subtle)' : 'var(--border-medium)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <h4
            className={`text-sm font-medium truncate cursor-pointer hover:opacity-80 transition-opacity ${
              isCompleted ? 'line-through' : ''
            }`}
            style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}
            onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker) }}
          >
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {task.description}
            </p>
          )}
          {task.due_date ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker) }}
              className="inline-block text-xs mt-1.5 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              {task.due_date}
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker) }}
              className="inline-flex items-center gap-1 text-xs mt-1.5 px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity opacity-0 group-hover/item:opacity-60"
              style={{
                color: 'var(--text-muted)',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {t['task.editDate']}
            </button>
          )}
          {task.ai_metadata?.reason && (
            <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              {task.ai_metadata.reason}
            </p>
          )}
        </div>

        {/* Drag handle indicator */}
        <div
          className="drag-handle opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="8" cy="3" r="1.2" />
            <circle cx="4" cy="6" r="1.2" />
            <circle cx="8" cy="6" r="1.2" />
            <circle cx="4" cy="9" r="1.2" />
            <circle cx="8" cy="9" r="1.2" />
          </svg>
        </div>
      </div>

      {/* Date picker popover */}
      {showDatePicker && onDateChange && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 p-3 rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-medium)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1.5 mb-2">
            {datePresets.map((opt) => (
              <button
                key={opt.value || 'none'}
                type="button"
                onClick={() => {
                  onDateChange(task.id, opt.value)
                  setShowDatePicker(false)
                }}
                className="px-2 py-1 text-xs rounded-lg border transition-all duration-200 hover:opacity-80"
                style={{
                  backgroundColor: task.due_date === opt.value ? 'var(--border-medium)' : 'transparent',
                  borderColor: 'var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            defaultValue={task.due_date || ''}
            className="w-full px-2 py-1.5 text-xs rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              borderColor: 'var(--border-medium)',
              color: 'var(--text-primary)',
            }}
            onChange={(e) => {
              if (e.target.value) {
                onDateChange(task.id, e.target.value)
                setShowDatePicker(false)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

function DraggableTask({ task, onDelete, onStatusChange, onDateChange }: {
  task: Task
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: string) => void
  onDateChange?: (id: number, date: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : 'auto',
  } : undefined

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative group/item"
      style={style}
      {...listeners}
      {...attributes}
    >
      <TaskCard task={task} isDragging={isDragging} onDateChange={onDateChange} />
      {/* Complete toggle */}
      <button
        onClick={() => onStatusChange(task.id, task.status === 'completed' ? 'pending' : 'completed')}
        className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 w-5 h-5 rounded-full border-2 flex items-center justify-center"
        style={{
          borderColor: task.status === 'completed' ? '#22c55e' : 'var(--border-medium)',
          backgroundColor: task.status === 'completed' ? '#22c55e20' : 'transparent',
          color: task.status === 'completed' ? '#22c55e' : 'transparent',
        }}
      >
        {task.status === 'completed' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="absolute top-2 right-8 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 text-xs p-0.5"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M3 4L11 12M11 4L3 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </motion.div>
  )
}

function QuadrantDropZone({
  quadrant,
  tasks,
  onDelete,
  onStatusChange,
  onDateChange,
  isOver,
}: {
  quadrant: string
  tasks: Task[]
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: string) => void
  onDateChange?: (id: number, date: string) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: quadrant })
  const { t } = useLang()
  const cfg = QUADRANT_CONFIG[quadrant]

  return (
    <div
      ref={setNodeRef}
      className={`glass-sm p-4 flex flex-col w-full h-full transition-all duration-300 ${cfg.glow} ${
        isOver ? 'droppable-active' : ''
      }`}
    >
      {/* Quadrant header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.icon}</span>
          <div>
            <h3
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: cfg.color }}
            >
              {t[cfg.labelKey]}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t[cfg.descKey]}
            </p>
          </div>
        </div>
        <span
          className="text-xs font-bold font-mono px-2.5 py-1 rounded-full border"
          style={{
            color: cfg.color,
            borderColor: cfg.color + '33',
            backgroundColor: cfg.color + '10',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {tasks.length === 0 ? (
          <p
            className="text-xs text-center py-12 font-mono"
            style={{ color: 'var(--text-placeholder)' }}
          >
            {t['quadrant.empty']}
          </p>
        ) : (
          <AnimatePresence>
            {tasks.map(task => (
              <DraggableTask
                key={task.id}
                task={task}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onDateChange={onDateChange}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default function QuadrantBoard({
  tasks,
  onDelete,
  onStatusChange,
  onQuadrantChange,
  onDateChange,
}: {
  tasks: Task[]
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: string) => void
  onQuadrantChange: (id: number, quadrant: string) => void
  onDateChange?: (id: number, date: string) => void
}) {
  const quadrants = ['q1', 'q2', 'q3', 'q4']
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overQuadrant, setOverQuadrant] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(Number(event.active.id))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over
    if (over) {
      // Check if over a quadrant droppable
      if (quadrants.includes(over.id as string)) {
        setOverQuadrant(over.id as string)
      } else {
        // Could be over a task — find which quadrant it belongs to
        const task = tasks.find(t => t.id === Number(over.id))
        if (task) {
          setOverQuadrant(task.quadrant)
        }
      }
    }
  }, [quadrants, tasks])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverQuadrant(null)

    if (!over) return

    const taskId = Number(active.id)
    let targetQuadrant: string | null = null

    if (quadrants.includes(over.id as string)) {
      targetQuadrant = over.id as string
    } else {
      const overTask = tasks.find(t => t.id === Number(over.id))
      if (overTask) {
        targetQuadrant = overTask.quadrant
      }
    }

    if (targetQuadrant) {
      const task = tasks.find(t => t.id === taskId)
      if (task && task.quadrant !== targetQuadrant) {
        onQuadrantChange(taskId, targetQuadrant)
      }
    }
  }, [quadrants, tasks, onQuadrantChange])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-[55vh] sm:h-[60vh]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 h-full overflow-hidden" style={{ gridAutoRows: '1fr' }}>
        {quadrants.map((q, qi) => {
          const qTasks = tasks.filter(t => t.quadrant === q)
          return (
            <motion.div
              key={q}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: qi * 0.1 }}
              className="flex flex-col w-full min-h-0 h-full"
            >
              <QuadrantDropZone
                quadrant={q}
                tasks={qTasks}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onDateChange={onDateChange}
                isOver={overQuadrant === q}
              />
            </motion.div>
          )
        })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="drag-overlay rounded-xl" style={{ maxWidth: '300px' }}>
            <TaskCard task={activeTask} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
