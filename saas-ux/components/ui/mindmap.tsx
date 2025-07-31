import Image from "next/image";

function Pill({
  children,
  color,
  icon,
  className = "",
}: {
  children: React.ReactNode;
  color: string;
  icon?: React.ReactNode;
  className?: string;
}) {

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-1 mb-2 font-semibold
        rounded-full shadow-lg transition-all text-white
        ${className}
      `}
      style={{
        background: color,
        minWidth: 80,
        fontSize: 16,
        justifyContent: "center",
        border: `0px solid ${color}`,
      }}
    >
      {icon ? <span className="mr-2">{icon}</span> : null}
      {children}
    </div>
  );
}

function SubPill({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="flex items-center px-3 py-1 mb-1 rounded-full border font-medium text-sm tracking-tight transition-all"
      style={{
        color: color,
        borderColor: color,
        background: `${color}1A`, // Use a hex with alpha or replace with rgba if needed
        minWidth: 80,
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

export default function Mindmap({ data }: { data: any }) {
  const { branches } = data;

  // Layout positions (relative to container size)
  const mainSize = 56; // Logo size
  const pillOffset = 160; // How far pills sit from center

  // X,Y for each pill (order: SEO, Accessibility, Security, Performance)
  const positions = [
    // X    Y
    [-pillOffset, -pillOffset],  // SEO (top left)
    [pillOffset, -pillOffset],   // Accessibility (top right)
    [-pillOffset, pillOffset],   // Security (bottom left)
    [pillOffset, pillOffset],    // Performance (bottom right)
  ];

  // SVG lines: from center (0,0) to each branch
  const lineCoords = positions.map(([x, y]) => ({
    x1: 0, y1: 0,
    x2: x, y2: y,
  }));

  return (
    <div className="relative flex items-center justify-center w-full max-w-3xl mx-auto mt-10 py-12" style={{ minHeight: 420 }}>
      {/* SVG connector lines */}
      <svg
        className="absolute left-1/2 top-1/2 pointer-events-none z-0"
        width="100%"
        height="100%"
        style={{
          width: 2 * pillOffset + 120,  // Adjust for larger screens
          height: 2 * pillOffset + 120,
          transform: "translate(-50%, -50%)",
          overflow: "visible",
        }}
      >
        {lineCoords.map((coords, i) => (
          <line
            key={i}
            x1={mainSize / 2 + pillOffset}
            y1={mainSize / 2 + pillOffset}
            x2={mainSize / 2 + pillOffset + positions[i][0]}
            y2={mainSize / 2 + pillOffset + positions[i][1]}
            stroke={branches[i].color}
            strokeWidth="2"
            opacity="0.5"
          />
        ))}
      </svg>

      {/* Pills + Logo */}
      {/* Center logo */}
      <div
        className="absolute left-1/2 top-1/2 z-20"
        style={{
          width: mainSize,
          height: mainSize,
          transform: `translate(-50%, -50%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="rounded-full bg-white/10 flex items-center justify-center" style={{ width: 48, height: 48 }}>
          <Image src="/360.svg" alt={data.core} width={48} height={48} />
        </div>
      </div>

      {/* Four main branches */}
      {branches.map((branch: any, i: number) => (
        <div
          key={branch.title}
          className="absolute z-10 flex flex-col items-center"
          style={{
            left: `calc(50% + ${positions[i][0]}px)`,
            top: `calc(50% + ${positions[i][1]}px)`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Pill color={branch.color}>{branch.title}</Pill>
          {(branch.subs || branch.details)?.map((sub: string, idx: number) => (
            <SubPill color={branch.color} key={sub + idx}>{sub}</SubPill>
          ))}
        </div>
      ))}
    </div>
  );
}