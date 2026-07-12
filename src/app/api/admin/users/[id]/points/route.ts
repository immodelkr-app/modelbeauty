// ============================================================
// API 라우트: 관리자 - 회원 적립금(포인트) 수동 지급/차감
// POST /api/admin/users/[id]/points
// body: { amount: number, description: string }
//   amount > 0 : 지급 (rewardPoints)
//   amount < 0 : 차감 (deductPoints)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { rewardPoints, deductPoints } from "@/lib/core-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: masterUserId } = await params;
    const body = await request.json();
    const { amount, description } = body;

    if (typeof amount !== "number" || amount === 0) {
      return NextResponse.json(
        { success: false, error: "유효한 포인트 금액을 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string" || description.trim() === "") {
      return NextResponse.json(
        { success: false, error: "지급/차감 사유를 입력해 주세요." },
        { status: 400 }
      );
    }

    let result;

    if (amount > 0) {
      // 적립금 지급
      result = await rewardPoints({
        masterUserId,
        amount,
        description: `[어드민 수동 지급] ${description.trim()}`,
      });
    } else {
      // 적립금 차감 (음수 → 양수로 변환)
      result = await deductPoints({
        masterUserId,
        amount: Math.abs(amount),
        description: `[어드민 수동 차감] ${description.trim()}`,
      });
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("[POST /api/admin/users/[id]/points] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "포인트 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
