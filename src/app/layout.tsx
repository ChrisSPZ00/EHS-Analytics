import type { Metadata } from 'next';
import { Montserrat, Source_Sans_3 } from 'next/font/google';
import './globals.css';

/*
 * Brand typefaces. Montserrat carries headings, nav labels and the wordmark;
 * Source Sans 3 carries body copy, form labels and table content.
 *
 * `next/font` self-hosts both at build time — no request to Google from the
 * client, no layout shift, and the app still renders if fonts.googleapis.com is
 * unreachable at runtime. The fallback stacks are declared here rather than left
 * to the browser so a failed font never drops the page to Times.
 */
const montserrat = Montserrat({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

const sourceSans = Source_Sans_3({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'SafePulse Analytics',
  description: 'EHS analytics that shows its working.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
