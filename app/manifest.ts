import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Levelo',
    short_name: 'Levelo',
    description: 'Describe your game. Levelo builds it. Play it instantly.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
