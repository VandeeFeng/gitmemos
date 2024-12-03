import { Suspense } from 'react';
import { ClientPage } from '@/components/client-page';

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
