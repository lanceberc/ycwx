#!/usr/bin/sh
# remember that "latest.mp4" is out there too
for d in WestCoast BayDelta Pacific EastPacificGLM WestCoastGLM
do
    ls -1 /home/stfyc/www/html/data/overlay/${d}/${d}*.mp4 | head -n -4 | xargs rm
done
