import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Forever City Hotel | Worker Management',
    short_name: 'WKMS',
    description: 'Worker Management System for Forever City Hotel',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f3ef',
    theme_color: '#1a3c5e',
    icons: [
      {
        src: '/icons/wkms-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/wkms-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
