// ============================================================
// GET /live — 라이브 쇼핑 메인 페이지 (Server Component)
// ============================================================

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "라이브 쇼핑 | 모델뷰티",
  description: "실시간으로 소통하며 쇼핑하는 모델뷰티 라이브 쇼핑!",
};

interface MappedProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  thumbnail: string | null;
}

interface StreamItem {
  id: string;
  title: string;
  description: string | null;
  streamerName: string;
  status: "upcoming" | "live" | "ended";
  coverImageUrl: string | null;
  viewerCount: number;
  startedAt: string | null;
  products: MappedProduct[];
}

async function getLiveStreams(): Promise<StreamItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("live_streams")
    .select(`
      *,
      live_stream_products (
        product_id,
        products (
          id, name, slug, base_price, sale_price, images
        )
      )
    `)
    .order("status", { ascending: false }) // live -> upcoming -> ended 순 정렬 유도
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getLiveStreams] error:", error);
    return [];
  }

  return (data ?? []).map((stream: any) => {
    const rawProducts = stream.live_stream_products ?? [];
    const products = rawProducts
      .map((lp: any) => {
        const prod = lp.products;
        if (!prod) return null;
        const images = prod.images ?? [];
        return {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          basePrice: prod.base_price,
          salePrice: prod.sale_price,
          thumbnail: images[0]?.url ?? null,
        };
      })
      .filter(Boolean);

    return {
      id: stream.id,
      title: stream.title,
      description: stream.description,
      streamerName: stream.streamer_name,
      status: stream.status,
      coverImageUrl: stream.cover_image_url,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      products,
    };
  });
}

export default async function LiveShoppingPage() {
  const streams = await getLiveStreams();

  const liveStreams = streams.filter((s) => s.status === "live");
  const upcomingStreams = streams.filter((s) => s.status === "upcoming");
  const replayStreams = streams.filter((s) => s.status === "ended");

  return (
    <div style={{ minHeight: "80vh", background: "var(--mb-gray-50)", paddingBottom: "4rem" }}>
        
        {/* 히어로 배너 */}
        <section className="live-hero">
          <div className="live-hero-inner">
            <span className="live-hero-badge">MODEL BEAUTY LIVE</span>
            <h1 className="live-hero-title">실시간으로 소통하는<br />뷰티 라이브 쇼핑</h1>
            <p className="live-hero-desc">엄선된 인기 뷰티 상품을 특별 혜택가로 만나보세요.</p>
          </div>
        </section>

        <div className="shop-container" style={{ marginTop: "2.5rem" }}>
          
          {/* 1. ON AIR (현재 방송중) */}
          <section className="live-section">
            <div className="live-section-header">
              <h2 className="live-section-title">
                <span className="live-dot-breathing" /> ON AIR
              </h2>
              <p className="live-section-subtitle">현재 진행 중인 실시간 방송에 참여해보세요!</p>
            </div>

            {liveStreams.length === 0 ? (
              <div className="live-empty-card">
                <div style={{ fontSize: "2.5rem" }}>📺</div>
                <p style={{ marginTop: "0.75rem", fontWeight: 600, color: "var(--mb-gray-50px)" }}>진행 중인 라이브 방송이 없습니다</p>
                <p style={{ fontSize: "0.875rem", color: "var(--mb-gray-400)" }}>대기 중인 방송을 확인하고 알림을 기다려보세요.</p>
              </div>
            ) : (
              <div className="live-grid-onair">
                {liveStreams.map((stream) => (
                  <div key={stream.id} className="onair-card">
                    {/* 카드 비주얼 */}
                    <div className="onair-visual">
                      {stream.coverImageUrl ? (
                        <Image
                          src={stream.coverImageUrl}
                          alt={stream.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          style={{ objectFit: "cover" }}
                          priority
                        />
                      ) : (
                        <div className="onair-visual-fallback">💄 MODEL BEAUTY LIVE</div>
                      )}
                      {/* 라이브 오버레이 */}
                      <span className="visual-live-badge">LIVE</span>
                      <span className="visual-viewer-count">👤 {stream.viewerCount.toLocaleString()}명 시청 중</span>
                    </div>

                    {/* 카드 정보 */}
                    <div className="onair-info">
                      <div className="onair-streamer">{stream.streamerName}</div>
                      <h3 className="onair-title">{stream.title}</h3>
                      {stream.description && <p className="onair-desc">{stream.description}</p>}

                      {/* 매핑 상품 퀵 뷰 */}
                      {stream.products.length > 0 && (
                        <div className="onair-products">
                          <p className="onair-products-label">오늘의 라이브 특가 상품</p>
                          <div className="onair-product-list">
                            {stream.products.slice(0, 2).map((p) => (
                              <div key={p.id} className="onair-prod-item">
                                <div className="onair-prod-thumb">
                                  {p.thumbnail ? (
                                    <Image src={p.thumbnail} alt={p.name} fill sizes="36px" style={{ objectFit: "cover" }} />
                                  ) : (
                                    "✨"
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="onair-prod-name">{p.name}</div>
                                  <div className="onair-prod-price">
                                    {p.salePrice ? (
                                      <>
                                        <span className="sale-p">{(p.salePrice).toLocaleString()}원</span>
                                        <span className="base-p">{(p.basePrice).toLocaleString()}원</span>
                                      </>
                                    ) : (
                                      <span>{(p.basePrice).toLocaleString()}원</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Link href={`/live/${stream.id}`} className="onair-enter-btn">
                        라이브 방송 입장하기
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. UPCOMING (방송 예정) */}
          <section className="live-section" style={{ marginTop: "4rem" }}>
            <div className="live-section-header">
              <h2 className="live-section-title" style={{ color: "var(--mb-gray-900)" }}>⏰ 라이브 편성표</h2>
              <p className="live-section-subtitle">다양한 라이브 쇼가 여러분을 찾아옵니다.</p>
            </div>

            {upcomingStreams.length === 0 ? (
              <p style={{ textAlign: "center", padding: "2rem", color: "var(--mb-gray-500)", fontSize: "0.875rem" }}>
                예정된 라이브 방송 일정이 없습니다.
              </p>
            ) : (
              <div className="upcoming-list">
                {upcomingStreams.map((stream) => {
                  const date = stream.startedAt ? new Date(stream.startedAt) : new Date();
                  return (
                    <div key={stream.id} className="upcoming-item">
                      <div className="upcoming-time-box">
                        <div className="upcoming-date">
                          {date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </div>
                        <div className="upcoming-time">
                          {date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </div>
                      </div>
                      <div className="upcoming-info">
                        <div className="upcoming-streamer">{stream.streamerName}</div>
                        <h3 className="upcoming-title">{stream.title}</h3>
                        {stream.description && <p className="upcoming-desc">{stream.description}</p>}
                      </div>
                      <div className="upcoming-products-preview">
                        {stream.products.map((p) => (
                          <Link key={p.id} href={`/products/${p.slug}`} className="upcoming-prod-pill" title={p.name}>
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. REPLAY (지난 라이브 다시보기) */}
          <section className="live-section" style={{ marginTop: "4rem" }}>
            <div className="live-section-header">
              <h2 className="live-section-title" style={{ color: "var(--mb-gray-900)" }}>🎬 지난 라이브 다시보기</h2>
              <p className="live-section-subtitle">놓친 방송도 영상 다시보기와 함께 혜택가로 쇼핑 가능합니다.</p>
            </div>

            {replayStreams.length === 0 ? (
              <p style={{ textAlign: "center", padding: "2rem", color: "var(--mb-gray-500)", fontSize: "0.875rem" }}>
                이전 라이브 다시보기 영상이 없습니다.
              </p>
            ) : (
              <div className="replay-grid">
                {replayStreams.map((stream) => (
                  <div key={stream.id} className="replay-card">
                    <Link href={`/live/${stream.id}`} className="replay-visual-link">
                      <div className="replay-visual">
                        {stream.coverImageUrl ? (
                          <Image src={stream.coverImageUrl} alt={stream.title} fill sizes="(max-width: 768px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                        ) : (
                          <div className="replay-visual-fallback">REPLAY</div>
                        )}
                        <span className="replay-play-icon">▶</span>
                        <span className="replay-duration-badge">다시보기</span>
                      </div>
                    </Link>
                    <div className="replay-info">
                      <div className="replay-streamer">{stream.streamerName}</div>
                      <h3 className="replay-title">
                        <Link href={`/live/${stream.id}`}>{stream.title}</Link>
                      </h3>
                      <div className="replay-products-bar">
                        {stream.products.slice(0, 3).map((p) => (
                          <Link key={p.id} href={`/products/${p.slug}`} className="replay-prod-link" title={p.name}>
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
  );
}
