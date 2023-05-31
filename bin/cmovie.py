#!/usr/bin/python
import os
import sys
import argparse
import subprocess
import logging
import datetime
import os
import os.path

ffmpeg = "ffmpeg"
rootdir = "/home/stfyc/www/html/data/NOAA/overlay"
datadir = rootdir
if os.path.exists("/wx/data"):
    datadir = "/wx/data/NOAA/overlay"

reldir = "data/NOAA/overlay"

regions = {
    "pacific" : {
        "goes": "18",
        "prefix": "Pacific",
    },
    "atlantic": {
        "goes": "16",
        "prefix": "Atlantic",
    },
    "westcoast" :{
        "goes": "18",
        "prefix": "WestCoast",
    },
    "baydelta": {
        "goes": "18",
        "prefix": "BayDelta",
    },
    "baydeltawind": {
        "goes": "18",
        "prefix": "BayDeltaWind",
    },
    "baydelta500m": {
        "goes": "18",
        "prefix": "BayDelta500m",
    },
    "eastpacificglm": {
        "goes": "18",
        "prefix": "EastPacificGLM",
    },
    "westcoastglm": {
        "goes": "18",
        "prefix": "WestCoastGLM",
    },
    "cacoast": {
        "goes": "18",
        "prefix": "CaliforniaCoast",
    },
    "eddy": {
        "goes": "18",
        "prefix": "Eddy",
    },
    "eddy500m": {
        "goes": "18",
        "prefix": "Eddy500m",
    },
}

def find_sources(region):
    sourcedir = "%s/%s" % ((datadir, regions[region]["prefix"]))
    dates = os.listdir(sourcedir)
    dates.sort()
    l = []
    logging.debug("find_sources() sourcedir %s has %d dates" % (sourcedir, len(dates)))
    for date in dates:
        if os.path.isdir("%s/%s" % (sourcedir, date)):
            datedir = "%s/%s" % (sourcedir, date)
            s = os.listdir(datedir)
            s.sort()
            files = [ fn for fn in s if fn.endswith(".png") or fn.endswith(".jpg") ]
            logging.debug("find_sources() date %s has %d files and %d filtered files" % (datedir, len(s), len(files)))
            for f in files:
                l.append("%s/%s" % (date, f))
    return(l)

framerate = 15 # frames per second
def make_concatfile(region, fns, start, end, hold):
    sd = "%s/%s" % (datadir, regions[region]["prefix"])
    fts = None
    lts = None
    used = 0
    logging.debug("make_concatfile: start %s end %s" % (start, end))
    logging.info("make_concatfile() with %d source files" % (len(fns)))
    with open("%s-files.txt" % (region), "w") as f:
        for fn in fns:
            # Look for '_' where filenames are YYYYMMDD_HHMM.jpg
            # Otherwise it's one blob YYYYMMDDHHMM.jpg
            #logging.debug("fn: %s -9:%s" % (fn, fn[-9:-8]))
            if (fn[-9:-8] == '_'):
                ts = fn[-17:-9] + fn[-8:-4]
            else:
                ts = fn[-16:-4]
            if (ts < start):
                continue
            if (ts > end):
                break;
            if not fts:
                fts = ts
            lts = ts
            used += 1
            f.write("file '%s/%s'\n" % (sd, fn))
            f.write("duration %5f\n" % (1.0/framerate))
        for h in range(framerate * hold):
            f.write("file '%s/%s'\n" % (sd, fns[-1]))
            f.write("duration %5f\n" % (1.0/framerate))

    logging.debug("make_concatfile: fts %s lts %s" % (fts, lts))
    logging.info("make_concatfile: %d + %d frames" % (used, framerate * hold))

    if (used == 0):
        logging.warning("No sources found in the time range to make movie")
        sys.exit(1)
    
    return((fts, lts))

def make_movie(region, size, ofile):
    isRPi = False;
    scale = ''
    scales = {
        "HD": "1280x720",
        "FullHD": "1920x1080",
    }
    if (size in scales):
        scale = '-s %s' % scales[size];

    try:
        with open('/sys/firmware/devicetree/base/model') as f:
            try:
                l = f.read();
                if (l.find("Raspberry Pi") == 0):
                    isRPi = True;
            except:
                logging.warning("Couldn't read from /sys/firmware/devicetree/base/model");
    except:
        logging.warning("Couldn't open /sys/firmware/devicetree/base/model");

    if isRPi:
        # Use hardware encoder on Raspberry Pi - set bitrate crazy high
        cmd = "%s -v info -y -f concat -safe 0 -i %s-files.txt %s -c:v h264_v4l2m2m -r 15 -b:v 12000k -pix_fmt yuv420p -an -movflags +faststart %s" % (ffmpeg, region, scale, ofile)
        #cmd = "%s -v info -y -f concat -safe 0 -i %s-files.txt %s -c:v h264_v4l2m2m -r 15 -b:v 12000k -pix_fmt nv12 -f mpegts -an -movflags +faststart %s" % (ffmpeg, region, scale, ofile)
        logging.debug("Using Raspberry Pi hardware encoder");
    else:
        # Use the software encoder
        cmd = "%s -r 15 -y -benchmark -f concat -safe 0 -i %s-files.txt %s -c:v libx264 -crf 23 -probesize 20M -preset slow -pix_fmt yuv420p -an -movflags +faststart %s" % (ffmpeg, region, scale, ofile)
        logging.warning("Using libx264 software encoder");
        
    logging.debug("Running %s" % (cmd))
    try:
        retcode = subprocess.check_call(cmd, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))
        return(-1)
    return(retcode)

if __name__ == '__main__':
    loglevel = logging.DEBUG
    parser = argparse.ArgumentParser()

    parser.add_argument("-region", choices=regions.keys(), required=True)

    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="debug", help="Log level")
    parser.add_argument("-start", default="201801010000", help="Start timestamp")
    parser.add_argument("-end", default="210012312359", help="End timestamp")
    parser.add_argument("-minutes", type=int, default="0", help="Most recent N minutes")
    parser.add_argument("-hours", type=int, default="0", help="Most recent N hours")
    parser.add_argument("-days", type=int, default="0", help="Most recent N days")
    parser.add_argument("-hold", type=int, default="0", help="Seconds to hold last frame")
    parser.add_argument("-withsource", default=False, action='store_true', help="Put output in sourcedir and create lastest link")
    parser.add_argument("-size", choices=["FullHD", "HD"], default="FullHD", help="Size FullHD (1920x1080) or HD (1280x720)")
    args = parser.parse_args()

    if args.log == "debug":
        loglevel = logging.DEBUG
    if args.log == "info":
        loglevel = logging.INFO
    if args.log == "warning":
        loglevel = logging.WARNING
    if args.log == "error":
        loglevel = logging.ERROR
    if args.log == "critical":
        loglevel = logging.CRITICAL

    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)

    logging.info(args)

    if (args.hours > 0) or (args.minutes > 0) or (args.days > 0):
        now = datetime.datetime.now(datetime.timezone.utc)
        startdate = now - datetime.timedelta(hours=args.hours, minutes=args.minutes, days=args.days)
        args.start = startdate.strftime("%Y%m%d%H%M")
        logging.debug("Setting start time to %s" % (args.start))

    o = args.region
    sources = find_sources(o)
    if len(sources) < 2:
        logging.warning("Not enough sources (%d) to make movie" % (len(sources)))
        sys.exit(1)
        
    (fts, lts) = make_concatfile(o, sources, args.start, args.end, args.hold)

    s = "%s-%s-%s_%s%sZ" % (fts[0:4], fts[4:6], fts[6:8], fts[8:10], fts[10:12])
    et = sources[len(sources)-1]
    e = "%s-%s-%s_%s%sZ" % (lts[0:4], lts[4:6], lts[6:8], lts[8:10], lts[10:12])
    if args.withsource:
        ofile = "%s/%s/%s_%s-%s.mp4" % (rootdir, regions[o]["prefix"], regions[o]["prefix"], s, e)
    else:
        ofile = "%s_%s-%s.mp4" % (regions[o]["prefix"], s, e)

    r = make_movie(o, args.size, ofile)
    if r != 0:
        logging.error("make_movie returned %d" % (r))

    if (r == 0) and (args.withsource):
        stinfo = os.stat(ofile)
        if stinfo.st_size < (1024*1024):
            logging.error("%s too small (%d) - not symlinking to latest.mp4" % (ofile, stinfo.st_size))
        else:
            latest = "%s/%s/%s" % (rootdir, regions[o]["prefix"], "latest.mp4")
            if os.path.lexists(latest):
                os.unlink(latest)
            os.symlink(ofile, latest)
            latest = "%s/%s/%s" % (rootdir, regions[o]["prefix"], "latest.json")
            ofile = "%s/%s/%s_%s-%s.mp4" % (reldir, regions[o]["prefix"], regions[o]["prefix"], s, e)
            logging.debug("New latest.json %s" % (latest))
            logging.debug("New latest.json fn %s (reldir %s)" % (ofile, reldir))
            with open(latest, "w") as f:
                f.write("{\n");
                f.write('    "fn": "%s"\n' % (ofile));
                f.write("}\n");

    os.remove("%s-files.txt" % (o))
    logging.info("Output in %s" % (ofile))
