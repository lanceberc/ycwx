#!/usr/bin/sh
# remember that "latest.mp4" is out there too
for d in WestCoast BayDelta BayDelta500m Pacific EastPacificGLM WestCoastGLM
do
    if [ -d /home/stfyc/www/html/data/overlay/${d} ]
    then
	ls -1 /home/stfyc/www/html/data/overlay/${d}/${d}*.mp4 | head -n -4 | xargs rm
    fi
done
