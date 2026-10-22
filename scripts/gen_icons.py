#!/usr/bin/env python3
"""DartPro-Icons: Dartboard-Motiv als PNG, rein mit stdlib (keine Abhaengigkeiten)."""
import math, struct, zlib, os

SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

BLACK = (21, 24, 26)
CREAM = (232, 223, 200)
RED = (192, 57, 43)
GREEN = (29, 122, 68)
WIRE = (58, 70, 62)
OUTER = (12, 15, 13)      # Rand
BULLIN = (176, 50, 39)

def seg_color(kind, number):
    even = number % 2 == 0
    if kind == 'single':
        return BLACK if even else CREAM
    if kind in ('double', 'triple'):
        return RED if even else GREEN
    return RED

def render(size, pad_ratio=0.0):
    img = bytearray(size * size * 4)
    c = size / 2
    R = (size / 2) * (1 - pad_ratio)          # Board-Radius
    # Ringanteile (wie im App-Board, leicht geglaettet)
    r_bull_in, r_bull_out = 0.06, 0.125
    r_tri = (0.56, 0.72)
    r_dbl = (0.86, 1.0)
    wire = max(1.0, size / 340)

    for y in range(size):
        for x in range(size):
            dx, dy = x - c + 0.5, y - c + 0.5
            r = math.hypot(dx, dy)
            idx = (y * size + x) * 4
            col = OUTER
            if r <= R:
                ang = math.degrees(math.atan2(dy, dx)) % 360
                # Sektor: 20 ist oben, 18 Grad je Sektor
                off = (ang + 9) % 360
                si = int(off // 18)
                number = SECTORS[si]
                rn = r / R
                kind = None
                if rn <= r_bull_in:
                    col = BULLIN
                elif rn <= r_bull_out:
                    col = (42, 122, 74)
                elif r_tri[0] <= rn < r_tri[1]:
                    kind = 'triple'
                elif r_dbl[0] <= rn <= r_dbl[1]:
                    kind = 'double'
                elif r_bull_out < rn < r_tri[0]:
                    kind = 'single'
                elif r_tri[1] <= rn < r_dbl[0]:
                    kind = 'single'
                if kind:
                    col = seg_color(kind, number)
                # Wire-Linien (Trennwaende + Ringkanten)
                edge = abs(off / 18 - round(off / 18)) * 18  # Abstand zur Sektor-Kante
                if edge * (r * math.pi / 180) < wire and rn > r_bull_out:
                    col = WIRE
                for ring in (r_bull_out, r_tri[0], r_tri[1], r_dbl[0]):
                    if abs(rn - ring) * R < wire:
                        col = WIRE
            # Rand-Glanz leicht
            img[idx] = col[0]
            img[idx + 1] = col[1]
            img[idx + 2] = col[2]
            img[idx + 3] = 255
    return bytes(img)

def write_png(path, size, data):
    def chunk(tag, payload):
        c = struct.pack('>I', len(payload)) + tag + payload
        return c + struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff)
    raw = b''.join(b'\x00' + data[y * size * 4:(y + 1) * size * 4] for y in range(size))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print(path, size)

os.makedirs('public/icons', exist_ok=True)
for size, name, pad in [(512, 'icon-512.png', 0.0), (192, 'icon-192.png', 0.0), (512, 'maskable-512.png', 0.12), (180, 'apple-touch-icon.png', 0.0)]:
    write_png(f'public/icons/{name}', size, render(size, pad))
