"""LoreKit configuration and environment presets."""

from pathlib import Path
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ColorGrade(BaseModel):
    temperature: int
    saturation: float
    contrast: float
    vignette: float


class CivilizationPreset(BaseModel):
    name: str
    color_grade: ColorGrade
    font: str
    text_color: str
    text_shadow: str


# Alias for new code
EnvironmentPreset = CivilizationPreset


VIBE_PRESETS: dict[str, dict] = {
    "mobile_game": {
        "name": "Mobile Game",
        "description": "Colorful Clash of Clans style — chunky, fun, approachable",
        "prompt": "Colorful casual mobile game illustration style. Think Clash of Clans, Coin Master, or a premium mobile game cutscene. Chunky stylized 3D-look characters with oversized heads, big friendly eyes, round expressive faces, and exaggerated proportions — NOT photorealistic, NOT hyper-detailed. Lush vibrant environments: bright emerald greens, warm golden sandstone, vivid blue skies with fluffy white clouds, rich foliage and vines. Warm golden-hour lighting with soft shadows. Bold clean rendering with subtle outlines and rich saturated colors. Characters look approachable, friendly, and slightly cartoonish — like a wise grandpa in a mobile game. Architecture is stylized and chunky (thick stone columns, rounded edges, simplified details). Overall: fun, warm, inviting, and polished — the visual quality of a top mobile game trailer.",
    },
    "cinematic": {
        "name": "Cinematic Realism",
        "description": "Gladiator-meets-documentary — dramatic, moody, photorealistic",
        "prompt": "Cinematic photorealistic. Rich atmospheric lighting, dramatic composition, shallow depth of field. Film grain. Warm golden-hour tones for interiors, epic scale for exteriors. Think Ridley Scott Gladiator meets a National Geographic documentary. Textured, tactile surfaces — weathered stone, aged bronze, worn leather. NOT stylized, NOT cartoon, NOT game art. Cinematic composition, film-quality lighting, emotional storytelling through every frame.",
    },
    "stylized_cinematic": {
        "name": "Stylized Cinematic",
        "description": "Arcane / animated epic — painterly, expressive, dramatic",
        "prompt": "Stylized cinematic illustration. Rich painterly textures, dramatic lighting, expressive characters with slightly exaggerated proportions but realistic emotion. Think Arcane, Castlevania, or a high-end animated film. Warm atmospheric environments with depth and detail. Characters feel like heroes in an epic animated saga — approachable but powerful. NOT photorealistic, NOT flat cartoon, NOT mobile game UI. Cinematic composition, film-quality lighting, emotional storytelling through every frame.",
    },
    "dark_masculine": {
        "name": "Dark Masculine",
        "description": "Dark, desaturated, high-contrast — Sauron meets Greek statues, raw power",
        "prompt": (
            "Photorealistic, hyper-detailed photograph. NOT illustration, NOT painting, "
            "NOT cartoon, NOT stylized, NOT 3D render, NOT game art, NOT anime. "
            "Shot on ARRI Alexa 65, anamorphic lens, f/1.4, shallow depth of field. "
            "Extremely dark, nearly monochrome aesthetic with heavy desaturation. "
            "Deep blacks, crushed shadows, minimal highlights. "
            "Think a real photograph of a dark fantasy film set — practical lighting, "
            "real smoke machines. "
            "Dramatic single-source rim lighting with volumetric haze. "
            "Textures: real cracked stone, real dark iron, real weathered bronze, "
            "real smoke, real embers. Color palette: near-black with occasional "
            "cold steel blue or deep ember orange accents. "
            "Raw, aggressive, primal energy. The visual intensity of a Zack Snyder "
            "film still or a dark fantasy movie poster photograph."
        ),
        # Only injected when character_present=True
        "character_prompt": (
            "Characters are imposing, powerful, godlike figures with real human skin "
            "texture, pores, scars, sweat — NOT smooth, NOT plastic, NOT CG. "
            "Real armor and costumes."
        ),
    },
    "custom": {
        "name": "Custom",
        "description": "Write your own style prompt",
        "prompt": "",
    },
}

CIVILIZATIONS: dict[str, CivilizationPreset] = {
    "roman": CivilizationPreset(
        name="Roman",
        color_grade=ColorGrade(temperature=6500, saturation=1.05, contrast=1.1, vignette=0.3),
        font="Cinzel",
        text_color="#FFFFFF",
        text_shadow="warm",
    ),
    "chinese": CivilizationPreset(
        name="Chinese",
        color_grade=ColorGrade(temperature=5500, saturation=0.85, contrast=1.0, vignette=0.2),
        font="Noto Serif",
        text_color="#FFD700",
        text_shadow="cool",
    ),
    "japanese": CivilizationPreset(
        name="Japanese",
        color_grade=ColorGrade(temperature=5800, saturation=0.8, contrast=0.95, vignette=0.1),
        font="Noto Sans JP",
        text_color="#FFFFFF",
        text_shadow="minimal",
    ),
    "greek": CivilizationPreset(
        name="Greek",
        color_grade=ColorGrade(temperature=6000, saturation=1.0, contrast=1.15, vignette=0.15),
        font="Cinzel",
        text_color="#FFFFFF",
        text_shadow="cool",
    ),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "openai"  # "openai" or "anthropic"
    llm_model: str = "gpt-5.4"  # or "gpt-5.4-mini" (cheaper) or "claude-sonnet-4-20250514"
    fal_key: str = ""
    youtube_client_secret_path: Path | None = None
    database_url: str = "postgresql://localhost:5432/lorekit"
    output_dir: Path = Path("./output")
    clips_dir: Path = Path("./clips")
    audio_assets_dir: Path = Path("./lorekit/audio/assets")
    video_vibe: str = "Colorful casual mobile game illustration style. Think Clash of Clans, Coin Master, or a premium mobile game cutscene. Chunky stylized 3D-look characters with oversized heads, big friendly eyes, round expressive faces, and exaggerated proportions — NOT photorealistic, NOT hyper-detailed. Lush vibrant environments: bright emerald greens, warm golden sandstone, vivid blue skies with fluffy white clouds, rich foliage and vines. Warm golden-hour lighting with soft shadows. Bold clean rendering with subtle outlines and rich saturated colors. Characters look approachable, friendly, and slightly cartoonish — like a wise grandpa in a mobile game. Architecture is stylized and chunky (thick stone columns, rounded edges, simplified details). Overall: fun, warm, inviting, and polished — the visual quality of a top mobile game trailer."
    video_vibe_preset: str = "mobile_game"

    def ensure_dirs(self) -> None:
        """Create required directories if they don't exist."""
        for d in (self.output_dir, self.clips_dir, self.audio_assets_dir):
            d.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


def get_civilization(civilization: str) -> CivilizationPreset:
    """Look up a civilization preset by key. Raises KeyError if not found."""
    if civilization not in CIVILIZATIONS:
        raise KeyError(f"Unknown civilization {civilization!r}. Choose from: {list(CIVILIZATIONS)}")
    return CIVILIZATIONS[civilization]
