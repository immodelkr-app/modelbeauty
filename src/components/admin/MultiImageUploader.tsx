"use client";

// ============================================================
// MultiImageUploader — 여러 장 이미지 업로드/미리보기/순서변경/삭제
// 상품 이미지(썸네일 갤러리), 상세페이지 이미지 등에서 공용으로 사용
// ============================================================

import { useRef, useState } from "react";

export interface UploadedImage {
  url: string;
  alt: string;
}

interface MultiImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  hint?: string;
}

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function MultiImageUploader({ images, onChange, hint }: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const result = await res.json();
    if (!result.success) throw new Error(result.error ?? "업로드 실패");
    return result.url as string;
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError("");

    const files = Array.from(fileList);
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}"은(는) jpg/png/webp/gif만 업로드할 수 있습니다.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        setError(`"${file.name}"의 용량이 5MB를 초과합니다.`);
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of files) {
        const url = await uploadFile(file);
        uploaded.push({ url, alt: "" });
      }
      onChange([...images, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
          {images.map((img, idx) => (
            <div
              key={img.url + idx}
              style={{
                position: "relative", width: "96px", height: "96px",
                borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || `이미지 ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {idx === 0 && (
                <span style={{
                  position: "absolute", top: 2, left: 2, background: "rgba(236,72,153,0.9)",
                  color: "#fff", fontSize: "0.625rem", fontWeight: 700, padding: "1px 5px", borderRadius: "4px",
                }}>대표</span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label="삭제"
                style={{
                  position: "absolute", top: 2, right: 2, width: "20px", height: "20px",
                  borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff",
                  cursor: "pointer", fontSize: "0.75rem", lineHeight: 1,
                }}
              >✕</button>
              <div style={{ position: "absolute", bottom: 2, right: 2, display: "flex", gap: "2px" }}>
                <button
                  type="button"
                  onClick={() => handleMove(idx, -1)}
                  disabled={idx === 0}
                  aria-label="앞으로"
                  style={{
                    width: "18px", height: "18px", borderRadius: "4px", border: "none",
                    background: "rgba(0,0,0,0.6)", color: "#fff", cursor: idx === 0 ? "default" : "pointer",
                    opacity: idx === 0 ? 0.3 : 1, fontSize: "0.625rem", lineHeight: 1,
                  }}
                >◀</button>
                <button
                  type="button"
                  onClick={() => handleMove(idx, 1)}
                  disabled={idx === images.length - 1}
                  aria-label="뒤로"
                  style={{
                    width: "18px", height: "18px", borderRadius: "4px", border: "none",
                    background: "rgba(0,0,0,0.6)", color: "#fff", cursor: idx === images.length - 1 ? "default" : "pointer",
                    opacity: idx === images.length - 1 ? 0.3 : 1, fontSize: "0.625rem", lineHeight: 1,
                  }}
                >▶</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        style={{ display: "none" }}
        id={`img-upload-${hint ?? "default"}`}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="admin-btn admin-btn-secondary admin-btn-sm"
      >
        {uploading ? "업로드 중..." : "+ 이미지 추가"}
      </button>

      <p className="admin-input-hint" style={{ marginTop: "0.5rem" }}>
        {hint ?? "jpg/png/webp/gif, 장당 5MB 이하. 여러 장 동시 선택 가능. 첫 번째 이미지가 대표 이미지입니다."}
      </p>
      {error && <p style={{ color: "#ef4444", fontSize: "0.8125rem", marginTop: "0.375rem" }}>{error}</p>}
    </div>
  );
}
