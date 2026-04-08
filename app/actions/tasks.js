'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

export async function getTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) return { success: false, error: error.message }
  return { success: true, tasks: data }
}

export async function createTask(userId, { title, description, due_date, priority, subject }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ user_id: userId, title, description, due_date, priority: priority || 'medium', subject }])
    .select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, task: data }
}

export async function updateTask(taskId, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select().single()
  if (error) return { success: false, error: error.message }
  return { success: true, task: data }
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  return { success: !error, error: error?.message }
}

export async function markTaskNotified(taskId) {
  await supabase.from('tasks').update({ notified: true }).eq('id', taskId)
}

export async function checkEulaAccepted(userId) {
  const { data } = await supabase
    .from('user_agreements')
    .select('id')
    .eq('user_id', userId)
    .single()
  return { accepted: !!data }
}

export async function acceptEula(userId) {
  const { error } = await supabase
    .from('user_agreements')
    .upsert([{ user_id: userId, version: '1.0', accepted_at: new Date().toISOString() }])
  return { success: !error }
}