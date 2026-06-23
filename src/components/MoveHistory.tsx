export function MoveHistory({ moves }: { moves: string[] }) {
  const rows: { n: number; white: string; black: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] ?? "" });
  }
  return (
    <div className="overflow-auto max-h-[400px] text-sm font-mono">
      {rows.map((r) => (
        <div key={r.n} className="flex gap-2">
          <span className="w-6 text-gray-500">{r.n}.</span>
          <span className="w-16">{r.white}</span>
          <span className="w-16">{r.black}</span>
        </div>
      ))}
    </div>
  );
}
