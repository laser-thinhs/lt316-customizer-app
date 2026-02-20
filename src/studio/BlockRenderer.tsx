"use client";

import { StudioBlock } from "@/studio/types";

type Props = {
  block: StudioBlock;
  selected?: boolean;
  onClick?: () => void;
};

export function BlockRenderer({ block, selected, onClick }: Props) {
  const border = selected ? "border-blue-500" : "border-slate-200";

  if (block.type === "text") {
    return (
      <button type="button" onClick={onClick} className={`w-full rounded border ${border} bg-white p-3 text-left`}>
        <p className={`text-sm ${block.props.align === "center" ? "text-center" : block.props.align === "right" ? "text-right" : "text-left"}`}>
          {block.props.text}
        </p>
      </button>
    );
  }

  if (block.type === "image") {
    return (
      <button type="button" onClick={onClick} className={`w-full rounded border ${border} bg-white p-3 text-left`}>
        {block.props.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.props.src} alt={block.props.alt || "Studio image"} className="h-24 w-full rounded object-cover" />
        ) : (
          <div className="flex h-24 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">No image URL</div>
        )}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`w-full rounded border ${border} bg-white p-3 text-left`}>
      <div className="rounded bg-slate-900/95 p-4 text-white">
        <p className="text-sm font-medium">{block.props.label}</p>
        <p className="text-xs text-slate-300">⌀ {block.props.diameterMm}mm · H {block.props.heightMm}mm</p>
        <div className="mt-3 h-16 rounded-full border border-slate-400/50" />
      </div>
    </button>
  );
}
