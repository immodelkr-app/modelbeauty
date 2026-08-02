import os
from PIL import Image, ImageDraw

src_icon = r"C:\Users\myday\.gemini\antigravity\brain\d5a02c20-4fe2-4c20-953a-4607fd558127\official_app_icon_1784467956145.jpg"
img = Image.open(src_icon).convert("RGBA")

def make_round(im):
    mask = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, im.size[0], im.size[1]), fill=255)
    result = im.copy()
    result.putalpha(mask)
    return result

densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

targets = [
    r"c:\Users\myday\Desktop\안티그래비티\model_beauty\android-app\app\src\main\res",
    r"C:\model_beauty_android\app\src\main\res"
]

for target_res in targets:
    if not os.path.exists(target_res):
        continue
    for folder, size in densities.items():
        folder_path = os.path.join(target_res, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        # ic_launcher.png
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        
        # ic_launcher_round.png
        round_img = make_round(resized)
        round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        
        print(f"CREATED {folder_path} ({size}x{size})")

print("MIPMAP_GENERATION_SUCCESSFUL")
