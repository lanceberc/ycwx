#!/usr/bin/python

#from __future__ import print_function
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

url = "https://madis-data.ncep.noaa.gov/madisPublic/cgi-bin/madisXmlPublicDir?rdr=&time=0&minbck=-59&minfwd=0&recwin=3&dfltrsel=1&state=CA&latll=37.6&lonll=-123.1&latur=38.0&lonur=-122.27&stanam=&stasel=0&pvdrsel=0&varsel=2&qctype=0&qcsel=1&xml=0&csvmiss=0"

destdir = "/home/stfyc/www/html/data/NOAA/MADIS"
fn = "madis.json"

maxretries = 4
sockettimeout = 30 # surface analysis charts aren't very big

quittingtime = datetime.datetime.now()

# This may screw up multithreading
# See https://bugs.python.org/issue6056 - original
# See https://github.com/python/cpython/issues/50306 - updated
socket.setdefaulttimeout(30.0)

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

stations = {}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
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

    logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=loglevel)
    logging.debug(args)

    now = datetime.datetime.now()
    quittingtime =  now + datetime.timedelta(minutes=1);
    data = str(urltryhard(url))
    #lines = data.split('\\r\\n')
    lines = data.split('\\n')

    pat = re.compile("\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)");

    interestingVars = ["V-TD", "V-RH", "V-T", "V-DD", "V-FF", "V-FFGUST", "V-ALTSE"]

    for l in lines:
        logging.debug("Line '%s'" % (l))
        fields = pat.fullmatch(l)
        logging.debug("Match '%r'" % (fields))
        if fields:
            variable = fields.group(1)
            station = fields.group(2)
            lat = fields.group(4)
            lon = fields.group(5)
            obstime = fields.group(8)
            provider = fields.group(9)
            value = fields.group(10)

            if variable in interestingVars:
                if not station in stations:
                    logging.debug("New station %s" % (station))
                    stations[station] = {}
                else:
                    if variable in stations[station] and stations[station]["obstime"] > obstime:
                        logging.debug("%s %s %s is older than %s %s" % (station, stations[station]["provider"], stations[station]["obstime"], "provider", obstime));
                        continue;
                stations[station]["lat"] = lat
                stations[station]["lon"] = lon
                stations[station]["obstime"] = obstime
                stations[station]["provider"] = provider
                stations[station][variable] = value
        
    jstr = json.dumps(stations, sort_keys=True, indent=4)
    if not os.path.exists(destdir):
        logging.debug("New directory %s" % (destdir))
        os.makedirs(destdir, mode=0o755)
        
    with open("%s/%s" % (destdir, fn), "w") as f:
        f.write(jstr)
