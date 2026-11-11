# Brain viewer (Next.js, App Router)

    npm i three @react-three/fiber @react-three/drei
    npm i -D @types/three

Needs React 19 + Next 15+ (R3F v9). On React 18 use @react-three/fiber@8 and @react-three/drei@9.

Copy `components/brain/` into your project (the `@/` alias is the create-next-app default),
then render `<BrainViewer />` (see `app/page.tsx`, which also wires the two fonts).

Props: electrodes, events, channelActivity, status, recordingStartedAt, simulate,
defaultMode, quality ('low' | 'medium' | 'high'), glow, onSelectionChange.
Without `events` / `channelActivity` it runs a clearly labelled simulator.
