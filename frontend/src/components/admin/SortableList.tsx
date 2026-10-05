import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveItem } from "@/lib/hub";
import { cn } from "@/lib/utils";

interface Props<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[]) => void;
  render: (item: T, index: number) => ReactNode;
  testIdPrefix: string;
}

/** Vertical list with drag-and-drop + up/down buttons. */
export default function SortableList<T>({ items, getId, onReorder, render, testIdPrefix }: Props<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    onReorder(moveItem(items, from, to));
  };

  return (
    <ul className="divide-y divide-slate-800/80">
      {items.map((item, i) => (
        <li
          key={getId(item)}
          data-testid={`${testIdPrefix}-row`}
          draggable
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(i);
          }}
          onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) move(dragIndex, i);
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={cn(
            "flex items-center gap-3 px-3 py-3 transition-colors duration-150",
            dragIndex === i && "opacity-40",
            overIndex === i && dragIndex !== i && "bg-sky-500/10",
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-slate-600" aria-hidden />
          <div className="min-w-0 flex-1">{render(item, i)}</div>
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="icon-sm" aria-label="Mover para cima" data-testid="admin-reorder-up-btn" disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Mover para baixo" data-testid="admin-reorder-down-btn" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
