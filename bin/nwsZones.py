#!/usr/bin/python

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

maxretries = 4
sockettimeout = 30

urllib2knownerrors = {
    404: "Not found",
    10060: "Timeout"
}

regions = {}
regions["sf"] = {
    "zones":        "https://tgftp.nws.noaa.gov/data/raw/fz/fzus56.kmtr.cwf.mtr.txt",
    "afd":          "https://tgftp.nws.noaa.gov/data/raw/fx/fxus66.kmtr.afd.mtr.txt",
    "observations": "https://tgftp.nws.noaa.gov/data/raw/sx/sxus86.kmtr.omr.mtr.txt",
}

# Fetch and parse NOAA zones from the ftp server.
destbase = "/home/stfyc/www/html/data/nwsZones"

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

def parseAFD(text):
    # This is kludgey because it assumes only one AFD and exits after the $$
    # even though the forcasters names come later
    # It may crash on malformed input
    logging.debug("AFD text is type %s" % (type(text)))
    lines = text.split("\n");
    logging.debug("File has %d lines" % (len(lines)))
    logging.debug("First line %s" % (lines[0]))

    out = ""
    line = 0;
    zone = lines[line].split(' ')[1];
    logging.debug("Zone: %s" % (zone))
        
    out += '<div class="nws-zone-text">\n'
    paragraph = ""
    pCount = 0;
    
    while lines[line] != "$$":
        if lines[line] == "":
            if paragraph != "":
                pClass = 'class="nws-zone-paragraph"'
                if pCount < 2:
                    pClass = 'class="nws-zone-title"'
                out += ('<p %s>' % (pClass)) + paragraph + '</p>\n'
                paragraph = ""
                pCount += 1
        elif lines[line][0] == '.' and lines[line][1] != '.':
            paragraph += lines[line][1:]
        elif lines[line] != "&&":
            paragraph += " " + lines[line]
        line += 1
    out += "</div>"

    logging.debug(out)
    fn = "%s/%s" % (destdir, "%s.html" % (zone))
    with open(fn, "w") as f:
        f.write(out)

def parseZones(text):
    logging.debug("Zone text is type %s" % (type(text)))
    lines = text.split("\n");
    logging.debug("File has %d lines" % (len(lines)))
    logging.debug("First line %s" % (lines[0]))

    out = ""
    line = 0;
    while line < len(lines):
        # Find zone
        pCount = 0
        paragraph = ""
        while (line < len(lines)) and (lines[line].find("PZZ") != 0):
            line += 1

        if line == len(lines):
            break;
        
        zone = lines[line][0:lines[line].find('-')];
        logging.debug("Zone: %s" % (zone))
        
        out += '<div class="nws-zone-text">\n'
        paragraph = ""
        while lines[line] != "$$":
            if lines[line] == "":
                pClass = 'class="nws-zone-paragraph"'
                if pCount < 1:
                    pClass = 'class="nws-zone-title"'
                if paragraph != "":
                    out += ('<p %s>' % (pClass)) + paragraph + '</p>\n'
                    paragraph = ""
                    pCount += 1
            elif lines[line][0] == '.' and lines[line][1] != '.':
                paragraph += "<br>" + lines[line][1:]
            elif lines[line] != "&&":
                paragraph += " " + lines[line]
            line += 1
        out += "</div>"

        logging.debug(out)
        fn = "%s/%s" % (destdir, "%s.html" % (zone))
        with open(fn, "w") as f:
            f.write(out)
        line += 1
        out = ""

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    reg = []
    for r in regions:
        reg.append(r)
    parser.add_argument("-region", choices=reg, default="sf", help="San Francisco Zone (Monterey Field Office)")
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

    destdir = destbase
    if not os.path.exists(destdir):
        logging.debug("Create directory %s" % (destdir))
        os.makedirs(destdir, mode=0o755)

    if "zones" in regions[region]:
        logging.info("Fetch Zonal Forecasts for %s" % region)
        text = urltryhard(regions[region]["zones"])
    
        fn = "%s/%s" % (destdir, "zones.txt")
        logging.debug("Save %s" % (fn))
        with open(fn, "w+b") as f: # added +b for binary file - who knew?
            f.write(text)
        parseZones(text.decode("UTF-8"))

    if "afd" in regions[region]:
        logging.info("Fetch AFD for %s" % region)
        text = urltryhard(regions[region]["afd"])
    
        fn = "%s/%s" % (destdir, "afd.txt")
        logging.debug("Save %s" % (fn))
        with open(fn, "w+b") as f: # added +b for binary file - who knew?
            f.write(text)
        parseAFD(text.decode("UTF-8"))

    if "observations" in regions[region]:
        logging.info("Fetch Observations for %s" % region)
        text = urltryhard(regions[region]["observations"])
    
        fn = "%s/%s" % (destdir, "observations.txt")
        logging.debug("Save %s" % (fn))
        with open(fn, "w+b") as f: # added +b for binary file - who knew?
            f.write(text)
