# Supabase 初始化指南

本文档包含了所有必要的 Supabase SQL 初始化语句，按照正确的执行顺序排列。

## 1. 创建更新时间触发器函数

首先创建一个通用的更新时间触发器函数，用于自动更新表的 `updated_at` 字段：

```sql
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;
```

## 2. 创建核心表

### Configs 表

用于存储仓库配置信息：

```sql
create table configs (
    id serial primary key,
    owner varchar(255) not null,
    repo varchar(255) not null,
    token varchar(255) not null,
    issues_per_page integer not null default 10,
    is_logged_in boolean not null default false,
    last_login_at timestamp with time zone,
    username varchar(255),
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp
);

-- 添加唯一约束（确保只有一条配置记录）
create unique index idx_single_config on configs ((true));
```

### Issues 表

用于存储 GitHub Issues：

```sql
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
    created_at timestamp with time zone not null default current_timestamp,
    updated_at timestamp with time zone not null default current_timestamp,
    constraint unique_owner_repo_issue_number unique (owner, repo, issue_number)
);

-- 创建索引
create index idx_issues_owner_repo_created on issues(owner, repo, github_created_at desc);
create index idx_issues_labels on issues using gin(labels);
```

### Labels 表

用于存储 GitHub Labels：

```sql
create table labels (
    id bigint primary key generated always as identity,
    owner text not null,
    repo text not null,
    name text not null,
    color text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_owner_repo_name unique(owner, repo, name)
);

-- 创建索引
create index idx_labels_owner_repo_name on labels(owner, repo, name);
```

### Sync History 表

用于记录同步历史：

```sql
create table sync_history (
    id serial primary key,
    owner varchar(255) not null,
    repo varchar(255) not null,
    last_sync_at timestamp with time zone not null,
    issues_synced integer not null,
    status varchar(10) not null check (status in ('success', 'failed')),
    sync_type varchar(10) not null check (sync_type in ('webhook', 'full')),
    error_message text,
    config_id integer references configs(id) on delete cascade,
    created_at timestamp with time zone not null default current_timestamp
);

-- 创建索引
create index idx_sync_history_owner_repo on sync_history(owner, repo);
create index idx_sync_history_last_sync on sync_history(owner, repo, last_sync_at desc);
```

## 3. 添加触发器

为所有需要自动更新 `updated_at` 的表添加触发器：

```sql
-- Configs 表触发器
create trigger update_configs_updated_at
    before update on configs
    for each row
    execute function update_updated_at_column();

-- Labels 表触发器
create trigger update_labels_updated_at
    before update on labels
    for each row
    execute function update_updated_at_column();

-- Issues 表特殊触发器
create or replace function handle_issues_upsert()
returns trigger as $$
begin
    if TG_OP = 'INSERT' and NEW.created_at is null then
        if NEW.github_created_at is not null then
            NEW.created_at = NEW.github_created_at;
        else
            NEW.created_at = current_timestamp;
        end if;
    end if;
    NEW.updated_at = current_timestamp;
    return NEW;
end;
$$ language plpgsql;

create trigger handle_issues_timestamps
    before insert or update on issues
    for each row
    execute function handle_issues_upsert();
```

## 4. 设置行级安全策略（RLS）

为需要的表启用和配置 RLS：

```sql
-- Issues 表的 RLS
alter table issues enable row level security;

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

-- Sync History 表的 RLS
alter table sync_history enable row level security;

create policy "Enable all operations for all users" on sync_history
    for all
    using (true)
    with check (true);
```

## 5. 约束检查和维护

用于检查和维护数据库约束的 SQL 语句：

### 检查表约束

```sql
-- 检查指定表的所有约束
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'issues'  -- 可以替换为其他表名
ORDER BY tc.constraint_type, tc.constraint_name;
```

### 检查列属性

```sql
-- 检查指定表的列属性
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    identity_generation
FROM information_schema.columns 
WHERE table_name = 'issues'  -- 可以替换为其他表名
ORDER BY ordinal_position;
```

### 修复约束（如果需要）

如果需要修复或重建约束，可以使用以下模板：

```sql
BEGIN;

-- 1. 备份数据
CREATE TEMP TABLE table_backup AS SELECT * FROM target_table;

-- 2. 删除现有约束
ALTER TABLE target_table DROP CONSTRAINT IF EXISTS constraint_name CASCADE;

-- 3. 重新添加约束
ALTER TABLE target_table
ADD CONSTRAINT new_constraint_name CONSTRAINT_DEFINITION;

-- 4. 重建索引
DROP INDEX IF EXISTS index_name;
CREATE INDEX index_name ON target_table(column_name);

COMMIT;
```

例如，修复 issues 表的约束：

```sql
BEGIN;

-- 1. 备份数据
CREATE TEMP TABLE issues_backup AS SELECT * FROM issues;

-- 2. 删除现有约束
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_pkey CASCADE;
ALTER TABLE issues DROP CONSTRAINT IF EXISTS unique_owner_repo_issue_number CASCADE;
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_owner_repo_issue_number_key CASCADE;

-- 3. 重新添加主键约束
ALTER TABLE issues
ADD CONSTRAINT issues_pkey PRIMARY KEY (id);

-- 4. 添加复合唯一约束
ALTER TABLE issues 
ADD CONSTRAINT unique_owner_repo_issue_number 
UNIQUE (owner, repo, issue_number);

-- 5. 重建索引
DROP INDEX IF EXISTS idx_issues_owner_repo_created;
CREATE INDEX idx_issues_owner_repo_created ON issues(owner, repo, github_created_at DESC);

DROP INDEX IF EXISTS idx_issues_labels;
CREATE INDEX idx_issues_labels ON issues USING gin(labels);

COMMIT;
```

## 注意事项

1. 所有时间戳字段都使用带时区的时间戳类型（timestamp with time zone）
2. 主键都设置为自动递增
3. 适当的地方都添加了唯一约束和索引以提高查询性能
4. 使用行级安全策略（RLS）来控制数据访问
5. 所有表都包含 created_at 和 updated_at 字段，并通过触发器自动更新
6. 定期检查和维护数据库约束以确保数据完整性
