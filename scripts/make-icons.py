#!/usr/bin/env python3
"""배너 그림(public/img/hero.jpg)의 아빠·딸·여우 부분으로 앱 아이콘을 만든다.
- 안드로이드: mipmap-*/ic_launcher(.png/_round/_foreground), 웹: public/img/icon-192·512, logo.png
사용: python scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, 'public', 'img', 'hero.jpg')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
IMG = os.path.join(ROOT, 'public', 'img')

hero = Image.open(HERO).convert('RGB')

# 캐릭터(아빠·딸·여우·돌길)가 든 네모 영역
CROP = (372, 40, 972, 640)


def tight():
    """정사각 아이콘용: 캐릭터를 크게."""
    return hero.crop((395, 50, 945, 600)).resize((1024, 1024), Image.LANCZOS)


def foreground(size):
    """적응형 아이콘 전경: 가운데 66%(안전 영역) 안에 캐릭터가 들어가도록 배경을 늘려 채운다."""
    c = hero.crop(CROP)
    bg = c.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(size / 14))
    fg_w = int(size * 0.74)
    fg = c.resize((fg_w, fg_w), Image.LANCZOS)
    mask = Image.new('L', fg.size, 0)
    m = int(fg_w * 0.10)
    ImageDraw.Draw(mask).rectangle((m, m, fg_w - m, fg_w - m), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(m / 2.2))
    off = (size - fg_w) // 2
    bg.paste(fg, (off, off), mask)
    return bg


def rounded(im, radius_ratio):
    im = im.convert('RGBA')
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=int(im.size[0] * radius_ratio), fill=255)
    im.putalpha(m)
    return im


def circle(im):
    im = im.convert('RGBA')
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, im.size[0] - 1, im.size[1] - 1), fill=255)
    im.putalpha(m)
    return im


LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
big_fg = foreground(1296)
big_tight = tight()
for d, px in LEGACY.items():
    out = os.path.join(RES, f'mipmap-{d}')
    fg_px = px * 108 // 48
    big_fg.resize((fg_px, fg_px), Image.LANCZOS).save(os.path.join(out, 'ic_launcher_foreground.png'))
    rounded(big_tight.resize((px, px), Image.LANCZOS), 0.22).save(os.path.join(out, 'ic_launcher.png'))
    circle(big_tight.resize((px, px), Image.LANCZOS)).save(os.path.join(out, 'ic_launcher_round.png'))

for px, name in ((512, 'icon-512.png'), (192, 'icon-192.png')):
    rounded(big_tight.resize((px, px), Image.LANCZOS), 0.22).save(os.path.join(IMG, name))
rounded(big_tight.resize((96, 96), Image.LANCZOS), 0.22).save(os.path.join(IMG, 'logo.png'))
print('아이콘 생성 완료')
