// Base configuration shared between client and server
export interface BaseGitHubConfig {
  owner: string;
  repo: string;
  issuesPerPage: number;
}

// Client-side configuration (no sensitive data)
// This interface intentionally extends BaseGitHubConfig without adding new fields
// to ensure type safety and make it clear that client-side config should not contain sensitive data
export type GitHubConfig = BaseGitHubConfig;

// Server-side configuration (includes sensitive data)
export interface ServerGitHubConfig extends BaseGitHubConfig {
  // Token can be accessed from environment variables or database on server
  token: string;
}

// Database configuration (matches Supabase schema)
export interface DbConfig {
  id?: number;
  owner: string;
  repo: string;
  issues_per_page: number;
  token: string;
  created_at?: string;
  updated_at?: string;
  password?: string;
}

// Helper functions for converting between types
export function toGitHubConfig(dbConfig: DbConfig | ServerGitHubConfig): GitHubConfig {
  if ('issuesPerPage' in dbConfig) {
    return {
      owner: dbConfig.owner,
      repo: dbConfig.repo,
      issuesPerPage: dbConfig.issuesPerPage
    };
  }
  return {
    owner: dbConfig.owner,
    repo: dbConfig.repo,
    issuesPerPage: dbConfig.issues_per_page
  };
}

export function toDbConfig(config: GitHubConfig | ServerGitHubConfig, token?: string): Omit<DbConfig, 'id' | 'created_at' | 'updated_at'> {
  return {
    owner: config.owner,
    repo: config.repo,
    issues_per_page: config.issuesPerPage,
    token: token || ''
  };
}
