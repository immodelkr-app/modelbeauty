// ============================================================
// API 라우트: 비밀번호 재설정
// POST /api/auth/reset-password
// ============================================================
// [1단계] nickname + realName + phone → 본인확인 (앱 구분 없이 마스터 유저 레벨 검증)
//         → MOCA·IMFF에만 가입된 유저도 통과 가능
// [2단계] masterUserId + uid(optional) + newPassword → 비밀번호 변경
//         → 모델뷰티 Supabase Auth 계정 없으면 im-core-auth sync 후 자동 생성

import { NextRequest, NextResponse } from "next/server";
import { getMasterUserByNickname, getMasterUser, syncMasterUser } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── 2단계: 비밀번호 변경 ──────────────────────────────────
    if (body.masterUserId && body.newPassword) {
      const { masterUserId, newPassword, phoneNumber, nickname, realName } = body as {
        masterUserId: string;
        newPassword: string;
        phoneNumber?: string;
        nickname?: string;
        realName?: string;
        uid?: string; // 하위 호환용 (기존 클라이언트)
      };

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json(
          { error: "비밀번호는 6자리 이상이어야 합니다." },
          { status: 400 }
        );
      }

      const adminClient = createSupabaseAdmin();
      const phoneDigits = (phoneNumber || "").replace(/\D/g, "");

      // ── 모델뷰티 Supabase Auth에서 master_user_id로 기존 계정 탐색 ──
      const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = allUsers.find(
        (u) => u.user_metadata?.master_user_id === masterUserId
      );

      if (existingUser) {
        // 계정이 이미 존재하는 경우 → 비밀번호 업데이트
        const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: newPassword,
        });
        if (updateError) {
          console.error("[POST /api/auth/reset-password] 비밀번호 변경 실패:", updateError);
          return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
        }
        return NextResponse.json({ success: true }, { status: 200 });
      }

      // ── 모델뷰티 Supabase Auth 계정이 없는 경우 (MOCA·IMFF 전용 유저) ──
      // im-core-auth에 MODEL_BEAUTY 연동 생성 후 Supabase Auth 계정 신규 생성
      if (!phoneDigits) {
        return NextResponse.json(
          { error: "계정 생성에 필요한 휴대폰 번호 정보가 없습니다." },
          { status: 400 }
        );
      }

      const authEmail = `${phoneDigits}@modelbeauty.kr`;

      console.log(`[reset-password] 신규 모델뷰티 계정 생성 진행. masterUserId: ${masterUserId}, email: ${authEmail}`);

      // Supabase Auth 계정 신규 생성
      const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          master_user_id: masterUserId,
          name: nickname || null,
          real_name: realName || null,
          phone: phoneDigits,
        },
      });

      if (createError || !newUserData?.user) {
        console.error("[POST /api/auth/reset-password] Supabase 계정 생성 실패:", createError);
        return NextResponse.json(
          { error: "계정 생성에 실패했습니다." },
          { status: 500 }
        );
      }

      const newLocalUserId = newUserData.user.id;

      // im-core-auth에 MODEL_BEAUTY 앱 연동 생성 (비중단)
      try {
        await syncMasterUser({
          phoneNumber: phoneDigits,
          appName: "MODEL_BEAUTY",
          localUserId: newLocalUserId,
          name: realName || nickname || undefined,
          nickname: nickname || undefined,
        });
      } catch (syncErr) {
        console.warn("[reset-password] im-core-auth sync 실패 (비중단):", syncErr);
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── 하위 호환: uid 기반 2단계 (기존 클라이언트에서 uid를 보내는 경우) ──
    if (body.uid && body.newPassword) {
      const { uid, newPassword, phoneNumber, nickname, realName } = body as {
        uid: string;
        newPassword: string;
        phoneNumber?: string;
        nickname?: string;
        realName?: string;
      };

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json({ error: "비밀번호는 6자리 이상이어야 합니다." }, { status: 400 });
      }

      const adminClient = createSupabaseAdmin();

      const { error: updateError } = await adminClient.auth.admin.updateUserById(uid, {
        password: newPassword,
      });

      if (updateError) {
        const isUserNotFound =
          updateError.message?.toLowerCase().includes("not found") ||
          updateError.status === 404;

        if (isUserNotFound && phoneNumber) {
          const phoneDigits = phoneNumber.replace(/\D/g, "");
          const authEmail = `${phoneDigits}@modelbeauty.kr`;

          const { error: createError } = await adminClient.auth.admin.createUser({
            id: uid,
            email: authEmail,
            password: newPassword,
            email_confirm: true,
            user_metadata: {
              name: nickname || "가입자",
              real_name: realName || "가입자",
              phone: phoneDigits,
            },
          });

          if (createError) {
            console.error("[POST /api/auth/reset-password] 유저 강제 생성 실패:", createError);
            return NextResponse.json({ error: "계정 생성 및 비밀번호 변경에 실패했습니다." }, { status: 500 });
          }

          return NextResponse.json({ success: true }, { status: 200 });
        }

        console.error("[POST /api/auth/reset-password] 비밀번호 변경 실패:", updateError);
        return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── 1단계: 본인 확인 (크로스앱 지원) ──────────────────────
    const { nickname, realName, phoneNumber } = body as {
      nickname?: string;
      realName?: string;
      phoneNumber?: string;
    };

    if (!nickname?.trim() || !realName?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json(
        { found: false, error: "nickname, realName, phoneNumber는 모두 필수입니다." },
        { status: 400 }
      );
    }

    const phoneDigits = phoneNumber.replace(/\D/g, "");

    // 아임모델 공화국에서 닉네임으로 마스터 유저 조회
    const masterUserRef = await getMasterUserByNickname(nickname.trim());
    console.log("[DEBUG reset-password] masterUserRef:", JSON.stringify(masterUserRef));

    if (!masterUserRef) {
      return NextResponse.json(
        { found: false, error: "일치하는 회원 정보를 찾을 수 없습니다." },
        { status: 200 }
      );
    }

    // 마스터 유저 상세 조회 → 실명 + 휴대폰번호 검증
    let masterUserDetail;
    try {
      masterUserDetail = await getMasterUser(masterUserRef.masterUserId);
      console.log("[DEBUG reset-password] masterUserDetail:", JSON.stringify(masterUserDetail));
    } catch (e) {
      console.log("[DEBUG reset-password] getMasterUser threw:", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { found: false, error: "회원 정보 조회에 실패했습니다." },
        { status: 200 }
      );
    }

    // 휴대폰번호 일치 확인 (숫자만 비교)
    const masterPhone = (masterUserDetail.phoneNumber || "").replace(/\D/g, "");
    console.log("[DEBUG reset-password] masterPhone:", masterPhone, "phoneDigits:", phoneDigits);
    if (masterPhone !== phoneDigits) {
      return NextResponse.json(
        { found: false, error: "일치하는 회원 정보를 찾을 수 없습니다." },
        { status: 200 }
      );
    }

    // 실명 일치 확인 (im-core-auth에 realName 필드가 있으면 검증, 없으면 패스)
    // @ts-expect-error realName은 마스터유저 확장 필드
    const masterRealName: string | null = masterUserDetail.realName ?? masterUserDetail.real_name ?? null;
    if (masterRealName && masterRealName.trim() !== realName.trim()) {
      return NextResponse.json(
        { found: false, error: "일치하는 회원 정보를 찾을 수 없습니다." },
        { status: 200 }
      );
    }

    // ── 모델뷰티 Supabase Auth에서 로컬 uid 조회 시도 ──────────
    // master_user_id metadata로 매핑된 계정이 있는지 확인
    const adminClient = createSupabaseAdmin();
    const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const localUser = allUsers.find(
      (u) => u.user_metadata?.master_user_id === masterUserRef.masterUserId
    );

    return NextResponse.json(
      {
        found: true,
        // 기존 클라이언트 하위 호환: uid가 없으면 null (2단계에서 masterUserId로 처리)
        uid: localUser?.id ?? null,
        masterUserId: masterUserRef.masterUserId,
        phoneNumber: masterPhone,
        nickname: nickname.trim(),
        realName: masterRealName || realName.trim(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
