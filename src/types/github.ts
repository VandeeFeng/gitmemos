import { BaseGitHubConfig, GitHubConfig, ServerGitHubConfig, DbConfig } from "./config";

// GitHub API Response type
export type GitHubApiResponse = {
  data: {
    number?: number;
    title?: string;
    body?: string;
    state?: string;
    labels?: Label[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// GitHub API Parameters type
export type GitHubApiParams = {
  owner?: string;
  repo?: string;
  issue_number?: number;
  title?: string;
  body?: string;
  labels?: string[];
  name?: string;
  color?: string;
  description?: string;
  page?: number;
  per_page?: string;
  state?: string;
  sort?: string;
  direction?: string;
  since?: string;
};

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
  github_created_at: string;
  state: string;
  labels: Label[];
}

export interface GitHubApiError {
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
  };
  message?: string;
}

// Issue type for editor, body must be string
export interface EditableIssue extends Omit<Issue, "body"> {
  body: string;
}

// Type for creating new Issue
export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

// Type for updating Issue
export interface UpdateIssueInput extends CreateIssueInput {
  number: number;
}

export type { BaseGitHubConfig, GitHubConfig, ServerGitHubConfig, DbConfig };
