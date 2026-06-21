// Badge shown when a venue is among the user's top 10 rated venues.
export default function TopVenueBadge() {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent whitespace-nowrap"
      title="One of your top 10 rated venues"
    >
      🏆 Top 10
    </span>
  )
}
