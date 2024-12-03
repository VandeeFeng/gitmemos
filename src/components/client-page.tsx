'use client';

import { IssueListContainer } from './issue-list-container';
import { useIssues } from '@/lib/contexts/issue-context';
import { PageLayout } from './layouts/page-layout';
import { Loading } from './ui/loading';

export function ClientPage() {
  const { issues, config, loading } = useIssues();

  if (loading) {
    return (
      <PageLayout showSearchAndNew={false}>
        <Loading />
      </PageLayout>
    );
  }
  
  return (
    <IssueListContainer 
      initialIssues={issues}
      initialConfig={config!}
    />
  );
} 