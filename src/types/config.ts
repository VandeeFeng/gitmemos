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

// Database configuration (matches server-side structure)
export interface DbConfig {
  owner: string;
  repo: string;
  issues_per_page: number;
  // Token can be stored in database but should only be accessed server-side
  token: string;
}
