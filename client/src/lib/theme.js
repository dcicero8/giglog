import { useState } from 'react'

const STORAGE_KEY = 'giglog-theme'

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore storage failures (e.g. private mode)
  }
}

// Hook for a theme toggle. Reads the attribute set in index.html (no flash) as the source of truth.
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || getStoredTheme()
  )

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return { theme, toggle }
}
