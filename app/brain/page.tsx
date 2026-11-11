import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';
import BrainViewer from '@/components/brain/BrainViewer';

const ui = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-ui' });
const data = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-data' });

export default function Page() {
  return (
    <main
      className={`${ui.variable} ${data.variable}`}
      style={{ minHeight: '100dvh', padding: 'clamp(0px, 2.5vw, 28px)', background: '#04030a' }}
    >
      <BrainViewer />
    </main>
  );
}
