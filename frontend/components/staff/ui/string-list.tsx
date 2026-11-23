"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/** 문자열 목록 편집기 (포함/불포함/하이라이트 등). */
export function StringListEditor({
  value,
  onChange,
  placeholder = "항목 입력",
  addLabel = "항목 추가",
  reorder = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  reorder?: boolean;
}) {
  const update = (i: number, v: string) =>
    onChange(value.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-[13px] text-muted">아직 항목이 없어요.</p>
      )}
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-center text-[12px] text-muted-2 tabular">
            {i + 1}
          </span>
          <Input
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="h-10"
          />
          {reorder && (
            <>
              <button
                type="button"
                aria-label="위로"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="아래로"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="삭제"
            onClick={() => remove(i)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, ""])}
      >
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
