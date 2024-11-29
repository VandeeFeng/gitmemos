export interface Label {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  created_at: string;
  state: string;
  labels: Label[];
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  issuesPerPage: number;
}

// 用于编辑器的 Issue 类型，body 必须是 string
export interface EditableIssue extends Omit<Issue, 'body'> {
  body: string;
}

// 用于创建新 Issue 的类型
export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

// 用于更新 Issue 的类型
export interface UpdateIssueInput extends CreateIssueInput {
  number: number;
} 