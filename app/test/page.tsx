import Image from 'next/image';

export default function Test() {
  const v = 5;
  return (
    <main className="min-h-screen bg-[#0b1020] text-white p-6 space-y-6">
      <h1 className="text-2xl font-bold">OG Image Preview</h1>
      <p>
        This page shows the current Open Graph/Twitter image used for link
        previews.
      </p>
      <div className="rounded-xl overflow-hidden border border-white/10 w-[600px]">
        <Image
          src={`/og.png?v=${v}`}
          width={1200}
          height={630}
          alt="Discoverse OG preview"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
      <div className="space-x-4">
        <a
          href={`/og.png?v=${v}`}
          className="underline text-blue-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open raw image
        </a>
        <a
          href="https://cards-dev.twitter.com/validator"
          className="underline text-blue-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Twitter card validator
        </a>
      </div>
    </main>
  );
}
