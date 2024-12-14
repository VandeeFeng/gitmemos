import { Footer } from '@/components/layouts/footer'

export default function TimelineLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      <Footer />
    </div>
  );
} 