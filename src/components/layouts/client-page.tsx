'use client';

import { IssueListContainer } from '@/components/pages/issues/issue-list-container';
import { useIssues } from '@/lib/contexts/issue-context';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';

export function ClientPage() {
  const { issues, config, loading, syncIssues } = useIssues();

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
      onSync={syncIssues}
    />
  );
} 