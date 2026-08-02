// ============================================================
// GET /live/[id] — 실시간 라이브 스트리밍 룸 (Server Component)
// ============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LiveRoomClient from "@/components/live/LiveRoomClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("live_streams")
    .select("title, streamer_name")
    .eq("id", id)
    .single();

  if (!data) return { title: "라이브 방송을 찾을 수 없습니다" };
  return {
    title: `${data.title} - 라이브 쇼핑 | 모델뷰티`,
    description: `${data.streamer_name}와 함께하는 실시간 뷰티 쇼핑!`,
  };
}

async function getStreamData(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: stream, error } = await supabase
    .from("live_streams")
    .select(`
      *,
      live_stream_products (
        product_id,
        sort_order,
        is_live_deal,
        deal_ends_at,
        products (
          id, name, slug, base_price, sale_price, images, is_active, stock_quantity
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !stream) return null;

  // 이 방송으로 귀속된 결제완료 주문의 상품별 판매수량 집계 ("실시간 판매량" 뱃지용)
  const { data: soldRows } = await supabase
    .from("order_items")
    .select("product_id, quantity, orders!inner(live_stream_id, payment_status)")
    .eq("orders.live_stream_id", id)
    .eq("orders.payment_status", "paid");

  const soldCountByProduct = new Map<string, number>();
  for (const row of soldRows ?? []) {
    const prev = soldCountByProduct.get(row.product_id) ?? 0;
    soldCountByProduct.set(row.product_id, prev + row.quantity);
  }

  // 매핑 상품 추출 및 정렬
  const rawProducts = stream.live_stream_products ?? [];
  const products = rawProducts
    .map((lp: any) => {
      const prod = lp.products;
      if (!prod) return null;
      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        basePrice: prod.base_price,
        salePrice: prod.sale_price,
        images: prod.images ?? [],
        isActive: prod.is_active,
        stockQuantity: prod.stock_quantity,
        sortOrder: lp.sort_order,
        isLiveDeal: lp.is_live_deal ?? false,
        dealEndsAt: lp.deal_ends_at ?? null,
        soldCount: soldCountByProduct.get(prod.id) ?? 0,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  // 현재 로그인 유저가 이미 알림 구독했는지 확인 (대기화면 버튼 초기 상태용)
  let isSubscribed = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const { data: subRow } = await supabase
      .from("live_stream_subscriptions")
      .select("id")
      .eq("stream_id", id)
      .eq("master_user_id", masterUserId)
      .maybeSingle();
    isSubscribed = !!subRow;
  }

  return {
    id: stream.id,
    title: stream.title,
    description: stream.description,
    streamerName: stream.streamer_name,
    status: stream.status,
    coverImageUrl: stream.cover_image_url,
    streamUrl: stream.stream_url,
    replayUrl: stream.replay_url,
    activeProductId: stream.active_product_id,
    pinnedMessage: stream.pinned_message ?? null,
    viewerCount: stream.viewer_count,
    createdAt: stream.created_at,
    startedAt: stream.started_at,
    endedAt: stream.ended_at,
    scheduledAt: stream.scheduled_at || null,
    products,
    isSubscribed,
  };
}

async function getRecentChats(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: chats, error } = await supabase
    .from("live_stream_chats")
    .select("*")
    .eq("stream_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getRecentChats] error:", error);
    return [];
  }

  // 최신 메시지가 아래에 배치되도록 시간순(역순) 정렬
  return (chats ?? [])
    .map((chat) => ({
      id: chat.id,
      streamId: chat.stream_id,
      masterUserId: chat.master_user_id,
      nickname: chat.nickname,
      message: chat.message,
      createdAt: chat.created_at,
    }))
    .reverse();
}

export default async function LiveStreamDetailPage({ params }: Props) {
  const { id } = await params;

  const [stream, chats] = await Promise.all([
    getStreamData(id),
    getRecentChats(id),
  ]);

  if (!stream) notFound();

  return (
    <div style={{ background: "#0f172a" }}>
      <LiveRoomClient initialStream={stream} initialChats={chats} />
    </div>
  );
}
