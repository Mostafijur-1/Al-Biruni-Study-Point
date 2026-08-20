import Image from "next/image";

export default function Loading() {
  return (
    <div
      className="grid min-h-[calc(100vh-var(--header-height))] place-items-center bg-navy px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="relative mx-auto size-32 sm:size-40">
          <Image
            src="/absp-logo.png"
            alt=""
            fill
            sizes="160px"
            className="object-contain"
            priority
          />
        </div>
        <p className="mt-5 font-display text-2xl font-bold text-white">
          আল-বিরুনি স্টাডি পয়েন্ট
        </p>
        <div className="mt-4 flex justify-center gap-2" aria-hidden>
          <span className="size-2 animate-pulse rounded-full bg-brand-yellow" />
          <span className="size-2 animate-pulse rounded-full bg-brand-yellow [animation-delay:150ms]" />
          <span className="size-2 animate-pulse rounded-full bg-brand-yellow [animation-delay:300ms]" />
        </div>
        <span className="sr-only">লোড হচ্ছে...</span>
      </div>
    </div>
  );
}
