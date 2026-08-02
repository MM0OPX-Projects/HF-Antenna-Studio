interface SideViewDiagramProps {
  heightWavelengths: number;
  heightM: number;
}

export function SideViewDiagram({ heightWavelengths, heightM }: SideViewDiagramProps) {
  const antennaY = 164 - Math.min(1, heightWavelengths / 2) * 118;
  return (
    <svg
      viewBox="0 0 520 210"
      role="img"
      aria-label={`Side view: horizontal dipole ${heightWavelengths.toFixed(2)} wavelengths above ground`}
      className="h-full min-h-52 w-full"
      data-testid="side-view-diagram"
    >
      <defs>
        <linearGradient id="height-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563eb" stopOpacity="0.12" />
          <stop offset="1" stopColor="#14b8a6" stopOpacity="0.03" />
        </linearGradient>
        <marker id="height-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse">
          <path d="M0 0 L7 3.5 L0 7 Z" fill="currentColor" />
        </marker>
      </defs>
      <rect width="520" height="180" rx="10" fill="url(#height-sky)" />
      <path d="M16 178 H504" stroke="#14b8a6" strokeWidth="3" />
      <path d="M16 184 Q70 173 124 184 T232 184 T340 184 T448 184 T504 184" fill="none" stroke="#14b8a6" strokeOpacity="0.35" />
      <text x="24" y="202" fill="currentColor" opacity="0.65" fontSize="11">Ground reflection changes the elevation lobes</text>

      <line x1="128" y1={antennaY} x2="392" y2={antennaY} stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
      <circle cx="260" cy={antennaY} r="7" fill="#0f172a" stroke="#f97316" strokeWidth="3" />
      <path d={`M260 ${antennaY + 7} v15`} stroke="#f97316" strokeWidth="2" />
      <text x="400" y={antennaY + 4} fill="currentColor" fontSize="11">½λ dipole</text>

      <g color="#3b82f6">
        <line x1="92" y1={antennaY} x2="92" y2="178" stroke="currentColor" strokeWidth="1.5" markerStart="url(#height-arrow)" markerEnd="url(#height-arrow)" />
        <text x="102" y={(antennaY + 178) / 2 - 5} fill="currentColor" fontSize="12" fontWeight="600">{heightWavelengths.toFixed(2)}λ</text>
        <text x="102" y={(antennaY + 178) / 2 + 11} fill="currentColor" fontSize="10">{heightM.toFixed(2)} m</text>
      </g>

      <path d={`M260 ${antennaY} Q335 ${(antennaY + 178) / 2} 430 178`} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="5 5" />
      <path d={`M260 ${antennaY} Q340 ${Math.max(12, antennaY - 55)} 450 20`} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="5 5" />
      <text x="353" y="36" fill="#a855f7" fontSize="10">direct + reflected fields</text>
    </svg>
  );
}
