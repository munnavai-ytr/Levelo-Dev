import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublishedGame } from '@/lib/publish-manager';
import { PlayGameClient } from './PlayGameClient';

// Enable revalidation caching for fast public game loads
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await fetchPublishedGame(slug);

  if (!game) {
    return {
      title: 'Game Not Found | Levelo',
      description: 'The requested game could not be found.',
    };
  }

  const title = `${game.title} - Play Free Online`;
  const description = game.description || `Play ${game.title} created with Levelo AI Game Builder!`;
  const images = game.thumbnail ? [{ url: game.thumbnail, width: 800, height: 600, alt: game.title }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/play/${game.slug}`,
      images,
      siteName: 'Levelo',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: game.thumbnail ? [game.thumbnail] : [],
    },
  };
}

export default async function PlayGamePage({ params }: PageProps) {
  const { slug } = await params;
  const game = await fetchPublishedGame(slug);

  if (!game) {
    notFound();
  }

  return <PlayGameClient game={game} />;
}
