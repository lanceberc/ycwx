#!/usr/bin/python

from __future__ import print_function
import os
import os.path
import urllib
import urllib.request
import urllib.error
import ssl
import http.client
from datetime import datetime
import logging
import socket
import subprocess

rootdir = "/home/stfyc/www/html/data/NOAA/OPC"

imageProcess = {}
imageProcess["pacific"] = [
    "%s/bin/paccup_overlay.py -region pacific" % ("/home/stfyc"),
    ]
maps = {}

maxretries = 4
sockettimeout = 30 # surface analysis charts aren't very big

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
        if certificate_error and insecure == None:
            # A null context disables certificate verification
            insecure = ssl.SSLContext()
        if not isopen:
            if tries > 1:
                logging.warning("URL Open #%d - %s" % (tries, url))
            try:
                connection = urllib.request.urlopen(url = url, context = insecure, data = None, timeout = sockettimeout) # Open shouldn't take this long
                if tries > 1:
                    logging.warning("URL Open complete")
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

def sfcanalysis(region):
    logging.debug("%s: %s" % (region, maps[region]))
    latest = urltryhard(maps[region])
    if not latest:
        logging.warning("Couldn't fetch URL %s" % (maps[region]))
        return(0)
    logging.debug("%s: %d bytes" % (maps[region], len(latest)))
    
    d = "%s/%s" % (rootdir, region)
    fn = "%s/%s" % (d, "last.png")

    last = ()
    try:
        with open(fn, 'r+b') as f:
            last = f.read()
    except:
        logging.info("%s couldn't open %s" % (region, fn))
        
    if latest == last:
        logging.debug("%s same content" % (region))
        return(0)
    
    if not os.path.isdir(d):
        logging.warning("Creating %s" % (d))
        os.makedirs(d)
    with open(fn, 'w+b') as f:
        last = f.write(latest)
    utc = datetime.utcnow()
    fn = "%s/%04d%02d%02d%02d%02d.png" % (d, utc.year, utc.month, utc.day, utc.hour - int(utc.hour % 6), 0)
    with open(fn, "w+b") as f:
        last = f.write(latest)
    logging.info("New Surface Analysis %s: %s" % (region, fn))
    return(1)
        
if __name__ == '__main__':
    loglevel = logging.INFO
    #loglevel = logging.DEBUG
    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    maps["pacific"] = "https://ocean.weather.gov/P_sfc_full_ocean_color.png"
    maps["atlantic"] = "https://ocean.weather.gov/A_sfc_full_ocean_color.png"
    maps["UA_pac"] = "https://ocean.weather.gov/UA/OPC_PAC.gif"
    maps["UA_pac_tropics"] = "https://ocean.weather.gov/UA/Pac_Tropics.gif"
    maps["UA_atl"] = "https://ocean.weather.gov/UA/OPC_ATL.gif"
    maps["UA_atl_tropics"] = "https://ocean.weather.gov/UA/Atl_Tropics.gif"
    maps["UA_west_cost"] = "https://ocean.weather.gov/UA/West_coast.gif"
    maps["UA_GoM"] = "https://ocean.weather.gov/UA/Mexico.gif"

    # for region in ("atlantic", "UA_atl", "UA_atl_tropics", "pacific", "UA_pac", "UA_pac_tropics", "UA_west_cost", "UA_GoM"):
    for region in ("pacific",):
        if sfcanalysis(region) > 0:
            if region in imageProcess:
                for cmd in imageProcess[region]:
                    logging.info("Running %s" % (cmd))
                    try:
                        retcode = subprocess.check_call(cmd, shell=True)
                    except subprocessCalledProcessError as e:
                        logging.info("Executing imageProcess fails: %s" % (e))
            

    # We don't care about Bermuda here
    # rootdir = "M:/BM/BWS"
    # maps["atlantic_polar"] = "http://www.weather.bm/images/surfaceAnalysis/Latest/Atlantic.png"
    # sfcanalysis("atlantic_polar")

"""
        try:
            sfcanalysis(region)
        except:
            logging.warning("Couldn't fetch %s" % (region))
"""
