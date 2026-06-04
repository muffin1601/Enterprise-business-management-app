'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Global top navigation progress bar.
 *
 * App Router gives no router events, so we drive the bar ourselves:
 *  - START on same-origin <a> clicks and on programmatic navigations
 *    (router.push/replace patch window.history.pushState/replaceState).
 *  - FINISH when usePathname() changes — i.e. the new (force-dynamic) page has
 *    finished rendering on the server and committed on the client.
 *  - SAFETY timeout auto-finishes a stalled/cancelled navigation.
 *
 * Zero dependencies; inline-styled to match the monochrome design language.
 */
export function TopProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  const trickle = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const hideT   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const safety  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active  = useRef(false)

  function start() {
    if (active.current) return
    active.current = true
    clearTimeout(hideT.current)
    clearInterval(trickle.current)
    clearTimeout(safety.current)
    setVisible(true)
    setWidth(8)
    // Creep toward 90% so the bar always feels alive during slow server renders.
    trickle.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.1 : w))
    }, 220)
    // Never get stuck if a navigation is cancelled or errors out.
    safety.current = setTimeout(() => finish(), 12000)
  }

  function finish() {
    if (!active.current) return
    active.current = false
    clearInterval(trickle.current)
    clearTimeout(safety.current)
    setWidth(100)
    hideT.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 280)
  }

  // Finish whenever the route actually changes (new page committed).
  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest('a')
      if (!a) return
      const href = a.getAttribute('href')
      const target = a.getAttribute('target')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target === '_blank' ||
        a.hasAttribute('download')
      ) return
      // Same page → no navigation will happen.
      const dest = href.split('?')[0]?.split('#')[0]
      if (dest === pathname) return
      start()
    }

    document.addEventListener('click', onClick, true)

    // Catch router.push / router.replace (App Router updates history directly).
    // Next calls pushState from inside React's useInsertionEffect, where calling
    // setState synchronously is forbidden — so defer start() to a microtask,
    // which runs once that commit phase has finished.
    const origPush = window.history.pushState
    const origReplace = window.history.replaceState
    window.history.pushState = function (this: History, ...args) {
      const res = origPush.apply(this, args as Parameters<typeof origPush>)
      setTimeout(start, 0)
      return res
    }
    window.history.replaceState = function (this: History, ...args) {
      return origReplace.apply(this, args as Parameters<typeof origReplace>)
    }

    return () => {
      document.removeEventListener('click', onClick, true)
      window.history.pushState = origPush
      window.history.replaceState = origReplace
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!visible) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2.5,
        zIndex: 99999, pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'var(--c-primary, #0a0a0a)',
          boxShadow: '0 0 8px rgba(10,10,10,0.4), 0 0 4px rgba(10,10,10,0.3)',
          transition: 'width 0.22s ease',
        }}
      />
    </div>
  )
}
