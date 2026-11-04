'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTasks, createTask, updateTask, deleteTask } from '@/app/actions/tasks'
import { Icon } from '@/components/Icons'

const EagleLogo = ({ className = 'w-6 h-6' }) => (
  <img
    src="/logo.png"
    alt="Aguila"
    className={`${className} object-contain`}
    style={{ imageRendering: 'pixelated' }}
  />
)

const PRIORITY_CONFIG = {
  high: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', label: 'HIGH' },
  medium: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', label: 'MEDIUM' },
  low: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'LOW' },
}

function getDueStatus(dueDateStr) {
  if (!dueDateStr) return null
  const now = new Date()
  const due = new Date(dueDateStr)
  const diffMs = due - now
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffMs < 0) return { label: 'OVERDUE', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', urgent: true }
  if (diffHours < 1) return { label: 'DUE < 1H', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', urgent: true }
  if (diffHours < 24) return { label: `DUE IN ${Math.ceil(diffHours)}H`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', urgent: true }
  const diffDays = Math.ceil(diffHours / 24)
  if (diffDays <= 3) return { label: `DUE IN ${diffDays}D`, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20', urgent: false }
  return { label: due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), color: 'text-neutral-400 bg-neutral-900 border-neutral-800', urgent: false }
}

export default function Tasks() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('active')
  const [form, setForm] = useState({ title: '', description: '', due_date: '', priority: 'medium', subject: '' })
  const [saving, setSaving] = useState(false)
  const notifiedRef = useRef(new Set())
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      const result = await getTasks(session.user.id)
      if (result.success) setTasks(result.tasks || [])
      setLoading(false)
    }
    load()
  }, [router])

  // Browser notification check
  useEffect(() => {
    if (!tasks.length) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const check = setInterval(() => {
      tasks.forEach(task => {
        if (task.is_completed || !task.due_date || notifiedRef.current.has(task.id)) return
        const diffMs = new Date(task.due_date) - new Date()
        if (diffMs > 0 && diffMs < 60 * 60 * 1000) {
          if (Notification.permission === 'granted') {
            new Notification('Study with Aguila — Task Due Soon', {
              body: `"${task.title}" is due in less than 1 hour.`,
              icon: '/favicon.ico'
            })
          }
          notifiedRef.current.add(task.id)
        }
      })
    }, 60000)
    return () => clearInterval(check)
  }, [tasks])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const result = await createTask(user.id, {
      title: form.title,
      description: form.description,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      priority: form.priority,
      subject: form.subject,
    })
    if (result.success) {
      setTasks(prev => [result.task, ...prev])
      setForm({ title: '', description: '', due_date: '', priority: 'medium', subject: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const handleToggle = async (task) => {
    const result = await updateTask(task.id, { is_completed: !task.is_completed })
    if (result.success) {
      setTasks(prev => prev.map(t => t.id === task.id ? result.task : t))
    }
  }

  const handleDelete = async (taskId) => {
    const result = await deleteTask(taskId)
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }
  }

  const filtered = tasks.filter(t => filter === 'active' ? !t.is_completed : t.is_completed)
  const overdueCount = tasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < new Date()).length
  const completedCount = tasks.filter(t => t.is_completed).length
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3 text-neutral-400 font-mono text-xs">
      <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <span>Loading Study Tasks...</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-5 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
            <EagleLogo />
            <span className="text-sm font-bold text-white tracking-tight hidden sm:inline">Study with Aguila</span>
          </Link>
          <span className="text-neutral-700">|</span>
          <div className="flex items-center gap-2">
            {Icon.target('w-4 h-4 text-amber-400')}
            <span className="text-xs font-bold font-mono uppercase text-amber-300 tracking-wider">My Tasks</span>
            {overdueCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                {overdueCount} OVERDUE
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-mono px-3.5 py-1.5 rounded-xl border transition-all shadow-xs ${
              showForm
                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border-amber-500/40 font-bold'
            }`}
          >
            {showForm ? <>{Icon.x('w-3.5 h-3.5')} Cancel</> : <>{Icon.plus('w-3.5 h-3.5')} Add Task</>}
          </button>

          <Link
            href="/"
            className="text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-700/80 transition-all flex items-center gap-1.5 shadow-xs"
          >
            {Icon.history('w-3.5 h-3.5')}
            <span className="hidden sm:inline">Desk</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Academic Syllabus Progress Banner */}
        <div className="bg-neutral-900/90 border-2 border-neutral-800 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              Syllabus Completion
            </span>
            <span className="text-amber-400 font-bold tabular-nums">
              {completedCount} / {tasks.length} Done ({completionRate}%)
            </span>
          </div>
          <div className="w-full bg-neutral-950 h-2 rounded-full border border-neutral-800 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Task Form Drawer */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-neutral-900/95 border-2 border-neutral-800 rounded-2xl p-5 space-y-3.5 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.85)] animate-fade-in-up"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                {Icon.plus('w-3.5 h-3.5 text-amber-400')}
                <span>New Academic Task</span>
              </h3>
              <span className="text-[10px] text-neutral-500 font-mono">Synced to cloud</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 font-bold">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Read Chapters 4-6 & Review Pathophysiology Quiz"
                  required
                  autoFocus
                  className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none transition-colors shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 font-bold">
                    Subject / Course Tag
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. CS 141 or BIO 202"
                    className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-indigo-400 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none transition-colors shadow-inner font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 font-bold">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none transition-colors shadow-inner font-mono uppercase"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 font-bold">
                  Deadline Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-neutral-100 focus:outline-none transition-colors shadow-inner font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1 font-bold">
                  Notes / Syllabus Objectives (Optional)
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Key concepts to memorize, equations, or rubric requirements..."
                  rows={2}
                  className="w-full bg-neutral-950 border-2 border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none transition-colors shadow-inner resize-none font-sans"
                />
              </div>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="submit"
                disabled={!form.title.trim() || saving}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-mono font-bold rounded-xl disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                {saving ? (
                  <>
                    {Icon.spinner('w-3.5 h-3.5 text-amber-400')}
                    <span>Saving Task...</span>
                  </>
                ) : (
                  <>
                    {Icon.check('w-3.5 h-3.5 text-amber-400')}
                    <span>Create Task</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-1 gap-1 shadow-inner select-none font-mono text-xs">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'active'
                ? 'bg-neutral-800 text-amber-300 border border-neutral-700 shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <span>Active Tasks</span>
            <span className="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-[10px] tabular-nums">
              {tasks.filter(t => !t.is_completed).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              filter === 'completed'
                ? 'bg-neutral-800 text-emerald-300 border border-neutral-700 shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <span>Completed</span>
            <span className="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-[10px] tabular-nums">
              {completedCount}
            </span>
          </button>
        </div>

        {/* Task List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/40 border-2 border-neutral-800/80 rounded-2xl p-8 space-y-2.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Aguila"
                className="w-8 h-8 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {filter === 'active' ? 'No Active Tasks In Syllabus' : 'No Completed Tasks Yet'}
            </h3>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto">
              {filter === 'active'
                ? 'All clear for now! Add exam study goals or reading checkpoints.'
                : 'Tasks you complete will be archived here for review.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(task => {
              const dueStatus = getDueStatus(task.due_date)
              const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

              return (
                <div
                  key={task.id}
                  className={`group bg-neutral-900/90 border-2 rounded-2xl p-4 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)] ${
                    task.is_completed
                      ? 'border-neutral-800/80 opacity-60'
                      : dueStatus?.urgent
                        ? 'border-rose-500/40 hover:border-rose-500/60'
                        : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Retro Pixel Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(task)}
                      className={`flex-shrink-0 w-5 h-5 rounded-md border-2 mt-0.5 flex items-center justify-center transition-all shadow-xs ${
                        task.is_completed
                          ? 'bg-emerald-500 border-emerald-400 text-neutral-950 font-bold'
                          : 'bg-neutral-950 border-neutral-700 hover:border-amber-400'
                      }`}
                      title={task.is_completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.is_completed && Icon.check('w-3.5 h-3.5 stroke-[3]')}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                        <p
                          className={`text-sm font-medium leading-relaxed font-sans ${
                            task.is_completed ? 'line-through text-neutral-500' : 'text-neutral-100'
                          }`}
                        >
                          {task.title}
                        </p>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border font-bold uppercase ${p.bg} ${p.border} ${p.text}`}
                          >
                            {p.label}
                          </span>
                        </div>
                      </div>

                      {task.subject && (
                        <div className="inline-block text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 mb-1">
                          {task.subject}
                        </div>
                      )}

                      {task.description && (
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed font-sans">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
                        {dueStatus && (
                          <span
                            className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${dueStatus.color}`}
                          >
                            {Icon.timer('w-3 h-3')}
                            <span>{dueStatus.label}</span>
                          </span>
                        )}
                        <span className="text-neutral-600">
                          Added {new Date(task.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/30 flex-shrink-0"
                      title="Delete task"
                    >
                      {Icon.trash('w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
