// ============================================================
// CrewRecommendBanner — 상품 상세 페이지용 크루 추천 배너
// 추천 크루가 지정된 상품에만 렌더링됩니다.
// ============================================================

interface CrewRecommendBannerProps {
  crewNickname: string;
  crewName: string;
  note?: string | null;
}

export default function CrewRecommendBanner({
  crewNickname,
  crewName,
  note,
}: CrewRecommendBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "1rem",
        padding: "1.25rem 1.5rem",
        background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
        borderRadius: "16px",
        border: "1px solid #f9a8d4",
        margin: "1.25rem 0",
      }}
    >
      {/* 아이콘 */}
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #ec4899, #be185d)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.25rem",
          flexShrink: 0,
        }}
      >
        🎬
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 0.25rem 0",
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "#be185d",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          }}
        >
          ✨ {crewNickname}님의 추천 픽
        </p>
        {note ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.9375rem",
              color: "#831843",
              lineHeight: 1.6,
              fontStyle: "italic",
            }}
          >
            &ldquo;{note}&rdquo;
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "#9d174d",
              lineHeight: 1.6,
            }}
          >
            {crewNickname} ({crewName}) 호스트가 직접 선택한 추천 상품입니다.
          </p>
        )}
      </div>
    </div>
  );
}
