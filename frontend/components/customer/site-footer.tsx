import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-[1120px] px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-[360px] text-[13px] leading-relaxed text-muted">
              허니문·효도·골프·트레킹, 네 가지 테마로 준비한 맞춤 패키지. 출발부터 도착까지 미스터 월드가 함께합니다.
            </p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-ink">고객센터</p>
            <p className="mt-2 text-[22px] font-bold tabular text-ink">1588-0000</p>
            <p className="text-[13px] text-muted">평일 09:00–18:00 (점심 12:00–13:00)</p>
            <p className="text-[13px] text-muted">주말·공휴일 휴무</p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-ink">안내</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
              <li>
                <Link href="/#faq" className="hover:text-primary">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="font-semibold hover:text-primary">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/staff" className="hover:text-primary">
                  직원 로그인
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-6 text-[12px] leading-relaxed text-muted-2">
          <p>
            (주)미스터 월드 여행사 · 대표 김운영 · 서울특별시 동대문구 왕산로 200, 5층 · 사업자등록번호 204-81-00000 ·
            관광사업자 등록번호 제2026-000012호 · 통신판매업 신고 2026-서울동대문-0001
          </p>
          <p className="mt-1">
            여행 계약은 등록 여행업자의 약관을 따르며, 영업보증보험 가입 업체입니다. © 2026 Mr. World Travel. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
