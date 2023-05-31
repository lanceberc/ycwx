#!/usr/bin/bash
for d in /home/stfyc/www/html/data/NOAA/overlay/*
do
    if [ -d ${d} ]
    then
	count=`ls -1 ${d}| grep Z.mp4 | head -n -2 | wc -w`
        if (( ${count} > 0 )); then
	    ls -1 ${d}/*.mp4 | head -n -2 | xargs rm
	fi
    fi
done
