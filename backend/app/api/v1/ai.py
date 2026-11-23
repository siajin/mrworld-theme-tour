from fastapi import APIRouter

from app.core.deps import DbDep, OptionalUser
from app.schemas.ai import AIParseResult, ChatIn, ChatOut, ConversationIn, ConversationOut, ParseIn
from app.services.ai import AIService
from app.services.voice_conversation import VoiceConversationService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse", response_model=AIParseResult)
def parse(payload: ParseIn, db: DbDep) -> AIParseResult:
    result, _matched = AIService(db).parse(payload.text, payload.context)
    return result


@router.post("/chat", response_model=ChatOut)
def chat(payload: ChatIn, db: DbDep) -> ChatOut:
    reply, cards = AIService(db).chat(payload.messages)
    return ChatOut(reply=reply, packages=cards)


@router.post("/conversation", response_model=ConversationOut)
def conversation(payload: ConversationIn, db: DbDep, user: OptionalUser) -> ConversationOut:
    return VoiceConversationService(db).respond(payload, user)
