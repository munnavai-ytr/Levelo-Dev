import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: {
    default: 'Levelo - AI Game Builder',
    template: '%s | Levelo',
  },
  description: 'Describe your game. Levelo builds it. Play it instantly.',
  openGraph: {
    title: 'Levelo - AI Game Builder',
    description: 'Describe your game. Levelo builds it. Play it instantly.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Levelo - AI Game Builder',
    description: 'Describe your game. Levelo builds it. Play it instantly.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // One-time legacy key migration
                const legacyKeys = {
                  'gameforge_theme': 'levelo_theme',
                  'gameforge_gemini_api_key': 'levelo_gemini_api_key',
                  'gameforge_gemini_model': 'levelo_gemini_model',
                  'gameforge_cached_models': 'levelo_cached_models',
                  'gameforge_local_projects_v1': 'levelo_local_projects_v1',
                  'gameforge_demo_user': 'levelo_demo_user',
                };
                for (var oldK in legacyKeys) {
                  var oldV = localStorage.getItem(oldK);
                  var newK = legacyKeys[oldK];
                  if (oldV !== null && localStorage.getItem(newK) === null) {
                    localStorage.setItem(newK, oldV);
                  }
                }

                const theme = localStorage.getItem('levelo_theme') || localStorage.getItem('gameforge_theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white" suppressHydrationWarning>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
