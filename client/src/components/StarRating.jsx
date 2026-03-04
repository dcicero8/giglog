import { useState } from 'react'

export default function StarRating({ rating = 0, onChange, readonly = false, size = 'md' }) {
  const [hover, setHover] = useState(0)

  const sizeClass = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'

  return (
    <div className={`flex gap-0.5 ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star === rating ? 0 : star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`${readonly ? '' : 'cursor-pointer'} transition-colors select-none ${
            star <= (hover || rating) ? 'text-accent' : 'text-text-dim'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}
