import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function Buddies() {
  const [buddies, setBuddies] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/buddies'),
      api.get('/buddies/invites'),
    ]).then(([b, i]) => {
      setBuddies(b)
      setInvites(i)
    }).finally(() => setLoading(false))
  }, [])

  const createInvite = async () => {
    const { code } = await api.post('/buddies/invite')
    const link = `${window.location.origin}/invite/${code}`
    setInviteLink(link)
    setInvites(await api.get('/buddies/invites'))
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  const removeBuddy = async (id) => {
    if (!confirm('Remove this buddy? You will no longer see each other\'s data.')) return
    await api.delete(`/buddies/${id}`)
    setBuddies(await api.get('/buddies'))
  }

  if (loading) return <div className="text-text-muted">Loading...</div>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-text">Concert Buddies</h1>
        <button
          onClick={createInvite}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors border-0 cursor-pointer"
        >
          Create Invite Link
        </button>
      </div>

      {/* Invite link display */}
      {inviteLink && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm text-text-muted">Share this link with a friend:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text font-mono"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 bg-secondary hover:bg-secondary-hover text-white rounded-lg text-sm font-medium transition-colors border-0 cursor-pointer whitespace-nowrap"
            >
              {copying ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Buddy list */}
      {buddies.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-text-muted text-lg mb-2">No buddies yet</p>
          <p className="text-text-muted/60 text-sm">Create an invite link and share it with friends to see each other's concert history!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buddies.map(buddy => (
            <div key={buddy.id} className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
              {buddy.avatar_url ? (
                <img src={buddy.avatar_url} alt="" className="w-12 h-12 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                  {buddy.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate">{buddy.name}</p>
                <p className="text-sm text-text-muted truncate">{buddy.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/buddies/${buddy.user_id}`}
                  className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors no-underline"
                >
                  View
                </Link>
                <button
                  onClick={() => removeBuddy(buddy.id)}
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors border-0 bg-transparent cursor-pointer"
                  title="Remove buddy"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text mb-3">Your Invites</h2>
          <div className="space-y-2">
            {invites.map(invite => (
              <div key={invite.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-mono text-text-muted">{invite.code}</span>
                <span className={invite.accepted_by ? 'text-green-400' : 'text-yellow-400'}>
                  {invite.accepted_by ? 'Accepted' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
