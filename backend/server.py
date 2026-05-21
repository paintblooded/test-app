"""
SONARA backend - FastAPI + MongoDB + WebSockets
Music collaboration platform: auth, profiles, events, projects, matching, chat, admin
"""
import os
import uuid
import json
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Literal

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Query, Depends, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sonara")

app = FastAPI(title="SONARA API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def gen_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            doc[k] = v.isoformat()
    return doc

def clean_list(docs: List[dict]) -> List[dict]:
    return [clean(d) for d in docs if d is not None]

async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

async def get_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return auth_header.split(" ", 1)[1].strip()

async def require_user(request: Request) -> dict:
    token = await get_token(request)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
    user = await get_user_by_id(session["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="User banned")
    return user

async def require_admin(request: Request) -> dict:
    user = await require_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user

async def require_super_admin(request: Request) -> dict:
    user = await require_user(request)
    if not (user.get("is_super_admin") or user.get("email") in (os.environ.get("SUPER_ADMIN_EMAILS", "").split(","))):
        raise HTTPException(status_code=403, detail="Super admin only")
    return user

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
ROLES = ["Vocalist", "Guitarist", "Bassist", "Producer", "Drummer", "DJ", "Songwriter", "Keyboardist"]
SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Professional"]
GENRES = ["Indie", "Pop", "Rock", "EDM", "Jazz", "RnB", "Hip-Hop", "Worship", "Metal", "Alternative"]
COLLAB_GOALS = ["Find Band", "Find Members", "Jam Session", "Producer Collaboration", "Gig Opportunities", "Online Collaboration"]
EVENT_TYPES = ["Jam Session", "Open Audition", "Producer Meetup", "Open Mic", "Online Collaboration"]

class GoogleSessionRequest(BaseModel):
    session_id: str

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    role: Optional[str] = None
    skill_level: Optional[str] = None
    genres: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    location: Optional[str] = None
    city: Optional[str] = None
    availability: Optional[str] = None
    portfolio: Optional[Dict[str, Any]] = None
    profile_photo: Optional[str] = None
    banner: Optional[str] = None
    demo_reels: Optional[List[Dict[str, Any]]] = None
    onboarded: Optional[bool] = None

class EventCreateRequest(BaseModel):
    title: str
    description: str
    event_type: str
    genre: List[str]
    location: str
    city: Optional[str] = None
    is_online: bool = False
    date_time: str  # ISO
    participant_limit: int = 10
    needed_roles: List[str] = []
    cover_image: Optional[str] = None
    requires_approval: bool = False

class EventUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    date_time: Optional[str] = None
    status: Optional[str] = None

class ProjectCreateRequest(BaseModel):
    title: str
    description: str
    genre: List[str]
    cover_image: Optional[str] = None
    needed_roles: List[str] = []
    is_open: bool = True

class TaskCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    assignee_id: Optional[str] = None
    status: str = "todo"

class FileCreateRequest(BaseModel):
    name: str
    file_type: str  # audio, image, note, link
    data: Optional[str] = None  # base64
    url: Optional[str] = None
    notes: Optional[str] = None

class SwipeRequest(BaseModel):
    target_id: str
    target_type: str = "user"  # user | project | band
    direction: str  # like | pass

class MessageSendRequest(BaseModel):
    chat_id: str
    type: str = "text"  # text | audio | event_invite | project_invite
    content: str  # text or base64 audio
    metadata: Optional[Dict[str, Any]] = None

class ChatCreateRequest(BaseModel):
    participant_ids: List[str]
    is_group: bool = False
    name: Optional[str] = None
    event_id: Optional[str] = None
    project_id: Optional[str] = None

class RatingRequest(BaseModel):
    rated_user_id: str
    score: int  # 1..5
    event_id: Optional[str] = None
    comment: Optional[str] = None

class ReportRequest(BaseModel):
    target_type: str  # user | event | message
    target_id: str
    reason: str
    details: Optional[str] = None

class VerificationSubmitRequest(BaseModel):
    performance_video_url: Optional[str] = None
    spotify_url: Optional[str] = None
    soundcloud_url: Optional[str] = None
    youtube_url: Optional[str] = None
    identity_note: Optional[str] = None

# ---------------------------------------------------------------------------
# Startup: indexes + seed
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.events.create_index("event_id", unique=True)
        await db.events.create_index("host_id")
        await db.projects.create_index("project_id", unique=True)
        await db.chats.create_index("chat_id", unique=True)
        await db.messages.create_index([("chat_id", 1), ("created_at", 1)])
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await db.swipes.create_index([("user_id", 1), ("target_id", 1)], unique=True)
        logger.info("Indexes ensured")
    except Exception as e:
        logger.warning(f"Index setup: {e}")
    await seed_demo()

async def seed_demo():
    count = await db.users.count_documents({"seed": True})
    if count >= 5:
        return
    demo_users = [
        ("alex_synth", "Alex Synth", "alex.demo@sonara.app", "Producer", "Advanced",
         ["EDM", "Hip-Hop"], "Los Angeles", "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400",
         ["Find Members", "Producer Collaboration"]),
        ("luna_voice", "Luna Voice", "luna.demo@sonara.app", "Vocalist", "Professional",
         ["RnB", "Pop"], "New York", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
         ["Gig Opportunities", "Online Collaboration"]),
        ("mike_drums", "Mike Beats", "mike.demo@sonara.app", "Drummer", "Intermediate",
         ["Rock", "Alternative"], "Austin", "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400",
         ["Find Band", "Jam Session"]),
        ("sara_strings", "Sara Strings", "sara.demo@sonara.app", "Guitarist", "Advanced",
         ["Indie", "Alternative"], "Brooklyn", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
         ["Find Band", "Jam Session"]),
        ("kai_dj", "Kai Pulse", "kai.demo@sonara.app", "DJ", "Professional",
         ["EDM", "Hip-Hop"], "Miami", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
         ["Gig Opportunities", "Online Collaboration"]),
        ("zara_keys", "Zara Keys", "zara.demo@sonara.app", "Keyboardist", "Advanced",
         ["Jazz", "RnB"], "Chicago", "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400",
         ["Producer Collaboration", "Jam Session"]),
    ]
    user_ids = []
    for uname, name, email, role, skill, genres, city, photo, goals in demo_users:
        uid = gen_id("user")
        user_ids.append(uid)
        await db.users.update_one(
            {"email": email},
            {"$setOnInsert": {
                "user_id": uid,
                "email": email,
                "name": name,
                "username": uname,
                "profile_photo": photo,
                "banner": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
                "role": role,
                "skill_level": skill,
                "genres": genres,
                "goals": goals,
                "city": city,
                "location": city,
                "bio": f"{role} based in {city}. Always down to collaborate on {', '.join(genres)} projects.",
                "availability": "Weekends",
                "portfolio": {"spotify": "", "soundcloud": "", "youtube": ""},
                "demo_reels": [],
                "onboarded": True,
                "reliability_score": 92,
                "attendance_rate": 0.95,
                "verified": True,
                "badges": ["Verified Musician"],
                "is_admin": False,
                "seed": True,
                "created_at": now_utc(),
            }},
            upsert=True,
        )
    # Seed events
    event_covers = [
        "https://images.unsplash.com/photo-1556021664-336d17c68d85?w=800",
        "https://images.unsplash.com/photo-1617133598406-e51e00732d9f?w=800",
        "https://images.unsplash.com/photo-1524005694952-a9221a423d31?w=800",
        "https://images.pexels.com/photos/9731331/pexels-photo-9731331.jpeg?w=800",
    ]
    user_docs = await db.users.find({"seed": True}, {"_id": 0}).to_list(20)
    host_ids = [u["user_id"] for u in user_docs]
    if not host_ids:
        return
    demo_events = [
        ("Indie Jam Tonight", "Casual jam at the loft. Bring your axe!", "Jam Session",
         ["Indie", "Alternative"], "Brooklyn Loft", "Brooklyn", False, 1,
         ["Drummer", "Bassist"], event_covers[0]),
        ("Producer x Vocalist Meetup", "Looking for vocalist for an RnB EP.", "Producer Meetup",
         ["RnB", "Pop"], "Online", "Online", True, 3,
         ["Vocalist"], event_covers[1]),
        ("Open Audition: Indie Band", "Auditioning members for a touring indie band.", "Open Audition",
         ["Indie", "Rock"], "Austin Music Hall", "Austin", False, 5,
         ["Drummer", "Bassist", "Vocalist"], event_covers[2]),
        ("EDM Producers Cypher", "Beat showcase + collaboration night.", "Producer Meetup",
         ["EDM", "Hip-Hop"], "Miami Studio", "Miami", False, 7,
         ["Producer", "DJ"], event_covers[3]),
        ("Worship Songwriting Night", "Co-writing session for worship songs.", "Jam Session",
         ["Worship"], "Online", "Online", True, 14,
         ["Songwriter", "Vocalist", "Keyboardist"], event_covers[0]),
    ]
    if await db.events.count_documents({"seed": True}) < 3:
        for i, (title, desc, etype, genres, loc, city, online, days, needed, cover) in enumerate(demo_events):
            eid = gen_id("event")
            host = host_ids[i % len(host_ids)]
            event_doc = {
                "event_id": eid,
                "host_id": host,
                "title": title,
                "description": desc,
                "event_type": etype,
                "genre": genres,
                "location": loc,
                "city": city,
                "is_online": online,
                "date_time": (now_utc() + timedelta(days=days)).isoformat(),
                "participant_limit": 12,
                "needed_roles": needed,
                "participant_ids": [host],
                "waitlist_ids": [],
                "approval_required": False,
                "cover_image": cover,
                "status": "active",
                "seed": True,
                "created_at": now_utc(),
            }
            await db.events.update_one({"title": title, "seed": True},
                                        {"$setOnInsert": event_doc}, upsert=True)
    # Seed projects
    if await db.projects.count_documents({"seed": True}) < 2:
        proj_demos = [
            ("Neon Dreams EP", "Lo-fi indie-pop EP, 5 tracks. Need vocalist + bassist.",
             ["Indie", "Pop"], ["Vocalist", "Bassist"], event_covers[1]),
            ("Worship Sessions Vol. 2", "Live worship recording, co-writers welcome.",
             ["Worship"], ["Vocalist", "Keyboardist", "Songwriter"], event_covers[2]),
        ]
        for i, (title, desc, genres, needed, cover) in enumerate(proj_demos):
            pid = gen_id("proj")
            host = host_ids[i % len(host_ids)]
            await db.projects.update_one({"title": title, "seed": True}, {"$setOnInsert": {
                "project_id": pid,
                "owner_id": host,
                "title": title,
                "description": desc,
                "genre": genres,
                "needed_roles": needed,
                "cover_image": cover,
                "is_open": True,
                "member_ids": [host],
                "tasks": [],
                "files": [],
                "seed": True,
                "created_at": now_utc(),
            }}, upsert=True)
    logger.info("Seed complete")

# ---------------------------------------------------------------------------
# Auth - Emergent Google
# ---------------------------------------------------------------------------
EMERGENT_SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

@api.post("/auth/google-callback")
async def google_callback(payload: GoogleSessionRequest):
    """Exchange session_id (from Emergent OAuth redirect) for a session_token, upsert user."""
    async with httpx.AsyncClient(timeout=15) as h:
        try:
            resp = await h.get(EMERGENT_SESSION_DATA_URL, headers={"X-Session-ID": payload.session_id})
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Auth provider unreachable: {e}")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in session data")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        # update name/picture if changed
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": data.get("name", existing.get("name")),
            "profile_photo": existing.get("profile_photo") or data.get("picture"),
            "last_login": now_utc(),
        }})
    else:
        user_id = gen_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "username": email.split("@")[0],
            "profile_photo": data.get("picture"),
            "banner": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
            "role": None,
            "skill_level": None,
            "genres": [],
            "goals": [],
            "city": None,
            "location": None,
            "bio": "",
            "availability": "",
            "portfolio": {"spotify": "", "soundcloud": "", "youtube": ""},
            "demo_reels": [],
            "onboarded": False,
            "reliability_score": 100,
            "attendance_rate": 1.0,
            "verified": False,
            "badges": [],
            "is_admin": email in os.environ.get("ADMIN_EMAILS", "").split(","),
            "created_at": now_utc(),
            "last_login": now_utc(),
        })
    # session token from emergent
    session_token = data.get("session_token") or uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    user = await get_user_by_id(user_id)
    return {"session_token": session_token, "user": clean(user)}

@api.get("/auth/me")
async def auth_me(request: Request):
    user = await require_user(request)
    return {"user": clean(user)}

@api.post("/auth/logout")
async def logout(request: Request):
    token = await get_token(request)
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Profile / Onboarding
# ---------------------------------------------------------------------------
@api.put("/profile/me")
async def update_profile(payload: UpdateProfileRequest, request: Request):
    user = await require_user(request)
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if update:
        update["updated_at"] = now_utc()
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    fresh = await get_user_by_id(user["user_id"])
    return {"user": clean(fresh)}

@api.get("/profile/{user_id}")
async def get_profile(user_id: str, request: Request):
    await require_user(request)
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    # add stats
    events_hosted = await db.events.count_documents({"host_id": user_id})
    events_joined = await db.events.count_documents({"participant_ids": user_id})
    projects = await db.projects.count_documents({"member_ids": user_id})
    ratings_cursor = db.ratings.find({"rated_user_id": user_id}, {"_id": 0})
    ratings = await ratings_cursor.to_list(500)
    avg_rating = (sum(r["score"] for r in ratings) / len(ratings)) if ratings else 0.0
    return {
        "user": clean(user),
        "stats": {
            "events_hosted": events_hosted,
            "events_joined": events_joined,
            "projects": projects,
            "avg_rating": round(avg_rating, 2),
            "ratings_count": len(ratings),
        }
    }

# ---------------------------------------------------------------------------
# Home Feed
# ---------------------------------------------------------------------------
@api.get("/feed/home")
async def home_feed(request: Request):
    user = await require_user(request)
    user_genres = set(user.get("genres") or [])
    user_city = user.get("city")

    # Nearby/active events (active, future-ish, ordered by date)
    events = await db.events.find({"status": "active"}, {"_id": 0}).sort("date_time", 1).to_list(20)

    def score_event(e):
        score = 0
        if user_city and e.get("city") == user_city:
            score += 5
        if user_genres & set(e.get("genre") or []):
            score += 3
        return -score

    nearby = sorted([e for e in events if not e.get("is_online")], key=score_event)[:10]
    online = [e for e in events if e.get("is_online")][:10]

    # Trending musicians (verified seed users + others)
    musicians = await db.users.find(
        {"onboarded": True, "user_id": {"$ne": user["user_id"]}},
        {"_id": 0}
    ).sort("reliability_score", -1).to_list(20)

    projects = await db.projects.find({"is_open": True}, {"_id": 0}).sort("created_at", -1).to_list(10)

    return {
        "nearby_events": clean_list(nearby),
        "online_events": clean_list(online),
        "trending_musicians": clean_list(musicians[:10]),
        "open_projects": clean_list(projects),
        "recommended_users": clean_list(musicians[10:20]),
    }

# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
@api.post("/events")
async def create_event(payload: EventCreateRequest, request: Request):
    user = await require_user(request)
    eid = gen_id("event")
    doc = {
        "event_id": eid,
        "host_id": user["user_id"],
        "title": payload.title,
        "description": payload.description,
        "event_type": payload.event_type,
        "genre": payload.genre,
        "location": payload.location,
        "city": payload.city or user.get("city"),
        "is_online": payload.is_online,
        "date_time": payload.date_time,
        "participant_limit": payload.participant_limit,
        "needed_roles": payload.needed_roles,
        "participant_ids": [user["user_id"]],
        "waitlist_ids": [],
        "approval_required": payload.requires_approval,
        "pending_ids": [],
        "cover_image": payload.cover_image or "https://images.unsplash.com/photo-1556021664-336d17c68d85?w=800",
        "status": "active",
        "created_at": now_utc(),
    }
    await db.events.insert_one(doc)
    return {"event": clean(doc)}

@api.get("/events")
async def list_events(request: Request, q: Optional[str] = None, genre: Optional[str] = None, city: Optional[str] = None):
    await require_user(request)
    filt: Dict[str, Any] = {"status": "active"}
    if q:
        filt["title"] = {"$regex": q, "$options": "i"}
    if genre:
        filt["genre"] = genre
    if city:
        filt["city"] = city
    events = await db.events.find(filt, {"_id": 0}).sort("date_time", 1).to_list(100)
    return {"events": clean_list(events)}

@api.get("/events/{event_id}")
async def get_event(event_id: str, request: Request):
    await require_user(request)
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    host = await get_user_by_id(event["host_id"])
    participant_ids = event.get("participant_ids", []) or []
    participants_docs = await db.users.find({"user_id": {"$in": participant_ids}}, {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "role": 1, "skill_level": 1, "verified": 1, "reliability_score": 1}).to_list(500) if participant_ids else []
    p_by_id = {p["user_id"]: clean(p) for p in participants_docs}
    participants = [p_by_id[pid] for pid in participant_ids if pid in p_by_id]
    return {
        "event": clean(event),
        "host": clean(host) if host else None,
        "participants": participants,
    }

@api.post("/events/{event_id}/join")
async def join_event(event_id: str, request: Request):
    user = await require_user(request)
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    uid = user["user_id"]
    if uid in event.get("participant_ids", []):
        return {"status": "already_joined", "event": clean(event)}
    if event.get("approval_required"):
        if uid not in event.get("pending_ids", []):
            await db.events.update_one({"event_id": event_id}, {"$push": {"pending_ids": uid}})
            await notify(event["host_id"], "event_request", f"{user.get('name')} requested to join {event['title']}", {"event_id": event_id, "user_id": uid})
        return {"status": "pending"}
    if len(event.get("participant_ids", [])) >= event.get("participant_limit", 99):
        await db.events.update_one({"event_id": event_id}, {"$addToSet": {"waitlist_ids": uid}})
        return {"status": "waitlisted"}
    await db.events.update_one({"event_id": event_id}, {"$addToSet": {"participant_ids": uid}})
    await notify(event["host_id"], "event_joined", f"{user.get('name')} joined {event['title']}", {"event_id": event_id})
    fresh = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return {"status": "joined", "event": clean(fresh)}

@api.post("/events/{event_id}/leave")
async def leave_event(event_id: str, request: Request):
    user = await require_user(request)
    await db.events.update_one(
        {"event_id": event_id},
        {"$pull": {"participant_ids": user["user_id"], "waitlist_ids": user["user_id"], "pending_ids": user["user_id"]}}
    )
    return {"status": "left"}

@api.post("/events/{event_id}/approve/{user_id}")
async def approve_event_request(event_id: str, user_id: str, request: Request):
    user = await require_user(request)
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    if event["host_id"] != user["user_id"]:
        raise HTTPException(403, "Only host can approve")
    await db.events.update_one({"event_id": event_id}, {
        "$pull": {"pending_ids": user_id},
        "$addToSet": {"participant_ids": user_id}
    })
    await notify(user_id, "event_accepted", f"You were accepted to {event['title']}", {"event_id": event_id})
    return {"status": "approved"}

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
@api.post("/projects")
async def create_project(payload: ProjectCreateRequest, request: Request):
    user = await require_user(request)
    pid = gen_id("proj")
    doc = {
        "project_id": pid,
        "owner_id": user["user_id"],
        "title": payload.title,
        "description": payload.description,
        "genre": payload.genre,
        "needed_roles": payload.needed_roles,
        "cover_image": payload.cover_image or "https://images.unsplash.com/photo-1524005694952-a9221a423d31?w=800",
        "is_open": payload.is_open,
        "member_ids": [user["user_id"]],
        "tasks": [],
        "files": [],
        "created_at": now_utc(),
    }
    await db.projects.insert_one(doc)
    return {"project": clean(doc)}

@api.get("/projects")
async def list_projects(request: Request, q: Optional[str] = None, mine: bool = False):
    user = await require_user(request)
    filt: Dict[str, Any] = {}
    if mine:
        filt["member_ids"] = user["user_id"]
    else:
        filt["is_open"] = True
    if q:
        filt["title"] = {"$regex": q, "$options": "i"}
    projects = await db.projects.find(filt, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"projects": clean_list(projects)}

@api.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    await require_user(request)
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    member_ids = project.get("member_ids", []) or []
    member_docs = await db.users.find({"user_id": {"$in": member_ids}}, {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "role": 1, "skill_level": 1, "verified": 1}).to_list(500) if member_ids else []
    m_by_id = {m["user_id"]: clean(m) for m in member_docs}
    members = [m_by_id[mid] for mid in member_ids if mid in m_by_id]
    return {"project": clean(project), "members": members}

@api.post("/projects/{project_id}/join")
async def join_project(project_id: str, request: Request):
    user = await require_user(request)
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if user["user_id"] in project.get("member_ids", []):
        return {"status": "already_member"}
    await db.projects.update_one({"project_id": project_id}, {"$addToSet": {"member_ids": user["user_id"]}})
    await notify(project["owner_id"], "project_joined", f"{user.get('name')} joined {project['title']}", {"project_id": project_id})
    return {"status": "joined"}

@api.post("/projects/{project_id}/tasks")
async def add_task(project_id: str, payload: TaskCreateRequest, request: Request):
    user = await require_user(request)
    task = {
        "task_id": gen_id("task"),
        "title": payload.title,
        "description": payload.description,
        "assignee_id": payload.assignee_id,
        "status": payload.status,
        "created_by": user["user_id"],
        "created_at": now_utc().isoformat(),
    }
    await db.projects.update_one({"project_id": project_id}, {"$push": {"tasks": task}})
    return {"task": task}

@api.put("/projects/{project_id}/tasks/{task_id}")
async def update_task(project_id: str, task_id: str, payload: TaskCreateRequest, request: Request):
    await require_user(request)
    await db.projects.update_one(
        {"project_id": project_id, "tasks.task_id": task_id},
        {"$set": {"tasks.$.title": payload.title, "tasks.$.description": payload.description,
                  "tasks.$.status": payload.status, "tasks.$.assignee_id": payload.assignee_id}}
    )
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return {"project": clean(project)}

@api.post("/projects/{project_id}/files")
async def add_file(project_id: str, payload: FileCreateRequest, request: Request):
    user = await require_user(request)
    f = {
        "file_id": gen_id("file"),
        "name": payload.name,
        "file_type": payload.file_type,
        "data": payload.data,
        "url": payload.url,
        "notes": payload.notes,
        "uploaded_by": user["user_id"],
        "uploaded_at": now_utc().isoformat(),
    }
    await db.projects.update_one({"project_id": project_id}, {"$push": {"files": f}})
    return {"file": f}

# ---------------------------------------------------------------------------
# Discover & Swipe Match
# ---------------------------------------------------------------------------
@api.get("/discover/musicians")
async def discover_musicians(request: Request, q: Optional[str] = None, genre: Optional[str] = None,
                             role: Optional[str] = None, skill: Optional[str] = None):
    user = await require_user(request)
    filt: Dict[str, Any] = {"onboarded": True, "user_id": {"$ne": user["user_id"]}}
    if q:
        filt["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"username": {"$regex": q, "$options": "i"}}]
    if genre:
        filt["genres"] = genre
    if role:
        filt["role"] = role
    if skill:
        filt["skill_level"] = skill
    users = await db.users.find(filt, {"_id": 0}).limit(100).to_list(100)
    # compute compatibility
    user_genres = set(user.get("genres") or [])
    user_goals = set(user.get("goals") or [])
    out = []
    for u in users:
        ug = set(u.get("genres") or [])
        gg = set(u.get("goals") or [])
        compat = 0
        if user_genres:
            compat += int(50 * len(ug & user_genres) / max(len(user_genres), 1))
        if user_goals:
            compat += int(30 * len(gg & user_goals) / max(len(user_goals), 1))
        compat += 20 if (u.get("city") == user.get("city")) else 5
        compat = min(99, max(15, compat))
        cleaned = clean(u)
        cleaned["compatibility"] = compat
        out.append(cleaned)
    out.sort(key=lambda x: -x["compatibility"])
    return {"musicians": out}

@api.get("/discover/swipe-deck")
async def swipe_deck(request: Request):
    user = await require_user(request)
    # exclude already-swiped
    swiped = await db.swipes.find({"user_id": user["user_id"]}, {"_id": 0, "target_id": 1}).to_list(500)
    swiped_ids = {s["target_id"] for s in swiped}
    swiped_ids.add(user["user_id"])
    candidates = await db.users.find(
        {"onboarded": True, "user_id": {"$nin": list(swiped_ids)}}, {"_id": 0}
    ).limit(30).to_list(30)
    user_genres = set(user.get("genres") or [])
    out = []
    for u in candidates:
        ug = set(u.get("genres") or [])
        compat = min(99, 30 + int(60 * len(ug & user_genres) / max(len(user_genres) or 1, 1)) + (10 if u.get("city") == user.get("city") else 0))
        cleaned = clean(u)
        cleaned["compatibility"] = compat
        out.append(cleaned)
    return {"deck": out}

@api.post("/match/swipe")
async def swipe(payload: SwipeRequest, request: Request):
    user = await require_user(request)
    swipe_doc = {
        "swipe_id": gen_id("swipe"),
        "user_id": user["user_id"],
        "target_id": payload.target_id,
        "target_type": payload.target_type,
        "direction": payload.direction,
        "created_at": now_utc(),
    }
    try:
        await db.swipes.insert_one(swipe_doc)
    except Exception:
        pass
    matched = False
    chat_id = None
    if payload.direction == "like":
        # check reciprocal
        reciprocal = await db.swipes.find_one({
            "user_id": payload.target_id,
            "target_id": user["user_id"],
            "direction": "like"
        })
        if reciprocal:
            matched = True
            # create chat
            chat = await find_or_create_chat([user["user_id"], payload.target_id])
            chat_id = chat["chat_id"]
            await db.matches.insert_one({
                "match_id": gen_id("match"),
                "user_ids": sorted([user["user_id"], payload.target_id]),
                "chat_id": chat_id,
                "created_at": now_utc(),
            })
            await notify(payload.target_id, "match", f"You matched with {user.get('name')}!", {"chat_id": chat_id, "user_id": user["user_id"]})
    return {"matched": matched, "chat_id": chat_id}

@api.get("/match/matches")
async def my_matches(request: Request):
    user = await require_user(request)
    matches = await db.matches.find({"user_ids": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    other_ids = [next((u for u in m.get("user_ids", []) if u != user["user_id"]), None) for m in matches]
    other_id_set = [oid for oid in other_ids if oid]
    other_docs = await db.users.find({"user_id": {"$in": other_id_set}}, {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1, "role": 1, "genres": 1, "city": 1, "verified": 1, "reliability_score": 1}).to_list(500) if other_id_set else []
    u_by_id = {u["user_id"]: u for u in other_docs}
    out = []
    for m, oid in zip(matches, other_ids):
        other = u_by_id.get(oid) if oid else None
        out.append({"match": clean(m), "other": clean(other) if other else None})
    return {"matches": out}

# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
async def find_or_create_chat(participant_ids: List[str], is_group: bool = False, name: Optional[str] = None,
                               event_id: Optional[str] = None, project_id: Optional[str] = None) -> dict:
    pids = sorted(set(participant_ids))
    if not is_group and len(pids) == 2:
        existing = await db.chats.find_one({"participant_ids": pids, "is_group": False}, {"_id": 0})
        if existing:
            return existing
    chat = {
        "chat_id": gen_id("chat"),
        "participant_ids": pids,
        "is_group": is_group,
        "name": name,
        "event_id": event_id,
        "project_id": project_id,
        "last_message": None,
        "created_at": now_utc(),
    }
    await db.chats.insert_one(chat)
    return chat

@api.post("/chats")
async def create_chat(payload: ChatCreateRequest, request: Request):
    user = await require_user(request)
    pids = list(set(payload.participant_ids + [user["user_id"]]))
    chat = await find_or_create_chat(pids, payload.is_group, payload.name, payload.event_id, payload.project_id)
    return {"chat": clean(chat)}

@api.get("/chats")
async def list_chats(request: Request):
    user = await require_user(request)
    chats = await db.chats.find({"participant_ids": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    other_ids: set = set()
    for c in chats:
        for pid in c.get("participant_ids", []) or []:
            if pid != user["user_id"]:
                other_ids.add(pid)
    user_docs = await db.users.find({"user_id": {"$in": list(other_ids)}}, {"_id": 0, "user_id": 1, "name": 1, "profile_photo": 1}).to_list(1000) if other_ids else []
    u_by_id = {u["user_id"]: u for u in user_docs}
    out = []
    for c in chats:
        others = []
        for pid in c.get("participant_ids", []) or []:
            if pid != user["user_id"] and pid in u_by_id:
                p = u_by_id[pid]
                others.append({"user_id": p["user_id"], "name": p.get("name"), "profile_photo": p.get("profile_photo")})
        out.append({**clean(c), "others": others})
    return {"chats": out}

@api.get("/chats/{chat_id}/messages")
async def list_messages(chat_id: str, request: Request, limit: int = 100):
    user = await require_user(request)
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    if not chat or user["user_id"] not in chat.get("participant_ids", []):
        raise HTTPException(404, "Chat not found")
    msgs = await db.messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(limit)
    # mark read
    await db.messages.update_many(
        {"chat_id": chat_id, "sender_id": {"$ne": user["user_id"]}, "read_by": {"$ne": user["user_id"]}},
        {"$addToSet": {"read_by": user["user_id"]}}
    )
    return {"messages": clean_list(msgs), "chat": clean(chat)}

@api.post("/chats/{chat_id}/messages")
async def send_message(chat_id: str, payload: MessageSendRequest, request: Request):
    user = await require_user(request)
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    if not chat or user["user_id"] not in chat.get("participant_ids", []):
        raise HTTPException(404, "Chat not found")
    msg = {
        "message_id": gen_id("msg"),
        "chat_id": chat_id,
        "sender_id": user["user_id"],
        "sender_name": user.get("name"),
        "sender_photo": user.get("profile_photo"),
        "type": payload.type,
        "content": payload.content,
        "metadata": payload.metadata or {},
        "read_by": [user["user_id"]],
        "created_at": now_utc(),
    }
    await db.messages.insert_one(msg)
    last = {"content": payload.content[:80] if payload.type == "text" else f"[{payload.type}]",
            "sender_id": user["user_id"], "created_at": now_utc().isoformat()}
    await db.chats.update_one({"chat_id": chat_id}, {"$set": {"last_message": last}})
    # broadcast to ws
    out_msg = clean(msg)
    await ws_broadcast(chat["participant_ids"], {"type": "message", "chat_id": chat_id, "message": out_msg})
    # notify others
    for pid in chat["participant_ids"]:
        if pid != user["user_id"]:
            await notify(pid, "chat_message", f"{user.get('name')} sent a message", {"chat_id": chat_id})
    return {"message": out_msg}

# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
async def notify(user_id: str, ntype: str, message: str, data: Optional[dict] = None):
    doc = {
        "notification_id": gen_id("notif"),
        "user_id": user_id,
        "type": ntype,
        "message": message,
        "data": data or {},
        "read": False,
        "created_at": now_utc(),
    }
    await db.notifications.insert_one(doc)
    await ws_broadcast([user_id], {"type": "notification", "notification": clean(doc)})

@api.get("/notifications")
async def list_notifications(request: Request):
    user = await require_user(request)
    notifs = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"notifications": clean_list(notifs)}

@api.post("/notifications/read")
async def mark_notifications_read(request: Request):
    user = await require_user(request)
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ---------------------------------------------------------------------------
# Ratings / Reputation
# ---------------------------------------------------------------------------
@api.post("/ratings")
async def rate_user(payload: RatingRequest, request: Request):
    user = await require_user(request)
    if payload.score < 1 or payload.score > 5:
        raise HTTPException(400, "score must be 1..5")
    doc = {
        "rating_id": gen_id("rate"),
        "rater_id": user["user_id"],
        "rated_user_id": payload.rated_user_id,
        "score": payload.score,
        "event_id": payload.event_id,
        "comment": payload.comment,
        "created_at": now_utc(),
    }
    await db.ratings.insert_one(doc)
    # recompute reliability
    ratings = await db.ratings.find({"rated_user_id": payload.rated_user_id}, {"_id": 0}).to_list(500)
    if ratings:
        avg = sum(r["score"] for r in ratings) / len(ratings)
        rel = int((avg / 5.0) * 100)
        await db.users.update_one({"user_id": payload.rated_user_id}, {"$set": {"reliability_score": rel}})
    return {"rating": clean(doc)}

# ---------------------------------------------------------------------------
# Reports / Moderation
# ---------------------------------------------------------------------------
@api.post("/reports")
async def report(payload: ReportRequest, request: Request):
    user = await require_user(request)
    doc = {
        "report_id": gen_id("report"),
        "reporter_id": user["user_id"],
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "reason": payload.reason,
        "details": payload.details,
        "status": "open",
        "created_at": now_utc(),
    }
    await db.reports.insert_one(doc)
    return {"report": clean(doc)}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
@api.post("/verifications")
async def submit_verification(payload: VerificationSubmitRequest, request: Request):
    user = await require_user(request)
    doc = {
        "verification_id": gen_id("verif"),
        "user_id": user["user_id"],
        "performance_video_url": payload.performance_video_url,
        "spotify_url": payload.spotify_url,
        "soundcloud_url": payload.soundcloud_url,
        "youtube_url": payload.youtube_url,
        "identity_note": payload.identity_note,
        "status": "pending",
        "created_at": now_utc(),
    }
    await db.verifications.insert_one(doc)
    return {"verification": clean(doc)}

@api.get("/verifications/me")
async def my_verification(request: Request):
    user = await require_user(request)
    v = await db.verifications.find_one({"user_id": user["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    return {"verification": clean(v) if v else None}

# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
@api.get("/admin/users")
async def admin_list_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"users": clean_list(users)}

@api.post("/admin/users/{user_id}/ban")
async def admin_ban(user_id: str, request: Request):
    await require_admin(request)
    await db.users.update_one({"user_id": user_id}, {"$set": {"banned": True}})
    return {"ok": True}

@api.post("/admin/users/{user_id}/unban")
async def admin_unban(user_id: str, request: Request):
    await require_admin(request)
    await db.users.update_one({"user_id": user_id}, {"$set": {"banned": False}})
    return {"ok": True}

@api.get("/admin/reports")
async def admin_reports(request: Request):
    await require_admin(request)
    reports = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"reports": clean_list(reports)}

@api.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, request: Request):
    await require_admin(request)
    await db.reports.update_one({"report_id": report_id}, {"$set": {"status": "resolved"}})
    return {"ok": True}

@api.get("/admin/verifications")
async def admin_verifications(request: Request):
    await require_admin(request)
    v = await db.verifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"verifications": clean_list(v)}

@api.post("/admin/verifications/{verification_id}/approve")
async def admin_approve_verification(verification_id: str, request: Request):
    await require_admin(request)
    v = await db.verifications.find_one({"verification_id": verification_id}, {"_id": 0})
    if not v:
        raise HTTPException(404)
    await db.verifications.update_one({"verification_id": verification_id}, {"$set": {"status": "approved"}})
    await db.users.update_one({"user_id": v["user_id"]}, {"$set": {"verified": True}, "$addToSet": {"badges": "Verified Musician"}})
    await notify(v["user_id"], "verification_approved", "Your verification was approved.", {})
    return {"ok": True}

@api.post("/admin/verifications/{verification_id}/reject")
async def admin_reject_verification(verification_id: str, request: Request):
    await require_admin(request)
    await db.verifications.update_one({"verification_id": verification_id}, {"$set": {"status": "rejected"}})
    return {"ok": True}

@api.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, request: Request):
    await require_admin(request)
    await db.events.delete_one({"event_id": event_id})
    return {"ok": True}

@api.get("/admin/analytics")
async def admin_analytics(request: Request):
    await require_admin(request)
    users_total = await db.users.count_documents({})
    events_total = await db.events.count_documents({})
    projects_total = await db.projects.count_documents({})
    matches_total = await db.matches.count_documents({})
    messages_total = await db.messages.count_documents({})
    reports_open = await db.reports.count_documents({"status": "open"})
    verifications_pending = await db.verifications.count_documents({"status": "pending"})
    # genre popularity
    pipeline = [{"$unwind": "$genres"}, {"$group": {"_id": "$genres", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    genres_agg = await db.users.aggregate(pipeline).to_list(20)
    cities_pipeline = [{"$match": {"city": {"$ne": None}}}, {"$group": {"_id": "$city", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 10}]
    cities_agg = await db.users.aggregate(cities_pipeline).to_list(10)
    return {
        "users": users_total,
        "events": events_total,
        "projects": projects_total,
        "matches": matches_total,
        "messages": messages_total,
        "reports_open": reports_open,
        "verifications_pending": verifications_pending,
        "genres": [{"genre": g["_id"], "count": g["count"]} for g in genres_agg],
        "cities": [{"city": c["_id"], "count": c["count"]} for c in cities_agg],
    }

# ---------------------------------------------------------------------------
# Dev tools
# ---------------------------------------------------------------------------
@api.get("/dev/health")
async def dev_health():
    return {"ok": True, "time": now_utc().isoformat(), "ws_clients": sum(len(v) for v in WS_CLIENTS.values())}

@api.post("/dev/test-login")
async def dev_test_login(payload: Dict[str, Any]):
    """DEV-ONLY: Issue a session token for a seeded test user (Google OAuth bypass for automated tests)."""
    if not os.environ.get("ALLOW_DEV_LOGIN", "1") == "1":
        raise HTTPException(403, "Disabled")
    email = (payload or {}).get("email") or "alex.demo@sonara.app"
    is_admin = bool((payload or {}).get("admin"))
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # create
        uid = gen_id("user")
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": email.split("@")[0],
            "username": email.split("@")[0], "profile_photo": None,
            "banner": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
            "role": None, "skill_level": None, "genres": [], "goals": [], "city": None,
            "bio": "", "availability": "", "portfolio": {}, "demo_reels": [],
            "onboarded": False, "reliability_score": 100, "verified": False, "badges": [],
            "is_admin": is_admin, "created_at": now_utc(),
        })
        user = await db.users.find_one({"email": email}, {"_id": 0})
    if is_admin and not user.get("is_admin"):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"is_admin": True}})
        user["is_admin"] = True
    session_token = uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user["user_id"],
        "created_at": now_utc(), "expires_at": now_utc() + timedelta(days=7),
    })
    return {"session_token": session_token, "user": clean(user)}

@api.get("/dev/stats")
async def dev_stats(request: Request):
    await require_admin(request)
    return {
        "ws_connected_users": list(WS_CLIENTS.keys()),
        "ws_client_count": sum(len(v) for v in WS_CLIENTS.values()),
    }

# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
WS_CLIENTS: Dict[str, List[WebSocket]] = {}

async def ws_broadcast(user_ids: List[str], payload: dict):
    msg = json.dumps(payload, default=str)
    for uid in user_ids:
        for ws in WS_CLIENTS.get(uid, []):
            try:
                await ws.send_text(msg)
            except Exception:
                pass

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        await websocket.close(code=4401)
        return
    user_id = session["user_id"]
    await websocket.accept()
    WS_CLIENTS.setdefault(user_id, []).append(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "connected", "user_id": user_id}))
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except Exception:
                continue
            ptype = payload.get("type")
            if ptype == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif ptype == "typing":
                chat_id = payload.get("chat_id")
                chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
                if chat:
                    others = [p for p in chat["participant_ids"] if p != user_id]
                    await ws_broadcast(others, {"type": "typing", "chat_id": chat_id, "user_id": user_id})
            elif ptype == "read":
                chat_id = payload.get("chat_id")
                await db.messages.update_many(
                    {"chat_id": chat_id, "sender_id": {"$ne": user_id}, "read_by": {"$ne": user_id}},
                    {"$addToSet": {"read_by": user_id}}
                )
                chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
                if chat:
                    others = [p for p in chat["participant_ids"] if p != user_id]
                    await ws_broadcast(others, {"type": "read", "chat_id": chat_id, "user_id": user_id})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS error: {e}")
    finally:
        if user_id in WS_CLIENTS:
            try:
                WS_CLIENTS[user_id].remove(websocket)
            except ValueError:
                pass
            if not WS_CLIENTS[user_id]:
                del WS_CLIENTS[user_id]

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "SONARA", "status": "ok"}

@api.get("/meta/options")
async def meta_options():
    return {
        "roles": ROLES,
        "skill_levels": SKILL_LEVELS,
        "genres": GENRES,
        "goals": COLLAB_GOALS,
        "event_types": EVENT_TYPES,
    }

# ---------------------------------------------------------------------------
# Include router + CORS
# ---------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
