import { Octokit } from 'octokit';
import { getConfig } from '@/lib/supabase-client';

// Helper function to get Octokit instance
async function getOctokit() {
  const { token } = await getConfig() || {};
  if (!token) {
    throw new Error('GitHub token not configured');
  }
  return new Octokit({ auth: token });
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
  const octokit = await getOctokit();
  
  // Build request parameters
  const params: Parameters<typeof octokit.rest.issues.listForRepo>[0] = {
    owner,
    repo,
    state: 'all',
    per_page: 50,
    page,
    sort: 'updated',
    direction: 'desc',
    labels: labels || undefined
  };

  // Add since parameter for incremental sync
  if (!forceSync && lastSyncAt && !labels) {
    params.since = lastSyncAt;
    console.log('Performing incremental sync since', lastSyncAt);
  } else {
    console.log('Performing full sync');
  }

  const { data } = await octokit.rest.issues.listForRepo(params);

  return data.map(issue => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    created_at: issue.created_at,
    github_created_at: issue.created_at,
    state: issue.state,
    labels: issue.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
  }));
}

export async function fetchIssue(owner: string, repo: string, issueNumber: number) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
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
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
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
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    title,
    body,
    labels
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    github_created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
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
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.listLabelsForRepo({
    owner,
    repo,
  });
  
  return data.map(label => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description,
  }));
}

export async function createGitHubLabel(owner: string, repo: string, name: string, color: string, description?: string) {
  const octokit = await getOctokit();
  const { data } = await octokit.rest.issues.createLabel({
    owner,
    repo,
    name,
    color: color.replace('#', ''),
    description
  });
  
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
    const octokit = await getOctokit();
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch {
    return false;
  }
} 