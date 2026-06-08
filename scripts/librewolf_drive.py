#!/usr/bin/env python3
"""Drive the installed Librewolf for manual/automated UI testing of this app.

Why this exists
---------------
This project must be tested in **Librewolf** (Firefox-based, resistFingerprinting on
by default) — see CLAUDE.md. Playwright/Selenium can't drive Librewolf without extra
binaries (geckodriver) that aren't installed here. Librewolf ships **Marionette**
built in, so this module speaks the Marionette wire protocol over a TCP socket using
only the Python standard library — no pip/AUR installs, and it controls the *real*
Librewolf binary.

Auth
----
The app guards routes with a `session` httpOnly cookie. Instead of automating the
password + TOTP login each time, we mint a full JWT via the same flow `gv-api`'s
`make auth` uses (reads `../gv-api/.env`, needs `pyotp`) and inject it as the cookie.

Usage
-----
    python scripts/librewolf_drive.py [URL_PATH]      # smoke test: open path, screenshot

As a library:
    from librewolf_drive import Session
    with Session() as m:                 # launches Librewolf, logs in via cookie
        m.goto("/tasks")
        m.click(m.find("#dtp-task-due"))
        print(m.script("return document.title"))
        m.screenshot("/tmp/shot.png")

Requirements: `librewolf` on PATH, the dev server on :5173, `gv-api` reachable, `pyotp`.
"""
from __future__ import annotations

import base64
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

EL_KEY = "element-6066-11e4-a52e-4f735466cecf"
BASE_URL = os.environ.get("GV_WEB_URL", "http://localhost:5173")
API_ENV = Path(__file__).resolve().parents[2] / "gv-api" / ".env"


def mint_session_token() -> str:
    """Replicate gv-api's `make auth` (password -> TOTP 2FA) and return a full JWT."""
    import pyotp  # local import: only needed when authenticating

    env: dict[str, str] = {}
    for line in API_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    base = f"http://127.0.0.1:{env['PORT']}"

    def post(path: str, body: dict) -> dict:
        req = urllib.request.Request(
            f"{base}{path}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        return json.loads(urllib.request.urlopen(req).read())

    tmp = post("/login", {"password": env["PASSWORD"]})["token"]
    code = pyotp.TOTP(env["TOTP_SECRET"]).now()
    return post("/login/2fa", {"token": tmp, "code": code})["token"]


class Marionette:
    """Minimal Marionette (WebDriver) client over TCP — stdlib only."""

    def __init__(self, port: int = 2828) -> None:
        self.port = port
        self.sock: socket.socket | None = None
        self.msgid = 0

    def connect(self, timeout: float = 40) -> dict | list:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                self.sock = socket.create_connection(("127.0.0.1", self.port), 5)
                break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("could not connect to Marionette (is Librewolf up?)")
        return self._recv()  # server hello

    def _recv(self) -> dict | list:
        assert self.sock
        length = b""
        while True:
            c = self.sock.recv(1)
            if not c:
                raise RuntimeError("socket closed")
            if c == b":":
                break
            length += c
        n, data = int(length), b""
        while len(data) < n:
            chunk = self.sock.recv(n - len(data))
            if not chunk:
                raise RuntimeError("socket closed mid-frame")
            data += chunk
        return json.loads(data)

    def cmd(self, name: str, params: dict | None = None):
        assert self.sock
        self.msgid += 1
        payload = json.dumps([0, self.msgid, name, params or {}]).encode()
        self.sock.sendall(f"{len(payload)}:".encode() + payload)
        while True:
            msg = self._recv()
            if isinstance(msg, list) and msg[0] == 1 and msg[1] == self.msgid:
                _, _, err, res = msg
                if err:
                    raise RuntimeError(f"{name} error: {json.dumps(err)[:400]}")
                return res

    # — high-level helpers —
    @staticmethod
    def _unwrap(r):
        return r["value"] if isinstance(r, dict) and "value" in r else r

    def new_session(self):
        return self.cmd("WebDriver:NewSession", {})

    def navigate(self, url: str):
        return self.cmd("WebDriver:Navigate", {"url": url})

    def url(self) -> str:
        return self.cmd("WebDriver:GetCurrentURL")["value"]

    def add_cookie(self, cookie: dict):
        return self.cmd("WebDriver:AddCookie", {"cookie": cookie})

    def source(self) -> str:
        return self.cmd("WebDriver:GetPageSource")["value"]

    def screenshot(self, path: str, full: bool = True) -> None:
        res = self.cmd("WebDriver:TakeScreenshot", {"id": None, "full": full, "hash": False})
        Path(path).write_bytes(base64.b64decode(res["value"]))

    def find(self, css: str):
        try:
            r = self.cmd("WebDriver:FindElement", {"using": "css selector", "value": css})
            return self._unwrap(r)[EL_KEY]
        except RuntimeError:
            return None

    def find_all(self, css: str) -> list:
        r = self.cmd("WebDriver:FindElements", {"using": "css selector", "value": css})
        return [e[EL_KEY] for e in self._unwrap(r)]

    def click(self, elid: str):
        return self.cmd("WebDriver:ElementClick", {"id": elid})

    def text(self, elid: str) -> str:
        return self.cmd("WebDriver:GetElementText", {"id": elid})["value"]

    def script(self, js: str, args: list | None = None):
        return self.cmd("WebDriver:ExecuteScript", {"script": js, "args": args or []})["value"]

    def wait(self, css: str, timeout: float = 8) -> bool:
        end = time.time() + timeout
        while time.time() < end:
            if self.find(css):
                return True
            time.sleep(0.25)
        return False


def _launch(profile: str) -> subprocess.Popen:
    os.makedirs(profile, exist_ok=True)
    Path(profile, "user.js").write_text(
        'user_pref("marionette.port", 2828);\n'
        'user_pref("browser.shell.checkDefaultBrowser", false);\n'
        'user_pref("browser.aboutwelcome.enabled", false);\n'
        'user_pref("datareporting.policy.firstRunURL", "");\n'
        'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);\n'
    )
    headless = os.environ.get("GV_HEADFUL") != "1"
    argv = ["librewolf", "--marionette", "--no-remote", "--profile", profile, "about:blank"]
    if headless:
        argv.insert(1, "--headless")
    return subprocess.Popen(
        argv,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        env={**os.environ, **({"MOZ_HEADLESS": "1"} if headless else {})},
    )


class Session:
    """Context manager: launch Librewolf, authenticate via cookie, drive it.

    Set GV_HEADFUL=1 to watch the browser; defaults to headless.
    """

    def __init__(self, authenticate: bool = True) -> None:
        self.authenticate = authenticate
        self.m = Marionette()
        self._proc: subprocess.Popen | None = None
        self._profile: str | None = None

    def __enter__(self) -> Marionette:
        self._profile = tempfile.mkdtemp(prefix="lw-prof-")
        self._proc = _launch(self._profile)
        self.m.connect()
        self.m.new_session()
        if self.authenticate:
            token = mint_session_token()
            self.m.navigate(BASE_URL + "/")
            self.m.add_cookie({"name": "session", "value": token, "path": "/",
                               "httpOnly": True, "secure": False})
        # convenience: relative goto
        self.m.goto = lambda path: self.m.navigate(BASE_URL + path)  # type: ignore[attr-defined]
        return self.m

    def __exit__(self, *exc) -> None:
        if self._proc:
            try:
                self._proc.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/tasks"
    with Session() as m:
        m.goto(path)  # type: ignore[attr-defined]
        time.sleep(3)
        print("url:", m.url())
        print("title:", m.script("return document.title"))
        out = "/tmp/librewolf_shot.png"
        m.screenshot(out)
        print("screenshot ->", out)
