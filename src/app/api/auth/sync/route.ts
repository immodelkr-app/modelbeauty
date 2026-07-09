// ============================================================
// API 라우트: SSO 동기화 프록시
// POST /api/auth/sync
// ============================================================
// 모델뷰티 앱 로그인 시 im-core-auth와 동기화
// - 전화번호 OTP 로그인: phoneNumber + localUserId (+ name)
// - 닉네임 설정/업데이트: masterUserId + name

import { NextRequest, NextResponse } from "next/server";
import { syncMasterUser, updateMasterUser } from "@/lib/core-auth";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, localUserId, name, masterUserId } = body;

    // ── 닉네임 단독 업데이트 (Step 3: 닉네임 설정) ──────────────
    // masterUserId + name 만 올 때는 im-core-auth에서 유저 정보만 업데이트
    if (masterUserId && name !== undefined && !phoneNumber) {
      const masterUser = await updateMasterUser(masterUserId, { name });
      
      // 로컬 Supabase 유저의 metadata name도 함께 업데이트하여 동기화 일치
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.updateUser({
          data: { name }
        });
      } catch (supabaseMetaError) {
        console.warn("[/api/auth/sync] Supabase user metadata 업데이트 실패 (세션 없음 등):", supabaseMetaError);
      }

      return NextResponse.json({ success: true, ...masterUser });
    }

    // ── 전화번호 기반 SSO 동기화 ─────────────────────────────────
    if (!phoneNumber || !localUserId) {
      return NextResponse.json(
        { error: "phoneNumber와 localUserId는 필수입니다." },
        { status: 400 }
      );
    }

    const masterUser = await syncMasterUser({
      phoneNumber,
      appName: "MODEL_BEAUTY",
      localUserId,
      name,
    });

    // master_user_id를 Supabase user_metadata에 캐싱
    // → 이후 API 요청에서 user.user_metadata.master_user_id로 바로 식별 가능
    if (masterUser.masterUserId && localUserId) {
      try {
        const adminClient = createSupabaseAdmin();
        await adminClient.auth.admin.updateUserById(localUserId, {
          user_metadata: {
            master_user_id: masterUser.masterUserId,
            name: masterUser.name ?? name,
          },
        });
      } catch (metaErr) {
        console.warn("[/api/auth/sync] user_metadata 캐싱 실패:", metaErr);
      }
    }

    return NextResponse.json({ success: true, ...masterUser });
  } catch (error) {
    console.error("[/api/auth/sync]", error);
    // im-core-auth 서버가 아직 배포되지 않은 경우 graceful fallback
    const message = error instanceof Error ? error.message : "서버 오류";
    const isCoreAuthOffline =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("your-im-core-auth-url");

    if (isCoreAuthOffline) {
      // im-core-auth 서버가 없어도 로그인 자체는 허용 (로컬 Supabase 세션만 사용)
      return NextResponse.json({
        success: true,
        masterUserId: null,
        phoneNumber: null,
        name: null,
        integratedPoints: 0,
        linkedApps: ["MODEL_BEAUTY"],
        _offline: true,
      });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[/api/auth/sync PATCH] Received body:", JSON.stringify(body, null, 2));

    const {
      masterUserId,
      shipping_recipient,
      shipping_phone,
      shipping_zipcode,
      shipping_address,
      shipping_detail,
    } = body;

    if (!masterUserId) {
      console.warn("[/api/auth/sync PATCH] Missing masterUserId!");
      return NextResponse.json(
        { error: "masterUserId는 필수입니다." },
        { status: 400 }
      );
    }

    const payload = {
      shipping_recipient,
      shipping_phone,
      shipping_zipcode,
      shipping_address,
      shipping_detail,
    };
    console.log("[/api/auth/sync PATCH] Sending payload to updateMasterUser:", JSON.stringify(payload, null, 2));

    const masterUser = await updateMasterUser(masterUserId, payload);
    console.log("[/api/auth/sync PATCH] Result from updateMasterUser:", JSON.stringify(masterUser, null, 2));

    return NextResponse.json({ success: true, ...masterUser });
  } catch (error) {
    console.error("[/api/auth/sync PATCH] Exception occurred:", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

