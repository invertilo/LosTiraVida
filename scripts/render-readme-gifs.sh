#!/usr/bin/env bash
set -euo pipefail

assets_dir="$(cd "$(dirname "$0")/../docs/assets" && pwd)"

# The source art is reduced first so every animation has a consistent pixel grid.
common="scale=480:270:flags=neighbor,format=rgb24"
lights="drawbox=x=365:y=99:w=5:h=3:color=0xffd735:t=fill:enable='lt(mod(t,1),0.5)',drawbox=x=100:y=101:w=5:h=3:color=0xff606d:t=fill:enable='gte(mod(t,1),0.5)',drawbox=x=178:y=183:w=3:h=3:color=0xffdc42:t=fill:enable='lt(mod(t,0.6),0.3)',drawbox=x=185:y=179:w=2:h=2:color=0xffffff:t=fill:enable='gte(mod(t,0.6),0.3)',drawbox=x=330:y=190:w=8:h=2:color=0x67ff88:t=fill:enable='lt(mod(t,1.2),0.7)'"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 12 -t 6 -i "$assets_dir/mission-8bit-source.png" \
  -filter_complex "[0:v]${common},${lights},drawbox=x=453:y=8:w=9:h=9:color=0xff626a:t=fill:enable='lt(mod(t,1),0.5)',scale=960:540:flags=neighbor,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  -frames:v 72 -loop 0 "$assets_dir/mission-hero.gif"

ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 12 -t 6 -i "$assets_dir/mission-8bit-source.png" \
  -filter_complex "[0:v]${common},${lights},drawbox=x=170:y=169:w=4:h=3:color=0xfff16b:t=fill:enable='lt(mod(t,0.5),0.25)',drawbox=x=194:y=176:w=3:h=3:color=0xff656a:t=fill:enable='gte(mod(t,0.5),0.25)',crop=320:180:80:75,scale=800:450:flags=neighbor,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  -frames:v 72 -loop 0 "$assets_dir/mission-loop.gif"
