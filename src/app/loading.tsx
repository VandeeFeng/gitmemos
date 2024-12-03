import { Loading } from "@/components/ui/loading"
import { PageLayout } from "@/components/layouts/page-layout"

interface Props {
  text?: string;
}

export default function GlobalLoadingPage({ text = "Loading..." }: Props) {
  return (
    <PageLayout showSearchAndNew={false}>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <Loading size="lg" text={text} />
      </div>
    </PageLayout>
  )
} 