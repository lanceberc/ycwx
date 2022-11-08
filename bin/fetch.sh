#!/usr/bin/bash
date
/usr/bin/python /home/stfyc/bin/sfcanalysis.py
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-West
date
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image current
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image tide
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image wtemp
#date
#/usr/bin/python /home/stfyc/bin/fetch-obs.py
date
/usr/bin/python /home/stfyc/bin/fetch-tide.py
