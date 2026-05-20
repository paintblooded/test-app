"""SONARA backend API integration tests."""
import os
import json
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://jam-hub-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _no_objectid(obj):
    """Recursively check that no '_id' key exists in a response."""
    if isinstance(obj, dict):
        if "_id" in obj:
            return False
        return all(_no_objectid(v) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_objectid(v) for v in obj)
    return True


# ---- session fixtures ----
@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def user_token(s):
    r = s.post(f"{API}/dev/test-login", json={"email": "alex.demo@sonara.app"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data and "user" in data
    return data["session_token"], data["user"]


@pytest.fixture(scope="module")
def other_token(s):
    r = s.post(f"{API}/dev/test-login", json={"email": "luna.demo@sonara.app"})
    assert r.status_code == 200, r.text
    return r.json()["session_token"], r.json()["user"]


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/dev/test-login", json={"email": "admin@sonara.app", "admin": True})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"].get("is_admin") is True
    return data["session_token"], data["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- health & meta ----
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["service"] == "SONARA"

    def test_meta_options(self, s):
        r = s.get(f"{API}/meta/options")
        assert r.status_code == 200
        d = r.json()
        for k in ["roles", "genres", "skill_levels", "goals", "event_types"]:
            assert k in d and isinstance(d[k], list) and len(d[k]) > 0


# ---- auth ----
class TestAuth:
    def test_dev_login_user(self, user_token):
        tok, u = user_token
        assert tok and u["email"] == "alex.demo@sonara.app"
        assert "_id" not in u

    def test_dev_login_admin(self, admin_token):
        tok, u = admin_token
        assert u.get("is_admin") is True

    def test_auth_me_ok(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/auth/me", headers=H(tok))
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == "alex.demo@sonara.app"
        assert _no_objectid(u)

    def test_auth_me_no_token(self, s):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---- profile ----
class TestProfile:
    def test_update_profile(self, s, user_token):
        tok, u = user_token
        r = s.put(f"{API}/profile/me", headers=H(tok),
                  json={"role": "Producer", "genres": ["EDM", "Hip-Hop"], "goals": ["Find Members"], "onboarded": True})
        assert r.status_code == 200
        fresh = r.json()["user"]
        assert fresh["onboarded"] is True
        assert fresh["role"] == "Producer"

    def test_get_profile_with_stats(self, s, user_token):
        tok, u = user_token
        r = s.get(f"{API}/profile/{u['user_id']}", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert "stats" in d
        for k in ["events_hosted", "events_joined", "projects", "avg_rating", "ratings_count"]:
            assert k in d["stats"]


# ---- feed ----
class TestFeed:
    def test_home_feed(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/feed/home", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["nearby_events", "online_events", "trending_musicians", "open_projects", "recommended_users"]:
            assert k in d
        # seeded: should have at least some content
        assert len(d["trending_musicians"]) >= 1
        assert len(d["open_projects"]) >= 1
        assert _no_objectid(d)


# ---- events ----
class TestEvents:
    created_event_id = None

    def test_create_event(self, s, user_token):
        tok, _ = user_token
        r = s.post(f"{API}/events", headers=H(tok), json={
            "title": "TEST_Event_Jam",
            "description": "Test event",
            "event_type": "Jam Session",
            "genre": ["Indie"],
            "location": "Test Loc",
            "city": "Los Angeles",
            "is_online": False,
            "date_time": "2026-06-01T20:00:00+00:00",
            "participant_limit": 5,
            "needed_roles": ["Drummer"],
        })
        assert r.status_code == 200
        ev = r.json()["event"]
        assert ev["title"] == "TEST_Event_Jam"
        TestEvents.created_event_id = ev["event_id"]

    def test_list_events(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/events", headers=H(tok))
        assert r.status_code == 200
        evs = r.json()["events"]
        assert len(evs) >= 1
        assert _no_objectid(evs)

    def test_get_event_detail(self, s, user_token):
        tok, _ = user_token
        eid = TestEvents.created_event_id
        r = s.get(f"{API}/events/{eid}", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["event"]["event_id"] == eid
        assert d["host"] is not None

    def test_join_leave_event(self, s, other_token, user_token):
        # Use seeded event so we can have someone else join
        tok2, u2 = other_token
        # find a seed event not hosted by luna
        r = s.get(f"{API}/events", headers=H(tok2))
        events = r.json()["events"]
        ev = next((e for e in events if e["host_id"] != u2["user_id"]), None)
        assert ev is not None
        r = s.post(f"{API}/events/{ev['event_id']}/join", headers=H(tok2))
        assert r.status_code == 200
        assert r.json()["status"] in ("joined", "already_joined")
        # leave
        r = s.post(f"{API}/events/{ev['event_id']}/leave", headers=H(tok2))
        assert r.status_code == 200
        assert r.json()["status"] == "left"


# ---- projects ----
class TestProjects:
    project_id = None
    task_id = None

    def test_create_project(self, s, user_token):
        tok, _ = user_token
        r = s.post(f"{API}/projects", headers=H(tok), json={
            "title": "TEST_Project_Lofi",
            "description": "Test proj",
            "genre": ["Indie"],
            "needed_roles": ["Bassist"],
            "is_open": True,
        })
        assert r.status_code == 200
        p = r.json()["project"]
        TestProjects.project_id = p["project_id"]

    def test_list_projects(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/projects", headers=H(tok))
        assert r.status_code == 200
        assert len(r.json()["projects"]) >= 1

    def test_get_project(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/projects/{TestProjects.project_id}", headers=H(tok))
        assert r.status_code == 200
        assert r.json()["project"]["project_id"] == TestProjects.project_id
        assert len(r.json()["members"]) >= 1

    def test_join_project(self, s, other_token):
        tok2, _ = other_token
        r = s.post(f"{API}/projects/{TestProjects.project_id}/join", headers=H(tok2))
        assert r.status_code == 200
        assert r.json()["status"] in ("joined", "already_member")

    def test_add_and_update_task(self, s, user_token):
        tok, _ = user_token
        r = s.post(f"{API}/projects/{TestProjects.project_id}/tasks", headers=H(tok),
                   json={"title": "TEST_Task", "description": "td", "status": "todo"})
        assert r.status_code == 200
        TestProjects.task_id = r.json()["task"]["task_id"]
        r2 = s.put(f"{API}/projects/{TestProjects.project_id}/tasks/{TestProjects.task_id}", headers=H(tok),
                   json={"title": "TEST_Task", "description": "td", "status": "done"})
        assert r2.status_code == 200
        tasks = r2.json()["project"]["tasks"]
        assert any(t["task_id"] == TestProjects.task_id and t["status"] == "done" for t in tasks)


# ---- discover & swipe / match ----
class TestDiscover:
    def test_discover_musicians(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/discover/musicians", headers=H(tok))
        assert r.status_code == 200
        m = r.json()["musicians"]
        assert len(m) >= 1
        assert all("compatibility" in u for u in m)

    def test_discover_filters(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/discover/musicians?role=Vocalist", headers=H(tok))
        assert r.status_code == 200
        for u in r.json()["musicians"]:
            assert u["role"] == "Vocalist"

    def test_swipe_deck(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/discover/swipe-deck", headers=H(tok))
        assert r.status_code == 200
        deck = r.json()["deck"]
        assert isinstance(deck, list)
        # self must be excluded
        _, u = user_token
        assert all(d["user_id"] != u["user_id"] for d in deck)


class TestMatch:
    def test_mutual_swipe_creates_match(self, s, user_token, other_token):
        tok_a, ua = user_token
        tok_b, ub = other_token
        # A likes B
        r1 = s.post(f"{API}/match/swipe", headers=H(tok_a),
                    json={"target_id": ub["user_id"], "target_type": "user", "direction": "like"})
        assert r1.status_code == 200
        # B likes A -> should match
        r2 = s.post(f"{API}/match/swipe", headers=H(tok_b),
                    json={"target_id": ua["user_id"], "target_type": "user", "direction": "like"})
        assert r2.status_code == 200
        d = r2.json()
        assert d["matched"] is True
        assert d["chat_id"]

    def test_list_matches(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/match/matches", headers=H(tok))
        assert r.status_code == 200
        assert len(r.json()["matches"]) >= 1


# ---- chat ----
class TestChat:
    chat_id = None

    def test_create_or_find_chat(self, s, user_token, other_token):
        tok_a, _ = user_token
        _, ub = other_token
        r = s.post(f"{API}/chats", headers=H(tok_a),
                   json={"participant_ids": [ub["user_id"]], "is_group": False})
        assert r.status_code == 200
        TestChat.chat_id = r.json()["chat"]["chat_id"]

    def test_list_chats(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/chats", headers=H(tok))
        assert r.status_code == 200
        chats = r.json()["chats"]
        assert any(c["chat_id"] == TestChat.chat_id for c in chats)

    def test_send_and_list_messages(self, s, user_token):
        tok, _ = user_token
        r = s.post(f"{API}/chats/{TestChat.chat_id}/messages", headers=H(tok),
                   json={"chat_id": TestChat.chat_id, "type": "text", "content": "TEST_Hello"})
        assert r.status_code == 200
        assert r.json()["message"]["content"] == "TEST_Hello"
        r2 = s.get(f"{API}/chats/{TestChat.chat_id}/messages", headers=H(tok))
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert any(m["content"] == "TEST_Hello" for m in msgs)
        assert _no_objectid(msgs)


# ---- websocket ----
class TestWebSocket:
    def test_ws_connect_and_receive_broadcast(self, s, user_token, other_token):
        import websockets
        ws_base = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        tok_a, ua = user_token
        tok_b, ub = other_token

        async def run():
            url = f"{ws_base}/api/ws?token={tok_a}"
            async with websockets.connect(url) as ws:
                hello = await asyncio.wait_for(ws.recv(), timeout=5)
                assert json.loads(hello)["type"] == "connected"
                # ensure chat exists between a & b
                r = s.post(f"{API}/chats", headers=H(tok_a), json={"participant_ids": [ub["user_id"]]})
                chat_id = r.json()["chat"]["chat_id"]
                # B sends message -> A should receive ws message
                s.post(f"{API}/chats/{chat_id}/messages", headers=H(tok_b),
                       json={"chat_id": chat_id, "type": "text", "content": "WS_PING"})
                received = None
                for _ in range(5):
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=4)
                        data = json.loads(raw)
                        if data.get("type") == "message" and data.get("chat_id") == chat_id:
                            received = data
                            break
                    except Exception:
                        break
                assert received is not None, "did not receive ws broadcast"
                # ping/pong (drain any pending notifications first)
                await ws.send(json.dumps({"type": "ping"}))
                got_pong = False
                for _ in range(6):
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=3)
                        if "pong" in raw:
                            got_pong = True
                            break
                    except Exception:
                        break
                assert got_pong, "did not receive pong"

        asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())


# ---- notifications ----
class TestNotifications:
    def test_list_and_mark_read(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/notifications", headers=H(tok))
        assert r.status_code == 200
        notifs = r.json()["notifications"]
        # we should have at least one notif from prior matches/events
        assert isinstance(notifs, list)
        r2 = s.post(f"{API}/notifications/read", headers=H(tok))
        assert r2.status_code == 200


# ---- ratings, reports, verifications ----
class TestRatingsReportsVerif:
    def test_rate_user(self, s, user_token, other_token):
        tok, _ = user_token
        _, ub = other_token
        r = s.post(f"{API}/ratings", headers=H(tok),
                   json={"rated_user_id": ub["user_id"], "score": 5, "comment": "TEST_great"})
        assert r.status_code == 200

    def test_rate_invalid_score(self, s, user_token, other_token):
        tok, _ = user_token
        _, ub = other_token
        r = s.post(f"{API}/ratings", headers=H(tok),
                   json={"rated_user_id": ub["user_id"], "score": 9})
        assert r.status_code == 400

    def test_report(self, s, user_token, other_token):
        tok, _ = user_token
        _, ub = other_token
        r = s.post(f"{API}/reports", headers=H(tok),
                   json={"target_type": "user", "target_id": ub["user_id"], "reason": "TEST spam"})
        assert r.status_code == 200

    def test_verification_submit_and_get(self, s, user_token):
        tok, _ = user_token
        r = s.post(f"{API}/verifications", headers=H(tok),
                   json={"spotify_url": "https://spotify.com/test"})
        assert r.status_code == 200
        r2 = s.get(f"{API}/verifications/me", headers=H(tok))
        assert r2.status_code == 200
        assert r2.json()["verification"] is not None


# ---- admin ----
class TestAdmin:
    def test_non_admin_forbidden(self, s, user_token):
        tok, _ = user_token
        r = s.get(f"{API}/admin/users", headers=H(tok))
        assert r.status_code == 403

    def test_admin_users(self, s, admin_token):
        tok, _ = admin_token
        r = s.get(f"{API}/admin/users", headers=H(tok))
        assert r.status_code == 200
        assert len(r.json()["users"]) >= 6

    def test_admin_reports(self, s, admin_token):
        tok, _ = admin_token
        r = s.get(f"{API}/admin/reports", headers=H(tok))
        assert r.status_code == 200

    def test_admin_verifications(self, s, admin_token):
        tok, _ = admin_token
        r = s.get(f"{API}/admin/verifications", headers=H(tok))
        assert r.status_code == 200

    def test_admin_analytics(self, s, admin_token):
        tok, _ = admin_token
        r = s.get(f"{API}/admin/analytics", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["users", "events", "projects", "matches", "messages", "reports_open", "genres", "cities"]:
            assert k in d

    def test_admin_ban_unban(self, s, admin_token):
        tok, _ = admin_token
        # pick a non-admin user
        users = s.get(f"{API}/admin/users", headers=H(tok)).json()["users"]
        target = next((u for u in users if not u.get("is_admin")), None)
        assert target
        r1 = s.post(f"{API}/admin/users/{target['user_id']}/ban", headers=H(tok))
        assert r1.status_code == 200
        r2 = s.post(f"{API}/admin/users/{target['user_id']}/unban", headers=H(tok))
        assert r2.status_code == 200

    def test_admin_resolve_report_and_verification_actions(self, s, admin_token):
        tok, _ = admin_token
        reports = s.get(f"{API}/admin/reports", headers=H(tok)).json()["reports"]
        if reports:
            rid = reports[0]["report_id"]
            r = s.post(f"{API}/admin/reports/{rid}/resolve", headers=H(tok))
            assert r.status_code == 200
        verifs = s.get(f"{API}/admin/verifications", headers=H(tok)).json()["verifications"]
        if verifs:
            vid = verifs[0]["verification_id"]
            r = s.post(f"{API}/admin/verifications/{vid}/approve", headers=H(tok))
            assert r.status_code == 200
