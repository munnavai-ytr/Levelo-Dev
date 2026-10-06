'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Gamepad2, 
  Sparkles, 
  Flame, 
  Clock, 
  Play, 
  User, 
  Eye, 
  ArrowRight, 
  Loader2, 
  Plus, 
  Search,
  Compass,
  Layers
} from 'lucide-react';
import { fetchExploreGames } from '@/lib/publish-manager';
import { Navbar } from '@/components/Navbar';
import { Logo } from '@/components/Logo';
import type { PublishedGame } from '@/lib/types';

export default function ExplorePage() {
  const [games, setGames] = useState<PublishedGame[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDocCursor, setLastDocCursor] = useState<any>(undefined);

  const loadGames = async (sort: 'newest' | 'popular', isInitial = true) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetchExploreGames(sort, 12, isInitial ? undefined : lastDocCursor);
      if (isInitial) {
        setGames(res.games);
      } else {
        setGames((prev) => [...prev, ...res.games]);
      }
      setLastDocCursor(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('Failed to load explore games:', err);
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadGames(sortBy, true);
  }, [sortBy]);

  const filteredGames = games.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      g.title.toLowerCase().includes(q) ||
      g.authorName.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Explore Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 p-6 sm:p-10 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <Compass className="w-3.5 h-3.5" />
              <span>Levelo Arcade Community</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Play Real Games Built with <span className="text-indigo-400">AI Prompting</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Explore playable 2D arcade games, procedural action adventures, and 3D web experiences published directly by Levelo creators.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Build Your Own Game</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          {/* Sort Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setSortBy('newest')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'newest'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Newest Releases</span>
            </button>

            <button
              onClick={() => setSortBy('popular')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === 'popular'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Most Played</span>
            </button>
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search published games..."
              className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          /* Skeleton Loaders */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden animate-pulse flex flex-col"
              >
                <div className="w-full aspect-[16/10] bg-slate-800/60" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                  <div className="h-8 bg-slate-800/40 rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800/80 rounded-3xl bg-slate-900/20">
            <Gamepad2 className="w-12 h-12 text-slate-600 mb-3 stroke-[1.5]" />
            <h3 className="text-base font-semibold text-slate-200">
              {searchQuery ? 'No games match your search' : 'No public games published yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
              Be the first creator to build and publish a game with Levelo!
            </p>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              Create Game
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredGames.map((game) => (
              <div
                key={game.slug}
                className="group rounded-2xl border border-slate-800 hover:border-indigo-500/50 bg-slate-900/70 hover:bg-slate-900/90 transition-all duration-200 flex flex-col overflow-hidden shadow-lg hover:shadow-indigo-950/20"
              >
                {/* Thumbnail Banner */}
                <Link
                  href={`/play/${game.slug}`}
                  className="relative w-full aspect-[16/10] bg-slate-950 overflow-hidden block"
                >
                  {game.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={game.thumbnail}
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-gradient-to-br from-slate-950 to-indigo-950/30">
                      <Gamepad2 className="w-10 h-10 opacity-40" />
                    </div>
                  )}

                  {/* Play Overlay Button */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Plays Counter Badge */}
                  <div className="absolute bottom-2 left-2 z-10">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-slate-300 backdrop-blur-sm flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>{game.plays} plays</span>
                    </span>
                  </div>
                </Link>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                      <Link href={`/play/${game.slug}`}>{game.title}</Link>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {game.description || 'Interactive web game built with Levelo.'}
                    </p>
                  </div>

                  {/* Author & Play Button */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                      <div className="w-5 h-5 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {game.authorName[0]?.toUpperCase() || 'C'}
                      </div>
                      <span className="truncate max-w-[100px] text-[11px] font-medium">{game.authorName}</span>
                    </div>

                    <Link
                      href={`/play/${game.slug}`}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold transition-all border border-indigo-500/30 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Pagination */}
        {hasMore && (
          <div className="pt-6 flex justify-center">
            <button
              onClick={() => loadGames(sortBy, false)}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Loading more games...</span>
                </>
              ) : (
                <span>Load More Games</span>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
