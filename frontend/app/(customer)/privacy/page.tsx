import Link from "next/link";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-10 text-ink">
      <h1 className="text-[28px] font-bold">시연 데이터 안내</h1>
      <p className="mt-4 leading-relaxed text-muted">이 서비스는 학습용 시연입니다. 실제 개인정보 대신 가상의 이름, 이메일, 연락처와 주소를 사용해 주세요. 아래 내용은 현재 시연 기능의 데이터 사용 범위를 설명합니다.</p>
      <section className="mt-8 space-y-3">
        <h2 className="text-[19px] font-bold">회원과 예약 정보</h2>
        <p className="leading-relaxed">가입 정보와 여행자 명단은 회원 확인, 내 예약 표시, 동행 합류, 단골 할인과 이전 여행 표시 기능에 사용됩니다. 입력 내용은 시연 서버에 저장되며 초기화될 수 있습니다. 브라우저에는 로그인 유지를 위한 인증 토큰이 저장됩니다.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-[19px] font-bold">음성과 알림</h2>
        <p className="leading-relaxed">음성 명령은 마이크 사용을 허용한 뒤에만 시작됩니다. 음성 인식은 브라우저의 음성 서비스로 처리되고, 인식된 문장은 여행 검색과 화면 명령 해석에 사용됩니다. 문자 기능은 시연 환경 설정에 따라 기록만 남기거나 실제 발송될 수 있으므로 테스트용 연락처만 입력해 주세요.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-[19px] font-bold">시연을 마친 후</h2>
        <p className="leading-relaxed">공용 컴퓨터에서는 로그아웃하세요. 입력한 시연 데이터의 정리가 필요하면 프로젝트 운영 담당자에게 요청해 주세요.</p>
      </section>
      <Link href="/" className="mt-10 inline-block font-semibold text-primary">홈으로 돌아가기</Link>
    </article>
  );
}
