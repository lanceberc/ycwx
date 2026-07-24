#!/usr/bin/python

import socket
import requests
import json
import math
import time
import uuid
import datetime
import urllib3
import sys
import logging

logger = logging.getLogger(__name__)

noBatch = False  # log every packet
noUpcount = True # don't post the upcount log entries since they take a long time

deltaDistance = 0.25 # 1/4 nautical mile
#deltaDistance = 0.1 # 1/10 nautical mile
deltaTime = 300 # five minutes - log active targets at least this often
deltaPow = 2.5 # buckets of three, or 0.3 dB

reapFrequency = 60
updateFrequency = 600 # print status of active targets every 10 minutes
activePeriod = 6000 # "active" is seen in last hour

config = {}
targets = {} # every target seen since start

URL = "" # where to post vessel reports
UDP_IP = ""   # NMEA server ip address
UDP_PORT = "" # NMEA server port
myId = "" # My id as assigned by pcup
myIP = ""

sock = {}

mylat = 0
mylon = 0
latMin = 0
latMax = 0
lonMin = 0
lonMax = 0

shipNames = {}

recentLogs = 0

# There is a pip-installable Haversine library if we care
def haversine(lat1, lon1, lat2, lon2):
    #r = 6371.0 # Radius of Earth in km
    r = 3443.92 # Radius of Earth in nm
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    a = math.sin((lat2 - lat1) / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2)**2
    return (2 * r * math.asin(math.sqrt(a)))

def get_bearing(lat1, lon1, lat2, lon2):
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Calculate the change in coordinates
    d_lon = lon2 - lon1
    
    # Calculate bearing components
    x = math.sin(d_lon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(d_lon))
    
    # Calculate initial bearing in radians
    initial_bearing = math.atan2(x, y)
    
    # Convert radians to degrees and normalize to 0-360°
    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360
    
    return compass_bearing

# Kludgey way to find local IP from StackOverflow
def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        # doesn't even have to be reachable
        s.connect(('10.254.254.254', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def timeS(t):
    return datetime.datetime.fromtimestamp(t).strftime('%H:%M:%S')

class Target:
    def __init__(self, mmsi, time, lat, lon, distance, bearing):
        self.time = int(time)
        self.lat = lat
        self.lon = lon
        self.power = 0
        self.count = 0
        self.mmsi = mmsi
        self.distance = distance
        self.bearing = bearing

    def changed(self, time, distance):
        if self.count == 0:
            logger.debug("changed Count")
            return True
            
        if time - self.time > deltaTime:
            logger.debug("changed Time")
            return True

        if abs(distance - self.distance) > deltaDistance:
            logger.debug("changed Distance")
            return True

        #if abs(power - self.power) > deltaPow:
        #    logger.debug("changed Power")
        #    return True

        return False

    def avg(self, power):
        self.power = (self.count * self.power + power)/(self.count + 1)
        self.count+=1

    def reset(self, time, lat, lon, distance, bearing):
        logger.debug("reset %d rxtime %s -> %s" % (self.mmsi, timeS(self.time), timeS(time)))
        self.time = int(time)
        self.lat = lat
        self.lon = lon
        self.distance = distance
        self.bearing = bearing
        self.count = 0

def postUpdate(msg):
    global recentLogs
    
    tries = 0
    recentLogs += 1
    
    try:
        s = time.time()
        r = requests.post(URL, params = msg)
        e = time.time()
    
        if (e - s) > .5:
            logger.debug("post took %.0fms" % ((e-s) * 1000))
    #except NameResolutionError as e:
    except Exception as e:
        logger.warning("posting update failed %r" % (e))
        return
        
    if r.status_code != 200:
        logger.warning("post fail: %r %r" % (r, msg))

def inViewRect(lat, lon):
    return (latMin <= lat <= latMax) and (lonMin <= lon <= lonMax)
    
def logTarget(parsed, ts):
    distance = haversine(mylat, mylon, parsed["lat"], parsed["lon"])
    disLog = math.log10(distance)
    logScalePower = parsed["signalpower"] + 2*10*disLog
    power = (parsed["signalpower"] / 10)
    linearPower = 10**power #non-log value
    scalePower = linearPower*distance**2

    outs = {}
    if "shipname" in parsed:
        outs["shipname"] = parsed["shipname"]
    elif "name" in parsed:
        outs["shipname"] = parsed["name"]
    else:
        c=1
        outs["name"] = 'z' 
 
    outs["source"] = myId
    outs["mmsi"] = parsed["mmsi"]
    outs["type"] = parsed["type"]
    outs["lat"] = "%.4f" % (parsed["lat"])
    outs["lon"] = "%.4f" % (parsed["lon"])
    outs["distance"] = "%.2f" % (distance)
    outs["logScalePower"] = round(logScalePower,0)
    outs["signalpower"] = (parsed["signalpower"])
    outs["rawSignal"] = "%.4f" % (linearPower)
    outs["scaleRawSignal"] = "%.4f" % (scalePower)
    outs["signalpower"] = "%.2f" % (parsed["signalpower"])
    outs["in_view"] = parsed["in_view"]
    outs["rxtime"] = "%d" % (ts)

    logger.debug("logHit post: %r" % (outs))
    r = postUpdate(outs)

def shortHit(parsed, ts):
    #create the JSON object
    outs = {}
    if "shipname" in parsed:
        outs["shipname"] = parsed["shipname"]
    elif "name" in parsed:
        outs["shipname"] = parsed["name"]
    else:
        outs["name"] = 'z' 

    outs["lat"] = "%.4f" % (parsed["lat"])
    outs["lon"] = "%.4f" % (parsed["lon"])
    outs["mmsi"] = parsed["mmsi"]
    outs["type"] = parsed["type"]
    outs["rxtime"] = "%d" % (ts)
    outs["source"] = myId
    outs["in_view"]=0 #not in view

    logger.debug("Short hit post: %r" % (outs))
    postUpdate(outs)
    return 0

if __name__ == '__main__':

    with open("aislogger.json", "r") as jsonfile:
        config = json.load(jsonfile)

    myIP = get_ip()

    logLevel = logging.INFO
    if "debug" in config and config["debug"]:
        logLevel = logging.DEBUG
    FORMAT = '%(asctime)s %(message)s'
    logging.basicConfig(level=logLevel)

    config["mac"] = (int(uuid.getnode()))
    config["localIP"] = myIP

    next_update = 0

    URL = config["URL"]
    UDP_PORT = config["UDP_PORT"]
    UDP_IP = config["UDP_IP"]
    myId = config['myId']

    mylat = config["mylat"]
    mylon = config["mylon"]

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))

    if "viewLat" in config and "viewLon" in config:
        latMin = config["viewLat"][0]
        latMax = config["viewLat"][1]
        lonMin = config["viewLon"][0]
        lonMax = config["viewLon"][1]

    if "view_zone" in config:
        config['json_view'] = json.dumps(config["view_zone"])
    elif "viewLat" in config and "viewLon" in config:
        config['view_zone'] = [[latMin, lonMin], [latMax, lonMin], [latMax, lonMax,], [latMin, lonMax]]
        config['view_area'] = [[latMin, lonMin], [latMax, lonMin], [latMax, lonMax,], [latMin, lonMax]]
        config['json_view'] = json.dumps([[latMin, lonMin], [latMax, lonMin], [latMax, lonMax,], [latMin, lonMax]])
                
    recentTargets = {}
    recentPackets = 0

    lastReap = 0

    logger.info("Config: %r" % (config))
    postUpdate(config)
            
    while True:
        data, addr = sock.recvfrom(1024) # buffer size is 1024 bytes
        dstring = data.decode("utf-8")

        now = round(time.time(),0) #round to nearest second
        recentPackets += 1;
        
        if "}" in dstring:
            dstring=dstring.replace('"nmea":"_','"nmea":["' )
            dstring=dstring.replace('"nmea":_"','"nmea":["' )

            jParsed = json.loads(dstring)

            if not "mmsi" in jParsed:
                logger.info("no mmsi: %r" % jParsed)
                continue
                
            mmsi = jParsed["mmsi"]
            rxtime = now
            #if "rxuxtime" in jParsed:
            #    rxtime = int(jParsed["rxuxtime"])

            if "shipname" in jParsed and not mmsi in shipNames:
                shipNames[mmsi] = jParsed["shipname"]
            shipName = shipNames[mmsi] if mmsi in shipNames else ''

            recentTargets[mmsi] = 0

            try:
                #9669415
                if 9669415 < mmsi < 899999999 and "lat" in jParsed:  #ignore the atons and base stations. Ships only
                    lat = jParsed["lat"]
                    lon = jParsed["lon"]
                    power = jParsed["signalpower"] #use unscaled log power
                    distance = haversine(mylat, mylon, lat, lon)
                    bearing = get_bearing(mylat, mylon, lat, lon)
                    logger.debug("mmsi %s %s lat %6.2f lon %6.2f power %6.2f distance %.2f" % (mmsi, shipName, lat, lon, power, distance))

                    # Why bother checking if in view?
                    if True or inViewRect(lat, lon):
                        jParsed["in_view"] = 1

                        if mmsi in targets:
                            target = targets[mmsi]

                            if noBatch:
                                target.avg(power) # average the power in
                                logTarget(jParsed, rxtime) # log 1st hit of this sequence
                                target.reset(rxtime, lat, lon, distance, bearing)
                                continue

                            # if one of the criteria has changed significantly, log the old state and reset the station
                            if target.changed(rxtime, distance):
                                if (target.count > 1):
                                    if (not noUpcount):
                                        update = {"command": "upcount", "mmsi": mmsi, "source": myId, "rxtime": target.time, "count": target.count }
                                        logger.debug("upcount %d %s %r" % (mmsi, shipName, update))
                                        postUpdate(update)
                                    else:
                                        logger.debug("upcount %d %s %d" % (mmsi, shipName, target.count))
                                    
                                    target.reset(rxtime, lat, lon, distance, bearing)
                                target.avg(power)
                                logTarget(jParsed, rxtime) # log 1st hit of this sequence
                            else:
                                target.avg(power) # average the power in
                                logger.debug("mmsi %s %s count %d" % (mmsi, shipName, target.count))
                        else:
                            target = Target(mmsi, rxtime, lat, lon, distance, bearing)
                            target.avg(power)
                            targets[mmsi] = target
                            logTarget(jParsed, rxtime) # put new target in db
                            if noBatch:
                                target.reset(rxtime, lat, lon, distance, bearing)
                    
            except Exception as e:
                logger.warning("contains error %r %r" % (e, jParsed))
                raise

        if now - lastReap > reapFrequency: # log the last hits for targets that we haven't seen for a while
            logger.debug("reaping")
            keys = list(targets.keys())
            keys.sort()
            
            for k in keys:
                t = targets[k]
                if t.time + deltaTime < now:
                    if t.count > 0:
                        shipName = shipNames[k] if k in shipNames else ''
                        if (not noUpcount):
                            update = {"command": "upcount", "mmsi": k, "source": myId, "rxtime": t.time, "count": t.count }
                            logger.debug("reaping %d %s upcount %r" % (k, shipName, update))
                            postUpdate(update)
                        else:
                            logger.debug("reaping %d %s upcount %d" % (k, shipName, t.count))
                        t.reset(t.time, t.lat, t.lon, t.distance, t.bearing)

            logger.debug("Setting lastReap %s -> %s" % (timeS(lastReap), timeS(now)))
            lastReap = now

        if now > next_update:
            logger.debug("Config post: %r" % (config))
            postUpdate(config)
            
            next_update = now + updateFrequency

            keys = list(targets.keys())
            keys.sort()
            logger.info("%s total targets %d" % (timeS(now), len(keys)))
            logger.info("Recent Packets %d Targets %d Rate %.2f/s" % (recentPackets, len(recentTargets), recentPackets/updateFrequency))
            logger.info("Recent Logs %d Rate %.2f/s" % (recentLogs, recentLogs/updateFrequency))

            dd = 0
            ac = 0
            for k in keys:
                t = targets[k]
                if (t.count > 0) or (now - t.time) < activePeriod:
                    ac += 1;
                    if (t.count > 0) or (now - t.time < deltaTime):
                        dd += 1;
                    shipName = shipNames[k] if k in shipNames else ''
                    logger.info("%9s %8s count %2d %5.2fnm @ %3.0f %s" % (k, timeS(t.time), t.count, t.distance, t.bearing, shipName))
            logger.info("Active %d Recent %d" % (ac, dd))

            recentTargets = {}
            recentPackets = 0
            recentLogs = 0
