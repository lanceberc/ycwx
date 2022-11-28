#!/bin/sh

sh /home/stfyc/bin/prunemp4.sh

find /home/stfyc/www/html/data/GOES -ctime +8 | xargs rm
find /home/stfyc/www/html/data/GOES -ctime +8 -type d -empty | xargs rmdir
find /home/stfyc/www/html/data/overlay -ctime +6 | xargs rm
find /home/stfyc/www/html/data/overlay -ctime +6 -type d -empty | xargs rmdir
find /home/stfyc/www/html/data/SFBOFS -ctime +1 | xargs rm
find /home/stfyc/www/html/data/SFBOFS -ctime +1 -type d -empty | xargs rmdir
