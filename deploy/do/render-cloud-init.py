#!/usr/bin/env python3
"""Render deploy/do/cloud-init.yaml from the environment. Prints YAML on stdout.

Required:
  VIMCHI_SSH_USER          linux username created on the droplet
  VIMCHI_SSH_PUBKEY        path to the login public key (default ~/.ssh/id_ed25519.pub)

Optional, one line each. Unset values become comments, so no key material is baked in:
  VIMCHI_SSH_USER_CA       user CA public key (certs it signs may log in as VIMCHI_SSH_USER)
  VIMCHI_SSH_REVOKED_KEYS  one revoked public key
  VIMCHI_SSH_HOST_CA       a known_hosts CA line, e.g. "@cert-authority * ssh-ed25519 AAAA..."
  TAILSCALE_AUTHKEY        when set, install Tailscale and do not open public SSH
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "cloud-init.yaml"
USER_RE = re.compile(r"[a-z_][a-z0-9_-]{0,31}")
PLACEHOLDER_RE = re.compile(r"__[A-Z0-9_]+__")


def one_line(name: str, fallback: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        return fallback
    if "\n" in value or "\r" in value:
        raise SystemExit(f"{name} must be a single line")
    return value


def replace_marker(text: str, marker: str, block: str) -> str:
    line = f"  # {marker}\n"
    if line not in text:
        raise SystemExit(f"cloud-init template is missing marker {marker}")
    return text.replace(line, block, 1)


def main() -> None:
    user = os.environ.get("VIMCHI_SSH_USER", "").strip()
    if not USER_RE.fullmatch(user or ""):
        raise SystemExit("VIMCHI_SSH_USER must be a short lowercase linux username")

    pub_path = Path(os.path.expanduser(os.environ.get("VIMCHI_SSH_PUBKEY", "~/.ssh/id_ed25519.pub")))
    if not pub_path.is_file():
        raise SystemExit(f"public key not found: {pub_path}")
    hub = pub_path.read_text().strip().splitlines()[0].strip()
    if not hub.startswith("ssh-") or '"' in hub or "\n" in hub:
        raise SystemExit(f"{pub_path} must be a single-line ssh public key")

    text = TEMPLATE.read_text()
    text = text.replace("__SSH_USER__", user)
    text = text.replace("__HUB_KEY__", hub)
    text = text.replace("__SSH_USER_CA__", one_line("VIMCHI_SSH_USER_CA", "# no user CA configured"))
    text = text.replace("__SSH_REVOKED_KEYS__", one_line("VIMCHI_SSH_REVOKED_KEYS", "# none"))
    text = text.replace("__SSH_HOST_CA__", one_line("VIMCHI_SSH_HOST_CA", "# no host CA configured"))

    ts = os.environ.get("TAILSCALE_AUTHKEY", "").strip()
    if ts:
        if any(c in ts for c in '"\\\n\r'):
            raise SystemExit("TAILSCALE_AUTHKEY cannot be embedded in the cloud-init command")
        text = replace_marker(
            text,
            "__TAILSCALE__",
            '  - [sh, -c, "curl -fsSL https://tailscale.com/install.sh | sh"]\n'
            f'  - [tailscale, up, "--authkey={ts}", "--hostname=vimchi"]\n',
        )
        text = replace_marker(text, "__UFW_TAILSCALE__", "  - [ufw, allow, in, on, tailscale0]\n")
        text = replace_marker(text, "__UFW_SSH__", "")
    else:
        text = replace_marker(text, "__TAILSCALE__", "")
        text = replace_marker(text, "__UFW_TAILSCALE__", "")
        text = replace_marker(text, "__UFW_SSH__", '  - [ufw, allow, "22/tcp"]\n')

    leftover = PLACEHOLDER_RE.findall(text)
    if leftover:
        raise SystemExit(f"unreplaced cloud-init placeholders: {', '.join(leftover)}")
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
