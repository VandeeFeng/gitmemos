'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IssueEditor } from '@/components/issue-editor';
import { Issue } from '@/types/github';
import { getIssue } from '@/lib/github';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';

function EditorContent() {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function fetchIssue() {
      const issueNumber = searchParams.get('edit');
      if (issueNumber) {
        try {
          const data = await getIssue(parseInt(issueNumber));
          setIssue(data);
        } catch (error) {
          console.error('Error fetching issue:', error);
          router.push('/');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
    fetchIssue();
  }, [searchParams, router]);

  const handleEditComplete = () => {
    router.push('/');
  };

  return (
    <PageLayout showFooter={false} showSearchAndNew={false}>
      {loading ? (
        <Loading />
      ) : (
        <div className={animations.fade.in}>
          <IssueEditor
            issue={issue ? { ...issue, body: issue.body || '' } : undefined}
            onSave={handleEditComplete}
            onCancel={() => router.push('/')}
          />
        </div>
      )}
    </PageLayout>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <PageLayout showFooter={false} showSearchAndNew={false}>
        <Loading />
      </PageLayout>
    }>
      <EditorContent />
    </Suspense>
  );
} 