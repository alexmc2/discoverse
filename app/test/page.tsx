import Image from 'next/image';

export default function Test() {
  return (
    <main className="min-h-screen bg-[#0b1020] text-white p-6 space-y-6">
      <h1 className="text-2xl font-bold">OG Image Preview</h1>
      <p>Compare what each route returns. All three should match.</p>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h2 className="mb-2 font-semibold">/og.png</h2>
          <div className="rounded-xl overflow-hidden border border-white/10 w-[600px] md:w-full">
            <Image
              src="/og.png"
              width={1200}
              height={630}
              alt="/og.png"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
          <a
            href="/og.png"
            className="underline text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open raw image
          </a>
        </div>

        <div>
          <h2 className="mb-2 font-semibold">/opengraph-image</h2>
          <div className="rounded-xl overflow-hidden border border-white/10 w-[600px] md:w-full">
            <Image
              src="/opengraph-image"
              width={1200}
              height={630}
              alt="/opengraph-image"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
          <a
            href="/opengraph-image"
            className="underline text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open raw image
          </a>
        </div>

        <div>
          <h2 className="mb-2 font-semibold">/twitter-image</h2>
          <div className="rounded-xl overflow-hidden border border-white/10 w-[600px] md:w-full">
            <Image
              src="/twitter-image"
              width={1200}
              height={630}
              alt="/twitter-image"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
          <a
            href="/twitter-image"
            className="underline text-blue-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open raw image
          </a>
        </div>
      </section>

      <div className="space-x-4">
        <a
          href="https://cards-dev.twitter.com/validator"
          className="underline text-blue-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Twitter card validator
        </a>
        <a
          href="https://developers.facebook.com/tools/debug/"
          className="underline text-blue-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook sharing debugger
        </a>
      </div>
    </main>
  );
}
