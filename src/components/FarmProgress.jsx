export default function FarmProgress({ completedCount = 0, totalModules = 17 }) {
  return (
    <div style={{ padding: 16, background: '#1a1a2e', border: '3px solid gold', borderRadius: 12, color: 'gold', fontFamily: 'monospace', fontSize: 14 }}>
      Farm Level: {Math.ceil(completedCount / 3) + 1} | {completedCount}/{totalModules} modules
    </div>
  )
}
