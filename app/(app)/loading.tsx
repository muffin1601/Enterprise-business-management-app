export default function Loading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      fontFamily: 'var(--font-body)', animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      {/* Skeleton header */}
      <div style={{ height: 36, width: 200, background: 'var(--c-surface-2)', borderRadius: 2 }} />
      {/* Skeleton filter bar */}
      <div style={{ height: 44, background: 'var(--c-surface-2)', borderRadius: 2 }} />
      {/* Skeleton cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: 180, background: 'var(--c-surface-2)', borderRadius: 2 }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  )
}
