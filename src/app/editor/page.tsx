'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { IssueEditor } from '@/components/issue-editor';
import { Issue } from '@/types/github';
import { getIssue } from '@/lib/github';

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
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <Header />
      <main className="container mx-auto px-4 max-w-4xl pt-32 md:pt-40">
        {loading ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-secondary/50 border-t-secondary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <IssueEditor
              issue={issue ? { ...issue, body: issue.body || '' } : undefined}
              onSave={handleEditComplete}
              onCancel={() => router.push('/')}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
        <Header />
        <main className="container mx-auto px-4 max-w-4xl pt-32 md:pt-40">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-secondary/50 border-t-secondary rounded-full animate-spin"></div>
          </div>
        </main>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
} 