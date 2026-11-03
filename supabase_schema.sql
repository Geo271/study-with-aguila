-- ==============================================================================
-- Study with Aguila - Complete Supabase Database Schema
-- ==============================================================================

-- 1. Enable pgvector extension for AI embeddings
create extension if not exists vector with schema public;

-- 2. Study Sessions Table
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New Session',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Documents Table (PDFs, DOCX, OCR Scans)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  subject text default 'General',
  created_at timestamptz not null default now()
);

-- 4. Session Documents Link Table
create table if not exists public.session_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.study_sessions(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade not null
);

-- 5. Document Chunks (Vector Store for Gemini 768-dim embeddings)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  content text not null,
  chunk_index integer not null,
  embedding vector(768)
);

create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);

-- 6. Chat Messages Table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.study_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);

-- 7. Quizzes Table
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete set null,
  session_id uuid references public.study_sessions(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

-- 8. Questions Table
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  question text not null,
  type text default 'multiple_choice',
  choices jsonb,
  answer text not null,
  explanation text default ''
);

create index if not exists idx_questions_quiz_id on public.questions(quiz_id);

-- 9. Quiz Results Table
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  score integer not null,
  total integer not null,
  quiz_title text default 'Quiz',
  completed_at timestamptz not null default now()
);

create index if not exists idx_quiz_results_quiz_id on public.quiz_results(quiz_id);
create index if not exists idx_quiz_results_user_id on public.quiz_results(user_id);

-- 10. Quiz Wrong Answers (Analytics & Weak Areas)
create table if not exists public.quiz_wrong_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade not null,
  question text not null,
  user_answer text,
  correct_answer text not null,
  created_at timestamptz not null default now()
);

-- 11. Pomodoro Sessions Table
create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  focus_minutes integer not null default 25,
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 12. Tasks Table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text default '',
  due_date timestamptz,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  subject text default '',
  is_completed boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

-- 13. Study Lounges Table (Multiplayer Study Rooms)
create table if not exists public.study_lounges (
  id uuid primary key default gen_random_uuid(),
  invite_code varchar(6) not null unique,
  host_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Study Lounge',
  created_at timestamptz not null default now()
);

create index if not exists idx_study_lounges_code on public.study_lounges(invite_code);

-- 14. User Agreements Table (EULA Acceptance)
create table if not exists public.user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  version text not null default '1.0',
  accepted_at timestamptz not null default now()
);

-- 15. Vector Match RPC Function for Document Q&A
create or replace function match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 16. Storage Bucket Setup
-- Ensure the storage bucket 'pdfs' exists:
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do nothing;
