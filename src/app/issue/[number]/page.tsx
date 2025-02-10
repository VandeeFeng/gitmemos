import { Suspense } from 'react';
import { Metadata } from 'next';
import { getIssue } from '@/lib/github';
import { IssueDetail } from '@/components/pages/issues/issue-detail';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';

interface PageProps {
  params: Promise<{
    number: string;
  }>;
}

// Generate metadata for the issue page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const issue = await getIssue(parseInt(resolvedParams.number), false);
    const title = `${issue.title} #${issue.number}`;
    const description = issue.body ? issue.body.slice(0, 200) + '...' : 'No description provided';
    const labels = issue.labels.map(label => label.name).join(', ');

    return {
      title: title, // This will use the template from layout.tsx: `${title} - Git Memo`
      description: description,
      keywords: ['memo', 'github', 'issues', 'notes', ...labels.split(', ')],
      openGraph: {
        title: title,
        description: description,
        type: 'article',
        publishedTime: issue.created_at,
        tags: labels.split(', '),
      },
      twitter: {
        title: title,
        description: description,
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Issue Not Found',
      description: 'The requested issue could not be found.',
    };
  }
}

export default async function IssuePage({ params }: PageProps) {
  const resolvedParams = await params;
  const issueNumber = parseInt(resolvedParams.number);

  return (
    <Suspense fallback={
      <PageLayout showFooter={true} showSearchAndNew={false}>
        <Loading />
      </PageLayout>
    }>
      <IssueDetail issueNumber={issueNumber} />
    </Suspense>
  );
} 