import { debugLog, infoLog, warnLog, errorLog } from '@/lib/debug';
import { GitHubApiParams, Label as GitHubLabel } from '@/types/github';

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  created_at: string;
  state: string;
  labels: GitHubLabel[];
}

// Helper function to call our API
async function callGitHubAPI(endpoint: string, params: GitHubApiParams = {}) {
  // Get complete base URL
  const baseUrl = typeof window === 'undefined' 
    ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    : '';
  
  // Remove leading slash to avoid double slash issues
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${baseUrl}/api/github/${cleanEndpoint}`;
  
  debugLog('Calling GitHub API:', url, params);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to call GitHub API: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data;
}

// Issues API
export async function fetchIssues(
  owner: string, 
  repo: string, 
  page: number = 1, 
  labels?: string,
  forceSync: boolean = false,
  lastSyncAt?: string
) {
  try {
    const params = new URLSearchParams();
    
    // Add basic parameters
    params.append('owner', owner);
    params.append('repo', repo);
    params.append('page', page.toString());
    params.append('per_page', '50');
    params.append('state', 'all');
    params.append('sort', 'updated');
    params.append('direction', 'desc');

    // Add optional parameters
    if (labels) {
      params.append('labels', labels);
    }

    if (!forceSync && lastSyncAt && !labels) {
      try {
        // Ensure correct date format
        const date = new Date(lastSyncAt);
        if (!isNaN(date.getTime())) {
          params.append('since', date.toISOString());
          infoLog('Performing incremental sync since', date.toISOString());
        } else {
          warnLog('Invalid date format for lastSyncAt:', lastSyncAt);
        }
      } catch (error) {
        warnLog('Error parsing lastSyncAt date:', error);
      }
    } else {
      infoLog('Performing full sync');
    }

    const queryString = params.toString();
    debugLog('Fetching issues with params:', queryString);

    const data = await callGitHubAPI(`issues?${queryString}`, {}) as GitHubIssue[];

    return data.map(issue => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      created_at: issue.created_at,
      github_created_at: issue.created_at,
      state: issue.state,
      labels: issue.labels
        .filter((label): label is GitHubLabel => 
          typeof label === 'object' && label !== null)
        .map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description,
        })),
    }));
  } catch (error) {
    errorLog('Error in fetchIssues:', error);
    throw error;
  }
}

export async function fetchIssue(owner: string, repo: string, issueNumber: number) {
  const data = await callGitHubAPI('issues.get', {
    owner,
    repo,
    issue_number: issueNumber
  }) as GitHubIssue;

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is GitHubLabel => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }))
  };
}

export async function createGitHubIssue(owner: string, repo: string, title: string, body: string, labels: string[]) {
  const data = await callGitHubAPI('issues.create', {
    owner,
    repo,
    title,
    body,
    labels
  }) as GitHubIssue;

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is GitHubLabel => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }))
  };
}

export async function updateGitHubIssue(owner: string, repo: string, issueNumber: number, title: string, body: string, labels: string[]) {
  const data = await callGitHubAPI('issues.update', {
    owner,
    repo,
    issue_number: issueNumber,
    title,
    body,
    labels
  }) as GitHubIssue;

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is GitHubLabel => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }))
  };
}

// Labels API
export async function fetchLabels(owner: string, repo: string) {
  const data = await callGitHubAPI('issues.listLabelsForRepo', {
    owner,
    repo,
  }) as GitHubLabel[];
  
  return data.map(label => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
  }));
}

export async function createGitHubLabel(owner: string, repo: string, name: string, color: string, description?: string) {
  const data = await callGitHubAPI('issues.createLabel', {
    owner,
    repo,
    name,
    color: color.replace('#', ''),
    description
  }) as GitHubLabel;
  
  return {
    id: data.id,
    name: data.name,
    color: data.color,
    description: data.description,
  };
}

// Validation
export async function validateToken() {
  try {
    const response = await fetch('/api/github/token');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate token');
    }
    return true;
  } catch (error) {
    errorLog('Error validating token:', error);
    return false;
  }
} 