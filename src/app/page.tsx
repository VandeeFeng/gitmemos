import { Suspense } from 'react';
import { ClientPage } from '@/components/layouts/client-page';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';

export default function Home() {
  return (
    <Suspense fallback={
      <PageLayout showSearchAndNew={false}>
        <Loading />
      </PageLayout>
    }>
      <ClientPage />
    </Suspense>
  );
}
