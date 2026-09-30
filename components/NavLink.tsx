'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, className, activeClassName, children }: { href: string; className: string; activeClassName: string; children: React.ReactNode }) {
  const path = usePathname()
  const active = path === href || path.startsWith(href + '/')
  return (
    <Link href={href} className={`${className} ${active ? activeClassName : ''}`} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}
