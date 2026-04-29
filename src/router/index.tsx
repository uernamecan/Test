import { Navigate, createHashRouter } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import AlbumDetailPage from '../pages/AlbumDetail'
import HomePage from '../pages/Home'
import LibraryPage from '../pages/Library'
import PlaylistPage from '../pages/Playlist'
import SearchPage from '../pages/Search'
import SettingsPage from '../pages/Settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'library/tracks',
        element: <LibraryPage mode="tracks" />
      },
      {
        path: 'library/favorites',
        element: <LibraryPage mode="favorites" />
      },
      {
        path: 'library/albums',
        element: <LibraryPage mode="albums" />
      },
      {
        path: 'library/albums/:artistId/:albumId',
        element: <AlbumDetailPage />
      },
      {
        path: 'library/artists',
        element: <Navigate to="/library/tracks" replace />
      },
      {
        path: 'library/artists/:artistId',
        element: <Navigate to="/library/tracks" replace />
      },
      {
        path: 'search',
        element: <SearchPage />
      },
      {
        path: 'playlists/:id',
        element: <PlaylistPage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: '*',
        element: <Navigate to="/library/tracks" replace />
      }
    ]
  }
])
