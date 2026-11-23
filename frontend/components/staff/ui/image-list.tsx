"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Photo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { errMsg } from "@/components/staff/lib";

/** 이미지 URL 목록 + 업로드. 미리보기는 Photo 로 렌더(파일 없어도 안 깨짐). */
export function ImageListEditor({
  value,
  onChange,
  max = 6,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const update = (i: number, v: string) =>
    onChange(value.map((x, j) => (j === i ? v : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.staff.upload(file);
      onChange([...value, url]);
      toast("이미지를 업로드했어요", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-[13px] text-muted">
          등록된 이미지가 없어요. URL을 입력하거나 파일을 올려 주세요.
        </p>
      )}
      {value.map((src, i) => (
        <div key={i} className="flex items-center gap-2">
          <Photo
            src={src}
            alt={`이미지 ${i + 1}`}
            className="h-12 w-[72px] shrink-0 rounded-lg"
          />
          <Input
            value={src}
            onChange={(e) => update(i, e.target.value)}
            placeholder="/images/packages/slug-1.jpg 또는 https://…"
            className="h-10 font-mono text-[13px]"
          />
          <button
            type="button"
            aria-label="위로"
            disabled={i === 0}
            onClick={() => move(i, -1)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="아래로"
            disabled={i === value.length - 1}
            onClick={() => move(i, 1)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label="삭제"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={value.length >= max}
          onClick={() => onChange([...value, ""])}
        >
          <Plus className="size-4" />
          URL 추가
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={value.length >= max}
          loading={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {!uploading && <Upload className="size-4" />}
          이미지 업로드
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          aria-label="이미지 파일 선택"
        />
        <span className="self-center text-[12px] text-muted-2">
          첫 번째 이미지가 대표 사진으로 쓰여요. 최대 {max}장.
        </span>
      </div>
    </div>
  );
}

/** 단일 이미지 입력 (테마 대표 이미지) */
export function SingleImageInput({
  value,
  onChange,
  placeholder = "/images/themes/slug.jpg",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.staff.upload(file);
      onChange(url);
      toast("이미지를 업로드했어요", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Photo
        src={value}
        alt="대표 이미지"
        className="h-12 w-[72px] shrink-0 rounded-lg"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 font-mono text-[13px]"
      />
      <Button
        variant="outline"
        size="sm"
        loading={uploading}
        onClick={() => fileRef.current?.click()}
        className="shrink-0"
      >
        {!uploading && <Upload className="size-4" />}
        업로드
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
        aria-label="이미지 파일 선택"
      />
    </div>
  );
}
