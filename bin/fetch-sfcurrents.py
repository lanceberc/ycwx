#!/usr/bin/python

import os.path
import os
import datetime
import zoneinfo
import socket
import urllib
import urllib.request
import urllib.error
import ssl
import http.client
import logging
import subprocess
import argparse

loglevel = logging.DEBUG

tzLocal = zoneinfo.ZoneInfo("America/Los_Angeles")
tzUTC = datetime.timezone.utc

images = {
    "SFBOS_current": {
        # https://cdn.tidesandcurrents.noaa.gov/ofs/sfbofs/wwwgraphics/SFBOFS_entrance_cu_fore_202206080100.png
        "arg": "current",
        "urlbase": "https://cdn.tidesandcurrents.noaa.gov/ofs/sfbofs/wwwgraphics",
        "fnbase": "SFBOFS_entrance_cu_fore_",
        "suffix": ".png",
        "rawbase": "/home/stfyc/www/html/data/SFBOFS",
        "crop": "680x460+72+16",
        "latest": True,
    },
    "WCOFS_tide": {
        #https://cdn.tidesandcurrents.noaa.gov/ofs/wcofs/wwwgraphics/WCOFS_wl_sfra_big.png
        "arg": "tide",
        "urlbase": "https://cdn.tidesandcurrents.noaa.gov/ofs/wcofs/wwwgraphics",
        "fnbase": "WCOFS_wl_sfra_big.png",
        "suffix": "",
        "rawbase": "/home/stfyc/www/html/data/WCOFS",
        "crop": "",
        "crop": "618x444+0+24",
        "latest": False,
    },
    "WCOFS_wtemp": {
        #https://cdn.tidesandcurrents.noaa.gov/ofs/wcofs/wwwgraphics/WCOFS_temp_sfra_big.png
        "arg": "wtemp",
        "urlbase": "https://cdn.tidesandcurrents.noaa.gov/ofs/wcofs/wwwgraphics",
        "fnbase": "WCOFS_temp_sfra_big.png",
        "suffix": "",
        "rawbase": "/home/stfyc/www/html/data/WCOFS",
        "crop": "",
        "crop": "618x444+0+24",
        "latest": False,
    },
}

maxretries = 4
sockettimeout = 30

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

args = None
if __name__ == '__main__':

    loglevel = logging.DEBUG
    parser = argparse.ArgumentParser()

    choices = []
    choicemap = {}
    for i in images:
        if images[i]["arg"] != "":
            choices.append(images[i]["arg"])
            choicemap[images[i]["arg"]] = i
    parser.add_argument("-image", choices=choices, help="Region to process", required=True)
    
    parser.add_argument("-log", choices=["debug", "info", "warning", "error", "critical"], default="info", help="Log level")
    args = parser.parse_args()

    logmap = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL,
    }
    loglevel = logmap[args.log]
    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    
    now = datetime.datetime.now(tz=tzLocal)
    img = images[choicemap[args.image]]

    if img["arg"] == "current":
        oneHour = datetime.timedelta(hours=1)
        ts = datetime.datetime.strftime(now + oneHour, "%Y%m%d%H00");
        fn = "%s%s.png" % (img["fnbase"], ts);
    else:
        fn = img["fnbase"]
        
    ofn = "%s/%s" % (img["rawbase"], fn);

    #if os.path.exists(ofn):
    #    logging.debug("Output exists: %s", ofn);
    #    exit();

    url = "%s/%s" % (img["urlbase"], fn);

    d = img["rawbase"]
    if not os.path.exists(d):
        logging.debug("Create directory %s" % (d))
        os.makedirs(d, mode=0o755)

    image = urltryhard(url)
    if not image:
        exit()
    
    logging.debug("Save %s" % (ofn))
    with open(ofn, "w+b") as f: # +b for binary file - who knew?
        f.write(image)

    #"graphicsmagick"
    cmd = "gm mogrify -crop %s %s" % (img["crop"], ofn)
    logging.debug("Running %s" % (cmd))
    try:
        retcode = subprocess.check_call(cmd, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))

    if img["latest"]:
        latest = "%s/%s" % (d, "latest.png")
        if os.path.lexists(latest):
            os.unlink(latest)
        os.symlink(fn, latest)
