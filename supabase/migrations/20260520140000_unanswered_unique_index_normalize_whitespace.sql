-- Fix JS/DB normalization mismatch in unanswered dedupe unique index.
--
-- The JS normalizer collapses ALL internal whitespace via replace(/\s+/g, ' '),
-- but the old DB index used lower(btrim(question)) which only trims edges.
-- This mismatch meant questions with different internal spacing could slip
-- through JS dedupe but hit the DB 23505 constraint, or vice versa.
--
-- The new index expression lower(trim(regexp_replace(question, '\s+', ' ', 'g')))
-- matches the JS-side normalization exactly.

-- 1) Clean up any duplicates that may have been created due to the old index gap.
with ranked_open as (
  select
    id,
    row_number() over (
      partition by clinic_id, lower(trim(regexp_replace(question, '\s+', ' ', 'g')))
      order by created_at asc, id asc
    ) as rn
  from public.unanswered_questions
  where status = 'open'
)
update public.unanswered_questions uq
set
  status = 'ignored',
  answer = coalesce(nullif(uq.answer, ''), 'Auto-deduplicated due to whitespace normalization fix'),
  updated_at = now()
from ranked_open ro
where uq.id = ro.id
  and ro.rn > 1;

-- 2) Drop the old index (used btrim, no internal whitespace collapse).
drop index if exists idx_unanswered_open_clinic_question_unique;

-- 3) Create the corrected index with full whitespace normalization.
create unique index idx_unanswered_open_clinic_question_unique
  on public.unanswered_questions (
    clinic_id,
    lower(trim(regexp_replace(question, '\s+', ' ', 'g')))
  )
  where status = 'open';
