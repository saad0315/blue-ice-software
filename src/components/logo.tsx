import { Ubuntu } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';

const font = Ubuntu({
  weight: ['700'],
  subsets: ['latin'],
});

export const Logo = () => {
  return (
    <Link href="/" className="flex items-center justify-center gap-x-1.5">
      <Image src="/logowhite.webp" alt="Icon" height={160} width={160} className="hidden dark:block" />
      <Image src="/logo.webp" alt="Icon" height={160} width={160} className="block dark:hidden" />
    </Link>
  );
};
