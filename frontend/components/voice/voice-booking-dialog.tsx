"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Send, Square, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { won } from "@/lib/format";
import type { Booking, Package, Quote, VoiceConversationResult, VoiceConversationState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSpeechRecognition } from "./use-speech-recognition";

type Message = { role: "user" | "assistant"; text: string };
type Preview = { package: Package; quote: Quote; departure: string };

/** 질문과 선택을 이어 가고, 마지막 동의 후에만 기존 예약·결제 API를 호출한다. */
export function VoiceBookingDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VoiceConversationResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [completed, setCompleted] = useState<Booking | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const bookingInFlight = useRef(false);
  const bookingId = useRef<number | null>(null);
  const conversation = useRef<VoiceConversationState | null>(null);
  const autoRef = useRef(true);
  const completedRef = useRef(false);
  const speechGeneration = useRef(0);
  const speechTimer = useRef<number | null>(null);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => {});
  const transcriptEnd = useRef<HTMLDivElement | null>(null);

  const speech = useSpeechRecognition({
    onFinal: (text) => { void submitRef.current(text); },
    onError: (_kind, message) => {
      if (!alive.current) return;
      autoRef.current = false;
      setAutoListen(false);
      setError(message + " 아래 입력창으로도 계속할 수 있어요.");
    },
  });
  const { abort, start, stop, supported, state: speechState, interim } = speech;

  const stopSpeaking = useCallback(() => {
    speechGeneration.current += 1;
    if (speechTimer.current !== null) window.clearTimeout(speechTimer.current);
    speechTimer.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const announce = useCallback((text: string, listenAfter = true) => {
    abort();
    stopSpeaking();
    const token = speechGeneration.current;
    const resume = () => {
      if (!alive.current || token !== speechGeneration.current) return;
      if (speechTimer.current !== null) window.clearTimeout(speechTimer.current);
      speechTimer.current = null;
      setSpeaking(false);
      if (listenAfter && autoRef.current && supported && !completedRef.current) {
        speechTimer.current = window.setTimeout(() => {
          if (alive.current && token === speechGeneration.current && !inFlight.current && !bookingInFlight.current) start();
        }, 250);
      }
    };
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { resume(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1.12;
    utterance.onend = resume;
    utterance.onerror = resume;
    setSpeaking(true);
    try {
      window.speechSynthesis.speak(utterance);
      speechTimer.current = window.setTimeout(() => {
        if (token !== speechGeneration.current) return;
        window.speechSynthesis.cancel();
        resume();
      }, Math.min(40000, Math.max(7000, text.length * 145)));
    } catch { resume(); }
  }, [abort, start, stopSpeaking, supported]);

  const finishBooking = useCallback(async (r: VoiceConversationResult) => {
    if (!r.booking_options || bookingInFlight.current || completedRef.current) return;
    if (!user) {
      setError("예약을 마치려면 먼저 로그인해 주세요. 로그인 후 음성 예약을 다시 시작할 수 있어요.");
      announce("예약을 마치려면 먼저 로그인해 주세요.", false);
      return;
    }
    bookingInFlight.current = true;
    try {
      // 재고·날짜·인원과 로그인 회원의 할인을 예약 직전에 다시 확인한다.
      await api.bookings.quote(r.booking_options);
      let booking: Booking;
      if (bookingId.current !== null) booking = await api.bookings.get(bookingId.current);
      else {
        booking = await api.bookings.create({
          ...r.booking_options,
          travelers: Array.from({ length: r.booking_options.travelers_count }, (_, index) => ({
            name: index === 0 ? user.name : `동행 ${index}`,
            phone: index === 0 ? user.phone : "",
            is_representative: index === 0,
          })),
          memo: "대화형 음성 예약 · 동행 이름은 예약 상세에서 확인해 주세요",
        });
        bookingId.current = booking.id;
        if (alive.current) setPendingBookingId(booking.id);
      }
      // 생성 후 결제가 실패하더라도 같은 예약 번호로만 재시도한다.
      if (booking.status === "pending") booking = await api.bookings.pay(booking.id, "card");
      if (!alive.current) return;
      completedRef.current = true;
      setCompleted(booking);
      setError(null);
      const reply = `${booking.departure.depart_date} 출발 ${booking.package.title}, ${booking.travelers_count}명 예약이 ${booking.status === "gathering" ? "동행 모집 중으로 접수" : "확정"}되었어요. 예약 번호는 ${booking.code}입니다. 감사합니다.`;
      setMessages((old) => [...old, { role: "assistant", text: reply }]);
      announce(reply, false);
    } catch (err) {
      if (!alive.current) return;
      const message = err instanceof Error ? err.message : "예약을 처리하지 못했어요. 다시 시도해 주세요.";
      setError(bookingId.current !== null ? `${message} 생성된 예약을 유지했어요. 결제 다시 시도 또는 예약 상세 보기를 선택해 주세요.` : message);
      autoRef.current = false;
      setAutoListen(false);
    } finally { bookingInFlight.current = false; }
  }, [announce, user]);

  const submit = useCallback(async (text: string) => {
    const said = text.trim().slice(0, 1000);
    if (inFlight.current || bookingInFlight.current || completedRef.current) return;
    const token = ++generation.current;
    inFlight.current = true;
    abort();
    stopSpeaking();
    setBusy(true);
    setError(null);
    setInput("");
    if (said) setMessages((old) => [...old, { role: "user", text: said }]);
    try {
      const r = await api.ai.conversation(said, conversation.current);
      if (!alive.current || token !== generation.current) return;
      conversation.current = r.state;
      setResponse(r);
      const reply = r.reply;
      setMessages((old) => [...old, { role: "assistant", text: reply }]);
      if (r.booking_options) {
        const options = r.booking_options;
        const [quote, pkg] = await Promise.all([api.bookings.quote(options), api.packages.get(options.package_id)]);
        if (!alive.current || token !== generation.current) return;
        setPreview({ package: pkg, quote, departure: pkg.departures.find((d) => d.id === options.departure_id)?.depart_date ?? "" });
      } else setPreview(null);
      if (r.ready_to_book) await finishBooking(r);
      else announce(reply);
    } catch (err) {
      if (!alive.current || token !== generation.current) return;
      setError(err instanceof Error ? err.message : "대화 연결에 실패했어요. 다시 말씀하거나 입력해 주세요.");
    } finally {
      if (alive.current && token === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, [abort, announce, finishBooking, stopSpeaking]);

  useEffect(() => { submitRef.current = submit; }, [submit]);
  useEffect(() => {
    alive.current = true;
    void submitRef.current("");
    return () => {
      alive.current = false;
      generation.current += 1;
      inFlight.current = false;
      speechGeneration.current += 1;
      abort();
      if (speechTimer.current !== null) window.clearTimeout(speechTimer.current);
      window.speechSynthesis?.cancel();
    };
  }, [abort]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, error]);

  const close = () => {
    if (bookingInFlight.current) return;
    generation.current += 1;
    abort();
    stopSpeaking();
    onClose();
  };
  const restart = () => {
    if (busy || bookingInFlight.current || bookingId.current !== null) return;
    conversation.current = null;
    setMessages([]);
    setPreview(null);
    setResponse(null);
    autoRef.current = true;
    setAutoListen(true);
    void submit("");
  };
  const manualListen = () => {
    if (busy || completed || pendingBookingId !== null) return;
    if (speechState === "listening") { stop(); return; }
    stopSpeaking();
    setError(null);
    start();
  };
  const retryBooking = async () => {
    if (!response || busy || inFlight.current || bookingInFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await finishBooking(response); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };

  return (
    <Modal open onClose={close} title="대화형 음성 예약" size="lg">
      <p className="mb-3 text-[13px] text-muted">여행 추천부터 옵션 선택과 예약까지 대화로 진행해요. 말하기가 어려우면 직접 입력해도 돼요.</p>
      <div className="mb-3 flex items-center justify-between gap-2 text-[13px]">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={autoListen} disabled={!!completed} onChange={(e) => { autoRef.current = e.target.checked; setAutoListen(e.target.checked); if (!e.target.checked) abort(); }} />안내 후 자동으로 듣기</label>
        <Button variant="ghost" size="sm" disabled={busy || !!completed || pendingBookingId !== null} onClick={restart}><RotateCcw className="size-4" />다시 시작</Button>
      </div>
      <div className="max-h-[42dvh] space-y-3 overflow-y-auto rounded-xl border border-line bg-bg p-3" role="log" aria-label="예약 대화" aria-live="polite">
        {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-primary px-3 py-2 text-white" : "mr-4 rounded-xl border border-line bg-surface px-3 py-2 text-ink"}><p className="mb-1 text-[11px] font-bold opacity-70">{m.role === "user" ? "나" : "미스터 월드"}</p><p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.text}</p></div>)}
        {busy && <p className="text-[13px] text-muted">{response?.ready_to_book ? "예약을 처리하고 있어요…" : "답변을 준비하고 있어요…"}</p>}
        <div ref={transcriptEnd} />
      </div>
      {preview && <div className="mt-3 rounded-xl border border-line px-3 py-2 text-[13px]"><p className="font-bold">{preview.package.title}</p><p>{preview.departure} 출발 · {preview.quote.travelers_count}명 · 총 {won(preview.quote.total)} · 예약금 {won(preview.quote.deposit)}</p><p className="mt-1 text-muted">식사 추가옵션 수량은 1인 기준이에요. 최종 동의 후 모의 결제로 예약해요. 동행은 임시 표시명으로 저장돼요.</p></div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-[13px] text-danger">{error}</p>}
      {completed ? <Button full className="mt-4" onClick={() => { const id = completed.id; close(); router.push(`/booking/complete/${id}`); }}>예약 완료 화면 보기</Button> : <>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={busy || !supported || pendingBookingId !== null} onClick={manualListen}>{speechState === "listening" ? <Square className="size-4" /> : <Mic className="size-4" />}{speechState === "listening" ? "말하기 끝내기" : "말하기"}</Button>
          {speaking && <Button variant="ghost" size="sm" onClick={stopSpeaking}><Volume2 className="size-4" />안내 멈추기</Button>}
          <span className="text-[12px] text-muted">{speechState === "listening" ? interim || "듣고 있어요…" : speaking ? "안내하고 있어요…" : !supported ? "음성 미지원 브라우저예요. 아래에 입력해 주세요." : "안내가 끝난 뒤 말씀해 주세요."}</span>
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) void submit(input); }}>
          <input aria-label="대화 내용 입력" value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy || pendingBookingId !== null} placeholder="예: 다음 달 오늘에 결혼해요" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[14px]" />
          <Button type="submit" disabled={busy || !input.trim() || pendingBookingId !== null} aria-label="대화 보내기"><Send className="size-4" /></Button>
        </form>
        {!user && <Button variant="outline" full className="mt-3" onClick={() => { close(); router.push("/login"); }}>로그인하고 예약하기</Button>}
        {response?.ready_to_book && user && <Button full className="mt-3" loading={busy} onClick={() => { void retryBooking(); }}>{pendingBookingId !== null ? "결제 다시 시도" : "확인하고 예약하기"}</Button>}
        {pendingBookingId !== null && <Button variant="outline" full className="mt-2" disabled={busy} onClick={() => { const id = pendingBookingId; close(); router.push(`/me/bookings/${id}`); }}>생성된 예약 상세 보기</Button>}
      </>}
    </Modal>
  );
}
