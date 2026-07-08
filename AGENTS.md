<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🚀 Vercel 배포 및 개발 프로세스 규칙 (Deployment & Build Rules)

이 프로젝트는 Vercel을 통해 자동 배포되므로 아래 규칙을 엄격히 준수하여 실수를 원천 방지합니다.

1. **원격 배포 브랜치 사전 확인 및 자동 병합**
   - 소스코드 수정이 완료되고 사용자가 배포를 요청하면, 현재 원격 배포 브랜치(기본값: `main`)를 확인합니다.
   - 개발 브랜치(`crew-settlement-admin-system` 등)의 내용을 반드시 원격의 최신 `main` 브랜치에 병합(Merge)하여 `main` 브랜치로 푸시(Push)함으로써 실서비스 주소에 즉시 배포가 반영되도록 처리합니다.

2. **로컬 빌드 검증 의무화**
   - 깃허브 푸시를 진행하기 전, 반드시 로컬 환경에서 `npm run build`를 실행하여 컴파일 및 TypeScript 타입 검사 오류가 없는지 1차 확인합니다.

3. **신규 환경변수(Env) 등록 안내**
   - 새로운 기능(암호화 대칭키, 외부 API 등) 추가로 신규 환경변수가 도입될 경우, 사용자가 Vercel 설정에 즉시 등록할 수 있도록 변수명과 용도를 명확히 텍스트로 가이드하여 전달합니다.

# 🗣️ 용어 및 소통 규칙 (Terminology Rules)

1. **통합 인증 및 포인트 시스템 명칭**
   - 프로젝트 내 통합 인증/포인트 서버를 가리키는 `im-core-auth`는 소통 시 **'아임모델 공화국'** (또는 '아임모델 광화국')으로 지칭하여 이야기합니다.


