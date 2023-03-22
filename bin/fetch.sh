#!/usr/bin/bash
ipaddr=`/usr/sbin/ifconfig eth0 | /usr/bin/grep inet | /usr/bin/awk '{print $2}' | /usr/bin/head -1`
where=wx
if [[ $ipaddr =~ "10.0.0" ]] ; then where=wx ; fi
if [[ $ipaddr =~ "192.168.2" ]] ; then where=dev ; fi
date
/usr/bin/python /home/stfyc/bin/sfcanalysis.py
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West
date
/usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-West
date
if [[ $where == "dev" ]]; then
  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-West-500m -timelimit 4
  date
  /usr/bin/python /home/stfyc/bin/glm-fetch.py -region CONUS-West_GLM_1k -timelimit 4
  date
  /usr/bin/python /home/stfyc/bin/glm-fetch.py -region GOES-West_GLM_2k -timelimit 4
  date
  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region CONUS-East -timelimit 4
  date
  /usr/bin/python /home/stfyc/bin/nesdis-fetch.py -region GOES-East -timelimit 4
  date
fi
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image current
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image tide
/usr/bin/python /home/stfyc/bin/fetch-sfcurrents.py -image wtemp
#date
#/usr/bin/python /home/stfyc/bin/fetch-obs.py
date
/usr/bin/python /home/stfyc/bin/fetch-tide.py
