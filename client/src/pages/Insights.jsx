import { useApi } from '../hooks/useApi'
import InsightsView from '../components/InsightsView'

export default function Insights() {
  const { data, loading } = useApi('/insights')

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-text mb-6">Stats &amp; Trends</h1>
      {loading ? (
        <div className="space-y-4">
          <div className="h-8 w-40 bg-bg-card rounded animate-pulse" />
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <InsightsView data={data} />
      )}
    </div>
  )
}
