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
import shutil

maxretries = 4
quittingtime = datetime.datetime.now() + datetime.timedelta(minutes=4)
sockettimeout = 30 # surface analysis charts aren't very big

# This may screw up multithreading
# See https://bugs.python.org/issue6056 - original
# See https://github.com/python/cpython/issues/50306 - updated
socket.setdefaulttimeout(30.0)

# One root for data and one for binaries
binroot = "/home/stfyc"
webroot = "/home/stfyc/www/html/data"

default_levels = ["surface", "10_m_above_ground"]
default_vars = ["UGRD", "VGRD", "WIND", "GUST"]

dataroot = webroot
# If we have an external drive for archiving put images there.
if os.path.exists("/wx/data"):
    dataroot = "/wx/data"

def hrrrURL(m, ts, f):
    # HRRR base url
    hrrrroot = "https://nomads.ncep.noaa.gov/cgi-bin/filter_hrrr_2d.pl?"
    # Fill in with year, month, date
    hrrrdir = "dir=%%2Fhrrr.%04d%02d%02d%%2Fconus&file="
    # Fill in with model run hour
    hrrrfn = "hrrr.t%02dz.wrfsfcf%02d.grib2"
    
    t = ts - datetime.timedelta(minutes = m["lag"])
    d = hrrrdir % (t.year, t.month, t.day) 
    
    fn = hrrrfn % (t.hour, f)
    url = hrrrroot + d + fn
    return(t, f, url, fn)

def namURL(m, ts, f):
    # Actually the NAM-nest
    # https://nomads.ncep.noaa.gov/cgi-bin/filter_nam_conusnest.pl?dir=%2Fnam.20230525&file=nam.t00z.conusnest.hiresf00.tm00.grib
    root = "https://nomads.ncep.noaa.gov/cgi-bin/filter_nam_conusnest.pl"
    # Fill in with year, month, date
    mdir = "dir=%%2Fnam.%04d%02d%02d"
    # Fill in with model run hour
    fn = "nam.t%02dz.conusnest.hiresf%02d.tm00.grib2"

    logging.debug("ts %r" % (ts))
    t = ts - datetime.timedelta(minutes = m["lag"])
    logging.debug("t1 minus lag %r" % (t))
    hour = t.hour % 6
    t = t - datetime.timedelta(hours = hour)
    logging.debug("t2 (-hour %d) %r" % (hour, t))
    d = mdir % (t.year, t.month, t.day) 
    
    fn = fn % (t.hour, f)
    url = root + "?" + d + "&file=" + fn
    return(t, f, url, fn)

def gfsURL(m, ts, f):
    # GFS 0.25 degree operational run
    # Analysis
    # https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?dir=%2Fgfs.20230606%2F12%2Fatmos&file=gfs.t12z.pgrb2.0p25.anl
    # Forecast
    # https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?dir=%2Fgfs.20230606%2F12%2Fatmos&file=gfs.t12z.pgrb2.0p25.f000
    root = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
    # Fill in with year, month, date, hour
    mdir = "dir=%%2Fgfs.%04d%02d%02d%%2F%02d%%2Fatmos"
    # Fill in with model run hour, forecast hour
    fn = "gfs.t%02dz.pgrb2.0p25.f%03d"

    logging.debug("ts %r" % (ts))
    t = ts - datetime.timedelta(minutes = m["lag"])
    logging.debug("t1 minus lag %r" % (t))
    hour = t.hour % 6
    t = t - datetime.timedelta(hours = hour)
    logging.debug("t2 (-hour %d) %r" % (hour, t))
    d = mdir % (t.year, t.month, t.day, t.hour)

    # GFS currently has hourly forecast to 120 hours, every three hours 123 - 384

    # We will do every three hours for now, so 120 hours is the 41 forecasts (starting w/ zero)
    forecast = f * 3;

    fn = fn % (t.hour, forecast)
    url = root + "?" + d + "&file=" + fn
    return(t, forecast, url, fn)

# HRRR and NAM have hourly forecasts
def genHourly(f):
    hours = []
    for f in range(f):
        hours.append(f);
    return(hours)

# GFS has hourly forecasts but we're currently fetching every three hours
def genGFShours(f):
    hours = []
    for f in range(f):
        hours.append(3*f)
    return(hours)

models = {};
models["HRRR"] = {
    "model": "HRRR",
    "url": hrrrURL,
    "destroot": "NOAA",
    "lag": 55, # Minutes after the hour when the f18 forecast is ready
    "tifroot": webroot + "/NOAA/HRRR",
    "forecastHours": genHourly,
}

models["NAM"] = {
    "model": "NAM",
    "url": namURL,
    "destroot": "NOAA",
    "lag": 101, # Minutes after the hour when the f00 forecast is ready
    "tifroot": webroot + "/NOAA/NAM",
    "forecastHours": genHourly,
}

models["GFS"] = {
    "model": "GFS",
    "url": gfsURL,
    "destroot": "NOAA",
    "lag": 210, # Minutes after the hour when the f000 forecast is ready
    "tifroot": webroot + "/NOAA/GFS",
    "forecastHours": genGFShours,
}

regions = {}
regions["Karl"] = { "top": 38.75, "left": -124.5, "right": -120.0, "bottom": 36.75, "forecasts": 19, "model": "HRRR" }
regions["Eddy"] = { "top": 34.66, "left": -121.33, "right": -116.50, "bottom": 32.39, "forecasts": 19, "model": "HRRR"}
regions["NorCal-NAM"] = { "top": 38.5, "left": -123.5, "right": -121.0, "bottom": 36.5, "forecasts": 49, "model": "NAM", "vars": ["UGRD", "VGRD", "GUST"] }
regions["CA-NAM"] = { "top": 42.0, "left": -130.0, "right": -116.0, "bottom": 32.50, "forecasts": 49, "model": "NAM", "vars": ["UGRD", "VGRD", "GUST"] }
# GFS every 3 hours for 5 days is 41 forecasts
regions["CA-GFS"] = { "top": 42.0, "left": -136.0, "right": -112.0, "bottom": 30.00, "forecasts": 41, "model": "GFS", "vars": ["UGRD", "VGRD", "GUST"] }
regions["LIS"] = { "top": 41.5, "left": -74.2, "right": -71.5, "bottom": 40.50, "forecasts": 19, "model": "HRRR", "vars": ["UGRD", "VGRD", "GUST"] }
regions["NYBOS"] = { "top": 42.6, "left": -74.2, "right": -70.00, "bottom": 40.00, "forecasts": 19, "model": "HRRR", "vars": ["UGRD", "VGRD", "GUST"] }
regions["NYBOS-NAM"] = { "top": 42.6, "left": -74.2, "right": -70.00, "bottom": 40.00, "forecasts": 49, "model": "NAM", "vars": ["UGRD", "VGRD", "GUST"] }
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

def fetchNOMADS(reg, ts, force):
    r = regions[reg]
    m = models[r["model"]]
    
    levels = r["levels"] if ("levels" in r) else default_levels
    vs = r["vars"] if ("vars" in r) else default_vars

    params = ""
    for v in levels:
        params += "&lev_%s=on" % (v)
    for v in vs:
        params += "&var_%s=on" % (v)

    grib = None
    for forecast in range(r["forecasts"]):
        #logging.debug("forecast %d timestamp %r" % (forecast, ts))
        modelTime, forecasthour, url, fn = m["url"](m, ts, forecast);
        
        odir = "%s/%s/%s/%s/%s" % (dataroot, m["destroot"], m["model"], reg, "%4d%02d%02d" % (modelTime.year, modelTime.month, modelTime.day))
        if not os.path.exists(odir):
            logging.info("Create directory %s" % (odir))
            os.makedirs(odir, mode=0o755)
        ofn = "%s/%s" % (odir, fn)
        if (not force) and os.path.exists(ofn):
            logging.debug("Path exists %s" % (ofn))
        else:
            logging.info("Fetching %s" % (url))
            logging.debug("Dest %s" % (ofn))
            url += params
            url += "&subregion=&toplat=%.1f&leftlon=%.1f&rightlon=%.1f&bottomlat=%.1f" % (r["top"], r["left"], r["right"], r["bottom"])
            grib = urltryhard(url)
            if grib:
                logging.info("Save %s" % (ofn))
                with open(ofn, "w+b") as f: # added +b for binary file - who knew?
                    f.write(grib)
                if "tifroot" in m:
                    tifroot = m["tifroot"]
                    if not os.path.exists(tifroot):
                        logging.info("mkdir %s" % (tifroot))
                        os.mkdir(tifroot);
                    tdir = "%s/%s" % (tifroot, reg)
                    if not os.path.exists(tdir):
                        logging.info("mkdir %s" % (tdir))
                        os.mkdir(tdir);
                    tdir = "%s/%4d%02d%02d" % (tdir, modelTime.year, modelTime.month, modelTime.day)
                    if not os.path.exists(tdir):
                        logging.info("mkdir %s" % (tdir))
                        os.mkdir(tdir);
                    tfn = "%s/t%02d_f%03d.tif" % (tdir, modelTime.hour, forecasthour)
                    cmd = "gdal_translate %s %s" % (ofn, tfn)
                    logging.info("Running %s" % (cmd))
                    try:
                        retcode = subprocess.check_call(cmd, shell=True)
                        
                        # If this was the last forecast for a model run
                        logging.info("Downloaded forecast %d of %d" % (forecasthour + 1, r["forecasts"]))
                        if forecast == r["forecasts"] - 1:
                            latest = "%s/%s/%s" % (tifroot, reg, "latest.json")
                            try:
                                os.unlink(latest)
                            except OSError as err:
                                print("Error unlinking %s: %s (error type %s)" % (latest, err, type(err)))
                            logging.info("Writing %s" % (latest))
                            with open(latest, "w") as f:
                                mdate = "%4d%02d%02d" % (modelTime.year, modelTime.month, modelTime.day)
                                f.write('{ "mdate": "%s", "modelRun": "%d", "forecasts": %r }\n' % (mdate, modelTime.hour, m["forecastHours"](r["forecasts"])));
                        
                    except subprocessCallProcessError as e:
                        logging.error("Executing gdal_translate fails: %s" % (e))
            else:
                logging.debug("Couldn't fetch %s" % (url))
    return None

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    reg = []
    for r in regions:
        reg.append(r)
    parser.add_argument("-region", choices=reg, default="Karl", help="Geographic Region")
    parser.add_argument("-force", default=False, action='store_true', dest="force", help="Overwrite existing forecasts")
    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="info", help="Log level")
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

    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    logging.debug(args)
    
    now = datetime.datetime.now(datetime.timezone.utc)
    keep = 1
    for t in range(keep):
        fetchNOMADS(region, now - datetime.timedelta(hours=(keep-t)), args.force)
