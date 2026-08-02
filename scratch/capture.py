import os
import subprocess
import time
from PIL import Image

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORK_DIR = os.path.dirname(BASE_DIR)

urls = {
    "1_home": "https://modelbeauty.kr",
    "2_live": "https://modelbeauty.kr/live",
    "3_products": "https://modelbeauty.kr/products",
    "4_mypage": "https://modelbeauty.kr/mypage",
}

output_dir = os.path.join(WORK_DIR, "public", "screenshots")
artifact_dir = r"C:\Users\myday\.gemini\antigravity\brain\d5a02c20-4fe2-4c20-953a-4607fd558127"
os.makedirs(output_dir, exist_ok=True)

print("Starting screenshot capture of actual site modelbeauty.kr...")

for name, url in urls.items():
    raw_path = os.path.join(BASE_DIR, f"raw_{name}.png")
    final_filename = f"screenshot_{name}_1080x1920.png"
    final_path = os.path.join(output_dir, final_filename)
    art_path = os.path.join(artifact_dir, final_filename)
    
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--window-size=430,932",
        "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        f"--screenshot={raw_path}",
        url
    ]
    
    print(f"Capturing {url} -> {raw_path}")
    subprocess.run(cmd, check=False)
    time.sleep(2)
    
    if os.path.exists(raw_path):
        img = Image.open(raw_path).convert("RGB")
        print(f"Original captured size for {name}: {img.size}")
        # Resize to 1080x1920 PNG for Google Play Store requirement
        resized = img.resize((1080, 1920), Image.Resampling.LANCZOS)
        resized.save(final_path, "PNG")
        resized.save(art_path, "PNG")
        print(f"Saved 1080x1920 PNG to {final_path} and {art_path}")
    else:
        print(f"FAILED to capture {url}")

print("DONE_ALL")
