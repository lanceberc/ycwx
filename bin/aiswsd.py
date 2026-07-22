#!/usr/bin/python

import socket
import json
import time
import logging
import asyncio
from websockets.asyncio.server import serve
import websockets

config = {
    "debug": logging.INFO,
    "AISserverIP": "127.0.0.1",
    "AISserverPORT": 5006,
    "websocketIP": "127.0.0.1",
    "websocketPORT": 8185
}

logger = logging.getLogger(__name__)
FORMAT = '%(asctime)s %(message)s'
logging.basicConfig(level=config["debug"])

AIVDM_fields = ["callsign", "country", "country_code", "rxtime", "lat", "lon", "speed", "course", "heading", "turn", "accuracy", "shipname" ]

class Target:
    """Targets seen by the AIS receiver"""
    mmsi = 0
    shipname = ""
    lat = 0.0
    lon = 0.0
    speed = 0.0
    course = 0.0
    heading = 0
    fields = {}
    first = time.time()

    def __init__(self, mmsi):
        self.mmsi = mmsi
        for f in AIVDM_fields:
            self.fields[f] = ""
        
    def update(self, j):
        self.last = time.time()
        for f in j:
            if f == "lat":
                self.lat = float(j["lat"])
            if f == "lon":
                self.lon = float(j["lon"])
            if f == "speed":
                self.speed = float(j["speed"])
            if f == "course":
                self.course = float(j["course"])
            if f == "heading":
                self.heading = int(j["heading"])
            if f == "shipname":
                self.shipname = j["shipname"]
            if f == "shiptype":
                self.shiptype = int(j["shiptype"])
            if f == "shiptype_text":
                self.shiptypeText = j["shiptype_text"]
            if f == "destination":
                #logger.info("ais: %9d '%s' destination '%s'" % (self.mmsi, self.shipname, j["destination"]))
                self.destination = j["destination"]
            if f == "to_bow":
                self.toBow = int(j["to_bow"])
            if f == "to_stern":
                self.toStern = int(j["to_stern"])
            if f == "to_port":
                self.toPort = int(j["to_port"])
            if f == "to_starboard":
                self.toStarboard = int(j["to_starboard"])
            if f == "aid_type":
                self.aidType = int(j["aid_type"])
                #logger.info("ais: %9d Setting AtoN type %d" % (self.mmsi, self.aidType))
            if f == "name":
                self.shipname = j["name"]
                #logger.info("ais: %9d Setting AtoN name %s" % (self.mmsi, self.shipname))

# Targets indexed by MMSI
targets = {}

reapperiod = 60 * 60  # check once per hour
reaploiter = 7 * 24 * 60 * 60 # delete when not seen for a week
lastreap = time.time()

def reap():
    # Occasionally delete cached details for targets not seen for a while
    # The intent is to keep details for local targets (recreational, tugs, ferrys, etc)
    # and not keep them for transients (cargo ships, war ships, etc)
    global lastreap
    now = time.time()
    if now - lastreap > reapperiod:
        logger.debug("Reap")
        keys = targets.keys()
        toBeReaped = []
        for mmsi in keys:
            v = targets[mmsi]
            if now - v.last > reaploiter:
                toBeReaped.append(mmsi)
        for mmsi in toBeReaped:
                v = targets[mmsi]
                logger.debug("Reaping %9d '%s'" % (v.mmsi, v.shipname))
                del(targets[mmsi])
                del v
        lastreap = now

def createAISmsg(v):
    msg = {
        "mmsi": v.mmsi,
        "lat": v.lat,
        "lon": v.lon,
        "heading": v.heading,
        "course": v.course,
        "speed": v.speed,
        "shipname": v.shipname
    }
    if hasattr(v, 'shiptype'):
        msg["shiptype"] = v.shiptype
    if hasattr(v, 'shiptypeText'):
        msg["shiptypeText"] = v.shiptypeText
    if hasattr(v, 'destination'):
        msg["destination"] = v.destination
    if hasattr(v, 'toBow'):
        msg["toBow"] = v.toBow
    if hasattr(v, 'toStern'):
        msg["toStern"] = v.toStern
    if hasattr(v, 'toPort'):
        msg["toPort"] = v.toPort
    if hasattr(v, 'toStarboard'):
        msg["toStarboard"] = v.toStarboard
    if hasattr(v, 'aidType'):
        msg["aidType"] = v.aidType
    if hasattr(v, 'rxtime'):
        msg["rxtime"] = v.rxtime
    else:
        msg["last"] = int(v.last)
                
    #jmsg = json.dumps(msg, separators=(',', ':'))
    jmsg = json.dumps(msg)
    return(jmsg)

async def AISprocess(data):
    # We've received an AIS sentence from AIS-catcher
    #   Create a new target or update the existing one
    #   Update all the listeners

    rawdata = data.decode("utf-8") 

    if "}" in rawdata:
        rawdata=rawdata.replace('"nmea":"_','"nmea":["' )
        rawdata=rawdata.replace('"nmea":_"','"nmea":["' )

        s = json.loads(rawdata)

        # Sentences without an MMSI are discarded
        if not "mmsi" in s:
            return
        
        mmsi = int(s["mmsi"])
            
        if not mmsi in targets:
            logger.debug("New: %r" % (mmsi))
            targets[mmsi] = Target(mmsi)

        v = targets[mmsi]
        v.update(s)

        #logger.info("MMSI %9d '%r'" % (mmsi, s))
        #if mmsi > 10000000:
        
        logger.debug("MMSI %9s %9.4f %9.4f hdg %3d course %5.1f speed %4.1f '%s' " % (v.mmsi, v.lat, v.lon, v.heading, v.course, v.speed, v.shipname))
        msg = createAISmsg(v)

        # If a websocket closes while looping through the connections we get a "Set changed size during iteration" exception
        # so we cache the open connections and deal with the exceptions when sending
        # Except this doesn't always work so we catch other exceptions - maybe there's a better way to handle this
        cons = list(wsconnections);
        try:
            for ws in cons:
                try:
                    await ws.send(msg)
                except websockets.ConnectionClosed:
                    # There's a race condition - ws may have been removed elsewhere
                    if ws in wsconnections:
                        wsconnections.remove(ws);
                    logger.info("wshandler closed while sending - %d connections" % (len(wsconnections)))
        except Exception as e:
            info("looping through connections exception: %r" % (e))

async def AISclient():
    # This is a client of the AIS listener. It connects to the UDP port and gets one datagram per received AIS sentence
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((config["AISserverIP"], config["AISserverPORT"]))
    sock.setblocking(False)

    loop = asyncio.get_event_loop()
    while True:
        try:
            data, addr = await loop.sock_recvfrom(sock, 1024)
            await AISprocess(data)
            reap()
        except BlockingIOError:
            logger.debug(f"AISclient No data available yet")
        
wsconnections = set()

shipCacheTime = 15*60 # 15 minutes

async def sendCachedTargets(ws):
    # A client has connected - send them everything we know to get them up-to-speed
    now = time.time()
    keys = list(targets.keys())
    logger.info("sendCachedTargets %d targets" % (len(keys)))
    for mmsi in keys:
        # weird race condition if v is reaped while we're sending cached data
        if not (mmsi in targets):
            continue
        v = targets[mmsi]
        logger.debug("sendCachedTargets v %r keys %r" % (v, keys))
        if (now - v.last < shipCacheTime) or hasattr(v, "aidType"):
            msg = createAISmsg(v)
            try:
                await ws.send(msg)
            except websockets.ConnectionClosed:
                if ws in wsconnections:
                    wsconnections.remove(ws)
                logger.info("sendCachedTargets connection closed - %d connections" % (len(wsconnections)))
                return False
    return True

async def wshandler(ws):
    wsconnections.add(ws)
    logger.info("wshandler new - %d connections" % (len(wsconnections)))

    if not await sendCachedTargets(ws):
        if ws in wsconnections:
            wsconnections.remove(ws)
        logger.info("wshandler closed while sending cache - %d connections" % (len(wsconnections)))
        return
    
    while True:
        try:
            # do a recv which will fail (via an exception) if the connection closes. This essentially blocks the receive side of this "thread"
            message = await ws.recv()
            # discard any data sent
            logger.info(f"wshandler received '{message}' on websocket")
        except websockets.ConnectionClosed:
            if ws in wsconnections:
                wsconnections.remove(ws)
            logger.info("wshandler closed - %d connections" % (len(wsconnections)))
            break

async def main():
    logger.info("Listening for websocket requests on %r:%r" % (config["websocketIP"], config["websocketPORT"]))
    # Create an event loop that listens for websocket open requests (from browsers)
    async with serve(wshandler, config["websocketIP"], config["websocketPORT"]) as server:
        # Add a task to the event loop that listens for AIS updates
        logger.info("Listening for AIS on %r:%r" % (config["AISserverIP"], config["AISserverPORT"]))
        loop = asyncio.get_event_loop()
        loop.create_task(AISclient())
        await server.serve_forever() # doesn't return except for interrupt / error
    
if __name__ == '__main__':
    asyncio.run(main())
