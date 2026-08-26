from pathlib import Path


GENERATED_PATHS_PLACEHOLDER = "{{SYSTEM_GENERATED_PATHS}}"

BACKEND_DIR = Path(__file__).resolve().parent.parent
HEADER_TEMPLATE_PATH = BACKEND_DIR / "header.local.conf"
HEADER_TEMPLATE_EXAMPLE_PATH = BACKEND_DIR / "header.example.conf"


def _read_template(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def load_header_template() -> str:
    if HEADER_TEMPLATE_PATH.exists():
        return _read_template(HEADER_TEMPLATE_PATH)

    if HEADER_TEMPLATE_EXAMPLE_PATH.exists():
        return _read_template(HEADER_TEMPLATE_EXAMPLE_PATH)

    raise FileNotFoundError(
        "No NGINX header template found. Expected either "
        f"{HEADER_TEMPLATE_PATH} or {HEADER_TEMPLATE_EXAMPLE_PATH}."
    )
