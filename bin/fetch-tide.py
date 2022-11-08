#!/usr/bin/python

import os.path
import os
import time
import datetime
import pytz
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
import json

loglevel = logging.DEBUG

tzLocal = zoneinfo.ZoneInfo("America/Los_Angeles")
tzUTC = datetime.timezone.utc

#  /api/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&begin_date=20220703&end_date=20220704&datum=MLLW&station=9414290&time_zone=lst_ldt&units=english&interval=hilo&format=json

noaaTideURL = 'https://tidesandcurrents.noaa.gov/api/datagetter?station=&begin_date=&end_date=&applications=StFYC&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json'
noaaTideStation = '9414290'

noaaCurrentURL = 'https://tidesandcurrents.noaa.gov/api/datagetter?station=&begin_date=&end_date=&applications=StFYC&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json'

noaaCurrentURL = 'https://tidesandcurrents.noaa.gov/noaacurrents/DownloadPredictions?fmt=json&i=6min&d=2022-07-05&r=1&tz=LST%2fLDT&u=1&id=SFB1203_18&t=24hr&i=6min&threshold=leEq&thresholdvalue='

noaaCurrentURL = 'https://tidesandcurrents.noaa.gov/noaacurrents/DownloadPredictions?id=&d=fmt=csv&i=6min&r=1&tz=LST%2fLDT&u=1&t=24hr&i=6min'

noaaCurrentStation = 'SFB1204_18'

outputfile = "/home/stfyc/www/html/data/NOAA/tides.json"

maxretries = 4
sockettimeout = 90

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

def parse(txt):
    return({});

args = None
if __name__ == '__main__':

    loglevel = logging.DEBUG
    parser = argparse.ArgumentParser()

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

    now = datetime.datetime.now(tz=tzLocal)
    begin_date = now.strftime("%Y%m%d")
    now += datetime.timedelta(days = 1)
    end_date = now.strftime("%Y%m%d")

    url = noaaTideURL
    url = url.replace("station=", "station=" + noaaTideStation)
    url = url.replace("begin_date=", "begin_date=" + begin_date)
    url = url.replace("end_date=", "end_date=" + end_date)

    logging.debug("Fetch: %s" % (url))
    res = urltryhard(url)
    if res == None:
        logging.warning("URL fetch failed");
        exit()
    tides = json.loads(res)
    logging.debug("Tides json %r", tides)

    url += "&interval=hilo"
    logging.debug("Fetch: %s" % (url))
    res = urltryhard(url)
    if res == None:
        logging.warning("URL fetch failed");
        exit()
    hilo = json.loads(res)
    logging.debug("hilo json %r", hilo)

    # Currents (Station ID SFB1203_18, but xtide doesn't use Station IDs)
    # tide -l "Golden Gate Bridge, 0.46 nmi E of (depth 30 ft), California Current" -in y -b "2022-07-05 00:00" -e "2022-07-07 00:00"
    # tide -l "Golden Gate Bridge, 0.46 nmi E of (depth 30 ft), California Current" -in y -b "2022-07-05 00:00" -e "2022-07-07 00:00" -m r

    location = "Golden Gate Bridge, 0.46 nmi E of (depth 30 ft), California Current"
    localtz = "America/Los_Angeles"

    now = datetime.datetime.now(tz=tzLocal)
    begin_date = now.strftime("%Y-%m-%d 00:00")
    now += datetime.timedelta(days = 2)
    end_date = now.strftime("%Y-%m-%d 00:00")
    
    cmd = 'tide -l "LOCATION" -in y -b "BEGIN" -e "END" -m r -s 00:06'
    cmd = cmd.replace("LOCATION", location)
    cmd = cmd.replace("BEGIN", begin_date)
    cmd = cmd.replace("END", end_date)
    logging.debug("tide command: %s " % (cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))

    logging.debug("tide returned %r" % (result))
    current_list = result.stdout.split("\n")
    current_points = []
    logging.debug("current_list %r" % (current_list))

    local = pytz.timezone(localtz)
    for i in current_list:
        #logging.debug("point %r" % (i))
        if i != '':
            if (True):
                (t, v) = i.split(" ");
                naive = datetime.datetime.fromtimestamp(int(t))
                local_dt = local.localize(naive)
                utc_dt = local_dt.astimezone(pytz.utc)
                val = float(v)
                current_points.append([naive.strftime("%Y-%m-%dT%H:%M"), val])
            else:
                (t, v) = i.split(" ");
                naive = datetime.datetime.fromtimestamp(int(t))
                local_dt = local.localize(naive)
                utc_dt = local_dt.astimezone(pytz.utc)
                val = float(v)
                current_points.append([utc_dt.strftime("%Y-%m-%dT%H:%M"), val])
                
    logging.debug("Points %r" % (current_points))
    
    now = datetime.datetime.now(tz=tzLocal)
    begin_date = now.strftime("%Y-%m-%d 00:00")
    now += datetime.timedelta(days = 2)
    end_date = now.strftime("%Y-%m-%d 00:00")
    
    cmd = 'tide -l "LOCATION" -b "BEGIN" -e "END" -in y -df "%Y-%m-%d" -tf "%H:%M"'
    cmd = cmd.replace("LOCATION", location)
    cmd = cmd.replace("BEGIN", begin_date)
    cmd = cmd.replace("END", end_date)
    logging.debug("tide command: %s " % (cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    except subprocess.CalledProcessError as e:
        logging.info("Execution failed: %s" % (e))

    logging.debug("Current info %r" % (result.stdout))

    info_list = result.stdout.split("\n")
    current_info = {}
    current_info["events"] = []
    for i in range(len(info_list)):
        line = info_list[i];
        if (len(line) == 0):
            pass;
        elif (i == 0):
            current_info["location"] = line;
        elif (i == 1):
            current_info["position"] = line;
        elif (i == 2):
            current_info["flood_direction"] = line;
        elif (i == 3):
            current_info["ebb_direction"] = line;
        elif (i == 4):
            pass
        else:
            logging.debug("line: %r" % (line))
            t = line[0:16]
            c = line[19:20]
            if (c >= "0") and (c <= "9"):
                v = float(line[17:24])
                e = line[31:]
                current_info["events"].append({"t": t, "v": v, "e": e})
            else:
                e = line[19:]
                current_info["events"].append({"t": t, "e": e})
    logging.debug("Events: %r" % (current_info))

    """
    logging.debug("Fetch: %s" % (url))
    res = urltryhard(url)
    if res == None:
        logging.warning("URL fetch failed");
        exit()
    logging.debug("Speeds csv %r", res)
    speeds = parse(res)
    """
    
    data = {
        "tides": tides["predictions"],
        "hilo": hilo["predictions"],
    }
    if len(current_points) != 0:
        data["current_points"] = current_points
    
    if len(current_info) != 0:
        data["current_info"] = current_info
    
    with open(outputfile, "w") as f:
        json.dump(data, f);
