-- v5.1 onboarding: OnboardingExtras (lib/onboarding.ts) live beside the
-- CompanyProfile columns. Existing RLS on profiles already scopes each row to
-- its owner, so no policy change is needed.
-- Applied to the live project (zekhnneilcploogfudsp) on 2026-10-08.
alter table public.profiles
  add column if not exists onboarding jsonb not null default '{}'::jsonb;
