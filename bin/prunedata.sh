#!/bin/sh

echo "Prune Data"
df /
sh /home/stfyc/bin/prunemp4.sh

/home/stfyc/bin/prunebydate.py -dir /home/stfyc/www/html/data/GOES/* /home/stfyc/www/html/data/overlay/*
find /home/stfyc/www/html/data/SFBOFS -ctime +1 | xargs rm
find /home/stfyc/www/html/data/SFBOFS -ctime +1 -type d -empty | xargs rmdir
df /

if [ -d /wx ]
then
    df /wx
    for d in /wx/data/GOES/* /wx/data/overlay/*
    do
	/home/stfyc/bin/prunebydate.py -days 60 -dir ${d}
    done
    for d in /wx/data/overlay/Eddy
    do
	/home/stfyc/bin/prunebydate.py -days 10 -dir ${d}
    done
    df /wx
fi
