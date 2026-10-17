#!/usr/bin/env bash
# Regenerates the Android launcher icons and splash images from the SVGs in
# this folder (needs rsvg-convert and ImageMagick). Run from the repo root:
#   bash brand/generate-android-assets.sh
set -euo pipefail
RES=android/app/src/main/res
ORANGE='#e46c16'

# Launcher icons: legacy square + round (48dp) and adaptive foreground (108dp).
for pair in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  density=${pair%%:*}; scale=${pair##*:}
  icon=$(awk "BEGIN{print int(48*$scale)}"); fg=$(awk "BEGIN{print int(108*$scale)}")
  rsvg-convert -w "$icon" -h "$icon" brand/raices-icon.svg -o "$RES/mipmap-$density/ic_launcher.png"
  rsvg-convert -w "$icon" -h "$icon" brand/raices-round.svg -o "$RES/mipmap-$density/ic_launcher_round.png"
  rsvg-convert -w "$fg" -h "$fg" brand/raices-foreground.svg -o "$RES/mipmap-$density/ic_launcher_foreground.png"
done

# Splash (Android < 12): orange background with the tree in the middle.
splash() { # file width height
  local logo=$(( ($2 < $3 ? $2 : $3) * 45 / 100 ))
  rsvg-convert -w "$logo" -h "$logo" brand/raices-foreground.svg -o /tmp/raices-splash-logo.png
  magick -size "$2x$3" "xc:$ORANGE" /tmp/raices-splash-logo.png -gravity center -composite -strip "$1"
}
splash "$RES/drawable/splash.png" 480 320
for dir in "$RES"/drawable-port-* "$RES"/drawable-land-*; do
  size=$(magick identify -format '%w %h' "$dir/splash.png")
  splash "$dir/splash.png" "${size% *}" "${size#* }"
done
rm -f /tmp/raices-splash-logo.png
echo "Android icons and splash images regenerated."
