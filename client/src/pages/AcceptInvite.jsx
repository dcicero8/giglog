import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

export default function AcceptInvite() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, authRequired } = useAuth()
  const [status, setStatus] = useState('loading') // loading, needsLogin, accepting, success, error
  const [error, setError] = useState('')
  const [buddyName, setBuddyName] = useState('')

  useEffect(() => {
    if (authLoading) return

    // If auth is required but user isn't logged in, they need to log in first
    if (authRequired && !user) {
      setStatus('needsLogin')
      return
    }

    // Accept the invite
    setStatus('accepting')
    api.post(`/buddies/accept/${code}`)
      .then(result => {
        setBuddyName(result.buddy?.name || 'your new buddy')
        setStatus('success')
      })
      .catch(err => {
        setError(err.message)
        setStatus('error')
      })
  }, [code, user, authLoading, authRequired])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, #ff3c64 0%, transparent 70%)' }} />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-15"
        style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />

      <div className="relative z-10 text-center space-y-6 max-w-md mx-auto px-4">
        <h1 className="text-4xl font-bold font-heading text-accent">GigLog</h1>

        {status === 'loading' || status === 'accepting' ? (
          <p className="text-text-muted text-lg">Accepting invite...</p>
        ) : status === 'needsLogin' ? (
          <div className="space-y-4">
            <p className="text-text text-lg">You've been invited to be a Concert Buddy!</p>
            <p className="text-text-muted">Sign in to accept the invite and start sharing concert histories.</p>
            <a
              href={`/auth/google?returnTo=/invite/${code}`}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white text-gray-800 rounded-xl font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all no-underline"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </a>
          </div>
        ) : status === 'success' ? (
          <div className="space-y-4">
            <div className="text-5xl">🎉</div>
            <p className="text-text text-lg">You're now buddies with {buddyName}!</p>
            <p className="text-text-muted">You can now view each other's concert collections.</p>
            <Link
              to="/buddies"
              className="inline-block px-6 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-medium transition-colors no-underline"
            >
              View Buddies
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-red-400 text-lg">{error || 'Something went wrong'}</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-surface border border-border text-text rounded-xl font-medium transition-colors no-underline hover:bg-white/5"
            >
              Go Home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
