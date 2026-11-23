import Link from "next/link";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-10 text-ink">
      <h1 className="text-[28px] font-bold">시연 서비스 이용 안내</h1>
      <p className="mt-4 leading-relaxed text-muted">미스터 월드 테마 투어는 소프트웨어공학 프로젝트를 시연하는 서비스입니다. 이 페이지는 시연 범위를 안내하며, 실제 여행 상품 판매 약관은 아닙니다.</p>
      <section className="mt-8 space-y-3">
        <h2 className="text-[19px] font-bold">예약과 결제</h2>
        <p className="leading-relaxed">상품 선택, 예약, 동행 초대와 취소를 체험할 수 있습니다. 결제는 시뮬레이션으로 처리되며 카드 청구나 계좌이체가 발생하지 않습니다. 예약 확정 화면은 실제 여행 출발을 보장하지 않습니다.</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-[19px] font-bold">시연 계정과 입력 정보</h2>
        <p className="leading-relaxed">다른 서비스에서 사용하는 비밀번호, 실제 개인정보나 금융정보를 입력하지 마세요. 시연 데이터는 초기화될 수 있습니다.</p>
        <Link href="/privacy" className="inline-block font-semibold text-primary underline">시연 데이터 안내 보기</Link>
      </section>
      <Link href="/" className="mt-10 inline-block font-semibold text-primary">홈으로 돌아가기</Link>
    </article>
  );
}
