"use client";
// ============================================================
// StarRating — 체험 후기 "총점" 별점 (0.5점 단위)
// StarRatingInput: 작성 폼에서 클릭으로 입력 (별 왼쪽 절반=.5점, 오른쪽 절반=정수점)
// StarRatingDisplay: 목록/상세에서 읽기 전용 표시
// ============================================================

import { useState } from "react";

function Star({ size, fillPercent, color }: { size: number; fillPercent: number; color: string }) {
  return (
    <div style={{ position: "relative", width: size, height: size, lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
        <path
          d="M12 2.5l2.94 6.36 6.94.74-5.2 4.78 1.46 6.87L12 17.6l-6.14 3.65 1.46-6.87-5.2-4.78 6.94-.74z"
          fill="var(--mb-gray-200, #e5e5e5)"
        />
      </svg>
      {fillPercent > 0 && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: `${fillPercent * 100}%` }}>
          <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
            <path
              d="M12 2.5l2.94 6.36 6.94.74-5.2 4.78 1.46 6.87L12 17.6l-6.14 3.65 1.46-6.87-5.2-4.78 6.94-.74z"
              fill={color}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function StarRatingDisplay({
  rating,
  size = 16,
  showNumber = true,
  color = "var(--mb-pink-600, #db2777)",
}: {
  rating: number;
  size?: number;
  showNumber?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
      <div style={{ display: "inline-flex", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} color={color} fillPercent={Math.max(0, Math.min(1, rating - (i - 1)))} />
        ))}
      </div>
      {showNumber && (
        <span style={{ fontSize: size * 0.75, fontWeight: 700, color: "var(--mb-gray-700, #374151)" }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function StarRatingInput({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div style={{ display: "inline-flex", gap: 3 }} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ position: "relative", width: size, height: size }}>
          <Star size={size} color="var(--mb-pink-600, #db2777)" fillPercent={Math.max(0, Math.min(1, display - (i - 1)))} />
          <button
            type="button"
            aria-label={`${i - 0.5}점`}
            onMouseEnter={() => setHover(i - 0.5)}
            onClick={() => onChange(i - 0.5)}
            style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          />
          <button
            type="button"
            aria-label={`${i}점`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          />
        </div>
      ))}
    </div>
  );
}
