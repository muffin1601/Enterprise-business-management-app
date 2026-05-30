'use client'

import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  type ReactNode,
} from 'react'

// ── Context ────────────────────────────────────────────────────────────────────
interface Ctx {
  node: ReactNode
  set: (n: ReactNode) => void
}

const PageActionsCtx = createContext<Ctx>({ node: null, set: () => {} })

// ── Provider — wrap AppShell content with this ────────────────────────────────
export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [node, set] = useState<ReactNode>(null)
  return (
    <PageActionsCtx.Provider value={{ node, set }}>
      {children}
    </PageActionsCtx.Provider>
  )
}

// ── Slot — placed inside the topbar to render whatever pages inject ────────────
export function PageActionsSlot() {
  const { node } = useContext(PageActionsCtx)
  return <>{node}</>
}

// ── PageActions — pages call this to inject content into the topbar ────────────
// Must be a client component. Server-component pages wrap it in a thin client file.
export function PageActions({ children }: { children: ReactNode }) {
  const { set } = useContext(PageActionsCtx)

  useLayoutEffect(() => {
    set(children)
    return () => set(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
