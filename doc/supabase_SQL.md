## create configs and issues tables
```sql
-- 创建 configs 表 (不需要修改，因为每条配置本身就包含了 owner/repo 信息)
create table configs (
  id bigint primary key generated always as identity,
  owner text not null,
  repo text not null,
  token text not null,
  issues_per_page integer not null default 10,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 修改 issues 表，添加 owner 和 repo 字段
create table issues (
  id bigint primary key generated always as identity,
  owner text not null,
  repo text not null,
  issue_number integer not null,
  title text not null,
  body text,
  state text not null,
  labels text[] default '{}',
  github_created_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- 添加复合唯一约束，确保每个仓库的 issue_number 唯一
  constraint issues_owner_repo_issue_number_key unique(owner, repo, issue_number)
);

-- 修改 labels 表，添加 owner 和 repo 字段
create table labels (
  id bigint primary key generated always as identity,
  owner text not null,
  repo text not null,
  name text not null,
  color text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- 添加复合唯一约束，确保每个仓库的标签名唯一
  unique(owner, repo, name)
);

-- 创建更新时间触发器函数
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 为每个表添加更新时间触发器
create trigger update_configs_updated_at
  before update on configs
  for each row
  execute function update_updated_at_column();

create trigger update_issues_updated_at
  before update on issues
  for each row
  execute function update_updated_at_column();

create trigger update_labels_updated_at
  before update on labels
  for each row
  execute function update_updated_at_column();

-- 修改索引以包含 owner 和 repo
create index idx_issues_owner_repo_created on issues(owner, repo, github_created_at desc);
create index idx_issues_labels on issues using gin(labels);
create index idx_labels_owner_repo_name on labels(owner, repo, name);

-- 添加唯一约束
ALTER TABLE issues
ADD CONSTRAINT unique_owner_repo_issue_number UNIQUE (owner, repo, issue_number);

-- 启用 RLS
alter table issues enable row level security;

-- 添加 RLS 策略
create policy "Enable read access for all users" on issues
  for select
  using (true);

create policy "Enable insert access for authenticated users" on issues
  for insert
  with check (true);

create policy "Enable update access for authenticated users" on issues
  for update
  using (true)
  with check (true);
```

```sql
-- 为 configs 表添加 password 字段
ALTER TABLE configs
ADD COLUMN IF NOT EXISTS password TEXT;

-- 为了安全起见，我们还应该添加一些约束
COMMENT ON COLUMN configs.password IS '用户设置的密码';
```
## sync history table
```sql
-- 创建 sync_history 表
create table sync_history (
  id bigint primary key generated always as identity,
  owner text not null,
  repo text not null,
  last_sync_at timestamp with time zone default timezone('utc'::text, now()) not null,
  issues_synced integer not null default 0,
  status text not null check (status in ('success', 'failed')),
  sync_type text not null check (sync_type in ('webhook', 'full')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 添加更新时间触发器
create trigger update_sync_history_updated_at
  before update on sync_history
  for each row
  execute function update_updated_at_column();

-- 创建索引
create index idx_sync_history_owner_repo on sync_history(owner, repo);
create index idx_sync_history_last_sync on sync_history(owner, repo, last_sync_at desc);

-- 添加外键约束（可选如果你想确保只有存在的仓库配置才能有同步记录）
alter table sync_history
  add constraint fk_sync_history_config
  foreign key (owner, repo)
  references configs(owner, repo)
  on delete cascade;

-- 启用 RLS
alter table sync_history enable row level security;

-- 添加 RLS 策略（与其他表保持一致）
create policy "Enable all operations for all users" on sync_history
  for all
  using (true)
  with check (true);
```

```sql
-- 1. 先给 configs 表添加复合唯一约束
alter table configs
  add constraint unique_configs_owner_repo
  unique(owner, repo);

-- 2. 创建 sync_history 表
create table sync_history (
  id bigint primary key generated always as identity,
  owner text not null,
  repo text not null,
  last_sync_at timestamp with time zone default timezone('utc'::text, now()) not null,
  issues_synced integer not null default 0,
  status text not null check (status in ('success', 'failed')),
  sync_type text not null check (sync_type in ('webhook', 'full')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- 添加外键约束
  constraint fk_sync_history_config
    foreign key (owner, repo)
    references configs(owner, repo)
    on delete cascade
);

-- 3. 添加更新时间触发器
create trigger update_sync_history_updated_at
  before update on sync_history
  for each row
  execute function update_updated_at_column();

-- 4. 创建索引
create index idx_sync_history_owner_repo on sync_history(owner, repo);
create index idx_sync_history_last_sync on sync_history(owner, repo, last_sync_at desc);

-- 5. 启用 RLS
alter table sync_history enable row level security;

-- 6. 添加 RLS 策略
create policy "Enable all operations for all users" on sync_history
  for all
  using (true)
  with check (true);
```

```sql
-- 1. 备份现有数据
CREATE TEMP TABLE configs_backup AS 
SELECT * FROM configs;

CREATE TEMP TABLE sync_history_backup AS 
SELECT * FROM sync_history;

-- 2. 删除相关表（注意顺序）
DROP TABLE IF EXISTS sync_history;
DROP TABLE IF EXISTS configs;

-- 3. 创建新的 configs 表
CREATE TABLE configs (
    id SERIAL PRIMARY KEY,
    owner VARCHAR(255) NOT NULL,
    repo VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    issues_per_page INTEGER NOT NULL DEFAULT 10,
    is_logged_in BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. 重新创建 sync_history 表
CREATE TABLE sync_history (
    id SERIAL PRIMARY KEY,
    owner VARCHAR(255) NOT NULL,
    repo VARCHAR(255) NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL,
    issues_synced INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'failed')),
    sync_type VARCHAR(10) NOT NULL CHECK (sync_type IN ('webhook', 'full')),
    error_message TEXT,
    config_id INTEGER REFERENCES configs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. 恢复 configs 数据
INSERT INTO configs (
    owner, 
    repo, 
    token, 
    issues_per_page,
    is_logged_in,
    created_at,
    updated_at
)
SELECT 
    owner, 
    repo, 
    token, 
    issues_per_page,
    false, -- 默认设置为未登录状态
    created_at,
    CURRENT_TIMESTAMP
FROM configs_backup;

-- 6. 恢复 sync_history 数据
INSERT INTO sync_history (
    owner,
    repo,
    last_sync_at,
    issues_synced,
    status,
    sync_type,
    error_message,
    config_id,
    created_at
)
SELECT 
    sh.owner,
    sh.repo,
    sh.last_sync_at,
    sh.issues_synced,
    sh.status,
    sh.sync_type,
    sh.error_message,
    c.id,
    sh.created_at
FROM sync_history_backup sh
CROSS JOIN configs c; -- 因为我们确保只有一条配置记录

-- 7. 删除临时表
DROP TABLE IF EXISTS sync_history_backup;
DROP TABLE IF EXISTS configs_backup;

-- 8. 添加唯一约束（确保只有一条配置记录）
CREATE UNIQUE INDEX idx_single_config ON configs ((true));
```

```sql
-- 为 issues 表添加 upsert 触发器
create or replace function handle_issues_upsert()
returns trigger as $$
begin
    -- 如果是插入操作，设置 created_at 和 updated_at
    if TG_OP = 'INSERT' then
        new.created_at = current_timestamp;
        new.updated_at = current_timestamp;
    -- 如果是更新操作，只更新 updated_at
    elsif TG_OP = 'UPDATE' then
        -- 保持原有的 created_at
        new.created_at = old.created_at;
        new.updated_at = current_timestamp;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger handle_issues_timestamps
    before insert or update on issues
    for each row
    execute function handle_issues_upsert();
```

```sql
-- 检查当前约束
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'issues'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 修复 issues 表的约束
BEGIN;

-- 1. 先备份数据（以防万一）
CREATE TEMP TABLE issues_backup AS SELECT * FROM issues;

-- 2. 删除现有的约束
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_pkey CASCADE;
ALTER TABLE issues DROP CONSTRAINT IF EXISTS unique_owner_repo_issue_number CASCADE;
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_owner_repo_issue_number_key CASCADE;

-- 3. 重新添加主键约束（保留 id 列的 identity 属性）
ALTER TABLE issues
ADD CONSTRAINT issues_pkey PRIMARY KEY (id);

-- 4. 添加复合唯一约束
ALTER TABLE issues 
ADD CONSTRAINT unique_owner_repo_issue_number 
UNIQUE (owner, repo, issue_number);

-- 5. 确保索引存在
DROP INDEX IF EXISTS idx_issues_owner_repo_created;
CREATE INDEX idx_issues_owner_repo_created ON issues(owner, repo, github_created_at DESC);

DROP INDEX IF EXISTS idx_issues_labels;
CREATE INDEX idx_issues_labels ON issues USING gin(labels);

COMMIT;

-- 验证修改后的约束
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'issues'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 验证列的属性
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    identity_generation
FROM information_schema.columns 
WHERE table_name = 'issues'
ORDER BY ordinal_position;
```