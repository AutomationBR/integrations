create table if not exists shipments (
  id uuid primary key,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  input_json jsonb not null,
  result_json jsonb null,
  error text null
);

create table if not exists shipment_jobs (
  id uuid primary key,
  type text not null,
  correlation_id text null,
  status text not null,
  data_json jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz null,
  finished_at timestamptz null,
  attempts integer not null default 0,
  error text null,
  next_run_at timestamptz null,
  max_attempts integer not null default 3
);

create index if not exists idx_shipments_created_at on shipments (created_at desc);
create index if not exists idx_shipment_jobs_status_created_at on shipment_jobs (status, created_at asc);
