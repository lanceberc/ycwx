#!/bin/sh

echo "Prune Data"
df /
sh /home/stfyc/bin/prunemp4.sh

/home/stfyc/bin/prunebydate.py -dir /home/stfyc/www/html/data/GOES/* /home/stfyc/www/html/data/overlay/*
find /home/stfyc/www/html/data/SFBOFS -ctime +1 | xargs rm
find /home/stfyc/www/html/data/SFBOFS -ctime +1 -type d -empty | xargs rmdir
df /
