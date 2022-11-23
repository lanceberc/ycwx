#!/usr/bin/python

from __future__ import print_function
import os
import os.path
import socket
import datetime
import argparse
import json
import urllib
import urllib.request
import urllib.error
import ssl
import http.client
import re
import logging
import multiprocessing
import subprocess
import sys
#from PIL import Image, ImageDraw, ImageFont, ImageFile

quittingtime = datetime.datetime.now()

maxretries = 4
sockettimeout = 30 # surface analysis charts aren't very big

# This may screw up multithreading
# See https://bugs.python.org/issue6056
socket.setdefaulttimeout(30.0)

"""
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/FD/GEOCOLOR/
<a href="20190281550_GOES17-ABI-FD-GEOCOLOR-5424x5424.jpg">
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/FD/GEOCOLOR/20190242145_GOES17-ABI-FD-GEOCOLOR-5424x5424.jpg
"""

"""
GOES-16 CONUS
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/CONUS/GEOCOLOR/
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/CONUS/GEOCOLOR/20192250851_GOES17-ABI-CONUS-GEOCOLOR-5000x3000.jpg

GOES-17 CONUS (aka PACUS)
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/CONUS/GEOCOLOR/
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/CONUS/GEOCOLOR/20192250851_GOES17-ABI-CONUS-GEOCOLOR-5000x3000.jpg

GOES-17 Pacific South West
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/SECTOR/psw/GEOCOLOR/20192250906_GOES17-ABI-psw-GEOCOLOR-2400x2400.jpg

GOES-16 US West Coast
https://cdn.star.nesdis.noaa.gov/GOES17/ABI/SECTOR/wus/GEOCOLOR/20192250850_GOES17-ABI-wus-GEOCOLOR-4000x4000.jpg
"""

# Might need one root for data and one for binaries
rootdir = "/home/stfyc"

destroot = "%s/www/html/data/GOES" % (rootdir)
source = "NESDIS"
regions = {}
regions["GOES-East"] = {"goes": "16", "dir": "FD", "sector": "FD", "res": "5424x5424"}
regions["GOES-West"] = {"goes": "17", "dir": "FD", "sector": "FD", "res": "5424x5424"}
#regions["GOES-West"] = {"goes": "18", "dir": "FD", "sector": "FD", "res": "5424x5424"}
regions["CONUS-East"] = {"goes": "16", "dir": "CONUS", "sector": "CONUS", "res": "5000x3000"}
regions["CONUS-West"] = {"goes": "17", "dir": "CONUS", "sector": "CONUS", "res": "5000x3000"}
#regions["CONUS-West"] = {"goes": "18", "dir": "CONUS", "sector": "CONUS", "res": "10000x6000"}
#regions["CONUS-West"] = {"goes": "18", "dir": "CONUS", "sector": "CONUS", "res": "5000x3000"}
regions["PSW"] = {"goes": "17", "dir": "SECTOR/psw", "sector": "psw", "res": "2400x2400"}
regions["West_Coast"] = {"goes": "17", "dir": "SECTOR/wus", "sector": "wus", "res": "4000x4000"}
#regions["West_Coast"] = {"goes": "18", "dir": "SECTOR/wus", "sector": "wus", "res": "4000x4000"}

imageProcess = {}
imageProcess["CONUS-West"] = [
    "%s/bin/paccup_overlay.py -region baydelta" % (rootdir),
    "%s/bin/paccup_overlay.py -region westcoast" % (rootdir),
    ]

imageProcess["GOES-West"] = [
    "%s/bin/paccup_overlay.py -region pacific" % (rootdir),
    ]

urlbase = "https://cdn.star.nesdis.noaa.gov/GOES%s/ABI/%s/GEOCOLOR/" # goes, dir
urlfn = "%s_GOES%s-ABI-%s-GEOCOLOR-%s.jpg" # timestamp, goes, sector, res
destbase = "%s/%s_%s/%s%s%s" # destroot, source, region, YMD
destfn = "GOES-%s_%s_%s%s%s%s%s.jpg" # goes, sector, YMDHm

urllib2knownerrors = {
    404: "Not found",
    10060: "Timeout"
}

# A certificate used by NESDIS or Python expired changed 2021-10;  I've tried updating the certificates
# Python uses by updating the conda environment but it didn't fix the problem.
# We do something stupid to work around this - if there's a verification error disable verification for
# future connection attempts by using a null SSL context. Let's hope NESDIS doesn't get hijacked.
certificate_error = False

def urltryhard(url):
    req = urllib.request.Request(url)
    global certificate_error
    insecure = None
    done = False
    tries = 0
    isopen = False
    resp = None
    while not done and (tries < maxretries):
        tries = tries + 1
        if (datetime.datetime.now() > quittingtime):
            logging.warning("Fetching has surpassed time limit - exiting");
            sys.exit(-1);
        if certificate_error and insecure == None:
            # A null context disables certificate verification
            insecure = ssl.SSLContext()
        if not isopen:
            if tries > 1:
                logging.warning("URL Open #%d - %s" % (tries, url))
            else:
                logging.debug("URL Open #%d - %s" % (tries, url))
            try:
                connection = urllib.request.urlopen(url = url, context = insecure, data = None, timeout = sockettimeout) # Open shouldn't take this long
                if tries > 1:
                    logging.warning("URL Open complete")
                else:
                    logging.debug("URL Open complete")
                isopen = True
            except urllib.error.HTTPError as e: # HTTPError is a subclass of URLError so check for it first
                logging.warning("URL Open HTTPError: %r" % (e))
                break # If there was an HTTP error, don't retry - this is often a 404 Not Found
            except urllib.error.URLError as e: # usually timeout
                if certificate_error == False and type(e.reason) == ssl.SSLCertVerificationError:
                    logging.warning("Disabling NESDIS HTTPS certificate verification")
                    certificate_error = True
                else:
                    logging.warning("URL Open URLError: %r" % (e))
                    logging.debug("URL Open type: %r" % (type(e.reason)))
            except socket.error as e:
                logging.warning("URL Open socket error: %r" % (e))
            except socket.timeout as e:
                logging.warning("URL Open Socket Timeout: %r" % (e))

        if isopen:
            if tries > 1:
                logging.warning("URL Read #%d - %s" % (tries, url))
            else:
                logging.debug("URL Read #%d - %s" % (tries, url))
            try:
                resp = connection.read()
                if tries > 1:
                    logging.warning("URL Read complete: %s" % (url))
                done = True
            except http.client.IncompleteRead as e:
                logging.warning("HTTP IncompleteRead: %r" % (e))
                isopen = False
            except urllib.error.HTTPError as e:
                logging.warning("URL Read HTTPError: %r" % (e))
                isopen = False
            except urllib.error.URLError as e: # usually timeout
                logging.warning("URL Read URLError: %r" % (e))
            except socket.error as e:
                logging.warning("URL Read socket error: %r" % (e))
                isopen = False
            except socket.timeout as e:
                logging.warning("URL Read: socket timeout: %r" % (e))

    if not done:
        logging.warning("URL Open giving up after %d attempts: %s" % (tries, url))
    try:
        connection.close()
    except:
        if done:
            logging.debug("Couldn't close socket")
    return(resp)

def fetchdirectory(region):
    r = regions[region]
    """ Fetch directory url, filter for image timestamps w/ desired resolution"""
    root = urlbase % (r['goes'], r['dir'])
    data = str(urltryhard(root))
    #logging.debug(type(data))
    lines = data.split('\\r\\n')
    logging.debug("Directory has %d entries" % (len(lines)))
    #tspat = re.compile(r'<a href=\"(\d\d\d\d\d\d\d\d\d\d\d)_GOES%s-ABI-%s-GEOCOLOR-%s.jpg\">' % (r['goes'], r['sector'], r['res']))
    pat = '<a href=\"' + urlfn % (r'(\d{11})', r['goes'], r['sector'], r['res']) + '\">' # group is timestamp
    #logging.debug("url pat: %s" % pat)
    tspat = re.compile(pat)
    # hrefpat = re.compile(r'<a href=\"(\d\d\d\d\d\d\d\d\d\d\d_GOES%s-ABI-%s-GEOCOLOR-%s.jpg)\">' % (r['goes'], r['sector'], r['res']))
    pat = '<a href=\"' +'(' + (urlfn % (r'\d{11}', r['goes'], r['sector'], r['res'])) + ')'  + '\">' # group is entire url
    #logging.debug("href pat: %s" % pat)
    hrefpat = re.compile(pat)
    tslist = []
    for l in lines:
        #logging.debug("m1 %s" % (l))
        ts = tspat.match(l)
        if ts:
            href = hrefpat.match(l)
            logging.debug("found %s" % (href.group(1)))
            tslist.append([ts.group(1), "%s/%s" % (root, href.group(1))])
    return tslist

def fetchts(region, ts, url):
    r = regions[region]
    """ NESDIS uses YEAR DAYOFYEAR TIME """
    year = ts[0:4]
    doy = ts[4:7]
    dt = datetime.datetime.strptime(year + " " + doy, "%Y %j")
    month = "%02d" % (dt.month)
    day = "%02d" % (dt.day)
    hour = ts[7:9]
    minute = ts[9:11]

    destdir = destbase % (destroot, source, region, year, month, day)
    fn = destfn % (r['goes'], r['sector'], year, month, day, hour, minute)
    fn = "%s/%s" % (destdir, fn)
    
    if os.path.exists(fn):
        logging.debug("Exists %s" % (fn))
        return 0

    if not os.path.exists(destdir):
        logging.debug("Create directory %s" % (destdir))
        os.makedirs(destdir, mode=0o755)
    logging.info("%s_%s GOES-%s %s: %s-%s-%s_%s:%sz" % (source, region, r['goes'], ts, year, month, day, hour, minute))
    image = urltryhard(url)
    if image:
        logging.debug("Save %s" % (fn))
        with open(fn, "w+b") as f: # added +b for binary file - who knew?
            f.write(image)
        bdir = "%s/%s_%s" % (destroot, source, region)
        latest = "%s/%s" % (bdir, "latest.jpg")
        if os.path.exists(latest):
            try:
                os.unlink(latest)
            except BaseException as err:
                print(f"Unexpected {err=}, {type(err)=}")
        os.symlink(fn, latest)
        return 1
    return 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    reg = []
    for r in regions:
        reg.append(r)
    parser.add_argument("-region", choices=reg, default="GOES-West", help="GOES Satellite")
    parser.add_argument("-force", default=False, action='store_true', dest="force", help="Overwrite existing output")
    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="info", help="Log level")
    parser.add_argument("-timelimit", default=5, type=int, help="Exit if not complete in TIMELIMIT minutes");
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

    region = args.region
    force = args.force

    quittingtime = datetime.datetime.now() + datetime.timedelta(minutes=args.timelimit);

    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    logging.debug(args)

    logging.info("Fetch NESDIS images for %s" % region)
    tslist = fetchdirectory(region)
    logging.info("Directory has %d images" % (len(tslist)))
    fetched = 0
    for ts in tslist:
        fetched += fetchts(region, ts[0], ts[1])
    logging.info("Fetched %d new images" % (fetched))

    if fetched > 0:
        if region in imageProcess:
            for cmd in imageProcess[region]:
                logging.info("Running %s" % (cmd))
                try:
                    retcode = subprocess.check_call(cmd, shell=True)
                except subprocessCalledProcessError as e:
                    logging.info("Executing imageProcess fails: %s" % (e))
