import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// .env.local 파일 파싱 및 process.env에 명시적으로 주입
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

// core-auth.ts 헬퍼를 가져오기 전에 환경 변수를 로드해야 함
const { syncMasterUser } = require("../src/lib/core-auth");

const sanitizeEnv = (val: string | undefined) => {
  if (!val) return "";
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, "");
};

const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createTestUser() {
  const nickname = "test";
  const realName = "구글테스터";
  const password = "test1234!";
  const phoneNumber = "01000001234";

  console.log("Starting creation of Google Play tester account...");
  console.log(`Nickname: ${nickname}, RealName: ${realName}, Phone: ${phoneNumber}`);

  try {
    const authEmail = `${phoneNumber}@modelbeauty.kr`;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'model_beauty' },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("1. Creating user in Supabase Auth...");
    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: nickname,
        real_name: realName,
        phone: phoneNumber,
      },
    });

    if (signUpError) {
      if (signUpError.message?.includes("already registered") || signUpError.code === "email_exists") {
        console.log("User already exists in Supabase. Proceeding to sync status...");
      } else {
        throw signUpError;
      }
    }

    const user = authData?.user;
    let userId = user?.id;

    if (!userId) {
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;
      const existingUser = users.find(u => u.email === authEmail);
      if (existingUser) {
        userId = existingUser.id;
        console.log(`Found existing Supabase User ID: ${userId}`);
      }
    }

    if (userId) {
      console.log("2. Syncing master user with im-core-auth (아임모델 공화국)...");
      const masterUser = await syncMasterUser({
        phoneNumber,
        appName: "MODEL_BEAUTY",
        localUserId: userId,
        name: realName,
        realName,
        nickname,
      });

      console.log("Master user sync completed:", masterUser);

      if (masterUser && (masterUser as any).masterUserId) {
        console.log("3. Updating local metadata with master_user_id...");
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            master_user_id: (masterUser as any).masterUserId,
            name: nickname,
            real_name: realName,
            phone: phoneNumber,
          },
        });
      }
    }

    console.log("🎉 Test account successfully created and synchronized!");
  } catch (error) {
    console.error("❌ Failed to create tester account:", error);
  }
}

createTestUser();
