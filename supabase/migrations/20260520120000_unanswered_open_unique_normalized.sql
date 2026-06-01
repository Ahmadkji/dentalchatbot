-- Prevent duplicate OPEN unanswered questions per clinic, ignoring case/extra spacing.
-- 1) Clean up existing duplicates so index creation succeeds.
-- 2) Enforce uniqueness at DB level to close race conditions across API paths.

with ranked_open as (
  select
    id,
    row_number() over (
      partition by clinic_id, lower(btrim(question))
      order by created_at asc, id asc
    ) as rn
  from public.unanswered_questions
  where status = 'open'
)
update public.unanswered_questions uq
set
  status = 'ignored',
  answer = coalesce(nullif(uq.answer, ''), 'Auto-deduplicated duplicate open unanswered question'),
  updated_at = now()
from ranked_open ro
where uq.id = ro.id
  and ro.rn > 1;

create unique index if not exists idx_unanswered_open_clinic_question_unique
  on public.unanswered_questions (clinic_id, lower(btrim(question)))
  where status = 'open';
