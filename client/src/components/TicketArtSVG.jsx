export default function TicketArtSVG({ svg, className = '' }) {
  if (!svg) return null

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ lineHeight: 0 }}
    />
  )
}
