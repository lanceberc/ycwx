#!/usr/bin/bash
ipaddr=`/usr/sbin/ifconfig eth0 | /usr/bin/grep inet | /usr/bin/awk '{print $2}' | /usr/bin/head -1`
where=wx
if [[ $ipaddr =~ "10.0.0" ]] ; then where=wx ; fi
if [[ $ipaddr =~ "192.168.2" ]] ; then where=dev ; fi
date
/usr/bin/python /home/stfyc/bin/sfcanalysis.py
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West-500m -timelimit 4 -since 12h
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West_GLM_1k -timelimit 4 -since 2d
date
#/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-West -since 2d
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-West_GLM_2k -timelimit 4 -since 2d
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-East -timelimit 4 -since 1d
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-East_GLM_1k -timelimit 4 -since 1d
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-East -timelimit 4 -since 2d
if [[ $where == "dev" ]]; then
    date
#  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West_GLM_1k -timelimit 4 -since 2d
#  date
#  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-West_GLM_2k -timelimit 4 -since 2d
#  date
#  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-East -timelimit 4 -since 1d
#  date
#  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-East -timelimit 4 -since 2d
#  date
fi
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image current
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image tide
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image wtemp
#date
#/usr/bin/python /home/stfyc/bin/fetch-obs.py
date
/usr/bin/python /home/stfyc/bin/fetch-tide.py
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region Karl
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region Eddy
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region NorCal-NAM
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region CA-NAM
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region CA-GFS
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region NYBOS
/usr/bin/python /home/stfyc/bin/nomads-fetch.py -region NYBOS-NAM
