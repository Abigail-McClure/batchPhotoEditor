-- TABLES

create table public.batches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  edit_settings jsonb not null default '{}'::jsonb
);

create table public.images (
  id                      uuid primary key default gen_random_uuid(),
  batch_id                uuid not null references public.batches(id) on delete cascade,
  original_url            text not null,
  edited_url              text,
  image_override_settings jsonb,
  status                  text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  created_at              timestamptz not null default now()
);

-- Indexes for worker polling (hot path)
create index idx_images_status   on public.images(status);
create index idx_images_batch_id on public.images(batch_id);

-- ROW LEVEL SECURITY

alter table public.batches enable row level security;
alter table public.images  enable row level security;

-- BATCHES
create policy "Users can insert their own batches"
  on public.batches for insert
  with check (auth.uid() = user_id);

create policy "Users can select their own batches"
  on public.batches for select
  using (auth.uid() = user_id);

create policy "Users can update their own batches"
  on public.batches for update
  using (auth.uid() = user_id);

-- Helper: count images in a batch without triggering RLS (avoids infinite recursion)
create or replace function count_batch_images(bid uuid)
returns bigint
language sql security definer stable as
$$
  select count(*) from public.images where batch_id = bid;
$$;

-- IMAGES: access via batch ownership + 25-image limit on insert
create policy "Users can insert images for their batches"
  on public.images for insert
  with check (
    exists (
      select 1 from public.batches
      where id = batch_id and user_id = auth.uid()
    )
    and count_batch_images(batch_id) < 25
  );

create policy "Users can select images for their batches"
  on public.images for select
  using (
    exists (
      select 1 from public.batches
      where id = batch_id and user_id = auth.uid()
    )
  );

create policy "Users can update images for their batches"
  on public.images for update
  using (
    exists (
      select 1 from public.batches
      where id = batch_id and user_id = auth.uid()
    )
  );


-- STORAGE BUCKETS
-- Run these or create buckets manually in dashboard

-- insert into storage.buckets (id, name, public) values ('originals', 'originals', true);
-- insert into storage.buckets (id, name, public) values ('edited', 'edited', true);

-- Storage RLS: users can upload to their own folder
-- create policy "Users upload own originals"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'originals'
--     and auth.uid()::text = (string_to_array(name, '/'))[1]
--   );
