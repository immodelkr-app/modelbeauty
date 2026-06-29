"use client";

// ============================================================
// ProductGallery — 상품 상세 이미지 갤러리 (클라이언트 컴포넌트)
// ============================================================

import { useState } from "react";
import Image from "next/image";
import type { ProductImage } from "@/types";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const hasImages = images.length > 0;
  const activeImage = hasImages ? images[activeIndex] : null;

  return (
    <div className="product-gallery">
      {/* 메인 이미지 */}
      <div className="product-gallery-main">
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeImage.alt || productName}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            priority
          />
        ) : (
          <div className="product-gallery-main-placeholder">💄</div>
        )}
      </div>

      {/* 썸네일 (이미지 2개 이상일 때만 표시) */}
      {images.length > 1 && (
        <div className="product-gallery-thumbs" role="tablist" aria-label="상품 이미지 목록">
          {images.map((img, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`이미지 ${idx + 1}`}
              className={`product-gallery-thumb ${idx === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(idx)}
            >
              <Image
                src={img.url}
                alt={img.alt || `${productName} ${idx + 1}`}
                width={72}
                height={72}
                style={{ objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
