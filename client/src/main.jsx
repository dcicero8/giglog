import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import './index.css'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Concerts from './pages/Concerts'
import Upcoming from './pages/Upcoming'
import Wishlist from './pages/Wishlist'
import ConcertMap from './pages/ConcertMap'
import Artists from './pages/Artists'
import Settings from './pages/Settings'
import Collection from './pages/Collection'
import Songs from './pages/Songs'
import Login from './pages/Login'
import Buddies from './pages/Buddies'
import BuddyProfile from './pages/BuddyProfile'
import AcceptInvite from './pages/AcceptInvite'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/invite/:code', element: <AcceptInvite /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'concerts', element: <Concerts /> },
      { path: 'upcoming', element: <Upcoming /> },
      { path: 'wishlist', element: <Wishlist /> },
      { path: 'map', element: <ConcertMap /> },
      { path: 'artists', element: <Artists /> },
      { path: 'songs', element: <Songs /> },
      { path: 'collection', element: <Collection /> },
      { path: 'buddies', element: <Buddies /> },
      { path: 'buddies/:id', element: <BuddyProfile /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
