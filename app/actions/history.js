'use server'

import { supabase } from '@/lib/supabase'

export async function getChatHistory(userId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      *,
      documents(file_name, subject, created_at)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }

  // Group messages by document
  const grouped = {}
  data.forEach(msg => {
    const docId = msg.document_id
    if (!grouped[docId]) {
      grouped[docId] = {
        documentId: docId,
        fileName: msg.documents?.file_name || 'Unknown',
        messages: [],
        lastActive: msg.created_at
      }
    }
    grouped[docId].messages.push({ role: msg.role, content: msg.content })
  })

  return { success: true, history: Object.values(grouped) }
}