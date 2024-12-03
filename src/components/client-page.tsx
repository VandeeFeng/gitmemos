'use client';

import { IssueListContainer } from './issue-list-container';
import { useIssues } from '@/lib/contexts/issue-context';
import { Loading } from './ui/loading';

export function ClientPage() {
  const { issues, config, loading } = useIssues();

  if (loading) {
    return <Loading />;
  }
  
  return (
    <IssueListContainer 
      initialIssues={issues}
      initialConfig={config!}
    />
  );
} 