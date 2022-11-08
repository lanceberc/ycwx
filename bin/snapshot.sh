#!/usr/bin/bash -x

binfiles=(
    cmovie.py
    fetch-sfcurrents.py
    fetch-tide.py
    fetch.sh
    nesdis-fetch.py
    nwsZones.py
    overlay.py
    overlay.sh
    paccup_overlay.py
    prunedata.sh
    prunemp4.sh
    sfcanalysis.py
    snapshot.sh
    airmard.c
)

dir=~/snapshot-`date +'%Y%m%dT%H%M'`
mkdir $dir

mkdir $dir/bin
for i in ${binfiles[@]} ; do
    cp -p ~/bin/$i $dir/bin
done

htmlfiles=(
    wx.html
    wind.html
    cloudTops.html
    dateformat.js
    local_config.js
    NowCOAST.js
    NowCOAST_ArcGIS.js
    currentMap.js
    wind.js
    gis.js
    index.html 
    favicon.ico
)

mkdir -p $dir/www/html
for i in ${htmlfiles[@]} ; do
    cp -p ~/www/html/$i $dir/www/html
done

(cd ~/www/html/; tar cf - data/lib) | (cd $dir/www/html ; tar xf -)

etcfiles=(
    nginx/nginx.conf
    logrotate.d/stfyc
)
mkdir -p $dir/etc
for i in ${etcfiles[@]} ; do
    cp -p /etc/$i $dir/etc
done

crontab -l > $dir/crontab.txt

