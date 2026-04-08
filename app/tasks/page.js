'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTasks, createTask, updateTask, deleteTask } from '@/app/actions/tasks'
import { Icon } from '@/components/Icons'

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400', dot: 'bg-amber-500' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/25', text: 'text-green-400', dot: 'bg-green-500' },
}

function getDueStatus(due_date) {
  if (!due_date) return null
  const now = new Date()
  const due = new Date(due_date)
  const diffMs = due - now
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffMs < 0) return { label: 'Overdue', color: 'text-red-400', urgent: true }
  if (diffHours < 1) return { label: 'Due in < 1 hr', color: 'text-red-400', urgent: true }
  if (diffHours < 24) return { label: `Due in ${Math.ceil(diffHours)}h`, color: 'text-amber-400', urgent: true }
  const diffDays = Math.ceil(diffHours / 24)
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, color: 'text-amber-400', urgent: false }
  return { label: due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), color: 'text-neutral-500', urgent: false }
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
      if (result.success) setTasks(result.tasks)
      setLoading(false)
    }
    load()
  }, [])

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
            new Notification('Task Due Soon — Study with Aguila', {
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
    if (result.success) setTasks(prev => prev.map(t => t.id === task.id ? result.task : t))
  }

  const handleDelete = async (taskId) => {
    const result = await deleteTask(taskId)
    if (result.success) setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const filtered = tasks.filter(t => filter === 'active' ? !t.is_completed : t.is_completed)
  const overdueCount = tasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < new Date()).length

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      {Icon.spinner('w-6 h-6 text-indigo-400')}
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="h-14 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 flex items-center px-4 gap-3 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
          {Icon.history('w-4 h-4')}
          <span className="text-sm">Back</span>
        </Link>
        <span className="text-neutral-700">|</span>
        <div className="flex items-center gap-2 flex-1">
          {Icon.quiz('w-4 h-4 text-neutral-400')}
          <span className="text-sm font-semibold text-white">My Tasks</span>
          {overdueCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{overdueCount} overdue</span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${
            showForm ? 'bg-neutral-700 text-white border-neutral-600' : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700'
          }`}>
          {showForm ? <>{Icon.x('w-3.5 h-3.5')} Cancel</> : <>{Icon.plus('w-3.5 h-3.5')} Add task</>}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Add task form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">New task</h3>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Task title" required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject (optional)"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)" rows={2}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Due date</label>
                <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={!form.title.trim() || saving}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {saving ? <>{Icon.spinner('w-4 h-4')} Saving...</> : 'Save task'}
            </button>
          </form>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: tasks.length, color: 'text-white' },
            { label: 'Active', value: tasks.filter(t => !t.is_completed).length, color: 'text-indigo-400' },
            { label: 'Done', value: tasks.filter(t => t.is_completed).length, color: 'text-green-400' },
          ].map((s, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-neutral-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          {['active', 'completed'].map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-all ${
                filter === tab ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'
              }`}>
              {tab} ({tab === 'active' ? tasks.filter(t => !t.is_completed).length : tasks.filter(t => t.is_completed).length})
            </button>
          ))}
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="text-center py-14 space-y-3">
            {Icon.quiz('w-8 h-8 mx-auto text-neutral-700')}
            <p className="text-neutral-600 text-sm">
              {filter === 'active' ? 'No active tasks. Add one above.' : 'No completed tasks yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(task => {
              const dueStatus = getDueStatus(task.due_date)
              const p = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium
              return (
                <div key={task.id}
                  className={`group bg-neutral-900 border rounded-2xl p-4 transition-all ${
                    task.is_completed ? 'border-neutral-800 opacity-60' : dueStatus?.urgent ? 'border-red-500/30' : 'border-neutral-800 hover:border-neutral-700'
                  }`}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => handleToggle(task)}
                      className={`flex-shrink-0 w-5 h-5 rounded-md border-2 mt-0.5 flex items-center justify-center transition-all ${
                        task.is_completed ? 'bg-green-600 border-green-600' : 'border-neutral-600 hover:border-indigo-500'
                      }`}>
                      {task.is_completed && Icon.check('w-3 h-3 text-white')}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${task.is_completed ? 'line-through text-neutral-500' : 'text-white'}`}>
                          {task.title}
                        </p>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${p.bg} ${p.text} border ${p.border}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`}/>
                          {task.priority}
                        </div>
                      </div>

                      {task.subject && (
                        <p className="text-xs text-indigo-400 mt-0.5">{task.subject}</p>
                      )}
                      {task.description && (
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        {dueStatus && (
                          <span className={`text-xs font-medium ${dueStatus.color}`}>
                            {dueStatus.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <button onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
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